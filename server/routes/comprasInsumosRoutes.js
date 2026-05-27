import express from 'express';
import {
  getAllComprasInsumos,
  getCompraInsumoById,
  createCompraInsumo
} from '../controllers/comprasInsumosController.js';
import { authenticateToken } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = express.Router();

router.use(authenticateToken);

const WRITE_ROLES = ['propietario', 'admin_sistema', 'jefe_produccion'];
const READ_ROLES = ['propietario', 'admin_sistema', 'jefe_produccion', 'gerente_sucursal'];

router.get('/', roleGuard(READ_ROLES), getAllComprasInsumos);
router.get('/:id', roleGuard(READ_ROLES), getCompraInsumoById);
router.post('/', roleGuard(WRITE_ROLES), createCompraInsumo);

export default router;
