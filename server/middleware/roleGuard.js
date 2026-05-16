export function roleGuard(...allowedRoles) {
  const roles = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user || !req.user.rol) {
      return res.status(403).json({ error: 'Acceso denegado: rol no identificado' });
    }
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Acceso denegado: permisos insuficientes' });
    }
    next();
  };
}

export function sucursalGuard(req, res, next) {
  // Gerentes y vendedores solo acceden a su sucursal
  const restrictedRoles = ['gerente_sucursal', 'vendedor'];
  if (restrictedRoles.includes(req.user.rol)) {
    const requestedSucursal = req.params.sucursalId || req.body.id_sucursal || req.query.id_sucursal;
    if (requestedSucursal && parseInt(requestedSucursal) !== req.user.id_sucursal) {
      return res.status(403).json({ error: 'Solo puede acceder a datos de su sucursal' });
    }
  }
  next();
}
