# Actualizaciones de estado en tiempo real

El navegador conecta a `ws(s)://<api>/api/files/events`. El backend valida las cookies HttpOnly, el JWT, la sesión en Redis y el origen antes de aceptar la conexión. El worker envía eventos `file.status` con el id y estado final del archivo únicamente a sockets de su propietario.

El frontend conserva REST para la carga inicial y las acciones de archivos. Al recibir eventos agrupados brevemente refresca la lista de archivos; al reconectar vuelve a sincronizarla para recuperar eventos que pudieron perderse. Ya no consulta repetidamente la lista mientras hay cargas en procesamiento. La papelera se vuelve a consultar al entrar y después de acciones que la modifican.

En desarrollo, el cliente asume que Next corre en el puerto 3001 y Nest en el 3000. `NEXT_PUBLIC_API_WS_URL` es opcional y queda vacío por defecto: el navegador detecta el origen local o usa el mismo origen detrás de Nginx. Para un backend en otro origen, configura esta variable con su URL `ws://` o `wss://`. Compose la pasa al contenedor frontend. Nginx reenvía la negociación WebSocket bajo `/api/`.
