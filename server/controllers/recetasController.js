import recetaService from '../services/recetaService.js';

export const getRecetaByProducto = async (req, res) => {
  try {
    const data = await recetaService.getByProducto(req.params.id_producto);
    if (!data) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(data);
  } catch (error) {
    console.error('Error al obtener receta del producto:', error);
    res.status(500).json({ error: 'Error al obtener la receta' });
  }
};

export const saveRecetaForProducto = async (req, res) => {
  try {
    // Se espera { ingredientes: [ { id_insumo, cantidad_requerida }, ... ] }
    const { ingredientes } = req.body;
    await recetaService.saveForProducto(req.params.id_producto, ingredientes || [], req.user.id);
    res.json({ success: true, message: 'Receta guardada exitosamente' });
  } catch (error) {
    console.error('Error al guardar receta del producto:', error);
    res.status(400).json({ error: error.message || 'Error al guardar la receta' });
  }
};

export const deleteRecetaByProducto = async (req, res) => {
  try {
    await recetaService.deleteByProducto(req.params.id_producto, req.user.id);
    res.json({ success: true, message: 'Receta eliminada exitosamente' });
  } catch (error) {
    console.error('Error al eliminar receta del producto:', error);
    res.status(400).json({ error: error.message || 'Error al eliminar la receta' });
  }
};

export const getProductIdsConReceta = async (req, res) => {
  try {
    const ids = await recetaService.getProductIdsWithReceta();
    res.json(ids);
  } catch (error) {
    console.error('Error al obtener productos con receta:', error);
    res.status(500).json({ error: 'Error al obtener productos con receta' });
  }
};
