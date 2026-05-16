import { nominaService } from '../services/nominaService.js';

export const getNominas = async (req, res, next) => {
  try {
    const filters = {
      id_empleado: req.query.id_empleado || 'all',
      id_sucursal: req.query.id_sucursal || 'all',
      estatus: req.query.estatus || 'all',
      periodo_inicio: req.query.periodo_inicio || null,
      periodo_fin: req.query.periodo_fin || null,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 50
    };
    if (['gerente_sucursal'].includes(req.user.rol)) {
      filters.id_sucursal = req.user.id_sucursal;
    }
    const data = await nominaService.getAll(filters);
    res.json(data);
  } catch (err) { next(err); }
};

export const calcularNomina = async (req, res, next) => {
  try {
    const result = await nominaService.calcular(req.body, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const marcarPagada = async (req, res, next) => {
  try {
    const result = await nominaService.marcarPagada(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const cancelarNomina = async (req, res, next) => {
  try {
    const result = await nominaService.cancelar(req.params.id, req.user.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getDetalleNomina = async (req, res, next) => {
  try {
    const data = await nominaService.getDetalle(req.params.id);
    if (!data) return res.status(404).json({ error: 'Nómina no encontrada' });
    res.json(data);
  } catch (err) { next(err); }
};
