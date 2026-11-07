# Inicio y operaciones de archivos

La página `/home` muestra los archivos abiertos recientemente por la sesión actual y permite consultar todos los archivos accesibles. Los filtros de nombre, tipo, propietario, modificación y ubicación se combinan. Los recientes se guardan por usuario en PostgreSQL; cargar miniaturas no cuenta como apertura. Las descargas y el visor registran accesos. El historial muestra hasta 200 accesos recientes y excluye archivos eliminados o cuyo permiso se revocó.

## Permisos

- Propietario: puede leer, renombrar, enviar a la papelera, compartir y administrar su papelera.
- Editor: puede leer, renombrar y enviar el archivo compartido a la papelera del propietario.
- Lector: puede abrir y descargar. Renombrar y enviar a la papelera responden con `403`.
- Sin acceso: `404`, igual que un identificador inexistente.

Compartir un archivo no concede acceso a sus carpetas ni a otros archivos. Sólo el propietario concede o revoca permisos, y el destinatario debe ser un usuario registrado. Revocar un permiso afecta inmediatamente a las siguientes peticiones y consultas.

Se puede indicar un correo o nombre de usuario exacto (`usuario` o `@usuario`, sin distinguir mayúsculas). Antes de guardar, el diálogo muestra el usuario y su correo asociado. La búsqueda requiere ser propietario del archivo y no devuelve coincidencias parciales ni listados de cuentas. Se excluye al propio propietario; los correos ambiguos no conceden permisos. La confirmación incluye el ID de la cuenta mostrada y el servidor vuelve a comprobarlo. Compartir concede acceso dentro de KornSpace; no envía invitaciones por correo.

## Nombres y reemplazo

Los nombres se recortan y deben contener entre 1 y 255 caracteres, sin separadores de ruta ni caracteres de control. La unicidad aplica a archivos activos del mismo propietario y ubicación, incluida la raíz. La comparación distingue mayúsculas y minúsculas, como la política de carpetas.

Una colisión responde con `409` y `code: FILE_NAME_CONFLICT`. No se sobrescribe silenciosamente. La interfaz ofrece cancelar o reemplazar. La confirmación envía el identificador exacto de la colisión (`replaceFileId` o `X-Replace-File-Id` en subidas), evitando sobrescribir un archivo diferente si la ubicación cambia mientras se confirma.

El archivo anterior pasa a la papelera; no se destruye durante el reemplazo. En una subida, los nuevos bytes se guardan primero en una clave S3 distinta y el intercambio de metadatos se realiza en una transacción. La nueva copia conserva los permisos del archivo reemplazado. Al renombrar o restaurar, el archivo que conserva su identidad mantiene sus propios permisos. Los índices únicos resuelven también colisiones concurrentes.

## Retención y borrado

Enviar a la papelera conserva los bytes durante 10 días. Sólo el propietario restaura, vacía o borra físicamente. La restauración vuelve a la ubicación anterior y también requiere confirmar si existe un nombre igual. La eliminación definitiva y el vaciado tienen confirmación accesible en la interfaz.

Antes de borrar de S3 se guarda `deletionPending`. Un archivo en limpieza no se puede descargar ni restaurar. Si S3 falla, quedan metadatos para reintentar; si S3 elimina pero PostgreSQL falla, la siguiente eliminación S3 es idempotente. Un barrido al arrancar y cada hora reintenta limpiezas pendientes y elimina la papelera vencida. El vaciado informa cuántos archivos quedaron pendientes.

## API

Los comandos REST se documentan en `/api/docs`:

- `PATCH /api/files/:id`: renombrar, con reemplazo confirmado opcional.
- `POST /api/files/name-conflict`: comprobar nombre y carpeta antes de enviar bytes.
- `POST /api/files/:id/access`: registrar apertura explícita.
- `GET /api/files/:id/recipients?identifier=usuario`: resolver el destinatario y mostrar su correo, sólo como propietario.
- `PUT /api/files/:id/permissions`: conceder o actualizar lector/editor con `identifier`, `recipientId` y `role`. Se conserva `email` como alias para clientes anteriores.
- `DELETE /api/files/:id/permissions/:userId`: revocar permiso.
- `POST /api/files/:id/trash`: enviar a la papelera.
- `POST /api/files/:id/restore`: restaurar; admite `?replaceFileId=UUID`.
- `DELETE /api/files/:id/permanent`: eliminación física desde la papelera.
- `DELETE /api/files/trash`: vaciar la papelera propia y devolver `deleted`/`pending`.

Las consultas de metadatos usan `fileLibrary(filters: LibraryFiltersInput)` en `/graphql`, con la misma sesión y autorización del dominio. No se transfieren binarios por GraphQL.

## Migración

La migración `20261106031732_file_library_permissions_and_operations` fue creada con `prisma migrate dev --create-only`. Añade permisos, accesos personales, fecha de modificación, estado de limpieza e índices de nombres activos. Inicializa la modificación de los archivos existentes con su fecha de creación, sin cambiar propietarios ni contenidos.

La migración completa está envuelta en una transacción. Si existen nombres activos duplicados antiguos, falla sin renombrarlos ni eliminarlos: se deben resolver explícitamente antes de aplicarla. Las migraciones ya aplicadas no se modifican.

Desde la raíz del repositorio, con el backend detenido:

```powershell
pnpm --filter kornspace-backend prisma:migrate:deploy
pnpm --filter kornspace-backend prisma:generate
```

Después reinicia el backend y el frontend. No arranques esta versión contra una base sin la migración nueva.
