import { Router } from 'express';
import { loginUser, getUserProfile } from '../services/authService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    const result = await loginUser(username, password);
    res.json(result);
  } catch (err) { next(err); }
});

router.get('/profile', authenticateToken, async (req, res, next) => {
  try {
    const profile = await getUserProfile(req.user.id);
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });
    res.json(profile);
  } catch (err) { next(err); }
});

export default router;
