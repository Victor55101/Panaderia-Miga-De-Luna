import trasladosService from '../services/trasladosService.js';

export const getTraslados = async (req, res) => {
  try {
    const filters = { ...req.query };

    // RBAC: Gerente sees traslados where their sucursal is origin or destination
    if (req.user.rol === 'gerente_sucursal') {
      if (!req.user.id_sucursal) {
        return res.status(403).json({ error: 'El gerente no tiene una sucursal asignada' });
      }
      filters.sucursalId = req.user.id_sucursal;
    }
    // Repartidor only sees assigned traslados
    else if (req.user.rol === 'repartidor') {
      filters.repartidorId = req.user.id_empleado;
    }
    // Jefe de Producción only sees traslados from their plant/sucursal
    else if (req.user.rol === 'jefe_produccion') {
      if (!req.user.id_sucursal) {
        return res.status(403).json({ error: 'El jefe de producción no tiene una sucursal/planta asignada' });
      }
      filters.id_sucursal_origen = req.user.id_sucursal;
    }

    const traslados = await trasladosService.getTraslados(filters);
    res.json(traslados);
  } catch (error) {
    console.error('Error al obtener traslados:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const createTraslado = async (req, res) => {
  try {
    const usuarioId = req.user.id;

    if (req.user.rol === 'jefe_produccion') {
      if (!req.user.id_sucursal) {
        return res.status(403).json({ error: 'No tienes una sucursal/planta asignada' });
      }
      req.body.id_sucursal_origen = req.user.id_sucursal;
    }

    req.body.estatus = 'en_ruta';

    const id = await trasladosService.createTraslado(req.body, usuarioId);
    res.status(201).json({ success: true, id, message: 'Traslado registrado exitosamente' });
  } catch (error) {
    console.error('Error al registrar traslado:', error);
    res.status(400).json({ error: error.message || 'Error al registrar traslado' });
  }
};

export const confirmarEntrega = async (req, res) => {
  try {
    const trasladoId = req.params.id;

    // RBAC: Validate that the traslado can be confirmed by this user
    const { getDb } = await import('../config/database.js');
    const db = await getDb();
    const tRes = db.exec(`
      SELECT id_sucursal_destino, id_repartidor, estatus 
      FROM traslados WHERE id = ?
    `, [trasladoId]);

    if (!tRes[0] || tRes[0].values.length === 0) {
      return res.status(404).json({ error: 'Traslado no encontrado' });
    }

    const [id_sucursal_destino, id_repartidor, estatus] = tRes[0].values[0];

    // Prevent double confirmation
    if (estatus === 'entregado') {
      return res.status(400).json({ error: 'Este traslado ya fue confirmado como entregado' });
    }

    // Gerente can only confirm if their sucursal is the destination
    if (req.user.rol === 'gerente_sucursal') {
      if (!req.user.id_sucursal) {
        return res.status(403).json({ error: 'El gerente no tiene una sucursal asignada' });
      }
      if (id_sucursal_destino !== req.user.id_sucursal) {
        return res.status(403).json({ error: 'Solo puede confirmar recepción de traslados dirigidos a su sucursal' });
      }
    }

    // Repartidor can only confirm traslados assigned to them
    if (req.user.rol === 'repartidor') {
      if (id_repartidor !== req.user.id_empleado) {
        return res.status(403).json({ error: 'Solo puede confirmar traslados asignados a usted' });
      }
    }

    const usuarioId = req.user.id;
    await trasladosService.confirmarEntrega(trasladoId, req.body, usuarioId);
    res.json({ success: true, message: 'Entrega confirmada y el inventario destino actualizado' });
  } catch (error) {
    console.error('Error al confirmar entrega:', error);
    res.status(400).json({ error: error.message || 'Error al confirmar entrega' });
  }
};

export const cancelarTraslado = async (req, res) => {
  try {
    // Only propietario/admin can cancel (enforced in route guard)
    const usuarioId = req.user.id;
    await trasladosService.cancelarTraslado(req.params.id, usuarioId);
    res.json({ success: true, message: 'Traslado cancelado y el inventario origen revertido' });
  } catch (error) {
    console.error('Error al cancelar traslado:', error);
    res.status(400).json({ error: error.message || 'Error al cancelar traslado' });
  }
};
