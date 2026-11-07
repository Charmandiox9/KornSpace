# Biblioteca y organización del espacio de trabajo

Los menús de archivos y carpetas usan un popover nativo en la capa superior. El menú mide el espacio disponible, abre hacia arriba o hacia abajo, limita su altura y se ajusta cuando cambia el tamaño de la ventana o se expande Organizar. Abrir los tres puntos selecciona el elemento sin navegar ni abrir la vista previa. Pulsar fuera cierra el menú y limpia esa selección; Escape también lo cierra y devuelve el foco al disparador.

Inicio muestra archivos abiertos recientemente y secciones plegables de carpetas, archivos y vídeos sugeridos. Las carpetas priorizan ubicaciones de los archivos recientes y después su fecha de actualización, con un máximo de ocho. Los accesos rápidos personales siguen disponibles. La lista completa está en Mi Unidad; Inicio no ofrece el conmutador de todos los archivos.

Destacados (`/starred`) reúne archivos y carpetas de las preferencias personales sincronizadas. Conserva los permisos efectivos del recurso: destacar no concede acceso. Los elementos eliminados o cuyo acceso se revocó quedan fuera de las preferencias consultables por el usuario.

Almacenamiento (`/storage`) consulta `storageUsage` en GraphQL bajo el guard de sesión. El propietario se obtiene exclusivamente de la sesión, sin aceptar un usuario destino en la consulta. El total suma el tamaño de los metadatos propios, incluida la papelera y los borrados físicos pendientes mientras conserven metadatos. No cuenta archivos ajenos compartidos ni cargas temporales que aún no tengan archivo persistido. Es el espacio registrado por la aplicación, no una consulta de facturación de S3 ni una cuota contratada.

La lista muestra todos los archivos contabilizados y se puede ordenar de mayor a menor tamaño o a la inversa. Los elementos en papelera se identifican y enlazan a esa vista para restaurarlos o eliminarlos; no se descargan ni renombran desde Almacenamiento.

Las pruebas verifican posición de menús en los límites de la ventana, selección y cierre exterior, secciones plegables, navegación de Destacados, ordenación y adaptación móvil del almacenamiento. Una prueba GraphQL con base simulada verifica autenticación, aislamiento por propietario e inclusión de papelera.
