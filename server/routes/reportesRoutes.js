import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import {
  resolvePeriod,
  getResumenVentas,
  getEstadisticoSemanal,
  getInventarioReporte,
  getMovimientosInventario,
  getProduccionReporte,
  getPersonalReporte,
} from '../services/reportesService.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// RBAC sets
const ADMIN_ROLES  = ['propietario', 'admin_sistema'];
const RRHH_ROLES   = [...ADMIN_ROLES, 'recursos_humanos'];
const VENTAS_ROLES = [...ADMIN_ROLES, 'gerente_sucursal'];
const PROD_ROLES   = [...ADMIN_ROLES, 'jefe_produccion'];
const INV_ROLES    = [...ADMIN_ROLES, 'gerente_sucursal', 'jefe_produccion'];

function requireRole(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Acceso denegado para este rol' });
    }
    next();
  };
}

/** Parse common query params and resolve period to date range */
function parseFilters(req) {
  const { periodo, rangoDesde, rangoHasta, sucursalId } = req.query;
  const { fechaDesde, fechaHasta } = resolvePeriod(periodo, rangoDesde, rangoHasta);
  return { fechaDesde, fechaHasta, sucursalId, userRole: req.user.rol, userSucursalId: req.user.id_sucursal };
}

// GET /api/reportes/ventas
router.get('/ventas', requireRole(VENTAS_ROLES), async (req, res, next) => {
  try { res.json(await getResumenVentas(parseFilters(req))); } catch (e) { next(e); }
});

// GET /api/reportes/semanal
router.get('/semanal', requireRole(VENTAS_ROLES), async (req, res, next) => {
  try { res.json(await getEstadisticoSemanal(parseFilters(req))); } catch (e) { next(e); }
});

// GET /api/reportes/inventario
router.get('/inventario', requireRole(INV_ROLES), async (req, res, next) => {
  try { res.json(await getInventarioReporte(parseFilters(req))); } catch (e) { next(e); }
});

// GET /api/reportes/movimientos
router.get('/movimientos', requireRole(INV_ROLES), async (req, res, next) => {
  try { res.json(await getMovimientosInventario(parseFilters(req))); } catch (e) { next(e); }
});

// GET /api/reportes/produccion
router.get('/produccion', requireRole(PROD_ROLES), async (req, res, next) => {
  try { res.json(await getProduccionReporte(parseFilters(req))); } catch (e) { next(e); }
});

// GET /api/reportes/personal
router.get('/personal', requireRole(RRHH_ROLES), async (req, res, next) => {
  try { res.json(await getPersonalReporte(parseFilters(req))); } catch (e) { next(e); }
});

export default router;
