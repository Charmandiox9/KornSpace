# KornSpace

Plataforma de almacenamiento de archivos en desarrollo. El workspace usa React + Vite en el frontend y NestJS en el backend, con REST, GraphQL, Prisma/PostgreSQL, Redis, LocalStack, Terraform y Nginx.

## Requisitos

- Docker Desktop con Docker Compose v2.
- Node.js 22 o posterior para ejecutar comandos fuera de Docker.
- pnpm 10.31.0, activado mediante Corepack (`corepack enable`).
- Un token de LocalStack para iniciar LocalStack actual (`LOCALSTACK_AUTH_TOKEN`).
- Un proyecto de Neon para desarrollo y sus URLs PostgreSQL.

## Configuración del entorno

Copia el archivo de ejemplo en la raíz del repositorio:

```powershell
Copy-Item .env.example .env
```

En macOS/Linux:

```sh
cp .env.example .env
```

Completa las variables que correspondan:

| Variable | Uso |
| --- | --- |
| `LOCALSTACK_AUTH_TOKEN` | Autentica LocalStack para el entorno local. |
| `DATABASE_URL` | Conexión agrupada de Neon para consultas normales del backend. |
| `DATABASE_URL_UNPOOLED` | Conexión directa de Neon usada por las migraciones Prisma. Usa el host sin `-pooler`. |
| `POSTGRES_PASSWORD` | Contraseña para el servicio PostgreSQL del overlay Compose de producción. |
| `POSTGRES_DATABASE_URL` | URL del servicio PostgreSQL `postgres`, usada por el backend en ese overlay. |
| `POSTGRES_USER` / `POSTGRES_DB` | Usuario y base del contenedor PostgreSQL; por defecto ambos son `kornspace`. |

En PostgreSQL autogestionado, `DATABASE_URL_UNPOOLED` debe usar una conexión directa. No incluyas `.env` en Git; ya está excluido.

## Primer arranque con Docker

Desde la raíz:

```sh
docker compose config --quiet
docker compose up --build -d
docker compose ps
```

- `config --quiet` valida la configuración y las variables requeridas sin iniciar servicios.
- `up --build -d` construye las imágenes, inicia los servicios en segundo plano y espera las dependencias declaradas.
- `ps` muestra el estado de los contenedores.

Terraform se ejecuta al iniciar el stack, espera a que LocalStack esté saludable y crea el bucket S3 `kornspace-files`. El backend aplica las migraciones Prisma pendientes antes de iniciar NestJS. En desarrollo, el interceptor registra operaciones REST y GraphQL porque `NODE_ENV` está configurado como `development`.

URLs locales:

- Web: <http://localhost>
- Salud REST (incluye conexión a PostgreSQL): <http://localhost/api/health>
- Swagger: <http://localhost/api/docs>
- GraphQL: <http://localhost/graphql>
- LocalStack: <http://localhost:4566>
- Redis: `localhost:6379`

## Comandos del workspace

Ejecútalos desde la raíz del proyecto:

| Comando | Para qué sirve |
| --- | --- |
| `pnpm install` | Instala las dependencias de todos los paquetes del workspace. |
| `pnpm dev:frontend` | Inicia Vite para desarrollar el frontend en `http://localhost:5173`. |
| `pnpm dev:backend` | Inicia NestJS en modo observación. Define `DATABASE_URL` y `DATABASE_URL_UNPOOLED` en el entorno del proceso. |
| `pnpm build` | Genera Prisma Client y compila frontend y backend. Las variables de conexión deben estar disponibles para Prisma. |
| `pnpm test` | Ejecuta todas las suites unitarias y E2E configuradas. La E2E del backend abre un puerto local y usa dobles para PostgreSQL. |

Para correr el backend directamente en Windows PowerShell, define las URLs en la sesión antes de arrancar:

```powershell
$env:DATABASE_URL = "postgresql://..."
$env:DATABASE_URL_UNPOOLED = "postgresql://..."
pnpm dev:backend
```

NestJS no carga automáticamente las variables del archivo `.env` al ejecutarse desde el host. Docker Compose sí las lee para interpolar las variables de los contenedores.

## Comandos del frontend

| Comando | Para qué sirve |
| --- | --- |
| `pnpm --filter kornspace-frontend dev` | Inicia Vite en modo desarrollo. |
| `pnpm --filter kornspace-frontend build` | Ejecuta la comprobación TypeScript y genera los archivos de producción en `frontend/dist/`. |
| `pnpm --filter kornspace-frontend test:unit` | Ejecuta las pruebas unitarias de i18n y preferencias de tema. |
| `pnpm --filter kornspace-frontend preview` | Sirve localmente el build de Vite para revisarlo; primero ejecuta el build. |

## Comandos del backend y Prisma

| Comando | Para qué sirve |
| --- | --- |
| `pnpm --filter kornspace-backend start` | Inicia NestJS sin el modo de observación. |
| `pnpm --filter kornspace-backend start:dev` | Inicia NestJS y reinicia al detectar cambios. |
| `pnpm --filter kornspace-backend start:prod` | Ejecuta `backend/dist/main.js`; requiere haber compilado antes. |
| `pnpm --filter kornspace-backend build` | Genera Prisma Client y compila NestJS. |
| `pnpm --filter kornspace-backend prisma:generate` | Regenera Prisma Client después de cambiar el esquema. |
| `pnpm --filter kornspace-backend prisma:migrate:dev --name agregar-descripcion` | Crea una migración desde los cambios de `backend/prisma/schema.prisma` y la aplica a la base de desarrollo. |
| `pnpm --filter kornspace-backend prisma:migrate:deploy` | Aplica migraciones versionadas pendientes; es el comando usado al iniciar el contenedor. |
| `pnpm --filter kornspace-backend prisma:migrate:status` | Muestra el estado de las migraciones en la base configurada. |
| `pnpm --filter kornspace-backend test:unit` | Ejecuta pruebas unitarias del ciclo de vida de `PrismaService`. |
| `pnpm --filter kornspace-backend test:e2e` | Ejecuta la prueba HTTP E2E de salud REST y GraphQL. |
| `pnpm --filter kornspace-backend test` | Ejecuta las pruebas unitarias y E2E del backend. |

Cada cambio en `backend/prisma/schema.prisma` debe incluir la migración creada con `prisma:migrate:dev`. Versiona los archivos de `backend/prisma/migrations/` junto al cambio. No uses `prisma db push` para sustituir migraciones compartidas. El esquema actual aún no define modelos de dominio, por lo que no hay tablas de archivos o usuarios que crear.

## Comandos de Docker Compose

| Comando | Para qué sirve |
| --- | --- |
| `docker compose up -d` | Inicia servicios ya construidos en segundo plano. |
| `docker compose up --build -d` | Reconstruye imágenes y actualiza el stack en segundo plano. |
| `docker compose up --build -d frontend` | Reconstruye e inicia el frontend. |
| `docker compose up --build -d backend` | Reconstruye e inicia el backend y sus dependencias. |
| `docker compose ps` | Muestra servicios y estado. |
| `docker compose logs -f backend` | Sigue los logs del backend; usa `frontend`, `nginx`, `redis`, `localstack` o `terraform` para otro servicio. |
| `docker compose logs --tail=100 backend` | Muestra las últimas 100 líneas del backend. |
| `docker compose restart backend` | Reinicia el proceso del backend sin reconstruir la imagen. |
| `docker compose exec backend sh` | Abre una shell dentro del contenedor del backend. |
| `docker compose exec backend pnpm prisma:migrate:status` | Consulta las migraciones usando las variables ya inyectadas al contenedor. |
| `docker compose exec localstack awslocal s3 ls` | Lista los buckets de LocalStack. |
| `docker compose run --rm terraform` | Vuelve a ejecutar `terraform init` y `terraform apply` para LocalStack. Úsalo después de cambiar los archivos Terraform. |
| `docker compose stop` | Detiene los contenedores sin eliminarlos. |
| `docker compose start` | Inicia contenedores previamente detenidos. |
| `docker compose down` | Detiene y elimina contenedores y red; conserva los volúmenes con datos. |
| `docker compose down -v` | También elimina los volúmenes de Redis y LocalStack; úsalo solo si quieres borrar esos datos locales. |

## Terraform y LocalStack

Los recursos de LocalStack viven en `infra/terraform/localstack/`. En la primera subida, Compose aplica Terraform automáticamente. Para reaplicarlo manualmente:

```sh
docker compose run --rm terraform
```

Si tienes Terraform instalado en el host, valida el formato con:

```sh
terraform fmt -check -recursive infra/terraform/localstack
```

Para comprobar el bucket desde el contenedor LocalStack:

```sh
docker compose exec localstack awslocal s3 ls
```

## PostgreSQL en Docker

El overlay `docker-compose.production.yml` agrega `postgres:17-alpine` con el volumen persistente `postgres_data`, configura el backend para usar esa base y ejecuta las migraciones al iniciar:

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml config --quiet
docker compose -f docker-compose.yml -f docker-compose.production.yml up --build -d
docker compose -f docker-compose.yml -f docker-compose.production.yml ps
docker compose -f docker-compose.yml -f docker-compose.production.yml logs -f backend postgres
```

Además de las variables de Neon requeridas por el Compose base, configura `POSTGRES_PASSWORD` y `POSTGRES_DATABASE_URL`. La URL debe apuntar a `postgres:5432` y coincidir con `POSTGRES_USER`, `POSTGRES_DB` y la contraseña. Codifica en formato URL los caracteres reservados de la contraseña.

Este overlay configura PostgreSQL y el backend en modo producción. El Compose base todavía usa Vite en modo desarrollo para el frontend y LocalStack para S3; adapta esos servicios y credenciales antes de desplegar el stack completo en producción.
