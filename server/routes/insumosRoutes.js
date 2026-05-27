import express from 'express';
import {
  getAllInsumos,
  getInsumoById,
  createInsumo,
  updateInsumo,
  deleteInsumo,
  getInsumoMovimientos,
  getActivosInsumos
} from '../controllers/insumosController.js';
import { authenticateToken } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = express.Router();

router.use(authenticateToken);

const WRITE_ROLES = ['propietario', 'admin_sistema', 'jefe_produccion'];
const READ_ROLES = ['propietario', 'admin_sistema', 'jefe_produccion', 'gerente_sucursal'];

router.get('/', roleGuard(READ_ROLES), getAllInsumos);
router.get('/activos', roleGuard(READ_ROLES), getActivosInsumos);
router.get('/:id', roleGuard(READ_ROLES), getInsumoById);
router.get('/:id/movimientos', roleGuard(READ_ROLES), getInsumoMovimientos);

router.post('/', roleGuard(WRITE_ROLES), createInsumo);
router.put('/:id', roleGuard(WRITE_ROLES), updateInsumo);
router.delete('/:id', roleGuard(WRITE_ROLES), deleteInsumo);

export default router;
