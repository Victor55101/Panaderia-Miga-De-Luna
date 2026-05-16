import { getDb, saveDb } from '../config/database.js';
import { registrarAuditoria } from '../utils/auditoria.js';

export const productoEstrellaService = {
  async getByProductoId(id_producto) {
    const db = await getDb();
    const res = db.exec(`
      SELECT ep.*, u.username 
      FROM especificaciones_producto ep
      LEFT JOIN usuarios u ON ep.id_usuario = u.id
      WHERE ep.id_producto = ? AND ep.vigente = 1
      ORDER BY ep.version DESC LIMIT 1
    `, [id_producto]);
    if (!res[0]) return null;
    const columns = res[0].columns;
    return columns.reduce((obj, col, i) => ({ ...obj, [col]: res[0].values[0][i] }), {});
  },

  async getHistory(id_producto) {
    const db = await getDb();
    const res = db.exec(`
      SELECT ep.*, u.username 
      FROM especificaciones_producto ep
      LEFT JOIN usuarios u ON ep.id_usuario = u.id
      WHERE ep.id_producto = ? 
      ORDER BY ep.version DESC
    `, [id_producto]);
    if (!res[0]) return [];
    const columns = res[0].columns;
    return res[0].values.map(row => 
      columns.reduce((obj, col, i) => ({ ...obj, [col]: row[i] }), {})
    );
  },

  async updateSpecification(id_producto, data, userId) {
    const db = await getDb();
    
    // 1. Validate if product is star
    const product = db.exec("SELECT es_estrella FROM productos WHERE id = ?", [id_producto]);
    if (!product[0] || product[0].values[0][0] !== 1) {
      throw new Error('Solo se pueden registrar especificaciones para productos marcados como Estrella');
    }

    // 2. Auto-calculate next version
    const lastSpec = await this.getByProductoId(id_producto);
    let nextVersion = '1.0';
    if (lastSpec && lastSpec.version) {
      const parts = lastSpec.version.split('.');
      if (parts.length === 2 && !isNaN(parts[1])) {
        nextVersion = `${parts[0]}.${parseInt(parts[1]) + 1}`;
      } else {
        nextVersion = lastSpec.version + '.1';
      }
    }

    // 3. Deactivate current version
    db.run("UPDATE especificaciones_producto SET vigente = 0 WHERE id_producto = ?", [id_producto]);
    
    const { 
      receta_base, ingredientes, gramaje_aprox, 
      tiempo_horneado_min, temperatura_c, 
      instrucciones_presentacion 
    } = data;

    db.run(`INSERT INTO especificaciones_producto 
            (id_producto, receta_base, ingredientes, gramaje_aprox, tiempo_horneado_min, temperatura_c, instrucciones_presentacion, version, id_usuario, vigente) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`, 
            [id_producto, receta_base, ingredientes, gramaje_aprox, tiempo_horneado_min, temperatura_c, instrucciones_presentacion, nextVersion, userId]);
    
    const newId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];

    // 4. Audit & Save
    await registrarAuditoria({
      id_usuario: userId,
      accion: 'ACTUALIZAR_RECETA',
      modulo: 'ESPECIFICACIONES_PRODUCTO',
      registro_afectado: newId,
      datos_nuevos: { ...data, version: nextVersion }
    });
    saveDb();
    return { success: true, id: newId, version: nextVersion };
  }
};
