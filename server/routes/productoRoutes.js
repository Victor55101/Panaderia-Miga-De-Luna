import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';
import * as productoController from '../controllers/productoController.js';

const router = Router();

router.use(authenticateToken);

// Catálogos
router.get('/categorias', productoController.getCategorias);

// CRUD Productos
router.get('/activos', productoController.getActiveProductos);
router.get('/', productoController.getAllProductos);
router.get('/:id', productoController.getProductoById);
router.post('/', roleGuard('propietario', 'admin_sistema', 'jefe_produccion'), productoController.createProducto);
router.put('/:id', roleGuard('propietario', 'admin_sistema', 'jefe_produccion'), productoController.updateProducto);
router.delete('/:id', roleGuard('propietario', 'admin_sistema', 'jefe_produccion'), productoController.deleteProducto);

// Producto Estrella (Especificaciones)
router.get('/:id/especificaciones', productoController.getEspecificaciones);
router.get('/:id/especificaciones/historial', productoController.getHistorialEspecificaciones);
router.post('/:id/especificaciones', roleGuard('propietario', 'admin_sistema', 'jefe_produccion'), productoController.updateEspecificaciones);

export default router;
