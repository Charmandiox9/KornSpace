# Docker e infraestructura local

## Servicios del Compose base

| Servicio | Función |
| --- | --- |
| `frontend` | Vite de desarrollo; proxy hacia el backend. |
| `backend` | NestJS con recarga; aplica migraciones antes de arrancar. |
| `redis` | Redis 7 con persistencia AOF. |
| `localstack` | Emula S3 y SQS en el puerto `4566`. |
| `terraform` | Espera LocalStack saludable y aprovisiona los recursos. |
| `nginx` | Proxy para frontend, REST y GraphQL en el puerto `80`; acepta cargas de hasta 100 MiB. |

Terraform en `infra/terraform/localstack/` crea el bucket privado `kornspace-files` y la cola `kornspace-file-processing`. Se ejecuta automáticamente al levantar Compose. Para volver a aplicarlo tras cambiar Terraform:

```sh
docker compose run --rm terraform
```

Comprobar S3/SQS:

```sh
docker compose exec localstack awslocal s3 ls
docker compose exec localstack awslocal sqs list-queues
```

## Overlay de producción

`docker-compose.production.yml` agrega PostgreSQL 17 con el volumen persistente `postgres_data` y cambia el backend a la imagen compilada y `NODE_ENV=production`. No cambia Nginx, LocalStack ni Vite: el frontend sigue en desarrollo y los binarios siguen en LocalStack. No es un despliegue público de producción completo.

## Ciclo de vida

```sh
docker compose ps
docker compose logs -f backend
docker compose restart backend
docker compose stop
docker compose start
docker compose down
```

Para el overlay, agrega `-f docker-compose.yml -f docker-compose.production.yml` a los comandos. `down` elimina contenedores y red, pero conserva volúmenes. `down -v` borra los volúmenes definidos por la configuración activa; para borrar PostgreSQL Docker, usa ambos archivos Compose con `down -v`.

Los modos publican los mismos puertos; detén el modo activo con su configuración antes de cambiar. Neon y PostgreSQL Docker son bases separadas y no sincronizan sus datos.

## Volúmenes

- `workspace_node_modules`, `frontend_node_modules`, `backend_node_modules_prisma`: dependencias de pnpm.
- `redis_data`: datos persistentes de Redis.
- `localstack_data`: datos persistentes de LocalStack.
- `postgres_data`: datos PostgreSQL del overlay.
