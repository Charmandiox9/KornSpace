# Mover archivos y carpetas

El drag and drop interno mueve el elemento; no crea copias ni cambia su identificador o clave S3. La carpeta y sus descendientes conservan sus relaciones y comparticiones explícitas. Los permisos heredados corresponden a la nueva ubicación.

Se admiten subcarpetas y ancestros del breadcrumb, incluida la raíz propia. Soltar en el padre actual no escribe metadatos ni actividad. No se permiten ciclos, nombres repetidos, mover elementos de papelera ni cambiar de propietario mediante un movimiento. Se exige escritura sobre el elemento, origen y destino; la raíz sólo puede modificarse por su propietario.

REST: `POST /api/files/:id/move` y `POST /api/folders/:id/move`, con `{ "destinationId": "uuid o null" }`. Respuesta 204; conflictos 409, ciclos 400 y permisos según las políticas existentes. El movimiento y su actividad se guardan juntos en una transacción serializable; ante conflictos concurrentes se debe actualizar y reintentar.

Los archivos externos al navegador siguen usando el flujo de carga. Un arrastre externo no puede mover ni borrar el original del equipo.
