import { useAuth } from '../../context/AuthContext';
import { Menu, Bell } from 'lucide-react';

const rolLabels = {
  propietario: 'Propietario', admin_sistema: 'Administrador', gerente_sucursal: 'Gerente de Sucursal',
  vendedor: 'Vendedor', jefe_produccion: 'Jefe de Producción', repartidor: 'Repartidor', recursos_humanos: 'Recursos Humanos'
};

export default function Header({ pageTitle, onToggleSidebar }) {
  const { user } = useAuth();
  const initials = user?.nombre ? user.nombre.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : '??';

  return (
    <header className="header">
      <div className="header-left">
        <button className="toggle-sidebar" onClick={onToggleSidebar}><Menu size={22} /></button>
        <h1 className="header-title">{pageTitle || 'Dashboard'}</h1>
      </div>
      <div className="header-right">
        <button className="btn-icon" title="Notificaciones"><Bell size={20} /></button>
        <div className="header-user">
          <div className="header-avatar">{initials}</div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{user?.nombre || 'Usuario'}</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)' }}>
              {rolLabels[user?.rol] || user?.rol} 
              {user?.sucursal_nombre ? ` • ${user.sucursal_nombre}` : (['propietario', 'admin_sistema'].includes(user?.rol) ? ' • Vista Global' : '')}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
