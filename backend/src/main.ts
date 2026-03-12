import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Global route prefix ───────────────────────────────────────────────────
  // NGINX routes /api/* → this service, so all endpoints sit under /api
  app.setGlobalPrefix('api');

  // ── Helmet ────────────────────────────────────────────────────────────────
  // Adds a suite of HTTP security headers (X-Frame-Options, HSTS, etc.)
  // Relax CSP in development so Swagger UI scripts can execute.
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
    }),
  );

  // ── CORS ──────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  });

  // ── Global validation pipe ────────────────────────────────────────────────
  // • whitelist: strips any properties not defined on the DTO
  // • forbidNonWhitelisted: throws 400 if unexpected properties are sent
  // • transform: auto-converts plain objects to DTO class instances
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ── Swagger ───────────────────────────────────────────────────────────────
  // Only mounted outside production. In production, protect with a reverse
  // proxy basic-auth rule or a dedicated ApiKeyGuard if you need it live.
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('API')
      .setDescription('REST API – auto-generated documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    // Available at: http://localhost:3000/api/docs
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`[bootstrap] Application listening on port ${port}`);
  console.log(`[bootstrap] NODE_ENV = ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap();
