import { Router } from 'express';
import { getAsistencias, registrarEntrada, registrarSalida, registrarManual, getEmpleadosPresentes } from '../controllers/asistenciaController.js';
import { authenticateToken } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = Router();
router.use(authenticateToken);

// All authenticated users can view attendance (filtered by role in controller)
router.get('/', getAsistencias);
router.get('/presentes', getEmpleadosPresentes);

// Any employee can register their own entry/exit
router.post('/entrada', registrarEntrada);
router.post('/salida', registrarSalida);

// Manual registration only for authorized roles
router.post('/manual', roleGuard(['propietario', 'admin_sistema', 'recursos_humanos', 'gerente_sucursal']), registrarManual);

export default router;
