# Puesta en marcha

## Requisitos

- Docker Desktop y Docker Compose v2.
- Token de LocalStack para S3/SQS.
- Proyecto Neon y credenciales PostgreSQL para desarrollo.

## Variables de entorno

Copia la plantilla desde la raíz:

```powershell
Copy-Item .env.example .env
```

Completa `.env`:

| Variable | Uso |
| --- | --- |
| `LOCALSTACK_AUTH_TOKEN` | Autentica LocalStack. |
| `DATABASE_URL` | Conexión agrupada de Neon para consultas normales. |
| `DATABASE_URL_UNPOOLED` | Conexión directa de Neon para las migraciones Prisma. |
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL del overlay. |
| `POSTGRES_DATABASE_URL` | URL del backend hacia `postgres:5432`; debe coincidir con usuario, base y contraseña. |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Credenciales de cliente web creadas en Google Cloud Console. |
| `GOOGLE_OAUTH_REDIRECT_URI` | Callback registrado en Google; local: `http://localhost/api/auth/google/callback`. |
| `FRONTEND_ORIGIN` | Origen al que vuelve el callback; desarrollo directo: `http://localhost:3001`. Compose usa `http://localhost` detrás de Nginx. |
| `JWT_SECRET` | Secreto aleatorio de al menos 32 bytes para firmar JWT internos. |
| `AUTH_COOKIE_SECURE` | `false` sólo para HTTP local; `true` en HTTPS. |
| `API_PROXY_TARGET` | Destino del proxy del servidor Next.js; usa `http://localhost:3000` en desarrollo directo. Compose lo configura como `http://backend:3000`. |

Compose todavía exige las dos URLs de Neon al interpolar la configuración base, incluso cuando el overlay las reemplaza en el backend. Complétalas también para validar el overlay.

## Arranque en Docker

Ejecuta desde la raíz:

```sh
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

Web: <http://localhost>. Salud: <http://localhost/api/health>. Swagger: <http://localhost/api/docs>. GraphQL: <http://localhost/graphql> (también disponible en <http://localhost/api/graphql> por Nginx).

```sh
docker compose logs -f
docker compose down
```

Docker usa Next.js y NestJS compilados, Neon para metadatos y LocalStack para S3/SQS. Terraform crea el bucket y la cola automáticamente.

## Arranque con el overlay de producción

Además, configura `POSTGRES_PASSWORD` y `POSTGRES_DATABASE_URL` en `.env`:

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.production.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.production.yml ps
```

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml logs -f
docker compose -f docker-compose.yml -f docker-compose.production.yml down
```

El overlay usa PostgreSQL 17 en Docker con el volumen `postgres_data` y ejecuta NestJS compilado. **No es todavía un despliegue completo de producción:** los archivos siguen en LocalStack.

## Diferencias y efectos

| Área | Compose base | Overlay de producción |
| --- | --- | --- |
| Frontend | Next.js compilado | Next.js compilado |
| Backend | NestJS compilado | NestJS compilado, `NODE_ENV=production` |
| PostgreSQL | Neon | PostgreSQL en Docker |
| Archivos/cola | LocalStack S3/SQS | LocalStack S3/SQS |
| Redis | Contenedor iniciado | Contenedor iniciado |

Las bases de datos son distintas; no se copian datos entre Neon y PostgreSQL Docker. Los volúmenes conservan sus datos con `down`; `down -v` los elimina. Para borrar `postgres_data`, usa `down -v` junto con ambos archivos Compose. Los modos publican los mismos puertos: detén el actual con su configuración antes de cambiar.

Google OAuth crea sesiones activas en Redis. Consulta [OAuth de Google](auth-google.md) para crear las credenciales, generar `JWT_SECRET` y probar el inicio de sesión.

## Imágenes y desarrollo local

Frontend y backend no montan código ni volúmenes de `node_modules`. Las dependencias, el cliente Prisma y el código compilado están incluidos en las imágenes. Tras cambiar código, dependencias o esquema Prisma (con su migración), ejecuta `docker compose up --build -d`. Reiniciar un contenedor no reconstruye su imagen.

Para desarrollo, ejecuta `pnpm install` y `pnpm dev` desde la raíz. Este comando genera Prisma y arranca Next.js y NestJS con recarga automática. Puedes levantar la infraestructura con `docker compose up -d redis terraform`. Configura `.env` con los endpoints accesibles desde el equipo (`REDIS_HOST=localhost`, S3/SQS en `http://localhost:4566`, URL de la cola accesible desde el equipo y `FRONTEND_ORIGIN=http://localhost:3001`).
