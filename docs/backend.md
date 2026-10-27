# Backend

API NestJS con TypeScript estricto. REST sirve las operaciones de archivos y salud; GraphQL está disponible para consultas. Prisma centraliza el acceso PostgreSQL; los binarios se guardan en almacenamiento compatible con S3.

## Comandos

Desde la raíz:

| Comando | Uso |
| --- | --- |
| `pnpm dev:backend` | Inicia NestJS con recarga automática. Fuera de Docker, exporta `DATABASE_URL` y `DATABASE_URL_UNPOOLED` al proceso. |
| `pnpm --filter kornspace-backend build` | Genera Prisma Client y compila NestJS. |
| `pnpm --filter kornspace-backend test:unit` | Ejecuta pruebas unitarias del servicio Prisma y validación de archivos. |
| `pnpm --filter kornspace-backend test:e2e` | Ejecuta pruebas HTTP E2E para salud y archivos. |
| `pnpm --filter kornspace-backend start:prod` | Ejecuta el backend compilado. |

## Interfaces

- `GET /api/health`: comprueba la API y PostgreSQL.
- `GET /api/docs`: documentación Swagger.
- `/graphql`: GraphQL; GraphiQL está habilitado en desarrollo. Actualmente incluye `health`.
- `GET /api/files`: lista metadatos.
- `POST /api/files?name=<nombre>`: sube un binario; requiere `Content-Type` y `Content-Length`.
- `GET /api/files/:id`: descarga un archivo disponible.
- `GET /api/files/:id/status`: consulta estado de procesamiento.

El tamaño máximo de archivo es 100 MiB. Nginx está configurado para aceptar ese tamaño.

## Archivos grandes

Los objetos se guardan en S3 y los metadatos en PostgreSQL. Los archivos mayores a 10 MiB se publican en `kornspace-file-processing` (SQS). El worker lee el objeto desde S3, calcula SHA-256 y cambia su estado a `AVAILABLE`. La interfaz consulta periódicamente el estado.

En desarrollo, el interceptor registra método/ruta u operación GraphQL, resultado y duración. No registra cuerpos, cookies, tokens ni contenido de archivos. En producción queda desactivado.

## Configuración y límites actuales

Compose configura `PORT`, `NODE_ENV`, `REDIS_HOST`, `REDIS_PORT`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AWS_REGION`, credenciales locales, `S3_ENDPOINT`, `S3_BUCKET`, `SQS_ENDPOINT`, `SQS_QUEUE_URL`, `FILE_ASYNC_THRESHOLD_BYTES` y `FILE_MAX_SIZE_BYTES`.

Redis se inicia en Compose, pero el backend todavía no implementa caché o sesiones. Google OAuth tampoco está implementado. La API de archivos no tiene autenticación ni permisos por usuario.
