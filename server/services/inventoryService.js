import { getDb, saveDb } from '../config/database.js';

/**
 * Servicio centralizado para gestión de inventarios y auditoría de movimientos
 */
export const inventoryService = {
  
  /**
   * Registra un movimiento de inventario y actualiza el stock actual
   */
  async registerMovement(db, { id_sucursal, id_producto, tipo_movimiento, cantidad, referencia, id_usuario }) {
    // 1. Obtener existencia actual
    const invStmt = db.prepare('SELECT existencia FROM inventarios WHERE id_sucursal = ? AND id_producto = ?');
    invStmt.bind([id_sucursal, id_producto]);
    
    let existencia_anterior = 0;
    if (invStmt.step()) {
      existencia_anterior = invStmt.getAsObject().existencia;
    } else {
      // Si no existe el registro de inventario, lo creamos
      const createStmt = db.prepare('INSERT INTO inventarios (id_sucursal, id_producto, existencia) VALUES (?, ?, 0)');
      createStmt.run([id_sucursal, id_producto]);
      createStmt.free();
    }
    invStmt.free();

    // 2. Calcular nueva existencia
    // Tipos que restan: venta, salida, traslado_salida, merma
    // Tipos que suman: entrada, traslado_entrada, produccion, ajuste (depende del signo)
    let factor = 1;
    if (['venta', 'salida', 'traslado_salida', 'merma'].includes(tipo_movimiento)) {
      factor = -1;
    } else if (['ajuste', 'correccion'].includes(tipo_movimiento)) {
      factor = parseInt(cantidad) >= 0 ? 1 : -1;
    }
    
    const cantidad_neta = Math.abs(cantidad) * factor;
    const existencia_nueva = existencia_anterior + cantidad_neta;

    if (existencia_nueva < 0 && !['ajuste', 'merma'].includes(tipo_movimiento)) {
      throw new Error(`Stock insuficiente para el producto ${id_producto} en la sucursal ${id_sucursal}`);
    }

    // 3. Actualizar tabla inventarios
    const updateStmt = db.prepare('UPDATE inventarios SET existencia = ?, updated_at = datetime("now") WHERE id_sucursal = ? AND id_producto = ?');
    updateStmt.run([existencia_nueva, id_sucursal, id_producto]);
    updateStmt.free();

    // 4. Registrar en movimientos_inventario para auditoría
    // Mapeo para cumplir con CHECK constraint de la DB
    const db_tipo = ['merma', 'correccion', 'ajuste'].includes(tipo_movimiento) ? 'ajuste' : tipo_movimiento;

    const logStmt = db.prepare(`
      INSERT INTO movimientos_inventario 
      (id_sucursal, id_producto, tipo_movimiento, cantidad, existencia_anterior, existencia_nueva, referencia, id_usuario)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    logStmt.run([id_sucursal, id_producto, db_tipo, cantidad_neta, existencia_anterior, existencia_nueva, referencia, id_usuario]);
    logStmt.free();

    return { existencia_nueva };
  },

  /**
   * Valida disponibilidad de stock para múltiples productos
   */
  async validateStock(db, id_sucursal, items) {
    for (const item of items) {
      const stmt = db.prepare('SELECT existencia FROM inventarios WHERE id_sucursal = ? AND id_producto = ?');
      stmt.bind([id_sucursal, item.id_producto]);
      if (stmt.step()) {
        const { existencia } = stmt.getAsObject();
        if (existencia < item.cantidad) {
          stmt.free();
          return { valid: false, id_producto: item.id_producto };
        }
      } else {
        stmt.free();
        return { valid: false, id_producto: item.id_producto };
      }
      stmt.free();
    }
    return { valid: true };
  }
};
