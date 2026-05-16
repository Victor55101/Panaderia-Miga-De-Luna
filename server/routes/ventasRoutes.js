import { Router } from 'express';
import { crearVenta, getVentas, getVenta, cancelarVenta, getProductosDisponibles, getVendedores } from '../controllers/ventasController.js';
import { authenticateToken } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = Router();

// All ventas routes require authentication
router.use(authenticateToken);

// Helpers para el formulario de venta
router.get('/productos-disponibles/:sucursalId', getProductosDisponibles);
router.get('/vendedores', roleGuard(['propietario', 'admin_sistema', 'gerente_sucursal']), getVendedores);

// CRUD de ventas
router.get('/', getVentas);
router.get('/:id', getVenta);

// Crear venta - solo vendedores pueden operar caja
router.post('/', roleGuard(['vendedor']), crearVenta);

// Cancelar venta - gerentes (su sucursal), admins y propietario
router.patch('/:id/cancelar', roleGuard(['propietario', 'admin_sistema', 'gerente_sucursal']), cancelarVenta);

export default router;
