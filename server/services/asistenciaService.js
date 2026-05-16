import { getDb, saveDb } from '../config/database.js';
import { registrarAuditoria } from '../utils/auditoria.js';

export const asistenciaService = {
  async getAll({ fecha, id_empleado, id_sucursal, incidencia, page = 1, limit = 50 }) {
    const db = await getDb();
    let query = `
      SELECT a.*, e.nombre, e.apellido_paterno, e.apellido_materno,
             s.nombre as sucursal_nombre, e.id_sucursal
      FROM asistencias a
      JOIN empleados e ON a.id_empleado = e.id
      LEFT JOIN sucursales s ON e.id_sucursal = s.id
      WHERE 1=1
    `;
    const params = [];

    if (fecha) { query += ` AND a.fecha = ?`; params.push(fecha); }
    if (id_empleado && id_empleado !== 'all') { query += ` AND a.id_empleado = ?`; params.push(id_empleado); }
    if (id_sucursal && id_sucursal !== 'all') { query += ` AND e.id_sucursal = ?`; params.push(id_sucursal); }
    if (incidencia && incidencia !== 'all') { query += ` AND a.incidencia = ?`; params.push(incidencia); }

    query += ` ORDER BY a.fecha DESC, a.hora_entrada DESC`;
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

  async registrarEntrada(id_empleado, userId) {
    const db = await getDb();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().split(' ')[0].substring(0, 5);

    // Validate employee exists
    const emp = db.exec('SELECT id, nombre, apellido_paterno FROM empleados WHERE id = ? AND estatus = ?', [id_empleado, 'activo']);
    if (!emp[0]) throw new Error('Empleado no encontrado o inactivo');

    // Check no open entry today
    const existing = db.exec(
      'SELECT id FROM asistencias WHERE id_empleado = ? AND fecha = ? AND hora_entrada IS NOT NULL',
      [id_empleado, today]
    );
    if (existing[0] && existing[0].values.length > 0) {
      throw new Error('Este empleado ya tiene una entrada registrada hoy');
    }

    // Determine incidencia (retardo if after 07:15)
    let incidencia = 'asistencia';
    const [h, m] = now.split(':').map(Number);
    if (h > 7 || (h === 7 && m > 15)) incidencia = 'retardo';

    db.run(
      `INSERT INTO asistencias (id_empleado, fecha, hora_entrada, incidencia)
       VALUES (?, ?, ?, ?)`,
      [id_empleado, today, now, incidencia]
    );
    const id = db.exec("SELECT last_insert_rowid()")[0].values[0][0];

    await registrarAuditoria({
      id_usuario: userId,
      accion: 'REGISTRAR_ENTRADA',
      modulo: 'ASISTENCIA',
      registro_afectado: id,
      datos_nuevos: { id_empleado, fecha: today, hora_entrada: now, incidencia }
    });
    saveDb();
    return { id, hora_entrada: now, incidencia };
  },

  async registrarSalida(id_empleado, userId) {
    const db = await getDb();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().split(' ')[0].substring(0, 5);

    // Find open entry
    const entryRes = db.exec(
      'SELECT id, hora_entrada FROM asistencias WHERE id_empleado = ? AND fecha = ? AND hora_salida IS NULL',
      [id_empleado, today]
    );
    if (!entryRes[0] || entryRes[0].values.length === 0) {
      throw new Error('No hay una entrada registrada hoy para este empleado');
    }
    const [id, hora_entrada] = entryRes[0].values[0];

    // Calculate hours
    const [eh, em] = hora_entrada.split(':').map(Number);
    const [sh, sm] = now.split(':').map(Number);
    const entryMin = eh * 60 + em;
    const exitMin = sh * 60 + sm;
    if (exitMin <= entryMin) throw new Error('La hora de salida debe ser posterior a la entrada');
    const horas = parseFloat(((exitMin - entryMin) / 60).toFixed(2));

    // Check early exit (before 15:00)
    let incidencia = null;
    const currentInc = db.exec('SELECT incidencia FROM asistencias WHERE id = ?', [id]);
    if (currentInc[0]) incidencia = currentInc[0].values[0][0];
    if (sh < 15) incidencia = 'salida_anticipada';

    db.run(
      `UPDATE asistencias SET hora_salida = ?, horas_trabajadas = ?, incidencia = COALESCE(?, incidencia), updated_at = datetime('now')
       WHERE id = ?`,
      [now, horas, incidencia !== currentInc[0]?.values[0]?.[0] ? incidencia : null, id]
    );

    await registrarAuditoria({
      id_usuario: userId,
      accion: 'REGISTRAR_SALIDA',
      modulo: 'ASISTENCIA',
      registro_afectado: id,
      datos_nuevos: { hora_salida: now, horas_trabajadas: horas }
    });
    saveDb();
    return { id, hora_salida: now, horas_trabajadas: horas };
  },

  async registrarManual(data, userId) {
    const db = await getDb();
    const { id_empleado, fecha, hora_entrada, hora_salida, incidencia } = data;

    if (!id_empleado || !fecha) throw new Error('Empleado y fecha son requeridos');

    // Check duplicate
    const existing = db.exec(
      'SELECT id FROM asistencias WHERE id_empleado = ? AND fecha = ?',
      [id_empleado, fecha]
    );
    if (existing[0] && existing[0].values.length > 0) {
      throw new Error('Ya existe un registro de asistencia para este empleado en esta fecha');
    }

    let horas = 0;
    if (hora_entrada && hora_salida) {
      const [eh, em] = hora_entrada.split(':').map(Number);
      const [sh, sm] = hora_salida.split(':').map(Number);
      horas = parseFloat((((sh * 60 + sm) - (eh * 60 + em)) / 60).toFixed(2));
      if (horas < 0) throw new Error('La hora de salida debe ser posterior a la entrada');
    }

    db.run(
      `INSERT INTO asistencias (id_empleado, fecha, hora_entrada, hora_salida, horas_trabajadas, incidencia)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id_empleado, fecha, hora_entrada || null, hora_salida || null, horas, incidencia || 'asistencia']
    );
    const id = db.exec("SELECT last_insert_rowid()")[0].values[0][0];

    await registrarAuditoria({
      id_usuario: userId,
      accion: 'REGISTRAR_ASISTENCIA_MANUAL',
      modulo: 'ASISTENCIA',
      registro_afectado: id,
      datos_nuevos: data
    });
    saveDb();
    return { id, success: true };
  },

  async getEmpleadosPresentes(fecha, id_sucursal = null) {
    const db = await getDb();
    let query = `
      SELECT a.id_empleado, e.nombre, e.apellido_paterno, a.hora_entrada, a.hora_salida, a.incidencia
      FROM asistencias a
      JOIN empleados e ON a.id_empleado = e.id
      WHERE a.fecha = ? AND a.hora_entrada IS NOT NULL
    `;
    const params = [fecha || new Date().toISOString().split('T')[0]];

    if (id_sucursal) {
      query += ` AND e.id_sucursal = ?`;
      params.push(id_sucursal);
    }

    query += ` ORDER BY a.hora_entrada ASC`;

    const stmt = db.prepare(query);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }
};
