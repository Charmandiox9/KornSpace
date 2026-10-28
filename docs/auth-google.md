# Inicio de sesión con Google

KornSpace usa OAuth 2.0 con OpenID Connect. Google confirma la identidad; el backend crea o actualiza la cuenta en PostgreSQL y mantiene la sesión en Redis. Los tokens se envían en cookies `HttpOnly`, por lo que el código del frontend no puede leerlos.

## Crear las credenciales

1. Abre [Google Cloud Console](https://console.cloud.google.com/) y selecciona o crea un proyecto.
2. En **Google Auth Platform**, configura la pantalla de consentimiento. Para desarrollo personal, elige el tipo de usuario adecuado y añade tu cuenta como usuario de prueba si la aplicación está en modo de pruebas.
3. En **Clientes** (o **APIs y servicios → Credenciales**), crea un cliente OAuth de tipo **Aplicación web**.
4. Añade el callback correspondiente al modo que usarás como **URI de redireccionamiento autorizado**:

   ```text
   http://localhost:3000/api/auth/google/callback
   ```

   Para Compose con Nginx usa `http://localhost/api/auth/google/callback`. El URI debe coincidir carácter por carácter con `GOOGLE_OAUTH_REDIRECT_URI`, incluido el protocolo, puerto y ruta. Para otro dominio, registra el callback HTTPS de ese dominio.
5. Copia el **ID de cliente** y el **secreto de cliente** que muestra Google. El secreto sólo va en `.env`; nunca lo pongas en React, en el Dockerfile ni en Git.

El flujo solicita sólo `openid`, `email` y `profile`. No solicita acceso a Google Drive.

## Configurar el proyecto

Desde la raíz, crea el archivo local y completa las variables:

```powershell
Copy-Item .env.example .env
```

```dotenv
GOOGLE_OAUTH_CLIENT_ID=tu-id-de-cliente.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=tu-secreto-de-cliente
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
FRONTEND_ORIGIN=http://localhost:5173
VITE_API_BASE_URL=http://localhost:3000
JWT_SECRET=secreto-aleatorio-de-al-menos-32-bytes
JWT_ACCESS_TTL_SECONDS=900
SESSION_TTL_SECONDS=604800
AUTH_COOKIE_SECURE=false
```

Genera un secreto JWT con Node.js; pega el resultado en `JWT_SECRET`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

`JWT_SECRET` firma los JWT internos de KornSpace y debe ser distinto del secreto OAuth. El token dura 15 minutos y la sesión Redis dura 7 días por defecto. Al expirar el JWT, el frontend solicita uno nuevo; el backend sólo lo emite si la sesión Redis sigue activa.

Para el Compose local se usa HTTP, por eso `AUTH_COOKIE_SECURE=false`. En cualquier dominio HTTPS configura `AUTH_COOKIE_SECURE=true` y registra el callback HTTPS exacto en Google. Mantén las variables en `.env` o en el gestor de secretos del despliegue; no las compartas ni las confirmes en Git.

## Arrancar

Para desarrollo con frontend y backend ejecutados directamente, registra en Google el callback exacto `http://localhost:3000/api/auth/google/callback`, usa `FRONTEND_ORIGIN=http://localhost:5173` y `VITE_API_BASE_URL=http://localhost:3000`. Para Compose con Nginx usa el callback `http://localhost/api/auth/google/callback`, `FRONTEND_ORIGIN=http://localhost` y deja `VITE_API_BASE_URL` vacío. Después de configurar PostgreSQL y LocalStack descritos en [puesta en marcha](getting-started.md), ejecuta:

```sh
docker compose config --quiet
docker compose up --build -d
docker compose logs -f backend
```

Abre <http://localhost>. La página inicial muestra el botón **Continuar con Google**. Al terminar el flujo, KornSpace vuelve al inicio y muestra el espacio actual de subida y descarga de archivos.

## Qué protege el backend

- El callback valida el estado OAuth de un solo uso, PKCE, el nonce, la firma del ID token, su audiencia, expiración, emisor y el correo verificado.
- Las rutas de archivos y `/api/auth/me` validan la firma, emisor, audiencia y expiración del JWT, y además cotejan su identidad con la sesión activa en Redis.
- `/api/auth/refresh` sólo renueva el JWT si Redis aún contiene la sesión. Cerrar sesión elimina esa sesión y borra las cookies.
- Las consultas, subidas y descargas se limitan al propietario. Los registros antiguos sin propietario no se exponen a usuarios autenticados.
- Las cookies son `HttpOnly`, `SameSite=Lax` y usan `Secure` cuando `AUTH_COOKIE_SECURE=true`.

Referencias oficiales: [OAuth 2.0 para aplicaciones web de servidor](https://developers.google.com/identity/protocols/oauth2/web-server), [OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect) y [mejores prácticas OAuth](https://developers.google.com/identity/protocols/oauth2/resources/best-practices).
