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

# Levantar desarrollo
docker compose up --build -d

# Compilar y probar
pnpm build
pnpm test

# Comandos Prisma (desde la raíz)
pnpm prisma:generate
pnpm prisma:migrate:status
```

Consulta la guía de [puesta en marcha](docs/getting-started.md) para configurar `.env` y levantar el overlay de producción.
