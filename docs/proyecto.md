# KornSpace — alcance del MVP y backlog Kanban

## Objetivo

Construir un espacio privado multiusuario para guardar, organizar y compartir archivos. El MVP permite iniciar sesión con Google, explorar archivos y carpetas, subir y descargar archivos, y compartirlos con otros usuarios con permisos explícitos. El trabajo se planifica desde el **28 de octubre al 30 de noviembre de 2026**. La fecha del 30 de noviembre es el límite del MVP, no una promesa de despliegue productivo.

## Estado observado en el repositorio

- **Ya existe:** SPA React 19 con TypeScript, español/inglés, temas claro/oscuro, inicio/cierre/renovación de sesión mediante Google OAuth, sesión del servidor en Redis, tabla de usuarios y metadatos de archivos con propietario, S3 compatible, procesamiento asíncrono de archivos grandes por SQS, checksum SHA-256, health check, Swagger REST, GraphQL con consulta `health`, Compose, Nginx y Terraform local para S3/SQS.
- **Parcial:** la SPA es una vista inicial de acceso y archivos; el listado y la carga son básicos, la carga no se puede cancelar, y todavía no hay navegación de carpetas ni búsqueda. Los archivos fallidos se reflejan como estado, pero no existe un flujo de recuperación documentado.
- **Pendiente:** carpetas, permisos/compartición, operaciones de renombrado y eliminación, consultas de metadatos GraphQL, límites y paginación, robustez de cargas, interfaz de producto completa y un camino reproducible de validación y despliegue.
- **Límite de infraestructura actual:** el overlay llamado producción aún usa Vite de desarrollo y LocalStack; no debe considerarse un despliegue público listo para producción.

Las tarjetas existentes **Inicio de Sesión** y **Modificar Sidebar** se conservan como trabajo del tablero. La primera debe cerrarse como verificación de lo ya implementado, no duplicarse como OAuth nuevo. La segunda se define como navegación real de la aplicación. Las capturas adjuntas sólo se usan para reconocer los campos del formulario Kanban.

## Convenciones para cargar las tarjetas

Usa los campos del formulario: **título, descripción, criterios de aceptación, columna, prioridad, asignados, story points, épica, fecha de inicio, fecha límite y tags**. Para reducir trabajo sin dueño, asigna las tarjetas al integrante Frontend o Backend/Infra disponible en el tablero; el repositorio no permite inferir una asignación individual. Si una tarjeta cruza áreas, deja un responsable principal y coordina revisión con el otro integrante.

- **Columnas:** las tareas nuevas parten en `Backlog`; muévelas a `To Do` al iniciar y usa `In Progress`, `In Review` y `Done` con el flujo normal. No marques `Done` hasta que cumpla todos los criterios y sus comprobaciones pertinentes.
- **Prioridad:** `High` para dependencias, seguridad y camino crítico; `Medium` para capacidades centrales no bloqueantes; `Low` para acabado opcional.
- **Story points:** estimación relativa para el equipo, no horas. Recalibrar en la primera planificación; dividir cualquier tarjeta mayor que 8 puntos.
- **Tags:** conservar exactamente el prefijo de área y agregar los tags de tipo/capacidad que correspondan. Taxonomía: `frontend`, `backend`, `infra`, `database`, `auth`, `files`, `folders`, `sharing`, `graphql`, `rest`, `security`, `accessibility`, `i18n`, `testing`, `docs`, `release`, `decision`.
- **Fechas:** inicio y límite son inclusivos. Las fechas asumen dos integrantes y trabajo progresivo; ajustar asignaciones en el tablero sin mover dependencias ni exceder el 30 de noviembre.
- **Épicas:** `E1 Fundamentos y acceso`, `E2 Archivos y experiencia`, `E3 Carpetas y navegación`, `E4 Compartición y permisos`, `E5 Calidad y entrega`.

## Backlog listo para el tablero

### E1 — Fundamentos y acceso

#### Inicio de Sesión

- **Descripción:** Cerrar la tarjeta existente verificando el flujo ya implementado de Google OAuth/OIDC, sesión opaca respaldada en Redis, renovación, cierre de sesión y estados de error en la SPA. Corregir únicamente brechas encontradas.
- **Criterios de aceptación:**
  - El usuario puede iniciar sesión con Google y volver a KornSpace con su identidad visible.
  - Se rechazan estados OAuth inválidos/reutilizados y la identidad no verificada; no se exponen tokens del proveedor al navegador.
  - La sesión se renueva mientras siga activa y al cerrar sesión se revoca y se limpian las cookies.
  - Los escenarios de éxito, cancelación, configuración inválida y sesión expirada están cubiertos por pruebas automatizadas existentes o añadidas.
- **Columna:** Backlog (tarjeta existente).
- **Prioridad:** High.
- **Asignados:** Backend (principal), Frontend (revisión).
- **Story points:** 3.
- **Épica:** E1 Fundamentos y acceso.
- **Inicio:** 2026-10-28.
- **Límite:** 2026-10-30.
- **Tags:** `backend`, `frontend`, `auth`, `security`, `testing`.

#### Definir reglas de compartición y permisos

- **Descripción:** Resolver antes del esquema los detalles de producto que el repositorio no define: identidad destinataria (correo/usuario), permisos disponibles, alcance sobre carpetas y descendientes, propiedad, revocación y qué ocurre al borrar o mover elementos compartidos. Registrar la decisión y ejemplos de lectura/edición.
- **Criterios de aceptación:**
  - Se aprueba una matriz de acciones por propietario, lector y editor para archivos y carpetas.
  - Se define si los permisos de carpeta se heredan, cómo se manejan excepciones y qué ve el destinatario.
  - Se especifican invitaciones a cuentas aún no registradas, revocación y eliminación de propietario/contenido.
  - Las reglas quedan documentadas en `docs/proyecto.md` o en un documento enlazado antes de iniciar el modelo de datos de compartición.
- **Columna:** Backlog.
- **Prioridad:** High.
- **Asignados:** Producto/ambos integrantes.
- **Story points:** 2.
- **Épica:** E1 Fundamentos y acceso.
- **Inicio:** 2026-10-28.
- **Límite:** 2026-10-29.
- **Tags:** `decision`, `sharing`, `security`, `docs`.

### E2 — Archivos y experiencia

#### Completar la pantalla principal y navegación lateral

- **Descripción:** Reemplazar la vista de bienvenida/listado básico por el marco principal de almacenamiento: navegación lateral, ubicación actual, acciones principales y área de contenido. La tarjeta existente `Modificar Sidebar` se considera parte de este alcance.
- **Criterios de aceptación:**
  - La barra lateral ofrece acceso a `Mis archivos`, `Compartidos conmigo` y papelera sólo si la política de borrado de MVP se implementa; no presenta destinos sin funcionalidad.
  - La vista muestra encabezado de ubicación, acción para subir y acción para crear carpeta cuando corresponda.
  - El diseño funciona desde 320 px de ancho hasta escritorio, admite teclado y conserva los temas existentes.
  - Todo el texto visible y etiquetas accesibles usan los catálogos español/inglés; la selección de idioma y tema sigue persistiendo.
- **Columna:** Backlog (tarjeta existente `Modificar Sidebar`, ampliar descripción).
- **Prioridad:** High.
- **Asignados:** Frontend.
- **Story points:** 5.
- **Épica:** E2 Archivos y experiencia.
- **Inicio:** 2026-10-30.
- **Límite:** 2026-11-04.
- **Tags:** `frontend`, `accessibility`, `i18n`, `files`.

#### Definir contratos REST de archivos y carpetas

- **Descripción:** Revisar el contrato actual y formalizar DTOs, respuestas, errores y límites para listado, carga, descarga, estado, carpetas y permisos. Mantener comandos/binarios en REST y metadatos flexibles en GraphQL.
- **Criterios de aceptación:**
  - Cada endpoint REST público nuevo o modificado tiene DTO tipado y decoradores Swagger.
  - Se documentan códigos de error y límites de tamaño/tipo sin filtrar información sensible.
  - El prefijo `/api` y la ruta `/graphql` se conservan.
  - Las reglas de acceso se delegan a servicios de dominio compartidos entre transportes.
- **Columna:** Backlog.
- **Prioridad:** High.
- **Asignados:** Backend.
- **Story points:** 3.
- **Épica:** E2 Archivos y experiencia.
- **Inicio:** 2026-10-30.
- **Límite:** 2026-11-02.
- **Tags:** `backend`, `rest`, `graphql`, `docs`, `security`.

#### Robustecer validación y listado de archivos

- **Descripción:** Consolidar el comportamiento de `GET /api/files` y `POST /api/files`: validación de nombre, tipo y tamaño, propietario, errores de almacenamiento y respuestas tipadas. El límite actual documentado es 100 MiB.
- **Criterios de aceptación:**
  - Sólo se listan archivos del usuario autenticado; nunca se muestran registros sin propietario ni archivos de otra cuenta.
  - Cargas sin nombre, vacías, sobre el máximo o con metadatos inválidos devuelven errores controlados y documentados.
  - Los binarios continúan directamente a S3 compatible; los registros se crean con propietario y estado coherente.
  - Pruebas unitarias y HTTP E2E cubren éxito, límite, autenticación y fallos de S3/DB relevantes.
- **Columna:** Backlog.
- **Prioridad:** High.
- **Asignados:** Backend.
- **Story points:** 5.
- **Épica:** E2 Archivos y experiencia.
- **Inicio:** 2026-11-03.
- **Límite:** 2026-11-07.
- **Tags:** `backend`, `files`, `rest`, `security`, `testing`.

#### Mejorar listado, estados y errores de archivos

- **Descripción:** Presentar archivos como lista usable con nombre, tipo, tamaño, fecha y estado; resolver carga vacía, carga inicial, error de red, procesamiento y fallo de procesamiento.
- **Criterios de aceptación:**
  - Estados vacío, cargando, error, procesando, disponible y fallido tienen texto traducido y acción clara cuando aplique.
  - Tamaño y fecha se muestran legibles; contenido largo no rompe el diseño.
  - La UI vuelve a consultar el estado sin sondeo cuando no hay archivos procesándose y detiene temporizadores al desmontarse.
  - Los errores de la API no se muestran como contenido técnico ni se silencian como éxito.
- **Columna:** Backlog.
- **Prioridad:** High.
- **Asignados:** Frontend.
- **Story points:** 5.
- **Épica:** E2 Archivos y experiencia.
- **Inicio:** 2026-11-03.
- **Límite:** 2026-11-07.
- **Tags:** `frontend`, `files`, `i18n`, `accessibility`.

#### Implementar carga múltiple y arrastrar/soltar

- **Descripción:** Permitir elegir varios archivos o soltarlos en la zona de carga. Mantener el límite de 100 MiB por archivo y mostrar avance/resultado por elemento sin bloquear toda la página.
- **Criterios de aceptación:**
  - Selector y drag & drop aceptan varios archivos y validan cada uno antes de enviarlo.
  - La zona indica visualmente cuándo se arrastran archivos y conserva una alternativa accesible con teclado.
  - El usuario ve progreso o estado por archivo; un archivo inválido no impide procesar los demás.
  - Fallos parciales se informan por archivo y la lista se actualiza al terminar cada carga.
- **Columna:** Backlog.
- **Prioridad:** High.
- **Asignados:** Frontend.
- **Story points:** 5.
- **Épica:** E2 Archivos y experiencia.
- **Inicio:** 2026-11-08.
- **Límite:** 2026-11-12.
- **Tags:** `frontend`, `files`, `accessibility`, `i18n`.

#### Cancelar cargas en curso

- **Descripción:** Añadir control de cancelación por archivo con `AbortController`/`XMLHttpRequest` según el mecanismo de progreso elegido. Definir con el servicio de archivos cómo limpiar metadatos u objetos parciales para evitar registros huérfanos.
- **Criterios de aceptación:**
  - Cada carga activa puede cancelarse sin cancelar otras cargas.
  - La interfaz distingue cancelación solicitada, cancelada y fallo real.
  - La cancelación no deja un archivo descargable incompleto ni metadatos en estado engañoso; limpieza y reintento tienen comportamiento definido.
  - Pruebas cubren cancelación en curso y la carrera con una respuesta de éxito/fallo.
- **Columna:** Backlog.
- **Prioridad:** Medium.
- **Asignados:** Frontend (principal), Backend (contrato/limpieza).
- **Story points:** 5.
- **Épica:** E2 Archivos y experiencia.
- **Inicio:** 2026-11-10.
- **Límite:** 2026-11-14.
- **Tags:** `frontend`, `backend`, `files`, `rest`, `testing`.

#### Descargar archivos individuales

- **Descripción:** Conectar una acción de descarga a `GET /api/files/:id`, con nombre y tipo correctos, respetando autenticación y estado disponible.
- **Criterios de aceptación:**
  - El usuario puede descargar sólo archivos propios o compartidos con permiso de lectura según las reglas aprobadas.
  - Archivos en proceso o fallidos no se entregan como descargas válidas.
  - La respuesta establece tipo y nombre de archivo de forma segura y Swagger documenta el endpoint.
  - Pruebas cubren descarga autorizada, no encontrado, sin permiso y error de S3.
- **Columna:** Backlog.
- **Prioridad:** High.
- **Asignados:** Backend y Frontend.
- **Story points:** 3.
- **Épica:** E2 Archivos y experiencia.
- **Inicio:** 2026-11-08.
- **Límite:** 2026-11-11.
- **Tags:** `frontend`, `backend`, `files`, `rest`, `security`, `testing`.

#### Renombrar y eliminar archivos

- **Descripción:** Incorporar operaciones REST y acciones de interfaz para renombrar y eliminar archivos. Aplicar propietario/permisos y decisión de retención; si se implementa papelera, definir restauración y vaciado antes de borrar físicamente.
- **Criterios de aceptación:**
  - Sólo propietario/editor puede renombrar o eliminar; lector recibe denegación uniforme.
  - Nombres se validan y se evita colisión según la política aprobada.
  - El borrado mantiene consistencia entre metadatos y S3, incluidos errores parciales/reintentos.
  - Hay confirmación accesible de eliminación y pruebas para autorización y fallos.
- **Columna:** Backlog.
- **Prioridad:** Medium.
- **Asignados:** Backend (principal), Frontend (acciones).
- **Story points:** 8.
- **Épica:** E2 Archivos y experiencia.
- **Inicio:** 2026-11-13.
- **Límite:** 2026-11-19.
- **Tags:** `backend`, `frontend`, `files`, `rest`, `security`, `testing`.

### E3 — Carpetas y navegación

#### Modelar carpetas y relaciones de archivos

- **Descripción:** Añadir entidad de carpeta y relación opcional de archivo/carpeta, con propietario, nombres, fechas e índices útiles. Crear migración versionada Prisma; no cambiar migraciones aplicadas.
- **Criterios de aceptación:**
  - Una migración `prisma migrate dev --name ...` crea el modelo y restricciones acordadas.
  - Se define si se permite carpeta raíz, duplicados de nombre y profundidad; las restricciones aplican por propietario/carpeta.
  - Archivos existentes conservan su propietario y se asignan a la raíz según una migración compatible y revisada.
  - Prisma Client genera y compila; el estado de migración se comprueba en base de desarrollo disponible.
- **Columna:** Backlog.
- **Prioridad:** High.
- **Asignados:** Backend.
- **Story points:** 5.
- **Épica:** E3 Carpetas y navegación.
- **Inicio:** 2026-11-05.
- **Límite:** 2026-11-09.
- **Tags:** `backend`, `database`, `folders`, `testing`.

#### API de creación y consulta de carpetas

- **Descripción:** Implementar servicios y endpoints REST para crear carpeta y listar elementos de una carpeta, validando propietario/permisos y evitando ciclos o padres inválidos.
- **Criterios de aceptación:**
  - Crear carpeta requiere nombre válido y padre accesible; la carpeta pertenece al usuario.
  - Listar devuelve sólo elementos directos de la ubicación autorizada con metadatos tipados.
  - IDs inexistentes, padre ajeno y conflictos responden con códigos documentados.
  - Pruebas unitarias y E2E verifican raíz, anidación, aislamiento de usuarios y validaciones.
- **Columna:** Backlog.
- **Prioridad:** High.
- **Asignados:** Backend.
- **Story points:** 5.
- **Épica:** E3 Carpetas y navegación.
- **Inicio:** 2026-11-09.
- **Límite:** 2026-11-13.
- **Tags:** `backend`, `folders`, `rest`, `security`, `testing`.

#### Navegar carpetas y crear directorios

- **Descripción:** Conectar la navegación de la SPA a la API: abrir carpetas, volver a la raíz y crear directorios con actualización de contenido.
- **Criterios de aceptación:**
  - La ruta/breadcrumb identifica la ubicación y permite volver a cada ancestro.
  - El formulario valida nombre, muestra errores del servidor y bloquea envíos duplicados.
  - Actualizar o navegar no conserva contenido de la carpeta anterior en pantalla.
  - Acciones y estados están traducidos y son utilizables por teclado y lector de pantalla.
- **Columna:** Backlog.
- **Prioridad:** High.
- **Asignados:** Frontend.
- **Story points:** 5.
- **Épica:** E3 Carpetas y navegación.
- **Inicio:** 2026-11-12.
- **Límite:** 2026-11-17.
- **Tags:** `frontend`, `folders`, `i18n`, `accessibility`.

#### Ubicar cargas en carpetas

- **Descripción:** Permitir que la carga se realice en la carpeta abierta y persistir la relación con el archivo. Mantener compatibilidad con cargas en raíz.
- **Criterios de aceptación:**
  - La API valida que el usuario pueda escribir en la carpeta destino.
  - El listado de raíz y el de subcarpeta muestran el archivo en una sola ubicación correcta.
  - La UI muestra el destino seleccionado y no pierde la carpeta actual tras completar o fallar.
  - Pruebas cubren carga raíz, subcarpeta e intento de carga en carpeta ajena.
- **Columna:** Backlog.
- **Prioridad:** High.
- **Asignados:** Backend y Frontend.
- **Story points:** 5.
- **Épica:** E3 Carpetas y navegación.
- **Inicio:** 2026-11-16.
- **Límite:** 2026-11-20.
- **Tags:** `frontend`, `backend`, `files`, `folders`, `security`, `testing`.

#### Renombrar y eliminar carpetas

- **Descripción:** Añadir edición y eliminación de carpetas con una política explícita para contenido no vacío, descendientes, objetos S3 y comparticiones.
- **Criterios de aceptación:**
  - Sólo propietario/editor autorizado puede modificar la carpeta.
  - No se permiten ciclos; la política para mover/eliminar una carpeta con contenido está aplicada y documentada.
  - Operaciones multiobjeto no dejan relaciones parcialmente corruptas ante errores recuperables.
  - API y UI muestran resultado o error, y las pruebas cubren permisos, carpeta vacía y no vacía.
- **Columna:** Backlog.
- **Prioridad:** Medium.
- **Asignados:** Backend (principal), Frontend (acciones).
- **Story points:** 8.
- **Épica:** E3 Carpetas y navegación.
- **Inicio:** 2026-11-19.
- **Límite:** 2026-11-25.
- **Tags:** `frontend`, `backend`, `folders`, `database`, `security`, `testing`.

### E4 — Compartición y permisos

#### Modelar membresías y permisos

- **Descripción:** Tras cerrar la decisión de producto, añadir el modelo relacional de compartición para archivos/carpetas, roles e invitaciones por correo/usuario. Versionar el cambio mediante migración.
- **Criterios de aceptación:**
  - Esquema implementa exactamente la matriz acordada, con claves foráneas, unicidad e índices.
  - No se aceptan roles arbitrarios ni membresías duplicadas.
  - Se define cómo se resuelve un correo que aún no corresponde a una cuenta y cómo se vincula al registrarse.
  - Migración y estrategia para datos existentes están revisadas; no se reescriben migraciones aplicadas.
- **Columna:** Backlog.
- **Prioridad:** High.
- **Asignados:** Backend.
- **Story points:** 5.
- **Épica:** E4 Compartición y permisos.
- **Inicio:** 2026-11-16.
- **Límite:** 2026-11-20.
- **Tags:** `backend`, `database`, `sharing`, `security`, `decision`.

#### Aplicar autorización común por recurso

- **Descripción:** Centralizar en servicios de dominio la evaluación de propietario, lector y editor para REST, GraphQL y operaciones S3. Evitar que controladores y resolvers implementen reglas por separado.
- **Criterios de aceptación:**
  - Una matriz de pruebas verifica cada acción por rol y tipo de recurso.
  - Acceso directo por ID a recurso ajeno no revela existencia ni metadatos privados.
  - URL/descarga o carga prefirmada sólo se emite tras autorización de la operación.
  - Las rutas privadas siguen exigiendo sesión válida y Swagger refleja los errores esperables.
- **Columna:** Backlog.
- **Prioridad:** High.
- **Asignados:** Backend.
- **Story points:** 8.
- **Épica:** E4 Compartición y permisos.
- **Inicio:** 2026-11-20.
- **Límite:** 2026-11-26.
- **Tags:** `backend`, `security`, `sharing`, `files`, `folders`, `testing`.

#### API para compartir y revocar acceso

- **Descripción:** Permitir conceder y revocar acceso mediante identidad KornSpace (correo o nombre de usuario si se agrega al modelo), mostrando quién tiene acceso y su rol.
- **Criterios de aceptación:**
  - Sólo el propietario o rol acordado puede invitar, cambiar permisos y revocar.
  - Se validan destinatario, rol y estado de cuenta; no se expone información de usuarios no autorizada.
  - Revocar invalida el acceso en solicitudes posteriores, incluidas descargas.
  - Endpoints y DTOs quedan documentados en Swagger, con pruebas de éxito, validación y denegación.
- **Columna:** Backlog.
- **Prioridad:** High.
- **Asignados:** Backend.
- **Story points:** 8.
- **Épica:** E4 Compartición y permisos.
- **Inicio:** 2026-11-24.
- **Límite:** 2026-11-29.
- **Tags:** `backend`, `sharing`, `rest`, `security`, `testing`.

#### Interfaz de compartir y vista de compartidos

- **Descripción:** Añadir diálogo accesible para conceder/revocar permisos y vista `Compartidos conmigo`, consumiendo los endpoints autorizados.
- **Criterios de aceptación:**
  - El propietario ve integrantes/roles y puede revocar o modificar según permisos aprobados.
  - La vista separa elementos compartidos de los propios e indica el rol efectivo.
  - Los casos de error, destinatario inválido y lista vacía se presentan en español e inglés.
  - Los controles tienen foco visible, nombres accesibles y confirmación para revocaciones.
- **Columna:** Backlog.
- **Prioridad:** High.
- **Asignados:** Frontend.
- **Story points:** 8.
- **Épica:** E4 Compartición y permisos.
- **Inicio:** 2026-11-25.
- **Límite:** 2026-11-30.
- **Tags:** `frontend`, `sharing`, `i18n`, `accessibility`, `security`.

### E5 — Calidad y entrega

#### Consultar metadatos de archivos y carpetas con GraphQL

- **Descripción:** Ampliar el esquema hoy limitado a `health` con consultas tipadas para contenido de carpetas y metadatos anidados; resolver delegando en los servicios de dominio y autorización existentes.
- **Criterios de aceptación:**
  - Consultas devuelven carpetas/archivos con campos aprobados, sin binarios ni URLs no autorizadas.
  - Resolvers no acceden directamente a Prisma/S3 ni duplican reglas de acceso.
  - La autorización es equivalente a REST y se prueba para propietario, lector, editor y usuario ajeno.
  - GraphiQL sólo queda habilitado en desarrollo y la consulta no expone datos sensibles.
- **Columna:** Backlog.
- **Prioridad:** Medium.
- **Asignados:** Backend.
- **Story points:** 5.
- **Épica:** E5 Calidad y entrega.
- **Inicio:** 2026-11-21.
- **Límite:** 2026-11-25.
- **Tags:** `backend`, `graphql`, `sharing`, `folders`, `testing`.

#### Búsqueda y paginación

- **Descripción:** Añadir búsqueda por nombre de archivo/carpeta y paginación estable para que el listado escale sin descargar todos los metadatos. Acordar si la búsqueda incluye compartidos y el alcance de carpetas.
- **Criterios de aceptación:**
  - La búsqueda respeta propietario y permisos; no filtra nombres de recursos ajenos.
  - Paginación usa orden determinista y límites máximos del servidor.
  - Frontend ofrece búsqueda, carga de resultados y estado sin coincidencias con debounce moderado.
  - Tests cubren límites, orden, permisos y consultas vacías.
- **Columna:** Backlog.
- **Prioridad:** Medium.
- **Asignados:** Backend y Frontend.
- **Story points:** 8.
- **Épica:** E5 Calidad y entrega.
- **Inicio:** 2026-11-23.
- **Límite:** 2026-11-28.
- **Tags:** `backend`, `frontend`, `rest`, `graphql`, `files`, `folders`, `testing`.

#### Revisar resiliencia de SQS y procesamiento

- **Descripción:** Revisar reintentos, visibilidad, mensajes inválidos, estados fallidos y consistencia ante fallos del worker. Evitar que un mensaje venenoso se procese indefinidamente sin diagnóstico.
- **Criterios de aceptación:**
  - Procesamiento es idempotente o detecta que un archivo ya se completó.
  - Fallos persistentes actualizan estado de forma recuperable y no exponen datos de archivo en logs.
  - Se documenta DLQ/reintento elegido y se implementa en Terraform/LocalStack si cabe en el MVP.
  - Pruebas cubren mensaje válido, inválido, reintento y fallo de S3/DB.
- **Columna:** Backlog.
- **Prioridad:** Medium.
- **Asignados:** Backend e Infra.
- **Story points:** 5.
- **Épica:** E5 Calidad y entrega.
- **Inicio:** 2026-11-24.
- **Límite:** 2026-11-28.
- **Tags:** `backend`, `infra`, `files`, `security`, `testing`.

#### Preparar configuración de entrega segura

- **Descripción:** Aclarar y corregir la diferencia entre el overlay actual y producción real. Definir artefacto de frontend servido por Nginx, proveedor S3 real parametrizado, TLS/proxy y secretos sin credenciales locales por defecto.
- **Criterios de aceptación:**
  - `docs/getting-started.md` y `docs/docker-infra.md` describen con precisión desarrollo, overlay local y requisitos pendientes de producción.
  - Ninguna configuración de despliegue real cae silenciosamente en credenciales/endpoints LocalStack.
  - `.env.example` contiene variables obligatorias documentadas y ningún secreto real.
  - `docker compose config --quiet` valida la configuración local y el overlay; no se declara producción lista si no existe ruta de despliegue HTTPS verificable.
- **Columna:** Backlog.
- **Prioridad:** High.
- **Asignados:** Infra (principal), Backend/Frontend (revisión).
- **Story points:** 5.
- **Épica:** E5 Calidad y entrega.
- **Inicio:** 2026-11-26.
- **Límite:** 2026-11-30.
- **Tags:** `infra`, `security`, `release`, `docs`.

#### Cierre de calidad y documentación del MVP

- **Descripción:** Ejecutar las verificaciones pertinentes, corregir regresiones, documentar el flujo funcional y registrar límites conocidos del MVP.
- **Criterios de aceptación:**
  - Frontend y backend compilan.
  - Pasan pruebas unitarias y E2E del workspace; si una suite no se puede ejecutar, se documenta motivo y la tarjeta no se cierra como si hubiese pasado.
  - Migraciones Prisma están versionadas y el estado se valida cuando la base correspondiente está disponible.
  - Compose y Terraform se validan cuando sus herramientas/servicios estén disponibles; se informan resultados exactos.
  - Documentación cubre inicio de sesión, archivos, carpetas, compartir, variables y limitaciones conocidas; no contiene secretos.
- **Columna:** Backlog.
- **Prioridad:** High.
- **Asignados:** Ambos integrantes.
- **Story points:** 5.
- **Épica:** E5 Calidad y entrega.
- **Inicio:** 2026-11-29.
- **Límite:** 2026-11-30.
- **Tags:** `frontend`, `backend`, `infra`, `testing`, `docs`, `release`.

## Hitos y dependencias

| Fechas | Hito | Dependencias / resultado |
| --- | --- | --- |
| 28–30 oct | Cerrar acceso y reglas de permisos | Inicio de Sesión validado; reglas de compartición aprobadas. |
| 30 oct–7 nov | Interfaz base y contratos/listado de archivos | Base visual conectada a contratos claros; aislamiento por propietario probado. |
| 5–14 nov | Carpetas iniciales, carga múltiple/cancelación y descargas | Migración de carpetas antes de API/UI; acordar limpieza de cargas canceladas. |
| 13–20 nov | Operaciones de archivos, navegación y ubicación de cargas | Aplicar reglas de propiedad; evitar dejar objetos/metadatos inconsistentes. |
| 16–26 nov | Modelo, autorización compartida, GraphQL y resiliencia | Decisión de permisos y modelo de recursos listos antes de exponer acceso. |
| 23–30 nov | Búsqueda, experiencia de compartición y cierre | Compartición funcional y comprobaciones/documentación completas. |

## Fuera del alcance comprometido del MVP

- URLs públicas de compartición, colaboración simultánea y edición del contenido de documentos en navegador.
- Vista calendario/Gantt o administración de proyectos; las imágenes sólo muestran el tablero usado para organizar el desarrollo.
- Papelera/retención, antivirus/escaneo de contenido, cuotas por cuenta y producción pública completa, salvo decisión explícita y capacidad adicional.
- Multi-part upload reanudable para archivos mayores de 100 MiB. El máximo actual es 100 MiB por archivo.

Si las fechas o capacidad no permiten todo el alcance, protege primero acceso seguro, navegación de archivos/carpetas, carga/descarga y aislamiento. Comparte después con permisos revisados. No recortes autorización, pruebas de aislamiento ni manejo de secretos para cumplir calendario.
