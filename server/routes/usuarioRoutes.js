import express from 'express';
import { 
  getAllUsuarios, 
  createUsuario, 
  updateUsuario, 
  deleteUsuario,
  getAvailableEmployees,
  getRoles
} from '../controllers/usuarioController.js';
import { authenticateToken } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = express.Router();

// All user routes restricted to Proprietario and Admin Sistema
router.use(authenticateToken);
router.use(roleGuard(['propietario', 'admin_sistema']));

router.get('/', getAllUsuarios);
router.get('/disponibles', getAvailableEmployees);
router.get('/roles', getRoles);
router.post('/', createUsuario);
router.put('/:id', updateUsuario);
router.delete('/:id', deleteUsuario);

export default router;
