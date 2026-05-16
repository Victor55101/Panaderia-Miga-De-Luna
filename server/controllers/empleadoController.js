import { empleadoService } from '../services/empleadoService.js';

export const getAllEmpleados = async (req, res) => {
  try {
    const filters = {
      search: req.query.search || '',
      id_sucursal: req.query.id_sucursal || 'all',
      id_puesto: req.query.id_puesto || 'all',
      id_departamento: req.query.id_departamento || 'all',
      estatus: req.query.estatus || 'all',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10
    };

    // RBAC: Gerente solo ve empleados de su sucursal
    if (req.user.rol === 'gerente_sucursal') {
      filters.id_sucursal = req.user.id_sucursal;
    }

    const result = await empleadoService.getAll(filters);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getEmpleadoById = async (req, res) => {
  try {
    const empleado = await empleadoService.getById(req.params.id);
    if (!empleado) return res.status(404).json({ message: 'Empleado no encontrado' });
    res.json(empleado);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createEmpleado = async (req, res) => {
  try {
    const empleado = await empleadoService.create(req.body, req.user.id);
    res.status(201).json(empleado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const updateEmpleado = async (req, res) => {
  try {
    const empleado = await empleadoService.update(req.params.id, req.body, req.user.id);
    res.json(empleado);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteEmpleado = async (req, res) => {
  try {
    const result = await empleadoService.delete(req.params.id, req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const getMetadata = async (req, res) => {
  try {
    const [puestos, departamentos] = await Promise.all([
      empleadoService.getPuestos(),
      empleadoService.getDepartamentos()
    ]);
    res.json({ puestos, departamentos });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getRepartidores = async (req, res) => {
  try {
    const result = await empleadoService.getRepartidores();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
