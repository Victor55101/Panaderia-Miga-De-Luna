# Miga de Luna — Sistema Administrativo

Sistema integral para **Miga de Luna Panadería & Repostería**, orientado a controlar ventas por sucursal, inventarios, producción, traslados, producto estrella, personal, asistencia, horas extra, nómina y reportes administrativos.

## Caso de estudio cubierto

El sistema atiende el crecimiento de una panadería/repostería con planta de producción, expendios, futura sucursal en plaza comercial y necesidad de estandarizar productos estrella para franquicias. Permite:

- Registrar ventas por sucursal y vendedor.
- Consultar estadísticas semanales de piezas vendidas.
- Proyectar producción e insumos requeridos.
- Controlar inventario por sucursal, mínimos, máximos y movimientos.
- Registrar producción terminada y traslados planta → sucursal.
- Gestionar empleados, asistencia, horas extra y nómina.
- Consultar reportes con permisos por rol.

## Arquitectura

```txt
Panaderia-Miga-De-Luna/
├── client/                 # React + Vite
│   ├── src/
│   └── .env.example
├── server/                 # Node.js + Express + sql.js
│   ├── config/             # DB y migraciones
│   ├── controllers/
│   ├── middleware/
│   ├── migrations/
│   ├── routes/
│   ├── seeds/              # demo_data.sql + seed.js
│   ├── services/
│   └── .env.example
├── netlify.toml            # Deploy frontend Netlify
├── DEPLOYMENT_GUIDE.md     # Pasos Railway + Netlify
└── FINAL_CHECKLIST.md
```

## Requisitos locales

- Node.js 18 o superior
- npm

## Instalación local

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

En otra terminal:

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

URLs locales:

```txt
Frontend: http://localhost:5173
Backend:  http://localhost:3001/api
Health:   http://localhost:3001/api/health
```

## Base de datos y semillas

El backend usa `sql.js` y guarda la base en un archivo SQLite. Al iniciar, ejecuta migraciones y, si la base está vacía, carga automáticamente los datos demo desde `server/seeds/demo_data.sql`.

Comandos manuales:

```bash
cd server
npm run migrate
npm run seed
```

Para forzar la recarga de semillas:

```bash
node seeds/seed.js --force
```

## Usuarios demo

Todos los usuarios demo usan contraseña:

```txt
admin123
```

| Usuario | Rol | Alcance |
|---|---|---|
| `propietario` | Propietario | Vista global |
| `admin` | Admin sistema | Vista global |
| `gerente.centro` | Gerente sucursal | Sucursal Centro |
| `vendedor.ana` | Vendedor | Sucursal Centro |
| `jefe.produccion` | Jefe producción | Planta de Producción |
| `repartidor.gabriel` | Repartidor | Traslados asignados |
| `rh.daniela` | Recursos Humanos | Personal y nómina |

## Roles y seguridad

La seguridad está aplicada en frontend y backend mediante rutas protegidas, JWT y validaciones RBAC. La pantalla **Roles** funciona como matriz informativa; la asignación de rol a usuario se realiza desde **Usuarios**.

La sección antigua **Configuración** fue retirada porque no formaba parte de los módulos funcionales finales.

## Deploy recomendado

- **Frontend:** Netlify (`client/`)
- **Backend:** Railway (`server/`)
- **Persistencia:** Railway Volume montado en `/app/data`

Consulta los pasos detallados en:

```txt
DEPLOYMENT_GUIDE.md
```

## Variables de entorno

Backend (`server/.env`):

```env
PORT=3001
JWT_SECRET=change_this_to_a_long_random_secret
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

Frontend (`client/.env`):

```env
VITE_API_URL=http://localhost:3001/api
```

Para producción, usa la URL real de Netlify en `FRONTEND_URL` y la URL real de Railway en `VITE_API_URL`.

## Módulos principales

- Dashboard por rol
- Ventas e historial
- Inventario y movimientos
- Producción terminada
- Traslados
- Sucursales, categorías, productos
- Producto estrella y especificaciones
- Empleados, asistencia, horas extra y nómina
- Usuarios y matriz de roles
- Reportes y exportación Excel/CSV

## Entrega limpia

No se deben incluir en el ZIP final:

```txt
node_modules/
dist/
.env
*.db
server/data/*.db
```

El proyecto ya puede regenerar la base demo desde migraciones + semillas.
