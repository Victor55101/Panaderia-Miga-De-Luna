import { getDb } from '../config/database.js';

// ─── RBAC helpers ────────────────────────────────────────────────────────────
const ADMIN_ROLES  = ['propietario', 'admin_sistema'];
const RRHH_ROLES   = ['propietario', 'admin_sistema', 'recursos_humanos'];
const VENTAS_ROLES = ['propietario', 'admin_sistema', 'gerente_sucursal'];
const PROD_ROLES   = ['propietario', 'admin_sistema', 'jefe_produccion'];
const INV_ROLES    = ['propietario', 'admin_sistema', 'gerente_sucursal', 'jefe_produccion'];

function isAdmin(rol)   { return ADMIN_ROLES.includes(rol); }

/**
 * Returns [whereClause, params] for sucursal scoping.
 * If the user is restricted, forces their sucursal regardless of requested sucursalId.
 * tableAlias: prefix for the id_sucursal column (e.g. 'v' → 'v.id_sucursal')
 */
function sucursalScope(userRole, userSucursalId, requestedSucursalId, tableAlias = '', colName = 'id_sucursal') {
  const col = tableAlias ? `${tableAlias}.${colName}` : colName;
  if (!isAdmin(userRole)) {
    // restricted: always force own sucursal
    return [` AND ${col} = ?`, [userSucursalId]];
  }
  if (requestedSucursalId) {
    return [` AND ${col} = ?`, [requestedSucursalId]];
  }
  return ['', []];
}

/** Generic query runner — returns array of plain objects */
function runQ(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function getOne(db, sql, params = []) {
  const rows = runQ(db, sql, params);
  return rows[0] || null;
}

// ─── Local date helper (no toISOString to avoid TZ offset) ───────────────────
export function toLocaleDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Returns { fechaDesde, fechaHasta } for a named period using local dates */
export function resolvePeriod(periodo, rangoDesde, rangoHasta) {
  const hoy = new Date();
  const todayStr = toLocaleDateStr(hoy);

  if (periodo === 'hoy')   return { fechaDesde: todayStr, fechaHasta: todayStr };

  if (periodo === 'ayer') {
    const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
    const ayerStr = toLocaleDateStr(ayer);
    return { fechaDesde: ayerStr, fechaHasta: ayerStr };
  }

  if (periodo === 'semana_actual') {
    const dia = hoy.getDay() || 7;                       // 1=lun…7=dom
    const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - dia + 1);
    return { fechaDesde: toLocaleDateStr(lunes), fechaHasta: todayStr };
  }

  if (periodo === 'semana_pasada') {
    // Semana calendario anterior completa: lunes–domingo
    const dia = hoy.getDay() || 7;
    const lunesPasado = new Date(hoy); lunesPasado.setDate(hoy.getDate() - dia - 6);
    const domingoPasado = new Date(lunesPasado); domingoPasado.setDate(lunesPasado.getDate() + 6);
    return { fechaDesde: toLocaleDateStr(lunesPasado), fechaHasta: toLocaleDateStr(domingoPasado) };
  }

  if (periodo === 'mes') {
    const hace30 = new Date(hoy); hace30.setDate(hoy.getDate() - 30);
    return { fechaDesde: toLocaleDateStr(hace30), fechaHasta: todayStr };
  }

  if (periodo === 'trimestre') {
    const hace90 = new Date(hoy); hace90.setDate(hoy.getDate() - 90);
    return { fechaDesde: toLocaleDateStr(hace90), fechaHasta: todayStr };
  }

  if (periodo === 'rango' && rangoDesde && rangoHasta) {
    return { fechaDesde: rangoDesde, fechaHasta: rangoHasta };
  }

  // 'todos' or unrecognised → no date filter (return null)
  return { fechaDesde: null, fechaHasta: null };
}

// ─── 1. Resumen de Ventas ─────────────────────────────────────────────────────
export async function getResumenVentas({ fechaDesde, fechaHasta, sucursalId, userRole, userSucursalId }) {
  const db = await getDb();
  const [sScope, sParams] = sucursalScope(userRole, userSucursalId, sucursalId, 'v');

  const dateClause = fechaDesde ? ` AND v.fecha >= ? AND v.fecha <= ?` : '';
  const dateParams = fechaDesde ? [fechaDesde, fechaHasta] : [];

  const baseParams = [...sParams, ...dateParams];
  const baseWhere  = `v.estatus = 'completada'${sScope}${dateClause}`;

  // KPIs globales
  const kpi = getOne(db,
    `SELECT COALESCE(SUM(v.total),0) as total_facturado,
            COUNT(v.id) as num_ventas,
            COALESCE(AVG(v.total),0) as ticket_promedio,
            COALESCE(SUM(vd.piezas),0) as total_piezas
     FROM ventas v
     LEFT JOIN (SELECT id_venta, SUM(cantidad) as piezas FROM detalle_ventas GROUP BY id_venta) vd ON vd.id_venta = v.id
     WHERE ${baseWhere}`, baseParams);

  // Por sucursal
  const porSucursal = runQ(db,
    `SELECT s.nombre as sucursal,
            COUNT(v.id) as num_ventas,
            COALESCE(SUM(v.total),0) as total,
            COALESCE(AVG(v.total),0) as ticket_promedio,
            COALESCE(SUM(vd.piezas),0) as piezas
     FROM ventas v
     JOIN sucursales s ON v.id_sucursal = s.id
     LEFT JOIN (SELECT id_venta, SUM(cantidad) as piezas FROM detalle_ventas GROUP BY id_venta) vd ON vd.id_venta = v.id
     WHERE ${baseWhere}
     GROUP BY v.id_sucursal ORDER BY total DESC`, baseParams);

  // Por vendedor
  const porVendedor = runQ(db,
    `SELECT e.nombre || ' ' || e.apellido_paterno as vendedor,
            s.nombre as sucursal,
            COUNT(v.id) as num_ventas,
            COALESCE(SUM(v.total),0) as total,
            COALESCE(SUM(vd.piezas),0) as piezas
     FROM ventas v
     JOIN empleados e ON v.id_empleado = e.id
     JOIN sucursales s ON v.id_sucursal = s.id
     LEFT JOIN (SELECT id_venta, SUM(cantidad) as piezas FROM detalle_ventas GROUP BY id_venta) vd ON vd.id_venta = v.id
     WHERE ${baseWhere}
     GROUP BY v.id_empleado ORDER BY total DESC`, baseParams);

  // Por método de pago
  const porMetodoPago = runQ(db,
    `SELECT v.metodo_pago,
            COUNT(v.id) as num_ventas,
            COALESCE(SUM(v.total),0) as total
     FROM ventas v
     WHERE ${baseWhere}
     GROUP BY v.metodo_pago ORDER BY total DESC`, baseParams);

  // Por categoría
  const porCategoria = runQ(db,
    `SELECT c.nombre as categoria,
            COALESCE(SUM(dv.cantidad),0) as piezas,
            COALESCE(SUM(dv.subtotal),0) as total
     FROM detalle_ventas dv
     JOIN ventas v ON dv.id_venta = v.id
     JOIN productos p ON dv.id_producto = p.id
     JOIN categorias c ON p.id_categoria = c.id
     WHERE ${baseWhere}
     GROUP BY c.id ORDER BY total DESC`, baseParams);

  // Top 10 productos
  const porProducto = runQ(db,
    `SELECT p.nombre as producto, c.nombre as categoria,
            COALESCE(SUM(dv.cantidad),0) as piezas,
            COALESCE(SUM(dv.subtotal),0) as total
     FROM detalle_ventas dv
     JOIN ventas v ON dv.id_venta = v.id
     JOIN productos p ON dv.id_producto = p.id
     JOIN categorias c ON p.id_categoria = c.id
     WHERE ${baseWhere}
     GROUP BY p.id ORDER BY piezas DESC LIMIT 10`, baseParams);

  // Baja rotación: top 10 menos vendidos (activos con alguna venta)
  const bajaRotacion = runQ(db,
    `SELECT p.nombre as producto, c.nombre as categoria,
            COALESCE(SUM(dv.cantidad),0) as piezas,
            COALESCE(SUM(dv.subtotal),0) as total
     FROM detalle_ventas dv
     JOIN ventas v ON dv.id_venta = v.id
     JOIN productos p ON dv.id_producto = p.id
     JOIN categorias c ON p.id_categoria = c.id
     WHERE ${baseWhere}
     GROUP BY p.id ORDER BY piezas ASC LIMIT 10`, baseParams);

  return { kpi, porSucursal, porVendedor, porMetodoPago, porCategoria, porProducto, bajaRotacion };
}

// ─── 2. Estadístico Semanal ───────────────────────────────────────────────────
export async function getEstadisticoSemanal({ fechaDesde, fechaHasta, sucursalId, userRole, userSucursalId }) {
  const db = await getDb();
  const [sScope, sParams] = sucursalScope(userRole, userSucursalId, sucursalId, 'v');

  // Current period date clause
  const dateClause = fechaDesde ? ` AND v.fecha >= ? AND v.fecha <= ?` : '';
  const dateParams = fechaDesde ? [fechaDesde, fechaHasta] : [];
  const baseParams = [...sParams, ...dateParams];
  const baseWhere  = `v.estatus = 'completada'${sScope}${dateClause}`;

  // Piezas por día de semana (día 0=Dom → normalizado ISO lun=1)
  const porDia = runQ(db,
    `SELECT v.fecha,
            COALESCE(SUM(vd.piezas),0) as piezas,
            COALESCE(SUM(v.total),0) as total
     FROM ventas v
     LEFT JOIN (SELECT id_venta, SUM(cantidad) as piezas FROM detalle_ventas GROUP BY id_venta) vd ON vd.id_venta = v.id
     WHERE ${baseWhere}
     GROUP BY v.fecha ORDER BY v.fecha ASC`, baseParams);

  const totalPiezas = porDia.reduce((a, r) => a + (r.piezas || 0), 0);
  const diasConVentas = porDia.filter(r => r.piezas > 0).length || 1;
  const promedioDiario = totalPiezas / diasConVentas;

  // Top 5 productos del periodo
  const topProductos = runQ(db,
    `SELECT p.nombre as producto, c.nombre as categoria,
            COALESCE(SUM(dv.cantidad),0) as piezas
     FROM detalle_ventas dv
     JOIN ventas v ON dv.id_venta = v.id
     JOIN productos p ON dv.id_producto = p.id
     JOIN categorias c ON p.id_categoria = c.id
     WHERE ${baseWhere}
     GROUP BY p.id ORDER BY piezas DESC LIMIT 5`, baseParams);

  // Por sucursal (solo admins ven todas)
  const porSucursal = isAdmin(userRole) ? runQ(db,
    `SELECT s.nombre as sucursal,
            COALESCE(SUM(vd.piezas),0) as piezas,
            COALESCE(SUM(v.total),0) as total
     FROM ventas v
     JOIN sucursales s ON v.id_sucursal = s.id
     LEFT JOIN (SELECT id_venta, SUM(cantidad) as piezas FROM detalle_ventas GROUP BY id_venta) vd ON vd.id_venta = v.id
     WHERE ${baseWhere}
     GROUP BY v.id_sucursal ORDER BY piezas DESC`, baseParams) : [];

  // Semana anterior para comparación (usando misma duración del periodo)
  let comparacion = [];
  if (fechaDesde && fechaHasta) {
    const start = new Date(fechaDesde + 'T00:00:00');
    const end   = new Date(fechaHasta + 'T00:00:00');
    const durMs = end - start + 86400000;
    const prevEnd   = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd); prevStart.setDate(prevEnd.getDate() - Math.round(durMs/86400000) + 1);
    const prevParams = [...sParams, toLocaleDateStr(prevStart), toLocaleDateStr(prevEnd)];
    const prevWhere  = `v.estatus = 'completada'${sScope} AND v.fecha >= ? AND v.fecha <= ?`;
    const prevKpi    = getOne(db,
      `SELECT COALESCE(SUM(vd.piezas),0) as piezas, COALESCE(SUM(v.total),0) as total
       FROM ventas v LEFT JOIN (SELECT id_venta, SUM(cantidad) as piezas FROM detalle_ventas GROUP BY id_venta) vd ON vd.id_venta = v.id
       WHERE ${prevWhere}`, prevParams);
    comparacion = { prevKpi, periodoAnterior: { desde: toLocaleDateStr(prevStart), hasta: toLocaleDateStr(prevEnd) } };
  }

  return { totalPiezas, promedioDiario, porDia, topProductos, porSucursal, comparacion };
}

// ─── 3. Inventario ────────────────────────────────────────────────────────────
export async function getInventarioReporte({ sucursalId, userRole, userSucursalId }) {
  const db = await getDb();
  const [sScope, sParams] = sucursalScope(userRole, userSucursalId, sucursalId, 'i');

  const rows = runQ(db,
    `SELECT p.nombre as producto, c.nombre as categoria, s.nombre as sucursal,
            i.existencia, i.minimo, i.maximo,
            CASE
              WHEN i.existencia <= 0              THEN 'agotado'
              WHEN i.existencia < i.minimo        THEN 'bajo'
              WHEN i.existencia > i.maximo        THEN 'sobrestock'
              ELSE                                     'optimo'
            END as estado
     FROM inventarios i
     JOIN productos p  ON i.id_producto = p.id
     JOIN categorias c ON p.id_categoria = c.id
     JOIN sucursales s ON i.id_sucursal  = s.id
     WHERE p.activo = 1${sScope}
     ORDER BY s.nombre, estado, p.nombre`, sParams);

  const kpi = {
    agotado:    rows.filter(r => r.estado === 'agotado').length,
    bajo:       rows.filter(r => r.estado === 'bajo').length,
    optimo:     rows.filter(r => r.estado === 'optimo').length,
    sobrestock: rows.filter(r => r.estado === 'sobrestock').length,
    total:      rows.length
  };

  return { kpi, rows };
}

// ─── 4. Movimientos de Inventario ─────────────────────────────────────────────
export async function getMovimientosInventario({ fechaDesde, fechaHasta, sucursalId, userRole, userSucursalId }) {
  const db = await getDb();
  const [sScope, sParams] = sucursalScope(userRole, userSucursalId, sucursalId, 'm');

  const dateClause = fechaDesde ? ` AND date(m.created_at) >= ? AND date(m.created_at) <= ?` : '';
  const dateParams = fechaDesde ? [fechaDesde, fechaHasta] : [];

  const rows = runQ(db,
    `SELECT m.tipo_movimiento, m.cantidad, m.referencia,
            date(m.created_at) as fecha,
            p.nombre as producto, s.nombre as sucursal,
            e.nombre || ' ' || e.apellido_paterno as usuario
     FROM movimientos_inventario m
     JOIN productos p  ON m.id_producto = p.id
     JOIN sucursales s ON m.id_sucursal  = s.id
     LEFT JOIN usuarios u ON m.id_usuario = u.id
     LEFT JOIN empleados e ON u.id_empleado = e.id
     WHERE 1=1${sScope}${dateClause}
     ORDER BY m.created_at DESC LIMIT 500`,
    [...sParams, ...dateParams]);

  const resumen = runQ(db,
    `SELECT m.tipo_movimiento,
            COUNT(*) as num_movimientos,
            COALESCE(SUM(m.cantidad),0) as total_unidades
     FROM movimientos_inventario m
     WHERE 1=1${sScope}${dateClause}
     GROUP BY m.tipo_movimiento ORDER BY num_movimientos DESC`,
    [...sParams, ...dateParams]);

  return { rows, resumen };
}

// ─── 5. Producción ────────────────────────────────────────────────────────────
export async function getProduccionReporte({ fechaDesde, fechaHasta, sucursalId, userRole, userSucursalId }) {
  const db = await getDb();
  // jefe_produccion scoped to their sucursal too
  const [sScope, sParams] = sucursalScope(userRole, userSucursalId, sucursalId, 'pr', 'id_sucursal_planta');

  const dateClause = fechaDesde ? ` AND pr.fecha >= ? AND pr.fecha <= ?` : '';
  const dateParams = fechaDesde ? [fechaDesde, fechaHasta] : [];
  const baseWhere  = `pr.estatus = 'completada'${sScope}${dateClause}`;
  const baseParams = [...sParams, ...dateParams];

  // KPI global
  const kpi = getOne(db,
    `SELECT COUNT(pr.id) as ordenes_completadas,
            COALESCE(SUM(pr.total_piezas),0) as total_piezas_producidas
     FROM producciones pr WHERE ${baseWhere}`, baseParams);

  // Por producto
  const porProducto = runQ(db,
    `SELECT p.nombre as producto, c.nombre as categoria,
            COUNT(DISTINCT dp.id_produccion) as lotes,
            COALESCE(SUM(dp.cantidad),0) as piezas_producidas
     FROM detalle_produccion dp
     JOIN producciones pr ON dp.id_produccion = pr.id
     JOIN productos p     ON dp.id_producto   = p.id
     JOIN categorias c    ON p.id_categoria   = c.id
     WHERE ${baseWhere}
     GROUP BY dp.id_producto ORDER BY piezas_producidas DESC`, baseParams);

  const productosDist = porProducto.length;

  // Por sucursal/planta
  const porSucursal = isAdmin(userRole) ? runQ(db,
    `SELECT s.nombre as sucursal,
            COUNT(pr.id) as ordenes,
            COALESCE(SUM(pr.total_piezas),0) as piezas
     FROM producciones pr
     JOIN sucursales s ON pr.id_sucursal_planta = s.id
     WHERE ${baseWhere}
     GROUP BY pr.id_sucursal_planta ORDER BY piezas DESC`, baseParams) : [];

  // Traslados del periodo
  const [tScope, tParams] = isAdmin(userRole) ? ['', []] :
    [` AND (t.id_sucursal_origen = ? OR t.id_sucursal_destino = ?)`, [userSucursalId, userSucursalId]];
  const tDateClause = fechaDesde ? ` AND t.fecha_salida >= ? AND t.fecha_salida <= ?` : '';
  const traslados = runQ(db,
    `SELECT so.nombre as origen, sd.nombre as destino,
            e.nombre || ' ' || e.apellido_paterno as repartidor,
            t.estatus, t.fecha_salida, t.fecha_entrega,
            (SELECT COUNT(*) FROM detalle_traslados dt WHERE dt.id_traslado = t.id) as productos
     FROM traslados t
     JOIN sucursales so ON t.id_sucursal_origen  = so.id
     JOIN sucursales sd ON t.id_sucursal_destino = sd.id
     JOIN empleados e   ON t.id_repartidor       = e.id
     WHERE 1=1${tScope}${tDateClause}
     ORDER BY t.fecha_salida DESC LIMIT 100`,
    [...tParams, ...(fechaDesde ? [fechaDesde, fechaHasta] : [])]);

  // Producción sugerida: ventas promedio × 1.1 del periodo. Usa ventas globales o filtradas por admin.
  const [vsScope, vsParams] = sucursalScope('admin_sistema', null, sucursalId, 'v');
  const vDateClause = fechaDesde ? ` AND v.fecha >= ? AND v.fecha <= ?` : '';
  const produccionSugerida = runQ(db,
    `SELECT p.nombre as producto,
            COALESCE(SUM(dv.cantidad),0) as vendidas,
            CAST(COALESCE(SUM(dv.cantidad),0) * 1.1 AS INTEGER) as sugerido
     FROM detalle_ventas dv
     JOIN ventas v    ON dv.id_venta    = v.id
     JOIN productos p ON dv.id_producto = p.id
     WHERE v.estatus = 'completada'${vsScope}${vDateClause}
     GROUP BY p.id ORDER BY vendidas DESC LIMIT 10`,
    [...vsParams, ...(fechaDesde ? [fechaDesde, fechaHasta] : [])]);

  // Insumos sugeridos (via recetas × produccion sugerida)
  const insumosSugeridos = runQ(db,
    `SELECT i.nombre as insumo, i.unidad_medida,
            ROUND(SUM(r.cantidad_requerida * ps.sugerido), 2) as cantidad_necesaria,
            i.stock_actual,
            ROUND(MAX(0, SUM(r.cantidad_requerida * ps.sugerido) - i.stock_actual), 2) as faltante
     FROM recetas r
     JOIN insumos i ON r.id_insumo = i.id
     JOIN (
       SELECT dv.id_producto,
              CAST(COALESCE(SUM(dv.cantidad),0) * 1.1 AS INTEGER) as sugerido
       FROM detalle_ventas dv
       JOIN ventas v ON dv.id_venta = v.id
       WHERE v.estatus = 'completada'${vsScope}${vDateClause}
       GROUP BY dv.id_producto
     ) ps ON ps.id_producto = r.id_producto
     GROUP BY r.id_insumo ORDER BY faltante DESC`,
    [...vsParams, ...(fechaDesde ? [fechaDesde, fechaHasta] : [])]);

  return {
    kpi: { ...kpi, productos_distintos: productosDist },
    porProducto, porSucursal, traslados, produccionSugerida, insumosSugeridos
  };
}

// ─── 6. Personal ──────────────────────────────────────────────────────────────
export async function getPersonalReporte({ fechaDesde, fechaHasta, sucursalId, userRole, userSucursalId }) {
  const db = await getDb();
  
  // RRHH debe ver todas las sucursales
  const sRole = userRole === 'recursos_humanos' ? 'admin_sistema' : userRole;
  const [sScope, sParams] = sucursalScope(sRole, userSucursalId, sucursalId, 'e');

  const dateClause = fechaDesde ? ` AND a.fecha >= ? AND a.fecha <= ?` : '';
  const dateParams = fechaDesde ? [fechaDesde, fechaHasta] : [];

  // Asistencias por empleado
  const asistencias = runQ(db,
    `SELECT e.nombre || ' ' || e.apellido_paterno as empleado,
            s.nombre as sucursal,
            COUNT(a.id) as registros,
            SUM(CASE WHEN a.hora_entrada IS NOT NULL THEN 1 ELSE 0 END) as presencias,
            SUM(CASE WHEN a.hora_entrada IS NULL     THEN 1 ELSE 0 END) as ausencias
     FROM asistencias a
     JOIN empleados e   ON a.id_empleado = e.id
     JOIN sucursales s  ON e.id_sucursal = s.id
     WHERE e.estatus = 'activo'${sScope}${dateClause}
     GROUP BY a.id_empleado ORDER BY e.nombre ASC`,
    [...sParams, ...dateParams]);

  // Horas extra por estatus
  const horasExtra = runQ(db,
    `SELECT e.nombre || ' ' || e.apellido_paterno as empleado,
            s.nombre as sucursal,
            he.fecha, he.cantidad_horas as horas, he.motivo, he.estatus
     FROM horas_extra he
     JOIN empleados e  ON he.id_empleado = e.id
     JOIN sucursales s ON e.id_sucursal  = s.id
     WHERE e.estatus = 'activo'${sScope}${fechaDesde ? ` AND he.fecha >= ? AND he.fecha <= ?` : ''}
     ORDER BY he.fecha DESC LIMIT 200`,
    [...sParams, ...(fechaDesde ? [fechaDesde, fechaHasta] : [])]);

  const resumenHE = runQ(db,
    `SELECT he.estatus,
            COUNT(*) as total,
            COALESCE(SUM(he.cantidad_horas),0) as total_horas
     FROM horas_extra he
     JOIN empleados e ON he.id_empleado = e.id
     WHERE e.estatus = 'activo'${sScope}${fechaDesde ? ` AND he.fecha >= ? AND he.fecha <= ?` : ''}
     GROUP BY he.estatus`,
    [...sParams, ...(fechaDesde ? [fechaDesde, fechaHasta] : [])]);

  // Nómina
  const nominas = runQ(db,
    `SELECT e.nombre || ' ' || e.apellido_paterno as empleado,
            s.nombre as sucursal,
            n.periodo_inicio, n.periodo_fin,
            n.salario_base, n.monto_horas_extra,
            n.total_pagar, n.estatus
     FROM nominas n
     JOIN empleados e  ON n.id_empleado = e.id
     JOIN sucursales s ON e.id_sucursal  = s.id
     WHERE e.estatus = 'activo'${sScope}${fechaDesde ? ` AND n.periodo_inicio >= ? AND n.periodo_fin <= ?` : ''}
     ORDER BY n.periodo_inicio DESC LIMIT 200`,
    [...sParams, ...(fechaDesde ? [fechaDesde, fechaHasta] : [])]);

  const resumenNomina = getOne(db,
    `SELECT COALESCE(SUM(n.total_pagar),0) as total_pagado,
            SUM(CASE WHEN n.estatus = 'pendiente' THEN n.total_pagar ELSE 0 END) as pendiente,
            SUM(CASE WHEN n.estatus = 'pagada'    THEN n.total_pagar ELSE 0 END) as pagado,
            COUNT(*) as registros
     FROM nominas n
     JOIN empleados e ON n.id_empleado = e.id
     WHERE e.estatus = 'activo'${sScope}${fechaDesde ? ` AND n.periodo_inicio >= ? AND n.periodo_fin <= ?` : ''}`,
    [...sParams, ...(fechaDesde ? [fechaDesde, fechaHasta] : [])]);

  const empleadosActivos = (getOne(db,
    `SELECT COUNT(*) as total FROM empleados e WHERE e.estatus = 'activo'${sScope}`, sParams) || {}).total || 0;

  return { empleadosActivos, asistencias, horasExtra, resumenHE, nominas, resumenNomina };
}
