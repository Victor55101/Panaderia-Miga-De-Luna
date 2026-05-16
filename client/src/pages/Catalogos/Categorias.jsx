import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Plus, Search, Edit2, Trash2, Tag, AlertCircle } from 'lucide-react';
import Modal from '../../components/Common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';

export default function Categorias() {
  const { user } = useAuth();
  const { confirm } = useConfirmDialog();
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategoria, setEditingCategoria] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    activo: 1
  });

  const canManage = ['propietario', 'admin_sistema'].includes(user?.rol);

  useEffect(() => {
    fetchCategorias();
  }, []);

  async function fetchCategorias() {
    try {
      setLoading(true);
      const data = await api.getCategorias();
      setCategorias(data);
    } catch (err) {
      setError('Error al cargar las categorías');
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = (categoria = null) => {
    if (categoria) {
      setEditingCategoria(categoria);
      setFormData({ ...categoria });
    } else {
      setEditingCategoria(null);
      setFormData({
        nombre: '',
        descripcion: '',
        activo: 1
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (editingCategoria) {
        await api.updateCategoria(editingCategoria.id, formData);
      } else {
        await api.createCategoria(formData);
      }
      setIsModalOpen(false);
      fetchCategorias();
    } catch (err) {
      setError(err.message || 'Error al guardar');
    }
  };

  const handleDelete = async (id) => {
    const isConfirmed = await confirm({
      title: 'Desactivar Categoría',
      message: '¿Está seguro de desactivar esta categoría?',
      confirmText: 'Sí, desactivar',
      type: 'danger'
    });
    if (!isConfirmed) return;
    try {
      await api.deleteCategoria(id);
      fetchCategorias();
    } catch (err) {
      setError(err.message || 'Error al desactivar');
    }
  };

  const filteredCategorias = categorias.filter(c => 
    c.nombre.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container fade-in">
      <div className="toolbar">
        <div>
          <h1>Categorías de Producto</h1>
          <p className="text-secondary">Clasificación para el catálogo y producción</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={18} /> Nueva Categoría
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <div className="search-bar" style={{ flex: 1 }}>
            <Search className="search-icon" size={18} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Buscar categoría..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="badge badge-accent">
            {filteredCategorias.length} Registros
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}

      <div className="table-container card" style={{ padding: 0 }}>
        {loading ? (
          <div className="spinner"></div>
        ) : filteredCategorias.length > 0 ? (
          <table className="table">
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Descripción</th>
                <th>Estatus</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategorias.map(cat => (
                <tr key={cat.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="stat-icon" style={{ 
                        background: 'var(--color-base)', 
                        color: 'var(--color-accent)',
                        width: '32px', height: '32px', borderRadius: '8px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <Tag size={16} />
                      </div>
                      <div style={{ fontWeight: 600 }}>{cat.nombre}</div>
                    </div>
                  </td>
                  <td>{cat.descripcion || '-'}</td>
                  <td>
                    {cat.activo ? (
                      <span className="badge badge-success">Activa</span>
                    ) : (
                      <span className="badge badge-error">Inactiva</span>
                    )}
                  </td>
                  <td>
                    <div className="toolbar-actions">
                      {canManage && (
                        <button className="btn-icon" onClick={() => handleOpenModal(cat)}>
                          <Edit2 size={16} />
                        </button>
                      )}
                      {canManage && cat.activo === 1 && (
                        <button className="btn-icon" onClick={() => handleDelete(cat.id)} style={{ color: 'var(--color-error)' }}>
                          <Trash2 size={16} />
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
            <Tag size={48} />
            <p>No se encontraron categorías</p>
          </div>
        )}
      </div>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        title={editingCategoria ? 'Editar Categoría' : 'Nueva Categoría'}
      >
        <form onSubmit={handleSave} className="login-form" style={{ padding: 0 }}>
          <div className="form-group">
            <label className="form-label">Nombre de la Categoría</label>
            <input 
              className="form-input" 
              required
              value={formData.nombre}
              onChange={e => setFormData({...formData, nombre: e.target.value})}
              placeholder="Ej. Pan Dulce Tradicional"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Descripción (Opcional)</label>
            <textarea 
              className="form-input"
              rows="3"
              value={formData.descripcion}
              onChange={e => setFormData({...formData, descripcion: e.target.value})}
              placeholder="Breve descripción de la categoría..."
            />
          </div>

          <div className="form-group">
            <label className="form-label">Estatus</label>
            <select 
              className="form-input"
              value={formData.activo}
              onChange={e => setFormData({...formData, activo: parseInt(e.target.value)})}
            >
              <option value={1}>Activa</option>
              <option value={0}>Inactiva</option>
            </select>
          </div>

          <div className="modal-footer" style={{ marginTop: 'var(--space-lg)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              {editingCategoria ? 'Guardar Cambios' : 'Crear Categoría'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
