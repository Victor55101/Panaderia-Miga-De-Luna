import { productoService } from '../services/productoService.js';
import { productoEstrellaService } from '../services/productoEstrellaService.js';
import { validateProducto } from '../utils/validators.js';

export const getAllProductos = async (req, res, next) => {
  try {
    const { page, limit, search, categoria, tipo } = req.query;
    const result = await productoService.getAll({ 
      page: parseInt(page) || 1, 
      limit: parseInt(limit) || 10, 
      search, 
      categoria,
      tipo,
      activo: req.query.activo !== undefined ? parseInt(req.query.activo) : undefined
    });
    res.json(result);
  } catch (err) { next(err); }
};

export const getProductoById = async (req, res, next) => {
  try {
    const data = await productoService.getById(req.params.id);
    if (!data) return res.status(404).json({ message: 'Producto no encontrado' });
    res.json(data);
  } catch (err) { next(err); }
};

export const createProducto = async (req, res, next) => {
  try {
    const { error } = validateProducto(req.body);
    if (error) return res.status(400).json({ message: error });

    const data = await productoService.create(req.body, req.user.id);
    res.status(201).json(data);
  } catch (err) { next(err); }
};

export const updateProducto = async (req, res, next) => {
  try {
    const { error } = validateProducto(req.body);
    if (error) return res.status(400).json({ message: error });

    const data = await productoService.update(req.params.id, req.body, req.user.id);
    res.json(data);
  } catch (err) { next(err); }
};

export const deleteProducto = async (req, res, next) => {
  try {
    await productoService.delete(req.params.id, req.user.id);
    res.json({ message: 'Producto desactivado correctamente' });
  } catch (err) { next(err); }
};

export const getCategorias = async (req, res, next) => {
  try {
    const data = await productoService.getCategorias();
    res.json(data);
  } catch (err) { next(err); }
};

// Producto Estrella Specifications
export const getEspecificaciones = async (req, res, next) => {
  try {
    const data = await productoEstrellaService.getByProductoId(req.params.id);
    res.json(data || {});
  } catch (err) { next(err); }
};

export const updateEspecificaciones = async (req, res, next) => {
  try {
    const data = await productoEstrellaService.updateSpecification(req.params.id, req.body, req.user.id);
    res.json(data);
  } catch (err) { next(err); }
};

export const getHistorialEspecificaciones = async (req, res, next) => {
  try {
    const data = await productoEstrellaService.getHistory(req.params.id);
    res.json(data);
  } catch (err) { next(err); }
};

export const getActiveProductos = async (req, res, next) => {
  try {
    const data = await productoService.getActive();
    res.json(data);
  } catch (err) { next(err); }
};
