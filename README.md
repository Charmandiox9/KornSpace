# KornSpace

Plataforma de almacenamiento en desarrollo. React, NestJS, PostgreSQL/Prisma, Redis, LocalStack S3/SQS, Terraform y Nginx.

## Guías

- [Puesta en marcha y modos Compose](docs/getting-started.md)
- [OAuth de Google y sesiones](docs/auth-google.md)
- [Frontend React](docs/frontend.md)
- [Backend NestJS y API](docs/backend.md)
- [PostgreSQL y Prisma](docs/database-prisma.md)
- [Docker, LocalStack, Terraform y Nginx](docs/docker-infra.md)

## Comandos habituales

```sh
# Instalar dependencias
pnpm install

# Desarrollo con recarga automática
pnpm dev

# Ejecutar imágenes de producción
docker compose up --build -d

# Compilar y probar
pnpm build
pnpm test

# Comandos Prisma (desde la raíz)
pnpm prisma:generate
pnpm prisma:migrate:status
```

Consulta la guía de [puesta en marcha](docs/getting-started.md) para configurar `.env` y levantar el overlay de producción.

## Imágenes y desarrollo local

Frontend y backend no montan código ni volúmenes de `node_modules`. Las dependencias, el cliente Prisma y el código compilado están incluidos en las imágenes. Tras cambiar código, dependencias o esquema Prisma (con su migración), ejecuta `docker compose up --build -d`. Reiniciar un contenedor no reconstruye su imagen.

Para desarrollo, ejecuta `pnpm install` y `pnpm dev` desde la raíz. Este comando genera Prisma y arranca Next.js y NestJS con recarga automática. Puedes levantar la infraestructura con `docker compose up -d redis terraform`. Configura `.env` con los endpoints accesibles desde el equipo (`REDIS_HOST=localhost`, S3/SQS en `http://localhost:4566`, URL de la cola accesible desde el equipo y `FRONTEND_ORIGIN=http://localhost:3001`).
