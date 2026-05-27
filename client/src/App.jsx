import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmDialogProvider } from './context/ConfirmDialogContext';
import AppLayout from './components/Layout/AppLayout';
import ErrorBoundary from './components/Common/ErrorBoundary';
import Login from './pages/Auth/Login';
import AccesoDenegado from './pages/Auth/AccesoDenegado';
import Dashboard from './pages/Dashboard/Dashboard';
import Sucursales from './pages/Catalogos/Sucursales';
import Productos from './pages/Catalogos/Productos';
import ProductoEstrella from './pages/Catalogos/ProductoEstrella';
import Categorias from './pages/Catalogos/Categorias';
import Empleados from './pages/RecursosHumanos/Empleados';
import Asistencia from './pages/RecursosHumanos/Asistencia';
import HorasExtra from './pages/RecursosHumanos/HorasExtra';
import Nomina from './pages/RecursosHumanos/Nomina';
import Usuarios from './pages/Configuracion/Usuarios';
import Roles from './pages/Configuracion/Roles';
import Inventarios from './pages/Inventarios/Inventarios';
import Ventas from './pages/Ventas/Ventas';
import Produccion from './pages/Produccion/Produccion';
import Insumos from './pages/Produccion/Insumos';
import Recetas from './pages/Produccion/Recetas';
import ComprasInsumos from './pages/Produccion/ComprasInsumos';
import Traslados from './pages/Traslados/Traslados';
import Reportes from './pages/Reportes/Reportes';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" style={{ marginTop: '40vh' }} />;
  return user ? children : <Navigate to="/login" replace />;
}

function RoleRoute({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" style={{ marginTop: '40vh' }} />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes('*') && !roles.includes(user.rol)) {
    return <AccesoDenegado />;
  }
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="spinner" style={{ marginTop: '40vh' }} />;
  return user ? <Navigate to="/" replace /> : children;
}

// Placeholder pages for future modules
function PlaceholderPage({ title }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
      <h3 style={{ marginBottom: 'var(--space-md)' }}>{title}</h3>
      <p style={{ color: 'var(--color-text-secondary)' }}>Este módulo se construirá en la siguiente fase.</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmDialogProvider>
            <Routes>
              <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
            <Route path="ventas" element={<ErrorBoundary><RoleRoute roles={['propietario', 'admin_sistema', 'gerente_sucursal', 'vendedor']}><Ventas /></RoleRoute></ErrorBoundary>} />
            <Route path="inventario" element={<ErrorBoundary><RoleRoute roles={['propietario', 'admin_sistema', 'gerente_sucursal', 'vendedor', 'jefe_produccion']}><Inventarios /></RoleRoute></ErrorBoundary>} />
            <Route path="produccion" element={<ErrorBoundary><RoleRoute roles={['propietario', 'admin_sistema', 'jefe_produccion']}><Produccion /></RoleRoute></ErrorBoundary>} />
            <Route path="insumos" element={<ErrorBoundary><RoleRoute roles={['propietario', 'admin_sistema', 'jefe_produccion', 'gerente_sucursal']}><Insumos /></RoleRoute></ErrorBoundary>} />
            <Route path="recetas" element={<ErrorBoundary><RoleRoute roles={['propietario', 'admin_sistema', 'jefe_produccion', 'gerente_sucursal']}><Recetas /></RoleRoute></ErrorBoundary>} />
            <Route path="compras-insumos" element={<ErrorBoundary><RoleRoute roles={['propietario', 'admin_sistema', 'jefe_produccion', 'gerente_sucursal']}><ComprasInsumos /></RoleRoute></ErrorBoundary>} />
            <Route path="traslados" element={<ErrorBoundary><RoleRoute roles={['propietario', 'admin_sistema', 'repartidor', 'gerente_sucursal', 'jefe_produccion']}><Traslados /></RoleRoute></ErrorBoundary>} />
            <Route path="sucursales" element={<ErrorBoundary><RoleRoute roles={['propietario', 'admin_sistema']}><Sucursales /></RoleRoute></ErrorBoundary>} />
            <Route path="productos" element={<ErrorBoundary><RoleRoute roles={['propietario', 'admin_sistema', 'jefe_produccion']}><Productos /></RoleRoute></ErrorBoundary>} />
            <Route path="categorias" element={<ErrorBoundary><RoleRoute roles={['propietario', 'admin_sistema']}><Categorias /></RoleRoute></ErrorBoundary>} />
            <Route path="producto-estrella" element={<ErrorBoundary><RoleRoute roles={['propietario', 'admin_sistema', 'jefe_produccion']}><ProductoEstrella /></RoleRoute></ErrorBoundary>} />
            <Route path="personal" element={<ErrorBoundary><RoleRoute roles={['propietario', 'admin_sistema', 'recursos_humanos']}><Empleados /></RoleRoute></ErrorBoundary>} />
            <Route path="asistencia" element={<ErrorBoundary><RoleRoute roles={['*']}><Asistencia /></RoleRoute></ErrorBoundary>} />
            <Route path="horas-extra" element={<ErrorBoundary><RoleRoute roles={['*']}><HorasExtra /></RoleRoute></ErrorBoundary>} />
            <Route path="nomina" element={<ErrorBoundary><RoleRoute roles={['propietario', 'admin_sistema', 'recursos_humanos']}><Nomina /></RoleRoute></ErrorBoundary>} />
            <Route path="reportes" element={<ErrorBoundary><RoleRoute roles={['propietario','admin_sistema','gerente_sucursal','jefe_produccion','recursos_humanos']}><Reportes /></RoleRoute></ErrorBoundary>} />
            <Route path="usuarios" element={<RoleRoute roles={['propietario', 'admin_sistema']}><Usuarios /></RoleRoute>} />
            <Route path="roles" element={<RoleRoute roles={['propietario', 'admin_sistema']}><Roles /></RoleRoute>} />
            <Route path="perfil" element={<PlaceholderPage title="Mi Perfil" />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ConfirmDialogProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
