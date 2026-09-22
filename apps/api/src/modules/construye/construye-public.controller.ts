import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SkipTenantCheck } from '../auth/decorators/skip-tenant-check.decorator';
import { ConstruyePublicationService } from './construye-publication.service';

/**
 * Apps publicadas de Edusyn Crea, para el servicio crea-apps (sin sesión). Solo existen dos
 * operaciones: leer la app APROBADA por su token (una copia, nunca el proyecto) y registrar uso
 * anónimo. No hay institución que resolver: el token identifica una sola app.
 */
@Controller('public/crea-apps')
@SkipTenantCheck()
export class ConstruyePublicController {
  constructor(private readonly publications: ConstruyePublicationService) {}

  @Get(':token')
  @Throttle({ default: { ttl: 60000, limit: 120 } })
  async app(@Param('token') token: string) {
    return this.publications.publicApp(token);
  }

  @Post(':token/events')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 240 } })
  async event(@Param('token') token: string, @Body() body: any) {
    return this.publications.recordEvent(token, body);
  }
}
