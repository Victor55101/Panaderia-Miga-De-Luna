import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'miga-de-luna-secret-key-2026';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Acceso no autorizado' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
}

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}
