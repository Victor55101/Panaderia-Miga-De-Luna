import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Star, BookOpen, Activity, FileText, X, Save, Shield, Settings, History, Calendar, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function ProductoEstrella() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [estrellas, setEstrellas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [activeEstrella, setActiveEstrella] = useState(null);
  const [historial, setHistorial] = useState([]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [estrellaData, setEstrellaData] = useState({
    receta_base: '',
    ingredientes: '',
    gramaje_aprox: 0,
    tiempo_horneado_min: 0,
    temperatura_c: 0,
    instrucciones_presentacion: '',
    version: '1.0'
  });

  const canEditRecetas = ['propietario', 'admin_sistema', 'jefe_produccion'].includes(user?.rol);

  useEffect(() => {
    fetchEstrellas();
  }, []);

  async function fetchEstrellas() {
    try {
      setLoading(true);
      const res = await api.getProductos({ limit: 1000 });
      const products = Array.isArray(res) ? res : (res.data || []);
      const starProducts = products.filter(p => Boolean(p.es_estrella));
      setEstrellas(starProducts);
      if (starProducts.length > 0) {
        handleSelectEstrella(starProducts[0]);
      }
    } catch (err) {
      setError('Error al cargar productos estrella');
    } finally {
      setLoading(false);
    }
  }

  const handleSelectEstrella = async (prod) => {
    setActiveEstrella(prod);
    setIsEditing(false);
    try {
      const data = await api.getEspecificaciones(prod.id);
      setEstrellaData(data.id ? data : {
        receta_base: '',
        ingredientes: '',
        gramaje_aprox: 0,
        tiempo_horneado_min: 0,
        temperatura_c: 0,
        instrucciones_presentacion: '',
        version: '1.0'
      });
      const hist = await api.getHistorialEspecificaciones(prod.id);
      setHistorial(Array.isArray(hist) ? hist : (hist.data || []));
    } catch (err) {
      setError('Error al cargar el detalle del producto');
    }
  };

  const handleSaveSpecs = async (e) => {
    e.preventDefault();
    try {
      await api.updateEspecificaciones(activeEstrella.id, estrellaData);
      setIsEditing(false);
      showToast('Especificaciones guardadas exitosamente y nueva versión generada.', 'success');
      handleSelectEstrella(activeEstrella);
    } catch (err) {
      setError(err.message || 'Error al guardar especificaciones');
    }
  };

  return (
    <div className="page-container fade-in">
      <div className="toolbar">
        <div>
          <h1>Producto Estrella</h1>
          <p className="text-secondary">Estandarización para franquicias</p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          {estrellas.length > 1 && (
            <select 
              className="form-input" 
              value={activeEstrella?.id || ''}
              onChange={e => {
                const selected = estrellas.find(p => p.id === parseInt(e.target.value));
                if (selected) handleSelectEstrella(selected);
              }}
            >
              {estrellas.map(prod => (
                <option key={prod.id} value={prod.id}>{prod.nombre}</option>
              ))}
            </select>
          )}
          {canEditRecetas && activeEstrella && !isEditing && (
            <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
              <Settings size={18} /> Gestionar especificación
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 'var(--space-lg)' }}>
          <X size={20} style={{ marginRight: 'var(--space-sm)' }} /> {error}
        </div>
      )}

      {loading ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div style={{ height: '80px', backgroundColor: 'var(--color-surface-alt)', borderRadius: 'var(--radius-lg)' }} />
          <div style={{ height: '24px', backgroundColor: 'var(--color-surface-alt)', borderRadius: 'var(--radius-sm)', width: '75%' }} />
          <div style={{ height: '16px', backgroundColor: 'var(--color-surface-alt)', borderRadius: 'var(--radius-sm)', width: '50%' }} />
          <div style={{ marginTop: 'var(--space-md)' }}>
            <Star size={64} style={{ margin: '0 auto', color: 'var(--color-border)', marginBottom: 'var(--space-md)' }} />
          </div>
        </div>
      ) : !activeEstrella ? (
        <div className="card text-center" style={{ padding: '4rem 2rem' }}>
          <Star size={64} style={{ margin: '0 auto', color: 'var(--color-border)', marginBottom: 'var(--space-md)' }} />
          <h3>Sin Productos Estrella</h3>
          <p className="text-secondary">Marca un producto como estrella en el catálogo general.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xl)' }}>
            
            {/* Tarjeta principal */}
            <div className="card" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', height: 'fit-content' }}>
              <div style={{ height: '6px', width: '100%', backgroundColor: 'var(--color-accent)' }}></div>
              <div style={{ padding: 'var(--space-xl)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
                  <div style={{ position: 'relative' }}>
                    {activeEstrella.imagen ? (
                      <img src={activeEstrella.imagen} alt={activeEstrella.nombre} style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />
                    ) : (
                      <div style={{ width: '80px', height: '80px', backgroundColor: 'var(--color-surface-alt)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-accent)' }}>
                        <BookOpen size={32} />
                      </div>
                    )}
                    <span className="badge badge-info" style={{ position: 'absolute', bottom: '-10px', right: '-10px', fontSize: '10px' }}>
                      <Star size={10} style={{ marginRight: '4px' }} /> ESTRELLA
                    </span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--color-accent)' }}>{activeEstrella.nombre}</h3>
                    <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: '4px' }}>
                      <span className="badge badge-accent">{activeEstrella.categoria_nombre}</span>
                      <span className="badge badge-star">Producto Estrella</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)' }}>
                    <span className="text-secondary" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}><Activity size={14} /> Estatus</span>
                    <span className="badge badge-success" style={{ fontSize: '11px' }}><CheckCircle size={10} style={{ marginRight: '4px' }}/> VIGENTE</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)' }}>
                    <span className="text-secondary" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}><FileText size={14} /> Versión Actual</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--color-text)' }}>v{estrellaData.version || '1.0'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 'var(--space-sm)', borderBottom: '1px solid var(--color-border)' }}>
                    <span className="text-secondary" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> Última Actual.</span>
                    <span style={{ fontWeight: '500', color: 'var(--color-text)', fontSize: '13px' }}>
                      {historial[0] ? new Date(historial[0].created_at).toLocaleDateString() : 'Sin registro'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="text-secondary" style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}><Shield size={14} /> Responsable</span>
                    <span style={{ fontWeight: '500', color: 'var(--color-text)', fontSize: '13px' }}>
                      {historial[0] ? historial[0].username : 'Sistema'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Especificación técnica */}
            <div style={{ flex: '2 1 500px' }} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}><FileText size={20} color="var(--color-accent)" /> Especificación Técnica</h3>
                {isEditing && (
                  <span className="badge badge-warning">Modo Edición</span>
                )}
              </div>
              
              <form onSubmit={handleSaveSpecs}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                  <div className="form-group">
                    <label className="form-label">Gramaje Aprox. (g)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={estrellaData.gramaje_aprox || ''}
                      onChange={e => setEstrellaData({...estrellaData, gramaje_aprox: parseFloat(e.target.value) || 0})}
                      disabled={!isEditing}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tiempo (min)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={estrellaData.tiempo_horneado_min || ''}
                      onChange={e => setEstrellaData({...estrellaData, tiempo_horneado_min: parseInt(e.target.value) || 0})}
                      disabled={!isEditing}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Temp. (°C)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={estrellaData.temperatura_c || ''}
                      onChange={e => setEstrellaData({...estrellaData, temperatura_c: parseFloat(e.target.value) || 0})}
                      disabled={!isEditing}
                      required
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                  <label className="form-label">Ingredientes Principales</label>
                  <textarea 
                    className="form-input" 
                    style={{ minHeight: '60px', resize: 'vertical' }}
                    value={estrellaData.ingredientes || ''}
                    onChange={e => setEstrellaData({...estrellaData, ingredientes: e.target.value})}
                    disabled={!isEditing}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
                  <label className="form-label">Receta Base</label>
                  <textarea 
                    className="form-input" 
                    style={{ minHeight: '100px', resize: 'vertical' }}
                    value={estrellaData.receta_base || ''}
                    onChange={e => setEstrellaData({...estrellaData, receta_base: e.target.value})}
                    disabled={!isEditing}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 'var(--space-lg)' }}>
                  <label className="form-label">Instrucciones de Presentación / Observaciones</label>
                  <textarea 
                    className="form-input" 
                    style={{ minHeight: '60px', resize: 'vertical' }}
                    value={estrellaData.instrucciones_presentacion || ''}
                    onChange={e => setEstrellaData({...estrellaData, instrucciones_presentacion: e.target.value})}
                    disabled={!isEditing}
                  />
                </div>

                {isEditing && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-md)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--color-border)' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => handleSelectEstrella(activeEstrella)}>Cancelar</button>
                    <button type="submit" className="btn btn-primary">
                      <Save size={18} /> Guardar Nueva Versión
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Historial de versiones */}
          <div className="card">
            <div style={{ marginBottom: 'var(--space-lg)' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}><History size={20} color="var(--color-accent)" /> Historial de Versiones</h3>
            </div>
             
             {historial.length === 0 ? (
                <div className="text-center text-secondary" style={{ padding: '2rem 0' }}>
                  No hay historial de versiones para este producto.
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Versión</th>
                        <th>Fecha</th>
                        <th>Responsable</th>
                        <th>Cambios Relevantes</th>
                        <th>Estatus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historial.map((hist, idx) => (
                        <tr key={hist.id}>
                          <td style={{ fontWeight: 'bold' }}>v{hist.version || '1.0'}</td>
                          <td>{new Date(hist.created_at).toLocaleDateString()} {new Date(hist.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                          <td>{hist.username || 'Sistema'}</td>
                          <td>
                            <div style={{ fontSize: '12px', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {hist.receta_base}
                            </div>
                            <div className="text-secondary" style={{ fontSize: '11px' }}>
                              {hist.gramaje_aprox}g | {hist.temperatura_c}°C | {hist.tiempo_horneado_min}min
                            </div>
                          </td>
                          <td>
                            {idx === 0 ? (
                              <span className="badge badge-success">Vigente</span>
                            ) : (
                              <span className="badge badge-secondary">No vigente</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
