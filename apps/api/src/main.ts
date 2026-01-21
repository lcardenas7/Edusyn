import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🔐 CORS
  app.enableCors({
    origin: [
      'https://web-production-8237c.up.railway.app',
    ],
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

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
