/**
 * Validadores comunes para lógica de negocio
 */

export const validateProducto = (data) => {
  if (!data.nombre || data.nombre.trim().length < 2) return { error: 'Nombre de producto inválido' };
  if (!data.id_categoria) return { error: 'Categoría obligatoria' };
  const validTipos = ['Producto de línea', 'Producto de temporada', 'Edición especial'];
  if (data.tipo && !validTipos.includes(data.tipo)) return { error: 'Tipo de producto inválido' };
  if (data.precio <= 0) return { error: 'El precio debe ser mayor a cero' };
  if (data.costo < 0) return { error: 'El costo no puede ser negativo' };
  // Business rule: warn if price < cost (but allow if needed, though the prompt says "warn" or "validate")
  // For strict validation as requested:
  if (data.precio < data.costo) return { error: 'El precio de venta no puede ser menor al costo' };
  return { error: null };
};

export const validateSucursal = (data) => {
  if (!data.nombre || data.nombre.trim().length < 3) return { error: 'Nombre de sucursal inválido (mínimo 3 caracteres)' };
  if (!data.tipo || !['planta', 'expendio', 'plaza'].includes(data.tipo)) return { error: 'Tipo de sucursal inválido' };
  if (!data.direccion) return { error: 'Dirección obligatoria' };
  if (data.tipo !== 'planta' && (data.distancia_planta_km === undefined || data.distancia_planta_km < 0)) {
    return { error: 'La distancia desde planta es obligatoria para expendios y sucursales en plaza' };
  }
  return { error: null };
};

export const validateEmpleado = (data) => {
  if (!data.nombre || !data.apellido_paterno) return { error: 'Nombre y apellido paterno obligatorios' };
  if (!data.id_puesto) return { error: 'Puesto obligatorio' };
  if (!data.fecha_contratacion) return { error: 'Fecha de contratación obligatoria' };
  return { error: null };
};

export const validateHorasExtra = (data) => {
  if (data.cantidad_horas <= 0) return { error: 'Las horas extra deben ser mayores a cero' };
  if (!data.id_empleado) return { error: 'ID de empleado obligatorio' };
  if (!data.fecha) return { error: 'Fecha obligatoria' };
  return { error: null };
};

export const validateVenta = (venta, items) => {
  if (!venta.id_sucursal) return { error: 'Sucursal obligatoria' };
  if (!venta.id_empleado) return { error: 'Vendedor obligatorio' };
  if (!items || items.length === 0) return { error: 'La venta debe tener al menos un producto' };
  for (const item of items) {
    if (item.cantidad <= 0) return { error: 'Cantidades deben ser mayores a cero' };
  }
  return { error: null };
};

// Compatibility export
export const validate = {
  product: (d) => validateProducto(d).error,
  sucursal: (d) => validateSucursal(d).error,
  empleado: (d) => validateEmpleado(d).error,
  horasExtra: (d) => validateHorasExtra(d).error,
  venta: (v, i) => validateVenta(v, i).error
};
