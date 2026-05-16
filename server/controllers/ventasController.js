import { ventasService } from '../services/ventasService.js';

export const crearVenta = async (req, res, next) => {
  try {
    const { venta, items } = req.body;
    if (!venta || !items) {
      return res.status(400).json({ error: 'Se requiere objeto "venta" y array "items"' });
    }

    // RBAC: Solo los vendedores pueden registrar ventas en operación normal
    if (req.user.rol !== 'vendedor') {
      return res.status(403).json({ error: 'No tiene permiso para registrar ventas en caja. Esta acción es exclusiva del rol vendedor.' });
    }

    // Forzar el id_empleado y id_sucursal al del vendedor autenticado
    if (!req.user.id_sucursal) {
      return res.status(403).json({ error: 'El vendedor no tiene una sucursal asignada' });
    }
    venta.id_empleado = req.user.id_empleado;
    venta.id_sucursal = req.user.id_sucursal;

    const result = await ventasService.createVenta(venta, items, req.user.id);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getVentas = async (req, res, next) => {
  try {
    const filters = {
      sucursalId: req.query.sucursalId,
      fechaDesde: req.query.fechaDesde,
      fechaHasta: req.query.fechaHasta,
      vendedorId: req.query.vendedorId,
      metodoPago: req.query.metodoPago,
      estatus: req.query.estatus,
      search: req.query.search,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0
    };

    // RBAC: Vendedor only sees own sales
    if (req.user.rol === 'vendedor') {
      if (!req.user.id_sucursal) {
        return res.status(403).json({ error: 'Usuario no tiene una sucursal asignada' });
      }
      filters.vendedorId = req.user.id_empleado;
      filters.sucursalId = req.user.id_sucursal;
    }

    const data = await ventasService.getAll(filters, req.user.rol, req.user.id_sucursal);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const getVenta = async (req, res, next) => {
  try {
    const venta = await ventasService.getVentaById(parseInt(req.params.id));

    // RBAC: Vendedor can only view own sales
    if (req.user.rol === 'vendedor' && venta.id_empleado !== req.user.id_empleado) {
      return res.status(403).json({ error: 'No tienes permiso para ver esta venta' });
    }
    // Gerente can only view sales from their sucursal
    if (req.user.rol === 'gerente_sucursal' && venta.id_sucursal !== req.user.id_sucursal) {
      return res.status(403).json({ error: 'No tienes permiso para ver ventas de otra sucursal' });
    }

    res.json(venta);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

export const cancelarVenta = async (req, res, next) => {
  try {
    const id_venta = parseInt(req.params.id);

    // RBAC: Gerente can only cancel sales from their sucursal
    if (req.user.rol === 'gerente_sucursal') {
      const venta = await ventasService.getVentaById(id_venta);
      if (venta.id_sucursal !== req.user.id_sucursal) {
        return res.status(403).json({ error: 'Solo puede cancelar ventas de su sucursal' });
      }
    }

    const motivo = req.body.motivo || null;
    const result = await ventasService.cancelarVenta(id_venta, req.user.id, motivo);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getProductosDisponibles = async (req, res, next) => {
  try {
    const { sucursalId } = req.params;

    // RBAC: Gerentes y Vendedores solo pueden ver productos de su sucursal
    if (['gerente_sucursal', 'vendedor'].includes(req.user.rol)) {
      if (parseInt(sucursalId) !== req.user.id_sucursal) {
        return res.status(403).json({ error: 'No tiene permiso para consultar el inventario de otra sucursal' });
      }
    }

    const data = await ventasService.getProductosDisponibles(parseInt(sucursalId));
    res.json(data);
  } catch (err) {
    next(err);
  }
};

export const getVendedores = async (req, res, next) => {
  try {
    const { sucursalId } = req.query;

    // RBAC: Gerente only sees vendedores from their sucursal
    let filterSucursal = sucursalId ? parseInt(sucursalId) : null;
    if (req.user.rol === 'gerente_sucursal') {
      if (!req.user.id_sucursal) {
        return res.status(403).json({ error: 'El gerente no tiene una sucursal asignada' });
      }
      filterSucursal = req.user.id_sucursal;
    }

    const data = await ventasService.getVendedores(filterSucursal);
    res.json(data);
  } catch (err) {
    next(err);
  }
};
