import { getDb } from '../config/database.js';

/**
 * Middleware para asegurar que un usuario solo acceda a recursos de su propia sucursal
 * a menos que sea administrador o propietario.
 */
export const sucursalGuard = (req, res, next) => {
  const { rol, id_sucursal: userSucursalId } = req.user;
  
  // Propietarios y Admins se saltan este guard
  if (rol === 'propietario' || rol === 'administrador') {
    return next();
  }

  // Si el recurso tiene un id_sucursal en params o body, validamos
  const resourceSucursalId = req.params.id_sucursal || req.body.id_sucursal || req.query.id_sucursal;

  if (resourceSucursalId && parseInt(resourceSucursalId) !== userSucursalId) {
    return res.status(403).json({ error: 'No tienes permiso para acceder a los datos de esta sucursal' });
  }

  // Inyectamos la sucursal del usuario para que los controladores la usen si no viene en el request
  req.sucursalId = userSucursalId;
  next();
};
