import { getDb, saveDb } from '../config/database.js';
import { inventoryService } from './inventoryService.js';

class TrasladosService {
  async getTraslados(filters = {}) {
    const db = await getDb();
    let query = `
      SELECT t.*, 
             so.nombre as origen_nombre, 
             sd.nombre as destino_nombre, 
             e.nombre as repartidor_nombre, e.apellido_paterno as repartidor_apellido
      FROM traslados t
      JOIN sucursales so ON t.id_sucursal_origen = so.id
      JOIN sucursales sd ON t.id_sucursal_destino = sd.id
      JOIN empleados e ON t.id_repartidor = e.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.fecha) {
      query += ' AND t.fecha_salida = ?';
      params.push(filters.fecha);
    }
    if (filters.id_sucursal_origen) {
      query += ' AND t.id_sucursal_origen = ?';
      params.push(filters.id_sucursal_origen);
    }
    if (filters.id_sucursal_destino) {
      query += ' AND t.id_sucursal_destino = ?';
      params.push(filters.id_sucursal_destino);
    }
    if (filters.estatus) {
      query += ' AND t.estatus = ?';
      params.push(filters.estatus);
    }
    if (filters.sucursalId) {
      query += ' AND (t.id_sucursal_origen = ? OR t.id_sucursal_destino = ?)';
      params.push(filters.sucursalId, filters.sucursalId);
    }
    if (filters.repartidorId) {
      query += ' AND t.id_repartidor = ?';
      params.push(filters.repartidorId);
    }

    query += ' ORDER BY t.fecha_salida DESC, t.id DESC';

    const stmt = db.prepare(query);
    stmt.bind(params);
    const traslados = [];
    while (stmt.step()) {
      traslados.push(stmt.getAsObject());
    }
    stmt.free();

    for (let t of traslados) {
      const detailQuery = `
        SELECT dt.*, p.nombre as producto_nombre
        FROM detalle_traslados dt
        JOIN productos p ON dt.id_producto = p.id
        WHERE dt.id_traslado = ?
      `;
      const detailStmt = db.prepare(detailQuery);
      detailStmt.bind([t.id]);
      t.detalles = [];
      while (detailStmt.step()) {
        t.detalles.push(detailStmt.getAsObject());
      }
      detailStmt.free();
    }

    return traslados;
  }

  async createTraslado(data, usuarioId) {
    const db = await getDb();
    const { id_sucursal_origen, id_sucursal_destino, id_repartidor, fecha_salida, observaciones, detalles } = data;

    if (!id_sucursal_origen || !id_sucursal_destino || !id_repartidor || !fecha_salida || !detalles || detalles.length === 0) {
      throw new Error('Faltan datos requeridos o no hay productos en el traslado');
    }

    if (id_sucursal_origen === id_sucursal_destino) {
      throw new Error('El origen y el destino no pueden ser la misma sucursal');
    }

    try {
      db.run('BEGIN TRANSACTION');

      // Validar inventario en origen
      for (const item of detalles) {
        if (!item.cantidad || item.cantidad <= 0) {
          throw new Error('Las cantidades deben ser mayores a cero');
        }

        const invStmt = db.prepare('SELECT existencia FROM inventarios WHERE id_sucursal = ? AND id_producto = ?');
        invStmt.bind([id_sucursal_origen, item.id_producto]);
        if (!invStmt.step()) {
          invStmt.free();
          throw new Error(`El producto ID ${item.id_producto} no tiene inventario en la sucursal origen`);
        }
        const inv = invStmt.getAsObject();
        invStmt.free();

        if (inv.existencia < item.cantidad) {
          throw new Error(`Stock insuficiente para el producto ID ${item.id_producto} en origen`);
        }
      }

      // Crear traslado
      db.run(
        'INSERT INTO traslados (id_sucursal_origen, id_sucursal_destino, id_repartidor, fecha_salida, estatus, observaciones) VALUES (?, ?, ?, ?, ?, ?)',
        [id_sucursal_origen, id_sucursal_destino, id_repartidor, fecha_salida, 'en_ruta', observaciones || '']
      );
      const res = db.exec('SELECT last_insert_rowid() as id');
      const trasladoId = res[0].values[0][0];

      // Insertar detalle y descontar inventario de origen
      for (const item of detalles) {
        db.run(
          'INSERT INTO detalle_traslados (id_traslado, id_producto, cantidad_enviada, cantidad_recibida) VALUES (?, ?, ?, ?)',
          [trasladoId, item.id_producto, item.cantidad, 0]
        );

        // Descontar origen
        await inventoryService.registerMovement(db, {
          id_sucursal: id_sucursal_origen,
          id_producto: item.id_producto,
          tipo_movimiento: 'traslado_salida',
          cantidad: item.cantidad, 
          referencia: `Traslado #${trasladoId} a Destino ${id_sucursal_destino}`,
          id_usuario: usuarioId
        });
      }

      // Auditoría
      db.run(
        'INSERT INTO auditoria_operaciones (id_usuario, accion, modulo, registro_afectado, datos_nuevos) VALUES (?, ?, ?, ?, ?)',
        [usuarioId, 'crear', 'traslados', trasladoId, JSON.stringify(data)]
      );

      db.run('COMMIT');
      saveDb();

      return trasladoId;
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  }

  async confirmarEntrega(id, data, usuarioId) {
    const db = await getDb();
    
    const stmt = db.prepare('SELECT * FROM traslados WHERE id = ?');
    stmt.bind([id]);
    if (!stmt.step()) {
      stmt.free();
      throw new Error('Traslado no encontrado');
    }
    const traslado = stmt.getAsObject();
    stmt.free();

    if (traslado.estatus === 'entregado') {
      throw new Error('El traslado ya fue entregado previamente');
    }
    if (traslado.estatus === 'cancelado') {
      throw new Error('El traslado está cancelado y no puede entregarse');
    }

    try {
      db.run('BEGIN TRANSACTION');

      const today = new Date().toISOString().split('T')[0];
      
      // Get details
      const detailStmt = db.prepare('SELECT * FROM detalle_traslados WHERE id_traslado = ?');
      detailStmt.bind([id]);
      const detalles = [];
      while (detailStmt.step()) {
        detalles.push(detailStmt.getAsObject());
      }
      detailStmt.free();

      // For simplicity in this phase, we assume everything sent is received exactly.
      // Or we can take partial quantities from data if provided. Let's assume full receipt.
      for (const item of detalles) {
        const cantidadRecibida = item.cantidad_enviada; // Asumimos recepción completa
        
        db.run('UPDATE detalle_traslados SET cantidad_recibida = ? WHERE id = ?', [cantidadRecibida, item.id]);

        // Incrementar inventario en destino
        await inventoryService.registerMovement(db, {
          id_sucursal: traslado.id_sucursal_destino,
          id_producto: item.id_producto,
          tipo_movimiento: 'traslado_entrada',
          cantidad: cantidadRecibida, 
          referencia: `Traslado #${id} desde Origen ${traslado.id_sucursal_origen}`,
          id_usuario: usuarioId
        });
      }

      db.run('UPDATE traslados SET estatus = ?, fecha_entrega = ? WHERE id = ?', ['entregado', today, id]);

      db.run(
        'INSERT INTO auditoria_operaciones (id_usuario, accion, modulo, registro_afectado) VALUES (?, ?, ?, ?)',
        [usuarioId, 'confirmar_entrega', 'traslados', id]
      );

      db.run('COMMIT');
      saveDb();
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  }

  async cancelarTraslado(id, usuarioId) {
    const db = await getDb();
    
    const stmt = db.prepare('SELECT * FROM traslados WHERE id = ?');
    stmt.bind([id]);
    if (!stmt.step()) {
      stmt.free();
      throw new Error('Traslado no encontrado');
    }
    const traslado = stmt.getAsObject();
    stmt.free();

    if (traslado.estatus === 'entregado') {
      throw new Error('No se puede cancelar un traslado que ya fue entregado');
    }
    if (traslado.estatus === 'cancelado') {
      throw new Error('El traslado ya está cancelado');
    }

    try {
      db.run('BEGIN TRANSACTION');

      const detailStmt = db.prepare('SELECT * FROM detalle_traslados WHERE id_traslado = ?');
      detailStmt.bind([id]);
      const detalles = [];
      while (detailStmt.step()) {
        detalles.push(detailStmt.getAsObject());
      }
      detailStmt.free();

      // Devolver inventario a origen
      for (const item of detalles) {
        await inventoryService.registerMovement(db, {
          id_sucursal: traslado.id_sucursal_origen,
          id_producto: item.id_producto,
          tipo_movimiento: 'traslado_entrada', // We use entrada to return it to origin
          cantidad: item.cantidad_enviada,
          referencia: `Cancelación Traslado #${id}`,
          id_usuario: usuarioId
        });
      }

      db.run('UPDATE traslados SET estatus = ? WHERE id = ?', ['cancelado', id]);

      db.run(
        'INSERT INTO auditoria_operaciones (id_usuario, accion, modulo, registro_afectado) VALUES (?, ?, ?, ?)',
        [usuarioId, 'cancelar', 'traslados', id]
      );

      db.run('COMMIT');
      saveDb();
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  }
}

export default new TrasladosService();
