# Guía de despliegue — Miga de Luna

Arquitectura recomendada:

- **Frontend:** Netlify (`client/`)
- **Backend:** Railway (`server/`)
- **Base de datos:** SQLite/sql.js persistente usando **Railway Volume**

> Nota: el backend crea la base de datos, ejecuta migraciones y carga datos demo automáticamente cuando el volumen/base está vacío.

## 1. Preparar repositorio

1. Sube el proyecto a GitHub sin `node_modules`, sin `dist`, sin `.env` y sin archivos `.db`.
2. El archivo `netlify.toml` ya apunta a `client/` para el build del frontend.
3. El backend se debe desplegar desde la carpeta `server/`.

## 2. Desplegar backend en Railway

1. En Railway, crea un proyecto nuevo y selecciona tu repositorio.
2. En la configuración del servicio, establece **Root Directory** como:

```txt
server
```

3. Variables de entorno recomendadas:

```env
PORT=3001
NODE_ENV=production
JWT_SECRET=pon_un_secreto_largo_y_unico
FRONTEND_URL=https://tu-sitio.netlify.app
```

4. Crea un **Volume** para persistir la base de datos.
   - Si tu servicio usa Root Directory `server`, monta el volumen en:

```txt
/app/data
```

   - Railway expondrá `RAILWAY_VOLUME_MOUNT_PATH` y el backend guardará ahí `migadeluna.db`.

5. Verifica el health check cuando Railway termine el deploy:

```txt
https://tu-backend.up.railway.app/api/health
```

Debe responder algo como:

```json
{ "status": "ok" }
```

## 3. Desplegar frontend en Netlify

1. En Netlify, crea un sitio nuevo desde el mismo repositorio.
2. Netlify leerá `netlify.toml`. La configuración esperada es:

```txt
Base directory: client
Build command: npm run build
Publish directory: dist
```

3. Variable de entorno en Netlify:

```env
VITE_API_URL=https://tu-backend.up.railway.app/api
```

4. Haz deploy. Si cambias `VITE_API_URL`, vuelve a ejecutar el deploy porque Vite incrusta esa variable en el build.

## 4. Usuarios demo

Todos usan contraseña:

```txt
admin123
```

Usuarios principales:

```txt
propietario
admin
jefe.produccion
vendedor.ana
gerente.centro
repartidor.gabriel
rh.daniela
```

## 5. Notas importantes

- No subas archivos `.env` reales.
- No subas `server/data/*.db` al repositorio final. El backend crea y alimenta la DB si está vacía.
- El módulo **Roles** es una matriz informativa de permisos; la asignación de roles se realiza en **Usuarios**.
- La sección **Configuración** fue retirada porque no formaba parte de los requerimientos funcionales finales.
