import { getDb, saveDb } from '../config/database.js';
import { registrarAuditoria } from '../utils/auditoria.js';

export const productoService = {
  async getAll(params = {}) {
    const db = await getDb();
    const { page = 1, limit = 10, search = '', categoria = 'all', tipo = 'all' } = params;
    const offset = (page - 1) * limit;

    let query = `
      SELECT p.*, c.nombre as categoria_nombre 
      FROM productos p 
      JOIN categorias c ON p.id_categoria = c.id 
      WHERE 1=1
    `;
    const values = [];

    if (search) {
      query += " AND p.nombre LIKE ?";
      values.push(`%${search}%`);
    }

    if (categoria !== 'all') {
      query += " AND p.id_categoria = ?";
      values.push(categoria);
    }

    if (tipo !== 'all') {
      query += " AND p.tipo = ?";
      values.push(tipo);
    }

    if (params.activo !== undefined) {
      query += " AND p.activo = ?";
      values.push(params.activo);
    }

    // Count total
    const countQuery = `SELECT COUNT(*) FROM productos p WHERE 1=1 ${search ? 'AND p.nombre LIKE ?' : ''} ${categoria !== 'all' ? 'AND p.id_categoria = ?' : ''} ${tipo !== 'all' ? 'AND p.tipo = ?' : ''} ${params.activo !== undefined ? 'AND p.activo = ?' : ''}`;
    const countValues = [];
    if (search) countValues.push(`%${search}%`);
    if (categoria !== 'all') countValues.push(categoria);
    if (tipo !== 'all') countValues.push(tipo);
    if (params.activo !== undefined) countValues.push(params.activo);
    
    const countRes = db.exec(countQuery, countValues);
    const total = countRes[0]?.values[0][0] || 0;

    query += " ORDER BY p.nombre ASC LIMIT ? OFFSET ?";
    values.push(limit, offset);

    const res = db.exec(query, values);
    if (!res[0]) return { data: [], total, page, limit };

    const columns = res[0].columns;
    const data = res[0].values.map(row => 
      columns.reduce((obj, col, i) => ({ ...obj, [col]: row[i] }), {})
    );

    return { data, total, page, limit };
  },

  async getById(id) {
    const db = await getDb();
    const res = db.exec(`
      SELECT p.*, c.nombre as categoria_nombre 
      FROM productos p 
      JOIN categorias c ON p.id_categoria = c.id 
      WHERE p.id = ?
    `, [id]);
    if (!res[0]) return null;
    const columns = res[0].columns;
    return columns.reduce((obj, col, i) => ({ ...obj, [col]: res[0].values[0][i] }), {});
  },

  async create(data, userId) {
    const db = await getDb();
    const { nombre, id_categoria, tipo = 'Producto de línea', unidad_medida, costo, precio, es_estrella } = data;

    // Check duplicate name
    const existing = db.exec("SELECT id FROM productos WHERE nombre = ? AND activo = 1", [nombre]);
    if (existing[0]) throw new Error('Ya existe un producto con ese nombre');

    db.run(`INSERT INTO productos (nombre, id_categoria, tipo, unidad_medida, costo, precio, es_estrella, activo) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)`, 
            [nombre, id_categoria, tipo, unidad_medida || 'pieza', costo, precio, es_estrella || 0]);
    
    const newId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
    
    // Audit & Save
    await registrarAuditoria({
      id_usuario: userId,
      accion: 'CREAR',
      modulo: 'PRODUCTOS',
      registro_afectado: newId,
      datos_nuevos: data
    });
    
    saveDb();
    return this.getById(newId);
  },

  async update(id, data, userId) {
    const db = await getDb();
    const oldData = await this.getById(id);
    if (!oldData) throw new Error('Producto no encontrado');

    const { nombre, id_categoria, tipo = 'Producto de línea', unidad_medida, costo, precio, es_estrella, activo } = data;

    // Check duplicate name
    const existing = db.exec("SELECT id FROM productos WHERE nombre = ? AND id != ? AND activo = 1", [nombre, id]);
    if (existing[0]) throw new Error('Ya existe otro producto con ese nombre');

    db.run(`UPDATE productos SET 
            nombre = ?, id_categoria = ?, tipo = ?, unidad_medida = ?, costo = ?, 
            precio = ?, es_estrella = ?, activo = ?, updated_at = datetime('now') 
            WHERE id = ?`, 
            [nombre, id_categoria, tipo, unidad_medida, costo, precio, es_estrella, activo, id]);

    // Audit & Save
    await registrarAuditoria({
      id_usuario: userId,
      accion: 'ACTUALIZAR',
      modulo: 'PRODUCTOS',
      registro_afectado: id,
      datos_anteriores: oldData,
      datos_nuevos: data
    });

    await saveDb();
    return this.getById(id);
  },

  async delete(id, userId) {
    const db = await getDb();
    const oldData = await this.getById(id);
    if (!oldData) throw new Error('Producto no encontrado');

    // Soft delete
    db.run("UPDATE productos SET activo = 0, updated_at = datetime('now') WHERE id = ?", [id]);

    // Audit & Save
    await registrarAuditoria({
      id_usuario: userId,
      accion: 'DESACTIVAR',
      modulo: 'PRODUCTOS',
      registro_afectado: id,
      datos_anteriores: oldData
    });

    saveDb();
    return { success: true };
  },

  async getCategorias() {
    const db = await getDb();
    const res = db.exec("SELECT * FROM categorias WHERE activo = 1");
    if (!res[0]) return [];
    const columns = res[0].columns;
    return res[0].values.map(row => 
      columns.reduce((obj, col, i) => ({ ...obj, [col]: row[i] }), {})
    );
  },

  async getActive() {
    const db = await getDb();
    const res = db.exec(`
      SELECT p.id, p.nombre, p.tipo, c.nombre as categoria_nombre, p.unidad_medida, p.activo
      FROM productos p
      JOIN categorias c ON p.id_categoria = c.id
      WHERE p.activo = 1
      ORDER BY p.nombre ASC
    `);
    if (!res[0]) return [];
    const columns = res[0].columns;
    return res[0].values.map(row => 
      columns.reduce((obj, col, i) => ({ ...obj, [col]: row[i] }), {})
    );
  }
};
