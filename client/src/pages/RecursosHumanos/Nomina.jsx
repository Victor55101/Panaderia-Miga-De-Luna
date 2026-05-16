import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';

function Nomina() {
  const { user } = useAuth();
  const { confirm } = useConfirmDialog();
  const [nominas, setNominas] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);
  const [detalleModal, setDetalleModal] = useState(null);

  const [filters, setFilters] = useState({
    estatus: '',
    id_sucursal: '',
    periodo_inicio: '',
    periodo_fin: ''
  });

  const [calcForm, setCalcForm] = useState({
    periodo_inicio: '',
    periodo_fin: '',
    id_sucursal: ''
  });

  const canManage = ['propietario', 'admin_sistema', 'recursos_humanos'].includes(user?.rol);
  const canView = canManage || user?.rol === 'gerente_sucursal';

  useEffect(() => {
    fetchNominas();
    fetchSucursales();
  }, []);

  useEffect(() => {
    fetchNominas();
  }, [filters]);

  const fetchNominas = async () => {
    try {
      setLoading(true);
      const query = { ...filters };
      Object.keys(query).forEach(k => { if (!query[k]) delete query[k]; });
      const data = await api.getNominas(query);
      setNominas(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Error al cargar nóminas');
    } finally {
      setLoading(false);
    }
  };

  const fetchSucursales = async () => {
    try {
      const data = await api.getSucursales({ activo: 1 });
      setSucursales(Array.isArray(data) ? data : data.data || []);
    } catch (err) { console.error(err); }
  };

  const showMsg = (msg, type = 'success') => {
    if (type === 'success') { setSuccess(msg); setError(''); }
    else { setError(msg); setSuccess(''); }
    setTimeout(() => { setSuccess(''); setError(''); }, 5000);
  };

  const handleCalcNomina = async () => {
    try {
      if (!calcForm.periodo_inicio || !calcForm.periodo_fin) {
        showMsg('Seleccione el periodo completo', 'error');
        return;
      }
      setLoading(true);
      const result = await api.calcularNomina(calcForm);
      showMsg(`Nómina calculada para ${result.total_calculadas} empleados`);
      setIsCalcModalOpen(false);
      fetchNominas();
    } catch (err) {
      showMsg(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePagar = async (id) => {
    const isConfirmed = await confirm({
      title: 'Pagar Nómina',
      message: '¿Marcar esta nómina como pagada? Esta acción no se puede revertir.',
      confirmText: 'Sí, pagar',
      type: 'info'
    });
    if (!isConfirmed) return;
    try {
      await api.pagarNomina(id);
      showMsg('Nómina marcada como pagada');
      fetchNominas();
    } catch (err) {
      showMsg(err.message, 'error');
    }
  };

  const handleCancelar = async (id) => {
    const isConfirmed = await confirm({
      title: 'Cancelar Nómina',
      message: '¿Cancelar esta nómina?',
      confirmText: 'Sí, cancelar',
      type: 'danger'
    });
    if (!isConfirmed) return;
    try {
      await api.cancelarNomina(id);
      showMsg('Nómina cancelada');
      fetchNominas();
    } catch (err) {
      showMsg(err.message, 'error');
    }
  };

  const handleVerDetalle = async (id) => {
    try {
      const data = await api.getDetalleNomina(id);
      setDetalleModal(data);
    } catch (err) {
      showMsg(err.message, 'error');
    }
  };

  const getStatusBadge = (estatus) => {
    switch (estatus) {
      case 'pendiente': return <span className="badge badge-warning">Pendiente</span>;
      case 'pagada': return <span className="badge badge-success">Pagada</span>;
      case 'cancelada': return <span className="badge badge-danger">Cancelada</span>;
      default: return <span className="badge">{estatus}</span>;
    }
  };

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount || 0);
  };

  // Quick period helpers
  const setQuincena = (half) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    if (half === 1) {
      setCalcForm({ ...calcForm, periodo_inicio: `${y}-${m}-01`, periodo_fin: `${y}-${m}-15` });
    } else {
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      setCalcForm({ ...calcForm, periodo_inicio: `${y}-${m}-16`, periodo_fin: `${y}-${m}-${lastDay}` });
    }
  };

  // Totals
  const totalPendiente = nominas.filter(n => n.estatus === 'pendiente').reduce((s, n) => s + n.total_pagar, 0);
  const totalPagado = nominas.filter(n => n.estatus === 'pagada').reduce((s, n) => s + n.total_pagar, 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nómina</h1>
          <p className="page-subtitle">Cálculo y gestión de pagos al personal</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setIsCalcModalOpen(true)}>
            Calcular Nómina
          </button>
        )}
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Summary Cards */}
      <div className="grid grid-3" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
          <p className="page-subtitle" style={{ margin: 0 }}>Total Registros</p>
          <h2 style={{ color: 'var(--color-accent)', margin: '0.5rem 0 0' }}>{nominas.length}</h2>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
          <p className="page-subtitle" style={{ margin: 0 }}>Pendiente de Pago</p>
          <h2 style={{ color: 'var(--color-warning)', margin: '0.5rem 0 0' }}>{formatMoney(totalPendiente)}</h2>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
          <p className="page-subtitle" style={{ margin: 0 }}>Total Pagado</p>
          <h2 style={{ color: 'var(--color-success)', margin: '0.5rem 0 0' }}>{formatMoney(totalPagado)}</h2>
        </div>
      </div>

      <div className="card toolbar">
        <div className="form-group">
          <label className="form-label">Estatus</label>
          <select className="form-input" value={filters.estatus}
            onChange={e => setFilters({ ...filters, estatus: e.target.value })}>
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagada">Pagada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Sucursal</label>
          <select className="form-input" value={filters.id_sucursal}
            onChange={e => setFilters({ ...filters, id_sucursal: e.target.value })}>
            <option value="">Todas</option>
            {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Periodo Desde</label>
          <input type="date" className="form-input" value={filters.periodo_inicio}
            onChange={e => setFilters({ ...filters, periodo_inicio: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">Periodo Hasta</label>
          <input type="date" className="form-input" value={filters.periodo_fin}
            onChange={e => setFilters({ ...filters, periodo_fin: e.target.value })} />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="spinner"></div>
        ) : nominas.length === 0 ? (
          <div className="empty-state">
            <p>No hay nóminas registradas con los filtros actuales.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Empleado</th>
                  <th>Sucursal</th>
                  <th>Periodo</th>
                  <th>Salario Base</th>
                  <th>H. Extra</th>
                  <th>Monto H.E.</th>
                  <th>Total</th>
                  <th>Estatus</th>
                  {canManage && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {nominas.map(n => (
                  <tr key={n.id}>
                    <td>#{n.id}</td>
                    <td>{n.nombre} {n.apellido_paterno}</td>
                    <td>{n.sucursal_nombre || '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{n.periodo_inicio} — {n.periodo_fin}</td>
                    <td>{formatMoney(n.salario_base)}</td>
                    <td>{n.horas_extra_autorizadas}h</td>
                    <td>{formatMoney(n.monto_horas_extra)}</td>
                    <td><strong>{formatMoney(n.total_pagar)}</strong></td>
                    <td>{getStatusBadge(n.estatus)}</td>
                    {canManage && (
                      <td>
                        <div className="action-buttons">
                          <button className="btn btn-secondary btn-sm" onClick={() => handleVerDetalle(n.id)}>
                            Detalle
                          </button>
                          {n.estatus === 'pendiente' && (
                            <>
                              <button className="btn btn-primary btn-sm" onClick={() => handlePagar(n.id)}>
                                Pagar
                              </button>
                              <button className="btn btn-danger btn-sm" onClick={() => handleCancelar(n.id)}>
                                Cancelar
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Calcular Nómina */}
      {isCalcModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="card-title">Calcular Nómina por Periodo</h2>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setQuincena(1)}>1ra Quincena</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setQuincena(2)}>2da Quincena</button>
              </div>
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">Periodo Inicio *</label>
                  <input type="date" className="form-input" value={calcForm.periodo_inicio}
                    onChange={e => setCalcForm({ ...calcForm, periodo_inicio: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Periodo Fin *</label>
                  <input type="date" className="form-input" value={calcForm.periodo_fin}
                    onChange={e => setCalcForm({ ...calcForm, periodo_fin: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Sucursal (Opcional)</label>
                <select className="form-input" value={calcForm.id_sucursal}
                  onChange={e => setCalcForm({ ...calcForm, id_sucursal: e.target.value })}>
                  <option value="">Todas las sucursales</option>
                  {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div className="alert alert-info">
                El cálculo incluye el salario base de cada empleado activo más las horas extra autorizadas en el periodo seleccionado. Las nóminas ya pagadas no se recalculan.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsCalcModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCalcNomina} disabled={loading}>
                {loading ? 'Calculando...' : 'Calcular'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalle Nómina */}
      {detalleModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="card-title">Detalle de Nómina #{detalleModal.id}</h2>
            </div>
            <div className="modal-body">
              <div className="grid grid-2" style={{ marginBottom: 'var(--space-md)' }}>
                <div>
                  <p><strong>Empleado:</strong> {detalleModal.nombre} {detalleModal.apellido_paterno} {detalleModal.apellido_materno || ''}</p>
                  <p><strong>Puesto:</strong> {detalleModal.puesto_nombre || '—'}</p>
                  <p><strong>RFC:</strong> {detalleModal.rfc || '—'}</p>
                </div>
                <div>
                  <p><strong>Sucursal:</strong> {detalleModal.sucursal_nombre || '—'}</p>
                  <p><strong>Periodo:</strong> {detalleModal.periodo_inicio} — {detalleModal.periodo_fin}</p>
                  <p><strong>Estatus:</strong> {getStatusBadge(detalleModal.estatus)}</p>
                </div>
              </div>

              <div className="card" style={{ background: 'var(--color-surface-alt)', padding: 'var(--space-md)' }}>
                <table className="table">
                  <tbody>
                    <tr>
                      <td><strong>Salario Base</strong></td>
                      <td style={{ textAlign: 'right' }}>{formatMoney(detalleModal.salario_base)}</td>
                    </tr>
                    <tr>
                      <td><strong>Horas Extra Autorizadas</strong></td>
                      <td style={{ textAlign: 'right' }}>{detalleModal.horas_extra_autorizadas || 0}h</td>
                    </tr>
                    <tr>
                      <td><strong>Monto Horas Extra</strong></td>
                      <td style={{ textAlign: 'right' }}>{formatMoney(detalleModal.monto_horas_extra)}</td>
                    </tr>
                    <tr style={{ borderTop: '2px solid var(--color-border)' }}>
                      <td><strong style={{ fontSize: '1.1em' }}>Total a Pagar</strong></td>
                      <td style={{ textAlign: 'right', fontSize: '1.1em', fontWeight: 'bold', color: 'var(--color-accent)' }}>
                        {formatMoney(detalleModal.total_pagar)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              {detalleModal.estatus === 'pendiente' && canManage && (
                <button className="btn btn-primary" onClick={() => { setDetalleModal(null); handlePagar(detalleModal.id); }}>
                  Marcar como Pagada
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setDetalleModal(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Nomina;
