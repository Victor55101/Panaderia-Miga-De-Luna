import { getDb, saveDb } from '../config/database.js';
import { registrarAuditoria } from '../utils/auditoria.js';

export const roleService = {
  async getAll() {
    const db = await getDb();
    const res = db.exec("SELECT * FROM roles WHERE activo = 1 ORDER BY id ASC");
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map(row => {
      const obj = cols.reduce((acc, col, i) => ({ ...acc, [col]: row[i] }), {});
      try {
        obj.permisos = JSON.parse(obj.permisos || '[]');
      } catch (e) {
        obj.permisos = [];
      }
      return obj;
    });
  },

  async getById(id) {
    const db = await getDb();
    const stmt = db.prepare("SELECT * FROM roles WHERE id = ?");
    stmt.bind([id]);
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    const obj = stmt.getAsObject();
    stmt.free();
    try {
      obj.permisos = JSON.parse(obj.permisos || '[]');
    } catch (e) {
      obj.permisos = [];
    }
    return obj;
  },

  async create(data, userId) {
    const db = await getDb();
    const { nombre, descripcion, permisos } = data;

    // Validate unique name
    const existing = db.exec("SELECT id FROM roles WHERE nombre = ?", [nombre]);
    if (existing[0]) throw new Error('Ya existe un rol con este identificador');

    const permisosJson = JSON.stringify(permisos || []);

    db.run(`
      INSERT INTO roles (nombre, descripcion, permisos, activo)
      VALUES (?, ?, ?, 1)
    `, [nombre, descripcion, permisosJson]);

    const newId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];

    await registrarAuditoria({
      id_usuario: userId,
      accion: 'CREAR',
      modulo: 'ROLES',
      registro_afectado: newId,
      datos_nuevos: data
    });

    saveDb();
    return this.getById(newId);
  },

  async update(id, data, userId) {
    const db = await getDb();
    const oldData = await this.getById(id);
    if (!oldData) throw new Error('Rol no encontrado');

    const { nombre, descripcion, permisos, activo } = data;

    const permisosJson = JSON.stringify(permisos || []);

    db.run(`
      UPDATE roles SET 
        nombre = ?, descripcion = ?, permisos = ?, activo = ?
      WHERE id = ?
    `, [nombre, descripcion, permisosJson, activo !== undefined ? activo : 1, id]);

    await registrarAuditoria({
      id_usuario: userId,
      accion: 'ACTUALIZAR',
      modulo: 'ROLES',
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
    if (!oldData) throw new Error('Rol no encontrado');

    // Soft delete
    db.run("UPDATE roles SET activo = 0 WHERE id = ?", [id]);

    await registrarAuditoria({
      id_usuario: userId,
      accion: 'DESACTIVAR',
      modulo: 'ROLES',
      registro_afectado: id,
      datos_anteriores: oldData
    });

    saveDb();
    return { success: true };
  }
};
