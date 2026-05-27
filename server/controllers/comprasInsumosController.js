import comprasInsumosService from '../services/comprasInsumosService.js';

export const getAllComprasInsumos = async (req, res) => {
  try {
    const { search, fechaInicio, fechaFin } = req.query;
    const data = await comprasInsumosService.getAll({ search, fechaInicio, fechaFin });
    res.json(data);
  } catch (error) {
    console.error('Error al obtener compras de insumos:', error);
    res.status(500).json({ error: 'Error al obtener la lista de compras de insumos' });
  }
};

export const getCompraInsumoById = async (req, res) => {
  try {
    const data = await comprasInsumosService.getById(req.params.id);
    if (!data) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }
    res.json(data);
  } catch (error) {
    console.error('Error al obtener compra de insumos por ID:', error);
    res.status(500).json({ error: 'Error al obtener el detalle de la compra' });
  }
};

export const createCompraInsumo = async (req, res) => {
  try {
    const id = await comprasInsumosService.create(req.body, req.user.id);
    res.status(201).json({ success: true, id, message: 'Compra de insumos registrada exitosamente' });
  } catch (error) {
    console.error('Error al registrar compra de insumos:', error);
    res.status(400).json({ error: error.message || 'Error al registrar la compra' });
  }
};
