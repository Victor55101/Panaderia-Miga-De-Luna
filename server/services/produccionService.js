import { getDb, saveDb } from '../config/database.js';
import { inventoryService } from './inventoryService.js';
import insumoService from './insumoService.js';

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

      // 1. Calcular insumos requeridos totales agregados por id_insumo
      const insumosRequeridos = {}; // id_insumo -> { nombre, total_requerido, unidad }
      
      for (const item of detalles) {
        // Obtener receta del producto
        const recipeStmt = db.prepare(`
          SELECT r.id_insumo, r.cantidad_requerida, i.nombre as insumo_nombre, i.unidad_medida, i.activo as insumo_activo
          FROM recetas r
          JOIN insumos i ON r.id_insumo = i.id
          WHERE r.id_producto = ?
        `);
        recipeStmt.bind([item.id_producto]);
        
        let hasRecipe = false;
        while (recipeStmt.step()) {
          hasRecipe = true;
          const rec = recipeStmt.getAsObject();

          if (rec.insumo_activo !== 1) {
            // Obtener nombre del producto para el error
            const prodStmt = db.prepare('SELECT nombre FROM productos WHERE id = ?');
            prodStmt.bind([item.id_producto]);
            const prodNombre = prodStmt.step() ? prodStmt.getAsObject().nombre : `con ID ${item.id_producto}`;
            prodStmt.free();
            recipeStmt.free();
            throw new Error(`El producto "${prodNombre}" tiene una receta con el insumo inactivo "${rec.insumo_nombre}". Active el insumo o actualice la receta antes de producir.`);
          }

          const req = rec.cantidad_requerida * item.cantidad;
          
          if (!insumosRequeridos[rec.id_insumo]) {
            insumosRequeridos[rec.id_insumo] = {
              nombre: rec.insumo_nombre,
              unidad: rec.unidad_medida,
              total_requerido: 0
            };
          }
          insumosRequeridos[rec.id_insumo].total_requerido += req;
        }
        recipeStmt.free();
        
        if (!hasRecipe) {
          // Obtener nombre del producto para el error
          const prodStmt = db.prepare('SELECT nombre FROM productos WHERE id = ?');
          prodStmt.bind([item.id_producto]);
          let prodNombre = `con ID ${item.id_producto}`;
          if (prodStmt.step()) {
            prodNombre = `"${prodStmt.getAsObject().nombre}"`;
          }
          prodStmt.free();
          throw new Error(`El producto ${prodNombre} no tiene una receta registrada. Registre su receta antes de realizar la producción.`);
        }
      }

      // 2. Validar existencias de insumos agregados antes de proceder
      const erroresStock = [];
      for (const [id_insumo, reqData] of Object.entries(insumosRequeridos)) {
        const insStmt = db.prepare('SELECT stock_actual, nombre FROM insumos WHERE id = ?');
        insStmt.bind([id_insumo]);
        if (insStmt.step()) {
          const { stock_actual, nombre } = insStmt.getAsObject();
          const requerido = Math.round(reqData.total_requerido * 10000) / 10000;
          if (stock_actual < requerido) {
            const faltante = Math.round((requerido - stock_actual) * 10000) / 10000;
            erroresStock.push(`${nombre}: Requerido ${requerido} ${reqData.unidad}, Disponible ${stock_actual} ${reqData.unidad}. Faltan ${faltante} ${reqData.unidad}.`);
          }
        }
        insStmt.free();
      }

      if (erroresStock.length > 0) {
        throw new Error('Stock de materia prima insuficiente:\n' + erroresStock.join('\n'));
      }

      // 3. Insertar produccion
      db.run(
        'INSERT INTO producciones (fecha, id_sucursal_planta, id_responsable, total_piezas, observaciones) VALUES (?, ?, ?, ?, ?)',
        [fecha, id_sucursal, id_responsable, totalPiezas, observaciones || '']
      );
      const res = db.exec('SELECT last_insert_rowid() as id');
      const produccionId = res[0].values[0][0];

      // 4. Insertar detalles, actualizar inventario de productos y descontar insumos
      for (const item of detalles) {
        db.run(
          'INSERT INTO detalle_produccion (id_produccion, id_producto, cantidad, costo_unitario) VALUES (?, ?, ?, ?)',
          [produccionId, item.id_producto, item.cantidad, item.costo_unitario || 0]
        );

        // Update product inventory
        await inventoryService.registerMovement(db, {
          id_sucursal: id_sucursal,
          id_producto: item.id_producto,
          tipo_movimiento: 'produccion',
          cantidad: item.cantidad,
          referencia: `Producción #${produccionId}`,
          id_usuario: usuarioId
        });
      }

      // 5. Descontar insumos (materia prima) de forma agregada
      for (const [id_insumo, reqData] of Object.entries(insumosRequeridos)) {
        await insumoService.registerMovimiento(db, {
          id_insumo: parseInt(id_insumo),
          tipo_movimiento: 'consumo_produccion',
          cantidad: reqData.total_requerido,
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

      // 1. Revertir inventario de productos
      const detailStmt = db.prepare('SELECT * FROM detalle_produccion WHERE id_produccion = ?');
      detailStmt.bind([id]);
      const detalles = [];
      while (detailStmt.step()) {
        detalles.push(detailStmt.getAsObject());
      }
      detailStmt.free();

      for (const item of detalles) {
        await inventoryService.registerMovement(db, {
          id_sucursal: produccion.id_sucursal_planta,
          id_producto: item.id_producto,
          tipo_movimiento: 'salida', 
          cantidad: item.cantidad,
          referencia: `Cancelación Producción #${id}`,
          id_usuario: usuarioId
        });
      }

      // 2. Revertir deducción de insumos
      const movStmt = db.prepare(`
        SELECT id_insumo, cantidad 
        FROM movimientos_insumos 
        WHERE referencia = ? AND tipo_movimiento = 'consumo_produccion'
      `);
      movStmt.bind([`Producción #${id}`]);
      const movimientosARevertir = [];
      while (movStmt.step()) {
        movimientosARevertir.push(movStmt.getAsObject());
      }
      movStmt.free();

      for (const mov of movimientosARevertir) {
        const cantidadAReversar = Math.abs(mov.cantidad);
        await insumoService.registerMovimiento(db, {
          id_insumo: mov.id_insumo,
          tipo_movimiento: 'reverso_produccion',
          cantidad: cantidadAReversar,
          referencia: `Cancelación Producción #${id}`,
          id_usuario: usuarioId
        });
      }

      // 3. Actualizar estado de producción a cancelada
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
