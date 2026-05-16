import produccionService from '../services/produccionService.js';

export const getProducciones = async (req, res) => {
  try {
    const filters = req.query;
    if (['gerente_sucursal', 'vendedor', 'repartidor', 'jefe_produccion'].includes(req.user.rol)) {
      if (!req.user.id_sucursal) {
        return res.status(403).json({ error: 'Usuario no tiene una sucursal asignada' });
      }
      filters.id_sucursal = req.user.id_sucursal;
    }
    const producciones = await produccionService.getProducciones(filters);
    
    // Si la tabla no tenía estatus antes, puede venir undefined para registros viejos
    const result = producciones.map(p => ({
      ...p,
      estatus: p.estatus || 'completada'
    }));

    res.json(result);
  } catch (error) {
    console.error('Error al obtener producciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const createProduccion = async (req, res) => {
  try {
    const usuarioId = req.user.id;

    if (req.user.rol === 'jefe_produccion') {
      if (!req.user.id_sucursal) {
        return res.status(403).json({ error: 'No tienes una sucursal/planta asignada' });
      }
      req.body.id_sucursal = req.user.id_sucursal;
    }

    const id = await produccionService.createProduccion(req.body, usuarioId);
    res.status(201).json({ success: true, id, message: 'Producción registrada exitosamente' });
  } catch (error) {
    console.error('Error al registrar producción:', error);
    res.status(400).json({ error: error.message || 'Error al registrar la producción' });
  }
};

export const cancelProduccion = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const { id } = req.params;

    // Validación RBAC para jefe_produccion
    if (req.user.rol === 'jefe_produccion') {
      if (!req.user.id_sucursal) {
        return res.status(403).json({ error: 'El jefe de producción no tiene una sucursal/planta asignada' });
      }
      const produccion = await produccionService.getProduccion(id);
      if (!produccion) {
        return res.status(404).json({ error: 'Producción no encontrada' });
      }
      if (produccion.id_sucursal_planta !== req.user.id_sucursal) {
        return res.status(403).json({ error: 'No tienes permiso para cancelar producción de otra sucursal' });
      }
    }

    await produccionService.cancelProduccion(id, usuarioId);
    res.json({ success: true, message: 'Producción cancelada y el inventario fue revertido' });
  } catch (error) {
    console.error('Error al cancelar producción:', error);
    res.status(400).json({ error: error.message || 'Error al cancelar la producción' });
  }
};
