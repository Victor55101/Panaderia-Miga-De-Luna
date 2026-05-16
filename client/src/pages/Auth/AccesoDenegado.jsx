import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export default function AccesoDenegado() {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
      <ShieldAlert size={64} style={{ color: 'var(--color-error)', marginBottom: 'var(--space-md)' }} />
      <h2 style={{ marginBottom: 'var(--space-sm)' }}>Acceso Denegado</h2>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)', maxWidth: '400px' }}>
        No tienes permiso para acceder a este módulo. Si crees que esto es un error, contacta a un administrador.
      </p>
      <button className="btn btn-primary" onClick={() => navigate('/')}>
        Volver al Dashboard
      </button>
    </div>
  );
}
