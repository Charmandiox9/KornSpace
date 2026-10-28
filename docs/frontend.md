# Frontend

React 19 con TypeScript, Vite y CSS plano. Vite es el servidor de desarrollo y la herramienta de build; no se usan frameworks React, routers, UI kits ni librerías de estado.

## Comandos

Desde la raíz:

| Comando | Uso |
| --- | --- |
| `pnpm install` | Instala dependencias del workspace. |
| `pnpm dev:frontend` | Inicia Vite en `http://localhost:5173`. |
| `pnpm --filter kornspace-frontend build` | Comprueba TypeScript y genera `frontend/dist/`. |
| `pnpm --filter kornspace-frontend preview` | Sirve localmente el build para revisión. |
| `pnpm --filter kornspace-frontend test:unit` | Prueba idioma, tema y catálogos de traducción. |

Vite carga el `.env` de la raíz. `VITE_API_BASE_URL` define la URL de API que usa el navegador; para desarrollo directo (`localhost:5173` → `localhost:3000`) configura `http://localhost:3000`. Si queda vacío, Vite reenvía `/api` y `/graphql` al backend. Compose deja la URL del navegador vacía y configura `VITE_API_PROXY_TARGET=http://backend:3000`, que es accesible desde el contenedor.

## Convenciones

- Usar React puro y TypeScript estricto; evitar `any`.
- Mantener textos visibles en `src/i18n.ts` para español e inglés.
- El idioma y el tema claro/oscuro se conservan en `localStorage`.
- Mantener estilos en `src/style.css` usando variables CSS.
- La página lista archivos, permite subir hasta 100 MiB y refresca el estado de las cargas pendientes.
- Transferir los binarios con REST y S3; no enviarlos por GraphQL.

El inicio de sesión con Google devuelve a la pantalla de archivos. La API requiere una sesión activa y limita el listado, las subidas y las descargas al usuario autenticado.
