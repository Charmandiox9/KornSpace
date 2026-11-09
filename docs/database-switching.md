# Alternar PostgreSQL local y Neon

Los comandos se ejecutan desde la raíz del repositorio con Node.js 22.18 o posterior y las dependencias instaladas mediante `pnpm install`.

## Elegir base de datos

```powershell
pnpm db:use local
# Si PostgreSQL está detenido:
docker compose up -d --no-deps postgres
# Recrear ambas réplicas con las nuevas variables:
docker compose up -d --no-deps --force-recreate backend
```

Para usar Neon:

```powershell
pnpm db:use neon
docker compose up -d --no-deps --force-recreate backend
```

Si se usa `pnpm dev`, reiniciar el backend de desarrollo después de cambiar la selección.

`db:use` modifica exclusivamente el `.env` existente. No mueve datos. Ajusta estas cuatro variables juntas:

| Variable | Equipo local | Contenedores |
| --- | --- | --- |
| `DATABASE_URL` | Conexión normal del backend y Prisma | El overlay usa `DOCKER_DATABASE_URL` |
| `DATABASE_URL_UNPOOLED` | Conexión directa para migraciones | El overlay usa `DOCKER_DATABASE_URL_UNPOOLED` |
| `DOCKER_DATABASE_URL` | — | Conexión normal elegida |
| `DOCKER_DATABASE_URL_UNPOOLED` | — | Conexión directa elegida |

En modo local se usa `localhost:POSTGRES_PORT` desde el equipo y `postgres:5432` desde Docker. En Neon se usan `NEON_DATABASE_URL` (normal, puede ser pooled) y `NEON_DATABASE_URL_UNPOOLED` (directa). Se conservan las dos conexiones Neon en el mismo `.env`, sin generar copias de credenciales.

El overlay `docker-compose.production.yml` utiliza las variables `DOCKER_*`; si no están definidas utiliza `POSTGRES_DATABASE_URL`. Por eso cambiar únicamente `DATABASE_URL` no modifica la conexión del backend en Docker con este overlay. El `.env` local actual activa los dos archivos Compose mediante `COMPOSE_FILE` y `COMPOSE_PATH_SEPARATOR`.

## Copiar registros nuevos de local a Neon

Vista previa, sin escrituras:

```powershell
pnpm db:sync:neon
```

Insertar los registros inexistentes:

```powershell
pnpm db:sync:neon --apply
```

Opcionalmente, cambiar el tamaño de lote (entre 1 y 1000):

```powershell
pnpm db:sync:neon --apply --batch-size=200
```

El origen es siempre PostgreSQL local, construido con `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` y `POSTGRES_PORT`, o indicado explícitamente mediante `LOCAL_DATABASE_URL`. El destino es siempre `NEON_DATABASE_URL_UNPOOLED`, independientemente de la base que esté usando la aplicación. Debe ser una conexión directa de Neon, sin pooler.

### Alcance y consistencia

- Copia las tablas de datos de KornSpace del esquema `public`. Excluye las tablas administradas `neon_auth` y los registros `_prisma_migrations`.
- Verifica que columnas e historiales de migración coincidan antes de copiar. No aplica migraciones automáticamente ni inventa registros en el historial.
- Identifica registros existentes por su clave primaria, incluidas claves compuestas. No actualiza sus campos ni replica eliminaciones. Por tanto, es una copia incremental de inserciones en una dirección, no una sincronización bidireccional completa.
- Un registro borrado de Neon que siga en local volverá a considerarse inexistente. Para usuarios/permisos/archivos que evolucionen en ambas bases, las modificaciones requieren una política separada de reconciliación.
- Inserta padres antes que hijos, incluidas carpetas anidadas. Rechaza dependencias que no pueda ordenar.
- Usa un snapshot consistente de lectura local. La aplicación puede seguir funcionando; las filas creadas después del snapshot se copiarán en la siguiente ejecución.
- Cada ejecución con `--apply` confirma una sola transacción en Neon. Ante un conflicto secundario (por ejemplo, mismo `googleSubject` con distintos IDs), un error de permisos o una relación inválida, revierte todos los inserts de esa ejecución. No omite silenciosamente esos conflictos.
- Un bloqueo transaccional impide dos ejecuciones simultáneas del sincronizador contra el mismo destino. Se puede reintentar un fallo: las claves primarias evitan duplicados.
- La simulación sólo cuenta las claves primarias faltantes y no escribe. Los conflictos secundarios se validan al aplicar.
- Transfiere JSON como texto directamente entre PostgreSQL mediante Prisma, sin convertir `BigInt` a números de JavaScript. No imprime filas, URLs ni credenciales.
- Copia metadatos PostgreSQL. Los binarios S3/LocalStack y las sesiones/caché de Redis no se transfieren; los objetos `s3Key` deben existir en el almacenamiento que use el entorno destino.
- Tiene un límite de 15 minutos por transacción de destino. Si el volumen crece, reducir el lote o revisar la estrategia antes de aumentar el límite. No soporta columnas con secuencias numéricas, identidades ni nuevos ciclos de dependencias sin adaptar el script.

### Ejecutarlo periódicamente en Windows

Crear una tarea en el Programador de tareas con la frecuencia deseada (por ejemplo, cada hora):

- **Programa:** `C:\Windows\System32\cmd.exe`.
- **Argumentos:** `/d /c pnpm.cmd db:sync:neon --apply`.
- **Iniciar en:** la ruta absoluta de la raíz de KornSpace.
- **Si la tarea ya está ejecutándose:** no iniciar otra instancia.

La cuenta de la tarea debe poder leer el `.env`, acceder a PostgreSQL local y conectarse a Neon. El proceso termina con código distinto de cero si falla; revisar el resultado y volver a ejecutar. No poner URLs ni contraseñas en los argumentos de la tarea.

## Pruebas del sincronizador

```powershell
pnpm test:db-sync
```

Las pruebas crean y eliminan exclusivamente dos bases temporales con prefijo `kornspace_sync_test_` en PostgreSQL local. Usan datos ficticios y no escriben en Neon ni en la base real de KornSpace.
