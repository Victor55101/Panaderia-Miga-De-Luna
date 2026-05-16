import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ShoppingCart, Search, Plus, Trash2, Printer, X, CheckCircle, FileText, Ban } from 'lucide-react';

// Helper: returns YYYY-MM-DD in local timezone (avoids UTC offset desfase)
function toLocaleDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function Ventas() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  // Permisos
  const isAdmin = ['propietario', 'admin_sistema'].includes(user?.rol);
  const isManager = user?.rol === 'gerente_sucursal';
  const isVendedor = user?.rol === 'vendedor';
  
  // Gerentes no crean ventas, solo ven historial
  const [activeTab, setActiveTab] = useState(isVendedor ? 'nueva' : 'historial');
  
  // Datos maestros
  const [sucursales, setSucursales] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [productos, setProductos] = useState([]);
  
  // Estado Nueva Venta
  const [venta, setVenta] = useState({
    id_sucursal: user?.id_sucursal || '',
    id_empleado: isVendedor ? (user?.id_empleado || '') : '',
    metodo_pago: 'efectivo'
  });
  const [carrito, setCarrito] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Historial
  const [historial, setHistorial] = useState([]);
  const [periodoPicker, setPeriodoPicker] = useState('hoy');     // period select value
  const [rangoFechas, setRangoFechas] = useState({              // only used when periodo === 'rango'
    desde: toLocaleDateStr(new Date()),
    hasta: toLocaleDateStr(new Date())
  });
  const [filtrosHistorial, setFiltrosHistorial] = useState({
    sucursalId: '',
    vendedorId: ''
  });

  // Vendedores para el filtro del historial
  const [vendedoresHistorial, setVendedoresHistorial] = useState([]);

  // Fetch vendedores cuando cambia la sucursal en el filtro
  useEffect(() => {
    if (filtrosHistorial.sucursalId) {
       api.getVendedores(filtrosHistorial.sucursalId).then(res => setVendedoresHistorial(res || [])).catch(console.error);
    } else {
       setVendedoresHistorial([]);
       setFiltrosHistorial(prev => ({...prev, vendedorId: ''}));
    }
  }, [filtrosHistorial.sucursalId]);
  
  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ticketModal, setTicketModal] = useState(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);

  useEffect(() => {
    fetchMaestros();
  }, []);

  useEffect(() => {
    if (venta.id_sucursal && !isManager) {
      fetchProductos(venta.id_sucursal);
      if (isAdmin) {
        fetchVendedores(venta.id_sucursal);
      }
      setCarrito([]);
    }
  }, [venta.id_sucursal]);

  useEffect(() => {
    if (activeTab === 'historial') {
      fetchHistorial();
    }
  }, [activeTab, filtrosHistorial, periodoPicker, rangoFechas]);

  async function fetchMaestros() {
    try {
      if (isAdmin) {
        const res = await api.getSucursales();
        setSucursales(Array.isArray(res) ? res : (res.data || []));
      } else if (user?.id_sucursal) {
        setVenta(prev => ({ ...prev, id_sucursal: user.id_sucursal }));
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchProductos(id_sucursal) {
    try {
      const res = await api.getProductosDisponibles(id_sucursal);
      setProductos(res || []);
    } catch (err) {
      setError('Error al cargar productos');
    }
  }

  async function fetchVendedores(id_sucursal) {
    try {
      const res = await api.getVendedores(id_sucursal);
      setVendedores(res || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchHistorial() {
    try {
      setLoading(true);
      const params = { ...filtrosHistorial };
      if (!isAdmin) params.sucursalId = user.id_sucursal;

      // Compute date range from period
      const hoy = toLocaleDateStr(new Date());
      const ayer = toLocaleDateStr(new Date(Date.now() - 86400000));
      if (periodoPicker === 'hoy') {
        params.fechaDesde = hoy; params.fechaHasta = hoy;
      } else if (periodoPicker === 'ayer') {
        params.fechaDesde = ayer; params.fechaHasta = ayer;
      } else if (periodoPicker === 'semana') {
        // Semana calendario anterior completa: lunes a domingo de la semana pasada
        const hoyD = new Date();
        const diaSemana = hoyD.getDay() || 7;           // 1=lun … 7=dom (ISO)
        const lunesPasado = new Date(hoyD);
        lunesPasado.setDate(hoyD.getDate() - diaSemana - 6);  // lunes anterior
        const domingoPasado = new Date(lunesPasado);
        domingoPasado.setDate(lunesPasado.getDate() + 6);     // domingo anterior
        params.fechaDesde = toLocaleDateStr(lunesPasado);
        params.fechaHasta  = toLocaleDateStr(domingoPasado);
      } else if (periodoPicker === 'mes') {
        const d = new Date(); d.setDate(d.getDate() - 30);
        params.fechaDesde = toLocaleDateStr(d); params.fechaHasta = hoy;
      } else if (periodoPicker === 'rango') {
        params.fechaDesde = rangoFechas.desde; params.fechaHasta = rangoFechas.hasta;
      }
      // 'todos': no date params sent

      const res = await api.getVentas(params);
      setHistorial(res || []);
    } catch (err) {
      setError('Error al cargar historial');
    } finally {
      setLoading(false);
    }
  }

  const handleAddToCart = (prod) => {
    if (prod.existencia <= 0) {
      showToast('No hay stock disponible', 'warning');
      return;
    }
    
    setCarrito(prev => {
      const exists = prev.find(i => i.id_producto === prod.id);
      if (exists) {
        if (exists.cantidad >= prod.existencia) {
           showToast('Stock máximo alcanzado', 'warning');
           return prev;
        }
        return prev.map(i => i.id_producto === prod.id ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.precio_unitario } : i);
      }
      return [...prev, {
        id_producto: prod.id,
        nombre: prod.nombre,
        precio_unitario: prod.precio,
        cantidad: 1,
        subtotal: prod.precio,
        max_stock: prod.existencia
      }];
    });
  };

  const updateCartQty = (id, delta) => {
    setCarrito(prev => prev.map(i => {
      if (i.id_producto === id) {
        const newQ = i.cantidad + delta;
        if (newQ > 0 && newQ <= i.max_stock) {
          return { ...i, cantidad: newQ, subtotal: newQ * i.precio_unitario };
        }
      }
      return i;
    }));
  };

  const removeFromCart = (id) => {
    setCarrito(prev => prev.filter(i => i.id_producto !== id));
  };

  const totalCarrito = carrito.reduce((sum, item) => sum + item.subtotal, 0);

  const handleConfirmarVenta = async () => {
    if (!venta.id_sucursal || !venta.id_empleado) {
      setError('Datos de venta incompletos');
      return;
    }
    if (carrito.length === 0) {
      setError('El carrito está vacío');
      return;
    }

    try {
      setLoading(true);
      const res = await api.crearVenta({
        venta,
        items: carrito.map(i => ({ id_producto: i.id_producto, cantidad: i.cantidad, precio_unitario: i.precio_unitario }))
      });
      
      setCarrito([]);
      fetchProductos(venta.id_sucursal);
      setTicketModal(res);
      setError('');
    } catch (err) {
      setError(err.message || 'Error al procesar venta');
    } finally {
      setLoading(false);
    }
  };

  const openCancelDialog = (id_venta) => {
    setCancelTarget(id_venta);
    setCancelMotivo('');
  };

  const handleCancelarVenta = async () => {
    if (!cancelMotivo.trim()) {
      showToast('Debe ingresar un motivo de cancelación', 'warning');
      return;
    }
    try {
      await api.cancelarVenta(cancelTarget, { motivo: cancelMotivo });
      showToast('Venta cancelada exitosamente', 'success');
      setCancelTarget(null);
      setCancelMotivo('');
      fetchHistorial();
    } catch (err) {
      showToast(err.message || 'Error al cancelar', 'error');
    }
  };

  const printTicket = () => {
    window.print();
  };

  const prodFiltrados = productos.filter(p => p.nombre.toLowerCase().includes(searchQuery.toLowerCase()));

  // RBAC: Solo los vendedores pueden registrar ventas
  const canCreateSale = user?.rol === 'vendedor';

  return (
    <div className="page-container fade-in">
      <div className="toolbar no-print">
        <div>
          <h1>Ventas</h1>
          <p className="text-secondary">Registro y control de ventas por sucursal</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          {canCreateSale && (
            <button className={`btn ${activeTab === 'nueva' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('nueva')}>
              Nueva Venta
            </button>
          )}
          <button className={`btn ${activeTab === 'historial' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('historial')}>
            Historial
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error no-print" style={{ marginBottom: 'var(--space-md)' }}>
          <X size={18} /> {error}
        </div>
      )}

      {activeTab === 'nueva' && canCreateSale && (
        <div style={{ display: 'flex', gap: 'var(--space-lg)', flexWrap: 'wrap' }} className="no-print">
          {/* Panel Izquierdo: Productos */}
          <div style={{ flex: '2 1 500px', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div className="card">
              <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                {/* Admin: Seleccionar sucursal */}
                {isAdmin && (
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Sucursal</label>
                    <select className="form-input" value={venta.id_sucursal} onChange={e => setVenta({...venta, id_sucursal: e.target.value})}>
                      <option value="">Seleccione sucursal...</option>
                      {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                    </select>
                  </div>
                )}
                {/* Admin: Seleccionar vendedor | Vendedor: auto-fijado */}
                {isAdmin ? (
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Vendedor</label>
                    <select className="form-input" value={venta.id_empleado} onChange={e => setVenta({...venta, id_empleado: e.target.value})}>
                      <option value="">Seleccione vendedor...</option>
                      {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre_completo}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Vendedor</label>
                    <input type="text" className="form-input" value={user?.nombre || ''} disabled />
                  </div>
                )}
              </div>

              <div className="form-group">
                <div style={{ position: 'relative' }}>
                  <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--color-text-secondary)' }} />
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Buscar producto..." 
                    style={{ paddingLeft: '38px' }}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-3">
              {prodFiltrados.map(p => (
                <div key={p.id} className="card" style={{ padding: 'var(--space-md)', cursor: p.existencia > 0 ? 'pointer' : 'not-allowed', opacity: p.existencia > 0 ? 1 : 0.6 }} onClick={() => handleAddToCart(p)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '500' }}>{p.nombre}</span>
                    <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>${p.precio.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span className="text-secondary">{p.categoria_nombre}</span>
                    <span className={p.existencia > 0 ? 'text-success' : 'text-danger'}>
                      Stock: {p.existencia}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel Derecho: Carrito */}
          <div className="card" style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--color-border)', paddingBottom: 'var(--space-sm)' }}>
              <ShoppingCart size={20} /> Carrito
            </h3>
            
            <div style={{ flex: 1, minHeight: '200px', maxHeight: '400px', overflowY: 'auto', padding: 'var(--space-sm) 0' }}>
              {carrito.length === 0 ? (
                <div className="text-center text-secondary" style={{ padding: '2rem 0' }}>Carrito vacío</div>
              ) : (
                carrito.map(item => (
                  <div key={item.id_producto} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-surface-alt)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '500', fontSize: '14px' }}>{item.nombre}</div>
                      <div className="text-secondary" style={{ fontSize: '12px' }}>${item.precio_unitario.toFixed(2)} x {item.cantidad}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => updateCartQty(item.id_producto, -1)}>-</button>
                      <span>{item.cantidad}</span>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => updateCartQty(item.id_producto, 1)}>+</button>
                      <button className="btn" style={{ padding: '4px', color: 'var(--color-error)' }} onClick={() => removeFromCart(item.id_producto)}><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-md)', marginTop: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                <span style={{ fontSize: '18px', fontWeight: 'bold' }}>Total:</span>
                <span style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--color-accent)' }}>${totalCarrito.toFixed(2)}</span>
              </div>
              
              <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
                <label className="form-label">Método de Pago</label>
                <select className="form-input" value={venta.metodo_pago} onChange={e => setVenta({...venta, metodo_pago: e.target.value})}>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                disabled={loading || carrito.length === 0 || !venta.id_sucursal || !venta.id_empleado}
                onClick={handleConfirmarVenta}
              >
                {loading ? 'Procesando...' : 'Confirmar Venta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'historial' && (
        <div className="card no-print">
          <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
            {/* Selector de periodo */}
            <div className="form-group">
              <label className="form-label">Periodo</label>
              <select
                className="form-input"
                style={{ minWidth: '160px' }}
                value={periodoPicker}
                onChange={e => setPeriodoPicker(e.target.value)}
              >
                <option value="todos">Cualquier fecha</option>
                <option value="hoy">Hoy</option>
                <option value="ayer">Ayer</option>
                <option value="semana">Semana pasada (lun-dom)</option>
                <option value="mes">Último mes (30 días)</option>
                <option value="rango">Rango de fechas</option>
              </select>
            </div>

            {/* Inputs manuales solo si es rango personalizado */}
            {periodoPicker === 'rango' && (
              <>
                <div className="form-group">
                  <label className="form-label">Desde</label>
                  <input type="date" className="form-input"
                    value={rangoFechas.desde}
                    onChange={e => setRangoFechas(prev => ({...prev, desde: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Hasta</label>
                  <input type="date" className="form-input"
                    value={rangoFechas.hasta}
                    onChange={e => setRangoFechas(prev => ({...prev, hasta: e.target.value}))} />
                </div>
              </>
            )}
            
            {/* Filtros avanzados para Admin/Propietario */}
            {isAdmin && (
              <>
                <div className="form-group">
                  <label className="form-label">Sucursal</label>
                  <select className="form-input" value={filtrosHistorial.sucursalId} onChange={e => setFiltrosHistorial({...filtrosHistorial, sucursalId: e.target.value})}>
                    <option value="">Todas las sucursales</option>
                    {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Vendedor</label>
                  <select className="form-input" value={filtrosHistorial.vendedorId} onChange={e => setFiltrosHistorial({...filtrosHistorial, vendedorId: e.target.value})} disabled={!filtrosHistorial.sucursalId}>
                    <option value="">Todos los vendedores</option>
                    {vendedoresHistorial.map(v => <option key={v.id} value={v.id}>{v.nombre_completo}</option>)}
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Fecha</th>
                  <th>Sucursal</th>
                  <th>Vendedor</th>
                  <th>Total</th>
                  <th>Método</th>
                  <th>Estatus</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {historial.length === 0 ? (
                  <tr><td colSpan="8" className="text-center">No se encontraron ventas</td></tr>
                ) : (
                  historial.map(v => (
                    <tr key={v.id}>
                      <td style={{ fontWeight: 'bold' }}>#{v.id.toString().padStart(5, '0')}</td>
                      <td>{new Date(v.created_at).toLocaleString()}</td>
                      <td>{v.sucursal_nombre}</td>
                      <td>{v.vendedor_nombre}</td>
                      <td style={{ fontWeight: 'bold' }}>${v.total.toFixed(2)}</td>
                      <td style={{ textTransform: 'capitalize' }}>{v.metodo_pago}</td>
                      <td>
                        <span className={`badge badge-${v.estatus === 'completada' ? 'success' : 'danger'}`}>
                          {v.estatus}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={async () => {
                            try {
                              const vDetalle = await api.getVenta(v.id);
                              setTicketModal(vDetalle);
                            } catch (e) { showToast('Error al cargar detalle', 'error'); }
                          }} title="Ver Ticket">
                            <FileText size={16} />
                          </button>
                          {/* Cancelar: admin/propietario global, gerente solo su sucursal, vendedor nunca */}
                          {(isAdmin || isManager) && v.estatus === 'completada' && (
                            <button className="btn" style={{ padding: '4px 8px', color: 'var(--color-error)' }} onClick={() => openCancelDialog(v.id)} title="Cancelar Venta">
                              <Ban size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Cancelación con Motivo */}
      {cancelTarget && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="card-title">Cancelar Venta #{cancelTarget.toString().padStart(5, '0')}</h2>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Motivo de cancelación *</label>
                <textarea className="form-input" rows="3" value={cancelMotivo}
                  placeholder="Ingrese el motivo de la cancelación..."
                  onChange={e => setCancelMotivo(e.target.value)}></textarea>
              </div>
              <p className="text-secondary" style={{ fontSize: '13px' }}>
                Al cancelar se repondrá el inventario automáticamente y se registrará en auditoría.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setCancelTarget(null); setCancelMotivo(''); }}>Cancelar</button>
              <button className="btn btn-danger" onClick={handleCancelarVenta} disabled={!cancelMotivo.trim()}>Confirmar Cancelación</button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Modal */}
      {ticketModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2 className="card-title">Ticket de Venta</h2>
            </div>
            <div className="modal-body">
              <div id="ticket-content" style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                <h2 style={{ margin: '0 0 8px 0' }}>Miga de Luna</h2>
                <p style={{ margin: '0 0 4px 0', fontSize: '14px' }}>Panadería & Repostería</p>
                <p style={{ margin: '0 0 16px 0', fontSize: '12px' }}>{ticketModal.sucursal_nombre}</p>
                
                <div style={{ borderTop: '1px dashed #ccc', borderBottom: '1px dashed #ccc', padding: '8px 0', margin: '8px 0', textAlign: 'left', fontSize: '13px' }}>
                  <div>Folio: #{ticketModal.id.toString().padStart(5, '0')}</div>
                  <div>Fecha: {new Date(ticketModal.created_at).toLocaleString()}</div>
                  <div>Cajero: {ticketModal.empleado_nombre}</div>
                </div>

                <table style={{ width: '100%', textAlign: 'left', fontSize: '13px', borderCollapse: 'collapse', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <th style={{ padding: '4px 0' }}>Cant</th>
                      <th style={{ padding: '4px 0' }}>Articulo</th>
                      <th style={{ padding: '4px 0', textAlign: 'right' }}>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticketModal.items?.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ padding: '4px 0', verticalAlign: 'top' }}>{item.cantidad}</td>
                        <td style={{ padding: '4px 0' }}>
                          <div>{item.producto_nombre}</div>
                          <div style={{ fontSize: '11px', color: '#666' }}>${item.precio_unitario.toFixed(2)} c/u</div>
                        </td>
                        <td style={{ padding: '4px 0', textAlign: 'right', verticalAlign: 'top' }}>${item.subtotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold', borderTop: '1px dashed #ccc', paddingTop: '8px', marginBottom: '16px' }}>
                  <span>TOTAL:</span>
                  <span>${ticketModal.total.toFixed(2)}</span>
                </div>

                <div style={{ textAlign: 'left', fontSize: '13px', marginBottom: '24px' }}>
                  <div>Método de pago: <span style={{ textTransform: 'capitalize' }}>{ticketModal.metodo_pago}</span></div>
                </div>

                <div style={{ fontSize: '12px', marginTop: '16px' }}>
                  ¡Gracias por su compra!
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setTicketModal(null)}>Cerrar</button>
              <button className="btn btn-primary" onClick={printTicket}><Printer size={18} style={{ marginRight: '8px' }} /> Imprimir</button>
            </div>
          </div>
          <style>{`
            @media print {
              body * { visibility: hidden; }
              .modal-overlay, .modal-overlay * { visibility: visible; }
              .modal-overlay { position: absolute; left: 0; top: 0; background: none; }
              .modal-content { box-shadow: none; border: none; padding: 0 !important; max-width: 100% !important; }
              .no-print, .modal-footer { display: none !important; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
