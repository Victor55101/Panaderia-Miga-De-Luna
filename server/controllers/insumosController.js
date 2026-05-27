import insumoService from '../services/insumoService.js';

export const getAllInsumos = async (req, res) => {
  try {
    const { search, stockStatus, activo } = req.query;
    const data = await insumoService.getAll({ search, stockStatus, activo });
    res.json(data);
  } catch (error) {
    console.error('Error al obtener insumos:', error);
    res.status(500).json({ error: 'Error al obtener la lista de insumos' });
  }
};

export const getInsumoById = async (req, res) => {
  try {
    const data = await insumoService.getById(req.params.id);
    if (!data) {
      return res.status(404).json({ error: 'Insumo no encontrado' });
    }
    res.json(data);
  } catch (error) {
    console.error('Error al obtener insumo por ID:', error);
    res.status(500).json({ error: 'Error al obtener el insumo' });
  }
};

export const createInsumo = async (req, res) => {
  try {
    const id = await insumoService.create(req.body, req.user.id);
    res.status(201).json({ success: true, id, message: 'Insumo creado exitosamente' });
  } catch (error) {
    console.error('Error al crear insumo:', error);
    res.status(400).json({ error: error.message || 'Error al crear el insumo' });
  }
};

export const updateInsumo = async (req, res) => {
  try {
    await insumoService.update(req.params.id, req.body, req.user.id);
    res.json({ success: true, message: 'Insumo actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar insumo:', error);
    res.status(400).json({ error: error.message || 'Error al actualizar el insumo' });
  }
};

export const deleteInsumo = async (req, res) => {
  try {
    await insumoService.delete(req.params.id, req.user.id);
    res.json({ success: true, message: 'Insumo desactivado/eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar insumo:', error);
    res.status(400).json({ error: error.message || 'Error al eliminar el insumo' });
  }
};

export const getInsumoMovimientos = async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const data = await insumoService.getMovimientos(req.params.id, limit);
    res.json(data);
  } catch (error) {
    console.error('Error al obtener movimientos de insumo:', error);
    res.status(500).json({ error: 'Error al obtener los movimientos del insumo' });
  }
};

export const getActivosInsumos = async (req, res) => {
  try {
    const data = await insumoService.getActivos();
    res.json(data);
  } catch (error) {
    console.error('Error al obtener insumos activos:', error);
    res.status(500).json({ error: 'Error al obtener los insumos activos' });
  }
};
