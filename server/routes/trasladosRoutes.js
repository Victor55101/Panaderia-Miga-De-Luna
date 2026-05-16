import express from 'express';
import { getTraslados, createTraslado, confirmarEntrega, cancelarTraslado } from '../controllers/trasladosController.js';
import { authenticateToken } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getTraslados);
router.post('/', roleGuard(['propietario', 'admin_sistema', 'jefe_produccion']), createTraslado);
router.post('/:id/confirmar', roleGuard(['propietario', 'admin_sistema', 'gerente_sucursal', 'repartidor']), confirmarEntrega);
router.post('/:id/cancel', roleGuard(['propietario', 'admin_sistema']), cancelarTraslado);

export default router;
