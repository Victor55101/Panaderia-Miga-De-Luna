import express from 'express';
import { getProducciones, createProduccion, cancelProduccion } from '../controllers/produccionController.js';
import { authenticateToken } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = express.Router();

router.use(authenticateToken);

// All production endpoints restricted to production-authorized roles
const PRODUCCION_ROLES = ['propietario', 'admin_sistema', 'jefe_produccion'];

router.get('/', roleGuard(PRODUCCION_ROLES), getProducciones);
router.post('/', roleGuard(PRODUCCION_ROLES), createProduccion);
router.post('/:id/cancel', roleGuard(PRODUCCION_ROLES), cancelProduccion);

export default router;
