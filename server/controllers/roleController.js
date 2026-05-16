import { roleService } from '../services/roleService.js';

export const getAllRoles = async (req, res) => {
  try {
    const roles = await roleService.getAll();
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRoleById = async (req, res) => {
  try {
    const role = await roleService.getById(req.params.id);
    if (!role) return res.status(404).json({ message: 'Rol no encontrado' });
    res.json(role);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createRole = async (req, res) => {
  try {
    const role = await roleService.create(req.body, req.user.id);
    res.status(201).json(role);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateRole = async (req, res) => {
  try {
    const role = await roleService.update(req.params.id, req.body, req.user.id);
    res.json(role);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteRole = async (req, res) => {
  try {
    const result = await roleService.delete(req.params.id, req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
