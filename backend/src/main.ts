import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildAppConfig, validateConfig } from './config/app.config';

async function bootstrap(): Promise<void> {
  // Validate config at startup so missing env vars are immediately obvious.
  const config = buildAppConfig();
  validateConfig(config);

  const app = await NestFactory.create(AppModule);

  // Allow the admin UI (dev: localhost:5173, prod: set CORS_ORIGIN) to call the API.
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  app.enableCors({ origin: corsOrigin, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // Swagger / OpenAPI — available at /api
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AI Receptionist API')
    .setDescription(
      'Backend for a multi-property AI receptionist powered by WhatsApp and configurable LLMs. ' +
      'Admin endpoints are protected by the X-Admin-Key header when ADMIN_API_KEY is set.',
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-admin-key', in: 'header' }, 'AdminKey')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);

  app.enableShutdownHooks();

  await app.listen(config.port);
  console.log(`Server running on port ${config.port} — Swagger at http://localhost:${config.port}/api`);
}

void bootstrap();
