import { horasExtraService } from '../services/horasExtraService.js';

const ADMIN_ROLES = ['propietario', 'admin_sistema', 'recursos_humanos'];
const OPERATIVE_ROLES = ['vendedor', 'repartidor', 'jefe_produccion'];

export const getHorasExtra = async (req, res, next) => {
  try {
    const filters = {
      id_empleado: req.query.id_empleado || 'all',
      id_sucursal: req.query.id_sucursal || 'all',
      estatus: req.query.estatus || 'all',
      fecha_desde: req.query.fecha_desde || null,
      fecha_hasta: req.query.fecha_hasta || null,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    // RBAC: Operative roles only see own requests
    if (OPERATIVE_ROLES.includes(req.user.rol)) {
      filters.id_empleado = req.user.id_empleado;
    }
    // Gerente only sees own sucursal
    else if (req.user.rol === 'gerente_sucursal') {
      filters.id_sucursal = req.user.id_sucursal;
    }

    const data = await horasExtraService.getAll(filters);
    res.json(data);
  } catch (err) { next(err); }
};

export const createHorasExtra = async (req, res, next) => {
  try {
    const payload = { ...req.body };

    // RBAC: Operative roles MUST request for themselves
    if (OPERATIVE_ROLES.includes(req.user.rol)) {
      payload.id_empleado = req.user.id_empleado;
    }

    // Gerente can create for employees of their sucursal
    if (req.user.rol === 'gerente_sucursal' && payload.id_empleado) {
      const { getDb } = await import('../config/database.js');
      const db = await getDb();
      const empCheck = db.exec('SELECT id_sucursal FROM empleados WHERE id = ?', [payload.id_empleado]);
      if (!empCheck[0] || empCheck[0].values[0][0] !== req.user.id_sucursal) {
        return res.status(403).json({ error: 'Solo puede solicitar horas extra para empleados de su sucursal' });
      }
    }

    const result = await horasExtraService.create(payload, req.user.id);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const autorizarHorasExtra = async (req, res, next) => {
  try {
    // RBAC: Gerente can only authorize requests from their sucursal
    if (req.user.rol === 'gerente_sucursal') {
      const { getDb } = await import('../config/database.js');
      const db = await getDb();
      const heCheck = db.exec(`
        SELECT e.id_sucursal FROM horas_extra he 
        JOIN empleados e ON he.id_empleado = e.id 
        WHERE he.id = ?`, [req.params.id]);
      if (!heCheck[0] || heCheck[0].values[0][0] !== req.user.id_sucursal) {
        return res.status(403).json({ error: 'Solo puede autorizar solicitudes de su sucursal' });
      }
    }

    const result = await horasExtraService.autorizar(req.params.id, req.user.id_empleado, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const rechazarHorasExtra = async (req, res, next) => {
  try {
    // RBAC: Gerente can only reject requests from their sucursal
    if (req.user.rol === 'gerente_sucursal') {
      const { getDb } = await import('../config/database.js');
      const db = await getDb();
      const heCheck = db.exec(`
        SELECT e.id_sucursal FROM horas_extra he 
        JOIN empleados e ON he.id_empleado = e.id 
        WHERE he.id = ?`, [req.params.id]);
      if (!heCheck[0] || heCheck[0].values[0][0] !== req.user.id_sucursal) {
        return res.status(403).json({ error: 'Solo puede rechazar solicitudes de su sucursal' });
      }
    }

    const result = await horasExtraService.rechazar(req.params.id, req.user.id_empleado, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
