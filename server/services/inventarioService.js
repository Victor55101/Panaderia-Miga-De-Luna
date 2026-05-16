import { getDb, saveDb } from '../config/database.js';

export const inventarioService = {
  async getAll({ sucursalId = 'all', search = '', stockStatus = 'all' }) {
    const db = await getDb();
    let query = `
      SELECT i.*, s.nombre as sucursal_nombre, p.nombre as producto_nombre,
             c.nombre as categoria_nombre
      FROM inventarios i
      JOIN sucursales s ON i.id_sucursal = s.id
      JOIN productos p ON i.id_producto = p.id
      JOIN categorias c ON p.id_categoria = c.id
      WHERE 1=1
    `;
    const params = [];

    if (sucursalId !== 'all') {
      query += ` AND i.id_sucursal = ?`;
      params.push(sucursalId);
    }

    if (search) {
      query += ` AND p.nombre LIKE ?`;
      const searchParam = `%${search}%`;
      params.push(searchParam);
    }

    if (stockStatus === 'agotado') {
      query += ` AND i.existencia <= 0`;
    } else if (stockStatus === 'bajo') {
      query += ` AND i.existencia > 0 AND i.existencia < i.minimo`;
    } else if (stockStatus === 'sobrestock') {
      query += ` AND i.existencia > i.maximo`;
    } else if (stockStatus === 'optimo') {
      query += ` AND i.existencia >= i.minimo AND i.existencia <= i.maximo`;
    }

    query += ` ORDER BY s.nombre ASC, p.nombre ASC`;

    const stmt = db.prepare(query);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  async registrarMovimiento(data, usuarioId) {
    const { id_sucursal, id_producto, tipo_movimiento, cantidad, referencia } = data;
    const db = await getDb();

    // 1. Get or create inventory record
    let existenceRes = db.exec('SELECT existencia FROM inventarios WHERE id_sucursal = ? AND id_producto = ?', [id_sucursal, id_producto]);
    let existencia_anterior = 0;

    if (existenceRes.length > 0 && existenceRes[0].values.length > 0) {
      existencia_anterior = existenceRes[0].values[0][0];
    } else {
      // Create record if not exists
      db.run('INSERT INTO inventarios (id_sucursal, id_producto, existencia) VALUES (?, ?, 0)', [id_sucursal, id_producto]);
    }

    // 2. Calculate new existence
    let existencia_nueva = existencia_anterior;
    const qty = Math.abs(parseInt(cantidad));

    // Determine if it adds or subtracts
    // Restan: venta, salida, traslado_salida, merma, ajuste_negativo, correccion (si es negativa)
    // Suman: entrada, traslado_entrada, produccion, ajuste_positivo
    let factor = 1;
    if (['venta', 'salida', 'traslado_salida', 'merma', 'ajuste_negativo'].includes(tipo_movimiento)) {
      factor = -1;
    } else if (tipo_movimiento === 'correccion' || tipo_movimiento === 'ajuste') {
      // For generic adjustment or correction, we use the sign of the original quantity if provided,
      // or assume negative if called from certain contexts.
      // But usually manual adjustment sends the sign in the value.
      factor = parseInt(cantidad) >= 0 ? 1 : -1;
    }

    const cantidad_neta = qty * factor;
    existencia_nueva += cantidad_neta;

    if (existencia_nueva < 0) {
      throw new Error('La existencia no puede ser negativa');
    }

    // 3. Update inventory
    db.run(`
      UPDATE inventarios 
      SET existencia = ?, updated_at = datetime('now') 
      WHERE id_sucursal = ? AND id_producto = ?
    `, [existencia_nueva, id_sucursal, id_producto]);

    // 4. Record movement
    // Map to 'ajuste' to satisfy DB CHECK constraint
    const db_tipo = ['merma', 'correccion', 'ajuste_positivo', 'ajuste_negativo'].includes(tipo_movimiento) 
      ? 'ajuste' 
      : tipo_movimiento;

    db.run(`
      INSERT INTO movimientos_inventario 
      (id_sucursal, id_producto, tipo_movimiento, cantidad, existencia_anterior, existencia_nueva, referencia, id_usuario)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id_sucursal, id_producto, db_tipo, cantidad_neta, existencia_anterior, existencia_nueva, referencia, usuarioId]);

    saveDb();
    return { existencia_nueva };
  },

  async getHistorial({ sucursalId = 'all', productoId = 'all', limit = 50 }) {
    const db = await getDb();
    let query = `
      SELECT m.*, s.nombre as sucursal_nombre, p.nombre as producto_nombre, u.username
      FROM movimientos_inventario m
      JOIN sucursales s ON m.id_sucursal = s.id
      JOIN productos p ON m.id_producto = p.id
      LEFT JOIN usuarios u ON m.id_usuario = u.id
      WHERE 1=1
    `;
    const params = [];

    if (sucursalId !== 'all') {
      query += ` AND m.id_sucursal = ?`;
      params.push(sucursalId);
    }
    if (productoId !== 'all') {
      query += ` AND m.id_producto = ?`;
      params.push(productoId);
    }

    query += ` ORDER BY m.created_at DESC LIMIT ?`;
    params.push(limit);

    const stmt = db.prepare(query);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  async updateLimits(id, { minimo, maximo }) {
    const min = parseInt(minimo) || 0;
    const max = parseInt(maximo) || 0;

    if (min < 0) throw new Error('El stock mínimo no puede ser negativo');
    if (max <= 0) throw new Error('La capacidad máxima debe ser mayor que cero');
    if (min >= max) throw new Error('El stock mínimo debe ser estrictamente menor que la capacidad máxima');

    const db = await getDb();
    db.run(`
      UPDATE inventarios 
      SET minimo = ?, maximo = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [min, max, id]);
    saveDb();
    return true;
  },

  async getProductosMovimiento({ sucursalId, tipoMovimiento }) {
    const db = await getDb();
    let query = "";
    let params = [];

    const tipo = (tipoMovimiento || '').toLowerCase();

    if (['merma', 'salida', 'traslado_salida'].includes(tipo)) {
      // Only products with existing stock > 0 in the branch
      query = `
        SELECT p.id, p.nombre, i.existencia
        FROM productos p
        JOIN inventarios i ON p.id = i.id_producto
        WHERE i.id_sucursal = ? AND i.existencia > 0 AND p.activo = 1
        ORDER BY p.nombre ASC
      `;
      params = [sucursalId];
    } else {
      // entrada, produccion, ajuste, correccion, ajuste_positivo, ajuste_negativo
      // Show ALL active products; LEFT JOIN to include current stock if it exists
      query = `
        SELECT p.id, p.nombre,
               COALESCE(
                 (SELECT existencia FROM inventarios
                  WHERE id_producto = p.id AND id_sucursal = ?
                  LIMIT 1),
                 0
               ) AS existencia
        FROM productos p
        WHERE p.activo = 1
        ORDER BY p.nombre ASC
      `;
      params = [sucursalId];
    }

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
