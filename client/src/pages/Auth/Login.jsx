import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Eye, EyeOff, LogIn } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) { setError('Complete todos los campos'); return; }
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card slide-in">
        <div className="login-logo">
          <div className="logo-container">
            <img src="/logo.svg" alt="Miga de Luna Panadería & Repostería" />
          </div>
          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <h1 style={{ marginBottom: '0.25rem' }}>Miga de Luna</h1>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Sistema Administrativo
            </p>
          </div>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label className="form-label" htmlFor="username">Usuario</label>
            <input id="username" className="form-input" type="text" placeholder="Ingrese su usuario"
              value={username} onChange={e => setUsername(e.target.value)} autoFocus autoComplete="username" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Contraseña</label>
            <div style={{ position: 'relative' }}>
              <input id="password" className="form-input" type={showPass ? 'text' : 'password'}
                placeholder="Ingrese su contraseña" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password" style={{ paddingRight: '2.5rem' }} />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-light)', cursor: 'pointer' }}>
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner" style={{ width: 20, height: 20, margin: 0, borderWidth: 2 }} /> : <><LogIn size={18} /> Iniciar Sesión</>}
          </button>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-light)', textAlign: 'center', marginTop: 'var(--space-md)' }}>
            © 2026 Miga de Luna Panadería & Repostería
          </p>
        </form>
      </div>
    </div>
  );
}
