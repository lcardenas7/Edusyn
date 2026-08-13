import {
  Controller,
  Get,
  Query,
  Res,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { StorageService } from './storage.service';
import { SkipTenantCheck } from '../auth/decorators/skip-tenant-check.decorator';

/**
 * Controlador público para servir archivos estáticos de R2 sin autenticación.
 * Solo permite prefijos seguros (galeria/, firmas/) para evitar acceso
 * a archivos sensibles (boletines, evidencias, documentos, etc.).
 *
 * Uso desde el frontend:
 *   <img src="/api/storage/public?path=galeria/institucion/xxx/logo.png" />
 *
 * Cache: 1 hora en navegador + 24h stale-while-revalidate.
 */
@Controller('storage')
@SkipTenantCheck()
export class StoragePublicController {
  private static readonly ALLOWED_PREFIXES = ['galeria/', 'firmas/'];

  constructor(private readonly r2: StorageService) {}

  @Get('public')
  async servePublicFile(
    @Query('path') path: string,
    @Res() res: Response,
  ) {
    if (!path) {
      throw new BadRequestException('Se requiere el parámetro "path"');
    }

    // Sanitizar: no permitir path traversal
    if (path.includes('..') || path.startsWith('/')) {
      throw new BadRequestException('Ruta inválida');
    }

    const isAllowed = StoragePublicController.ALLOWED_PREFIXES.some(
      prefix => path.startsWith(prefix),
    );
    if (!isAllowed) {
      throw new BadRequestException(
        'Solo se permiten archivos de galería o firmas por esta ruta.',
      );
    }

    if (!this.r2.isConfigured()) {
      throw new NotFoundException('Storage no configurado');
    }

    try {
      const { body, contentType } = await this.r2.getObject(path);
      res.set({
        'Content-Type': contentType,
        'Content-Length': body.length.toString(),
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        // Este endpoint es público (solo galeria/ y firmas/). Helmet fija por defecto
        // Cross-Origin-Resource-Policy: same-origin, lo que impide que el front
        // (www.edusyn.co) cargue estas imágenes desde la API (api.edusyn.co) en <img>.
        // Se relaja SOLO aquí para permitir el uso cross-origin (logos del boletín, etc.).
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Access-Control-Allow-Origin': '*',
      });
      res.send(body);
    } catch (err: any) {
      if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) {
        throw new NotFoundException('Archivo no encontrado');
      }
      throw err;
    }
  }
}
