import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

// Normalize user object to ensure consistent field names from both login and profile
function normalizeUser(data) {
  if (!data) return null;
  return {
    id: data.id,
    id_empleado: data.id_empleado || null,
    username: data.username,
    nombre: data.nombre || `${data.nombre || ''} ${data.apellido_paterno || ''}`.trim(),
    rol: data.rol,
    id_sucursal: data.id_sucursal || null,
    sucursal_nombre: data.sucursal_nombre || data.sucursal || null,
    puesto: data.puesto || null
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('mdl_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchProfile() {
    try {
      const res = await fetch('http://localhost:3001/api/auth/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) {
        // Only logout on 401 (invalid/expired token), NOT on 403
        logout();
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      const normalized = normalizeUser(data);
      setUser(normalized);
      localStorage.setItem('mdl_user', JSON.stringify(normalized));
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }

  async function login(username, password) {
    const res = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error de autenticación');
    localStorage.setItem('mdl_token', data.token);
    const normalized = normalizeUser(data.user);
    localStorage.setItem('mdl_user', JSON.stringify(normalized));
    setToken(data.token);
    setUser(normalized);
    return data;
  }

  function logout() {
    localStorage.removeItem('mdl_token');
    localStorage.removeItem('mdl_user');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
