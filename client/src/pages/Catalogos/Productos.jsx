import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Search, Edit2, Trash2, Package, Star, DollarSign, Tag, Info, Save, ChevronLeft, ChevronRight, Scale } from 'lucide-react';
import Modal from '../../components/Common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';

export default function Productos() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterType, setFilterType] = useState('all');

  const canManage = ['propietario', 'admin_sistema'].includes(user?.rol);
  const canEditRecetas = ['propietario', 'admin_sistema', 'jefe_produccion'].includes(user?.rol);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEstrellaModalOpen, setIsEstrellaModalOpen] = useState(false);
  const [editingProducto, setEditingProducto] = useState(null);
  
  const [formData, setFormData] = useState({
    nombre: '',
    id_categoria: '',
    tipo: 'pan_dulce',
    unidad_medida: 'pieza',
    costo: 0,
    precio: 0,
    es_estrella: 0,
    activo: 1
  });

  const [estrellaData, setEstrellaData] = useState({
    receta_base: '',
    ingredientes: '',
    gramaje_aprox: 0,
    tiempo_horneado_min: 0,
    temperatura_c: 0,
    instrucciones_presentacion: '',
    version: '1.0'
  });

  useEffect(() => {
    fetchData();
  }, [page, filterCat, filterType]);

  async function fetchData() {
    try {
      setLoading(true);
      const [prodsRes, cats] = await Promise.all([
        api.getProductos({ page, limit: 10, search, categoria: filterCat, tipo: filterType }),
        api.getCategorias()
      ]);
      setProductos(prodsRes.data);
      setTotal(prodsRes.total);
      setCategorias(cats);
    } catch (err) {
      setError('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchData();
  };

  const handleOpenModal = (producto = null) => {
    if (producto) {
      setEditingProducto(producto);
      setFormData({ ...producto });
    } else {
      setEditingProducto(null);
      setFormData({
        nombre: '',
        id_categoria: categorias[0]?.id || '',
        tipo: 'pan_dulce',
        unidad_medida: 'pieza',
        costo: 0,
        precio: 0,
        es_estrella: 0,
        activo: 1
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenEstrellaModal = async (producto) => {
    setEditingProducto(producto);
    try {
      const data = await api.getEspecificaciones(producto.id);
      setEstrellaData(data.id ? data : {
        receta_base: '',
        ingredientes: '',
        gramaje_aprox: 0,
        tiempo_horneado_min: 0,
        temperatura_c: 0,
        instrucciones_presentacion: '',
        version: '1.0'
      });
      setIsEstrellaModalOpen(true);
    } catch (err) {
      setError('Error al cargar especificaciones');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (formData.precio < formData.costo) {
      const isConfirmed = await confirm({
        title: 'Aviso de Margen',
        message: 'El precio de venta es menor al costo. ¿Desea continuar?',
        confirmText: 'Sí, continuar',
        type: 'warning'
      });
      if (!isConfirmed) return;
    }
    try {
      if (editingProducto) {
        await api.updateProducto(editingProducto.id, formData);
      } else {
        await api.createProducto(formData);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    }
  };

  const handleSaveEstrella = async (e) => {
    e.preventDefault();
    try {
      await api.updateEspecificaciones(editingProducto.id, estrellaData);
      setIsEstrellaModalOpen(false);
      showToast('Especificaciones guardadas y nueva versión generada.', 'success');
    } catch (err) {
      setError('Error al guardar especificaciones');
    }
  };

  const handleDelete = async (id) => {
    const isConfirmed = await confirm({
      title: 'Desactivar Producto',
      message: '¿Está seguro de desactivar este producto?',
      confirmText: 'Sí, desactivar',
      type: 'danger'
    });
    if (!isConfirmed) return;
    try {
      await api.deleteProducto(id);
      fetchData();
    } catch (err) {
      setError(err.message || 'Error al desactivar');
    }
  };

  const filteredProductos = productos.filter(p => {
    const matchesSearch = p.nombre.toLowerCase().includes(search.toLowerCase());
    const matchesCat = filterCat === 'all' || p.id_categoria === parseInt(filterCat);
    const matchesType = filterType === 'all' || p.tipo === filterType;
    return matchesSearch && matchesCat && matchesType;
  });

  return (
    <div className="page-container fade-in">
      <div className="toolbar">
        <div>
          <h1>Catálogo de Productos</h1>
          <p className="text-secondary">Gestión de pan blanco, dulce y repostería</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={18} /> Nuevo Producto
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <form className="search-bar" style={{ flex: 1 }} onSubmit={handleSearch}>
            <Search className="search-icon" size={18} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Buscar por nombre..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </form>
          <div className="toolbar-actions">
            <select className="form-input" value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1); }}>
              <option value="all">Todas las categorías</option>
              {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <select className="form-input" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1); }}>
              <option value="all">Todos los tipos</option>
              <option value="pan_blanco">Pan Blanco</option>
              <option value="pan_dulce">Pan Dulce</option>
              <option value="reposteria">Repostería</option>
            </select>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

      <div className="table-container card" style={{ padding: 0 }}>
        {loading ? (
          <div className="spinner"></div>
        ) : productos.length > 0 ? (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Costo / Precio</th>
                  <th>Margen</th>
                  <th>Estatus</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productos.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="stat-icon" style={{ 
                          background: p.es_estrella ? 'var(--color-base)' : 'var(--color-surface-alt)', 
                          color: p.es_estrella ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                          width: '32px', height: '32px', borderRadius: '8px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {p.es_estrella ? <Star size={16} fill="currentColor" /> : <Package size={16} />}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{p.nombre}</div>
                          <div style={{ fontSize: '12px', color: 'var(--color-text-light)' }}>
                            {p.tipo.replace('_', ' ')} · {p.unidad_medida}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-info">{p.categoria_nombre}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>${p.precio.toFixed(2)}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-light)' }}>Costo: ${p.costo.toFixed(2)}</div>
                    </td>
                    <td>
                      <span style={{ color: p.precio > p.costo ? 'var(--color-success)' : 'var(--color-error)' }}>
                        {p.costo > 0 ? (((p.precio - p.costo) / p.precio) * 100).toFixed(1) : 100}%
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${p.activo ? 'badge-success' : 'badge-error'}`}>
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <div className="toolbar-actions">
                        {p.es_estrella === 1 && canEditRecetas && (
                          <button className="btn-icon" title="Receta y Especificaciones" onClick={() => handleOpenEstrellaModal(p)}>
                            <Info size={16} />
                          </button>
                        )}
                        {canManage && (
                          <button className="btn-icon" onClick={() => handleOpenModal(p)}>
                            <Edit2 size={16} />
                          </button>
                        )}
                        {canManage && p.activo === 1 && (
                          <button className="btn-icon" onClick={() => handleDelete(p.id)} style={{ color: 'var(--color-error)' }}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pagination" style={{ padding: 'var(--space-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--color-surface-alt)' }}>
              <span className="text-secondary" style={{ fontSize: '14px' }}>
                Mostrando {productos.length} de {total} resultados
              </span>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft size={16} /> Anterior
                </button>
                <button className="btn btn-secondary" disabled={page * 10 >= total} onClick={() => setPage(page + 1)}>
                  Siguiente <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <Package size={48} />
            <p>No se encontraron productos</p>
          </div>
        )}
      </div>

      {/* Producto Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingProducto ? 'Editar Producto' : 'Nuevo Producto'}>
        <form onSubmit={handleSave} className="login-form" style={{ padding: 0 }}>
          <div className="form-group">
            <label className="form-label">Nombre del Producto</label>
            <input className="form-input" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-input" required value={formData.id_categoria} onChange={e => setFormData({...formData, id_categoria: e.target.value})}>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo</label>
              <select className="form-input" value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})}>
                <option value="pan_blanco">Pan Blanco</option>
                <option value="pan_dulce">Pan Dulce</option>
                <option value="reposteria">Repostería</option>
                <option value="otro">Otro</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Unidad</label>
              <select className="form-input" value={formData.unidad_medida} onChange={e => setFormData({...formData, unidad_medida: e.target.value})}>
                <option value="pieza">Pieza</option>
                <option value="kg">Kilogramo</option>
                <option value="paquete">Paquete</option>
                <option value="litro">Litro</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">Costo de Producción</label>
              <div style={{ position: 'relative' }}>
                <DollarSign size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--color-text-light)' }} />
                <input type="number" step="0.01" className="form-input" style={{ paddingLeft: '2rem' }} value={formData.costo} onChange={e => setFormData({...formData, costo: parseFloat(e.target.value)})} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Precio de Venta</label>
              <div style={{ position: 'relative' }}>
                <DollarSign size={14} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--color-text-light)' }} />
                <input type="number" step="0.01" className="form-input" style={{ paddingLeft: '2rem' }} value={formData.precio} onChange={e => setFormData({...formData, precio: parseFloat(e.target.value)})} />
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">¿Es Producto Estrella?</label>
              <select className="form-input" value={formData.es_estrella} onChange={e => setFormData({...formData, es_estrella: parseInt(e.target.value)})}>
                <option value={0}>No</option>
                <option value={1}>Sí</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Estatus</label>
              <select className="form-input" value={formData.activo} onChange={e => setFormData({...formData, activo: parseInt(e.target.value)})}>
                <option value={1}>Activo</option>
                <option value={0}>Inactivo</option>
              </select>
            </div>
          </div>
          <div className="modal-footer" style={{ marginTop: 'var(--space-lg)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>

      {/* Producto Estrella Modal */}
      <Modal isOpen={isEstrellaModalOpen} onClose={() => setIsEstrellaModalOpen(false)} title={`Especificaciones: ${editingProducto?.nombre}`}>
        <form onSubmit={handleSaveEstrella} className="login-form" style={{ padding: 0 }}>
          <div className="form-group">
            <label className="form-label">Receta Base</label>
            <textarea className="form-input" rows="3" value={estrellaData.receta_base} onChange={e => setEstrellaData({...estrellaData, receta_base: e.target.value})} placeholder="Descripción técnica de la preparación..." />
          </div>
          <div className="form-group">
            <label className="form-label">Ingredientes Clave</label>
            <textarea className="form-input" rows="2" value={estrellaData.ingredientes} onChange={e => setEstrellaData({...estrellaData, ingredientes: e.target.value})} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="form-label">Gramaje (g)</label>
              <input type="number" className="form-input" value={estrellaData.gramaje_aprox} onChange={e => setEstrellaData({...estrellaData, gramaje_aprox: parseFloat(e.target.value)})} />
            </div>
            <div className="form-group">
              <label className="form-label">Tiempo (min)</label>
              <input type="number" className="form-input" value={estrellaData.tiempo_horneado_min} onChange={e => setEstrellaData({...estrellaData, tiempo_horneado_min: parseInt(e.target.value)})} />
            </div>
            <div className="form-group">
              <label className="form-label">Temp (°C)</label>
              <input type="number" className="form-input" value={estrellaData.temperatura_c} onChange={e => setEstrellaData({...estrellaData, temperatura_c: parseInt(e.target.value)})} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Instrucciones de Presentación</label>
            <textarea className="form-input" rows="2" value={estrellaData.instrucciones_presentacion} onChange={e => setEstrellaData({...estrellaData, instrucciones_presentacion: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Versión de Receta</label>
            <input className="form-input" value={estrellaData.version} onChange={e => setEstrellaData({...estrellaData, version: e.target.value})} />
          </div>
          <div className="modal-footer" style={{ marginTop: 'var(--space-lg)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsEstrellaModalOpen(false)}>Cerrar</button>
            <button type="submit" className="btn btn-primary"><Save size={16} /> Generar Nueva Versión</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
