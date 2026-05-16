import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const pageTitles = {
  '/': 'Dashboard', '/ventas': 'Ventas', '/inventario': 'Inventario', '/produccion': 'Producción',
  '/traslados': 'Traslados', '/sucursales': 'Sucursales', '/productos': 'Productos',
  '/producto-estrella': 'Producto Estrella', '/personal': 'Empleados', '/asistencia': 'Asistencia',
  '/horas-extra': 'Horas Extra', '/nomina': 'Nómina', '/reportes': 'Reportes', '/roles': 'Roles', '/perfil': 'Mi Perfil',
};

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const pageTitle = pageTitles[location.pathname] || 'Miga de Luna';

  function handleToggle() {
    if (window.innerWidth <= 768) {
      setMobileOpen(!mobileOpen);
    } else {
      setCollapsed(!collapsed);
    }
  }

  return (
    <div className="app-layout">
      <Sidebar collapsed={collapsed} onToggle={handleToggle} mobileOpen={mobileOpen} />
      {mobileOpen && <div className="modal-overlay" onClick={() => setMobileOpen(false)} style={{ zIndex: 99 }} />}
      <div className={`main-content ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <Header pageTitle={pageTitle} onToggleSidebar={handleToggle} />
        <div className="page-content fade-in">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
