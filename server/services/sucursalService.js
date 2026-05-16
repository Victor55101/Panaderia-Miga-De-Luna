import { getDb, saveDb } from '../config/database.js';
import { registrarAuditoria } from '../utils/auditoria.js';

export const sucursalService = {
  async getAll(params = {}) {
    const db = await getDb();
    const { page = 1, limit = 10, search = '', tipo = 'all' } = params;
    const offset = (page - 1) * limit;

    let query = "SELECT * FROM sucursales WHERE 1=1";
    const values = [];

    if (search) {
      query += " AND (nombre LIKE ? OR direccion LIKE ?)";
      values.push(`%${search}%`, `%${search}%`);
    }

    if (tipo !== 'all') {
      query += " AND tipo = ?";
      values.push(tipo);
    }

    // Count total for pagination
    const countRes = db.exec(query.replace("SELECT *", "SELECT COUNT(*)"), values);
    const total = countRes[0]?.values[0][0] || 0;

    query += " ORDER BY id ASC LIMIT ? OFFSET ?";
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
    const res = db.exec("SELECT * FROM sucursales WHERE id = ?", [id]);
    if (!res[0]) return null;
    const columns = db.exec("PRAGMA table_info(sucursales)")[0].values.map(v => v[1]);
    return columns.reduce((obj, col, i) => ({ ...obj, [col]: res[0].values[0][i] }), {});
  },

  async create(data, userId) {
    const db = await getDb();
    const { nombre, tipo, direccion, telefono, distancia_planta_km, capacidad_operativa, fecha_apertura } = data;
    
    // Check duplicate name
    const existing = db.exec("SELECT id FROM sucursales WHERE nombre = ? AND activo = 1", [nombre]);
    if (existing[0]) throw new Error('Ya existe una sucursal con ese nombre');

    db.run(`INSERT INTO sucursales (nombre, tipo, direccion, telefono, distancia_planta_km, capacidad_operativa, fecha_apertura, activo) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)`, 
            [nombre, tipo, direccion, telefono, distancia_planta_km || 0, capacidad_operativa || 0, fecha_apertura]);
    
    const newId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
    
    // Audit & Save
    await registrarAuditoria({
      id_usuario: userId,
      accion: 'CREAR',
      modulo: 'SUCURSALES',
      registro_afectado: newId,
      datos_nuevos: data
    });
    saveDb();
    
    return this.getById(newId);
  },

  async update(id, data, userId) {
    const db = await getDb();
    const oldData = await this.getById(id);
    if (!oldData) throw new Error('Sucursal no encontrada');

    const { nombre, tipo, direccion, telefono, distancia_planta_km, capacidad_operativa, fecha_apertura, activo } = data;

    // Check duplicate name (excluding current ID)
    const existing = db.exec("SELECT id FROM sucursales WHERE nombre = ? AND id != ? AND activo = 1", [nombre, id]);
    if (existing[0]) throw new Error('Ya existe otra sucursal con ese nombre');

    db.run(`UPDATE sucursales SET 
            nombre = ?, tipo = ?, direccion = ?, telefono = ?, 
            distancia_planta_km = ?, capacidad_operativa = ?, 
            fecha_apertura = ?, activo = ?, updated_at = datetime('now') 
            WHERE id = ?`, 
            [nombre, tipo, direccion, telefono, distancia_planta_km, capacidad_operativa, fecha_apertura, activo, id]);

    // Audit & Save
    await registrarAuditoria({
      id_usuario: userId,
      accion: 'ACTUALIZAR',
      modulo: 'SUCURSALES',
      registro_afectado: id,
      datos_anteriores: oldData,
      datos_nuevos: data
    });
    saveDb();

    return this.getById(id);
  },

  async delete(id, userId) {
    const db = await getDb();
    const oldData = await this.getById(id);
    if (!oldData) throw new Error('Sucursal no encontrada');

    // 1. Check for active dependencies
    const hasEmployees = db.exec("SELECT id FROM empleados WHERE id_sucursal = ? AND estatus = 'activo' LIMIT 1", [id])[0];
    const hasSales = db.exec("SELECT id FROM ventas WHERE id_sucursal = ? LIMIT 1", [id])[0];
    const hasStock = db.exec("SELECT id_sucursal FROM inventarios WHERE id_sucursal = ? AND existencia > 0 LIMIT 1", [id])[0];

    let warning = null;
    if (hasEmployees || hasSales || hasStock) {
      warning = 'Esta sucursal tiene registros activos (empleados, ventas o inventario). Al desactivarla, no podrá realizar nuevas operaciones, pero los datos históricos se mantendrán.';
    }

    // Soft delete
    db.run("UPDATE sucursales SET activo = 0, updated_at = datetime('now') WHERE id = ?", [id]);

    // Audit & Save
    await registrarAuditoria({
      id_usuario: userId,
      accion: 'DESACTIVAR',
      modulo: 'SUCURSALES',
      registro_afectado: id,
      datos_anteriores: oldData
    });
    saveDb();
    return { success: true, warning };
  },

  async getSelect(userId, role, sucursalId) {
    const db = await getDb();
    let query = "SELECT id, nombre, tipo FROM sucursales WHERE activo = 1";
    const values = [];

    // RBAC: Restricted roles only see their own branch
    if (['gerente_sucursal', 'vendedor', 'repartidor', 'jefe_produccion'].includes(role)) {
      if (!sucursalId) return []; // Should not happen if data is consistent
      query += " AND id = ?";
      values.push(sucursalId);
    }

    query += " ORDER BY nombre ASC";
    const res = db.exec(query, values);
    if (!res[0]) return [];

    const columns = res[0].columns;
    return res[0].values.map(row => 
      columns.reduce((obj, col, i) => ({ ...obj, [col]: row[i] }), {})
    );
  }
};
