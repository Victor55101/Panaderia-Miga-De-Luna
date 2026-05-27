import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';

function Produccion() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const [producciones, setProducciones] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [productos, setProductos] = useState([]);
  const [productosConReceta, setProductosConReceta] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [detallesModal, setDetallesModal] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    fecha: '',
    id_sucursal: '',
    estatus: ''
  });

  // Form states
  const [formData, setFormData] = useState({
    id_sucursal: '',
    fecha: new Date().toISOString().split('T')[0],
    observaciones: ''
  });
  const [cart, setCart] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState('');

  const canEdit = ['propietario', 'admin_sistema', 'jefe_produccion'].includes(user?.rol);

  useEffect(() => {
    fetchProducciones();
    if (canEdit) {
      fetchSucursales();
      fetchProductos();
    }
  }, [filters]);

  const fetchProducciones = async () => {
    try {
      setLoading(true);
      const query = { ...filters };
      if (!query.fecha) delete query.fecha;
      if (!query.id_sucursal) delete query.id_sucursal;
      if (!query.estatus) delete query.estatus;

      const data = await api.getProducciones(query);
      
      let finalData = data;
      if (query.estatus) {
        finalData = finalData.filter(p => p.estatus === query.estatus);
      }
      setProducciones(finalData);
      setError('');
    } catch (err) {
      setError(err.message || 'Error al cargar producciones');
    } finally {
      setLoading(false);
    }
  };

  const fetchSucursales = async () => {
    try {
      const res = await api.getSucursales({ activo: 1 });
      const data = Array.isArray(res) ? res : res.data || [];
      setSucursales(data.filter(s => s.tipo === 'planta' || s.tipo === 'expendio'));
      if (data.length > 0) {
        setFormData(prev => ({ ...prev, id_sucursal: data.find(s => s.tipo === 'planta')?.id || data[0].id }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProductos = async () => {
    try {
      const res = await api.getActiveProductos();
      const data = Array.isArray(res) ? res : res.data || [];
      setProductos(data);

      const recetasRes = await api.getProductosConReceta();
      const recetasIds = Array.isArray(recetasRes) ? recetasRes : [];
      setProductosConReceta(new Set(recetasIds.map(id => parseInt(id))));
    } catch (err) {
      console.error(err);
    }
  };

  const addToCart = () => {
    if (!selectedProduct || !quantity || quantity <= 0) {
      showToast('Seleccione un producto y una cantidad válida mayor a cero', 'warning');
      return;
    }
    const product = productos.find(p => p.id === parseInt(selectedProduct));
    if (!product) return;

    if (!productosConReceta.has(product.id)) {
      showToast(`No se puede producir "${product.nombre}" porque no tiene receta registrada.`, 'error');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.id_producto === product.id);
      if (existing) {
        return prev.map(item => item.id_producto === product.id 
          ? { ...item, cantidad: item.cantidad + parseInt(quantity) } 
          : item);
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
      showToast('Debe agregar al menos un producto a la producción', 'warning');
      return;
    }
    if (!formData.id_sucursal) {
      showToast('Seleccione la planta o sucursal destino', 'warning');
      return;
    }
    try {
      setLoading(true);
      await api.createProduccion({
        ...formData,
        detalles: cart
      });
      setIsModalOpen(false);
      setCart([]);
      fetchProducciones();
      showToast('Producción registrada con éxito', 'success');
    } catch (err) {
      showToast(err.message || 'Error al guardar', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id) => {
    const isConfirmed = await confirm({
      title: 'Cancelar Producción',
      message: '¿Está seguro de cancelar esta producción? Esta acción revertirá el inventario.',
      confirmText: 'Sí, cancelar',
      type: 'danger'
    });
    if (!isConfirmed) return;

    try {
      await api.cancelarProduccion(id);
      showToast('Producción cancelada correctamente', 'success');
      fetchProducciones();
    } catch (err) {
      showToast(err.message || 'Error al cancelar', 'error');
    }
  };

  const openNewModal = () => {
    if (!canEdit) {
      showToast('No tienes permisos para registrar producción.', 'error');
      return;
    }
    setFormData({
      id_sucursal: user?.id_sucursal || (sucursales.length > 0 ? sucursales[0].id : ''),
      fecha: new Date().toISOString().split('T')[0],
      observaciones: ''
    });
    setCart([]);
    setIsModalOpen(true);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Producción Terminada</h1>
          <p className="page-subtitle">Registro de lotes producidos para inventario</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={openNewModal}>
            Registrar Producción Terminada
          </button>
        )}
      </div>

      <div className="card toolbar">
        <div className="form-group">
          <label className="form-label">Fecha</label>
          <input 
            type="date" 
            className="form-input" 
            value={filters.fecha} 
            onChange={(e) => setFilters({...filters, fecha: e.target.value})} 
          />
        </div>
        <div className="form-group">
          <label className="form-label">Estatus</label>
          <select 
            className="form-input" 
            value={filters.estatus} 
            onChange={(e) => setFilters({...filters, estatus: e.target.value})}
          >
            <option value="">Todos</option>
            <option value="completada">Completada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
      </div>

      {error && <div className="error-message" style={{ color: 'red', marginBottom: '1rem' }}>{error}</div>}

      <div className="card">
        {loading && !isModalOpen ? (
          <p>Cargando...</p>
        ) : producciones.length === 0 ? (
          <p>No hay producciones registradas con estos filtros.</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Fecha</th>
                  <th>Planta/Sucursal</th>
                  <th>Responsable</th>
                  <th>Total Piezas</th>
                  <th>Estatus</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {producciones.map(p => (
                  <tr key={p.id}>
                    <td>#{p.id}</td>
                    <td>{p.fecha}</td>
                    <td>{p.sucursal_nombre}</td>
                    <td>{p.empleado_nombre} {p.empleado_apellido}</td>
                    <td>{p.total_piezas}</td>
                    <td>
                      <span className={`badge ${p.estatus === 'cancelada' ? 'badge-danger' : 'badge-success'}`}>
                        {p.estatus === 'cancelada' ? 'Cancelada' : 'Completada'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn btn-secondary" onClick={() => setDetallesModal(p)}>
                          Ver Detalle
                        </button>
                        {p.estatus !== 'cancelada' && canEdit && (
                          <button className="btn btn-danger" onClick={() => handleCancel(p.id)}>
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

      {/* MODAL CREAR PRODUCCIÓN */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2 className="card-title">Registrar Producción Terminada</h2>
            </div>
            
            <div className="modal-body">
              <div className="grid grid-2" style={{ marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Planta/Sucursal Destino</label>
                  <select 
                    className="form-input" 
                    value={formData.id_sucursal}
                    onChange={e => setFormData({...formData, id_sucursal: e.target.value})}
                    disabled={user?.rol === 'jefe_produccion'}
                  >
                    {sucursales.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={formData.fecha}
                    onChange={e => setFormData({...formData, fecha: e.target.value})}
                  />
                </div>
              </div>

              <div className="card" style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--color-surface-alt)' }}>
                <h3 className="form-label" style={{ marginBottom: '0.5rem' }}>Agregar Producto</h3>
                <div style={{ display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="form-group" style={{ flex: '2 1 200px' }}>
                    <label className="form-label">Producto</label>
                    <select 
                      className="form-input" 
                      value={selectedProduct}
                      onChange={e => setSelectedProduct(e.target.value)}
                    >
                      <option value="">Seleccione...</option>
                      {productos.map(p => (
                        <option 
                          key={p.id} 
                          value={p.id} 
                          disabled={!productosConReceta.has(p.id)}
                        >
                          {p.nombre}{!productosConReceta.has(p.id) ? ' (⚠ Sin receta)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ flex: '1 1 120px' }}>
                    <label className="form-label">Cantidad Producida</label>
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
                      Agregar
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
                        <th>Cantidad</th>
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
                              Eliminar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th>Total Piezas</th>
                        <th>{cart.reduce((sum, c) => sum + c.cantidad, 0)}</th>
                        <th></th>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Observaciones (Opcional)</label>
                <textarea 
                  className="form-input" 
                  rows="3"
                  value={formData.observaciones}
                  onChange={e => setFormData({...formData, observaciones: e.target.value})}
                ></textarea>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
                {loading ? 'Guardando...' : 'Registrar Producción Terminada'}
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
              <h2 className="card-title">Detalle de Producción #{detallesModal.id}</h2>
            </div>
            
            <div className="modal-body">
              <p><strong>Fecha:</strong> {detallesModal.fecha}</p>
              <p><strong>Sucursal:</strong> {detallesModal.sucursal_nombre}</p>
              <p><strong>Responsable:</strong> {detallesModal.empleado_nombre} {detallesModal.empleado_apellido}</p>
              <p>
                <strong>Estatus: </strong> 
                <span className={`badge ${detallesModal.estatus === 'cancelada' ? 'badge-danger' : 'badge-success'}`}>
                  {detallesModal.estatus === 'cancelada' ? 'Cancelada' : 'Completada'}
                </span>
              </p>
              
              <div className="table-responsive" style={{ marginTop: '1rem' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detallesModal.detalles?.map(d => (
                      <tr key={d.id_producto}>
                        <td>{d.producto_nombre}</td>
                        <td>{d.cantidad}</td>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Produccion;
