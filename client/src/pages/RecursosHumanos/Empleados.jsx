import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
  Plus, Search, Edit2, Trash2, Filter, 
  User, Phone, Mail, MapPin, Briefcase, 
  Calendar, DollarSign, ChevronLeft, ChevronRight,
  MoreVertical, X, Check, AlertCircle, Building2,
  BadgeCheck, UserMinus, ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';

const Empleados = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination & Filters
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    id_sucursal: 'all',
    id_puesto: 'all',
    id_departamento: 'all',
    estatus: 'all'
  });
  
  // Catalogs
  const [catalogs, setCatalogs] = useState({
    sucursales: [],
    puestos: [],
    departamentos: []
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [currentEmpleado, setCurrentEmpleado] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido_paterno: '',
    apellido_materno: '',
    rfc: '',
    telefono: '',
    email: '',
    id_sucursal: '',
    id_puesto: '',
    fecha_contratacion: new Date().toISOString().split('T')[0],
    salario_base: '',
    tipo_personal: 'ventas',
    estatus: 'activo'
  });

  const fetchEmpleados = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ 
        page, 
        limit, 
        search, 
        ...filters 
      }).toString();
      const response = await api.get(`/empleados?${query}`);
      setEmpleados(response.data);
      setTotal(response.pagination.total);
      setError(null);
    } catch (err) {
      setError('Error al cargar empleados');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogs = async () => {
    try {
      const [metaResponse, sucursalesRes] = await Promise.all([
        api.get('/empleados/metadata'),
        api.get('/sucursales?limit=100')
      ]);
      // /sucursales returns { data: [...], total: N }
      const sucArray = Array.isArray(sucursalesRes) ? sucursalesRes : (sucursalesRes.data || []);
      setCatalogs({
        ...metaResponse,
        sucursales: sucArray.filter(s => s.activo === 1)
      });
    } catch (err) {
      console.error('Error al cargar catálogos', err);
    }
  };

  useEffect(() => {
    fetchEmpleados();
  }, [page, search, filters]);

  useEffect(() => {
    fetchCatalogs();
  }, []);

  const handleOpenModal = (empleado = null) => {
    if (empleado) {
      setCurrentEmpleado(empleado);
      setFormData({
        nombre: empleado.nombre || '',
        apellido_paterno: empleado.apellido_paterno || '',
        apellido_materno: empleado.apellido_materno || '',
        rfc: empleado.rfc || '',
        telefono: empleado.telefono || '',
        email: empleado.email || '',
        id_sucursal: empleado.id_sucursal || '',
        id_puesto: empleado.id_puesto || '',
        fecha_contratacion: empleado.fecha_contratacion ? empleado.fecha_contratacion.split('T')[0] : new Date().toISOString().split('T')[0],
        salario_base: empleado.salario_base || '',
        tipo_personal: empleado.tipo_personal || 'ventas',
        estatus: empleado.estatus || 'activo'
      });
    } else {
      setCurrentEmpleado(null);
      setFormData({
        nombre: '',
        apellido_paterno: '',
        apellido_materno: '',
        rfc: '',
        telefono: '',
        email: '',
        id_sucursal: '',
        id_puesto: '',
        fecha_contratacion: new Date().toISOString().split('T')[0],
        salario_base: '',
        tipo_personal: 'ventas',
        estatus: 'activo'
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (currentEmpleado) {
        await api.put(`/empleados/${currentEmpleado.id}`, formData);
      } else {
        await api.post('/empleados', formData);
      }
      
      setIsModalOpen(false);
      fetchEmpleados();
    } catch (err) {
      showToast(err.message || 'Error al guardar empleado', 'error');
    }
  };

  const handleDeactivate = async () => {
    try {
      await api.delete(`/empleados/${currentEmpleado.id}`);
      setIsDeleteModalOpen(false);
      fetchEmpleados();
    } catch (err) {
      showToast(err.message || 'Error al dar de baja', 'error');
    }
  };

  const totalPages = Math.ceil(total / limit);

  const estatusBadge = (est) => {
    if (est === 'activo') return 'badge badge-success';
    if (est === 'baja') return 'badge badge-error';
    return 'badge badge-warning';
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <User size={28} style={{ color: 'var(--color-secondary)' }} />
            Gestión de Personal
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: '4px' }}>Administra el capital humano de Miga de Luna</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={18} /> Nuevo Empleado
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 'var(--space-md)', alignItems: 'end' }}>
          <div className="search-bar form-group">
            <label className="form-label">Buscar</label>
            <div style={{ position: 'relative' }}>
              <Search className="search-icon" size={18} />
              <input type="text" className="form-input" style={{ paddingLeft: '2.5rem' }}
                placeholder="Nombre, RFC o Teléfono..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Sucursal</label>
            <select className="form-input" value={filters.id_sucursal}
              onChange={e => setFilters({ ...filters, id_sucursal: e.target.value })}>
              <option value="all">Todas</option>
              {catalogs.sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Estatus</label>
            <select className="form-input" value={filters.estatus}
              onChange={e => setFilters({ ...filters, estatus: e.target.value })}>
              <option value="all">Cualquiera</option>
              <option value="activo">Activo</option>
              <option value="baja">Baja</option>
              <option value="suspendido">Suspendido</option>
            </select>
          </div>
          <button className="btn btn-outline" onClick={() => { setSearch(''); setFilters({ id_sucursal: 'all', id_puesto: 'all', id_departamento: 'all', estatus: 'all' }); }}>
            <X size={16} /> Limpiar
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="table-container card" style={{ padding: 0 }}>
        {loading ? (
          <div className="spinner" />
        ) : error ? (
          <div className="alert alert-error" style={{ margin: 'var(--space-lg)' }}><AlertCircle size={18} />{error}</div>
        ) : empleados.length === 0 ? (
          <div className="empty-state"><User size={48} /><p>No se encontraron empleados</p></div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>RFC / Contacto</th>
                  <th>Puesto</th>
                  <th>Sucursal</th>
                  <th>Estatus</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {empleados.map(emp => (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-secondary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0 }}>
                          {emp.nombre?.[0]}{emp.apellido_paterno?.[0]}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{emp.nombre} {emp.apellido_paterno}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-light)' }}>{emp.tipo_personal}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>{emp.rfc || 'SIN RFC'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-light)' }}><Phone size={11} style={{ display: 'inline', marginRight: 4 }} />{emp.telefono}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{emp.puesto_nombre}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-light)' }}>{emp.departamento_nombre}</div>
                    </td>
                    <td>{emp.sucursal_nombre || 'Corporativo'}</td>
                    <td><span className={estatusBadge(emp.estatus)}>{emp.estatus}</span></td>
                    <td>
                      <div className="toolbar-actions">
                        <button className="btn-icon" onClick={() => handleOpenModal(emp)} title="Editar"><Edit2 size={16} /></button>
                        {emp.estatus === 'activo' && (
                          <button className="btn-icon" style={{ color: 'var(--color-error)' }} onClick={() => { setCurrentEmpleado(emp); setIsDeleteModalOpen(true); }} title="Dar de baja"><UserMinus size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-md) var(--space-lg)', borderTop: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Página {page} de {totalPages} · {total} empleados</span>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /> Anterior</button>
                <button className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Siguiente <ChevronRight size={16} /></button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Form Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setIsModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h2 className="card-title">{currentEmpleado ? 'Editar Empleado' : 'Nuevo Empleado'}</h2>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label">Nombre(s) *</label>
                  <input className="form-input" required value={formData.nombre} onChange={e => setFormData({ ...formData, nombre: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Apellido Paterno *</label>
                  <input className="form-input" required value={formData.apellido_paterno} onChange={e => setFormData({ ...formData, apellido_paterno: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Apellido Materno</label>
                  <input className="form-input" value={formData.apellido_materno} onChange={e => setFormData({ ...formData, apellido_materno: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">RFC *</label>
                  <input className="form-input" required placeholder="ABCD900101XXX" style={{ fontFamily: 'monospace', textTransform: 'uppercase' }} value={formData.rfc} onChange={e => setFormData({ ...formData, rfc: e.target.value.toUpperCase() })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Teléfono *</label>
                  <input className="form-input" required type="tel" value={formData.telefono} onChange={e => setFormData({ ...formData, telefono: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Correo Electrónico</label>
                  <input className="form-input" type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Sucursal</label>
                  <select className="form-input" value={formData.id_sucursal} onChange={e => setFormData({ ...formData, id_sucursal: e.target.value })}>
                    <option value="">Corporativo / Planta</option>
                    {catalogs.sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Puesto *</label>
                  <select className="form-input" required value={formData.id_puesto} onChange={e => { const p = catalogs.puestos?.find(p => p.id === parseInt(e.target.value)); setFormData({ ...formData, id_puesto: e.target.value, salario_base: p ? p.salario_base : formData.salario_base }); }}>
                    <option value="">Seleccionar...</option>
                    {catalogs.puestos?.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tipo Personal *</label>
                  <select className="form-input" required value={formData.tipo_personal} onChange={e => setFormData({ ...formData, tipo_personal: e.target.value })}>
                    <option value="ventas">Ventas</option>
                    <option value="produccion">Producción</option>
                    <option value="distribucion">Distribución</option>
                    <option value="administracion">Administración</option>
                    <option value="recursos_humanos">Recursos Humanos</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de Contratación</label>
                  <input className="form-input" type="date" value={formData.fecha_contratacion} onChange={e => setFormData({ ...formData, fecha_contratacion: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Salario Base</label>
                  <input className="form-input" type="number" step="0.01" value={formData.salario_base} onChange={e => setFormData({ ...formData, salario_base: e.target.value })} />
                </div>
                {currentEmpleado && (
                  <div className="form-group">
                    <label className="form-label">Estatus</label>
                    <select className="form-input" value={formData.estatus} onChange={e => setFormData({ ...formData, estatus: e.target.value })}>
                      <option value="activo">Activo</option>
                      <option value="baja">Baja</option>
                      <option value="suspendido">Suspendido</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">{currentEmpleado ? 'Guardar Cambios' : 'Crear Empleado'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {isDeleteModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 420, textAlign: 'center' }}>
            <div className="modal-body">
              <AlertCircle size={48} style={{ color: 'var(--color-error)', margin: '0 auto var(--space-md)' }} />
              <h3 className="card-title" style={{ marginBottom: 'var(--space-sm)' }}>¿Dar de baja?</h3>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-lg)' }}>
                Se dará de baja a <strong>{currentEmpleado?.nombre} {currentEmpleado?.apellido_paterno}</strong>. El registro permanecerá para historial.
              </p>
              <div className="modal-footer" style={{ padding: 0, borderTop: 'none' }}>
                <button className="btn btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancelar</button>
                <button className="btn btn-danger" onClick={handleDeactivate}>Confirmar Baja</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Empleados;

