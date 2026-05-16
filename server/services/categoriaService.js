import { getDb, saveDb } from '../config/database.js';
import { registrarAuditoria } from '../utils/auditoria.js';

export const categoriaService = {
  async getAll() {
    const db = await getDb();
    const res = db.exec("SELECT * FROM categorias WHERE activo = 1 ORDER BY nombre ASC");
    if (!res || res.length === 0) return [];
    
    return res[0].values.map(row => ({
      id: row[0],
      nombre: row[1],
      descripcion: row[2],
      activo: row[3]
    }));
  },

  async create(data, user) {
    const db = await getDb();
    const { nombre, descripcion } = data;
    
    // Validar duplicados
    const existRes = db.exec("SELECT id FROM categorias WHERE nombre = ?", [nombre]);
    if (existRes.length > 0 && existRes[0].values.length > 0) {
      throw new Error('Ya existe una categoría con ese nombre');
    }

    db.run("INSERT INTO categorias (nombre, descripcion, activo) VALUES (?, ?, 1)", [nombre, descripcion]);
    const idRes = db.exec("SELECT last_insert_rowid()");
    const id = idRes[0].values[0][0];

    await registrarAuditoria({
      id_usuario: user.id,
      accion: 'CREAR',
      modulo: 'CATEGORIAS',
      registro_afectado: id,
      datos_nuevos: { nombre, descripcion }
    });

    saveDb();
    return { id, nombre, descripcion };
  },

  async update(id, data, user) {
    const db = await getDb();
    const oldDataRes = db.exec("SELECT nombre, descripcion, activo FROM categorias WHERE id = ?", [id]);
    const oldData = oldDataRes[0]?.values[0] ? { nombre: oldDataRes[0].values[0][0], descripcion: oldDataRes[0].values[0][1], activo: oldDataRes[0].values[0][2] } : null;

    const { nombre, descripcion, activo } = data;
    
    db.run("UPDATE categorias SET nombre = ?, descripcion = ?, activo = ? WHERE id = ?", [nombre, descripcion, activo, id]);

    await registrarAuditoria({
      id_usuario: user.id,
      accion: 'ACTUALIZAR',
      modulo: 'CATEGORIAS',
      registro_afectado: id,
      datos_anteriores: oldData,
      datos_nuevos: { nombre, descripcion, activo }
    });

    saveDb();
    return { id, nombre, descripcion, activo };
  },

  async delete(id, user) {
    const db = await getDb();
    // Verificar si hay productos asociados
    const countRes = db.exec("SELECT COUNT(*) FROM productos WHERE id_categoria = ? AND activo = 1", [id]);
    const count = countRes[0].values[0][0];
    
    if (count > 0) {
      throw new Error(`No se puede eliminar la categoría. Tiene ${count} productos activos asociados.`);
    }

    db.run("UPDATE categorias SET activo = 0 WHERE id = ?", [id]);

    await registrarAuditoria({
      id_usuario: user.id,
      accion: 'DESACTIVAR',
      modulo: 'CATEGORIAS',
      registro_afectado: id
    });

    saveDb();
    return { success: true };
  }
};
