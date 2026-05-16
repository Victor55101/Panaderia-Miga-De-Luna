import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

function Asistencia() {
  const { user } = useAuth();
  const [asistencias, setAsistencias] = useState([]);
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
    fecha: new Date().toISOString().split('T')[0],
    id_empleado: '',
    id_sucursal: '',
    incidencia: ''
  });

  const [manualForm, setManualForm] = useState({
    id_empleado: '',
    fecha: new Date().toISOString().split('T')[0],
    hora_entrada: '07:00',
    hora_salida: '15:00',
    incidencia: 'asistencia'
  });

  useEffect(() => {
    fetchAsistencias();
    if (canManage) {
      fetchEmpleados();
      fetchSucursales();
    }
  }, []);

  useEffect(() => {
    fetchAsistencias();
  }, [filters]);

  const fetchAsistencias = async () => {
    try {
      setLoading(true);
      const query = { ...filters };
      Object.keys(query).forEach(k => { if (!query[k]) delete query[k]; });
      const data = await api.getAsistencias(query);
      setAsistencias(data);
      setError('');
    } catch (err) {
      setError(err.message || 'Error al cargar asistencias');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmpleados = async () => {
    try {
      const data = await api.getEmpleados({ estatus: 'activo' });
      const list = Array.isArray(data) ? data : data.data || [];
      setEmpleados(list);
    } catch (err) { console.error(err); }
  };

  const fetchSucursales = async () => {
    try {
      const data = await api.getSucursales({ activo: 1 });
      const list = Array.isArray(data) ? data : data.data || [];
      setSucursales(list);
    } catch (err) { console.error(err); }
  };

  const showMsg = (msg, type = 'success') => {
    if (type === 'success') { setSuccess(msg); setError(''); }
    else { setError(msg); setSuccess(''); }
    setTimeout(() => { setSuccess(''); setError(''); }, 4000);
  };

  // Self-registration for operative roles
  const handleMyEntrada = async () => {
    try {
      const res = await api.registrarEntrada({});
      showMsg(`Entrada registrada: ${res.hora_entrada} (${res.incidencia})`);
      fetchAsistencias();
    } catch (err) {
      showMsg(err.message, 'error');
    }
  };

  const handleMySalida = async () => {
    try {
      const res = await api.registrarSalida({});
      showMsg(`Salida registrada: ${res.hora_salida} — ${res.horas_trabajadas}h trabajadas`);
      fetchAsistencias();
    } catch (err) {
      showMsg(err.message, 'error');
    }
  };

  // Quick registration for admin/manager
  const handleEntrada = async (idEmpleado) => {
    try {
      const res = await api.registrarEntrada({ id_empleado: idEmpleado });
      showMsg(`Entrada registrada: ${res.hora_entrada} (${res.incidencia})`);
      fetchAsistencias();
    } catch (err) {
      showMsg(err.message, 'error');
    }
  };

  const handleSalida = async (idEmpleado) => {
    try {
      const res = await api.registrarSalida({ id_empleado: idEmpleado });
      showMsg(`Salida registrada: ${res.hora_salida} — ${res.horas_trabajadas}h trabajadas`);
      fetchAsistencias();
    } catch (err) {
      showMsg(err.message, 'error');
    }
  };

  const handleManualSave = async () => {
    try {
      if (!manualForm.id_empleado) { showMsg('Seleccione un empleado', 'error'); return; }
      await api.registrarAsistenciaManual(manualForm);
      showMsg('Asistencia manual registrada correctamente');
      setIsModalOpen(false);
      fetchAsistencias();
    } catch (err) {
      showMsg(err.message, 'error');
    }
  };

  const getIncidenciaBadge = (inc) => {
    switch (inc) {
      case 'asistencia': return <span className="badge badge-success">Asistencia</span>;
      case 'retardo': return <span className="badge badge-warning">Retardo</span>;
      case 'falta': return <span className="badge badge-danger">Falta</span>;
      case 'salida_anticipada': return <span className="badge badge-info">Salida Anticipada</span>;
      default: return <span className="badge">{inc}</span>;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{isOperative ? 'Mi Asistencia' : 'Control de Asistencia'}</h1>
          <p className="page-subtitle">
            {isOperative 
              ? 'Registra tu entrada y salida' 
              : 'Registro de entradas, salidas e incidencias del personal'}
          </p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            Registro Manual
          </button>
        )}
      </div>

      {success && <div className="alert alert-success">{success}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Self-registration for operative roles */}
      {isOperative && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>Registrar mi asistencia</h3>
          <p className="text-secondary" style={{ marginBottom: 'var(--space-md)', fontSize: '14px' }}>
            {user?.nombre} — {user?.sucursal_nombre || 'Sin sucursal'}
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <button className="btn btn-primary" onClick={handleMyEntrada}>
              Registrar mi Entrada
            </button>
            <button className="btn btn-secondary" onClick={handleMySalida}>
              Registrar mi Salida
            </button>
          </div>
        </div>
      )}

      {/* Filters only for managers/admins */}
      {canManage && (
        <div className="card toolbar">
          <div className="form-group">
            <label className="form-label">Fecha</label>
            <input type="date" className="form-input" value={filters.fecha}
              onChange={e => setFilters({ ...filters, fecha: e.target.value })} />
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
          <div className="form-group">
            <label className="form-label">Incidencia</label>
            <select className="form-input" value={filters.incidencia}
              onChange={e => setFilters({ ...filters, incidencia: e.target.value })}>
              <option value="">Todas</option>
              <option value="asistencia">Asistencia</option>
              <option value="retardo">Retardo</option>
              <option value="falta">Falta</option>
              <option value="salida_anticipada">Salida Anticipada</option>
            </select>
          </div>
        </div>
      )}

      {/* Quick Actions - only for managers/admins */}
      {canManage && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>Registro Rápido</h3>
          <div className="grid grid-3" style={{ alignItems: 'end' }}>
            <div className="form-group">
              <label className="form-label">Empleado</label>
              <select className="form-input" id="quick-emp"
                defaultValue="">
                <option value="">Seleccione...</option>
                {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre} {e.apellido_paterno}</option>)}
              </select>
            </div>
            <div className="form-group">
              <button className="btn btn-primary" style={{ width: '100%' }}
                onClick={() => {
                  const sel = document.getElementById('quick-emp').value;
                  if (!sel) { showMsg('Seleccione un empleado', 'error'); return; }
                  handleEntrada(parseInt(sel));
                }}>
                Registrar Entrada
              </button>
            </div>
            <div className="form-group">
              <button className="btn btn-secondary" style={{ width: '100%' }}
                onClick={() => {
                  const sel = document.getElementById('quick-emp').value;
                  if (!sel) { showMsg('Seleccione un empleado', 'error'); return; }
                  handleSalida(parseInt(sel));
                }}>
                Registrar Salida
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="spinner"></div>
        ) : asistencias.length === 0 ? (
          <div className="empty-state">
            <p>{isOperative ? 'No tienes registros de asistencia para hoy.' : 'No hay registros de asistencia para los filtros seleccionados.'}</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  {!isOperative && <th>Empleado</th>}
                  {!isOperative && <th>Sucursal</th>}
                  <th>Fecha</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Horas</th>
                  <th>Incidencia</th>
                </tr>
              </thead>
              <tbody>
                {asistencias.map(a => (
                  <tr key={a.id}>
                    {!isOperative && <td>{a.nombre} {a.apellido_paterno}</td>}
                    {!isOperative && <td>{a.sucursal_nombre || '—'}</td>}
                    <td>{a.fecha}</td>
                    <td>{a.hora_entrada || '—'}</td>
                    <td>{a.hora_salida || '—'}</td>
                    <td>{a.horas_trabajadas ? `${a.horas_trabajadas}h` : '—'}</td>
                    <td>{getIncidenciaBadge(a.incidencia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Manual - only for managers/admins */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h2 className="card-title">Registro Manual de Asistencia</h2>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Empleado *</label>
                <select className="form-input" value={manualForm.id_empleado}
                  onChange={e => setManualForm({ ...manualForm, id_empleado: e.target.value })}>
                  <option value="">Seleccione...</option>
                  {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre} {e.apellido_paterno}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Fecha *</label>
                <input type="date" className="form-input" value={manualForm.fecha}
                  onChange={e => setManualForm({ ...manualForm, fecha: e.target.value })} />
              </div>
              <div className="grid grid-2">
                <div className="form-group">
                  <label className="form-label">Hora Entrada</label>
                  <input type="time" className="form-input" value={manualForm.hora_entrada}
                    onChange={e => setManualForm({ ...manualForm, hora_entrada: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Hora Salida</label>
                  <input type="time" className="form-input" value={manualForm.hora_salida}
                    onChange={e => setManualForm({ ...manualForm, hora_salida: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Incidencia</label>
                <select className="form-input" value={manualForm.incidencia}
                  onChange={e => setManualForm({ ...manualForm, incidencia: e.target.value })}>
                  <option value="asistencia">Asistencia Normal</option>
                  <option value="retardo">Retardo</option>
                  <option value="falta">Falta</option>
                  <option value="salida_anticipada">Salida Anticipada</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleManualSave}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Asistencia;
