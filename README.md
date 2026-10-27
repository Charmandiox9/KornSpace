# KornSpace

Base para una plataforma de almacenamiento de archivos con React, NestJS y servicios locales contenerizados.

## Estructura

- `frontend/`: React + Vite.
- `backend/`: API NestJS.
- `pnpm-workspace.yaml` y `pnpm-lock.yaml`: workspace y lockfile compartidos.
- `infra/terraform/localstack/`: recursos de LocalStack declarados con Terraform.
- `infra/nginx/`: proxy inverso para la API y el frontend.
- `docker-compose.yml`: frontend, API, Redis y LocalStack S3.

## Desarrollo

Requiere Docker Compose y Node.js 20 o posterior.

LocalStack requiere un token de autenticación. Copia `.env.example` a `.env` y agrega tu `LOCALSTACK_AUTH_TOKEN`; el archivo `.env` está excluido de Git.

```sh
docker compose up --build
```

- Aplicación: http://localhost
- API: http://localhost/api/health
- Swagger (REST): http://localhost/api/docs
- GraphQL: http://localhost/graphql
- LocalStack: http://localhost:4566
- Redis: `localhost:6379`

Al iniciar el stack, Terraform aprovisiona el bucket `kornspace-files` en LocalStack. Para volver a aplicar cambios después de editar los archivos Terraform, ejecuta `docker compose run --rm terraform`. Nginx distribuye las conexiones entre las réplicas de la API con `least_conn`. Las credenciales de LocalStack son de desarrollo y no deben reutilizarse en producción.

REST queda destinado a operaciones de comando y transferencia de archivos, como crear carpetas, subir o descargar usando URLs prefirmadas, autenticación y verificaciones de salud. Swagger documenta estos endpoints en `/api/docs`. GraphQL (`/graphql`) se reserva para consultas de lectura flexibles sobre archivos, carpetas y metadatos; el binario del archivo no se transportará por GraphQL. Por ahora, ambos exponen una consulta de salud mínima mientras se construye el dominio de archivos.

Para desarrollo local con pnpm, instala todo el workspace desde la raíz con `pnpm install`. Luego ejecuta `pnpm dev:frontend` o `pnpm dev:backend`. La versión de pnpm está fijada en el `package.json` raíz y Docker instala desde el lockfile compartido.
## PostgreSQL y Prisma

En desarrollo, copia `.env.example` como `.env`, agrega tu token de LocalStack y configura las URLs de Neon:

- `DATABASE_URL`: cadena agrupada de Neon para las consultas de NestJS.
- `DATABASE_URL_UNPOOLED`: cadena directa de Neon para ejecutar migraciones. Usa el host sin `-pooler`.

El backend aplica las migraciones pendientes al iniciar el contenedor mediante `prisma migrate deploy`. Para crear una migración luego de modificar `backend/prisma/schema.prisma`, ejecuta:

```sh
pnpm --filter kornspace-backend prisma:migrate:dev --name nombre-descriptivo
```

Versiona el archivo SQL generado junto con el cambio de esquema. No se deben ejecutar migraciones contra una base Neon de producción desde el flujo de desarrollo.

Para usar la imagen oficial de PostgreSQL 17 para la base de datos en el entorno Compose de producción, configura `POSTGRES_PASSWORD` y `POSTGRES_DATABASE_URL` en `.env` y arranca con:

```sh
docker compose -f docker-compose.yml -f docker-compose.production.yml up --build -d
```

La URL de PostgreSQL debe apuntar al servicio `postgres` y usar el mismo usuario, base y contraseña configurados en `POSTGRES_USER`, `POSTGRES_DB` y `POSTGRES_PASSWORD`. Codifica los caracteres reservados de la contraseña en formato URL. La imagen de PostgreSQL persiste sus datos en el volumen `postgres_data`.
