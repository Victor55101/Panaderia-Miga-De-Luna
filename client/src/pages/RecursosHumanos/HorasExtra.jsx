import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';

function HorasExtra() {
  const { user } = useAuth();
  const { confirm } = useConfirmDialog();
  const [horasExtra, setHorasExtra] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Role checks
  const isAdmin = ['propietario', 'admin_sistema', 'recursos_humanos'].includes(user?.rol);
  const isManager = user?.rol === 'gerente_sucursal';
  const canManage = isAdmin || isManager;
  const isOperative = ['vendedor', 'repartidor', 'jefe_produccion'].includes(user?.rol);

  const [filters, setFilters] = useState({
    estatus: '',
    id_empleado: '',
    id_sucursal: ''
  });

  const [formData, setFormData] = useState({
    id_empleado: '',
    fecha: new Date().toISOString().split('T')[0],
    cantidad_horas: '',
    motivo: ''
  });

  useEffect(() => {
    fetchHorasExtra();
    if (canManage) {
      fetchEmpleados();
      if (isAdmin) fetchSucursales();
    }
  }, []);

  useEffect(() => {
    fetchHorasExtra();
  }, [filters]);

  const fetchHorasExtra = async () => {
    try {
      setLoading(true);
      const query = { ...filters };
      Object.keys(query).forEach(k => { if (!query[k]) delete query[k]; });
      const data = await api.getHorasExtra(query);
      setHorasExtra(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Error al cargar horas extra');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmpleados = async () => {
    try {
      const data = await api.getEmpleados({ estatus: 'activo' });
      setEmpleados(Array.isArray(data) ? data : data.data || []);
    } catch (err) { console.error(err); }
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
    setTimeout(() => { setSuccess(''); setError(''); }, 4000);
  };

  const handleCreate = async () => {
    try {
      const payload = { ...formData };

      // Operative roles: force own id_empleado (backend also enforces)
      if (isOperative) payload.id_empleado = user.id_empleado;

      if (!payload.id_empleado || !payload.cantidad_horas) {
        showMsg('Empleado y cantidad de horas son requeridos', 'error');
        return;
      }
      if (parseFloat(payload.cantidad_horas) <= 0) {
        showMsg('Las horas extra deben ser mayor a cero', 'error');
        return;
      }
      await api.createHorasExtra(payload);
      showMsg('Solicitud de horas extra registrada');
      setIsModalOpen(false);
      setFormData({ id_empleado: '', fecha: new Date().toISOString().split('T')[0], cantidad_horas: '', motivo: '' });
      fetchHorasExtra();
    } catch (err) {
      showMsg(err.message, 'error');
    }
  };

  const handleAutorizar = async (id) => {
    const isConfirmed = await confirm({
      title: 'Autorizar Horas Extra',
      message: '¿Autorizar estas horas extra?',
      confirmText: 'Sí, autorizar',
      type: 'info'
    });
    if (!isConfirmed) return;
    try {
      await api.autorizarHorasExtra(id);
      showMsg('Horas extra autorizadas');
      fetchHorasExtra();
    } catch (err) {
      showMsg(err.message, 'error');
    }
  };

  const handleRechazar = async (id) => {
    const isConfirmed = await confirm({
      title: 'Rechazar Horas Extra',
      message: '¿Rechazar estas horas extra?',
      confirmText: 'Sí, rechazar',
      type: 'danger'
    });
    if (!isConfirmed) return;
    try {
      await api.rechazarHorasExtra(id);
      showMsg('Horas extra rechazadas');
      fetchHorasExtra();
    } catch (err) {
      showMsg(err.message, 'error');
    }
  };

  const getStatusBadge = (estatus) => {
    switch (estatus) {
      case 'pendiente': return <span className="badge badge-warning">Pendiente</span>;
      case 'autorizada': return <span className="badge badge-success">Autorizada</span>;
      case 'rechazada': return <span className="badge badge-danger">Rechazada</span>;
      default: return <span className="badge">{estatus}</span>;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isOperative ? 'Mis Horas Extra' : 'Horas Extra'}</h1>
          <p className="page-subtitle">
            {isOperative 
              ? 'Solicita y consulta tus horas extra'
              : 'Gestión de solicitudes y autorizaciones de tiempo extra'}
          </p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            Nueva Solicitud
          </button>
        </div>
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Filters - only for managers/admins */}
      {canManage && (
        <div className="card toolbar">
          <div className="form-group">
            <label className="form-label">Estatus</label>
            <select className="form-input" value={filters.estatus}
              onChange={e => setFilters({ ...filters, estatus: e.target.value })}>
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="autorizada">Autorizada</option>
              <option value="rechazada">Rechazada</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Empleado</label>
            <select className="form-input" value={filters.id_empleado}
              onChange={e => setFilters({ ...filters, id_empleado: e.target.value })}>
              <option value="">Todos</option>
              {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre} {e.apellido_paterno}</option>)}
            </select>
          </div>
          {isAdmin && (
            <div className="form-group">
              <label className="form-label">Sucursal</label>
              <select className="form-input" value={filters.id_sucursal}
                onChange={e => setFilters({ ...filters, id_sucursal: e.target.value })}>
                <option value="">Todas</option>
                {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="spinner"></div>
        ) : horasExtra.length === 0 ? (
          <div className="empty-state">
            <p>{isOperative ? 'No tienes solicitudes de horas extra.' : 'No hay registros de horas extra con los filtros actuales.'}</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  {!isOperative && <th>Empleado</th>}
                  {!isOperative && <th>Sucursal</th>}
                  <th>Fecha</th>
                  <th>Horas</th>
                  <th>Motivo</th>
                  <th>Estatus</th>
                  <th>Autorizador</th>
                  {canManage && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {horasExtra.map(he => (
                  <tr key={he.id}>
                    <td>#{he.id}</td>
                    {!isOperative && <td>{he.nombre} {he.apellido_paterno}</td>}
                    {!isOperative && <td>{he.sucursal_nombre || '—'}</td>}
                    <td>{he.fecha}</td>
                    <td><strong>{he.cantidad_horas}h</strong></td>
                    <td>{he.motivo || '—'}</td>
                    <td>{getStatusBadge(he.estatus)}</td>
                    <td>{he.autorizador_nombre ? `${he.autorizador_nombre} ${he.autorizador_apellido || ''}` : '—'}</td>
                    {canManage && (
                      <td>
                        {he.estatus === 'pendiente' && (
                          <div className="action-buttons">
                            <button className="btn btn-primary btn-sm" onClick={() => handleAutorizar(he.id)}>
                              Autorizar
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => handleRechazar(he.id)}>
                              Rechazar
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Nueva Solicitud */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 className="card-title">Nueva Solicitud de Horas Extra</h2>
            </div>
            <div className="modal-body">
              {canManage ? (
                <div className="form-group">
                  <label className="form-label">Empleado *</label>
                  <select className="form-input" value={formData.id_empleado}
                    onChange={e => setFormData({ ...formData, id_empleado: e.target.value })}>
                    <option value="">Seleccione...</option>
                    {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre} {e.apellido_paterno}</option>)}
                  </select>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Empleado</label>
                  <input type="text" className="form-input" value={user?.nombre || ''} disabled />
                </div>
              )}
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">Fecha *</label>
                  <input type="date" className="form-input" value={formData.fecha}
                    onChange={e => setFormData({ ...formData, fecha: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cantidad de Horas *</label>
                  <input type="number" step="0.5" min="0.5" className="form-input" value={formData.cantidad_horas}
                    placeholder="Ej: 2.5"
                    onChange={e => setFormData({ ...formData, cantidad_horas: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Motivo</label>
                <textarea className="form-input" rows="3" value={formData.motivo}
                  placeholder="Describe el motivo de las horas extra..."
                  onChange={e => setFormData({ ...formData, motivo: e.target.value })}></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleCreate}>Registrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HorasExtra;
