-- ============================================================
-- Miga de Luna Panadería & Repostería — Migración Inicial
-- Diseñado para PostgreSQL, compatible con SQLite en desarrollo
-- ============================================================

-- SUCURSALES
CREATE TABLE IF NOT EXISTS sucursales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('planta','expendio','plaza')),
  direccion TEXT,
  telefono TEXT,
  distancia_planta_km REAL DEFAULT 0,
  capacidad_operativa INTEGER DEFAULT 0,
  fecha_apertura TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- DEPARTAMENTOS
CREATE TABLE IF NOT EXISTS departamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- PUESTOS
CREATE TABLE IF NOT EXISTS puestos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  id_departamento INTEGER NOT NULL,
  descripcion TEXT,
  salario_base REAL NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_departamento) REFERENCES departamentos(id)
);

-- EMPLEADOS
CREATE TABLE IF NOT EXISTS empleados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  apellido_paterno TEXT NOT NULL,
  apellido_materno TEXT,
  rfc TEXT UNIQUE,
  telefono TEXT,
  email TEXT,
  id_sucursal INTEGER,
  id_puesto INTEGER NOT NULL,
  fecha_contratacion TEXT NOT NULL,
  salario_base REAL NOT NULL DEFAULT 0,
  tipo_personal TEXT CHECK(tipo_personal IN ('ventas','produccion','distribucion','administracion','recursos_humanos')),
  estatus TEXT NOT NULL DEFAULT 'activo' CHECK(estatus IN ('activo','baja','suspendido')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_sucursal) REFERENCES sucursales(id),
  FOREIGN KEY (id_puesto) REFERENCES puestos(id)
);

-- ROLES
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  permisos TEXT, -- JSON string of permissions
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  id_empleado INTEGER NOT NULL,
  id_rol INTEGER NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  ultimo_acceso TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_empleado) REFERENCES empleados(id),
  FOREIGN KEY (id_rol) REFERENCES roles(id)
);

-- CATEGORIAS DE PRODUCTO
CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- PRODUCTOS
CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  id_categoria INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('pan_blanco','pan_dulce','reposteria','otro')),
  unidad_medida TEXT NOT NULL DEFAULT 'pieza',
  costo REAL NOT NULL DEFAULT 0 CHECK(costo >= 0),
  precio REAL NOT NULL DEFAULT 0 CHECK(precio >= 0),
  es_estrella INTEGER NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_categoria) REFERENCES categorias(id)
);

-- ESPECIFICACIONES DE PRODUCTO (Franquicia)
CREATE TABLE IF NOT EXISTS especificaciones_producto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_producto INTEGER NOT NULL,
  receta_base TEXT,
  ingredientes TEXT,
  gramaje_aprox REAL,
  tiempo_horneado_min INTEGER,
  temperatura_c INTEGER,
  instrucciones_presentacion TEXT,
  version TEXT DEFAULT '1.0',
  id_usuario INTEGER,
  vigente INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_producto) REFERENCES productos(id),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);

-- INSUMOS
CREATE TABLE IF NOT EXISTS insumos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE,
  unidad_medida TEXT NOT NULL,
  costo_unitario REAL DEFAULT 0 CHECK(costo_unitario >= 0),
  stock_actual REAL DEFAULT 0 CHECK(stock_actual >= 0),
  stock_minimo REAL DEFAULT 0,
  stock_maximo REAL DEFAULT 1000 CHECK(stock_maximo > 0),
  activo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- RECETAS (relación producto-insumo)
CREATE TABLE IF NOT EXISTS recetas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_producto INTEGER NOT NULL,
  id_insumo INTEGER NOT NULL,
  cantidad_requerida REAL NOT NULL CHECK(cantidad_requerida > 0),
  unidad TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(id_producto, id_insumo),
  FOREIGN KEY (id_producto) REFERENCES productos(id),
  FOREIGN KEY (id_insumo) REFERENCES insumos(id)
);

-- COMPRAS DE INSUMOS
CREATE TABLE IF NOT EXISTS compras_insumos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_insumo INTEGER NOT NULL,
  cantidad REAL NOT NULL CHECK(cantidad > 0),
  costo_total REAL NOT NULL CHECK(costo_total >= 0),
  proveedor TEXT,
  fecha_compra TEXT NOT NULL,
  id_usuario INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_insumo) REFERENCES insumos(id),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);

-- MOVIMIENTOS DE INSUMOS (bitácora operativa de materia prima)
CREATE TABLE IF NOT EXISTS movimientos_insumos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_insumo INTEGER NOT NULL,
  id_usuario INTEGER,
  tipo_movimiento TEXT NOT NULL CHECK(tipo_movimiento IN ('compra','consumo_produccion','ajuste','merma','correccion','reverso_produccion')),
  cantidad REAL NOT NULL,
  stock_anterior REAL NOT NULL,
  stock_nuevo REAL NOT NULL,
  referencia TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_insumo) REFERENCES insumos(id),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);

-- PRODUCCIONES
CREATE TABLE IF NOT EXISTS producciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  id_sucursal_planta INTEGER NOT NULL,
  id_responsable INTEGER NOT NULL,
  total_piezas INTEGER NOT NULL DEFAULT 0 CHECK(total_piezas >= 0),
  observaciones TEXT,
  estatus TEXT NOT NULL DEFAULT 'completada' CHECK(estatus IN ('completada','cancelada')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_sucursal_planta) REFERENCES sucursales(id),
  FOREIGN KEY (id_responsable) REFERENCES empleados(id)
);

-- DETALLE DE PRODUCCIÓN
CREATE TABLE IF NOT EXISTS detalle_produccion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_produccion INTEGER NOT NULL,
  id_producto INTEGER NOT NULL,
  cantidad INTEGER NOT NULL CHECK(cantidad > 0),
  costo_unitario REAL DEFAULT 0 CHECK(costo_unitario >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_produccion) REFERENCES producciones(id),
  FOREIGN KEY (id_producto) REFERENCES productos(id)
);

-- TRASLADOS
CREATE TABLE IF NOT EXISTS traslados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_sucursal_origen INTEGER NOT NULL,
  id_sucursal_destino INTEGER NOT NULL,
  id_repartidor INTEGER NOT NULL,
  fecha_salida TEXT NOT NULL,
  fecha_entrega TEXT,
  estatus TEXT NOT NULL DEFAULT 'en_ruta' CHECK(estatus IN ('en_ruta','entregado','cancelado')),
  observaciones TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_sucursal_origen) REFERENCES sucursales(id),
  FOREIGN KEY (id_sucursal_destino) REFERENCES sucursales(id),
  FOREIGN KEY (id_repartidor) REFERENCES empleados(id)
);

-- DETALLE DE TRASLADOS
CREATE TABLE IF NOT EXISTS detalle_traslados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_traslado INTEGER NOT NULL,
  id_producto INTEGER NOT NULL,
  cantidad_enviada INTEGER NOT NULL CHECK(cantidad_enviada > 0),
  cantidad_recibida INTEGER DEFAULT 0 CHECK(cantidad_recibida >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_traslado) REFERENCES traslados(id),
  FOREIGN KEY (id_producto) REFERENCES productos(id)
);

-- INVENTARIOS
CREATE TABLE IF NOT EXISTS inventarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_sucursal INTEGER NOT NULL,
  id_producto INTEGER NOT NULL,
  existencia INTEGER NOT NULL DEFAULT 0 CHECK(existencia >= 0),
  minimo INTEGER NOT NULL DEFAULT 10,
  maximo INTEGER NOT NULL DEFAULT 500,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(id_sucursal, id_producto),
  FOREIGN KEY (id_sucursal) REFERENCES sucursales(id),
  FOREIGN KEY (id_producto) REFERENCES productos(id)
);

-- MOVIMIENTOS DE INVENTARIO (auditoría)
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_sucursal INTEGER NOT NULL,
  id_producto INTEGER NOT NULL,
  tipo_movimiento TEXT NOT NULL CHECK(tipo_movimiento IN ('entrada','salida','venta','traslado_entrada','traslado_salida','produccion','ajuste')),
  cantidad INTEGER NOT NULL,
  existencia_anterior INTEGER NOT NULL,
  existencia_nueva INTEGER NOT NULL,
  referencia TEXT,
  id_usuario INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_sucursal) REFERENCES sucursales(id),
  FOREIGN KEY (id_producto) REFERENCES productos(id),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);

-- VENTAS
CREATE TABLE IF NOT EXISTS ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_sucursal INTEGER NOT NULL,
  id_empleado INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0 CHECK(subtotal >= 0),
  total REAL NOT NULL DEFAULT 0 CHECK(total >= 0),
  metodo_pago TEXT NOT NULL DEFAULT 'efectivo' CHECK(metodo_pago IN ('efectivo','tarjeta','transferencia')),
  estatus TEXT NOT NULL DEFAULT 'completada' CHECK(estatus IN ('completada','cancelada')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_sucursal) REFERENCES sucursales(id),
  FOREIGN KEY (id_empleado) REFERENCES empleados(id)
);

-- DETALLE DE VENTAS
CREATE TABLE IF NOT EXISTS detalle_ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_venta INTEGER NOT NULL,
  id_producto INTEGER NOT NULL,
  cantidad INTEGER NOT NULL CHECK(cantidad > 0),
  precio_unitario REAL NOT NULL CHECK(precio_unitario >= 0),
  subtotal REAL NOT NULL CHECK(subtotal >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_venta) REFERENCES ventas(id),
  FOREIGN KEY (id_producto) REFERENCES productos(id)
);

-- CORTES DE CAJA
CREATE TABLE IF NOT EXISTS cortes_caja (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_sucursal INTEGER NOT NULL,
  id_empleado INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  total_ventas REAL NOT NULL DEFAULT 0,
  total_efectivo REAL NOT NULL DEFAULT 0,
  total_tarjeta REAL NOT NULL DEFAULT 0,
  total_transferencia REAL NOT NULL DEFAULT 0,
  observaciones TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_sucursal) REFERENCES sucursales(id),
  FOREIGN KEY (id_empleado) REFERENCES empleados(id)
);

-- ASISTENCIAS
CREATE TABLE IF NOT EXISTS asistencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_empleado INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  hora_entrada TEXT,
  hora_salida TEXT,
  horas_trabajadas REAL DEFAULT 0,
  incidencia TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_empleado) REFERENCES empleados(id)
);

-- HORAS EXTRA
CREATE TABLE IF NOT EXISTS horas_extra (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_empleado INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  cantidad_horas REAL NOT NULL CHECK(cantidad_horas > 0),
  motivo TEXT,
  estatus TEXT NOT NULL DEFAULT 'pendiente' CHECK(estatus IN ('pendiente','autorizada','rechazada')),
  id_autorizador INTEGER,
  fecha_autorizacion TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_empleado) REFERENCES empleados(id),
  FOREIGN KEY (id_autorizador) REFERENCES empleados(id)
);

-- NÓMINAS
CREATE TABLE IF NOT EXISTS nominas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_empleado INTEGER NOT NULL,
  periodo_inicio TEXT NOT NULL,
  periodo_fin TEXT NOT NULL,
  salario_base REAL NOT NULL CHECK(salario_base >= 0),
  horas_extra_autorizadas REAL DEFAULT 0,
  monto_horas_extra REAL DEFAULT 0 CHECK(monto_horas_extra >= 0),
  total_pagar REAL NOT NULL CHECK(total_pagar >= 0),
  estatus TEXT NOT NULL DEFAULT 'pendiente' CHECK(estatus IN ('pendiente','pagada','cancelada')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_empleado) REFERENCES empleados(id)
);

-- ESTADÍSTICAS SEMANALES
CREATE TABLE IF NOT EXISTS estadisticas_semanales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  semana_inicio TEXT NOT NULL,
  semana_fin TEXT NOT NULL,
  id_sucursal INTEGER,
  id_producto INTEGER,
  piezas_vendidas INTEGER DEFAULT 0,
  total_vendido REAL DEFAULT 0,
  promedio_diario REAL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_sucursal) REFERENCES sucursales(id),
  FOREIGN KEY (id_producto) REFERENCES productos(id)
);

-- AUDITORÍA DE OPERACIONES
CREATE TABLE IF NOT EXISTS auditoria_operaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario INTEGER,
  accion TEXT NOT NULL,
  modulo TEXT NOT NULL,
  registro_afectado TEXT,
  datos_anteriores TEXT,
  datos_nuevos TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_empleados_sucursal ON empleados(id_sucursal);
CREATE INDEX IF NOT EXISTS idx_ventas_sucursal ON ventas(id_sucursal);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_inventarios_sucursal ON inventarios(id_sucursal);
CREATE INDEX IF NOT EXISTS idx_movimientos_inv_sucursal ON movimientos_inventario(id_sucursal);
CREATE INDEX IF NOT EXISTS idx_asistencias_empleado ON asistencias(id_empleado);
CREATE INDEX IF NOT EXISTS idx_asistencias_fecha ON asistencias(fecha);
CREATE INDEX IF NOT EXISTS idx_horas_extra_estatus ON horas_extra(estatus);
CREATE INDEX IF NOT EXISTS idx_auditoria_modulo ON auditoria_operaciones(modulo);
CREATE UNIQUE INDEX IF NOT EXISTS idx_insumos_nombre ON insumos(nombre);
CREATE UNIQUE INDEX IF NOT EXISTS idx_recetas_prod_insumo ON recetas(id_producto, id_insumo);
CREATE INDEX IF NOT EXISTS idx_movimientos_insumos_insumo ON movimientos_insumos(id_insumo);

