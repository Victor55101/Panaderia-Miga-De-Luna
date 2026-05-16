import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Search, Edit2, Trash2, Store, MapPin, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import Modal from '../../components/Common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';

export default function Sucursales() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const [sucursales, setSucursales] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  
  const canManage = ['propietario', 'admin_sistema'].includes(user?.rol);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSucursal, setEditingSucursal] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    tipo: 'expendio',
    direccion: '',
    telefono: '',
    distancia_planta_km: 0,
    capacidad_operativa: 0,
    fecha_apertura: new Date().toISOString().split('T')[0],
    activo: 1
  });

  useEffect(() => {
    fetchSucursales();
  }, [page, filterType]);

  async function fetchSucursales() {
    try {
      setLoading(true);
      const result = await api.getSucursales({ page, limit: 10, search, tipo: filterType });
      setSucursales(result.data);
      setTotal(result.total);
    } catch (err) {
      setError('Error al cargar las sucursales');
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchSucursales();
  };

  const handleOpenModal = (sucursal = null) => {
    if (sucursal) {
      setEditingSucursal(sucursal);
      setFormData({ ...sucursal });
    } else {
      setEditingSucursal(null);
      setFormData({
        nombre: '',
        tipo: 'expendio',
        direccion: '',
        telefono: '',
        distancia_planta_km: 0,
        capacidad_operativa: 0,
        fecha_apertura: new Date().toISOString().split('T')[0],
        activo: 1
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingSucursal) {
        await api.updateSucursal(editingSucursal.id, formData);
      } else {
        await api.createSucursal(formData);
      }
      setIsModalOpen(false);
      fetchSucursales();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    }
  };

  const handleDelete = async (id) => {
    const isConfirmed = await confirm({
      title: 'Desactivar Sucursal',
      message: '¿Está seguro de desactivar esta sucursal?',
      confirmText: 'Sí, desactivar',
      type: 'danger'
    });
    if (!isConfirmed) return;

    try {
      const res = await api.deleteSucursal(id);
      if (res.warning) {
        showToast(res.warning, 'warning');
      } else {
        showToast('Sucursal desactivada', 'success');
      }
      fetchSucursales();
    } catch (err) {
      setError(err.message || 'Error al desactivar');
    }
  };

  const filteredSucursales = sucursales.filter(s => {
    const matchesSearch = s.nombre.toLowerCase().includes(search.toLowerCase()) || 
                          s.direccion?.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'all' || s.tipo === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="page-container fade-in">
      <div className="toolbar">
        <div>
          <h1>Gestión de Sucursales</h1>
          <p className="text-secondary">Planta, expendios y locales comerciales</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={18} /> Nueva Sucursal
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="toolbar" style={{ marginBottom: 0, alignItems: 'center' }}>
          <form className="search-bar" style={{ flex: 1, minWidth: 0 }} onSubmit={handleSearch}>
            <Search className="search-icon" size={18} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Buscar por nombre o dirección..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </form>
          <div className="toolbar-actions" style={{ alignItems: 'center' }}>
            <select 
              className="form-input" 
              style={{ width: 'auto', minWidth: '160px' }}
              value={filterType}
              onChange={e => { setFilterType(e.target.value); setPage(1); }}
            >
              <option value="all">Todos los tipos</option>
              <option value="planta">Planta de Producción</option>
              <option value="expendio">Expendio</option>
              <option value="plaza">Plaza Comercial</option>
            </select>
            <div className="badge badge-accent" style={{ whiteSpace: 'nowrap' }}>
              {total} Registros
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

      <div className="table-container card" style={{ padding: 0 }}>
        {loading ? (
          <div className="spinner"></div>
        ) : sucursales.length > 0 ? (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Sucursal</th>
                  <th>Tipo</th>
                  <th>Ubicación</th>
                  <th>Capacidad</th>
                  <th>Estatus</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {sucursales.map(sucursal => (
                  <tr key={sucursal.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="stat-icon" style={{ 
                          background: 'var(--color-base)', 
                          color: 'var(--color-accent)',
                          width: '32px', height: '32px', borderRadius: '8px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <Store size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{sucursal.nombre}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-light)' }}>
                            ID: {String(sucursal.id).padStart(3, '0')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-info">{sucursal.tipo}</span>
                    </td>
                    <td>
                      <div style={{ fontSize: '13px' }}><MapPin size={12} inline /> {sucursal.direccion}</div>
                      {sucursal.tipo !== 'planta' && (
                        <div style={{ fontSize: '11px', color: 'var(--color-text-light)' }}>
                          Distancia: {sucursal.distancia_planta_km} km
                        </div>
                      )}
                    </td>
                    <td>{sucursal.capacidad_operativa} pax</td>
                    <td>
                      {sucursal.activo ? (
                        <span className="badge badge-success">Activa</span>
                      ) : (
                        <span className="badge badge-error">Inactiva</span>
                      )}
                    </td>
                    <td>
                      <div className="toolbar-actions">
                        {canManage && (
                          <button className="btn-icon" onClick={() => handleOpenModal(sucursal)}>
                            <Edit2 size={16} />
                          </button>
                        )}
                        {canManage && sucursal.activo === 1 && (
                          <button className="btn-icon" onClick={() => handleDelete(sucursal.id)} style={{ color: 'var(--color-error)' }}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            <div className="pagination" style={{ padding: 'var(--space-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-surface-alt)' }}>
              <span className="text-secondary" style={{ fontSize: '14px' }}>
                Mostrando {sucursales.length} de {total} resultados
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft size={16} /> Anterior
                </button>
                <button className="btn btn-secondary" disabled={page * 10 >= total} onClick={() => setPage(page + 1)}>
                  Siguiente <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <Store size={48} />
            <p>No se encontraron sucursales</p>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingSucursal ? 'Editar Sucursal' : 'Nueva Sucursal'}
      >
        <form onSubmit={handleSave} className="login-form" style={{ padding: 0 }}>
          <div className="form-group">
            <label className="form-label">Nombre de la Sucursal</label>
            <input 
              className="form-input" 
              required
              value={formData.nombre}
              onChange={e => setFormData({...formData, nombre: e.target.value})}
              placeholder="Ej. Sucursal Oriente"
            />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select 
                className="form-input"
                value={formData.tipo}
                onChange={e => setFormData({...formData, tipo: e.target.value})}
              >
                <option value="planta">Planta</option>
                <option value="expendio">Expendio</option>
                <option value="plaza">Plaza Comercial</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Estatus</label>
              <select 
                className="form-input"
                value={formData.activo}
                onChange={e => setFormData({...formData, activo: parseInt(e.target.value)})}
              >
                <option value={1}>Activa</option>
                <option value={0}>Inactiva</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Dirección Completa</label>
            <input 
              className="form-input" 
              required
              value={formData.direccion}
              onChange={e => setFormData({...formData, direccion: e.target.value})}
              placeholder="Calle, Número, Colonia"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">Distancia desde Planta (km)</label>
              <input 
                type="number" 
                step="0.1"
                className="form-input" 
                value={formData.distancia_planta_km}
                onChange={e => setFormData({...formData, distancia_planta_km: parseFloat(e.target.value)})}
                disabled={formData.tipo === 'planta'}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Capacidad Operativa</label>
              <input 
                type="number" 
                className="form-input" 
                value={formData.capacidad_operativa}
                onChange={e => setFormData({...formData, capacidad_operativa: parseInt(e.target.value)})}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">Teléfono</label>
              <input 
                className="form-input" 
                value={formData.telefono}
                onChange={e => setFormData({...formData, telefono: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de Apertura</label>
              <input 
                type="date"
                className="form-input" 
                value={formData.fecha_apertura}
                onChange={e => setFormData({...formData, fecha_apertura: e.target.value})}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ marginTop: 'var(--space-lg)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {editingSucursal ? 'Guardar Cambios' : 'Crear Sucursal'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
