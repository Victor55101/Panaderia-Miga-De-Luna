import { categoriaService } from '../services/categoriaService.js';

export const getAllCategorias = async (req, res, next) => {
  try {
    const data = await categoriaService.getAll();
    res.json(data);
  } catch (err) { next(err); }
};

export const createCategoria = async (req, res, next) => {
  try {
    const data = await categoriaService.create(req.body, req.user);
    res.status(201).json(data);
  } catch (err) { next(err); }
};

export const updateCategoria = async (req, res, next) => {
  try {
    const data = await categoriaService.update(req.params.id, req.body, req.user);
    res.json(data);
  } catch (err) { next(err); }
};

export const deleteCategoria = async (req, res, next) => {
  try {
    const data = await categoriaService.delete(req.params.id, req.user);
    res.json(data);
  } catch (err) { next(err); }
};
