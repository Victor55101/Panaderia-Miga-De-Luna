import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { runMigrations } from './config/database.js';
import { seedDemoData } from './seeds/seed.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import sucursalRoutes from './routes/sucursalRoutes.js';
import productoRoutes from './routes/productoRoutes.js';
import categoriaRoutes from './routes/categoriaRoutes.js';
import empleadoRoutes from './routes/empleadoRoutes.js';
import inventarioRoutes from './routes/inventarioRoutes.js';
import usuarioRoutes from './routes/usuarioRoutes.js';
import roleRoutes from './routes/roleRoutes.js';
import ventasRoutes from './routes/ventasRoutes.js';
import produccionRoutes from './routes/produccionRoutes.js';
import trasladosRoutes from './routes/trasladosRoutes.js';
import asistenciaRoutes from './routes/asistenciaRoutes.js';
import horasExtraRoutes from './routes/horasExtraRoutes.js';
import nominaRoutes from './routes/nominaRoutes.js';
import reportesRoutes from './routes/reportesRoutes.js';
import insumosRoutes from './routes/insumosRoutes.js';
import recetasRoutes from './routes/recetasRoutes.js';
import comprasInsumosRoutes from './routes/comprasInsumosRoutes.js';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - Allow frontend from env or default
app.use(cors({ 
  origin: process.env.FRONTEND_URL || 'http://localhost:5173', 
  credentials: true 
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sucursales', sucursalRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/empleados', empleadoRoutes);
app.use('/api/inventarios', inventarioRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/produccion', produccionRoutes);
app.use('/api/traslados', trasladosRoutes);
app.use('/api/asistencias', asistenciaRoutes);
app.use('/api/horas-extra', horasExtraRoutes);
app.use('/api/nominas', nominaRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/insumos', insumosRoutes);
app.use('/api/recetas', recetasRoutes);
app.use('/api/compras-insumos', comprasInsumosRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ 
  status: 'ok', 
  timestamp: new Date().toISOString(),
  env: process.env.NODE_ENV || 'development'
}));

// Error handler
app.use(errorHandler);

async function start() {
  // Always ensure migrations are up to date on start
  await runMigrations();
  // On a fresh deployment/volume, load demo data so the system is usable immediately.
  await seedDemoData();
  
  app.listen(PORT, () => {
    console.log(`🌙 Miga de Luna Server corriendo en puerto ${PORT}`);
    console.log(`📡 API URL: http://localhost:${PORT}/api`);
  });
}

start().catch(err => {
  console.error('❌ Error fatal al iniciar el servidor:', err);
  process.exit(1);
});
