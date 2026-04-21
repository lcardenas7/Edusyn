import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🛡️ Headers de seguridad (X-Content-Type-Options, X-Frame-Options, etc.)
  app.use(helmet());

  // 📏 Configurar límites de tamaño (reducido a 10MB para evitar picos de memoria)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // 🔐 CORS
  const corsOrigins = (process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://web-production-8237c.up.railway.app',
        'https://edusyn.up.railway.app',
        'https://www.edusyn.co',
        'https://edusyn.co',
      ]
  )
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // 🌐 Prefijo global
  app.setGlobalPrefix('api');

  // ✅ Validaciones
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // 🔄 Graceful shutdown — cierra Prisma, SSE streams, etc. al recibir SIGTERM
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
