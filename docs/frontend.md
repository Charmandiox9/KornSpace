# Frontend

Next.js con React 19, TypeScript estricto y Tailwind CSS. El App Router sirve las rutas y el servidor de Next reenvía `/api` y `/graphql` al backend.

## Comandos

Desde la raíz:

| Comando | Uso |
| --- | --- |
| `pnpm install` | Instala dependencias del workspace. |
| `pnpm dev:frontend` | Inicia Next.js en `http://localhost:3001`. |
| `pnpm --filter kornspace-frontend build` | Comprueba TypeScript y genera `frontend/.next/`. |
| `pnpm --filter kornspace-frontend start` | Sirve localmente el build de producción. |
| `pnpm --filter kornspace-frontend test:unit` | Prueba idioma, tema, sesión, renovación y cola de cargas. |
| `pnpm --filter kornspace-frontend test:browser` | Tras compilar, prueba navegación, selector, teclado, arrastrar/soltar, progreso real con HTTP limitado, cancelación independiente y caducidad de sesión en un navegador real con API simulada. |

El servidor de desarrollo genera sus archivos en `.next-dev/`; las compilaciones y pruebas de producción usan `.next/`. Esto evita que una compilación sobrescriba los archivos de un servidor de desarrollo abierto.

`API_PROXY_TARGET` configura el destino al que el servidor Next reenvía `/api` y `/graphql`. Su valor local predeterminado es `http://localhost:3000`; Compose configura `http://backend:3000`, accesible dentro de la red de contenedores. El navegador usa siempre rutas relativas para mantener las cookies de sesión bajo el mismo origen.

La prueba de navegador usa Edge o Chrome/Chromium instalado, con un perfil temporal y sin credenciales reales. Puede indicarse otra ubicación mediante la variable de entorno `BROWSER_EXECUTABLE`. Usa el protocolo de depuración del navegador y APIs de Node, sin añadir dependencias al frontend. Necesita permisos para abrir conexiones locales.

## Rutas y organización

Todo el código de la aplicación vive en `frontend/src/`. Las rutas públicas están en `src/app/(public)/login`, las rutas de cuenta en `src/app/(account)/onboarding` y el espacio autenticado en `src/app/(workspace)/files`. Los grupos entre paréntesis organizan el código sin cambiar las URLs. `/` redirige a `/login`; las transiciones y los retornos por autenticación usan el router de Next.js. `src/app/_components/` coordina la sesión y el estado compartido; `src/features/auth/` y `src/features/files/` contienen las vistas y validaciones de cada dominio; `src/components/` contiene UI reutilizable; `src/hooks/` contiene hooks compartidos; `src/lib/` centraliza el cliente HTTP; y `src/i18n/` y `src/types/` agrupan sus respectivos contratos. El alias `@/` apunta a `src/`. La configuración de Next.js, los manifiestos, las pruebas y `public/` permanecen en la raíz de `frontend/`.

## Cómo se conectan las páginas y la sesión

`src/app/layout.tsx` envuelve todas las rutas y carga los estilos y metadatos compartidos. Cada `page.tsx` define una URL: `(public)/login/page.tsx` corresponde a `/login`, `(account)/onboarding/page.tsx` a `/onboarding` y `(workspace)/files/page.tsx` a `/files`. Los grupos entre paréntesis no añaden segmentos a la URL ni control de acceso por sí mismos.

Actualmente estas tres páginas montan `src/app/_components/KornSpaceApp.tsx`, que consume `useSession()` y coordina las vistas de `src/features/`. `SessionProvider`, montado en el layout raíz, consulta `/api/auth/me` una vez al abrir o recargar la aplicación. El usuario se conserva en memoria durante la navegación con `next/link` y el router de Next; cambiar de página o idioma no repite esa consulta. `session-store.ts` comparte la inicialización incluso durante la comprobación adicional de efectos de React en desarrollo. No guarda credenciales ni tokens en el almacenamiento del navegador.

`src/features/auth/session-destination.ts` elige el destino: sin sesión, `/login`; con sesión pero sin nombre de usuario, `/onboarding`; con sesión y nombre de usuario, `/files`. Una petición privada que recibe HTTP 401 intenta renovar la sesión y reintenta la petición una vez. Las peticiones simultáneas comparten la renovación. Si falla la renovación o el reintento sigue devolviendo 401, el proveedor limpia el usuario y vuelve al login. Los HTTP 403 de las operaciones privadas son errores de permisos y no provocan una renovación. El backend continúa validando la sesión y los permisos en cada operación privada.

El sidebar se importa y se renderiza en `src/app/_components/KornSpaceApp.tsx`, cuando el destino es `/files` y existe un usuario. No está montado en el layout raíz ni directamente en `files/page.tsx`. El componente visual vive en `src/components/Sidebar.tsx` y utiliza `AccountMenu` para los datos de cuenta, preferencias y cierre de sesión. La sesión ya se comparte desde el layout raíz; si se incorporan más páginas privadas, el sidebar puede trasladarse al layout del grupo `(workspace)`.

`src/app/not-found.tsx` define la pantalla 404 para direcciones desconocidas. Reutiliza `PublicLayout`, los catálogos de traducción y las preferencias de idioma y tema. El botón «Volver atrás» usa `router.back()` para regresar mediante el historial del navegador; si no existe historial previo, redirige al inicio. También ofrece un enlace independiente al inicio con `next/link`; el flujo de sesión decide después si corresponde mostrar login, configuración de cuenta o archivos.

## Convenciones de implementación

Las interfaces y los alias de tipos se declaran en `src/types/`: `auth.ts` para sesión y usuario, `files.ts` para archivos y cola de cargas, `api.ts` para transporte HTTP, `preferences.ts` para idioma y tema, `i18n.ts` para el contrato del catálogo y `components.ts` para props de páginas, componentes y proveedores. `types/index.ts` reexporta solo tipos. Los componentes, hooks y servicios consumen estos contratos mediante `import type`; los catálogos de traducción contienen los textos y las funciones, sin declarar interfaces locales.

- Usar Next.js App Router, React y TypeScript estricto; evitar `any`.
- Mantener textos visibles en `src/i18n/index.ts` para español e inglés.
- El idioma y el tema claro/oscuro se conservan en `localStorage`.
- Usar utilidades Tailwind en las páginas y componentes. Mantener en `src/app/globals.css` la carga de Tailwind, los tokens de tema y los ajustes globales de accesibilidad.
- La página lista archivos, admite selector múltiple y arrastrar/soltar, y refresca el estado de las cargas pendientes.
- Transferir los binarios con REST y S3; no enviarlos por GraphQL.

El inicio de sesión con Google devuelve a la pantalla de archivos. La API requiere una sesión activa y limita el listado, las subidas y las descargas al usuario autenticado.

La integración de Tailwind usa el plugin oficial `@tailwindcss/postcss` en `frontend/postcss.config.mjs`. Las rutas se definen exclusivamente en `src/app/`; `src/features/auth/session-destination.ts` solo decide la redirección correspondiente al estado de sesión.

## Carga de archivos

`src/hooks/use-upload-queue.ts` conecta la vista con `src/features/files/upload-queue.ts`. La cola valida cada archivo antes del envío (hasta 1 GiB por archivo, tamaño mayor que cero y nombre válido) y mantiene hasta tres envíos simultáneos. Un archivo rechazado o un fallo de almacenamiento no detiene los demás. El selector sigue habilitado mientras hay envíos y permite añadir nuevos lotes.

Cada elemento muestra bytes enviados, porcentaje real y una barra de progreso accesible. `XMLHttpRequest.upload` mide el envío al servidor; el 100% no significa que S3 y PostgreSQL ya lo hayan confirmado. Hasta recibir la respuesta, el estado es «Confirmando guardado». La renovación de sesión se comparte con el cliente HTTP y conserva el mismo identificador de intento al repetir una petición rechazada por autenticación. Después de cada carga correcta se actualiza la lista; el procesamiento posterior se consulta mediante el refresco existente del listado.

El progreso y los resultados se reúnen en un único toast Sileo, fuera del contenido de la página. AppToaster se monta una vez en el layout y sigue el idioma y el tema del documento. UploadNotifications mantiene una identidad estable para el grupo: las nuevas cargas se agregan al mismo panel y su altura se ajusta al contenido. La lista tiene una altura máxima y desplazamiento interno para conservar los controles accesibles en móvil. Cada UploadToastContent se suscribe al elemento concreto: los eventos de bytes actualizan su barra sin reiniciar la animación de Sileo ni repintar toda la página. Cada fila conserva cancelación, reintento, validación y resultado independientes. Los errores y cancelaciones permanecen hasta resolverse o cerrarse; al confirmar un éxito, la fila se compacta, sustituye el progreso por «Subida completada» con un check y se retira a los 7 segundos. El panel se reduce conforme salen las filas y desaparece cuando queda vacío. El mensaje distingue una carga recibida de un archivo todavía en procesamiento. Los temporizadores se limpian al desmontar el grupo.

La pila se sitúa abajo a la derecha, con todas las tarjetas expandidas y desplazamiento cuando no caben. Sigue la carga más reciente sin desplazar al usuario que está interactuando con otra tarjeta. La barra utiliza transformaciones y respeta `prefers-reduced-motion`; los estados se anuncian aparte del porcentaje para evitar anuncios continuos por cada evento de bytes.

Se usa `sileo@0.1.6` fijado, con `patches/sileo@0.1.6.patch` aplicado por pnpm. El parche expone los identificadores que ya usa su implementación, permite expandir varias tarjetas y desactivar el descarte de cargas activas, evita botones anidados, adapta el SVG al ancho móvil y hace que las animaciones SVG respeten movimiento reducido. También evita que un descarte anterior borre una nueva instancia del mismo toast durante un remonte de React. Al actualizar Sileo, revisa el parche y ejecuta la suite de navegador. Ambos Dockerfiles copian `patches/` antes de instalar. La API base y sus opciones están en la [documentación oficial de Sileo](https://sileo.aaryan.design/docs).

La zona de arrastre cambia de aspecto al recibir archivos y mantiene un botón accesible con teclado como alternativa. Cada archivo activo o en espera tiene su propio control de cancelación. Una carga en espera se retira localmente. Para una carga activa, se aborta su XHR y se solicita la cancelación de ese intento al backend. La interfaz distingue solicitud de cancelación, limpieza confirmada, fallo real y resultado todavía sin confirmar. Mientras la confirmación no esté disponible, ofrece «Comprobar cancelación» y no permite iniciar un intento duplicado.

Si la confirmación ya comenzó en el servidor, el archivo completo se conserva y se muestra ese resultado. Si la cancelación ganó, el servidor limpia los objetos y metadatos temporales antes de responder `cancelled`. Una carga fallida o cancelada confirmada puede reintentarse sin volver a seleccionar el archivo: comienza en cero, con un nuevo identificador. Las respuestas perdidas se reconcilian con el servidor antes de ofrecer reintento. Salir de la vista o cambiar de usuario aborta las peticiones pendientes y limpia la cola local; la recuperación del backend conserva el trabajo de limpieza pendiente.
