import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { OperationLoggingInterceptor } from './common/interceptors/operation-logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: [process.env.FRONTEND_ORIGIN ?? 'http://localhost', 'http://localhost:5173'],
    credentials: true,
  });

  if ((process.env.NODE_ENV ?? 'development') === 'development') {
    app.useGlobalInterceptors(new OperationLoggingInterceptor());
  }

  const openApiConfig = new DocumentBuilder()
    .setTitle('KornSpace REST API')
    .setDescription('Endpoints REST para operaciones y transferencia de archivos.')
    .setVersion('0.1.0')
    .addApiKey({ type: 'apiKey', in: 'cookie', name: 'kornspace_access' }, 'kornspace-access')
    .addApiKey({ type: 'apiKey', in: 'cookie', name: 'kornspace_session' }, 'kornspace-session')
    .build();
  const openApiDocument = SwaggerModule.createDocument(app, openApiConfig);
  SwaggerModule.setup('docs', app, openApiDocument, { useGlobalPrefix: true });

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}

void bootstrap();
