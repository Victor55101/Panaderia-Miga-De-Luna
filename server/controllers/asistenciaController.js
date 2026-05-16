import { asistenciaService } from '../services/asistenciaService.js';

const ADMIN_ROLES = ['propietario', 'admin_sistema', 'recursos_humanos'];
const MANAGEMENT_ROLES = [...ADMIN_ROLES, 'gerente_sucursal'];
const OPERATIVE_ROLES = ['vendedor', 'repartidor', 'jefe_produccion'];

export const getAsistencias = async (req, res, next) => {
  try {
    const filters = {
      fecha: req.query.fecha || null,
      id_empleado: req.query.id_empleado || 'all',
      id_sucursal: req.query.id_sucursal || 'all',
      incidencia: req.query.incidencia || 'all',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };

    // RBAC: Operative roles only see own attendance
    if (OPERATIVE_ROLES.includes(req.user.rol)) {
      filters.id_empleado = req.user.id_empleado;
    }
    // Gerente only sees own sucursal
    else if (req.user.rol === 'gerente_sucursal') {
      filters.id_sucursal = req.user.id_sucursal;
    }

    const data = await asistenciaService.getAll(filters);
    res.json(data);
  } catch (err) { next(err); }
};

export const registrarEntrada = async (req, res, next) => {
  try {
    // RBAC: Operative roles MUST use their own id_empleado
    let id_empleado;
    if (OPERATIVE_ROLES.includes(req.user.rol)) {
      id_empleado = req.user.id_empleado;
    } else {
      id_empleado = req.body.id_empleado || req.user.id_empleado;
    }

    const result = await asistenciaService.registrarEntrada(id_empleado, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const registrarSalida = async (req, res, next) => {
  try {
    // RBAC: Operative roles MUST use their own id_empleado
    let id_empleado;
    if (OPERATIVE_ROLES.includes(req.user.rol)) {
      id_empleado = req.user.id_empleado;
    } else {
      id_empleado = req.body.id_empleado || req.user.id_empleado;
    }

    const result = await asistenciaService.registrarSalida(id_empleado, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const registrarManual = async (req, res, next) => {
  try {
    // RBAC: Gerente can only register for employees of their sucursal
    if (req.user.rol === 'gerente_sucursal') {
      const { getDb } = await import('../config/database.js');
      const db = await getDb();
      const empCheck = db.exec('SELECT id_sucursal FROM empleados WHERE id = ?', [req.body.id_empleado]);
      if (!empCheck[0] || empCheck[0].values[0][0] !== req.user.id_sucursal) {
        return res.status(403).json({ error: 'Solo puede registrar asistencia de empleados de su sucursal' });
      }
    }

    const result = await asistenciaService.registrarManual(req.body, req.user.id);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getEmpleadosPresentes = async (req, res, next) => {
  try {
    // RBAC: Gerente solo ve empleados presentes de su sucursal
    let filterSucursal = null;
    if (req.user.rol === 'gerente_sucursal') {
      filterSucursal = req.user.id_sucursal;
    }

    const data = await asistenciaService.getEmpleadosPresentes(req.query.fecha, filterSucursal);
    res.json(data);
  } catch (err) { next(err); }
};
