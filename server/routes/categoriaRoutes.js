import express from 'express';
import * as categoriaController from '../controllers/categoriaController.js';
import { authenticateToken } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', categoriaController.getAllCategorias);
router.post('/', roleGuard('propietario', 'admin_sistema'), categoriaController.createCategoria);
router.put('/:id', roleGuard('propietario', 'admin_sistema'), categoriaController.updateCategoria);
router.delete('/:id', roleGuard('propietario', 'admin_sistema'), categoriaController.deleteCategoria);

export default router;
