import { getDb } from '../config/database.js';
import { toLocaleDateStr } from './reportesService.js';

export async function getDashboardStats(userRole, userSucursalId) {
  const db = await getDb();
  const today = toLocaleDateStr(new Date());
  const stats = {};

  // Helper for sucursal filtering
  const isRestricted = userRole === 'gerente_sucursal' || userRole === 'vendedor';
  const filterClause = isRestricted ? ' AND id_sucursal = ?' : '';
  const filterParams = isRestricted ? [userSucursalId] : [];

  const runQuery = (sql, params = []) => {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  };

  const getOne = (sql, params = []) => {
    const res = runQuery(sql, params);
    return res.length > 0 ? res[0] : null;
  };

  // 1. Ventas del día
  const ventasDia = getOne(
    `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count 
     FROM ventas 
     WHERE fecha = ? AND estatus = 'completada' ${filterClause}`,
    [today, ...filterParams]
  );
  stats.ventasDia = ventasDia;

  // 2. Ventas semanales
  const dayOfWeek = new Date().getDay();
  const monday = new Date();
  monday.setDate(monday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const mondayStr = toLocaleDateStr(monday);
  const ventasSemana = getOne(
    `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count 
     FROM ventas 
     WHERE fecha >= ? AND fecha <= ? AND estatus = 'completada' ${filterClause}`,
    [mondayStr, today, ...filterParams]
  );
  stats.ventasSemana = ventasSemana;

  // 3. Piezas vendidas por categoría hoy
  stats.piezasPorCategoria = {};
  const piezasRes = runQuery(
    `SELECT c.nombre as categoria, COALESCE(SUM(dv.cantidad),0) as piezas 
     FROM detalle_ventas dv 
     JOIN ventas v ON dv.id_venta = v.id 
     JOIN productos p ON dv.id_producto = p.id 
     JOIN categorias c ON p.id_categoria = c.id
     WHERE v.fecha = ? AND v.estatus = 'completada' ${isRestricted ? ' AND v.id_sucursal = ?' : ''}
     GROUP BY c.nombre`,
    [today, ...filterParams]
  );
  piezasRes.forEach(r => { stats.piezasPorCategoria[r.categoria] = r.piezas; });

  // 4. Ventas por sucursal hoy (Solo si es admin/propietario)
  if (!isRestricted) {
    stats.ventasPorSucursal = runQuery(
      `SELECT s.nombre, COALESCE(SUM(v.total),0) as total 
       FROM ventas v 
       JOIN sucursales s ON v.id_sucursal = s.id 
       WHERE v.fecha = ? AND v.estatus = 'completada' 
       GROUP BY v.id_sucursal ORDER BY total DESC`,
      [today]
    );
  } else {
    stats.ventasPorSucursal = [];
  }

  // 5. Top productos hoy
  stats.topProductos = runQuery(
    `SELECT p.nombre, SUM(dv.cantidad) as total_piezas 
     FROM detalle_ventas dv 
     JOIN ventas v ON dv.id_venta = v.id 
     JOIN productos p ON dv.id_producto = p.id 
     WHERE v.fecha = ? AND v.estatus = 'completada' ${isRestricted ? ' AND v.id_sucursal = ?' : ''}
     GROUP BY dv.id_producto ORDER BY total_piezas DESC LIMIT 5`,
    [today, ...filterParams]
  );

  // 6. Producto estrella hoy
  stats.productoEstrella = runQuery(
    `SELECT p.nombre, COALESCE(SUM(dv.cantidad),0) as piezas 
     FROM detalle_ventas dv 
     JOIN ventas v ON dv.id_venta = v.id 
     JOIN productos p ON dv.id_producto = p.id 
     WHERE v.fecha = ? AND v.estatus = 'completada' AND p.es_estrella = 1 ${isRestricted ? ' AND v.id_sucursal = ?' : ''}
     GROUP BY p.id`,
    [today, ...filterParams]
  );

  // 7. Inventario bajo
  stats.inventarioBajo = runQuery(
    `SELECT i.existencia, i.minimo, p.nombre as producto, s.nombre as sucursal 
     FROM inventarios i 
     JOIN productos p ON i.id_producto = p.id 
     JOIN sucursales s ON i.id_sucursal = s.id 
     WHERE i.existencia <= i.minimo AND p.activo = 1 ${isRestricted ? ' AND i.id_sucursal = ?' : ''}`,
    filterParams
  );

  // 8. Horas extra pendientes (Filtrar por sucursal del empleado)
  stats.horasExtraPendientes = getOne(
    `SELECT COUNT(*) as total 
     FROM horas_extra he 
     JOIN empleados e ON he.id_empleado = e.id 
     WHERE he.estatus = 'pendiente' ${isRestricted ? ' AND e.id_sucursal = ?' : ''}`,
    filterParams
  ).total;

  // 9. Otros contadores
  stats.empleadosActivos = getOne(
    `SELECT COUNT(*) as total FROM empleados WHERE estatus = 'activo' ${filterClause}`,
    filterParams
  ).total;
  
  stats.sucursalesActivas = isRestricted ? 1 : getOne('SELECT COUNT(*) as total FROM sucursales WHERE activo = 1').total;

  // 10. Producción sugerida (Lógica simplificada basada en promedio de ventas de la última semana)
  const lastWeek = new Date();
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastWeekStr = toLocaleDateStr(lastWeek);
  
  stats.produccionSugerida = runQuery(
    `SELECT p.nombre, CAST(AVG(dv.cantidad) * 1.1 AS INTEGER) as sugerido 
     FROM detalle_ventas dv 
     JOIN ventas v ON dv.id_venta = v.id 
     JOIN productos p ON dv.id_producto = p.id 
     WHERE v.fecha >= ? AND v.estatus = 'completada' ${isRestricted ? ' AND v.id_sucursal = ?' : ''}
     GROUP BY p.id ORDER BY sugerido DESC LIMIT 5`,
    [lastWeekStr, ...filterParams]
  );

  // 11. Empleados presentes hoy
  stats.empleadosPresentes = getOne(
    `SELECT COUNT(*) as total
     FROM asistencias a
     JOIN empleados e ON a.id_empleado = e.id
     WHERE a.fecha = ? AND a.hora_entrada IS NOT NULL AND a.hora_salida IS NULL ${isRestricted ? ' AND e.id_sucursal = ?' : ''}`,
    [today, ...filterParams]
  ).total;

  return stats;
}
