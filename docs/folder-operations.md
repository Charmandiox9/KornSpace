# Renombrado, eliminación y permisos de carpetas

- El propietario puede conceder y revocar editores mediante correo o usuario exacto. Las coincidencias ambiguas se rechazan. El editor modifica únicamente el nombre o elimina la carpeta vacía. No puede conceder permisos.
- La concesión es explícita por carpeta, sin herencia. No concede acceso al contenido de archivos, cargas, comparticiones de archivos ni carpetas descendientes. Las carpetas concedidas aparecen en la raíz del editor como accesos, sin cambiar su padre persistido. Al abrirlas sólo se muestran sus propios metadatos.
- `PATCH /api/folders/:id` admite sólo `name`. No existe operación de movimiento: `parentId` se rechaza. Renombrar conserva el padre y no introduce ciclos. Los nombres se recortan, permiten 1–255 caracteres y excluyen separadores y controles. Los duplicados exactos por propietario y ubicación devuelven 409; nunca se reemplazan carpetas.
- `DELETE /api/folders/:id` elimina definitivamente sólo carpetas sin archivos ni subcarpetas. Los archivos en papelera o con borrado pendiente también cuentan como contenido. No se recorren ni modifican descendientes, objetos S3 o comparticiones de archivos.
- La comprobación de acceso, comprobación de contenido y eliminación son una transacción. Las claves foráneas con RESTRICT impiden el borrado si una carga o subcarpeta concurrente crea una referencia. Los permisos de la propia carpeta se eliminan en la misma transacción mediante CASCADE. Ante fallos no se elimina contenido; puede reintentarse.
- `GET /api/folders/:id/editors` lista los editores para su propietario. `PUT /api/folders/:id/editors` recibe `{ "identifier": "usuario o correo" }` y devuelve `userId`. `DELETE /api/folders/:id/editors/:userId` revoca el permiso; ambas operaciones requieren propietario.
- Respuestas: 400 para entrada inválida, 401 sin sesión, 404 para carpeta inexistente o no autorizada, 409 para nombre duplicado o carpeta con contenido, 503 para fallo recuperable. El borrado correcto devuelve 204.
- La interfaz solicita confirmación para borrar, enfoca Cancelar inicialmente y conserva el diálogo con un mensaje de error si falla. Ofrece nombre y mensajes traducidos al español e inglés.

## Migración

`20261106180000_folder_editor_permissions` añade únicamente la tabla de permisos, su índice y claves foráneas. No modifica migraciones previas ni archivos existentes. Se preparó con `prisma migrate diff` y se aplicó con `prisma migrate dev --name folder_editor_permissions` en la base configurada. `prisma migrate status` confirmó que el esquema está actualizado.
