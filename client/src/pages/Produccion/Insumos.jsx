import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';
import { 
  Package, Search, Filter, Settings, Activity, Plus, Edit, Trash, X, Save
} from 'lucide-react';

function Insumos() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Search and Filters
  const [search, setSearch] = useState('');
  const [stockStatus, setStockStatus] = useState('all');
  const [activoFilter, setActivoFilter] = useState('1'); // Active by default

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isMovModalOpen, setIsMovModalOpen] = useState(false);
  const [selectedInsumo, setSelectedInsumo] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [loadingMovs, setLoadingMovs] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    nombre: '',
    unidad_medida: '',
    costo_unitario: 0,
    stock_actual: 0,
    stock_minimo: 0,
    stock_maximo: 1000,
    activo: 1
  });

  const canWrite = ['propietario', 'admin_sistema', 'jefe_produccion'].includes(user?.rol);

  useEffect(() => {
    fetchInsumos();
  }, [search, stockStatus, activoFilter]);

  const fetchInsumos = async () => {
    try {
      setLoading(true);
      const params = {
        search,
        stockStatus,
        activo: activoFilter
      };
      const data = await api.getInsumos(params);
      setInsumos(Array.isArray(data) ? data : data.data || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Error al cargar los insumos');
      showToast(err.message || 'Error al cargar los insumos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setSelectedInsumo(null);
    setFormData({
      nombre: '',
      unidad_medida: '',
      costo_unitario: 0,
      stock_actual: 0,
      stock_minimo: 0,
      stock_maximo: 1000,
      activo: 1
    });
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (insumo) => {
    setSelectedInsumo(insumo);
    setFormData({
      nombre: insumo.nombre,
      unidad_medida: insumo.unidad_medida,
      costo_unitario: insumo.costo_unitario,
      stock_actual: insumo.stock_actual,
      stock_minimo: insumo.stock_minimo,
      stock_maximo: insumo.stock_maximo || 1000,
      activo: insumo.activo
    });
    setIsFormModalOpen(true);
  };

  const handleOpenMovimientos = async (insumo) => {
    setSelectedInsumo(insumo);
    setIsMovModalOpen(true);
    setLoadingMovs(true);
    try {
      const data = await api.getInsumoMovimientos(insumo.id, 50);
      setMovimientos(data);
    } catch (err) {
      showToast(err.message || 'Error al obtener movimientos', 'error');
    } finally {
      setLoadingMovs(false);
    }
  };

  const handleDelete = async (insumo) => {
    const isConfirmed = await confirm({
      title: 'Desactivar Insumo',
      message: `¿Está seguro de desactivar el insumo "${insumo.nombre}"? No se eliminará de recetas previas.`,
      confirmText: 'Desactivar',
      type: 'danger'
    });

    if (!isConfirmed) return;

    try {
      await api.deleteInsumo(insumo.id);
      showToast('Insumo desactivado correctamente', 'success');
      fetchInsumos();
    } catch (err) {
      showToast(err.message || 'Error al desactivar el insumo', 'error');
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    // Validaciones del Frontend
    if (!formData.nombre.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    if (!formData.unidad_medida.trim()) { showToast('La unidad de medida es obligatoria', 'error'); return; }
    
    const costo = parseFloat(formData.costo_unitario);
    if (isNaN(costo) || costo < 0) { showToast('El costo unitario no puede ser negativo', 'error'); return; }

    const stock = parseFloat(formData.stock_actual);
    if (isNaN(stock) || stock < 0) { showToast('El stock actual no puede ser negativo', 'error'); return; }

    const min = parseFloat(formData.stock_minimo);
    if (isNaN(min) || min < 0) { showToast('El stock mínimo no puede ser negativo', 'error'); return; }

    const max = parseFloat(formData.stock_maximo);
    if (isNaN(max) || max <= 0) { showToast('El stock máximo debe ser mayor a cero', 'error'); return; }

    if (min >= max) { showToast('El stock mínimo debe ser menor que el stock máximo', 'error'); return; }

    try {
      if (selectedInsumo) {
        await api.updateInsumo(selectedInsumo.id, {
          ...formData,
          costo_unitario: costo,
          stock_actual: stock,
          stock_minimo: min,
          stock_maximo: max
        });
        showToast('Insumo actualizado correctamente', 'success');
      } else {
        await api.createInsumo({
          ...formData,
          costo_unitario: costo,
          stock_actual: stock,
          stock_minimo: min,
          stock_maximo: max
        });
        showToast('Insumo creado correctamente', 'success');
      }
      setIsFormModalOpen(false);
      fetchInsumos();
    } catch (err) {
      showToast(err.message || 'Error al guardar el insumo', 'error');
    }
  };

  const getStockBadgeClass = (actual, min, max) => {
    if (actual <= 0) return 'badge-error';
    if (actual < min) return 'badge-warning';
    if (actual > max) return 'badge-info';
    return 'badge-success';
  };

  const getStockStatusLabel = (actual, min, max) => {
    if (actual <= 0) return 'AGOTADO';
    if (actual < min) return 'STOCK BAJO';
    if (actual > max) return 'SOBRESTOCK';
    return 'ÓPTIMO';
  };

  return (
    <div className="page-container fade-in">
      <div className="toolbar">
        <div>
          <h1>Catálogo de Insumos</h1>
          <p className="text-secondary">Gestión y control de stock de materia prima</p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={18} /> Registrar Insumo
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div className="search-bar" style={{ flex: 1 }}>
            <Search className="search-icon" size={18} />
            <input
              type="text"
              className="form-input"
              placeholder="Buscar insumos por nombre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="toolbar-actions">
            <select
              className="form-input"
              value={stockStatus}
              onChange={(e) => setStockStatus(e.target.value)}
            >
              <option value="all">Todos los estados de stock</option>
              <option value="agotado">Agotados</option>
              <option value="bajo">Stock Bajo</option>
              <option value="optimo">Óptimo</option>
              <option value="sobrestock">Sobrestock</option>
            </select>

            <select
              className="form-input"
              value={activoFilter}
              onChange={(e) => setActivoFilter(e.target.value)}
            >
              <option value="1">Activos</option>
              <option value="0">Inactivos</option>
              <option value="">Todos</option>
            </select>

            <button
              className="btn btn-secondary"
              onClick={() => { setSearch(''); setStockStatus('all'); setActivoFilter('1'); }}
              title="Limpiar filtros"
            >
              <Filter size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="table-container card" style={{ padding: 0 }}>
        {loading ? (
          <div className="spinner"></div>
        ) : insumos.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Insumo</th>
                <th>Unidad</th>
                <th>Costo Unitario</th>
                <th>Stock Actual</th>
                <th>Límites (Mín/Máx)</th>
                <th>Estado</th>
                <th>Estatus Registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {insumos.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="stat-icon" style={{
                        background: 'var(--color-base)',
                        color: 'var(--color-accent)',
                        width: '32px', height: '32px', borderRadius: '8px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <Package size={16} />
                      </div>
                      <div style={{ fontWeight: 600 }}>{item.nombre}</div>
                    </div>
                  </td>
                  <td>{item.unidad_medida}</td>
                  <td>${parseFloat(item.costo_unitario || 0).toFixed(2)}</td>
                  <td>
                    <span style={{ fontWeight: 'bold', fontSize: '15px' }}>
                      {parseFloat(item.stock_actual || 0)}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-light)' }}>
                      Mín: {item.stock_minimo} / Máx: {item.stock_maximo}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getStockBadgeClass(item.stock_actual, item.stock_minimo, item.stock_maximo)}`}>
                      {getStockStatusLabel(item.stock_actual, item.stock_minimo, item.stock_maximo)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${item.activo === 1 ? 'badge-success' : 'badge-danger'}`}>
                      {item.activo === 1 ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <div className="toolbar-actions">
                      <button
                        className="btn-icon"
                        title="Ver bitácora de movimientos"
                        onClick={() => handleOpenMovimientos(item)}
                      >
                        <Activity size={16} />
                      </button>
                      {canWrite && item.activo === 1 && (
                        <>
                          <button
                            className="btn-icon"
                            title="Editar insumo"
                            onClick={() => handleOpenEdit(item)}
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            className="btn-icon text-danger"
                            title="Desactivar insumo"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <Package size={48} />
            <p>No se encontraron insumos</p>
          </div>
        )}
      </div>

      {/* FORM MODAL */}
      {isFormModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2 className="card-title">
                {selectedInsumo ? 'Editar Insumo' : 'Registrar Insumo'}
              </h2>
              <button className="btn-icon" onClick={() => setIsFormModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleFormSubmit}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                  <label className="form-label">Nombre del Insumo *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="Ej. Harina de trigo extra"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  />
                </div>
                <div className="form-grid form-grid-2" style={{ marginBottom: 'var(--space-md)' }}>
                  <div className="form-group">
                    <label className="form-label">Unidad de Medida *</label>
                    <input
                      type="text"
                      required
                      className="form-input"
                      placeholder="Ej. kg, L, pz"
                      value={formData.unidad_medida}
                      onChange={(e) => setFormData({ ...formData, unidad_medida: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Costo Unitario ($) *</label>
                    <input
                      type="number"
                      required
                      step="0.01"
                      min="0"
                      className="form-input"
                      value={formData.costo_unitario}
                      onChange={(e) => setFormData({ ...formData, costo_unitario: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-grid form-grid-3" style={{ marginBottom: 'var(--space-md)' }}>
                  <div className="form-group">
                    <label className="form-label">Stock Actual *</label>
                    <input
                      type="number"
                      required
                      step="0.0001"
                      min="0"
                      className="form-input"
                      value={formData.stock_actual}
                      onChange={(e) => setFormData({ ...formData, stock_actual: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mínimo (Alerta) *</label>
                    <input
                      type="number"
                      required
                      step="0.0001"
                      min="0"
                      className="form-input"
                      value={formData.stock_minimo}
                      onChange={(e) => setFormData({ ...formData, stock_minimo: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Capacidad Máx. *</label>
                    <input
                      type="number"
                      required
                      step="0.0001"
                      min="0.0001"
                      className="form-input"
                      value={formData.stock_maximo}
                      onChange={(e) => setFormData({ ...formData, stock_maximo: e.target.value })}
                    />
                  </div>
                </div>

                {selectedInsumo && (
                  <div className="form-group">
                    <label className="form-label">Estatus del Registro</label>
                    <select
                      className="form-input"
                      value={formData.activo}
                      onChange={(e) => setFormData({ ...formData, activo: parseInt(e.target.value) })}
                    >
                      <option value="1">Activo</option>
                      <option value="0">Inactivo</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsFormModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <Save size={18} /> Guardar Insumo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOVIMIENTOS MODAL */}
      {isMovModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <h2 className="card-title">Bitácora: {selectedInsumo?.nombre}</h2>
              <button className="btn-icon" onClick={() => setIsMovModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {loadingMovs ? (
                <div className="spinner"></div>
              ) : movimientos.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Concepto / Tipo</th>
                      <th>Cantidad</th>
                      <th>Stock Anterior</th>
                      <th>Stock Nuevo</th>
                      <th>Usuario / Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movimientos.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <div style={{ fontSize: '13px' }}>
                            {new Date(m.created_at).toLocaleDateString('es-MX')}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-light)' }}>
                            {new Date(m.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${['compra', 'reverso_produccion', 'correccion'].includes(m.tipo_movimiento) ? 'badge-success' : 'badge-error'}`}>
                            {m.tipo_movimiento.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontWeight: 'bold',
                            color: m.cantidad >= 0 ? 'var(--color-success)' : 'var(--color-error)'
                          }}>
                            {m.cantidad >= 0 ? '+' : ''}{parseFloat(m.cantidad)}
                          </span>
                        </td>
                        <td>{parseFloat(m.stock_anterior)}</td>
                        <td>{parseFloat(m.stock_nuevo)}</td>
                        <td>
                          <div style={{ fontSize: '12px', fontWeight: 600 }}>{m.username}</div>
                          {m.referencia && (
                            <div style={{ fontSize: '10px', color: 'var(--color-text-light)' }}>
                              Ref: {m.referencia}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <Activity size={32} />
                  <p>No se registran movimientos para este insumo.</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsMovModalOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Insumos;
