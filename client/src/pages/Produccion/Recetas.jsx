import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirmDialog } from '../../context/ConfirmDialogContext';
import { 
  BookOpen, Search, Plus, Trash2, Save, ShoppingBag, Info, ShieldAlert
} from 'lucide-react';

function Recetas() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { confirm } = useConfirmDialog();
  const [productos, setProductos] = useState([]);
  const [insumosActivos, setInsumosActivos] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [recipeIngredients, setRecipeIngredients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Editor states
  const [selectedInsumoId, setSelectedInsumoId] = useState('');
  const [requiredQuantity, setRequiredQuantity] = useState('');

  const canWrite = ['propietario', 'admin_sistema', 'jefe_produccion'].includes(user?.rol);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [prodData, insData] = await Promise.all([
        api.getActiveProductos(),
        api.getActivosInsumos()
      ]);
      setProductos(Array.isArray(prodData) ? prodData : prodData.data || []);
      setInsumosActivos(Array.isArray(insData) ? insData : insData.data || []);
    } catch (err) {
      showToast(err.message || 'Error al inicializar catálogo de recetas', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProduct = async (product) => {
    setSelectedProduct(product);
    setRecipeIngredients([]);
    setSelectedInsumoId('');
    setRequiredQuantity('');
    try {
      setLoading(true);
      const data = await api.getRecetaProducto(product.id);
      if (data && Array.isArray(data.ingredientes)) {
        setRecipeIngredients(data.ingredientes.map(i => ({
          id_insumo: i.id_insumo,
          nombre: i.insumo_nombre,
          unidad_medida: i.insumo_unidad_medida || i.unidad,
          cantidad_requerida: parseFloat(i.cantidad_requerida)
        })));
      }
    } catch (err) {
      // 404 is normal if the product has no recipe yet
      if (err.status !== 404) {
        showToast(err.message || 'Error al obtener la receta', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddIngredient = () => {
    if (!selectedInsumoId) {
      showToast('Seleccione un insumo', 'warning');
      return;
    }
    const qty = parseFloat(requiredQuantity);
    if (isNaN(qty) || qty <= 0) {
      showToast('Ingrese una cantidad válida mayor a cero', 'warning');
      return;
    }

    // Check duplicate
    if (recipeIngredients.some(i => i.id_insumo === parseInt(selectedInsumoId))) {
      showToast('Este insumo ya se encuentra en la receta. Edite o elimine la fila actual si desea cambiarlo.', 'warning');
      return;
    }

    const insumo = insumosActivos.find(i => i.id === parseInt(selectedInsumoId));
    if (!insumo) return;

    setRecipeIngredients(prev => [...prev, {
      id_insumo: insumo.id,
      nombre: insumo.nombre,
      unidad_medida: insumo.unidad_medida,
      cantidad_requerida: Math.round(qty * 10000) / 10000 // 4 decimals
    }]);

    setSelectedInsumoId('');
    setRequiredQuantity('');
    showToast('Insumo añadido temporalmente a la receta', 'success');
  };

  const handleRemoveIngredient = (id_insumo) => {
    setRecipeIngredients(prev => prev.filter(i => i.id_insumo !== id_insumo));
  };

  const handleSaveRecipe = async () => {
    if (!selectedProduct) return;

    if (recipeIngredients.length === 0) {
      const confirmed = await confirm({
        title: 'Receta Vacía',
        message: '¿Está seguro de guardar una receta vacía? Esto eliminará todos los insumos y lanzará error al intentar producir este producto.',
        confirmText: 'Sí, borrar receta',
        type: 'danger'
      });
      if (!confirmed) return;
    }

    try {
      setSaving(true);
      const payload = {
        ingredientes: recipeIngredients.map(i => ({
          id_insumo: i.id_insumo,
          cantidad_requerida: i.cantidad_requerida
        }))
      };
      await api.saveRecetaProducto(selectedProduct.id, payload);
      showToast('Receta guardada y sincronizada correctamente', 'success');
    } catch (err) {
      showToast(err.message || 'Error al guardar la receta', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecipe = async () => {
    if (!selectedProduct) return;

    const confirmed = await confirm({
      title: 'Eliminar Receta',
      message: `¿Está seguro de eliminar por completo la receta de "${selectedProduct.nombre}"?`,
      confirmText: 'Eliminar Receta',
      type: 'danger'
    });

    if (!confirmed) return;

    try {
      setSaving(true);
      await api.deleteRecetaProducto(selectedProduct.id);
      setRecipeIngredients([]);
      showToast('Receta eliminada correctamente', 'success');
    } catch (err) {
      showToast(err.message || 'Error al eliminar la receta', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = productos.filter(p => 
    p.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedInsumoData = insumosActivos.find(i => i.id === parseInt(selectedInsumoId));

  return (
    <div className="page-container fade-in">
      <div className="toolbar">
        <div>
          <h1>Recetario Operativo</h1>
          <p className="text-secondary">Definición de materia prima necesaria para producir panadería y repostería</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 'var(--space-lg)', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Product Selector */}
        <div className="card" style={{ padding: 'var(--space-md)' }}>
          <h2 className="card-title" style={{ fontSize: '18px', marginBottom: 'var(--space-sm)' }}>Productos</h2>
          
          <div className="search-bar" style={{ marginBottom: 'var(--space-md)' }}>
            <Search className="search-icon" size={16} />
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '32px' }}
              placeholder="Buscar producto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ maxHeight: '500px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredProducts.length > 0 ? (
              filteredProducts.map(p => (
                <button
                  key={p.id}
                  className={`btn ${selectedProduct?.id === p.id ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    padding: '10px var(--space-md)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                  onClick={() => handleSelectProduct(p)}
                >
                  <BookOpen size={16} />
                  <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {p.nombre}
                  </div>
                </button>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--color-text-light)' }}>
                No se encontraron productos
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Recipe Editor */}
        <div>
          {selectedProduct ? (
            <div className="card" style={{ position: 'relative' }}>
              {loading && <div className="spinner" style={{ position: 'absolute', top: '20px', right: '20px' }}></div>}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <div>
                  <h2 className="card-title" style={{ margin: 0 }}>
                    Receta: {selectedProduct.nombre}
                  </h2>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-light)', margin: 0 }}>
                    Categoría: {selectedProduct.categoria_nombre} | Unidad base: {selectedProduct.unidad_medida}
                  </p>
                </div>
                {canWrite && recipeIngredients.length > 0 && (
                  <button 
                    className="btn btn-secondary text-danger" 
                    onClick={handleDeleteRecipe}
                    disabled={saving}
                  >
                    Eliminar Receta
                  </button>
                )}
              </div>

              {/* Form to add ingredient (only for writers) */}
              {canWrite ? (
                <div style={{ 
                  background: 'var(--color-base)', 
                  padding: 'var(--space-md)', 
                  borderRadius: '8px', 
                  marginBottom: 'var(--space-lg)' 
                }}>
                  <h3 style={{ fontSize: '14px', marginTop: 0, marginBottom: 'var(--space-sm)', fontWeight: 600 }}>
                    Añadir Insumo a la Receta
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 'var(--space-md)', alignItems: 'end' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '11px' }}>Materia Prima (Insumo)</label>
                      <select
                        className="form-input"
                        value={selectedInsumoId}
                        onChange={(e) => setSelectedInsumoId(e.target.value)}
                      >
                        <option value="">Seleccionar insumo...</option>
                        {insumosActivos.map(i => (
                          <option key={i.id} value={i.id}>
                            {i.nombre} {i.stock_actual !== undefined ? `(Stock: ${i.stock_actual} ${i.unidad_medida})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '11px' }}>
                        Cant. Requerida {selectedInsumoData ? `(${selectedInsumoData.unidad_medida})` : ''}
                      </label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <input
                          type="number"
                          step="0.0001"
                          min="0.0001"
                          className="form-input"
                          placeholder="0.0000"
                          value={requiredQuantity}
                          onChange={(e) => setRequiredQuantity(e.target.value)}
                        />
                      </div>
                    </div>

                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={handleAddIngredient}
                      style={{ height: '42px' }}
                    >
                      <Plus size={18} /> Añadir
                    </button>
                  </div>
                  {selectedInsumoData && (
                    <div style={{ fontSize: '11px', color: 'var(--color-accent)', marginTop: '5px' }}>
                      Se capturará en la unidad base: <strong>{selectedInsumoData.unidad_medida}</strong> (Stock disponible: {selectedInsumoData.stock_actual} {selectedInsumoData.unidad_medida})
                    </div>
                  )}
                </div>
              ) : (
                <div className="alert alert-warning" style={{ marginBottom: 'var(--space-md)' }}>
                  <ShieldAlert size={16} /> No tienes permisos para editar recetas. Vista de sólo lectura activada.
                </div>
              )}

              {/* Ingredients Table */}
              <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: 'var(--space-sm)' }}>
                Ingredientes Registrados
              </h3>
              
              <div className="table-responsive">
                <table className="table" style={{ background: 'transparent' }}>
                  <thead>
                    <tr>
                      <th>Insumo (Materia Prima)</th>
                      <th>Cantidad Requerida (Por Unidad Producida)</th>
                      <th>Unidad Base</th>
                      {canWrite && <th style={{ width: '80px' }}>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {recipeIngredients.length > 0 ? (
                      recipeIngredients.map(item => (
                        <tr key={item.id_insumo}>
                          <td style={{ fontWeight: 600 }}>{item.nombre}</td>
                          <td>
                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '15px' }}>
                              {parseFloat(item.cantidad_requerida).toFixed(4)}
                            </span>
                          </td>
                          <td>
                            <span className="badge badge-info">{item.unidad_medida}</span>
                          </td>
                          {canWrite && (
                            <td>
                              <button
                                className="btn-icon text-danger"
                                title="Quitar ingrediente"
                                onClick={() => handleRemoveIngredient(item.id_insumo)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={canWrite ? 4 : 3} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-light)' }}>
                          Este producto no tiene ingredientes en su receta.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {canWrite && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-md)', marginTop: 'var(--space-lg)' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveRecipe}
                    disabled={saving}
                  >
                    <Save size={18} /> {saving ? 'Guardando Receta...' : 'Guardar y Sincronizar Receta'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="card empty-state" style={{ height: '350px', justifyContent: 'center' }}>
              <BookOpen size={48} style={{ color: 'var(--color-accent)', opacity: 0.6 }} />
              <h3>Receta no seleccionada</h3>
              <p className="text-secondary">Seleccione un producto de la lista izquierda para editar o consultar su receta.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Recetas;
