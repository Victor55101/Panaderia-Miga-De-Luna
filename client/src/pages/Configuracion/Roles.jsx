import { Shield, Check, X, Info } from 'lucide-react';

const ROLES = [
  {
    id: 'propietario',
    nombre: 'Propietario',
    alcance: 'Vista global',
    descripcion: 'Acceso total de supervisión, administración, reportes y configuración operativa del sistema.'
  },
  {
    id: 'admin_sistema',
    nombre: 'Administrador del sistema',
    alcance: 'Vista global',
    descripcion: 'Administra usuarios, catálogos, sucursales, productos, reportes y apoyo operativo general.'
  },
  {
    id: 'gerente_sucursal',
    nombre: 'Gerente de sucursal',
    alcance: 'Solo su sucursal asignada',
    descripcion: 'Consulta operaciones de su sucursal, revisa ventas, inventario, asistencia y autoriza horas extra.'
  },
  {
    id: 'vendedor',
    nombre: 'Vendedor / Cajero',
    alcance: 'Solo su sucursal asignada',
    descripcion: 'Registra ventas, consulta su inventario disponible y gestiona su asistencia y horas extra propias.'
  },
  {
    id: 'jefe_produccion',
    nombre: 'Jefe de producción',
    alcance: 'Solo planta asignada',
    descripcion: 'Registra producción terminada, crea traslados desde planta y consulta inventario/producción.'
  },
  {
    id: 'repartidor',
    nombre: 'Repartidor',
    alcance: 'Solo traslados asignados',
    descripcion: 'Consulta traslados asignados y registra su asistencia u horas extra propias.'
  },
  {
    id: 'recursos_humanos',
    nombre: 'Recursos Humanos',
    alcance: 'Personal y nómina',
    descripcion: 'Administra empleados, asistencia, horas extra y nómina, sin acceso a ventas operativas.'
  }
];

const MODULES = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'ventas', label: 'Ventas' },
  { id: 'inventario', label: 'Inventario' },
  { id: 'produccion', label: 'Producción' },
  { id: 'traslados', label: 'Traslados' },
  { id: 'catalogos', label: 'Catálogos' },
  { id: 'producto_estrella', label: 'Producto estrella' },
  { id: 'personal', label: 'Empleados' },
  { id: 'asistencia', label: 'Asistencia' },
  { id: 'horas_extra', label: 'Horas extra' },
  { id: 'nomina', label: 'Nómina' },
  { id: 'reportes', label: 'Reportes' },
  { id: 'usuarios', label: 'Usuarios' }
];

const ACCESS = {
  propietario: ['dashboard', 'ventas', 'inventario', 'produccion', 'traslados', 'catalogos', 'producto_estrella', 'personal', 'asistencia', 'horas_extra', 'nomina', 'reportes', 'usuarios'],
  admin_sistema: ['dashboard', 'ventas', 'inventario', 'produccion', 'traslados', 'catalogos', 'producto_estrella', 'personal', 'asistencia', 'horas_extra', 'nomina', 'reportes', 'usuarios'],
  gerente_sucursal: ['dashboard', 'ventas', 'inventario', 'traslados', 'asistencia', 'horas_extra', 'reportes'],
  vendedor: ['dashboard', 'ventas', 'inventario', 'asistencia', 'horas_extra'],
  jefe_produccion: ['dashboard', 'inventario', 'produccion', 'traslados', 'catalogos', 'producto_estrella', 'asistencia', 'horas_extra', 'reportes'],
  repartidor: ['dashboard', 'traslados', 'asistencia', 'horas_extra'],
  recursos_humanos: ['dashboard', 'personal', 'asistencia', 'horas_extra', 'nomina', 'reportes']
};

const ACTIONS = [
  { rol: 'Propietario / Administrador', accion: 'Supervisión global, catálogos, usuarios, reportes y operaciones completas.' },
  { rol: 'Gerente de sucursal', accion: 'No registra ventas; revisa historial, inventario, asistencia y operaciones de su sucursal.' },
  { rol: 'Vendedor / Cajero', accion: 'Registra ventas únicamente con su usuario y su sucursal. No selecciona vendedores ajenos.' },
  { rol: 'Jefe de producción', accion: 'Registra producción terminada y crea traslados desde su planta asignada.' },
  { rol: 'Repartidor', accion: 'Consulta los traslados asignados y no modifica inventarios ni ventas.' },
  { rol: 'Recursos Humanos', accion: 'Controla empleados, asistencias, horas extra y nóminas.' }
];

function AccessIcon({ enabled }) {
  return enabled ? (
    <span className="badge badge-success" style={{ justifyContent: 'center' }}><Check size={14} /> Sí</span>
  ) : (
    <span className="badge badge-secondary" style={{ justifyContent: 'center' }}><X size={14} /> No</span>
  );
}

export default function Roles() {
  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Shield size={28} style={{ color: 'var(--color-accent)' }} />
            Matriz de Roles y Seguridad
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Referencia de permisos reales aplicados por el sistema según el caso de estudio.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="info-box" style={{ margin: 0 }}>
          <Info size={18} />
          <div>
            Esta pantalla es informativa. La seguridad real se aplica en las rutas del frontend y en los endpoints del backend.
            Para asignar un rol a una persona, usa la sección <strong>Usuarios</strong>. La edición dinámica de permisos no se habilita porque el sistema usa una matriz fija por rol para evitar inconsistencias.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-xl)' }}>
        {ROLES.map((rol) => (
          <div key={rol.id} className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
              <div>
                <h3 className="card-title">{rol.nombre}</h3>
                <span className="badge badge-accent" style={{ marginTop: 'var(--space-xs)' }}>{rol.alcance}</span>
              </div>
              <Shield size={24} style={{ color: 'var(--color-accent)' }} />
            </div>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: 'var(--space-md)', lineHeight: 1.55 }}>{rol.descripcion}</p>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <h2 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>Acceso por módulo</h2>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Módulo</th>
                {ROLES.map((rol) => <th key={rol.id}>{rol.nombre}</th>)}
              </tr>
            </thead>
            <tbody>
              {MODULES.map((mod) => (
                <tr key={mod.id}>
                  <td><strong>{mod.label}</strong></td>
                  {ROLES.map((rol) => (
                    <td key={`${rol.id}-${mod.id}`}><AccessIcon enabled={ACCESS[rol.id]?.includes(mod.id)} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>Reglas principales por rol</h2>
        <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
          {ACTIONS.map((item) => (
            <div key={item.rol} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 'var(--space-md)', padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--color-border)' }}>
              <strong>{item.rol}</strong>
              <span style={{ color: 'var(--color-text-secondary)' }}>{item.accion}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
