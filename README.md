# KornSpace

Plataforma de almacenamiento con React, NestJS, PostgreSQL/Prisma, Redis, LocalStack (S3/SQS), Terraform y Nginx.

## Requisitos

- Docker Desktop con Docker Compose v2.
- Token de LocalStack.
- Neon para el modo de desarrollo.

Crea `.env` en la raíz y completa las variables:

```powershell
Copy-Item .env.example .env
```

- `LOCALSTACK_AUTH_TOKEN`: autenticación de LocalStack.
- `DATABASE_URL` y `DATABASE_URL_UNPOOLED`: conexiones agrupada y directa de Neon para desarrollo.
- `POSTGRES_PASSWORD` y `POSTGRES_DATABASE_URL`: necesarias para el overlay de producción; la URL debe apuntar a `postgres:5432` y usar la misma contraseña, usuario y base.

El Compose base todavía requiere las dos variables de Neon al procesar su configuración, incluso al usar el overlay de producción. El backend de ese overlay las reemplaza por la conexión PostgreSQL del contenedor.

## Desarrollo

Desde la raíz del repositorio:

```sh
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

La web queda en <http://localhost>. Para revisar logs o detener el entorno:

```sh
docker compose logs -f
docker compose down
```

Desarrollo usa Vite y NestJS en modo observación, Neon para los metadatos y LocalStack para los archivos y trabajos SQS. Terraform crea el bucket y la cola al iniciar. Redis se levanta para caché y sesiones.

## Producción (overlay actual)

Configura las variables PostgreSQL indicadas arriba y ejecuta desde la raíz:

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.production.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.production.yml ps
```

Para revisar logs y detenerlo:

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml logs -f
docker compose -f docker-compose.yml -f docker-compose.production.yml down
```

El overlay usa PostgreSQL 17 en Docker con volumen persistente y ejecuta NestJS compilado en modo producción. **No es aún un despliegue integral de producción:** el frontend sigue corriendo Vite en desarrollo y los archivos siguen en LocalStack.

## Diferencias y efectos

| | Desarrollo | Overlay de producción |
| --- | --- | --- |
| Frontend | Vite en desarrollo | Vite en desarrollo |
| Backend | NestJS con recarga automática | NestJS compilado |
| Base de datos | Neon | PostgreSQL en Docker |
| Archivos y cola | LocalStack S3/SQS | LocalStack S3/SQS |
| Migraciones | Se aplican al iniciar el backend | Se aplican al iniciar el backend |

Los datos de PostgreSQL no se copian entre Neon y el contenedor: cada modo usa su propia base. Los volúmenes locales conservan los datos al ejecutar `down`; `down -v` los elimina. Ambos modos publican los mismos puertos, así que detén uno antes de iniciar el otro. Usa el comando `down` correspondiente al modo que está activo.

## Prisma

Los comandos siguientes se ejecutan desde la raíz y cargan el `.env` raíz automáticamente:

```sh
pnpm prisma:generate
pnpm prisma:migrate:dev --name nombre-descriptivo
pnpm prisma:migrate:deploy
pnpm prisma:migrate:status
```

Cada cambio de `backend/prisma/schema.prisma` debe incluir una migración versionada en `backend/prisma/migrations/`.
