import { Router } from 'express';
import { getHorasExtra, createHorasExtra, autorizarHorasExtra, rechazarHorasExtra } from '../controllers/horasExtraController.js';
import { authenticateToken } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = Router();
router.use(authenticateToken);

// View filtered by role in controller
router.get('/', getHorasExtra);

// Create - any authenticated user can request horas extra
router.post('/', createHorasExtra);

// Authorize/Reject - only authorized roles
router.patch('/:id/autorizar', roleGuard(['propietario', 'admin_sistema', 'recursos_humanos', 'gerente_sucursal']), autorizarHorasExtra);
router.patch('/:id/rechazar', roleGuard(['propietario', 'admin_sistema', 'recursos_humanos', 'gerente_sucursal']), rechazarHorasExtra);

export default router;
