import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';
import * as sucursalController from '../controllers/sucursalController.js';

const router = Router();

// Only admin and owner can manage sucursales
router.use(authenticateToken);

router.get('/', sucursalController.getAllSucursales);
router.get('/select', sucursalController.getSucursalesSelect);
router.get('/:id', sucursalController.getSucursalById);

router.post('/', roleGuard('propietario', 'admin_sistema'), sucursalController.createSucursal);
router.put('/:id', roleGuard('propietario', 'admin_sistema'), sucursalController.updateSucursal);
router.delete('/:id', roleGuard('propietario', 'admin_sistema'), sucursalController.deleteSucursal);

export default router;
