import { getDb, saveDb } from '../config/database.js';

/**
 * Servicio de Recetas (Relación Producto - Insumo)
 */
class RecetaService {

  /* ── Obtener receta de un producto ─────────────────────────────────────── */
  async getByProducto(id_producto) {
    const db = await getDb();
    
    // Verificar si el producto existe
    const prodStmt = db.prepare('SELECT nombre, activo FROM productos WHERE id = ?');
    prodStmt.bind([id_producto]);
    if (!prodStmt.step()) {
      prodStmt.free();
      return null;
    }
    const producto = prodStmt.getAsObject();
    prodStmt.free();

    // Obtener insumos de la receta
    const stmt = db.prepare(`
      SELECT r.id, r.id_producto, r.id_insumo, r.cantidad_requerida, r.unidad,
             i.nombre as insumo_nombre, i.unidad_medida as insumo_unidad_medida
      FROM recetas r
      JOIN insumos i ON r.id_insumo = i.id
      WHERE r.id_producto = ?
      ORDER BY i.nombre ASC
    `);
    stmt.bind([id_producto]);
    const ingredientes = [];
    while (stmt.step()) {
      ingredientes.push(stmt.getAsObject());
    }
    stmt.free();

    return {
      id_producto,
      producto_nombre: producto.nombre,
      producto_activo: producto.activo,
      ingredientes
    };
  }

  /* ── Guardar/Reemplazar receta de forma atómica ────────────────────────── */
  async saveForProducto(id_producto, ingredientes, usuarioId) {
    if (!id_producto) throw new Error('El ID del producto es obligatorio');
    if (!Array.isArray(ingredientes)) throw new Error('Los ingredientes deben ser un arreglo');

    const db = await getDb();

    // 1. Validar que el producto exista y esté activo
    const prodStmt = db.prepare('SELECT nombre, activo FROM productos WHERE id = ?');
    prodStmt.bind([id_producto]);
    if (!prodStmt.step()) {
      prodStmt.free();
      throw new Error(`El producto con ID ${id_producto} no existe`);
    }
    const producto = prodStmt.getAsObject();
    prodStmt.free();

    if (producto.activo !== 1) {
      throw new Error(`El producto "${producto.nombre}" está inactivo y no puede tener recetas`);
    }

    // 2. Validar ingredientes
    const insumosVistos = new Set();
    const ingredientesValidados = [];

    for (const item of ingredientes) {
      const { id_insumo, cantidad_requerida } = item;
      
      if (!id_insumo) throw new Error('El ID del insumo es obligatorio en cada ingrediente');
      
      const cantidad = parseFloat(cantidad_requerida);
      if (isNaN(cantidad) || cantidad <= 0) {
        throw new Error('La cantidad requerida debe ser un número mayor a cero');
      }

      if (insumosVistos.has(id_insumo)) {
        throw new Error(`El insumo con ID ${id_insumo} está duplicado en la receta`);
      }
      insumosVistos.add(id_insumo);

      // Verificar que el insumo existe y está activo
      const insStmt = db.prepare('SELECT nombre, unidad_medida, activo FROM insumos WHERE id = ?');
      insStmt.bind([id_insumo]);
      if (!insStmt.step()) {
        insStmt.free();
        throw new Error(`El insumo con ID ${id_insumo} no existe`);
      }
      const insumo = insStmt.getAsObject();
      insStmt.free();

      if (insumo.activo !== 1) {
        throw new Error(`El insumo "${insumo.nombre}" está inactivo y no se puede agregar a la receta`);
      }

      ingredientesValidados.push({
        id_insumo,
        cantidad_requerida: Math.round(cantidad * 10000) / 10000, // 4 decimales
        unidad: insumo.unidad_medida
      });
    }

    // 3. Obtener receta previa para auditoría
    const preStmt = db.prepare('SELECT id_insumo, cantidad_requerida FROM recetas WHERE id_producto = ?');
    preStmt.bind([id_producto]);
    const recetaPrevia = [];
    while (preStmt.step()) {
      recetaPrevia.push(preStmt.getAsObject());
    }
    preStmt.free();

    try {
      db.run('BEGIN TRANSACTION');

      // Borrar receta anterior
      db.run('DELETE FROM recetas WHERE id_producto = ?', [id_producto]);

      // Insertar nuevos ingredientes
      for (const item of ingredientesValidados) {
        db.run(
          `INSERT INTO recetas (id_producto, id_insumo, cantidad_requerida, unidad)
           VALUES (?, ?, ?, ?)`,
          [id_producto, item.id_insumo, item.cantidad_requerida, item.unidad]
        );
      }

      // Registrar en auditoría
      db.run(
        'INSERT INTO auditoria_operaciones (id_usuario, accion, modulo, registro_afectado, datos_anteriores, datos_nuevos) VALUES (?, ?, ?, ?, ?, ?)',
        [
          usuarioId,
          recetaPrevia.length > 0 ? 'editar' : 'crear',
          'recetas',
          id_producto,
          JSON.stringify(recetaPrevia),
          JSON.stringify(ingredientesValidados)
        ]
      );

      db.run('COMMIT');
      saveDb();
      return true;
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  }

  /* ── Eliminar receta de un producto ────────────────────────────────────── */
  async deleteByProducto(id_producto, usuarioId) {
    const db = await getDb();
    
    // Obtener receta previa para auditoría
    const preStmt = db.prepare('SELECT id_insumo, cantidad_requerida FROM recetas WHERE id_producto = ?');
    preStmt.bind([id_producto]);
    const recetaPrevia = [];
    while (preStmt.step()) {
      recetaPrevia.push(preStmt.getAsObject());
    }
    preStmt.free();

    if (recetaPrevia.length === 0) {
      throw new Error('No existe una receta registrada para este producto');
    }

    try {
      db.run('BEGIN TRANSACTION');

      db.run('DELETE FROM recetas WHERE id_producto = ?', [id_producto]);

      // Registrar auditoría
      db.run(
        'INSERT INTO auditoria_operaciones (id_usuario, accion, modulo, registro_afectado, datos_anteriores) VALUES (?, ?, ?, ?, ?)',
        [usuarioId, 'eliminar', 'recetas', id_producto, JSON.stringify(recetaPrevia)]
      );

      db.run('COMMIT');
      saveDb();
      return true;
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  }
  /* ── IDs de productos que tienen receta ─────────────────────────────── */
  async getProductIdsWithReceta() {
    const db = await getDb();
    const stmt = db.prepare('SELECT DISTINCT id_producto FROM recetas');
    const ids = [];
    while (stmt.step()) {
      ids.push(stmt.getAsObject().id_producto);
    }
    stmt.free();
    return ids;
  }
}

export default new RecetaService();
