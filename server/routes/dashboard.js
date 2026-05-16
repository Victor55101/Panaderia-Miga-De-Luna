import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { getDashboardStats } from '../services/dashboardService.js';

const router = Router();

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const stats = await getDashboardStats(req.user.rol, req.user.id_sucursal);
    res.json(stats);
  } catch (err) { next(err); }
});

export default router;
