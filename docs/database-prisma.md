# PostgreSQL y Prisma

Prisma Client es el único ORM del backend y `PrismaService` centraliza el cliente. El esquema está en `backend/prisma/schema.prisma`; las migraciones versionadas, en `backend/prisma/migrations/`.

## Comandos

Desde la raíz, los scripts cargan automáticamente el `.env` raíz:

```sh
pnpm prisma:generate
pnpm prisma:migrate:dev --name nombre-descriptivo
pnpm prisma:migrate:deploy
pnpm prisma:migrate:status
```

- `generate`: regenera los tipos y Prisma Client.
- `migrate:dev`: crea una migración con nombre y la aplica a la base de desarrollo.
- `migrate:deploy`: aplica migraciones existentes; lo ejecuta el entrypoint de Docker antes de iniciar NestJS.
- `migrate:status`: muestra el estado de las migraciones.

Los mismos scripts pueden ejecutarse desde `backend/`.

## Cambiar el esquema

1. Edita `backend/prisma/schema.prisma`.
2. Con la base de desarrollo disponible, ejecuta `pnpm prisma:migrate:dev --name nombre-descriptivo`.
3. Revisa y versiona el nuevo directorio de `backend/prisma/migrations/` junto al esquema.
4. Ejecuta build y pruebas.

No uses `prisma db push` para sustituir migraciones versionadas ni edites una migración aplicada en un entorno compartido.

## Conexiones

- `DATABASE_URL`: conexión agrupada de Neon para consultas de la aplicación.
- `DATABASE_URL_UNPOOLED`: conexión directa utilizada por Prisma Migrate. En PostgreSQL autogestionado puede apuntar a la misma conexión directa.
- El overlay Compose reemplaza ambas con `POSTGRES_DATABASE_URL`, que apunta al servicio `postgres`.

El backend aplica `prisma migrate deploy` al arrancar. Si falla, revisa los logs del backend y confirma que la URL corresponde a la base del modo activo.
