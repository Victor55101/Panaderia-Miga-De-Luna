import express from 'express';
import { getAllRoles, getRoleById } from '../controllers/roleController.js';
import { authenticateToken } from '../middleware/auth.js';
import { roleGuard } from '../middleware/roleGuard.js';

const router = express.Router();

router.use(authenticateToken);
router.use(roleGuard(['propietario', 'admin_sistema']));

// Roles are a fixed RBAC matrix in the application. They are exposed as read-only
// for user assignment and for the permissions reference screen.
router.get('/', getAllRoles);
router.get('/:id', getRoleById);

export default router;
