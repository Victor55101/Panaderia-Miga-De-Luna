import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  LayoutDashboard, ShoppingCart, Package, Wheat, Truck, 
  Store, Star, Users, Clock, FileText, User, 
  ChevronLeft, ChevronRight, LogOut, Tag, Shield,
  ClipboardList, BookOpen, ShoppingBag
} from 'lucide-react';

const MENU_ITEMS = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['*'] },
  { 
    id: 'operaciones', 
    label: 'Operaciones', 
    type: 'section',
    items: [
      { id: 'ventas', icon: ShoppingCart, label: 'Ventas', path: '/ventas', roles: ['propietario', 'admin_sistema', 'gerente_sucursal', 'vendedor'] },
      { id: 'inventario', icon: Package, label: 'Inventario', path: '/inventario', roles: ['propietario', 'admin_sistema', 'gerente_sucursal', 'vendedor', 'jefe_produccion'] },
      { id: 'produccion', icon: Wheat, label: 'Producción', path: '/produccion', roles: ['propietario', 'admin_sistema', 'jefe_produccion'] },
      { id: 'insumos', icon: ClipboardList, label: 'Insumos', path: '/insumos', roles: ['propietario', 'admin_sistema', 'jefe_produccion', 'gerente_sucursal'] },
      { id: 'recetas', icon: BookOpen, label: 'Recetas', path: '/recetas', roles: ['propietario', 'admin_sistema', 'jefe_produccion', 'gerente_sucursal'] },
      { id: 'compras-insumos', icon: ShoppingBag, label: 'Compras Insumos', path: '/compras-insumos', roles: ['propietario', 'admin_sistema', 'jefe_produccion', 'gerente_sucursal'] },
      { id: 'traslados', icon: Truck, label: 'Traslados', path: '/traslados', roles: ['propietario', 'admin_sistema', 'repartidor', 'gerente_sucursal', 'jefe_produccion'] },
    ]
  },
  { 
    id: 'catalogos', 
    label: 'Catálogos', 
    type: 'section',
    items: [
      { id: 'sucursales', icon: Store, label: 'Sucursales', path: '/sucursales', roles: ['propietario', 'admin_sistema'] },
      { id: 'categorias', icon: Tag, label: 'Categorías', path: '/categorias', roles: ['propietario', 'admin_sistema'] },
      { id: 'productos', icon: Package, label: 'Productos', path: '/productos', roles: ['propietario', 'admin_sistema', 'jefe_produccion'] },
      { id: 'producto-estrella', icon: Star, label: 'Producto Estrella', path: '/producto-estrella', roles: ['propietario', 'admin_sistema', 'jefe_produccion'] },
    ]
  },
  { 
    id: 'personal', 
    label: 'Personal', 
    type: 'section',
    items: [
      { id: 'empleados', icon: Users, label: 'Empleados', path: '/personal', roles: ['propietario', 'admin_sistema', 'recursos_humanos'] },
      { id: 'asistencia', icon: Clock, label: 'Asistencia', path: '/asistencia', roles: ['*'] },
      { id: 'horas-extra', icon: FileText, label: 'Horas Extra', path: '/horas-extra', roles: ['*'] },
      { id: 'nomina', icon: FileText, label: 'Nómina', path: '/nomina', roles: ['propietario', 'admin_sistema', 'recursos_humanos'] },
    ]
  },
  { 
    id: 'sistema', 
    label: 'Sistema', 
    type: 'section',
    items: [
      { id: 'reportes', icon: FileText, label: 'Reportes', path: '/reportes', roles: ['propietario', 'admin_sistema', 'gerente_sucursal', 'jefe_produccion', 'recursos_humanos'] },
      { id: 'usuarios', icon: User, label: 'Usuarios', path: '/usuarios', roles: ['propietario', 'admin_sistema'] },
      { id: 'roles', icon: Shield, label: 'Roles', path: '/roles', roles: ['propietario', 'admin_sistema'] },
    ]
  }
];

export default function Sidebar({ collapsed, onToggle, mobileOpen }) {
  const { user, logout } = useAuth();

  const hasAccess = (item) => {
    if (!item.roles || item.roles.includes('*')) return true;
    return item.roles.includes(user?.rol);
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-logo">
        {!collapsed && <img src="/logo.svg" alt="Miga de Luna" />}
        {collapsed && <img src="/logo.svg" alt="Miga de Luna" style={{ width: '32px' }} />}
      </div>

      <nav className="sidebar-nav">
        {MENU_ITEMS.map(section => {
          if (section.type === 'section') {
            const filteredItems = section.items.filter(hasAccess);
            if (filteredItems.length === 0) return null;
            return (
              <div key={section.id} className="nav-section">
                <div className="nav-section-title">{section.label}</div>
                {filteredItems.map(item => (
                  <NavLink key={item.id} to={item.path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          }
          if (hasAccess(section)) {
            return (
              <NavLink key={section.id} to={section.path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <section.icon size={20} />
                <span>{section.label}</span>
              </NavLink>
            );
          }
          return null;
        })}
      </nav>

      <div className="sidebar-footer">
        <button className="nav-item" style={{ width: '100%', border: 'none', background: 'none' }} onClick={onToggle}>
          {collapsed ? <ChevronRight size={20} /> : <><ChevronLeft size={20} /> <span>Colapsar</span></>}
        </button>
        <button className="nav-item" style={{ width: '100%', border: 'none', background: 'none', marginTop: '4px' }} onClick={logout}>
          <LogOut size={20} />
          {!collapsed && <span>Cerrar Sesión</span>}
        </button>
      </div>
    </aside>
  );
}
