import { getDb, saveDb } from '../config/database.js';
import { registrarAuditoria } from '../utils/auditoria.js';

export const empleadoService = {
  async getAll({ 
    search = '', 
    id_sucursal = 'all', 
    id_puesto = 'all', 
    id_departamento = 'all', 
    estatus = 'all',
    page = 1,
    limit = 10
  }) {
    const db = await getDb();
    const offset = (page - 1) * limit;

    let query = `
      FROM empleados e
      LEFT JOIN sucursales s ON e.id_sucursal = s.id
      LEFT JOIN puestos p ON e.id_puesto = p.id
      LEFT JOIN departamentos d ON p.id_departamento = d.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (e.nombre LIKE ? OR e.apellido_paterno LIKE ? OR e.rfc LIKE ? OR e.telefono LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam, searchParam);
    }

    if (id_sucursal !== 'all') {
      query += ` AND e.id_sucursal = ?`;
      params.push(id_sucursal);
    }

    if (id_puesto !== 'all') {
      query += ` AND e.id_puesto = ?`;
      params.push(id_puesto);
    }

    if (id_departamento !== 'all') {
      query += ` AND p.id_departamento = ?`;
      params.push(id_departamento);
    }

    if (estatus !== 'all') {
      query += ` AND e.estatus = ?`;
      params.push(estatus);
    }

    // Count total for pagination
    const countRes = db.exec(`SELECT COUNT(*) ${query}`, params);
    const total = countRes[0].values[0][0];

    // Get page items
    const dataQuery = `
      SELECT e.*, s.nombre as sucursal_nombre, p.nombre as puesto_nombre, d.nombre as departamento_nombre
      ${query}
      ORDER BY e.nombre ASC, e.apellido_paterno ASC
      LIMIT ? OFFSET ?
    `;
    const dataParams = [...params, limit, offset];

    const stmt = db.prepare(dataQuery);
    stmt.bind(dataParams);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();

    return {
      data: results,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  async getById(id) {
    const db = await getDb();
    const stmt = db.prepare(`
      SELECT e.*, s.nombre as sucursal_nombre, p.nombre as puesto_nombre, d.nombre as departamento_nombre
      FROM empleados e
      LEFT JOIN sucursales s ON e.id_sucursal = s.id
      LEFT JOIN puestos p ON e.id_puesto = p.id
      LEFT JOIN departamentos d ON p.id_departamento = d.id
      WHERE e.id = ?
    `);
    stmt.bind([id]);
    const res = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return res;
  },

  async create(data, userId) {
    const db = await getDb();
    
    // Validations
    if (data.rfc) {
      const existingRfc = db.exec("SELECT id FROM empleados WHERE rfc = ?", [data.rfc]);
      if (existingRfc[0]) throw new Error('Ya existe un empleado con este RFC');
    }

    const { 
      nombre, apellido_paterno, apellido_materno, rfc, telefono, 
      email, id_sucursal, id_puesto, fecha_contratacion, 
      salario_base, tipo_personal 
    } = data;

    db.run(`
      INSERT INTO empleados (
        nombre, apellido_paterno, apellido_materno, rfc, telefono, 
        email, id_sucursal, id_puesto, fecha_contratacion, 
        salario_base, tipo_personal, estatus
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'activo')
    `, [
      nombre, apellido_paterno, apellido_materno, rfc, telefono, 
      email, id_sucursal || null, id_puesto, fecha_contratacion, 
      salario_base || 0, tipo_personal
    ]);

    const newId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];

    await registrarAuditoria({
      id_usuario: userId,
      accion: 'CREAR',
      modulo: 'EMPLEADOS',
      registro_afectado: newId,
      datos_nuevos: data
    });

    saveDb();
    return this.getById(newId);
  },

  async update(id, data, userId) {
    const db = await getDb();
    const oldData = await this.getById(id);
    if (!oldData) throw new Error('Empleado no encontrado');

    if (data.rfc && data.rfc !== oldData.rfc) {
      const existingRfc = db.exec("SELECT id FROM empleados WHERE rfc = ? AND id != ?", [data.rfc, id]);
      if (existingRfc[0]) throw new Error('Ese RFC ya está asignado a otro empleado');
    }

    const { 
      nombre, apellido_paterno, apellido_materno, rfc, telefono, 
      email, id_sucursal, id_puesto, fecha_contratacion, 
      salario_base, tipo_personal, estatus 
    } = data;

    db.run(`
      UPDATE empleados SET 
        nombre = ?, apellido_paterno = ?, apellido_materno = ?, rfc = ?, 
        telefono = ?, email = ?, id_sucursal = ?, id_puesto = ?, 
        fecha_contratacion = ?, salario_base = ?, tipo_personal = ?, 
        estatus = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [
      nombre, apellido_paterno, apellido_materno, rfc, 
      telefono, email, id_sucursal || null, id_puesto, 
      fecha_contratacion, salario_base || 0, tipo_personal, 
      estatus, id
    ]);

    await registrarAuditoria({
      id_usuario: userId,
      accion: 'ACTUALIZAR',
      modulo: 'EMPLEADOS',
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
    if (!oldData) throw new Error('Empleado no encontrado');

    // Soft delete / Deactivation
    db.run("UPDATE empleados SET estatus = 'baja', updated_at = datetime('now') WHERE id = ?", [id]);

    await registrarAuditoria({
      id_usuario: userId,
      accion: 'DESACTIVAR',
      modulo: 'EMPLEADOS',
      registro_afectado: id,
      datos_anteriores: oldData
    });

    saveDb();
    return { success: true };
  },

  async getPuestos() {
    const db = await getDb();
    const res = db.exec("SELECT p.*, d.nombre as departamento_nombre FROM puestos p LEFT JOIN departamentos d ON p.id_departamento = d.id WHERE p.activo = 1");
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map(row => cols.reduce((obj, col, i) => ({ ...obj, [col]: row[i] }), {}));
  },

  async getDepartamentos() {
    const db = await getDb();
    const res = db.exec("SELECT * FROM departamentos WHERE activo = 1");
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map(row => cols.reduce((obj, col, i) => ({ ...obj, [col]: row[i] }), {}));
  },

  async getRepartidores() {
    const db = await getDb();
    const query = `
      SELECT e.*, s.nombre as sucursal_nombre, p.nombre as puesto_nombre 
      FROM empleados e 
      LEFT JOIN sucursales s ON e.id_sucursal = s.id
      LEFT JOIN puestos p ON e.id_puesto = p.id
      WHERE e.tipo_personal = 'distribucion' AND e.estatus = 'activo'
    `;
    const stmt = db.prepare(query);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return { data: results };
  }
};
