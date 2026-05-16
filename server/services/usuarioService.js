import bcrypt from 'bcryptjs';
import { getDb, saveDb } from '../config/database.js';
import { registrarAuditoria } from '../utils/auditoria.js';

export const usuarioService = {
  async getAll({ search = '', rol = 'all', estatus = 'all' }) {
    const db = await getDb();
    let query = `
      SELECT u.id, u.username, r.nombre as rol_nombre, u.activo, u.id_empleado, u.id_rol,
             e.nombre || ' ' || e.apellido_paterno as empleado_nombre,
             s.nombre as sucursal_nombre
      FROM usuarios u
      LEFT JOIN empleados e ON u.id_empleado = e.id
      LEFT JOIN roles r ON u.id_rol = r.id
      LEFT JOIN sucursales s ON e.id_sucursal = s.id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (u.username LIKE ? OR e.nombre LIKE ? OR e.apellido_paterno LIKE ?)`;
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    if (rol !== 'all') {
      query += ` AND u.id_rol = ?`;
      params.push(rol);
    }

    if (estatus !== 'all') {
      query += ` AND u.activo = ?`;
      params.push(estatus === 'activo' ? 1 : 0);
    }

    query += ` ORDER BY u.username ASC`;
    
    const stmt = db.prepare(query);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  async create(data, usuarioId) {
    const db = await getDb();
    
    // Check if username exists
    const existingRes = db.exec('SELECT id FROM usuarios WHERE username = ?', [data.username]);
    if (existingRes.length > 0 && existingRes[0].values.length > 0) {
      throw new Error('El nombre de usuario ya está en uso');
    }

    // Check if employee already has a user
    if (data.id_empleado) {
      const existingEmpRes = db.exec('SELECT id FROM usuarios WHERE id_empleado = ?', [data.id_empleado]);
      if (existingEmpRes.length > 0 && existingEmpRes[0].values.length > 0) {
        throw new Error('Este empleado ya tiene un usuario asignado');
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    db.run(`
      INSERT INTO usuarios (username, password_hash, id_rol, id_empleado, activo)
      VALUES (?, ?, ?, ?, 1)
    `, [data.username, passwordHash, data.id_rol, data.id_empleado]);

    const idRes = db.exec("SELECT last_insert_rowid()");
    const newId = idRes[0].values[0][0];

    await registrarAuditoria({
      id_usuario: usuarioId,
      accion: 'CREAR',
      modulo: 'USUARIOS',
      registro_afectado: `Usuario ID: ${newId} (${data.username})`,
      datos_nuevos: JSON.stringify({ username: data.username, id_rol: data.id_rol, id_empleado: data.id_empleado })
    });

    saveDb();
    return { id: newId, username: data.username, id_rol: data.id_rol };
  },

  async update(id, data, usuarioId) {
    const db = await getDb();
    
    const stmt = db.prepare('SELECT * FROM usuarios WHERE id = ?');
    stmt.bind([id]);
    if (!stmt.step()) {
      stmt.free();
      throw new Error('Usuario no encontrado');
    }
    const oldData = stmt.getAsObject();
    stmt.free();

    if (data.username && data.username !== oldData.username) {
      const existRes = db.exec('SELECT id FROM usuarios WHERE username = ? AND id != ?', [data.username, id]);
      if (existRes.length > 0 && existRes[0].values.length > 0) {
        throw new Error('El nombre de usuario ya está en uso');
      }
    }

    let query = 'UPDATE usuarios SET username = ?, id_rol = ?, id_empleado = ?, activo = ?';
    const params = [data.username, data.id_rol, data.id_empleado, data.activo];

    if (data.password) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(data.password, salt);
      query += ', password_hash = ?';
      params.push(passwordHash);
    }

    query += ' WHERE id = ?';
    params.push(id);

    db.run(query, params);

    await registrarAuditoria({
      id_usuario: usuarioId,
      accion: 'ACTUALIZAR',
      modulo: 'USUARIOS',
      registro_afectado: `Usuario ID: ${id}`,
      datos_anteriores: JSON.stringify({ username: oldData.username, id_rol: oldData.id_rol }),
      datos_nuevos: JSON.stringify({ username: data.username, id_rol: data.id_rol })
    });

    saveDb();
    return { id, username: data.username, id_rol: data.id_rol };
  },

  async delete(id, usuarioId) {
    const db = await getDb();
    
    const stmt = db.prepare('SELECT username, id_rol, activo FROM usuarios WHERE id = ?');
    stmt.bind([id]);
    if (!stmt.step()) {
      stmt.free();
      throw new Error('Usuario no encontrado');
    }
    const oldData = stmt.getAsObject();
    stmt.free();
    
    if (id === usuarioId) {
      throw new Error('No puedes desactivar tu propio usuario');
    }

    // Check if it's the last owner (rol id 1)
    if (oldData.id_rol === 1 && oldData.activo === 1) {
      const ownerRes = db.exec("SELECT COUNT(*) as count FROM usuarios WHERE id_rol = 1 AND activo = 1");
      const count = ownerRes[0].values[0][0];
      if (count <= 1) throw new Error('No se puede desactivar al único propietario activo');
    }

    db.run("UPDATE usuarios SET activo = 0, updated_at = datetime('now') WHERE id = ?", [id]);

    await registrarAuditoria({
      id_usuario: usuarioId,
      accion: 'DESACTIVAR',
      modulo: 'USUARIOS',
      registro_afectado: `Usuario ID: ${id} (${oldData.username})`
    });

    saveDb();
    return { id };
  },

  async getAvailableEmployees() {
    const db = await getDb();
    const query = `
      SELECT id, nombre, apellido_paterno 
      FROM empleados 
      WHERE id NOT IN (SELECT id_empleado FROM usuarios WHERE id_empleado IS NOT NULL)
      AND estatus = 'activo'
    `;
    const stmt = db.prepare(query);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  async getRoles() {
    const db = await getDb();
    const res = db.exec("SELECT id, nombre, descripcion FROM roles WHERE activo = 1");
    if (!res[0]) return [];
    return res[0].values.map(row => ({ id: row[0], nombre: row[1], descripcion: row[2] }));
  }
};
