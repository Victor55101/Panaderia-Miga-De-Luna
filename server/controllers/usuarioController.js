import { usuarioService } from '../services/usuarioService.js';

export const getAllUsuarios = async (req, res) => {
  try {
    const filters = {
      search: req.query.search || '',
      rol: req.query.rol || 'all',
      estatus: req.query.estatus || 'all'
    };
    const usuarios = await usuarioService.getAll(filters);
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createUsuario = async (req, res) => {
  try {
    const usuario = await usuarioService.create(req.body, req.user.id);
    res.status(201).json(usuario);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateUsuario = async (req, res) => {
  try {
    const usuario = await usuarioService.update(req.params.id, req.body, req.user.id);
    res.json(usuario);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteUsuario = async (req, res) => {
  try {
    const result = await usuarioService.delete(req.params.id, req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getAvailableEmployees = async (req, res) => {
  try {
    const employees = await usuarioService.getAvailableEmployees();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRoles = async (req, res) => {
  try {
    const roles = await usuarioService.getRoles();
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
