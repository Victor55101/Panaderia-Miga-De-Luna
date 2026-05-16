import { Router } from 'express';
import { getAllInventario, registrarMovimiento, getHistorial, updateLimits, getProductosMovimiento } from '../controllers/inventarioController.js';
import { authenticateToken } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = Router();

// All inventory routes require authentication
router.use(authenticateToken);

router.get('/', getAllInventario);
router.get('/historial', getHistorial);
router.get('/productos-movimiento', getProductosMovimiento);

// Writing actions: propietario, admin, gerente_sucursal, jefe_produccion can register movements
// (type and sucursal restrictions enforced in controller)
router.post('/movimiento', roleGuard(['propietario', 'admin_sistema', 'gerente_sucursal', 'jefe_produccion']), registrarMovimiento);

// Limits: only propietario and admin
router.patch('/:id/limites', roleGuard(['propietario', 'admin_sistema']), updateLimits);

export default router;
