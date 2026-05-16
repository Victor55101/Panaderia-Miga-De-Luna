import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';
import { 
  Package, Search, Filter, ArrowUpRight, ArrowDownLeft, 
  History, AlertTriangle, ChevronRight, LayoutGrid, 
  List, Store, Settings, MoreVertical, RefreshCw,
  Plus, Minus, Info, X, Check, Save
} from 'lucide-react';

const Inventarios = () => {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const isAdmin = ['propietario', 'admin_sistema'].includes(user?.rol);
  const canWrite = ['propietario', 'admin_sistema', 'gerente_sucursal', 'jefe_produccion'].includes(user?.rol);
  const isRestricted = ['gerente_sucursal', 'jefe_produccion'].includes(user?.rol);

  const [inventario, setInventario] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('grid');
  const [activeTab, setActiveTab] = useState('stock'); // 'stock' or 'history'
  
  // Filters
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    sucursalId: 'all',
    stockStatus: 'all'
  });

  // Modals
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isLimitsModalOpen, setIsLimitsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalProductos, setModalProductos] = useState([]);
  const [loadingModalProductos, setLoadingModalProductos] = useState(false);

  // Helper: default movement type based on role
  const getDefaultMovementType = useCallback(() => {
    return isAdmin ? 'entrada' : 'ajuste';
  }, [isAdmin]);

  // Helper: default sucursal based on role
  const getDefaultSucursal = useCallback(() => {
    return isRestricted && user?.id_sucursal ? String(user.id_sucursal) : '';
  }, [isRestricted, user?.id_sucursal]);

  const [movementData, setMovementData] = useState({
    id_producto: '',
    id_sucursal: getDefaultSucursal(),
    tipo_movimiento: getDefaultMovementType(),
    cantidad: 1,
    referencia: ''
  });
  const [limitsData, setLimitsData] = useState({
    minimo: 0,
    maximo: 0
  });

  // Point 1: Use getSucursalesSelect() instead of api.get('/sucursales')
  const fetchData = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ search, ...filters }).toString();
      const [invData, sucData] = await Promise.all([
        api.get(`/inventarios?${query}`),
        api.getSucursalesSelect()
      ]);
      setInventario(Array.isArray(invData) ? invData : invData.data || []);
      setSucursales(Array.isArray(sucData) ? sucData : sucData.data || []);
      
      if (activeTab === 'history') {
        const histData = await api.get('/inventarios/historial');
        setHistorial(Array.isArray(histData) ? histData : histData.data || []);
      }
    } catch (err) {
      console.error('Error fetching inventory', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [search, filters, activeTab]);

  // Fetch products for the modal based on sucursal + tipo_movimiento
  const fetchModalProductos = useCallback(async (sucursalId, tipoMovimiento) => {
    if (!sucursalId) {
      setModalProductos([]);
      return;
    }
    setLoadingModalProductos(true);
    try {
      const data = await api.getProductosMovimiento(sucursalId, tipoMovimiento || 'entrada');
      setModalProductos(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      console.error('Error fetching modal products', err);
      setModalProductos([]);
      showToast(err?.response?.data?.error || err.message || 'Error al cargar productos', 'error');
    } finally {
      setLoadingModalProductos(false);
    }
  }, [showToast]);

  // Point 9: Frontend validation before submit
  const handleMovementSubmit = async (e) => {
    e.preventDefault();
    
    const cantidad = Number(movementData.cantidad);
    if (isNaN(cantidad) || cantidad === 0) {
      showToast('La cantidad debe ser un número distinto de cero', 'error');
      return;
    }
    if (!movementData.id_sucursal) {
      showToast('Debe seleccionar una sucursal', 'error');
      return;
    }
    if (!movementData.id_producto) {
      showToast('Debe seleccionar un producto', 'error');
      return;
    }
    if (isRestricted && (!movementData.referencia || movementData.referencia.trim() === '')) {
      showToast('El motivo es obligatorio para su rol', 'error');
      return;
    }

    try {
      await api.post('/inventarios/movimiento', {
        ...movementData,
        cantidad
      });
      setIsMovementModalOpen(false);
      fetchData();
      showToast('Movimiento registrado correctamente', 'success');
    } catch (err) {
      showToast(err.message || 'Error al registrar movimiento', 'error');
    }
  };

  const handleLimitsSubmit = async (e) => {
    e.preventDefault();
    const min = parseInt(limitsData.minimo) || 0;
    const max = parseInt(limitsData.maximo) || 0;
    if (min < 0) { showToast('El stock mínimo no puede ser negativo', 'error'); return; }
    if (max <= 0) { showToast('La capacidad máxima debe ser mayor que cero', 'error'); return; }
    if (min >= max) { showToast('El stock mínimo debe ser menor que la capacidad máxima', 'error'); return; }
    try {
      await api.patch(`/inventarios/${selectedItem.id}/limites`, { minimo: min, maximo: max });
      setIsLimitsModalOpen(false);
      fetchData();
      showToast('Límites actualizados correctamente', 'success');
    } catch (err) {
      showToast(err.message || 'Error al actualizar límites', 'error');
    }
  };

  // Point 2 & 3: openMovementModal sets role-aware defaults
  const openMovementModal = (item = null) => {
    const defaultTipo = getDefaultMovementType();
    const defaultSucursal = getDefaultSucursal();

    let newData;
    if (item) {
      const sucId = isRestricted ? defaultSucursal : String(item.id_sucursal);
      newData = {
        id_producto: String(item.id_producto),
        id_sucursal: sucId,
        tipo_movimiento: defaultTipo,
        cantidad: 1,
        referencia: ''
      };
    } else {
      const sucId = isRestricted 
        ? defaultSucursal 
        : (filters.sucursalId !== 'all' ? filters.sucursalId : '');
      newData = {
        id_producto: '',
        id_sucursal: sucId,
        tipo_movimiento: defaultTipo,
        cantidad: 1,
        referencia: ''
      };
    }
    
    setMovementData(newData);
    setIsMovementModalOpen(true);
    
    // Fetch products for the selected sucursal+type
    if (newData.id_sucursal) {
      fetchModalProductos(newData.id_sucursal, newData.tipo_movimiento);
    } else {
      setModalProductos([]);
    }
  };

  // Point 8: When sucursal changes in modal, reload products and clear product selection
  const handleModalSucursalChange = (newSucursalId) => {
    setMovementData(prev => ({
      ...prev,
      id_sucursal: newSucursalId,
      id_producto: '' // Clear product when sucursal changes
    }));
    if (newSucursalId) {
      fetchModalProductos(newSucursalId, movementData.tipo_movimiento);
    } else {
      setModalProductos([]);
    }
  };

  // Point 8: When tipo_movimiento changes in modal, reload products and clear product selection
  const handleModalTipoChange = (newTipo) => {
    setMovementData(prev => ({
      ...prev,
      tipo_movimiento: newTipo,
      id_producto: '', // Clear product when type changes
      cantidad: 1 // Reset cantidad to valid default
    }));
    if (movementData.id_sucursal) {
      fetchModalProductos(movementData.id_sucursal, newTipo);
    }
  };

  const openLimitsModal = (item) => {
    setSelectedItem(item);
    setLimitsData({
      minimo: item.minimo,
      maximo: item.maximo
    });
    setIsLimitsModalOpen(true);
  };

  const getStockStatusBadge = (existencia, minimo, maximo) => {
    if (existencia <= 0)              return 'badge-error';    // agotado
    if (existencia < minimo)          return 'badge-warning';  // bajo
    if (existencia > maximo)          return 'badge-info';     // sobrestock
    return 'badge-success';                                    // óptimo
  };

  const getStockStatusLabel = (existencia, minimo, maximo) => {
    if (existencia <= 0)              return 'AGOTADO';
    if (existencia < minimo)          return 'STOCK BAJO';
    if (existencia > maximo)          return 'SOBRESTOCK';
    return 'ÓPTIMO';
  };

  // Point 4: Determine if negative quantities are allowed for the current movement type
  const allowsNegativeQty = ['correccion', 'ajuste'].includes(movementData.tipo_movimiento);
  const cantidadMin = allowsNegativeQty ? undefined : 1;

  return (
    <div className="page-container fade-in">
      <div className="toolbar">
        <div>
          <h1>Control de Inventarios</h1>
          <p className="text-secondary">Gestión de existencias por sucursal y producto</p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => openMovementModal()}>
            <RefreshCw size={18} /> Registrar Movimiento
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <form className="search-bar" style={{ flex: 1 }} onSubmit={(e) => { e.preventDefault(); fetchData(); }}>
            <Search className="search-icon" size={18} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Buscar por producto..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <div className="toolbar-actions">
            {isAdmin && (
              <select 
                className="form-input" 
                value={filters.sucursalId}
                onChange={(e) => setFilters({...filters, sucursalId: e.target.value})}
              >
                <option value="all">Todas las sucursales</option>
                {sucursales.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            )}
            <select 
              className="form-input" 
              value={filters.stockStatus}
              onChange={(e) => setFilters({...filters, stockStatus: e.target.value})}
            >
              <option value="all">Todos los estatus</option>
              <option value="agotado">Agotado</option>
              <option value="bajo">Stock Bajo</option>
              <option value="optimo">Stock Óptimo</option>
              <option value="sobrestock">Sobrestock</option>
            </select>
            <button 
              className="btn btn-secondary" 
              onClick={() => { setSearch(''); setFilters({sucursalId: 'all', stockStatus: 'all'}); }}
              title="Limpiar filtros"
            >
              <Filter size={18} />
            </button>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
          <button 
            className={`btn ${activeTab === 'stock' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('stock')}
          >
            <LayoutGrid size={18} /> Existencias
          </button>
          <button 
            className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={18} /> Historial
          </button>
        </div>
      </div>

      <div className="table-container card" style={{ padding: 0 }}>
        {loading ? (
          <div className="spinner"></div>
        ) : activeTab === 'stock' ? (
          inventario.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Sucursal</th>
                  <th>Existencia</th>
                  <th>Límites (Mín/Máx)</th>
                  <th>Estatus</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {inventario.map(item => (
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
                        <div style={{ fontWeight: 600 }}>{item.producto_nombre}</div>
                      </div>
                    </td>
                    <td><span className="badge badge-info">{item.categoria_nombre}</span></td>
                    <td><div style={{ fontSize: '13px' }}><Store size={12} inline /> {item.sucursal_nombre}</div></td>
                    <td><div style={{ fontWeight: 'bold', fontSize: '16px' }}>{item.existencia}</div></td>
                    <td>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-light)' }}>
                        Min: {item.minimo} / Max: {item.maximo}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getStockStatusBadge(item.existencia, item.minimo, item.maximo)}`}>
                        {getStockStatusLabel(item.existencia, item.minimo, item.maximo)}
                      </span>
                    </td>
                    <td>
                      <div className="toolbar-actions">
                        {canWrite && (
                          <button className="btn-icon" title="Ajustar stock" onClick={() => openMovementModal(item)}>
                            <Plus size={16} />
                          </button>
                        )}
                        {isAdmin && (
                          <button className="btn-icon" title="Configurar Alertas" onClick={() => openLimitsModal(item)}>
                            <Settings size={16} />
                          </button>
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
              <p>No se encontraron existencias</p>
            </div>
          )
        ) : (
          /* History View */
          historial.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto / Sucursal</th>
                  <th>Movimiento</th>
                  <th>Cantidad</th>
                  <th>Stock Final</th>
                  <th>Usuario / Ref</th>
                </tr>
              </thead>
              <tbody>
                {historial.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{new Date(m.created_at).toLocaleDateString('es-MX')}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-light)' }}>
                        {new Date(m.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{m.producto_nombre}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-light)' }}><Store size={12} inline /> {m.sucursal_nombre}</div>
                    </td>
                    <td>
                      <span className={`badge ${['entrada', 'traslado_entrada', 'produccion'].includes(m.tipo_movimiento) ? 'badge-success' : 'badge-error'}`}>
                        {m.tipo_movimiento.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div style={{ 
                        fontWeight: 'bold', 
                        fontSize: '16px', 
                        color: m.cantidad >= 0 ? 'var(--color-success)' : 'var(--color-error)' 
                      }}>
                        {m.cantidad >= 0 ? '+' : ''}{m.cantidad}
                      </div>
                    </td>
                    <td><div style={{ fontWeight: 'bold', fontSize: '16px' }}>{m.existencia_nueva}</div></td>
                    <td>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{m.username}</div>
                      {m.referencia && <div style={{ fontSize: '11px', color: 'var(--color-text-light)' }}>Ref: {m.referencia}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <History size={48} />
              <p>No hay historial de movimientos</p>
            </div>
          )
        )}
      </div>

      {/* Movement Modal */}
      {isMovementModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>Registrar Movimiento</h2>
              <button className="btn-icon" onClick={() => setIsMovementModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleMovementSubmit}>
              <div className="modal-body">
                <div className="form-grid form-grid-2" style={{ marginBottom: 'var(--space-md)' }}>
                  {/* Sucursal select — disabled for restricted roles */}
                  <div className="form-group">
                    <label className="form-label">Sucursal</label>
                    <select 
                      required
                      className="form-input"
                      value={movementData.id_sucursal}
                      onChange={(e) => handleModalSucursalChange(e.target.value)}
                      disabled={isRestricted}
                    >
                      <option value="">Seleccionar...</option>
                      {sucursales.map(s => (
                        <option key={s.id} value={s.id}>{s.nombre}</option>
                      ))}
                    </select>
                    {isRestricted && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '2px' }}>
                        Bloqueada a su sucursal asignada
                      </div>
                    )}
                  </div>
                  {/* Tipo movimiento — role-aware options */}
                  <div className="form-group">
                    <label className="form-label">Tipo Movimiento</label>
                    <select 
                      required
                      className="form-input"
                      value={movementData.tipo_movimiento}
                      onChange={(e) => handleModalTipoChange(e.target.value)}
                    >
                      {isAdmin ? (
                        <>
                          <option value="entrada">Entrada (+)</option>
                          <option value="salida">Salida (-)</option>
                          <option value="ajuste_positivo">Ajuste Positivo (+)</option>
                          <option value="ajuste_negativo">Ajuste Negativo (-)</option>
                          <option value="produccion">Producción (+)</option>
                        </>
                      ) : (
                        <>
                          <option value="ajuste">Ajuste</option>
                          <option value="merma">Merma (-)</option>
                          <option value="correccion">Corrección</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* Product select from modalProductos */}
                <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                  <label className="form-label">Producto</label>
                  <select 
                    required
                    className="form-input"
                    value={movementData.id_producto}
                    onChange={(e) => setMovementData({...movementData, id_producto: e.target.value})}
                    disabled={!movementData.id_sucursal || loadingModalProductos}
                  >
                    <option value="">
                      {!movementData.id_sucursal 
                        ? 'Seleccione sucursal primero...'
                        : loadingModalProductos 
                          ? 'Cargando productos...'
                          : 'Seleccionar Producto...'}
                    </option>
                    {modalProductos.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.nombre} {item.existencia !== undefined ? `(Stock: ${item.existencia})` : ''}
                      </option>
                    ))}
                  </select>
                  {movementData.id_sucursal && !loadingModalProductos && modalProductos.length === 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--color-warning)', marginTop: '2px' }}>
                      No hay productos disponibles para este tipo de movimiento
                    </div>
                  )}
                </div>

                <div className="form-grid form-grid-1-2">
                  {/* Allow negative quantities for correccion/ajuste */}
                  <div className="form-group">
                    <label className="form-label">Cantidad</label>
                    <input 
                      required
                      type="number"
                      min={cantidadMin}
                      step="1"
                      className="form-input"
                      value={movementData.cantidad}
                      onChange={(e) => setMovementData({...movementData, cantidad: parseInt(e.target.value) || 0})}
                    />
                    {allowsNegativeQty && (
                      <div style={{ fontSize: '11px', color: 'var(--color-text-light)', marginTop: '2px' }}>
                        Use negativos para restar stock
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Referencia / Motivo {isRestricted && '*'}</label>
                    <input 
                      type="text"
                      required={isRestricted}
                      placeholder={isRestricted ? 'Motivo obligatorio...' : 'Ej. Carga semanal'}
                      className="form-input"
                      value={movementData.referencia}
                      onChange={(e) => setMovementData({...movementData, referencia: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsMovementModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <Save size={18} /> Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Limits Modal */}
      {isLimitsModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '420px' }}>
            <div className="modal-header" style={{ background: 'var(--color-accent)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ color: 'white', margin: 0 }}>Alertas de Stock</h2>
                <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '2px' }}>{selectedItem?.producto_nombre}</div>
              </div>
              <button className="btn-icon" style={{ color: 'white' }} onClick={() => setIsLimitsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleLimitsSubmit}>
              <div className="modal-body">
                <div className="alert alert-info" style={{ marginBottom: 'var(--space-md)' }}>
                  <Info size={16} /> Estos valores activan las alertas visuales cuando el stock es demasiado bajo o supera la capacidad.
                </div>

                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Stock Mínimo</label>
                    <input 
                      required
                      type="number"
                      className="form-input"
                      value={limitsData.minimo}
                      onChange={(e) => setLimitsData({...limitsData, minimo: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Capacidad Máx.</label>
                    <input 
                      required
                      type="number"
                      className="form-input"
                      value={limitsData.maximo}
                      onChange={(e) => setLimitsData({...limitsData, maximo: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsLimitsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <Save size={18} /> Guardar Configuración
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventarios;
