const API_URL = import.meta.env.VITE_API_URL || 'https://panaderia-miga-de-luna-production.up.railway.app/api';

function getHeaders() {
  const token = localStorage.getItem('mdl_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

export async function apiFetch(endpoint, options = {}) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { ...getHeaders(), ...options.headers }
  });
  
  // Only redirect to login on 401 (expired/invalid token)
  // 403 (forbidden) should NOT close the session
  if (res.status === 401) {
    if (!window.location.pathname.includes('/login')) {
      localStorage.removeItem('mdl_token');
      localStorage.removeItem('mdl_user');
      window.location.href = '/login';
    }
  }

  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data.error || data.message || 'Error en la solicitud';
    const error = new Error(errorMsg);
    error.status = res.status;
    // Mark 403 errors explicitly so components can handle them
    if (res.status === 403) {
      error.forbidden = true;
    }
    throw error;
  }
  return data;
}

export const api = {
  get: (url) => apiFetch(url),
  getDashboard: () => api.get('/dashboard'),

  // Sucursales
  getSucursales: (params) => api.get(`/sucursales?${new URLSearchParams(params).toString()}`),
  getSucursalesSelect: () => api.get('/sucursales/select'),
  getSucursal: (id) => api.get(`/sucursales/${id}`),
  createSucursal: (data) => api.post('/sucursales', data),
  updateSucursal: (id, data) => api.put(`/sucursales/${id}`, data),
  deleteSucursal: (id) => api.delete(`/sucursales/${id}`),

  // Productos
  getProductos: (params) => api.get(`/productos?${new URLSearchParams(params).toString()}`),
  getActiveProductos: () => api.get('/productos/activos'),
  getProducto: (id) => api.get(`/productos/${id}`),
  createProducto: (data) => api.post('/productos', data),
  updateProducto: (id, data) => api.put(`/productos/${id}`, data),
  deleteProducto: (id) => api.delete(`/productos/${id}`),
  getProductosMovimiento: (sucursalId, tipoMovimiento) => 
    api.get(`/inventarios/productos-movimiento?sucursalId=${sucursalId}&tipoMovimiento=${tipoMovimiento}`),
  
  // Categorías
  getCategorias: () => api.get('/categorias'),
  createCategoria: (data) => api.post('/categorias', data),
  updateCategoria: (id, data) => api.put(`/categorias/${id}`, data),
  deleteCategoria: (id) => api.delete(`/categorias/${id}`),

  // Producto Estrella
  getEspecificaciones: (id) => api.get(`/productos/${id}/especificaciones`),
  getHistorialEspecificaciones: (id) => api.get(`/productos/${id}/especificaciones/historial`),
  updateEspecificaciones: (id, data) => api.post(`/productos/${id}/especificaciones`, data),

  // Ventas
  getVentas: (params) => api.get(`/ventas?${new URLSearchParams(params).toString()}`),
  getVenta: (id) => api.get(`/ventas/${id}`),
  crearVenta: (data) => api.post('/ventas', data),
  cancelarVenta: (id, data) => api.patch(`/ventas/${id}/cancelar`, data),
  getProductosDisponibles: (sucursalId) => api.get(`/ventas/productos-disponibles/${sucursalId}`),
  getVendedores: (sucursalId) => api.get(`/ventas/vendedores${sucursalId ? `?sucursalId=${sucursalId}` : ''}`),

  // Producción
  getProducciones: (params) => api.get(`/produccion?${new URLSearchParams(params).toString()}`),
  createProduccion: (data) => api.post('/produccion', data),
  cancelarProduccion: (id) => api.post(`/produccion/${id}/cancel`),

  // Insumos (Materia Prima)
  getInsumos: (params) => api.get(`/insumos?${new URLSearchParams(params || {}).toString()}`),
  getActivosInsumos: () => api.get('/insumos/activos'),
  getInsumo: (id) => api.get(`/insumos/${id}`),
  createInsumo: (data) => api.post('/insumos', data),
  updateInsumo: (id, data) => api.put(`/insumos/${id}`, data),
  deleteInsumo: (id) => api.delete(`/insumos/${id}`),
  getInsumoMovimientos: (id, limit) => api.get(`/insumos/${id}/movimientos${limit ? `?limit=${limit}` : ''}`),

  // Recetas
  getRecetaProducto: (idProducto) => api.get(`/recetas/producto/${idProducto}`),
  saveRecetaProducto: (idProducto, data) => api.put(`/recetas/producto/${idProducto}`, data),
  deleteRecetaProducto: (idProducto) => api.delete(`/recetas/producto/${idProducto}`),
  getProductosConReceta: () => api.get('/recetas/productos-con-receta'),

  // Compras de Insumos
  getComprasInsumos: (params) => api.get(`/compras-insumos?${new URLSearchParams(params || {}).toString()}`),
  getCompraInsumo: (id) => api.get(`/compras-insumos/${id}`),
  createCompraInsumo: (data) => api.post('/compras-insumos', data),

  // Traslados
  getTraslados: (params) => api.get(`/traslados?${new URLSearchParams(params).toString()}`),
  createTraslado: (data) => api.post('/traslados', data),
  confirmarTraslado: (id) => api.post(`/traslados/${id}/confirmar`),
  cancelarTraslado: (id) => api.post(`/traslados/${id}/cancel`),

  // Asistencias
  getAsistencias: (params) => api.get(`/asistencias?${new URLSearchParams(params).toString()}`),
  registrarEntrada: (data) => api.post('/asistencias/entrada', data),
  registrarSalida: (data) => api.post('/asistencias/salida', data),
  registrarAsistenciaManual: (data) => api.post('/asistencias/manual', data),
  getEmpleadosPresentes: (fecha) => api.get(`/asistencias/presentes?fecha=${fecha || ''}`),

  // Horas Extra
  getHorasExtra: (params) => api.get(`/horas-extra?${new URLSearchParams(params).toString()}`),
  createHorasExtra: (data) => api.post('/horas-extra', data),
  autorizarHorasExtra: (id) => api.patch(`/horas-extra/${id}/autorizar`),
  rechazarHorasExtra: (id) => api.patch(`/horas-extra/${id}/rechazar`),

  // Nómina
  getNominas: (params) => api.get(`/nominas?${new URLSearchParams(params).toString()}`),
  calcularNomina: (data) => api.post('/nominas/calcular', data),
  getDetalleNomina: (id) => api.get(`/nominas/${id}`),
  pagarNomina: (id) => api.patch(`/nominas/${id}/pagar`),
  cancelarNomina: (id) => apiFetch(`/nominas/${id}/cancelar`, { method: 'PATCH' }),

  // Reportes
  getReporteVentas:      (p) => apiFetch(`/reportes/ventas?${new URLSearchParams(p)}`),
  getReporteSemanal:     (p) => apiFetch(`/reportes/semanal?${new URLSearchParams(p)}`),
  getReporteInventario:  (p) => apiFetch(`/reportes/inventario?${new URLSearchParams(p)}`),
  getReporteMovimientos: (p) => apiFetch(`/reportes/movimientos?${new URLSearchParams(p)}`),
  getReporteProduccion:  (p) => apiFetch(`/reportes/produccion?${new URLSearchParams(p)}`),
  getReportePersonal:    (p) => apiFetch(`/reportes/personal?${new URLSearchParams(p)}`),

  // Empleados
  getEmpleados: (params) => api.get(`/empleados?${new URLSearchParams(params || {}).toString()}`),

  post: (url, body) => apiFetch(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => apiFetch(url, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (url, body) => apiFetch(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (url) => apiFetch(url, { method: 'DELETE' })
};
