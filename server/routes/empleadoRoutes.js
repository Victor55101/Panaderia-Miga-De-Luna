import express from 'express';
import { 
  getAllEmpleados, 
  getEmpleadoById, 
  createEmpleado, 
  updateEmpleado, 
  deleteEmpleado,
  getMetadata,
  getRepartidores
} from '../controllers/empleadoController.js';
import { authenticateToken } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = express.Router();

router.use(authenticateToken);

// Solo personal administrativo puede gestionar empleados
router.get('/repartidores', roleGuard(['propietario', 'admin_sistema', 'recursos_humanos', 'gerente_sucursal', 'jefe_produccion']), getRepartidores);
router.get('/', roleGuard(['propietario', 'admin_sistema', 'recursos_humanos', 'gerente_sucursal']), getAllEmpleados);
router.get('/metadata', roleGuard(['propietario', 'admin_sistema', 'recursos_humanos']), getMetadata);
router.get('/:id', roleGuard(['propietario', 'admin_sistema', 'recursos_humanos', 'gerente_sucursal']), getEmpleadoById);

router.post('/', roleGuard(['propietario', 'admin_sistema', 'recursos_humanos']), createEmpleado);
router.put('/:id', roleGuard(['propietario', 'admin_sistema', 'recursos_humanos']), updateEmpleado);
router.delete('/:id', roleGuard(['propietario', 'admin_sistema', 'recursos_humanos']), deleteEmpleado);

export default router;
