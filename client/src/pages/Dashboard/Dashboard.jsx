import { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { ShoppingCart, DollarSign, Package, Users, Clock, Store, Star, AlertTriangle, TrendingUp, Wheat } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard').then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="spinner" />;
  if (!stats) return <div className="alert alert-error">No se pudieron cargar los datos del dashboard</div>;

  const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n || 0);

  const isVendedor = user?.rol === 'vendedor';
  const isRRHH = user?.rol === 'recursos_humanos';
  const isJefeProd = user?.rol === 'jefe_produccion';
  const isRepartidor = user?.rol === 'repartidor';

  const showVentas = !isRRHH;
  const showRH = !isVendedor && !isRepartidor && !isJefeProd;
  const showSucursales = !isVendedor && !isRepartidor && !isJefeProd && !isRRHH;
  const showInventario = !isRRHH;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">¡Buen día, {user?.nombre?.split(' ')[0]}!</h2>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 4 }}>
            Resumen operativo — {new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        {showVentas && (
          <>
            <div className="card stat-card">
              <div className="stat-icon" style={{ background: 'rgba(148,104,43,0.12)' }}><ShoppingCart size={24} color="var(--color-accent)" /></div>
              <div className="stat-value">{stats.ventasDia?.count || 0}</div>
              <div className="stat-label">Ventas del día</div>
            </div>
            <div className="card stat-card">
              <div className="stat-icon" style={{ background: 'rgba(90,138,74,0.12)' }}><DollarSign size={24} color="var(--color-success)" /></div>
              <div className="stat-value">{fmt(stats.ventasDia?.total)}</div>
              <div className="stat-label">Ingresos del día</div>
            </div>
            <div className="card stat-card">
              <div className="stat-icon" style={{ background: 'rgba(189,155,94,0.15)' }}><TrendingUp size={24} color="var(--color-secondary)" /></div>
              <div className="stat-value">{fmt(stats.ventasSemana?.total)}</div>
              <div className="stat-label">Ventas semanales</div>
            </div>
          </>
        )}
        
        {showSucursales && (
          <div className="card stat-card">
            <div className="stat-icon" style={{ background: 'rgba(148,104,43,0.12)' }}><Store size={24} color="var(--color-accent)" /></div>
            <div className="stat-value">{stats.sucursalesActivas || 0}</div>
            <div className="stat-label">Sucursales activas</div>
          </div>
        )}

        {showRH && (
          <>
            <div className="card stat-card">
              <div className="stat-icon" style={{ background: 'rgba(90,138,74,0.12)' }}><Users size={24} color="var(--color-success)" /></div>
              <div className="stat-value">{stats.empleadosActivos || 0}</div>
              <div className="stat-label">Empleados activos</div>
            </div>
            <div className="card stat-card">
              <div className="stat-icon" style={{ background: stats.horasExtraPendientes > 0 ? 'rgba(184,134,11,0.12)' : 'rgba(107,125,142,0.12)' }}>
                <Clock size={24} color={stats.horasExtraPendientes > 0 ? 'var(--color-warning)' : 'var(--color-info)'} />
              </div>
              <div className="stat-value">{stats.horasExtraPendientes || 0}</div>
              <div className="stat-label">Horas extra pendientes</div>
            </div>
            <div className="card stat-card">
              <div className="stat-icon" style={{ background: 'rgba(90,138,74,0.12)' }}>
                <Users size={24} color="var(--color-success)" />
              </div>
              <div className="stat-value">{stats.empleadosPresentes || 0}</div>
              <div className="stat-label">Presentes hoy</div>
            </div>
          </>
        )}
      </div>

      <div className="dashboard-grid">
        {/* Piezas por tipo */}
        {showVentas && (
          <div className="card">
            <div className="card-header"><h3 className="card-title"><Wheat size={20} style={{ display: 'inline', marginRight: 8 }} />Piezas vendidas hoy</h3></div>
            <div style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
              <div className="card stat-card" style={{ flex: 1, minWidth: 140, background: 'var(--color-surface-alt)' }}>
                <div className="stat-value">{stats.piezasPorTipo?.pan_blanco || 0}</div>
                <div className="stat-label">Pan Blanco</div>
              </div>
              <div className="card stat-card" style={{ flex: 1, minWidth: 140, background: 'var(--color-surface-alt)' }}>
                <div className="stat-value">{stats.piezasPorTipo?.pan_dulce || 0}</div>
                <div className="stat-label">Pan Dulce</div>
              </div>
              <div className="card stat-card" style={{ flex: 1, minWidth: 140, background: 'var(--color-surface-alt)' }}>
                <div className="stat-value">{stats.piezasPorTipo?.reposteria || 0}</div>
                <div className="stat-label">Repostería</div>
              </div>
            </div>
          </div>
        )}

        {/* Producto Estrella */}
        {showVentas && (
          <div className="card">
            <div className="card-header"><h3 className="card-title"><Star size={20} style={{ display: 'inline', marginRight: 8, color: 'var(--color-secondary)' }} />Producto Estrella</h3></div>
            {stats.productoEstrella?.length > 0 ? stats.productoEstrella.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontWeight: 600 }}>{p.nombre}</span>
                <span className="badge badge-star">{p.piezas} piezas hoy</span>
              </div>
            )) : <p style={{ color: 'var(--color-text-light)', fontSize: 'var(--font-size-sm)' }}>Sin ventas registradas hoy</p>}
          </div>
        )}

        {/* Ventas por sucursal */}
        {showSucursales && showVentas && (
          <div className="card">
            <div className="card-header"><h3 className="card-title"><Store size={20} style={{ display: 'inline', marginRight: 8 }} />Ventas por sucursal hoy</h3></div>
            {stats.ventasPorSucursal?.length > 0 ? (
              <div className="table-container"><table className="table"><thead><tr><th>Sucursal</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead><tbody>
                {stats.ventasPorSucursal.map((s, i) => (
                  <tr key={i}><td>{s.nombre}</td><td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(s.total)}</td></tr>
                ))}
              </tbody></table></div>
            ) : <p style={{ color: 'var(--color-text-light)', fontSize: 'var(--font-size-sm)' }}>Sin ventas registradas hoy</p>}
          </div>
        )}

        {/* Top productos */}
        {showVentas && (
          <div className="card">
            <div className="card-header"><h3 className="card-title"><Package size={20} style={{ display: 'inline', marginRight: 8 }} />Productos más vendidos</h3></div>
            {stats.topProductos?.length > 0 ? (
              <div className="table-container"><table className="table"><thead><tr><th>Producto</th><th style={{ textAlign: 'right' }}>Piezas</th></tr></thead><tbody>
                {stats.topProductos.map((p, i) => (
                  <tr key={i}><td>{p.nombre}</td><td style={{ textAlign: 'right' }}><span className="badge badge-accent">{p.total_piezas}</span></td></tr>
                ))}
              </tbody></table></div>
            ) : <p style={{ color: 'var(--color-text-light)', fontSize: 'var(--font-size-sm)' }}>Sin datos</p>}
          </div>
        )}

        {/* Alertas de inventario */}
        {showInventario && (
          <div className="card full-width">
            <div className="card-header"><h3 className="card-title"><AlertTriangle size={20} style={{ display: 'inline', marginRight: 8, color: 'var(--color-warning)' }} />Alertas de inventario bajo</h3></div>
            {stats.inventarioBajo?.length > 0 ? (
              <div className="table-container"><table className="table"><thead><tr><th>Producto</th><th>Sucursal</th><th>Existencia</th><th>Mínimo</th><th>Estado</th></tr></thead><tbody>
                {stats.inventarioBajo.map((item, i) => (
                  <tr key={i}><td>{item.producto}</td><td>{item.sucursal}</td><td style={{ fontWeight: 600 }}>{item.existencia}</td><td>{item.minimo}</td>
                    <td><span className="badge badge-warning">⚠ Bajo</span></td></tr>
                ))}
              </tbody></table></div>
            ) : <div className="alert alert-success" style={{ border: 'none' }}>✓ Todos los inventarios están por encima del mínimo</div>}
          </div>
        )}
      </div>
    </div>
  );
}
