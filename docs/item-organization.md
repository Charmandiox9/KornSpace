# Organización personal y menús de acciones

Las carpetas y archivos ofrecen un menú de tres puntos con acciones agrupadas: abrir, renombrar según permiso, compartir como propietario, organizar, información y eliminación según las reglas existentes. «Organizar» permite destacar, crear un acceso rápido en la página principal y elegir uno de los colores disponibles. En pantallas estrechas se expande dentro del menú para evitar submenús fuera de pantalla.

Destacados, accesos rápidos y colores son preferencias personales sincronizadas con PostgreSQL. No cambian la vista de otros usuarios ni conceden acceso al contenido. Un lector puede organizar personalmente un elemento compartido. Las listas omiten metadatos si el usuario perdió el acceso o si el archivo está en papelera; las preferencias se eliminan por cascada al borrar físicamente el recurso o el usuario.

`GET /api/preferences/items` devuelve sólo preferencias del usuario autenticado para recursos aún accesibles, con sus metadatos tipados. `PUT /api/preferences/items/files/:id` y `PUT /api/preferences/items/folders/:id` aceptan cambios parciales en `starred`, `shortcut` y `color`. Los campos omitidos se conservan. No se admite enviar `userId`. Los valores nulos, colores desconocidos y booleanos inválidos devuelven 400; sin sesión, 401; sin acceso, 404; fallos recuperables, 503.

La migración `20261106204106_personal_item_organization` añade tablas independientes con claves compuestas por usuario/recurso, booleanos y un enum de colores. No modifica recursos, contenidos S3 ni permisos anteriores.

La ordenación de la vista permite nombre (orden natural), fecha de modificación y tamaño en ambos sentidos. Se calcula sobre una copia de los resultados y mantiene separados los grupos de carpetas y archivos. Las carpetas sin tamaño usan el nombre como desempate.

Los diálogos de compartir muestran primero el formulario para correo o usuario, después las personas con acceso (incluido el propietario) y finalmente «Hecho». Se pueden cambiar roles directos y revocarlos. Los heredados indican su origen y se administran en la carpeta que concede el acceso. No se generan enlaces de acceso ni URLs públicas.
