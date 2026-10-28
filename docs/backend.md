# Backend

API NestJS con TypeScript estricto. REST sirve las operaciones de archivos y salud; GraphQL está disponible para consultas. Prisma centraliza el acceso PostgreSQL; los binarios se guardan en almacenamiento compatible con S3.

Google OAuth/OpenID Connect autentica las cuentas. El backend valida el JWT de cada solicitud privada y verifica que Redis mantenga activa la sesión asociada. Consulta [OAuth de Google y sesiones](auth-google.md) para crear y configurar credenciales.

## Comandos

Desde la raíz:

| Comando | Uso |
| --- | --- |
| `pnpm dev:backend` | Inicia NestJS con recarga automática. Fuera de Docker, exporta `DATABASE_URL` y `DATABASE_URL_UNPOOLED` al proceso. |
| `pnpm --filter kornspace-backend build` | Genera Prisma Client y compila NestJS. |
| `pnpm --filter kornspace-backend test:unit` | Ejecuta pruebas unitarias del servicio Prisma y validación de archivos. |
| `pnpm --filter kornspace-backend test:e2e` | Ejecuta pruebas HTTP E2E para salud, autenticación y archivos. |
| `pnpm --filter kornspace-backend start:prod` | Ejecuta el backend compilado. |

## Interfaces

- `GET /api/health`: comprueba la API y PostgreSQL.
- `GET /api/auth/google`: inicia el acceso con Google.
- `GET /api/auth/google/callback`: valida el callback e inicia la sesión.
- `GET /api/auth/me`: devuelve el usuario de la sesión activa.
- `POST /api/auth/refresh`: renueva el JWT si la sesión Redis sigue activa.
- `POST /api/auth/logout`: revoca la sesión actual.
- `GET /api/docs`: documentación Swagger.
- `/graphql`: GraphQL; GraphiQL está habilitado en desarrollo. Actualmente incluye `health`.
- `GET /api/files`: lista metadatos.
- `POST /api/files?name=<nombre>`: sube un binario; requiere `Content-Type` y `Content-Length`.
- `GET /api/files/:id`: descarga un archivo disponible.
- `GET /api/files/:id/status`: consulta estado de procesamiento.

Todas las rutas de archivos requieren JWT y sesión activa; los archivos se consultan por propietario. La ruta de salud y el inicio OAuth son públicos.

El tamaño máximo de archivo es 100 MiB. Nginx está configurado para aceptar ese tamaño.

## Archivos grandes

Los objetos se guardan en S3 y los metadatos en PostgreSQL. Los archivos mayores a 10 MiB se publican en `kornspace-file-processing` (SQS). El worker lee el objeto desde S3, calcula SHA-256 y cambia su estado a `AVAILABLE`. La interfaz consulta periódicamente el estado.

En desarrollo, el interceptor registra método/ruta u operación GraphQL, resultado y duración. No registra cuerpos, cookies, tokens ni contenido de archivos. En producción queda desactivado.

## Configuración y límites actuales

Compose configura `PORT`, `NODE_ENV`, `REDIS_HOST`, `REDIS_PORT`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, las credenciales OAuth, `FRONTEND_ORIGIN`, `JWT_SECRET`, los TTL y `AUTH_COOKIE_SECURE`, además de AWS y SQS. `.env.example` enumera las variables; [la guía OAuth](auth-google.md) explica cómo obtenerlas.

Redis almacena los estados OAuth de un solo uso y las sesiones activas del servidor.
