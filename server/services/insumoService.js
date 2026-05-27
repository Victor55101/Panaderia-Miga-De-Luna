import { getDb, saveDb } from '../config/database.js';

/**
 * Servicio de Insumos (Materia Prima)
 * CRUD completo + lógica de estados de stock + movimientos
 */
class InsumoService {

  /* ── Listar todos ─────────────────────────────────────────────────────── */
  async getAll({ search = '', stockStatus = 'all', activo = '' } = {}) {
    const db = await getDb();
    let query = 'SELECT * FROM insumos WHERE 1=1';
    const params = [];

    if (activo !== '') {
      query += ' AND activo = ?';
      params.push(parseInt(activo));
    }

    if (search) {
      query += ' AND nombre LIKE ?';
      params.push(`%${search}%`);
    }

    if (stockStatus === 'agotado') {
      query += ' AND stock_actual <= 0';
    } else if (stockStatus === 'bajo') {
      query += ' AND stock_actual > 0 AND stock_actual < stock_minimo';
    } else if (stockStatus === 'sobrestock') {
      query += ' AND stock_actual > stock_maximo';
    } else if (stockStatus === 'optimo') {
      query += ' AND stock_actual >= stock_minimo AND stock_actual <= stock_maximo';
    }

    query += ' ORDER BY nombre ASC';

    const stmt = db.prepare(query);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  /* ── Obtener uno ──────────────────────────────────────────────────────── */
  async getById(id) {
    const db = await getDb();
    const stmt = db.prepare('SELECT * FROM insumos WHERE id = ?');
    stmt.bind([id]);
    if (!stmt.step()) { stmt.free(); return null; }
    const insumo = stmt.getAsObject();
    stmt.free();
    return insumo;
  }

  /* ── Crear ────────────────────────────────────────────────────────────── */
  async create(data, usuarioId) {
    const { nombre, unidad_medida, costo_unitario, stock_actual, stock_minimo, stock_maximo } = data;
    this._validate(data);

    const db = await getDb();

    // Verificar nombre duplicado
    const checkStmt = db.prepare('SELECT id FROM insumos WHERE nombre = ?');
    checkStmt.bind([nombre.trim()]);
    if (checkStmt.step()) {
      checkStmt.free();
      throw new Error(`Ya existe un insumo con el nombre "${nombre}"`);
    }
    checkStmt.free();

    db.run(
      `INSERT INTO insumos (nombre, unidad_medida, costo_unitario, stock_actual, stock_minimo, stock_maximo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre.trim(), unidad_medida.trim(), costo_unitario || 0, stock_actual || 0, stock_minimo || 0, stock_maximo || 1000]
    );
    const res = db.exec('SELECT last_insert_rowid() as id');
    const id = res[0].values[0][0];

    // Auditoría
    db.run(
      'INSERT INTO auditoria_operaciones (id_usuario, accion, modulo, registro_afectado, datos_nuevos) VALUES (?, ?, ?, ?, ?)',
      [usuarioId, 'crear', 'insumos', id, JSON.stringify(data)]
    );

    saveDb();
    return id;
  }

  /* ── Actualizar ───────────────────────────────────────────────────────── */
  async update(id, data, usuarioId) {
    const db = await getDb();
    const existing = await this.getById(id);
    if (!existing) throw new Error('Insumo no encontrado');

    // Si intenta desactivar (cambiar de 1 a 0), validar que no esté asociado a recetas de productos activos
    if (data.activo !== undefined && Number(data.activo) === 0 && existing.activo === 1) {
      const recetaStmt = db.prepare('SELECT COUNT(*) as total FROM recetas r JOIN productos p ON r.id_producto = p.id WHERE r.id_insumo = ? AND p.activo = 1');
      recetaStmt.bind([id]);
      recetaStmt.step();
      const { total } = recetaStmt.getAsObject();
      recetaStmt.free();

      if (total > 0) {
        throw new Error(`No se puede desactivar: el insumo está asociado a ${total} receta(s) de productos activos.`);
      }
    }

    this._validate(data);

    // Verificar nombre duplicado excluyendo el actual
    const checkStmt = db.prepare('SELECT id FROM insumos WHERE nombre = ? AND id != ?');
    checkStmt.bind([data.nombre.trim(), id]);
    if (checkStmt.step()) {
      checkStmt.free();
      throw new Error(`Ya existe otro insumo con el nombre "${data.nombre}"`);
    }
    checkStmt.free();

    const newStock = data.stock_actual ?? existing.stock_actual;
    const oldStock = parseFloat(existing.stock_actual);
    const delta = Math.round((parseFloat(newStock) - oldStock) * 10000) / 10000;

    db.run(
      `UPDATE insumos SET nombre = ?, unidad_medida = ?, costo_unitario = ?, stock_actual = ?,
       stock_minimo = ?, stock_maximo = ?, activo = ?, updated_at = datetime('now') WHERE id = ?`,
      [
        data.nombre.trim(), data.unidad_medida.trim(),
        data.costo_unitario ?? existing.costo_unitario,
        newStock,
        data.stock_minimo ?? existing.stock_minimo,
        data.stock_maximo ?? existing.stock_maximo,
        data.activo !== undefined ? data.activo : existing.activo,
        id
      ]
    );

    // Si el stock cambió, registrar movimiento de tipo 'ajuste'
    if (delta !== 0) {
      db.run(
        `INSERT INTO movimientos_insumos (id_insumo, id_usuario, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, referencia)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, usuarioId, 'ajuste', delta, oldStock, parseFloat(newStock), 'Ajuste manual de stock desde edición de insumo']
      );
    }

    // Auditoría
    db.run(
      'INSERT INTO auditoria_operaciones (id_usuario, accion, modulo, registro_afectado, datos_anteriores, datos_nuevos) VALUES (?, ?, ?, ?, ?, ?)',
      [usuarioId, 'editar', 'insumos', id, JSON.stringify(existing), JSON.stringify(data)]
    );

    saveDb();
    return true;
  }

  /* ── Eliminar (baja lógica) ───────────────────────────────────────────── */
  async delete(id, usuarioId) {
    const db = await getDb();
    const existing = await this.getById(id);
    if (!existing) throw new Error('Insumo no encontrado');

    // Verificar si está asociado a recetas activas
    const recetaStmt = db.prepare('SELECT COUNT(*) as total FROM recetas r JOIN productos p ON r.id_producto = p.id WHERE r.id_insumo = ? AND p.activo = 1');
    recetaStmt.bind([id]);
    recetaStmt.step();
    const { total } = recetaStmt.getAsObject();
    recetaStmt.free();

    if (total > 0) {
      throw new Error(`No se puede eliminar: el insumo está asociado a ${total} receta(s) activa(s). Puede desactivarlo en su lugar.`);
    }

    db.run("UPDATE insumos SET activo = 0, updated_at = datetime('now') WHERE id = ?", [id]);

    // Auditoría
    db.run(
      'INSERT INTO auditoria_operaciones (id_usuario, accion, modulo, registro_afectado, datos_anteriores) VALUES (?, ?, ?, ?, ?)',
      [usuarioId, 'eliminar', 'insumos', id, JSON.stringify(existing)]
    );

    saveDb();
    return true;
  }

  /* ── Obtener insumos activos (para selects) ───────────────────────────── */
  async getActivos() {
    const db = await getDb();
    const stmt = db.prepare('SELECT id, nombre, unidad_medida, stock_actual, stock_minimo, stock_maximo, costo_unitario FROM insumos WHERE activo = 1 ORDER BY nombre ASC');
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  /* ── Movimientos de un insumo ─────────────────────────────────────────── */
  async getMovimientos(insumoId, limit = 50) {
    const db = await getDb();
    const stmt = db.prepare(`
      SELECT mi.*, i.nombre as insumo_nombre, u.username
      FROM movimientos_insumos mi
      JOIN insumos i ON mi.id_insumo = i.id
      LEFT JOIN usuarios u ON mi.id_usuario = u.id
      WHERE mi.id_insumo = ?
      ORDER BY mi.created_at DESC LIMIT ?
    `);
    stmt.bind([insumoId, limit]);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  /* ── Registrar movimiento de insumo ───────────────────────────────────── */
  registerMovimiento(db, { id_insumo, tipo_movimiento, cantidad, referencia, id_usuario }) {
    const stmt = db.prepare('SELECT stock_actual FROM insumos WHERE id = ?');
    stmt.bind([id_insumo]);
    if (!stmt.step()) { stmt.free(); throw new Error(`Insumo ${id_insumo} no encontrado`); }
    const stock_anterior = stmt.getAsObject().stock_actual;
    stmt.free();

    // Factor: compra y reverso suman, consumo_produccion y merma restan
    let factor = 1;
    if (['consumo_produccion', 'merma'].includes(tipo_movimiento)) {
      factor = -1;
    } else if (['ajuste', 'correccion'].includes(tipo_movimiento)) {
      factor = cantidad >= 0 ? 1 : -1;
    }

    const cantidadNeta = Math.abs(cantidad) * factor;
    const stock_nuevo = Math.round((stock_anterior + cantidadNeta) * 10000) / 10000; // 4 decimals precision

    if (stock_nuevo < 0 && !['ajuste', 'merma'].includes(tipo_movimiento)) {
      throw new Error(`Stock insuficiente para insumo ${id_insumo}. Disponible: ${stock_anterior}, Requerido: ${Math.abs(cantidadNeta)}`);
    }

    // Actualizar stock
    db.run("UPDATE insumos SET stock_actual = ?, updated_at = datetime('now') WHERE id = ?", [Math.max(0, stock_nuevo), id_insumo]);

    // Registrar movimiento
    db.run(
      `INSERT INTO movimientos_insumos (id_insumo, id_usuario, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, referencia)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id_insumo, id_usuario, tipo_movimiento, cantidadNeta, stock_anterior, Math.max(0, stock_nuevo), referencia || '']
    );

    return { stock_nuevo: Math.max(0, stock_nuevo) };
  }

  /* ── Validaciones ─────────────────────────────────────────────────────── */
  _validate(data) {
    if (!data.nombre || !data.nombre.trim()) throw new Error('El nombre es obligatorio');
    if (!data.unidad_medida || !data.unidad_medida.trim()) throw new Error('La unidad de medida es obligatoria');

    const costoUnitario = parseFloat(data.costo_unitario);
    if (data.costo_unitario !== undefined && (isNaN(costoUnitario) || costoUnitario < 0)) {
      throw new Error('El costo unitario no puede ser negativo');
    }

    const stockActual = parseFloat(data.stock_actual);
    if (data.stock_actual !== undefined && (isNaN(stockActual) || stockActual < 0)) {
      throw new Error('El stock actual no puede ser negativo');
    }

    const stockMinimo = parseFloat(data.stock_minimo);
    if (data.stock_minimo !== undefined && (isNaN(stockMinimo) || stockMinimo < 0)) {
      throw new Error('El stock mínimo no puede ser negativo');
    }

    const stockMaximo = parseFloat(data.stock_maximo);
    if (data.stock_maximo !== undefined && (isNaN(stockMaximo) || stockMaximo <= 0)) {
      throw new Error('El stock máximo debe ser mayor que cero');
    }

    if (data.stock_minimo !== undefined && data.stock_maximo !== undefined) {
      if (stockMinimo >= stockMaximo) {
        throw new Error('El stock mínimo debe ser menor que el stock máximo');
      }
    }
  }
}

export default new InsumoService();
