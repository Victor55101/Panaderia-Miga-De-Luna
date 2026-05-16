import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  Users, Search, Plus, Edit2, Trash2, 
  Shield, UserCheck, UserX, X, Check,
  AlertTriangle, Key, Mail, MapPin
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const Usuarios = () => {
  const { showToast } = useToast();
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ rol: 'all', estatus: 'all' });

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentUsuario, setCurrentUsuario] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    id_rol: '',
    id_empleado: '',
    activo: 1
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ search, ...filters }).toString();
      const [usersData, rolesData, empData] = await Promise.all([
        api.get(`/usuarios?${query}`),
        api.get('/roles'), // Use the new generic roles endpoint
        api.get('/usuarios/disponibles')
      ]);
      setUsuarios(usersData);
      setRoles(rolesData);
      setEmployees(empData);
    } catch (err) {
      console.error('Error fetching data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, filters]);

  const handleOpenModal = (usuario = null) => {
    if (usuario) {
      setCurrentUsuario(usuario);
      setFormData({
        username: usuario.username,
        password: '', 
        id_rol: usuario.id_rol,
        id_empleado: usuario.id_empleado || '',
        id_sucursal: usuario.id_sucursal || '',
        activo: usuario.activo
      });
    } else {
      setCurrentUsuario(null);
      setFormData({
        username: '',
        password: '',
        id_rol: roles.length > 0 ? roles[roles.length - 1].id : '', // Default to last (usually lower) role
        id_empleado: '',
        id_sucursal: '',
        activo: 1
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (currentUsuario) {
        await api.put(`/usuarios/${currentUsuario.id}`, formData);
      } else {
        if (!formData.password) {
          showToast('La contraseña es obligatoria para nuevos usuarios', 'warning');
          return;
        }
        await api.post('/usuarios', formData);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      showToast(err.message || 'Error al guardar usuario', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/usuarios/${currentUsuario.id}`);
      setIsDeleteModalOpen(false);
      fetchData();
    } catch (err) {
      showToast(err.message || 'Error al desactivar usuario', 'error');
    }
  };

  const getRoleBadgeClass = (rolId) => {
    if (rolId === 1) return 'badge badge-accent';
    if (rolId === 2) return 'badge badge-info';
    return 'badge badge-warning';
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Users size={26} style={{ color: 'var(--color-secondary)' }} />
            Usuarios del Sistema
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>Control de accesos, roles y seguridad</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={18} /> Nuevo Usuario
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 'var(--space-md)', alignItems: 'end' }}>
          <div className="form-group">
            <label className="form-label">Buscar</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)', pointerEvents: 'none' }} />
              <input className="form-input" style={{ paddingLeft: '2.5rem' }} placeholder="Username o nombre..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Rol</label>
            <select className="form-input" value={filters.rol} onChange={e => setFilters({ ...filters, rol: e.target.value })}>
              <option value="all">Todos los roles</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Estatus</label>
            <select className="form-input" value={filters.estatus} onChange={e => setFilters({ ...filters, estatus: e.target.value })}>
              <option value="all">Cualquiera</option>
              <option value="1">Activo</option>
              <option value="0">Inactivo</option>
            </select>
          </div>
          <button className="btn btn-outline" onClick={() => { setSearch(''); setFilters({ rol: 'all', estatus: 'all' }); }}>
            <X size={16} /> Limpiar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-container card" style={{ padding: 0 }}>
        {loading ? (
          <div className="spinner" />
        ) : usuarios.length === 0 ? (
          <div className="empty-state"><Users size={48} /><p>No se encontraron usuarios</p></div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Empleado Vinculado</th>
                  <th>Rol</th>
                  <th>Estatus</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,var(--color-secondary),var(--color-accent))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                          {u.username?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.username}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-light)' }}>ID: {String(u.id).padStart(4, '0')}</div>
                        </div>
                      </div>
                    </td>
                    <td>{u.empleado_nombre || <span style={{ color: 'var(--color-text-light)', fontStyle: 'italic' }}>Sin vincular</span>}</td>
                    <td><span className={getRoleBadgeClass(u.id_rol)}><Shield size={11} style={{ display: 'inline', marginRight: 4 }} />{u.rol_nombre || u.rol || '—'}</span></td>
                    <td>
                      {u.activo ? (
                        <span className="badge badge-success"><UserCheck size={11} style={{ display: 'inline', marginRight: 4 }} />Activo</span>
                      ) : (
                        <span className="badge badge-error"><UserX size={11} style={{ display: 'inline', marginRight: 4 }} />Inactivo</span>
                      )}
                    </td>
                    <td>
                      <div className="toolbar-actions">
                        <button className="btn-icon" onClick={() => handleOpenModal(u)} title="Editar"><Edit2 size={16} /></button>
                        {u.activo === 1 && (
                          <button className="btn-icon" style={{ color: 'var(--color-error)' }} onClick={() => { setCurrentUsuario(u); setIsDeleteModalOpen(true); }} title="Desactivar"><Trash2 size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2 className="card-title">{currentUsuario ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label">Username *</label>
                  <input className="form-input" required placeholder="nombre.apellido" value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">{currentUsuario ? 'Nueva Contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
                  <div style={{ position: 'relative' }}>
                    <Key size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)' }} />
                    <input className="form-input" style={{ paddingLeft: '2.5rem' }} type="password"
                      required={!currentUsuario} placeholder={currentUsuario ? '(sin cambios)' : 'Contraseña segura'}
                      value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Rol del Sistema *</label>
                  <select className="form-input" required value={formData.id_rol} onChange={e => setFormData({ ...formData, id_rol: e.target.value })}>
                    <option value="">Seleccionar rol...</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.nombre} – {r.descripcion}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Vincular a Empleado</label>
                  <select className="form-input" value={formData.id_empleado} onChange={e => setFormData({ ...formData, id_empleado: e.target.value })}>
                    <option value="">Sin vincular (usuario independiente)</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.nombre} {emp.apellido_paterno}</option>)}
                  </select>
                </div>
                {currentUsuario && (
                  <div className="form-group">
                    <label className="form-label">Estatus</label>
                    <select className="form-input" value={formData.activo} onChange={e => setFormData({ ...formData, activo: parseInt(e.target.value) })}>
                      <option value={1}>Activo</option>
                      <option value={0}>Inactivo</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{currentUsuario ? 'Guardar Cambios' : 'Crear Usuario'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate confirm */}
      {isDeleteModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 420, textAlign: 'center' }}>
            <div className="modal-body">
              <AlertTriangle size={48} style={{ color: 'var(--color-warning)', margin: '0 auto var(--space-md)' }} />
              <h3 className="card-title" style={{ marginBottom: 'var(--space-sm)' }}>¿Desactivar usuario?</h3>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
                El usuario <strong>{currentUsuario?.username}</strong> perderá acceso al sistema.
              </p>
              <div className="modal-footer" style={{ padding: 0, borderTop: 'none' }}>
                <button className="btn btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancelar</button>
                <button className="btn btn-danger" onClick={handleDelete}>Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Usuarios;
