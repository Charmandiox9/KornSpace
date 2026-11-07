# Carpetas, archivos y permisos heredados

## Roles y herencia

El propietario conserva el control de compartición. Puede conceder lectura (`READER`) o edición (`EDITOR`) por correo o usuario exacto, y listar, modificar o revocar permisos directos. Los editores pueden modificar nombres, crear contenido en carpetas autorizadas y enviar archivos a papelera. El borrado definitivo y la restauración de archivos mantienen su política de propietario.

Los permisos de una carpeta se heredan dinámicamente por todos los archivos y carpetas descendientes, incluidos los creados después. No se copian filas de permisos a cada descendiente. Los cambios y revocaciones se reflejan en las siguientes solicitudes.

Entre permisos directos y heredados prevalece el mayor: propietario, editor, lector. Un permiso directo de lector no reduce una edición heredada. Al revocar un permiso directo puede permanecer acceso por otra carpeta antecesora. Los permisos heredados se administran en la carpeta que los concede, identificada en el modal. Los nuevos elementos pertenecen al propietario de la carpeta, incluso si los crea un editor.

La API aplica esta política en navegación, descarga/vista previa, búsquedas, nombres, cargas, creación de subcarpetas y modificaciones. Los lectores reciben 403 al intentar escribir; sin acceso se devuelve 404. La jerarquía se recorre con detección de ciclos y validación de propietario.

## API y modales de compartir

- `GET /api/files/:id/permissions` y `GET /api/folders/:id/permissions`: personas con acceso directo y heredado, rol y carpeta de origen. Sólo el propietario.
- `PUT .../permissions`: concede acceso por identificador exacto y rol. Los archivos conservan confirmación de destinatario mediante `recipientId`.
- `PATCH .../permissions/:userId`: cambia un permiso directo existente (`role`).
- `DELETE .../permissions/:userId`: revoca un permiso directo.
- Las rutas de carpetas `/editors` se conservan como alias para compatibilidad; sin rol, la concesión antigua sigue siendo edición.

Ambos diálogos muestran las personas existentes y su rol al abrirse. Los permisos directos se cambian o revocan allí. Los heredados muestran su origen y un enlace para administrarlos en la carpeta correspondiente.

## Renombrado, borrado y consistencia

`PATCH /api/folders/:id` acepta sólo nombre. No permite movimiento ni `parentId`, por lo que no introduce ciclos. Los nombres permiten 1–255 caracteres recortados, sin separadores ni controles. Los duplicados exactos por propietario y ubicación devuelven 409.

`DELETE /api/folders/:id` exige propietario o editor y elimina sólo carpetas vacías. Los archivos activos, en papelera o pendientes de borrado, y todas las subcarpetas cuentan como contenido y causan 409. No modifica descendientes, objetos S3 ni comparticiones de archivos.

La autorización, comprobación de contenido y eliminación se realizan en una transacción. Las claves foráneas RESTRICT impiden borrar con referencias concurrentes. Los permisos de la carpeta se eliminan en la misma transacción mediante CASCADE. Ante un fallo recuperable se conserva el contenido y puede reintentarse. El diálogo confirma la eliminación, enfoca Cancelar y conserva los errores para reintentar.

## Migraciones

`20261106180000_folder_editor_permissions` creó la tabla de permisos. `20261106201256_inherited_folder_roles` añade el rol con valor predeterminado EDITOR, preservando los editores previamente concedidos. Ambas se aplicaron mediante Prisma Migrate sin editar migraciones anteriores.
