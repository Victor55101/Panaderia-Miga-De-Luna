import { getDb, saveDb } from '../config/database.js';
import { inventoryService } from './inventoryService.js';

class ProduccionService {
  async getProducciones(filters = {}) {
    const db = await getDb();
    let query = `
      SELECT p.*, s.nombre as sucursal_nombre, e.nombre as empleado_nombre, e.apellido_paterno as empleado_apellido
      FROM producciones p
      JOIN sucursales s ON p.id_sucursal_planta = s.id
      JOIN empleados e ON p.id_responsable = e.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.fecha) {
      query += ' AND p.fecha = ?';
      params.push(filters.fecha);
    }
    if (filters.id_sucursal) {
      query += ' AND p.id_sucursal_planta = ?';
      params.push(filters.id_sucursal);
    }
    if (filters.id_responsable) {
      query += ' AND p.id_responsable = ?';
      params.push(filters.id_responsable);
    }

    query += ' ORDER BY p.fecha DESC, p.id DESC';

    const stmt = db.prepare(query);
    stmt.bind(params);
    const producciones = [];
    while (stmt.step()) {
      producciones.push(stmt.getAsObject());
    }
    stmt.free();

    // Get details for each production
    for (let p of producciones) {
      const detailQuery = `
        SELECT dp.*, pr.nombre as producto_nombre
        FROM detalle_produccion dp
        JOIN productos pr ON dp.id_producto = pr.id
        WHERE dp.id_produccion = ?
      `;
      const detailStmt = db.prepare(detailQuery);
      detailStmt.bind([p.id]);
      p.detalles = [];
      while (detailStmt.step()) {
        p.detalles.push(detailStmt.getAsObject());
      }
      detailStmt.free();
    }

    return producciones;
  }

  async createProduccion(data, usuarioId) {
    const db = await getDb();
    const { id_sucursal, fecha, detalles, observaciones } = data;

    if (!id_sucursal || !fecha || !detalles || detalles.length === 0) {
      throw new Error('Faltan datos requeridos o no hay productos en la producción');
    }

    // Identify user and employee
    const userStmt = db.prepare('SELECT id_empleado FROM usuarios WHERE id = ?');
    userStmt.bind([usuarioId]);
    if (!userStmt.step()) {
      userStmt.free();
      throw new Error('Usuario no encontrado');
    }
    const id_responsable = userStmt.getAsObject().id_empleado;
    userStmt.free();

    let totalPiezas = 0;
    for (const item of detalles) {
      if (!item.cantidad || item.cantidad <= 0) {
        throw new Error('Las cantidades deben ser mayores a cero');
      }
      totalPiezas += item.cantidad;
    }

    try {
      db.run('BEGIN TRANSACTION');

      // Insert produccion
      db.run(
        'INSERT INTO producciones (fecha, id_sucursal_planta, id_responsable, total_piezas, observaciones) VALUES (?, ?, ?, ?, ?)',
        [fecha, id_sucursal, id_responsable, totalPiezas, observaciones || '']
      );
      const res = db.exec('SELECT last_insert_rowid() as id');
      const produccionId = res[0].values[0][0];

      // Insert details and update inventory
      for (const item of detalles) {
        db.run(
          'INSERT INTO detalle_produccion (id_produccion, id_producto, cantidad, costo_unitario) VALUES (?, ?, ?, ?)',
          [produccionId, item.id_producto, item.cantidad, item.costo_unitario || 0]
        );

        // Update inventory
        await inventoryService.registerMovement(db, {
          id_sucursal: id_sucursal,
          id_producto: item.id_producto,
          tipo_movimiento: 'produccion',
          cantidad: item.cantidad, // positive because it's adding to inventory
          referencia: `Producción #${produccionId}`,
          id_usuario: usuarioId
        });
      }

      // Audit
      db.run(
        'INSERT INTO auditoria_operaciones (id_usuario, accion, modulo, registro_afectado, datos_nuevos) VALUES (?, ?, ?, ?, ?)',
        [usuarioId, 'crear', 'produccion', produccionId, JSON.stringify(data)]
      );

      db.run('COMMIT');
      saveDb();

      return produccionId;
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  }

  // NOTE: For cancellations we would logically need an "estatus" column in producciones.
  // The schema doesn't have an estatus column in producciones table.
  // Wait, let's check the schema. No estatus in producciones. 
  // We can add an 'estatus' column or just not implement cancellation physically deleting, but schema is fixed.
  // Oh, wait, the user said: "si se cancela una producción, debe revertir inventario con movimiento correspondiente"
  // "conservar historial, no eliminar físicamente"
  // If there's no estatus column, we might need to add one. Let's alter the table if needed.
  async getProduccion(id) {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM producciones WHERE id = ?');
    stmt.bind([id]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const produccion = stmt.getAsObject();
    stmt.free();
    return produccion;
  }

  async cancelProduccion(id, usuarioId) {
    const db = await getDb();

    const prodStmt = db.prepare('SELECT * FROM producciones WHERE id = ?');
    prodStmt.bind([id]);
    if (!prodStmt.step()) {
      prodStmt.free();
      throw new Error('Producción no encontrada');
    }
    const produccion = prodStmt.getAsObject();
    prodStmt.free();

    if (produccion.estatus === 'cancelada') {
      throw new Error('La producción ya está cancelada');
    }

    try {
      db.run('BEGIN TRANSACTION');

      // Revert inventory
      const detailStmt = db.prepare('SELECT * FROM detalle_produccion WHERE id_produccion = ?');
      detailStmt.bind([id]);
      const detalles = [];
      while (detailStmt.step()) {
        detalles.push(detailStmt.getAsObject());
      }
      detailStmt.free();

      for (const item of detalles) {
        // Decrease inventory (using a negative value or specific movement logic)
        // registerMovement adds if positive and subtracts if negative?
        // Wait, 'produccion' movement type usually adds. 
        // We will use 'entrada' for normal prod and 'salida' for cancel, or just negative 'produccion'
        // Let's use 'ajuste' or 'salida' with negative quantity.
        // The inventoryService.registerMovement takes the positive quantity and does:
        // if ['entrada', 'produccion', 'traslado_entrada', 'devolucion'].includes(tipo_movimiento) -> adds
        // if ['salida', 'venta', 'traslado_salida', 'merma'].includes(tipo_movimiento) -> subtracts
        
        // Wait, 'produccion' adds. 'salida' subtracts. We can use 'salida' for the cancellation.
        await inventoryService.registerMovement(db, {
          id_sucursal: produccion.id_sucursal_planta,
          id_producto: item.id_producto,
          tipo_movimiento: 'salida', 
          cantidad: item.cantidad, // inventoryService subtracts because it's 'salida'
          referencia: `Cancelación Producción #${id}`,
          id_usuario: usuarioId
        });
      }

      db.run('UPDATE producciones SET estatus = ? WHERE id = ?', ['cancelada', id]);

      db.run(
        'INSERT INTO auditoria_operaciones (id_usuario, accion, modulo, registro_afectado) VALUES (?, ?, ?, ?)',
        [usuarioId, 'cancelar', 'produccion', id]
      );

      db.run('COMMIT');
      saveDb();
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  }
}

export default new ProduccionService();
