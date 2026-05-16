import { getDb, saveDb } from '../config/database.js';
import { registrarAuditoria } from '../utils/auditoria.js';

export const horasExtraService = {
  async getAll({ id_empleado, id_sucursal, estatus, fecha_desde, fecha_hasta, page = 1, limit = 50 }) {
    const db = await getDb();
    let query = `
      SELECT he.*, e.nombre, e.apellido_paterno, e.id_sucursal,
             s.nombre as sucursal_nombre,
             ea.nombre as autorizador_nombre, ea.apellido_paterno as autorizador_apellido
      FROM horas_extra he
      JOIN empleados e ON he.id_empleado = e.id
      LEFT JOIN sucursales s ON e.id_sucursal = s.id
      LEFT JOIN empleados ea ON he.id_autorizador = ea.id
      WHERE 1=1
    `;
    const params = [];

    if (id_empleado && id_empleado !== 'all') { query += ` AND he.id_empleado = ?`; params.push(id_empleado); }
    if (id_sucursal && id_sucursal !== 'all') { query += ` AND e.id_sucursal = ?`; params.push(id_sucursal); }
    if (estatus && estatus !== 'all') { query += ` AND he.estatus = ?`; params.push(estatus); }
    if (fecha_desde) { query += ` AND he.fecha >= ?`; params.push(fecha_desde); }
    if (fecha_hasta) { query += ` AND he.fecha <= ?`; params.push(fecha_hasta); }

    query += ` ORDER BY he.fecha DESC`;
    const offset = (page - 1) * limit;
    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = db.prepare(query);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  },

  async create(data, userId) {
    const db = await getDb();
    const { id_empleado, fecha, cantidad_horas, motivo } = data;

    if (!id_empleado || !fecha || !cantidad_horas) throw new Error('Empleado, fecha y horas son requeridos');
    if (parseFloat(cantidad_horas) <= 0) throw new Error('Las horas extra deben ser mayor a cero');

    // Validate employee
    const emp = db.exec('SELECT id FROM empleados WHERE id = ? AND estatus = ?', [id_empleado, 'activo']);
    if (!emp[0]) throw new Error('Empleado no encontrado o inactivo');

    db.run(
      `INSERT INTO horas_extra (id_empleado, fecha, cantidad_horas, motivo, estatus)
       VALUES (?, ?, ?, ?, 'pendiente')`,
      [id_empleado, fecha, parseFloat(cantidad_horas), motivo || null]
    );
    const id = db.exec("SELECT last_insert_rowid()")[0].values[0][0];

    await registrarAuditoria({
      id_usuario: userId,
      accion: 'CREAR_HORAS_EXTRA',
      modulo: 'HORAS_EXTRA',
      registro_afectado: id,
      datos_nuevos: data
    });
    saveDb();
    return { id, success: true };
  },

  async autorizar(id, autorizadorEmpleadoId, userId) {
    const db = await getDb();

    const he = db.exec('SELECT id, estatus FROM horas_extra WHERE id = ?', [id]);
    if (!he[0]) throw new Error('Registro de horas extra no encontrado');
    if (he[0].values[0][1] !== 'pendiente') throw new Error('Solo se pueden autorizar horas extra con estatus pendiente');

    db.run(
      `UPDATE horas_extra SET estatus = 'autorizada', id_autorizador = ?, fecha_autorizacion = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`,
      [autorizadorEmpleadoId, id]
    );

    await registrarAuditoria({
      id_usuario: userId,
      accion: 'AUTORIZAR_HORAS_EXTRA',
      modulo: 'HORAS_EXTRA',
      registro_afectado: id,
      datos_nuevos: { estatus: 'autorizada', id_autorizador: autorizadorEmpleadoId }
    });
    saveDb();
    return { success: true };
  },

  async rechazar(id, autorizadorEmpleadoId, userId) {
    const db = await getDb();

    const he = db.exec('SELECT id, estatus FROM horas_extra WHERE id = ?', [id]);
    if (!he[0]) throw new Error('Registro de horas extra no encontrado');
    if (he[0].values[0][1] !== 'pendiente') throw new Error('Solo se pueden rechazar horas extra con estatus pendiente');

    db.run(
      `UPDATE horas_extra SET estatus = 'rechazada', id_autorizador = ?, fecha_autorizacion = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`,
      [autorizadorEmpleadoId, id]
    );

    await registrarAuditoria({
      id_usuario: userId,
      accion: 'RECHAZAR_HORAS_EXTRA',
      modulo: 'HORAS_EXTRA',
      registro_afectado: id,
      datos_nuevos: { estatus: 'rechazada', id_autorizador: autorizadorEmpleadoId }
    });
    saveDb();
    return { success: true };
  }
};
