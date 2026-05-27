import express from 'express';
import {
  getRecetaByProducto,
  saveRecetaForProducto,
  deleteRecetaByProducto,
  getProductIdsConReceta
} from '../controllers/recetasController.js';
import { authenticateToken } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = express.Router();

router.use(authenticateToken);

const WRITE_ROLES = ['propietario', 'admin_sistema', 'jefe_produccion'];
const READ_ROLES = ['propietario', 'admin_sistema', 'jefe_produccion', 'gerente_sucursal'];

router.get('/productos-con-receta', roleGuard(READ_ROLES), getProductIdsConReceta);
router.get('/producto/:id_producto', roleGuard(READ_ROLES), getRecetaByProducto);
router.put('/producto/:id_producto', roleGuard(WRITE_ROLES), saveRecetaForProducto);
router.delete('/producto/:id_producto', roleGuard(WRITE_ROLES), deleteRecetaByProducto);

export default router;
