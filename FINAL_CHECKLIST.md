# Checklist Final de Entrega — Miga de Luna

## Estado general

- [x] Frontend React + Vite funcional.
- [x] Backend Express funcional.
- [x] Migración inicial corregida y validada desde base vacía.
- [x] Seed demo completo e idempotente agregado en `server/seeds/demo_data.sql`.
- [x] Base demo regenerable sin depender de archivos `.db` incluidos en el ZIP.
- [x] Se retiró la sección placeholder **Configuración**.
- [x] Se corrigió **Roles** como matriz informativa para evitar una edición de permisos que no estaba conectada al RBAC real.
- [x] Se agregó `netlify.toml` para deploy del frontend.
- [x] Se agregó `DEPLOYMENT_GUIDE.md` para deploy Netlify + Railway.

## Módulos implementados

- [x] Autenticación y RBAC.
- [x] Dashboard por rol.
- [x] Sucursales, categorías y productos.
- [x] Producto estrella.
- [x] Inventario, límites, movimientos y auditoría.
- [x] Ventas, ticket/historial y filtros.
- [x] Producción terminada.
- [x] Traslados planta/sucursal.
- [x] Empleados, asistencia y horas extra.
- [x] Nómina.
- [x] Reportes y exportación CSV/Excel.
- [x] Usuarios y matriz de roles.

## Deploy

- [x] Frontend preparado para Netlify.
- [x] Backend preparado para Railway con Root Directory `server`.
- [x] Persistencia preparada mediante Railway Volume usando `RAILWAY_VOLUME_MOUNT_PATH`.
- [x] CORS configurable con `FRONTEND_URL`.
- [x] API configurable en Vite con `VITE_API_URL`.

## Archivos excluidos del ZIP final

- [x] `node_modules/`
- [x] `client/dist/`
- [x] `.env`
- [x] `server/data/*.db`
- [x] scripts temporales de corrección

## Usuarios demo

Contraseña general:

```txt
admin123
```

Usuarios principales:

```txt
propietario
admin
gerente.centro
vendedor.ana
jefe.produccion
repartidor.gabriel
rh.daniela
```
