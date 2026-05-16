import { getDb, saveDb } from '../config/database.js';
import { inventoryService } from './inventoryService.js';

export const ventasService = {

  /**
   * Crear una venta completa con descuento de inventario y auditoría
   */
  async createVenta(ventaData, items, idUsuario) {
    const db = await getDb();
    const { id_sucursal, id_empleado, metodo_pago } = ventaData;

    // 1. Validar datos básicos
    if (!id_sucursal || !id_empleado || !items || items.length === 0) {
      throw new Error('Datos de venta incompletos: se requiere sucursal, empleado y al menos un producto');
    }

    // 2. Validar que ningún producto esté inactivo
    for (const item of items) {
      if (!item.id_producto || !item.cantidad || item.cantidad <= 0) {
        throw new Error('Cada producto debe tener ID y cantidad mayor a cero');
      }
      const prodCheck = db.exec('SELECT activo, nombre FROM productos WHERE id = ?', [item.id_producto]);
      if (prodCheck.length === 0 || prodCheck[0].values.length === 0) {
        throw new Error(`Producto ID ${item.id_producto} no encontrado`);
      }
      if (prodCheck[0].values[0][0] !== 1) {
        throw new Error(`El producto "${prodCheck[0].values[0][1]}" está inactivo y no puede venderse`);
      }
    }

    // 3. Validar stock antes de empezar
    const stockCheck = await inventoryService.validateStock(db, id_sucursal, items);
    if (!stockCheck.valid) {
      // Obtener nombre del producto para mejor mensaje
      const pName = db.exec('SELECT nombre FROM productos WHERE id = ?', [stockCheck.id_producto]);
      const nombre = pName.length > 0 ? pName[0].values[0][0] : `ID ${stockCheck.id_producto}`;
      throw new Error(`Stock insuficiente para "${nombre}". Verifique existencias antes de vender.`);
    }

    try {
      db.run('BEGIN TRANSACTION');

      // 4. Calcular totales
      let subtotal = 0;
      items.forEach(item => {
        item.subtotal = item.cantidad * item.precio_unitario;
        subtotal += item.subtotal;
      });
      const total = subtotal;

      // 5. Insertar Venta
      const fecha = new Date().toISOString().split('T')[0];
      const ventaStmt = db.prepare(`
        INSERT INTO ventas (id_sucursal, id_empleado, fecha, subtotal, total, metodo_pago, estatus)
        VALUES (?, ?, ?, ?, ?, ?, 'completada')
      `);
      ventaStmt.run([id_sucursal, id_empleado, fecha, subtotal, total, metodo_pago || 'efectivo']);
      const id_venta = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
      ventaStmt.free();

      // 6. Insertar Detalle y Actualizar Inventario
      for (const item of items) {
        const detStmt = db.prepare(`
          INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario, subtotal)
          VALUES (?, ?, ?, ?, ?)
        `);
        detStmt.run([id_venta, item.id_producto, item.cantidad, item.precio_unitario, item.subtotal]);
        detStmt.free();

        // Descontar de inventario y registrar movimiento
        await inventoryService.registerMovement(db, {
          id_sucursal,
          id_producto: item.id_producto,
          tipo_movimiento: 'venta',
          cantidad: item.cantidad,
          referencia: `Venta #${id_venta}`,
          id_usuario: idUsuario
        });
      }

      // 7. Registrar auditoría
      const auditStmt = db.prepare(`
        INSERT INTO auditoria_operaciones (id_usuario, accion, modulo, registro_afectado, datos_nuevos)
        VALUES (?, 'crear_venta', 'ventas', ?, ?)
      `);
      auditStmt.run([idUsuario, `venta_${id_venta}`, JSON.stringify({ id_venta, total, items: items.length, metodo_pago: metodo_pago || 'efectivo' })]);
      auditStmt.free();

      db.run('COMMIT');
      saveDb();

      // 8. Retornar la venta completa para el ticket
      return this.getVentaById(id_venta);
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  },

  /**
   * Obtener una venta por ID con su detalle
   */
  async getVentaById(id) {
    const db = await getDb();

    // Venta principal
    const ventaRes = db.exec(`
      SELECT v.*, s.nombre as sucursal_nombre, s.direccion as sucursal_direccion, s.telefono as sucursal_telefono,
             e.nombre as empleado_nombre, e.apellido_paterno as empleado_apellido
      FROM ventas v
      JOIN sucursales s ON v.id_sucursal = s.id
      JOIN empleados e ON v.id_empleado = e.id
      WHERE v.id = ?
    `, [id]);

    if (ventaRes.length === 0 || ventaRes[0].values.length === 0) {
      throw new Error('Venta no encontrada');
    }

    const columns = ventaRes[0].columns;
    const values = ventaRes[0].values[0];
    const venta = {};
    columns.forEach((col, i) => { venta[col] = values[i]; });

    // Detalle
    const detRes = db.exec(`
      SELECT dv.*, p.nombre as producto_nombre, p.tipo as producto_tipo
      FROM detalle_ventas dv
      JOIN productos p ON dv.id_producto = p.id
      WHERE dv.id_venta = ?
    `, [id]);

    venta.items = [];
    if (detRes.length > 0) {
      const detCols = detRes[0].columns;
      venta.items = detRes[0].values.map(row => {
        const item = {};
        detCols.forEach((col, i) => { item[col] = row[i]; });
        return item;
      });
    }

    return venta;
  },

  /**
   * Listar ventas con filtros
   */
  async getAll({ sucursalId, fechaDesde, fechaHasta, vendedorId, metodoPago, estatus, search, limit = 50, offset = 0 }, userRole, userSucursalId) {
    const db = await getDb();
    let query = `
      SELECT v.*, s.nombre as sucursal_nombre,
             e.nombre || ' ' || e.apellido_paterno as vendedor_nombre,
             (SELECT COUNT(*) FROM detalle_ventas dv WHERE dv.id_venta = v.id) as total_productos,
             (SELECT SUM(dv.cantidad) FROM detalle_ventas dv WHERE dv.id_venta = v.id) as total_piezas
      FROM ventas v
      JOIN sucursales s ON v.id_sucursal = s.id
      JOIN empleados e ON v.id_empleado = e.id
      WHERE 1=1
    `;
    const params = [];

    // Restricción por rol: si no es admin ni propietario, solo ven su sucursal
    if (!['propietario', 'admin_sistema'].includes(userRole) && userSucursalId) {
      query += ` AND v.id_sucursal = ?`;
      params.push(userSucursalId);
    } else if (sucursalId && sucursalId !== 'all') {
      query += ` AND v.id_sucursal = ?`;
      params.push(sucursalId);
    }

    if (fechaDesde) {
      query += ` AND v.fecha >= ?`;
      params.push(fechaDesde);
    }
    if (fechaHasta) {
      query += ` AND v.fecha <= ?`;
      params.push(fechaHasta);
    }
    if (vendedorId && vendedorId !== 'all') {
      query += ` AND v.id_empleado = ?`;
      params.push(vendedorId);
    }
    if (metodoPago && metodoPago !== 'all') {
      query += ` AND v.metodo_pago = ?`;
      params.push(metodoPago);
    }
    if (estatus && estatus !== 'all') {
      query += ` AND v.estatus = ?`;
      params.push(estatus);
    }
    if (search) {
      query += ` AND (e.nombre LIKE ? OR s.nombre LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam);
    }

    query += ` ORDER BY v.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = db.prepare(query);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  /**
   * Cancelar una venta y reponer inventario
   */
  async cancelarVenta(id_venta, idUsuario, motivo) {
    const db = await getDb();

    // 1. Verificar que la venta existe y está completada
    const ventaRes = db.exec('SELECT * FROM ventas WHERE id = ?', [id_venta]);
    if (ventaRes.length === 0 || ventaRes[0].values.length === 0) {
      throw new Error('Venta no encontrada');
    }

    const columns = ventaRes[0].columns;
    const values = ventaRes[0].values[0];
    const venta = {};
    columns.forEach((col, i) => { venta[col] = values[i]; });

    if (venta.estatus === 'cancelada') {
      throw new Error('Esta venta ya fue cancelada previamente');
    }

    try {
      db.run('BEGIN TRANSACTION');

      // 2. Marcar venta como cancelada
      db.run(`UPDATE ventas SET estatus = 'cancelada', updated_at = datetime('now') WHERE id = ?`, [id_venta]);

      // 3. Obtener detalle para reponer inventario
      const detRes = db.exec('SELECT id_producto, cantidad FROM detalle_ventas WHERE id_venta = ?', [id_venta]);
      if (detRes.length > 0) {
        for (const row of detRes[0].values) {
          const id_producto = row[0];
          const cantidad = row[1];

          // Reponer inventario con movimiento tipo entrada (cancelación)
          await inventoryService.registerMovement(db, {
            id_sucursal: venta.id_sucursal,
            id_producto,
            tipo_movimiento: 'entrada',
            cantidad,
            referencia: `Cancelación Venta #${id_venta}`,
            id_usuario: idUsuario
          });
        }
      }

      // 4. Registrar auditoría con motivo
      const auditStmt = db.prepare(`
        INSERT INTO auditoria_operaciones (id_usuario, accion, modulo, registro_afectado, datos_anteriores, datos_nuevos)
        VALUES (?, 'cancelar_venta', 'ventas', ?, ?, ?)
      `);
      auditStmt.run([
        idUsuario,
        `venta_${id_venta}`,
        JSON.stringify({ estatus: 'completada', total: venta.total }),
        JSON.stringify({ estatus: 'cancelada', motivo: motivo || 'Sin motivo' })
      ]);
      auditStmt.free();

      db.run('COMMIT');
      saveDb();
      return { message: 'Venta cancelada y stock repuesto exitosamente' };
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  },

  /**
   * Obtener productos disponibles con stock para una sucursal
   */
  async getProductosDisponibles(id_sucursal) {
    const db = await getDb();
    const stmt = db.prepare(`
      SELECT p.id, p.nombre, p.precio, p.tipo, p.unidad_medida,
             c.nombre as categoria_nombre,
             COALESCE(i.existencia, 0) as existencia
      FROM productos p
      JOIN categorias c ON p.id_categoria = c.id
      LEFT JOIN inventarios i ON i.id_producto = p.id AND i.id_sucursal = ?
      WHERE p.activo = 1
      ORDER BY c.nombre ASC, p.nombre ASC
    `);
    stmt.bind([id_sucursal]);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  /**
   * Obtener vendedores (empleados de tipo ventas o todos según rol)
   */
  async getVendedores(id_sucursal) {
    const db = await getDb();
    let query = `
      SELECT e.id, e.nombre || ' ' || e.apellido_paterno as nombre_completo, e.id_sucursal
      FROM empleados e
      JOIN puestos p ON e.id_puesto = p.id
      WHERE e.estatus = 'activo' 
      AND (p.nombre = 'Vendedor/Cajero' OR e.tipo_personal = 'ventas')
    `;
    const params = [];
    if (id_sucursal) {
      query += ` AND e.id_sucursal = ?`;
      params.push(id_sucursal);
    }
    query += ` ORDER BY e.nombre ASC`;

    const stmt = db.prepare(query);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
};
