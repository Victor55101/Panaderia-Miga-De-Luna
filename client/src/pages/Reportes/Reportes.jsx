import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { BarChart2, Calendar, Package, Users, Factory, Download, RefreshCw, TrendingUp, TrendingDown, AlertTriangle, Activity } from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
function toLocaleDateStr(d) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

function fmt(n) { return new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(n||0); }
function fmtN(n) { return new Intl.NumberFormat('es-MX').format(n||0); }

function exportCSV(headers, rows, filename) {
  const esc = v => `"${String(v??'').replace(/"/g,'""')}"`;
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => esc(r[h]??r[Object.keys(r)[headers.indexOf(h)]]??'')).join(','))];
  const blob = new Blob(['\uFEFF'+lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}

function exportExcel(headers, rows, filename, meta) {
  const esc = v => String(v ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const title = meta?.title || filename.replace(/_/g, ' ').toUpperCase();
  const tableHtml = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"></head>
    <body>
      <table border="1" style="border-collapse: collapse; font-family: sans-serif; color: #55370f; border: 2px solid #94682b;">
        <thead>
          <tr>
            <th colspan="${headers.length}" style="text-align: left; font-size: 16px; font-weight: bold; padding: 8px; background-color: #55370f; color: #f1eada;">
              ${esc(title)}
            </th>
          </tr>
          <tr>
            <th colspan="${headers.length}" style="text-align: left; padding: 8px; background-color: #f1eada; color: #55370f;">
              Sucursal: ${esc(meta?.sucursal)} | Periodo: ${esc(meta?.periodo)} | Generado: ${esc(meta?.generado)}
            </th>
          </tr>
          <tr>
            ${headers.map(h => `<th style="background-color: #55370f; color: #f1eada; padding: 8px; text-transform: capitalize; border: 1px solid #bd9b5e;">${esc(h).replace(/_/g, ' ')}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows.map((r, i) => {
            const bg = i % 2 === 0 ? '#f1eada' : '#ffffff';
            return `<tr>
              ${headers.map(h => `<td style="background-color: ${bg}; padding: 8px; border: 1px solid #bd9b5e;">${esc(r[h] ?? r[Object.keys(r)[headers.indexOf(h)]] ?? '')}</td>`).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
  const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = filename; a.click(); URL.revokeObjectURL(a.href);
}


function ExportButtons({ meta, headers, rows, filename }) {
  if (!rows || !rows.length) return null;
  return (
    <div style={{display:'flex', justifyContent:'flex-end', gap:'8px', marginBottom:'var(--space-lg)'}}>
      <button className="btn btn-secondary" style={{gap:'6px'}} onClick={() => exportCSV(headers, rows, filename + '.csv')}>
        <Download size={15}/> CSV
      </button>
      <button className="btn btn-secondary" style={{gap:'6px'}} onClick={() => exportExcel(headers, rows, filename + '.xls', meta)}>
        <Download size={15}/> Excel
      </button>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, color }) {
  return (
    <div className="card stat-card" style={{flex:'1 1 160px'}}>
      <div className="stat-icon" style={{background:'var(--color-surface-alt)'}}><Icon size={22} color={color}/></div>
      <div className="stat-value" style={{fontSize:'1.4rem'}}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function EmptyState({ msg }) {
  return <div className="text-center text-secondary" style={{padding:'2rem'}}>{msg||'Sin datos para el periodo seleccionado'}</div>;
}

function SimpleTable({ cols, rows, emptyMsg }) {
  if (!rows?.length) return <EmptyState msg={emptyMsg}/>;
  return (
    <div className="table-container">
      <table className="table">
        <thead><tr>{cols.map(c=><th key={c.k}>{c.label}</th>)}</tr></thead>
        <tbody>{rows.map((r,i)=>(
          <tr key={i}>{cols.map(c=><td key={c.k}>{c.fmt?c.fmt(r[c.k]):r[c.k]??'—'}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ── Period picker ─────────────────────────────────────────────────────────────
const PERIODS = [
  {value:'hoy',label:'Hoy'},
  {value:'ayer',label:'Ayer'},
  {value:'semana_actual',label:'Semana actual'},
  {value:'semana_pasada',label:'Semana pasada (lun-dom)'},
  {value:'mes',label:'Último mes (30 d)'},
  {value:'trimestre',label:'Trimestre (90 d)'},
  {value:'rango',label:'Rango de fechas'},
  {value:'todos',label:'Cualquier fecha'},
];

export default function Reportes() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const rol = user?.rol;

  const isAdmin  = ['propietario','admin_sistema'].includes(rol);
  const isGte    = rol === 'gerente_sucursal';
  const isJefe   = rol === 'jefe_produccion';
  const isRRHH   = rol === 'recursos_humanos';

  // Tab visibility
  const tabs = [
    isAdmin||isGte ? {id:'ventas',  label:'Ventas',     Icon:BarChart2} : null,
    isAdmin||isGte ? {id:'semanal', label:'Semanal',    Icon:Calendar}  : null,
    isAdmin||isJefe? {id:'produccion',label:'Producción',Icon:Factory}  : null,
    isAdmin||isGte||isJefe ? {id:'inventario',label:'Inventario',Icon:Package} : null,
    isAdmin||isRRHH? {id:'personal', label:'Personal',   Icon:Users}    : null,
  ].filter(Boolean);

  const [activeTab, setActiveTab] = useState(tabs[0]?.id || 'ventas');
  const [periodo, setPeriodo] = useState('semana_actual');
  const [rangoDesde, setRangoDesde] = useState(toLocaleDateStr(new Date()));
  const [rangoHasta, setRangoHasta] = useState(toLocaleDateStr(new Date()));
  const [sucursales, setSucursales] = useState([]);
  const [sucursalId, setSucursalId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({});

  let metaSucursal = 'Vista global';
  if (sucursalId) {
    metaSucursal = sucursales.find(s=>String(s.id)===String(sucursalId))?.nombre || 'Sucursal';
  } else if (!isAdmin && !isRRHH && user?.sucursal_nombre) {
    metaSucursal = user.sucursal_nombre;
  }

  const rptMeta = {
    sucursal: metaSucursal,
    periodo: PERIODS.find(p=>p.value===periodo)?.label || 'Rango personalizado',
    generado: new Date().toLocaleString()
  };

  useEffect(() => {
    if (isAdmin) api.getSucursalesSelect().then(setSucursales).catch(()=>{});
  }, [isAdmin]);

  const buildParams = useCallback(() => {
    const p = { periodo };
    if (periodo === 'rango') { p.rangoDesde = rangoDesde; p.rangoHasta = rangoHasta; }
    if (isAdmin && sucursalId) p.sucursalId = sucursalId;
    return p;
  }, [periodo, rangoDesde, rangoHasta, sucursalId, isAdmin]);

  const fetchTab = useCallback(async (tab) => {
    setLoading(true);
    const p = buildParams();
    try {
      let result;
      if (tab==='ventas')     result = await api.getReporteVentas(p);
      else if (tab==='semanal')    result = await api.getReporteSemanal(p);
      else if (tab==='inventario') {
        const [inv, movs] = await Promise.all([
          api.getReporteInventario(p),
          api.getReporteMovimientos(p)
        ]);
        result = { ...inv, movimientos: movs.rows, movimientosResumen: movs.resumen };
      }
      else if (tab==='produccion') result = await api.getReporteProduccion(p);
      else if (tab==='personal')   result = await api.getReportePersonal(p);
      setData(prev => ({ ...prev, [tab]: result }));
    } catch(e) {
      showToast(e.message||'Error al cargar reporte', 'error');
    } finally { setLoading(false); }
  }, [buildParams, showToast]);

  useEffect(() => {
    fetchTab(activeTab);
  }, [activeTab, fetchTab]);


  const d = data[activeTab] || {};

  // ── Render Ventas tab ────────────────────────────────────────────────────
  function TabVentas() {
    const kpi = d.kpi || {};
    return (
      <div>
        <div style={{display:'flex',gap:'var(--space-md)',flexWrap:'wrap',marginBottom:'var(--space-lg)'}}>
          <KpiCard label="Total facturado" value={fmt(kpi.total_facturado)} icon={BarChart2} color="var(--color-accent)"/>
          <KpiCard label="Nº ventas" value={fmtN(kpi.num_ventas)} icon={TrendingUp} color="var(--color-success)"/>
          <KpiCard label="Ticket promedio" value={fmt(kpi.ticket_promedio)} icon={TrendingUp} color="var(--color-secondary)"/>
          <KpiCard label="Piezas vendidas" value={fmtN(kpi.total_piezas)} icon={Package} color="var(--color-info)"/>
        </div>

        <h4 style={{marginBottom:'var(--space-sm)'}}>Por Sucursal</h4>
        <SimpleTable cols={[{k:'sucursal',label:'Sucursal'},{k:'num_ventas',label:'Ventas'},{k:'piezas',label:'Piezas',fmt:fmtN},{k:'total',label:'Total',fmt:fmt},{k:'ticket_promedio',label:'Ticket Prom.',fmt:fmt}]} rows={d.porSucursal}/>
        <ExportButtons meta={rptMeta} headers={['sucursal','num_ventas','piezas','total','ticket_promedio']} rows={d.porSucursal||[]} filename="ventas_por_sucursal" />

        <h4 style={{marginBottom:'var(--space-sm)'}}>Por Categoría</h4>
        <SimpleTable cols={[{k:'categoria',label:'Categoría'},{k:'piezas',label:'Piezas',fmt:fmtN},{k:'total',label:'Total',fmt:fmt}]} rows={d.porCategoria}/>

        <h4 style={{marginTop:'var(--space-lg)',marginBottom:'var(--space-sm)'}}>Por Método de Pago</h4>
        <SimpleTable cols={[{k:'metodo_pago',label:'Método'},{k:'num_ventas',label:'Ventas'},{k:'total',label:'Total',fmt:fmt}]} rows={d.porMetodoPago}/>

        <h4 style={{marginTop:'var(--space-lg)',marginBottom:'var(--space-sm)'}}>Por Vendedor</h4>
        <SimpleTable cols={[{k:'vendedor',label:'Vendedor'},{k:'sucursal',label:'Sucursal'},{k:'num_ventas',label:'Ventas'},{k:'piezas',label:'Piezas',fmt:fmtN},{k:'total',label:'Total',fmt:fmt}]} rows={d.porVendedor}/>

        <h4 style={{marginTop:'var(--space-lg)',marginBottom:'var(--space-sm)'}}>Top 10 Productos</h4>
        <SimpleTable cols={[{k:'producto',label:'Producto'},{k:'categoria',label:'Categoría'},{k:'piezas',label:'Piezas',fmt:fmtN},{k:'total',label:'Total',fmt:fmt}]} rows={d.porProducto}/>
        <ExportButtons meta={rptMeta} headers={['producto','categoria','piezas','total']} rows={d.porProducto||[]} filename="top_productos" />

        <h4 style={{marginBottom:'var(--space-sm)'}}>Productos con Baja Rotación</h4>
        <SimpleTable cols={[{k:'producto',label:'Producto'},{k:'categoria',label:'Categoría'},{k:'piezas',label:'Piezas',fmt:fmtN},{k:'total',label:'Total',fmt:fmt}]} rows={d.bajaRotacion}/>
      </div>
    );
  }

  // ── Render Semanal tab ───────────────────────────────────────────────────
  function TabSemanal() {
    const prev = d.comparacion?.prevKpi || {};
    const diff = d.totalPiezas && prev.piezas ? ((d.totalPiezas - prev.piezas)/prev.piezas*100).toFixed(1) : null;
    return (
      <div>
        <div style={{display:'flex',gap:'var(--space-md)',flexWrap:'wrap',marginBottom:'var(--space-lg)'}}>
          <KpiCard label="Piezas del periodo" value={fmtN(d.totalPiezas)} icon={Package} color="var(--color-accent)"/>
          <KpiCard label="Promedio diario" value={fmtN(Math.round(d.promedioDiario||0))} icon={BarChart2} color="var(--color-success)"/>
          {diff!==null && <KpiCard label="vs periodo anterior" value={`${diff>0?'+':''}${diff}%`} icon={diff>=0?TrendingUp:TrendingDown} color={diff>=0?'var(--color-success)':'var(--color-error)'}/>}
          {prev.piezas!==undefined && <KpiCard label="Piezas periodo ant." value={fmtN(prev.piezas)} icon={Calendar} color="var(--color-text-secondary)"/>}
        </div>

        <h4 style={{marginBottom:'var(--space-sm)'}}>Piezas por día</h4>
        <SimpleTable cols={[{k:'fecha',label:'Fecha'},{k:'piezas',label:'Piezas',fmt:fmtN},{k:'total',label:'Total',fmt:fmt}]} rows={d.porDia}/>
        <ExportButtons meta={rptMeta} headers={['fecha','piezas','total']} rows={d.porDia||[]} filename="estadistico_diario" />

        <h4 style={{marginBottom:'var(--space-sm)'}}>Top 5 Productos del Periodo</h4>
        <SimpleTable cols={[{k:'producto',label:'Producto'},{k:'categoria',label:'Categoría'},{k:'piezas',label:'Piezas',fmt:fmtN}]} rows={d.topProductos}/>

        {isAdmin && d.porSucursal?.length > 0 && (<>
          <h4 style={{marginTop:'var(--space-lg)',marginBottom:'var(--space-sm)'}}>Por Sucursal</h4>
          <SimpleTable cols={[{k:'sucursal',label:'Sucursal'},{k:'piezas',label:'Piezas',fmt:fmtN},{k:'total',label:'Total',fmt:fmt}]} rows={d.porSucursal}/>
        </>)}
      </div>
    );
  }

  // ── Render Inventario tab ────────────────────────────────────────────────
  function TabInventario() {
    const kpi = d.kpi || {};
    return (
      <div>
        <div style={{display:'flex',gap:'var(--space-md)',flexWrap:'wrap',marginBottom:'var(--space-lg)'}}>
          <KpiCard label="Agotados" value={kpi.agotado||0} icon={AlertTriangle} color="var(--color-error)"/>
          <KpiCard label="Stock bajo" value={kpi.bajo||0} icon={AlertTriangle} color="var(--color-warning)"/>
          <KpiCard label="Óptimo" value={kpi.optimo||0} icon={Package} color="var(--color-success)"/>
          <KpiCard label="Sobrestock" value={kpi.sobrestock||0} icon={Package} color="var(--color-info)"/>
        </div>
        <ExportButtons meta={rptMeta} headers={['sucursal','producto','categoria','existencia','minimo','maximo','estado']} rows={d.rows||[]} filename="inventario" />
        <SimpleTable
          cols={[
            {k:'sucursal',label:'Sucursal'},{k:'producto',label:'Producto'},{k:'categoria',label:'Categoría'},
            {k:'existencia',label:'Existencia',fmt:fmtN},{k:'minimo',label:'Mínimo'},{k:'maximo',label:'Máximo'},
            {k:'estado',label:'Estado',fmt:(v)=>{
              const map={agotado:'badge-error',bajo:'badge-warning',optimo:'badge-success',sobrestock:'badge-info'};
              return <span className={`badge ${map[v]||''}`}>{v?.toUpperCase()}</span>;
            }}
          ]}
          rows={d.rows}
        />
        {d.movimientosResumen?.length > 0 && (<>
          <h4 style={{marginTop:'var(--space-lg)',marginBottom:'var(--space-sm)'}}>Movimientos del Periodo</h4>
          <div style={{display:'flex',gap:'var(--space-md)',flexWrap:'wrap',marginBottom:'var(--space-md)'}}>
            {d.movimientosResumen.map(r => (
              <KpiCard key={r.tipo_movimiento} label={r.tipo_movimiento} value={r.num_movimientos} icon={Activity} color="var(--color-accent)"/>
            ))}
          </div>
          <ExportButtons meta={rptMeta} headers={['fecha','sucursal','producto','tipo_movimiento','cantidad','usuario','referencia']} rows={d.movimientos||[]} filename="movimientos_inventario" />
          <SimpleTable
            cols={[
              {k:'fecha',label:'Fecha'},{k:'sucursal',label:'Sucursal'},{k:'producto',label:'Producto'},
              {k:'tipo_movimiento',label:'Tipo'},{k:'cantidad',label:'Cantidad',fmt:fmtN},
              {k:'usuario',label:'Usuario'},{k:'referencia',label:'Referencia'}
            ]}
            rows={d.movimientos}
          />
        </>)}
      </div>
    );
  }

  // ── Render Producción tab ────────────────────────────────────────────────
  function TabProduccion() {
    const kpi = d.kpi || {};
    return (
      <div>
        <div style={{display:'flex',gap:'var(--space-md)',flexWrap:'wrap',marginBottom:'var(--space-lg)'}}>
          <KpiCard label="Total piezas producidas" value={fmtN(kpi.total_piezas_producidas)} icon={Factory} color="var(--color-accent)"/>
          <KpiCard label="Órdenes completadas" value={fmtN(kpi.ordenes_completadas)} icon={TrendingUp} color="var(--color-success)"/>
          <KpiCard label="Productos distintos" value={fmtN(kpi.productos_distintos)} icon={Package} color="var(--color-secondary)"/>
        </div>

        <h4 style={{marginBottom:'var(--space-sm)'}}>Producción por Producto</h4>
        <SimpleTable cols={[{k:'producto',label:'Producto'},{k:'categoria',label:'Categoría'},{k:'lotes',label:'Lotes'},{k:'piezas_producidas',label:'Piezas',fmt:fmtN}]} rows={d.porProducto}/>
        <ExportButtons meta={rptMeta} headers={['producto','categoria','lotes','piezas_producidas']} rows={d.porProducto||[]} filename="produccion_por_producto" />

        {isAdmin && d.porSucursal?.length>0 && (<>
          <h4 style={{marginBottom:'var(--space-sm)'}}>Por Planta / Sucursal</h4>
          <SimpleTable cols={[{k:'sucursal',label:'Planta'},{k:'ordenes',label:'Órdenes'},{k:'piezas',label:'Piezas',fmt:fmtN}]} rows={d.porSucursal}/>
        </>)}

        <h4 style={{marginTop:'var(--space-lg)',marginBottom:'var(--space-sm)'}}>Traslados del Periodo</h4>
        <SimpleTable cols={[{k:'origen',label:'Origen'},{k:'destino',label:'Destino'},{k:'repartidor',label:'Repartidor'},{k:'productos',label:'Productos'},{k:'fecha_salida',label:'Salida'},{k:'estatus',label:'Estatus'}]} rows={d.traslados}/>

        <h4 style={{marginTop:'var(--space-lg)',marginBottom:'var(--space-sm)'}}>Producción Sugerida (ventas × 1.1)</h4>
        <SimpleTable cols={[{k:'producto',label:'Producto'},{k:'vendidas',label:'Vendidas',fmt:fmtN},{k:'sugerido',label:'Sugerido',fmt:fmtN}]} rows={d.produccionSugerida}/>

        <h4 style={{marginTop:'var(--space-lg)',marginBottom:'var(--space-sm)'}}>Insumos Necesarios (por recetas)</h4>
        {d.insumosSugeridos?.length ? (
          <>
            <SimpleTable cols={[{k:'insumo',label:'Insumo'},{k:'unidad_medida',label:'Unidad'},{k:'cantidad_necesaria',label:'Necesario'},{k:'stock_actual',label:'En stock'},{k:'faltante',label:'Faltante',fmt:(v)=><span style={{color:v>0?'var(--color-error)':'var(--color-success)',fontWeight:'bold'}}>{v}</span>}]} rows={d.insumosSugeridos}/>
            <ExportButtons meta={rptMeta} headers={['insumo','unidad_medida','cantidad_necesaria','stock_actual','faltante']} rows={d.insumosSugeridos||[]} filename="insumos_necesarios" />
          </>
        ) : (
          <div className="alert alert-info" style={{fontSize:'var(--font-size-sm)'}}>No hay recetas configuradas para los productos del periodo seleccionado.</div>
        )}
      </div>
    );
  }

  // ── Render Personal tab ──────────────────────────────────────────────────
  function TabPersonal() {
    const rn = d.resumenNomina || {};
    return (
      <div>
        <div style={{display:'flex',gap:'var(--space-md)',flexWrap:'wrap',marginBottom:'var(--space-lg)'}}>
          <KpiCard label="Empleados activos" value={d.empleadosActivos||0} icon={Users} color="var(--color-accent)"/>
          <KpiCard label="Registros nómina" value={rn.registros||0} icon={BarChart2} color="var(--color-secondary)"/>
          <KpiCard label="Total pagado" value={fmt(rn.pagado)} icon={TrendingUp} color="var(--color-success)"/>
          <KpiCard label="Total pendiente" value={fmt(rn.pendiente)} icon={AlertTriangle} color="var(--color-warning)"/>
        </div>

        <h4 style={{marginBottom:'var(--space-sm)'}}>Asistencias por Empleado</h4>
        <SimpleTable cols={[{k:'empleado',label:'Empleado'},{k:'sucursal',label:'Sucursal'},{k:'presencias',label:'Presencias'},{k:'ausencias',label:'Ausencias'},{k:'registros',label:'Total'}]} rows={d.asistencias}/>
        <ExportButtons meta={rptMeta} headers={['empleado','sucursal','presencias','ausencias','registros']} rows={d.asistencias||[]} filename="asistencias" />

        <h4 style={{marginBottom:'var(--space-sm)'}}>Horas Extra</h4>
        <SimpleTable cols={[{k:'empleado',label:'Empleado'},{k:'sucursal',label:'Sucursal'},{k:'fecha',label:'Fecha'},{k:'horas',label:'Horas'},{k:'estatus',label:'Estatus'},{k:'motivo',label:'Motivo'}]} rows={d.horasExtra}/>

        <h4 style={{marginTop:'var(--space-lg)',marginBottom:'var(--space-sm)'}}>Nómina por Periodo</h4>
        <SimpleTable cols={[{k:'empleado',label:'Empleado'},{k:'sucursal',label:'Sucursal'},{k:'periodo_inicio',label:'Inicio'},{k:'periodo_fin',label:'Fin'},{k:'salario_base',label:'Salario',fmt:fmt},{k:'monto_horas_extra',label:'H. Extra',fmt:fmt},{k:'total_pagar',label:'Total',fmt:fmt},{k:'estatus',label:'Estatus'}]} rows={d.nominas}/>
        <ExportButtons meta={rptMeta} headers={['empleado','sucursal','periodo_inicio','periodo_fin','salario_base','monto_horas_extra','total_pagar','estatus']} rows={d.nominas||[]} filename="nomina" />
      </div>
    );
  }

  if (!tabs.length) return (
    <div className="card" style={{textAlign:'center',padding:'var(--space-2xl)'}}>
      <AlertTriangle size={40} style={{margin:'0 auto var(--space-md)',display:'block',color:'var(--color-warning)'}}/>
      <h3>Sin acceso a reportes</h3>
      <p className="text-secondary">Tu rol no tiene acceso a este módulo.</p>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Reportes y Business Intelligence</h2>
          <p style={{color:'var(--color-text-secondary)',fontSize:'var(--font-size-sm)',marginTop:4}}>
            Análisis de ventas, producción, inventario y personal
          </p>
        </div>
      </div>

      {/* Global filters */}
      <div className="card" style={{marginBottom:'var(--space-md)'}}>
        <div style={{display:'flex',gap:'var(--space-md)',flexWrap:'wrap',alignItems:'flex-end'}}>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Periodo</label>
            <select className="form-input" style={{minWidth:'180px'}} value={periodo} onChange={e=>setPeriodo(e.target.value)}>
              {PERIODS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          {periodo==='rango' && <>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="form-label">Desde</label>
              <input type="date" className="form-input" value={rangoDesde} onChange={e=>setRangoDesde(e.target.value)}/>
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="form-label">Hasta</label>
              <input type="date" className="form-input" value={rangoHasta} onChange={e=>setRangoHasta(e.target.value)}/>
            </div>
          </>}
          {isAdmin && (
            <div className="form-group" style={{marginBottom:0}}>
              <label className="form-label">Sucursal</label>
              <select className="form-input" value={sucursalId} onChange={e=>setSucursalId(e.target.value)}>
                <option value="">Todas</option>
                {sucursales.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
          )}
          <button className="btn btn-primary" style={{gap:'6px',whiteSpace:'nowrap'}} disabled={loading} onClick={()=>fetchTab(activeTab)}>
            <RefreshCw size={15} style={{animation:loading?'spin 1s linear infinite':undefined}}/> Actualizar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:'var(--space-xs)',marginBottom:'var(--space-md)',borderBottom:'2px solid var(--color-border)',flexWrap:'wrap'}}>
        {tabs.map(t=>(
          <button key={t.id}
            onClick={()=>setActiveTab(t.id)}
            style={{
              display:'flex',alignItems:'center',gap:'6px',
              padding:'var(--space-sm) var(--space-md)',
              border:'none',background:'none',cursor:'pointer',
              borderBottom: activeTab===t.id ? '2px solid var(--color-accent)' : '2px solid transparent',
              color: activeTab===t.id ? 'var(--color-accent)' : 'var(--color-text-secondary)',
              fontWeight: activeTab===t.id ? 600 : 400,
              marginBottom:'-2px',
              fontSize:'var(--font-size-sm)'
            }}>
            <t.Icon size={16}/> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="card">
        {loading ? (
          <div style={{textAlign:'center',padding:'3rem'}}><div className="spinner"/></div>
        ) : (
          <>
            {activeTab==='ventas'     && <TabVentas/>}
            {activeTab==='semanal'    && <TabSemanal/>}
            {activeTab==='inventario' && <TabInventario/>}
            {activeTab==='produccion' && <TabProduccion/>}
            {activeTab==='personal'   && <TabPersonal/>}
          </>
        )}
      </div>
    </div>
  );
}
