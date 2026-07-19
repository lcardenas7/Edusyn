import { Body, Controller, Delete, Get, Param, Post, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';
import { TallerService } from './taller.service';

// ═══════════════════════════════════════════════════════════════════════════
// EL TALLER — API del núcleo (Objetos + Grafo + Eventos) y del Motor Board.
// ═══════════════════════════════════════════════════════════════════════════

@Controller('taller')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TallerController {
  constructor(
    private readonly service: TallerService,
    private readonly prisma: PrismaService,
  ) {}

  private async ctx(req: any) {
    const userId = req.user.id;
    const institutionId = await resolveInstitutionId(this.prisma as any, req);
    if (!institutionId) throw new Error('No se pudo resolver la institución');
    return { userId, institutionId };
  }

  // Resuelve (o crea) el instrumento de un equipo: motor + dinámica + estación.
  @Post('instruments/resolve')
  @Roles('ESTUDIANTE', 'DOCENTE', 'COORDINADOR')
  async resolve(@Request() req: any, @Body() body: { teamId: string; motor: string; dynamic?: string; stationId?: string; title?: string }) {
    return this.service.resolveInstrument(await this.ctx(req), body);
  }

  // Estado del instrumento: objetos vivos + votos + comentarios + quién soy.
  @Get('instruments/:id')
  @Roles('ESTUDIANTE', 'DOCENTE', 'COORDINADOR')
  async state(@Param('id') id: string, @Request() req: any) {
    return this.service.getInstrumentState(await this.ctx(req), id);
  }

  // Crear objeto (post-it / idea) en el instrumento.
  @Post('instruments/:id/objects')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async createObject(@Param('id') id: string, @Request() req: any, @Body() body: { type?: string; text?: string; colorId?: number; x?: number; y?: number }) {
    return this.service.createObject(await this.ctx(req), id, body);
  }

  // Editar objeto (texto/color/posición) con CAS opcional por versión.
  @Patch('objects/:id')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async updateObject(@Param('id') id: string, @Request() req: any, @Body() body: { text?: string; colorId?: number; x?: number; y?: number; version?: number }) {
    return this.service.updateObject(await this.ctx(req), id, body);
  }

  // Borrado suave.
  @Delete('objects/:id')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async deleteObject(@Param('id') id: string, @Request() req: any) {
    return this.service.deleteObject(await this.ctx(req), id);
  }

  // Votar / quitar voto (toggle).
  @Post('objects/:id/vote')
  @Roles('ESTUDIANTE')
  async vote(@Param('id') id: string, @Request() req: any) {
    return this.service.toggleVote(await this.ctx(req), id);
  }

  // Comentar un objeto.
  @Post('objects/:id/comments')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async comment(@Param('id') id: string, @Request() req: any, @Body() body: { text: string }) {
    return this.service.addComment(await this.ctx(req), id, body?.text ?? '');
  }

  // Timeline del equipo (memoria narrativa; fuente = log de eventos).
  @Get('teams/:teamId/timeline')
  @Roles('ESTUDIANTE', 'DOCENTE', 'COORDINADOR')
  async timeline(@Param('teamId') teamId: string, @Request() req: any, @Query('limit') limit?: string) {
    return this.service.teamTimeline(await this.ctx(req), teamId, limit ? parseInt(limit, 10) : 50);
  }
}
