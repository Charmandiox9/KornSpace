# Guía para agentes de KornSpace

## Estructura del proyecto

- `frontend/` contiene la SPA de React, construida con Vite y TypeScript. Vite es una herramienta de desarrollo y compilación, no un framework de aplicación.
- `backend/` contiene la API de NestJS.
- `backend/prisma/` contiene el esquema PostgreSQL y el historial versionado de migraciones de Prisma.
- `infra/nginx/` contiene la configuración del proxy inverso.
- `infra/terraform/localstack/` es la fuente de verdad de los recursos aprovisionados en LocalStack.
- `docker-compose.yml` coordina el entorno local.
- `pnpm-workspace.yaml` y `pnpm-lock.yaml` en la raíz definen el workspace de paquetes.

Realiza los cambios en el área responsable. Coloca la configuración compartida entre servicios en Compose o en `infra/`. Mantén el transporte HTTP y GraphQL en NestJS y la lógica de dominio compartida en servicios.

## Convenciones de trabajo

- Usa pnpm desde la raíz del repositorio. El `package.json` raíz fija la versión del gestor. Actualiza `pnpm-lock.yaml` cada vez que cambien las dependencias y no añadas lockfiles de npm o Yarn.
- Mantén TypeScript en modo estricto tanto en frontend como en backend. No uses `any`; representa datos externos como `unknown` y valídalos antes de utilizarlos.
- Declara interfaces para contratos y estructuras de datos reutilizadas, incluidas props, solicitudes, respuestas y servicios. Cuando un framework requiera metadatos en tiempo de ejecución, como DTOs de NestJS o tipos de GraphQL, usa clases concretas y conserva las interfaces para los contratos TypeScript que correspondan.
- Aplica Clean Code y principios SOLID: nombres claros, módulos cohesionados, dependencias explícitas y responsabilidades acotadas. Evita abstracciones que no resuelvan una necesidad real.
- Usa TypeScript y respeta las convenciones existentes de nombres y módulos. Escribe identificadores y comentarios de código en inglés; redacta en español el texto de la interfaz y la documentación, salvo que el usuario pida otro idioma.
- La interfaz debe admitir varios idiomas, inicialmente español e inglés. Usa claves de traducción y catálogos tipados separados del marcado; no dejes texto visible al usuario incrustado directamente en componentes, incluidos títulos, descripciones y etiquetas accesibles. Ofrece un control visible para cambiar idioma y conserva la preferencia. Mantén la solución compatible con React sin dependencias externas, salvo autorización expresa para añadir una biblioteca i18n.
- La interfaz debe ofrecer temas claro y oscuro. Usa variables CSS, respeta el tema del sistema al iniciar si no hay preferencia guardada, permite cambiarlo desde un control accesible y conserva la selección.
- Mantén una identidad visual coherente con KornBeat: acentos azul violeta y púrpura, gradientes discretos en elementos de marca, superficies limpias, tarjetas con bordes suaves y sombras contenidas. Adapta el lenguaje visual a una plataforma formal de almacenamiento; evita copiar fondos musicales, controles de reproducción o efectos decorativos que no correspondan al producto. Comprueba contraste y legibilidad en ambos temas.
- Mantén el frontend basado únicamente en React: no añadas frameworks de aplicación, kits de componentes o UI, routers, gestores de estado, bibliotecas para consultar datos ni bibliotecas de estilos. Usa React/ReactDOM, APIs del navegador y CSS plano. Vite y TypeScript forman parte de las herramientas de desarrollo y compilación. Consulta al usuario antes de incorporar otra dependencia al frontend.
- Mantén secretos y configuración propia de cada equipo en variables de entorno. No incluyas credenciales, tokens, claves privadas ni archivos `.env` en Git. Actualiza `.env.example` cuando añadas variables obligatorias.
- Prefiere cambios pequeños y enfocados que conserven el comportamiento existente. Reutiliza servicios de dominio para que REST y GraphQL compartan validaciones, autorización y reglas de negocio.
- Antes de cambiar una interfaz, un recurso o una dependencia, revisa la configuración pertinente y el código cercano.

## Límites de las API

- Usa REST para comandos e integraciones que se beneficien de recursos HTTP explícitos: autenticación y sesiones, verificaciones de salud, cambios en archivos y carpetas, carga y descarga, y emisión de URLs prefirmadas.
- Implementa el inicio de sesión con Google OAuth 2.0 / OpenID Connect. Guarda las credenciales OAuth en variables de entorno, valida la respuesta de autorización y usa una sesión opaca del lado del servidor. No expongas tokens del proveedor en el almacenamiento del navegador.
- Documenta todos los endpoints REST públicos con decoradores de Swagger y DTO tipados para solicitudes y respuestas. Mantén la configuración de OpenAPI en `backend/src/main.ts` y comprueba que la ruta documentada coincida al añadir o modificar endpoints.
- Usa GraphQL para consultas flexibles de metadatos de archivos y carpetas, como contenido de carpetas, resultados de búsqueda y metadatos anidados. Mantén ligeros los resolvers y delega en los mismos servicios de dominio que utiliza REST.
- Transfiere el contenido de los archivos mediante almacenamiento compatible con S3 o URLs prefirmadas; no envíes archivos binarios por GraphQL.
- Conserva GraphQL en `/graphql` y las rutas REST bajo el prefijo global `/api`, salvo que el usuario cambie la organización de la API.

## Almacenamiento e infraestructura

- Guarda los archivos binarios en almacenamiento compatible con S3. Guarda en PostgreSQL la propiedad, las relaciones entre carpetas, los nombres, los permisos y otros metadatos consultables.
- Usa Redis mediante una integración compartida con NestJS para la caché y el almacenamiento de sesiones del lado del servidor. Define el TTL y la invalidación de cada entrada de caché. Evita repartir accesos directos a Redis entre controladores y resolvers.
- Usa Prisma como único ORM para acceder a PostgreSQL desde NestJS. Centraliza el cliente en `PrismaService` y su módulo; no crees clientes Prisma independientes en controladores o resolvers.
- Ante cada cambio en `backend/prisma/schema.prisma`, crea y versiona la migración correspondiente con `prisma migrate dev --name <nombre-descriptivo>`. No edites migraciones ya aplicadas ni uses `prisma db push` como sustituto en entornos compartidos.
- Usa `DATABASE_URL` para el tráfico normal de la aplicación y `DATABASE_URL_UNPOOLED` para migraciones de Neon. En PostgreSQL autogestionado, la segunda variable puede apuntar a la misma conexión directa.
- El contenedor del backend debe ejecutar `prisma migrate deploy` antes de arrancar NestJS. En producción, usa la imagen oficial de PostgreSQL configurada en `docker-compose.production.yml`, persistencia de datos y secretos suministrados por variables de entorno.
- Aprovisiona los recursos de LocalStack mediante Terraform en `infra/terraform/localstack/`. No crees los mismos recursos desde scripts de inicio de la aplicación ni desde el código del backend.
- Mantén el enrutamiento del proxy en `infra/nginx/` y la conexión entre servicios en `docker-compose.yml`. Conserva los nombres DNS internos al enrutar entre servicios de Compose.
- Usa credenciales y valores predeterminados de LocalStack sólo para desarrollo local. Exige configuración explícita para credenciales de nube reales o endpoints de producción.

## Comprobaciones útiles

Ejecuta las comprobaciones pertinentes al área modificada e informa sus resultados con precisión:

- `pnpm --filter kornspace-frontend build`
- `pnpm --filter kornspace-frontend test:unit`
- `pnpm --filter kornspace-backend build`
- `pnpm test` (suite unitaria y E2E configurada en el workspace)
- `pnpm --filter kornspace-backend prisma:migrate:status`
- `docker compose config --quiet`
- `terraform fmt -check -recursive infra/terraform/localstack`

Usa los scripts de `package.json` en la raíz como fuente de verdad para los comandos del workspace. No afirmes que un servicio está operativo basándote únicamente en una compilación correcta o en la validación de Compose.

## Pruebas

- Añade pruebas unitarias para la lógica de negocio y pruebas E2E para flujos importantes que se incorporen o cambien de forma sustancial.
- Cubre los casos de éxito, validaciones, permisos y errores relevantes al comportamiento modificado. Mantén las pruebas deterministas y evita depender de servicios externos reales; usa dobles o servicios locales configurados para pruebas.
- Para cada funcionalidad nueva, antes de crear el commit, compila frontend y backend y ejecuta la suite completa de pruebas unitarias y E2E configurada.
- Si una compilación o prueba falla, diagnostica y corrige el problema; vuelve a ejecutar las comprobaciones hasta que todas pasen.
- Crea un commit por cada funcionalidad nueva sólo después de que ambas compilaciones y toda la suite de pruebas hayan pasado. Si falta una suite o no se puede ejecutar, no hagas el commit: informa el motivo y deja el trabajo listo para continuar.

## Decisiones que requieren criterio del producto

Consulta al usuario cuando una decisión afecte los datos persistidos, el control de acceso, la retención, el gasto en servicios externos o un flujo visible, y el repositorio aún no la haya definido. PostgreSQL para los metadatos y Google OAuth 2.0 con sesiones y caché en Redis ya son decisiones del proyecto. Resuelve los detalles habituales de implementación usando el código existente y esta guía.
