import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';

function Traslados() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const [traslados, setTraslados] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [productos, setProductos] = useState([]);
  const [repartidores, setRepartidores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detallesModal, setDetallesModal] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    fecha: '',
    id_sucursal_origen: '',
    id_sucursal_destino: '',
    estatus: ''
  });

  // Form states
  const [formData, setFormData] = useState({
    id_sucursal_origen: '',
    id_sucursal_destino: '',
    id_repartidor: '',
    fecha_salida: new Date().toISOString().split('T')[0],
    observaciones: ''
  });
  const [cart, setCart] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('');

  const canEdit = ['propietario', 'admin_sistema', 'jefe_produccion'].includes(user?.rol);

  useEffect(() => {
    fetchTraslados();
    fetchSucursales();
    if (canEdit) {
      fetchRepartidores();
    }
  }, [filters]);

  const fetchTraslados = async () => {
    try {
      setLoading(true);
      const query = { ...filters };
      if (!query.fecha) delete query.fecha;
      if (!query.id_sucursal_origen) delete query.id_sucursal_origen;
      if (!query.id_sucursal_destino) delete query.id_sucursal_destino;
      if (!query.estatus) delete query.estatus;

      const data = await api.getTraslados(query);
      setTraslados(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Error al cargar traslados');
    } finally {
      setLoading(false);
    }
  };

  const fetchSucursales = async () => {
    try {
      const res = await api.getSucursales({ activo: 1 });
      const data = Array.isArray(res) ? res : res.data || [];
      setSucursales(data);
      if (canEdit && data.length > 1) {
        setFormData(prev => ({ 
          ...prev, 
          id_sucursal_origen: data[0].id,
          id_sucursal_destino: data[1].id
        }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProductos = async (sucursalId) => {
    try {
      if (!sucursalId) return;
      const res = await api.getProductosDisponibles(sucursalId);
      const data = Array.isArray(res) ? res : res.data || [];
      setProductos(data);
    } catch (err) {
      console.error('Error al cargar productos de la sucursal', err);
    }
  };

  const fetchRepartidores = async () => {
    try {
      let reps = [];
      try {
        const res = await api.get('/empleados/repartidores');
        reps = Array.isArray(res) ? res : res.data || [];
      } catch {
        // Fallback: get all empleados and filter by tipo_personal
        const all = await api.get('/empleados');
        const allList = Array.isArray(all) ? all : all.data || [];
        reps = allList.filter(e => e.tipo_personal === 'distribucion' && e.estatus === 'activo');
      }
      setRepartidores(reps);
      if (reps.length > 0) {
        setFormData(prev => ({ ...prev, id_repartidor: reps[0].id_empleado || reps[0].id }));
      }
    } catch (err) {
      console.error('Error al cargar repartidores:', err);
    }
  };

  const handleOrigenChange = (e) => {
    const val = e.target.value;
    setFormData({...formData, id_sucursal_origen: val});
    setCart([]); // Reset cart when origin changes because inventory changes
    fetchProductos(val);
  };

  const addToCart = () => {
    if (!selectedProduct || !quantity || quantity <= 0) {
      showToast('Seleccione un producto y una cantidad válida mayor a cero', 'warning');
      return;
    }
    const product = productos.find(p => p.id === parseInt(selectedProduct));
    if (!product) return;

    if (parseInt(quantity) > product.existencia) {
      showToast(`No hay suficiente stock. Disponible: ${product.existencia}`, 'warning');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id_producto === product.id);
      if (existing) {
        const newCant = existing.cantidad + parseInt(quantity);
        if (newCant > product.existencia) {
          showToast('La cantidad total superaría la existencia en el origen.', 'warning');
          return prev;
        }
        return prev.map(item => item.id_producto === product.id ? { ...item, cantidad: newCant } : item);
      }
      return [...prev, { id_producto: product.id, nombre: product.nombre, cantidad: parseInt(quantity) }];
    });
    setQuantity('');
    setSelectedProduct('');
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id_producto !== id));
  };

  const handleSave = async () => {
    if (cart.length === 0) {
      showToast('Debe agregar al menos un producto al traslado', 'warning');
      return;
    }
    if (formData.id_sucursal_origen == formData.id_sucursal_destino) {
      showToast('La sucursal de origen y destino no pueden ser la misma', 'warning');
      return;
    }
    try {
      setLoading(true);
      await api.createTraslado({
        ...formData,
        detalles: cart
      });
      setIsModalOpen(false);
      setCart([]);
      fetchTraslados();
      showToast('Traslado registrado exitosamente', 'success');
    } catch (err) {
      showToast(err.message || 'Error al guardar el traslado', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id) => {
    const isConfirmed = await confirm({
      title: 'Confirmar Entrega',
      message: '¿Confirmar la entrega del traslado en el destino?',
      confirmText: 'Sí, confirmar',
      type: 'info'
    });
    if (!isConfirmed) return;

    try {
      await api.confirmarTraslado(id);
      showToast('Traslado confirmado correctamente', 'success');
      fetchTraslados();
    } catch (err) {
      showToast(err.message || 'Error al confirmar', 'error');
    }
  };

  const handleCancel = async (id) => {
    const isConfirmed = await confirm({
      title: 'Cancelar Traslado',
      message: '¿Está seguro de cancelar este traslado? El inventario será devuelto al origen.',
      confirmText: 'Sí, cancelar',
      type: 'danger'
    });
    if (!isConfirmed) return;

    try {
      await api.cancelarTraslado(id);
      showToast('Traslado cancelado correctamente', 'success');
      fetchTraslados();
    } catch (err) {
      showToast(err.message || 'Error al cancelar', 'error');
    }
  };

  const openNewModal = () => {
    if (!canEdit) {
      showToast('No tienes permisos para registrar traslados.', 'error');
      return;
    }
    
    const originId = user?.rol === 'jefe_produccion' ? user.id_sucursal : formData.id_sucursal_origen;
    
    setFormData(prev => ({
      ...prev,
      id_sucursal_origen: originId,
      fecha_salida: new Date().toISOString().split('T')[0],
      observaciones: ''
    }));
    
    setCart([]);
    if (originId) {
      fetchProductos(originId);
    }
    setIsModalOpen(true);
  };

  const getStatusBadge = (estatus) => {
    switch (estatus) {
      case 'entregado': return <span className="badge badge-success">Entregado</span>;
      case 'en_ruta': return <span className="badge badge-warning">En Ruta</span>;
      case 'cancelado': return <span className="badge badge-danger">Cancelado</span>;
      default: return <span className="badge">{estatus}</span>;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Control de Traslados</h1>
          <p className="page-subtitle">Distribución y movimiento de inventario</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={openNewModal}>
            Nuevo Traslado
          </button>
        )}
      </div>

      <div className="card toolbar">
        <div className="form-group">
          <label className="form-label">Origen</label>
          <select 
            className="form-input" 
            value={filters.id_sucursal_origen} 
            onChange={(e) => setFilters({...filters, id_sucursal_origen: e.target.value})}
          >
            <option value="">Todas</option>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Destino</label>
          <select 
            className="form-input" 
            value={filters.id_sucursal_destino} 
            onChange={(e) => setFilters({...filters, id_sucursal_destino: e.target.value})}
          >
            <option value="">Todas</option>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Estatus</label>
          <select 
            className="form-input" 
            value={filters.estatus} 
            onChange={(e) => setFilters({...filters, estatus: e.target.value})}
          >
            <option value="">Todos</option>
            <option value="en_ruta">En Ruta</option>
            <option value="entregado">Entregado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>

      {error && <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

      <div className="card">
        {loading && !isModalOpen ? (
          <p>Cargando...</p>
        ) : traslados.length === 0 ? (
          <p>No hay traslados registrados con estos filtros.</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fecha</th>
                  <th>Origen</th>
                  <th>Destino</th>
                  <th>Repartidor</th>
                  <th>Estatus</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {traslados.map(t => (
                  <tr key={t.id}>
                    <td>#{t.id}</td>
                    <td>{t.fecha_salida}</td>
                    <td>{t.origen_nombre}</td>
                    <td>{t.destino_nombre}</td>
                    <td>{t.repartidor_nombre} {t.repartidor_apellido}</td>
                    <td>{getStatusBadge(t.estatus)}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn btn-secondary" onClick={() => setDetallesModal(t)}>
                          Detalles
                        </button>
                        {t.estatus === 'en_ruta' && ['propietario', 'admin_sistema', 'gerente_sucursal', 'repartidor'].includes(user?.rol) && (
                          <button className="btn btn-primary" onClick={() => handleConfirm(t.id)}>
                            Confirmar
                          </button>
                        )}
                        {t.estatus === 'en_ruta' && ['propietario', 'admin_sistema'].includes(user?.rol) && (
                          <button className="btn btn-danger" onClick={() => handleCancel(t.id)}>
                            Cancelar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL CREAR TRASLADO */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2 className="card-title">Registrar Traslado</h2>
            </div>
            
            <div className="modal-body">
              <div className="grid grid-2" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Sucursal Origen</label>
                  <select 
                    className="form-input" 
                    value={formData.id_sucursal_origen}
                    onChange={handleOrigenChange}
                    disabled={user?.rol === 'jefe_produccion'}
                  >
                    {sucursales.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Sucursal Destino</label>
                  <select 
                    className="form-input" 
                    value={formData.id_sucursal_destino}
                    onChange={e => setFormData({...formData, id_sucursal_destino: e.target.value})}
                  >
                    {sucursales.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Repartidor Asignado *</label>
                  {repartidores.length === 0 ? (
                    <div className="alert alert-warning" style={{ margin: 0 }}>
                      No hay repartidores activos registrados. Agregue un empleado de tipo "Distribución" desde el módulo de Personal.
                    </div>
                  ) : (
                    <select 
                      className="form-input" 
                      value={formData.id_repartidor}
                      onChange={e => setFormData({...formData, id_repartidor: e.target.value})}
                      required
                    >
                      <option value="">Seleccione un repartidor...</option>
                      {repartidores.map(r => (
                        <option key={r.id_empleado || r.id} value={r.id_empleado || r.id}>
                          {r.empleado_nombre || r.nombre} {r.empleado_apellido || r.apellido_paterno}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de Salida</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={formData.fecha_salida}
                    onChange={e => setFormData({...formData, fecha_salida: e.target.value})}
                  />
                </div>
              </div>

              <div className="card" style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--color-surface-alt)' }}>
                <h3 className="form-label" style={{ marginBottom: '0.5rem' }}>Agregar Producto al Envío</h3>
                <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: '2 1 200px' }}>
                    <label className="form-label">Producto (Existencia en Origen)</label>
                    <select 
                      className="form-input" 
                      value={selectedProduct}
                      onChange={e => setSelectedProduct(e.target.value)}
                    >
                      <option value="">Seleccione...</option>
                      {productos.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre} ({p.existencia} disp)</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: '1 1 120px' }}>
                    <label className="form-label">Cantidad a Enviar</label>
                    <input 
                      type="number" 
                      min="1"
                      className="form-input" 
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ flex: '0 0 auto' }}>
                    <label className="form-label">&nbsp;</label>
                    <button className="btn btn-primary" onClick={addToCart} style={{ minHeight: '42px' }}>
                      Añadir Producto
                    </button>
                  </div>
                </div>
              </div>

              {cart.length > 0 && (
                <div className="table-responsive" style={{ marginBottom: '1rem' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th>Cantidad Enviada</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cart.map(c => (
                        <tr key={c.id_producto}>
                          <td>{c.nombre}</td>
                          <td>{c.cantidad}</td>
                          <td>
                            <button className="btn btn-danger btn-sm" onClick={() => removeFromCart(c.id_producto)}>
                              Remover
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Observaciones</label>
                <textarea 
                  className="form-input" 
                  rows="2"
                  value={formData.observaciones}
                  onChange={e => setFormData({...formData, observaciones: e.target.value})}
                ></textarea>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={loading || !formData.id_repartidor}>
                {loading ? 'Procesando...' : 'Registrar Salida'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLES */}
      {detallesModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="card-title">Detalle del Traslado #{detallesModal.id}</h2>
            </div>
            <div className="modal-body">
              <div className="grid grid-2">
                <div>
                  <p><strong>Origen:</strong> {detallesModal.origen_nombre}</p>
                  <p><strong>Destino:</strong> {detallesModal.destino_nombre}</p>
                  <p><strong>Repartidor:</strong> {detallesModal.repartidor_nombre} {detallesModal.repartidor_apellido}</p>
                </div>
                <div>
                  <p><strong>Salida:</strong> {detallesModal.fecha_salida}</p>
                  <p><strong>Entrega:</strong> {detallesModal.fecha_entrega || 'Pendiente'}</p>
                  <p><strong>Estatus: </strong> {getStatusBadge(detallesModal.estatus)}</p>
                </div>
              </div>
              
              <div className="table-responsive" style={{ marginTop: '1rem' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Enviado</th>
                      <th>Recibido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detallesModal.detalles?.map(d => (
                      <tr key={d.id_producto}>
                        <td>{d.producto_nombre}</td>
                        <td>{d.cantidad_enviada}</td>
                        <td>{d.cantidad_recibida}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {detallesModal.observaciones && (
                <div style={{ marginTop: '1rem' }}>
                  <strong>Observaciones:</strong>
                  <p>{detallesModal.observaciones}</p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDetallesModal(null)}>Cerrar</button>
              {detallesModal.estatus === 'en_ruta' && ['propietario', 'admin_sistema', 'gerente_sucursal', 'repartidor'].includes(user?.rol) && (
                <button className="btn btn-primary" onClick={() => { setDetallesModal(null); handleConfirm(detallesModal.id); }}>
                  Confirmar Entrega
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Traslados;
