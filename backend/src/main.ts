import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { CustomOrigin } from '@nestjs/common/interfaces/external/cors-options.interface';
import { AppModule } from './app.module';
import { OperationLoggingInterceptor } from './common/interceptors/operation-logging.interceptor';

async function bootstrap() {
  const environment = process.env.NODE_ENV ?? 'development';
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT debe ser un número entero entre 1 y 65535.');
  }

  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  app.setGlobalPrefix('api');

  const configuredOrigins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const developmentOrigins =
    environment === 'development'
      ? ['http://localhost:5173', 'http://127.0.0.1:5173']
      : [];
  const allowedOrigins = new Set([...configuredOrigins, ...developmentOrigins]);
  const validateCorsOrigin: CustomOrigin = (origin, callback) => {
    callback(null, origin === undefined || allowedOrigins.has(origin));
  };
  app.enableCors({
    origin: validateCorsOrigin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  );
  app.enableShutdownHooks();

  if (environment === 'development') {
    app.useGlobalInterceptors(new OperationLoggingInterceptor());
  }

  const openApiConfig = new DocumentBuilder()
    .setTitle('KornSpace REST API')
    .setDescription(
      'Endpoints REST para operaciones y transferencia de archivos.',
    )
    .setVersion('0.1.0')
    .addApiKey(
      { type: 'apiKey', in: 'cookie', name: 'kornspace_access' },
      'kornspace-access',
    )
    .addApiKey(
      { type: 'apiKey', in: 'cookie', name: 'kornspace_session' },
      'kornspace-session',
    )
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup('docs', app, openApiDocument, { useGlobalPrefix: true });

  await app.listen(port, '0.0.0.0');
  logger.log(`Environment: ${environment}`);
  logger.log(`Backend listening on port ${port}`);
  logger.log('REST API: /api');
  logger.log('Swagger: /api/docs');
  logger.log('GraphQL: /graphql');
}

void bootstrap();
