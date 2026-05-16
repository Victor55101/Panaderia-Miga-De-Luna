import { inventarioService } from '../services/inventarioService.js';

const ALLOWED_GERENTE_MOVEMENTS = ['ajuste', 'merma', 'correccion'];

export const getAllInventario = async (req, res, next) => {
  try {
    const filters = {
      sucursalId: req.query.sucursalId || 'all',
      search: req.query.search || '',
      stockStatus: req.query.stockStatus || 'all'
    };
    // RBAC: Non-admin roles restricted to their own sucursal
    if (['gerente_sucursal', 'vendedor', 'repartidor', 'jefe_produccion'].includes(req.user.rol)) {
      if (!req.user.id_sucursal) {
        return res.status(403).json({ error: 'Usuario no tiene una sucursal asignada' });
      }
      filters.sucursalId = req.user.id_sucursal;
    }
    const data = await inventarioService.getAll(filters);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const registrarMovimiento = async (req, res, next) => {
  try {
    const payload = { ...req.body };
    
    // Sign and type validation
    const cantidad = Number(payload.cantidad);
    if (isNaN(cantidad) || cantidad === 0) {
      return res.status(400).json({ error: 'La cantidad debe ser un número distinto de cero' });
    }

    if (payload.tipo_movimiento === 'merma' && cantidad < 0) {
      // Merma is always a subtraction, so we expect positive input and we'll subtract it
      // or we accept negative input and keep it. Service uses Math.abs and factor.
    }
    
    const rawMotivo = (payload.motivo || payload.referencia || '').trim();

    // RBAC: Gerente can only adjust own sucursal with allowed movement types
    if (['gerente_sucursal', 'jefe_produccion'].includes(req.user.rol)) {
      if (!req.user.id_sucursal) {
        return res.status(403).json({ error: 'Usuario no tiene una sucursal asignada' });
      }
      payload.id_sucursal = req.user.id_sucursal;
      if (!ALLOWED_GERENTE_MOVEMENTS.includes(payload.tipo_movimiento)) {
        const msg = req.user.rol === 'jefe_produccion' 
          ? 'Solo puede registrar ajustes, mermas o correcciones. Use el módulo Producción para producción normal.'
          : 'Solo puede registrar ajustes, mermas o correcciones';
        return res.status(403).json({ error: msg });
      }
      if (!rawMotivo) {
        return res.status(400).json({ error: 'El motivo es obligatorio para registrar movimientos' });
      }
    }

    // Preserve operational type in the reference field
    let prefix = '';
    if (payload.tipo_movimiento === 'merma') prefix = 'Merma: ';
    else if (payload.tipo_movimiento === 'correccion') prefix = 'Corrección: ';
    else if (payload.tipo_movimiento === 'ajuste' || payload.tipo_movimiento?.startsWith('ajuste_')) prefix = 'Ajuste: ';

    payload.referencia = `${prefix}${rawMotivo}`;

    const result = await inventarioService.registrarMovimiento(payload, req.user.id);
    res.json({ message: 'Movimiento registrado con éxito', ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getHistorial = async (req, res, next) => {
  try {
    const filters = {
      sucursalId: req.query.sucursalId || 'all',
      productoId: req.query.productoId || 'all',
      limit: parseInt(req.query.limit) || 50
    };
    if (['gerente_sucursal', 'vendedor', 'repartidor', 'jefe_produccion'].includes(req.user.rol)) {
      if (!req.user.id_sucursal) {
        return res.status(403).json({ error: 'Usuario no tiene una sucursal asignada' });
      }
      filters.sucursalId = req.user.id_sucursal;
    }
    const data = await inventarioService.getHistorial(filters);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const updateLimits = async (req, res, next) => {
  try {
    // RBAC: Only propietario/admin can update limits (enforced in route guard)
    const { id } = req.params;
    await inventarioService.updateLimits(id, req.body);
    res.json({ message: 'Límites actualizados con éxito' });
  } catch (err) {
    next(err);
  }
};

export const getProductosMovimiento = async (req, res, next) => {
  try {
    const { sucursalId, tipoMovimiento } = req.query;
    if (!sucursalId) return res.status(400).json({ error: 'Sucursal es requerida' });

    // RBAC: Restricted roles can only see products for their own branch
    if (['gerente_sucursal', 'vendedor', 'repartidor', 'jefe_produccion'].includes(req.user.rol)) {
      if (!req.user.id_sucursal) {
        return res.status(403).json({ error: 'Usuario no tiene una sucursal asignada' });
      }
      if (String(sucursalId) !== String(req.user.id_sucursal)) {
        return res.status(403).json({ error: 'No tiene permiso para ver productos de otra sucursal' });
      }
    }

    const data = await inventarioService.getProductosMovimiento({ sucursalId, tipoMovimiento });
    res.json(data);
  } catch (err) {
    next(err);
  }
};
