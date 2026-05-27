import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { 
  ShoppingCart, Search, Filter, Plus, Calendar, DollarSign, X, Save, ClipboardList
} from 'lucide-react';

// Helper: returns YYYY-MM-DD in local timezone (avoids UTC offset desfase)
function toLocaleDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function ComprasInsumos() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [compras, setCompras] = useState([]);
  const [insumosActivos, setInsumosActivos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [periodo, setPeriodo] = useState('todo');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const handlePeriodoChange = (value) => {
    setPeriodo(value);
    const today = new Date();
    const hoy = toLocaleDateStr(today);
    const ayer = toLocaleDateStr(new Date(Date.now() - 86400000));

    if (value === 'hoy') {
      setFechaInicio(hoy);
      setFechaFin(hoy);
    } else if (value === 'ayer') {
      setFechaInicio(ayer);
      setFechaFin(ayer);
    } else if (value === 'semana') {
      // Semana calendario anterior completa: lunes a domingo de la semana pasada
      const hoyD = new Date();
      const diaSemana = hoyD.getDay() || 7;           // 1=lun … 7=dom (ISO)
      const lunesPasado = new Date(hoyD);
      lunesPasado.setDate(hoyD.getDate() - diaSemana - 6);  // lunes anterior
      const domingoPasado = new Date(lunesPasado);
      domingoPasado.setDate(lunesPasado.getDate() + 6);     // domingo anterior
      setFechaInicio(toLocaleDateStr(lunesPasado));
      setFechaFin(toLocaleDateStr(domingoPasado));
    } else if (value === 'mes') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setFechaInicio(toLocaleDateStr(d));
      setFechaFin(hoy);
    } else if (value === 'todo') {
      setFechaInicio('');
      setFechaFin('');
    } else if (value === 'rango') {
      if (!fechaInicio) setFechaInicio(hoy);
      if (!fechaFin) setFechaFin(hoy);
    }
  };

  // Form State
  const [formData, setFormData] = useState({
    id_insumo: '',
    cantidad: '',
    costo_total: '',
    proveedor: '',
    fecha_compra: toLocaleDateStr(new Date())
  });

  const canWrite = ['propietario', 'admin_sistema', 'jefe_produccion'].includes(user?.rol);

  useEffect(() => {
    fetchCompras();
    if (canWrite) {
      fetchInsumos();
    }
  }, [search, fechaInicio, fechaFin]);

  const fetchCompras = async () => {
    try {
      setLoading(true);
      const params = {
        search,
        fechaInicio,
        fechaFin
      };
      const data = await api.getComprasInsumos(params);
      setCompras(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      showToast(err.message || 'Error al cargar compras de insumos', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchInsumos = async () => {
    try {
      const data = await api.getActivosInsumos();
      setInsumosActivos(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenCreate = () => {
    setFormData({
      id_insumo: '',
      cantidad: '',
      costo_total: '',
      proveedor: '',
      fecha_compra: toLocaleDateStr(new Date())
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    // Validations
    if (!formData.id_insumo) { showToast('Seleccione un insumo', 'warning'); return; }
    
    const qty = parseFloat(formData.cantidad);
    if (isNaN(qty) || qty <= 0) { showToast('La cantidad debe ser mayor a cero', 'warning'); return; }

    const cost = parseFloat(formData.costo_total);
    if (isNaN(cost) || cost < 0) { showToast('El costo total no puede ser negativo', 'warning'); return; }

    if (!formData.fecha_compra) { showToast('La fecha de compra es obligatoria', 'warning'); return; }

    try {
      setLoading(true);
      await api.createCompraInsumo({
        ...formData,
        cantidad: qty,
        costo_total: cost
      });
      setIsModalOpen(false);
      showToast('Compra registrada exitosamente', 'success');
      fetchCompras();
    } catch (err) {
      showToast(err.message || 'Error al registrar la compra', 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectedInsumo = insumosActivos.find(i => i.id === parseInt(formData.id_insumo));

  return (
    <div className="page-container fade-in">
      <div className="toolbar">
        <div>
          <h1>Compras de Materia Prima</h1>
          <p className="text-secondary">Registro e historial de compras de insumos para abastecer producción</p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <Plus size={18} /> Registrar Compra
          </button>
        )}
      </div>

      {/* FILTER CARD */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: periodo === 'rango' ? '2fr 1fr 1fr 1fr auto' : '2fr 1fr auto', gap: 'var(--space-md)', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Buscar insumo o proveedor</label>
            <div className="search-bar" style={{ width: '100%' }}>
              <Search className="search-icon" size={18} />
              <input
                type="text"
                className="form-input"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Periodo</label>
            <select
              className="form-input"
              value={periodo}
              onChange={(e) => handlePeriodoChange(e.target.value)}
            >
              <option value="todo">Cualquier fecha</option>
              <option value="hoy">Hoy</option>
              <option value="ayer">Ayer</option>
              <option value="semana">Semana pasada (lun-dom)</option>
              <option value="mes">Último mes (30 días)</option>
              <option value="rango">Rango de fechas</option>
            </select>
          </div>

          {periodo === 'rango' && (
            <>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Desde</label>
                <input
                  type="date"
                  className="form-input"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Hasta</label>
                <input
                  type="date"
                  className="form-input"
                  value={fechaFin}
                  onChange={(e) => setFechaFin(e.target.value)}
                />
              </div>
            </>
          )}

          <button
            className="btn btn-secondary"
            onClick={() => { setSearch(''); setPeriodo('todo'); setFechaInicio(''); setFechaFin(''); }}
            title="Limpiar filtros"
            style={{ height: '42px' }}
          >
            <Filter size={18} />
          </button>
        </div>
      </div>

      {/* DATA GRID */}
      <div className="table-container card" style={{ padding: 0 }}>
        {loading ? (
          <div className="spinner"></div>
        ) : compras.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Fecha Compra</th>
                <th>Insumo</th>
                <th>Cantidad</th>
                <th>Costo Total</th>
                <th>Costo unitario de compra</th>
                <th>Proveedor</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              {compras.map((c) => {
                const calculatedUnitC = c.cantidad > 0 ? (c.costo_total / c.cantidad) : 0;
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                        <Calendar size={14} style={{ color: 'var(--color-accent)' }} />
                        {new Date(c.fecha_compra + 'T12:00:00').toLocaleDateString('es-MX')}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="stat-icon" style={{
                          background: 'var(--color-base)',
                          color: 'var(--color-accent)',
                          width: '28px', height: '28px', borderRadius: '6px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <ClipboardList size={14} />
                        </div>
                        <div style={{ fontWeight: 600 }}>{c.insumo_nombre}</div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 'bold' }}>{parseFloat(c.cantidad)}</span>{' '}
                      <span className="badge badge-info">{c.insumo_unidad}</span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--color-success)', fontWeight: 'bold', fontSize: '15px' }}>
                        ${parseFloat(c.costo_total).toFixed(2)}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--color-text-light)', fontFamily: 'monospace' }}>
                        ${calculatedUnitC.toFixed(4)} / {c.insumo_unidad}
                      </span>
                    </td>
                    <td>
                      {c.proveedor ? (
                        <span style={{ fontSize: '13px' }}>{c.proveedor}</span>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-light)', fontStyle: 'italic' }}>
                          Sin proveedor
                        </span>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: '13px', fontWeight: 500 }}>{c.username}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <ShoppingCart size={48} />
            <p>No se encontraron registros de compras de insumos</p>
          </div>
        )}
      </div>

      {/* FORM MODAL */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2 className="card-title">Registrar Compra de Insumo</h2>
              <button className="btn-icon" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleFormSubmit}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                  <label className="form-label">Insumo a Comprar *</label>
                  <select
                    required
                    className="form-input"
                    value={formData.id_insumo}
                    onChange={(e) => setFormData({ ...formData, id_insumo: e.target.value })}
                  >
                    <option value="">Seleccionar insumo...</option>
                    {insumosActivos.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.nombre} {i.unidad_medida ? `(${i.unidad_medida})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-grid form-grid-2" style={{ marginBottom: 'var(--space-md)' }}>
                  <div className="form-group">
                    <label className="form-label">
                      Cantidad {selectedInsumo ? `(${selectedInsumo.unidad_medida})` : ''} *
                    </label>
                    <input
                      type="number"
                      required
                      step="0.0001"
                      min="0.0001"
                      placeholder="0.0000"
                      className="form-input"
                      value={formData.cantidad}
                      onChange={(e) => setFormData({ ...formData, cantidad: e.target.value })}
                    />
                    {selectedInsumo && (
                      <div style={{ fontSize: '10px', color: 'var(--color-accent)', marginTop: '2px' }}>
                        Base: <strong>{selectedInsumo.unidad_medida}</strong>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Costo Total ($) *</label>
                    <div style={{ position: 'relative' }}>
                      <DollarSign size={16} style={{ position: 'absolute', left: '10px', top: '13px', color: 'var(--color-text-light)' }} />
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        style={{ paddingLeft: '30px' }}
                        className="form-input"
                        value={formData.costo_total}
                        onChange={(e) => setFormData({ ...formData, costo_total: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                  <label className="form-label">Proveedor (Opcional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Ej. Distribuidora Central"
                    value={formData.proveedor}
                    onChange={(e) => setFormData({ ...formData, proveedor: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Fecha de Compra *</label>
                  <input
                    type="date"
                    required
                    className="form-input"
                    value={formData.fecha_compra}
                    onChange={(e) => setFormData({ ...formData, fecha_compra: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  <Save size={18} /> Guardar Compra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ComprasInsumos;
