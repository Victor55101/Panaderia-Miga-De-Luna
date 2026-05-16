import { getDb, saveDb } from '../config/database.js';
import { registrarAuditoria } from '../utils/auditoria.js';

export const nominaService = {
  async getAll({ id_empleado, id_sucursal, estatus, periodo_inicio, periodo_fin, page = 1, limit = 50 }) {
    const db = await getDb();
    let query = `
      SELECT n.*, e.nombre, e.apellido_paterno, e.id_sucursal,
             s.nombre as sucursal_nombre, p.nombre as puesto_nombre
      FROM nominas n
      JOIN empleados e ON n.id_empleado = e.id
      LEFT JOIN sucursales s ON e.id_sucursal = s.id
      LEFT JOIN puestos p ON e.id_puesto = p.id
      WHERE 1=1
    `;
    const params = [];

    if (id_empleado && id_empleado !== 'all') { query += ` AND n.id_empleado = ?`; params.push(id_empleado); }
    if (id_sucursal && id_sucursal !== 'all') { query += ` AND e.id_sucursal = ?`; params.push(id_sucursal); }
    if (estatus && estatus !== 'all') { query += ` AND n.estatus = ?`; params.push(estatus); }
    if (periodo_inicio) { query += ` AND n.periodo_inicio >= ?`; params.push(periodo_inicio); }
    if (periodo_fin) { query += ` AND n.periodo_fin <= ?`; params.push(periodo_fin); }

    query += ` ORDER BY n.periodo_fin DESC, e.nombre ASC`;
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

  async calcular({ periodo_inicio, periodo_fin, id_sucursal }, userId) {
    const db = await getDb();

    if (!periodo_inicio || !periodo_fin) throw new Error('Periodo de inicio y fin son requeridos');
    if (periodo_fin < periodo_inicio) throw new Error('El periodo fin debe ser posterior al inicio');

    // Get employees to calculate for
    let empQuery = `SELECT e.id, e.nombre, e.apellido_paterno, e.salario_base, e.id_sucursal
                    FROM empleados e WHERE e.estatus = 'activo'`;
    const empParams = [];
    if (id_sucursal && id_sucursal !== 'all') {
      empQuery += ` AND e.id_sucursal = ?`;
      empParams.push(id_sucursal);
    }
    const empStmt = db.prepare(empQuery);
    empStmt.bind(empParams);
    const empleados = [];
    while (empStmt.step()) empleados.push(empStmt.getAsObject());
    empStmt.free();

    const results = [];
    const HORA_EXTRA_FACTOR = 1.5; // 150% of hourly rate

    for (const emp of empleados) {
      // Check if payroll already exists for this employee+period
      const existing = db.exec(
        `SELECT id, estatus FROM nominas WHERE id_empleado = ? AND periodo_inicio = ? AND periodo_fin = ?`,
        [emp.id, periodo_inicio, periodo_fin]
      );
      if (existing[0] && existing[0].values.length > 0) {
        const existStatus = existing[0].values[0][1];
        if (existStatus === 'pagada') continue; // Skip already paid
        // Delete pending one to recalculate
        db.run('DELETE FROM nominas WHERE id = ?', [existing[0].values[0][0]]);
      }

      const salarioBase = emp.salario_base || 0;

      // Calculate authorized overtime hours in period
      const heRes = db.exec(
        `SELECT COALESCE(SUM(cantidad_horas), 0) as total_horas
         FROM horas_extra
         WHERE id_empleado = ? AND fecha >= ? AND fecha <= ? AND estatus = 'autorizada'`,
        [emp.id, periodo_inicio, periodo_fin]
      );
      const totalHorasExtra = heRes[0] ? heRes[0].values[0][0] : 0;

      // Calculate overtime pay: hourly rate * factor * hours
      // Hourly rate = salario_base / (15 days * 8 hours) for quincenal
      const diasPeriodo = Math.max(1, Math.ceil((new Date(periodo_fin) - new Date(periodo_inicio)) / (1000 * 60 * 60 * 24)) + 1);
      const hoursPerDay = 8;
      const hourlyRate = salarioBase / (diasPeriodo * hoursPerDay);
      const montoHorasExtra = parseFloat((totalHorasExtra * hourlyRate * HORA_EXTRA_FACTOR).toFixed(2));
      const totalPagar = parseFloat((salarioBase + montoHorasExtra).toFixed(2));

      db.run(
        `INSERT INTO nominas (id_empleado, periodo_inicio, periodo_fin, salario_base, horas_extra_autorizadas, monto_horas_extra, total_pagar, estatus)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
        [emp.id, periodo_inicio, periodo_fin, salarioBase, totalHorasExtra, montoHorasExtra, totalPagar]
      );
      const id = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
      results.push({
        id,
        id_empleado: emp.id,
        nombre: emp.nombre,
        apellido_paterno: emp.apellido_paterno,
        salario_base: salarioBase,
        horas_extra_autorizadas: totalHorasExtra,
        monto_horas_extra: montoHorasExtra,
        total_pagar: totalPagar
      });
    }

    await registrarAuditoria({
      id_usuario: userId,
      accion: 'CALCULAR_NOMINA',
      modulo: 'NOMINA',
      datos_nuevos: { periodo_inicio, periodo_fin, empleados_calculados: results.length }
    });
    saveDb();
    return { success: true, nominas: results, total_calculadas: results.length };
  },

  async marcarPagada(id, userId) {
    const db = await getDb();
    const nom = db.exec('SELECT id, estatus FROM nominas WHERE id = ?', [id]);
    if (!nom[0]) throw new Error('Nómina no encontrada');
    if (nom[0].values[0][1] === 'pagada') throw new Error('Esta nómina ya fue pagada');

    db.run("UPDATE nominas SET estatus = 'pagada', updated_at = datetime('now') WHERE id = ?", [id]);

    await registrarAuditoria({
      id_usuario: userId,
      accion: 'PAGAR_NOMINA',
      modulo: 'NOMINA',
      registro_afectado: id,
      datos_nuevos: { estatus: 'pagada' }
    });
    saveDb();
    return { success: true };
  },

  async cancelar(id, userId) {
    const db = await getDb();
    const nom = db.exec('SELECT id, estatus FROM nominas WHERE id = ?', [id]);
    if (!nom[0]) throw new Error('Nómina no encontrada');
    if (nom[0].values[0][1] === 'pagada') throw new Error('No se puede cancelar una nómina ya pagada');

    db.run("UPDATE nominas SET estatus = 'cancelada', updated_at = datetime('now') WHERE id = ?", [id]);

    await registrarAuditoria({
      id_usuario: userId,
      accion: 'CANCELAR_NOMINA',
      modulo: 'NOMINA',
      registro_afectado: id,
      datos_nuevos: { estatus: 'cancelada' }
    });
    saveDb();
    return { success: true };
  },

  async getDetalle(id) {
    const db = await getDb();
    const stmt = db.prepare(`
      SELECT n.*, e.nombre, e.apellido_paterno, e.apellido_materno, e.rfc, e.id_sucursal,
             s.nombre as sucursal_nombre, p.nombre as puesto_nombre
      FROM nominas n
      JOIN empleados e ON n.id_empleado = e.id
      LEFT JOIN sucursales s ON e.id_sucursal = s.id
      LEFT JOIN puestos p ON e.id_puesto = p.id
      WHERE n.id = ?
    `);
    stmt.bind([id]);
    if (!stmt.step()) { stmt.free(); return null; }
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
};
