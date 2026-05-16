import { sucursalService } from '../services/sucursalService.js';
import { validateSucursal } from '../utils/validators.js';

export const getAllSucursales = async (req, res, next) => {
  try {
    const { page, limit, search, tipo } = req.query;
    const result = await sucursalService.getAll({ 
      page: parseInt(page) || 1, 
      limit: parseInt(limit) || 10, 
      search, 
      tipo 
    });
    res.json(result);
  } catch (err) { next(err); }
};

export const getSucursalById = async (req, res, next) => {
  try {
    const data = await sucursalService.getById(req.params.id);
    if (!data) return res.status(404).json({ message: 'Sucursal no encontrada' });
    res.json(data);
  } catch (err) { next(err); }
};

export const createSucursal = async (req, res, next) => {
  try {
    const { error } = validateSucursal(req.body);
    if (error) return res.status(400).json({ message: error });

    const data = await sucursalService.create(req.body, req.user.id);
    res.status(201).json(data);
  } catch (err) { next(err); }
};

export const updateSucursal = async (req, res, next) => {
  try {
    const { error } = validateSucursal(req.body);
    if (error) return res.status(400).json({ message: error });

    const data = await sucursalService.update(req.params.id, req.body, req.user.id);
    res.json(data);
  } catch (err) { next(err); }
};

export const deleteSucursal = async (req, res, next) => {
  try {
    const result = await sucursalService.delete(req.params.id, req.user.id);
    res.json({ 
      message: 'Sucursal desactivada correctamente', 
      warning: result.warning 
    });
  } catch (err) { next(err); }
};

export const getSucursalesSelect = async (req, res, next) => {
  try {
    const data = await sucursalService.getSelect(
      req.user.id, 
      req.user.rol, 
      req.user.id_sucursal
    );
    res.json(data);
  } catch (err) { next(err); }
};
