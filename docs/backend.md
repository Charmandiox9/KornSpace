# Backend

API NestJS con TypeScript estricto. REST sirve las operaciones de archivos y salud; GraphQL está disponible para consultas. Prisma centraliza el acceso PostgreSQL; los binarios se guardan en almacenamiento compatible con S3.

Google OAuth/OpenID Connect autentica las cuentas. El backend valida el JWT de cada solicitud privada y verifica que Redis mantenga activa la sesión asociada. Consulta [OAuth de Google y sesiones](auth-google.md) para crear y configurar credenciales.

## Comandos

Desde la raíz:

| Comando | Uso |
| --- | --- |
| `pnpm dev:backend` | Carga las variables del `.env` raíz e inicia NestJS con recarga automática. |
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
- `/graphql`: endpoint canónico GraphQL; GraphiQL está habilitado en desarrollo. Actualmente incluye `health`. Nginx también acepta `/api/graphql` como alias compatible.
- `GET /api/files`: lista sólo los metadatos cuyos archivos pertenecen al usuario autenticado; los registros sin propietario no se incluyen.
- `POST /api/files?name=<nombre>`: transmite el binario directamente a S3 compatible; requiere `Content-Type` MIME válido y `Content-Length` entero positivo. El nombre debe tener entre 1 y 255 caracteres y no contener caracteres de control. No se aceptan archivos vacíos; el tamaño declarado y recibido debe coincidir.
- `GET /api/files/:id`: descarga un archivo disponible.
- `GET /api/files/:id/status`: consulta estado de procesamiento.
- `GET /api/files/uploads/:operationId`: consulta un intento de carga del usuario autenticado.
- `DELETE /api/files/uploads/:operationId`: solicita su cancelación de forma idempotente; no elimina cargas que ya empezaron a confirmarse.

Todas las rutas de archivos requieren JWT y sesión activa; el propietario siempre se toma de la identidad autenticada, nunca del cuerpo o la URL. Las respuestas tipadas de carga reflejan el estado: hasta 10 MiB queda `AVAILABLE` con checksum calculado; sobre 10 MiB queda `PROCESSING` sin checksum hasta que el worker lo procese. La ruta de salud y el inicio OAuth son públicos.

El tamaño máximo predeterminado de archivo es 100 MiB (`FILE_MAX_SIZE_BYTES` puede ajustarlo; al cambiarlo también debe ajustarse el límite de Nginx). Al excederlo se devuelve HTTP 413. La solicitud inválida o vacía devuelve HTTP 400; una sesión ausente o inválida devuelve HTTP 401. Si S3, PostgreSQL o SQS no están disponibles, la API devuelve HTTP 503 y trata de eliminar el objeto/registro ya creado para evitar residuos. Nginx está configurado para aceptar hasta 100 MiB.

## Archivos grandes

Los objetos se guardan en S3 y los metadatos en PostgreSQL. Los archivos mayores a 10 MiB se publican en `kornspace-file-processing` (SQS). El worker lee el objeto desde S3, calcula SHA-256 y cambia su estado a `AVAILABLE`. La interfaz consulta periódicamente el estado.

En desarrollo, el interceptor registra método/ruta u operación GraphQL, resultado y duración. No registra cuerpos, cookies, tokens ni contenido de archivos. En producción queda desactivado.

El bootstrap aplica `ValidationPipe` global: transforma DTOs, rechaza propiedades no declaradas y evita incluir valores de entrada en errores de validación. CORS acepta los orígenes de `FRONTEND_ORIGIN` (separados por comas si hay varios) y los orígenes locales de Next.js en desarrollo. Al iniciar imprime entorno, puerto, API REST, Swagger y GraphQL.

## Configuración y límites actuales

Compose configura `PORT`, `NODE_ENV`, `REDIS_HOST`, `REDIS_PORT`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, las credenciales OAuth, `FRONTEND_ORIGIN`, `JWT_SECRET`, los TTL y `AUTH_COOKIE_SECURE`, además de AWS y SQS. `.env.example` enumera las variables; [la guía OAuth](auth-google.md) explica cómo obtenerlas.

Redis almacena los estados OAuth de un solo uso, las sesiones activas del servidor y el registro de intentos de carga.

## Progreso, cancelación y recuperación

El frontend envía un UUID v4 en `X-Upload-Id` por intento. `ManagedUploadsService` registra el intento antes de transmitir a S3; `UploadRegistryService` usa operaciones CAS atómicas en Redis para decidir entre cancelación y confirmación. Los identificadores están separados por propietario y el identificador interno del archivo lo genera el servidor. Reutilizar un intento en un POST devuelve 409; los reintentos del usuario deben generar otro UUID. Una cancelación recibida antes del POST crea una marca que impide que ese POST tardío comience.

Estados: `uploading` → `confirming` → `completed`, o `uploading` → `cancelling` → `cleanupPending` → `cancelled`. Los fallos reales terminan en `failed` después de la limpieza. Antes de entrar en `confirming`, S3 ya recibió el cuerpo completo y el servicio comprobó el tamaño y checksum. Si cancelar gana la transición atómica, no se crean metadatos descargables; si la confirmación gana, se conserva el archivo completo, como decisión del producto. El 100% de bytes enviados del navegador no equivale a `completed`.

La interrupción HTTP y la orden de cancelación abortan un stream incompleto y el `PutObject` mediante `AbortController`. Si ya se recibieron todos los bytes, se espera el resultado de S3 antes de compensar, para no borrar el objeto antes de que termine su guardado. No se usa multipart: los fragmentos de un PUT incompleto no se publican como objetos descargables. La compensación marca cualquier metadato existente como `FAILED` antes de borrar el objeto y luego elimina los metadatos. La limpieza es idempotente. Si S3/PostgreSQL falla, permanece en `cleanupPending`; la interfaz no confirma cancelación ni habilita reintento hasta resolver ese estado. El worker de procesamiento descarta registros ausentes o fallidos y no los vuelve a marcar como disponibles.

Los intentos pendientes se indexan en Redis sin caducidad hasta resolverlos, para no perder las tareas de limpieza. Los terminales tienen TTL de 24 horas y se retiran del índice. Una carga activa renueva su lease de 90 segundos cada 2 segundos. La recuperación revisa hasta 100 intentos cada 10 segundos; también puede activarse al consultar un intento. Tras un reinicio, reconcilia archivos completos en confirmación y limpia intentos abandonados. Redis debe conservar su persistencia y volumen; borrar esos datos elimina el registro de recuperación. Las operaciones de limpieza se reintentan cuando los servicios vuelven a estar disponibles, por lo que una caída de almacenamiento puede dejar temporalmente objetos pendientes, sin anunciar una cancelación ya completada.
