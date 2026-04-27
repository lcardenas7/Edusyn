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

  // 🔐 CORS — los dominios de producción siempre están permitidos,
  // CORS_ORIGINS solo agrega orígenes extra (ej. dev tuneles)
  const ALWAYS_ALLOWED = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://web-production-8237c.up.railway.app',
    'https://edusyn.up.railway.app',
    'https://www.edusyn.co',
    'https://edusyn.co',
  ];
  const extraOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [];
  const corsOrigins = [...new Set([...ALWAYS_ALLOWED, ...extraOrigins])];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // 🌐 Prefijo global
  app.setGlobalPrefix('api');

  // 📡 SSE — deshabilitar buffering de nginx/Railway para streams de eventos
  // Sin este header, Railway/nginx almacena en buffer el stream y devuelve 502
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use((req: any, res: any, next: any) => {
    if (req.url?.includes('/stream')) {
      const origin = req.headers.origin;
      if (origin && corsOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      res.setHeader('X-Accel-Buffering', 'no');
      res.setHeader('Cache-Control', 'no-cache');
    }
    next();
  });

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
