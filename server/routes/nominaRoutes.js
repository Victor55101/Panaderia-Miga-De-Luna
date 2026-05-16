import { Router } from 'express';
import { getNominas, calcularNomina, marcarPagada, cancelarNomina, getDetalleNomina } from '../controllers/nominaController.js';
import { authenticateToken } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = Router();
router.use(authenticateToken);

// View - restricted roles
router.get('/', roleGuard(['propietario', 'admin_sistema', 'recursos_humanos']), getNominas);
router.get('/:id', roleGuard(['propietario', 'admin_sistema', 'recursos_humanos']), getDetalleNomina);

// Calculate, pay, cancel - only rh, admin, propietario
router.post('/calcular', roleGuard(['propietario', 'admin_sistema', 'recursos_humanos']), calcularNomina);
router.patch('/:id/pagar', roleGuard(['propietario', 'admin_sistema', 'recursos_humanos']), marcarPagada);
router.patch('/:id/cancelar', roleGuard(['propietario', 'admin_sistema', 'recursos_humanos']), cancelarNomina);

export default router;
