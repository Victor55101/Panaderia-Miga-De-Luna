import { getDb, saveDb } from '../config/database.js';

/**
 * Registra una operación en la tabla de auditoría y guarda los cambios en el archivo de base de datos.
 * @param {Object} params - Parámetros de la auditoría.
 * @param {number} params.id_usuario - ID del usuario que realiza la acción.
 * @param {string} params.accion - Tipo de acción (crear, actualizar, eliminar, login, etc).
 * @param {string} params.modulo - Nombre del módulo afectado.
 * @param {number} [params.registro_afectado] - ID del registro modificado.
 * @param {Object} [params.datos_anteriores] - Datos previos (opcional).
 * @param {Object} [params.datos_nuevos] - Datos actualizados (opcional).
 */
export async function registrarAuditoria({
  id_usuario,
  accion,
  modulo,
  registro_afectado = null,
  datos_anteriores = null,
  datos_nuevos = null
}) {
  try {
    const db = await getDb();
    
    db.run(
      `INSERT INTO auditoria_operaciones (
        id_usuario, accion, modulo, registro_afectado, 
        datos_anteriores, datos_nuevos
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id_usuario,
        accion,
        modulo,
        registro_afectado,
        datos_anteriores ? JSON.stringify(datos_anteriores) : null,
        datos_nuevos ? JSON.stringify(datos_nuevos) : null
      ]
    );

    // Guardar persistencia física (sql.js)
    saveDb();
    
  } catch (error) {
    console.error('❌ ERROR CRÍTICO EN AUDITORÍA:', error);
    if (process.env.NODE_ENV === 'development') {
      console.error('Detalles del error de auditoría:', {
        id_usuario, accion, modulo, registro_afectado
      });
    }
    // No lanzamos el error para no interrumpir el flujo principal en producción,
    // pero en desarrollo queremos saber qué pasó.
  }
}
