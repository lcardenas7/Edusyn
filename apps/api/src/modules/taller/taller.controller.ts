import { Body, Controller, Delete, Get, Param, Post, Patch, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { TallerService } from './taller.service';
import { INSTRUMENT_CATALOG, INSTRUMENT_INTENTS } from './taller.catalog';

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

  // Biblioteca de Instrumentos: catálogo declarativo agrupable por intención.
  @Get('catalog')
  @Roles('ESTUDIANTE', 'DOCENTE', 'COORDINADOR')
  catalog() {
    return { intents: INSTRUMENT_INTENTS, instruments: INSTRUMENT_CATALOG };
  }

  // Resuelve (o crea) el instrumento de un equipo: motor + dinámica + estación.
  @Post('instruments/resolve')
  @Roles('ESTUDIANTE', 'DOCENTE', 'COORDINADOR')
  async resolve(@Request() req: any, @Body() body: { teamId: string; motor: string; dynamic?: string; stationId?: string; title?: string }) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.resolveInstrument({ userId: req.user.id, institutionId }, body);
  }

  // Estado del instrumento: objetos vivos + votos + comentarios + quién soy.
  @Get('instruments/:id')
  @Roles('ESTUDIANTE', 'DOCENTE', 'COORDINADOR')
  async state(@Param('id') id: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.getInstrumentState({ userId: req.user.id, institutionId }, id);
  }

  // Crear objeto (post-it / idea) en el instrumento; con parentId cuelga del padre (Graph).
  @Post('instruments/:id/objects')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async createObject(@Param('id') id: string, @Request() req: any, @Body() body: { type?: string; text?: string; colorId?: number; x?: number; y?: number; parentId?: string; date?: string; fields?: Record<string, any> }) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.createObject({ userId: req.user.id, institutionId }, id, body);
  }

  // Editar objeto (texto/color/posición) con CAS opcional por versión.
  @Patch('objects/:id')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async updateObject(@Param('id') id: string, @Request() req: any, @Body() body: { text?: string; colorId?: number; x?: number; y?: number; version?: number; date?: string; fields?: Record<string, any> }) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.updateObject({ userId: req.user.id, institutionId }, id, body);
  }

  // Borrado suave.
  @Delete('objects/:id')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async deleteObject(@Param('id') id: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.deleteObject({ userId: req.user.id, institutionId }, id);
  }

  // Votar / quitar voto (toggle).
  @Post('objects/:id/vote')
  @Roles('ESTUDIANTE')
  async vote(@Param('id') id: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.toggleVote({ userId: req.user.id, institutionId }, id);
  }

  // Comentar un objeto.
  @Post('objects/:id/comments')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async comment(@Param('id') id: string, @Request() req: any, @Body() body: { text: string }) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.addComment({ userId: req.user.id, institutionId }, id, body?.text ?? '');
  }

  // Conexión LIBRE entre dos piezas del mismo instrumento (Mapa de Actores).
  @Post('relations')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async connect(@Request() req: any, @Body() body: { fromId: string; toId: string; relType?: string; label?: string }) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.connectObjects({ userId: req.user.id, institutionId }, body);
  }

  @Delete('relations/:id')
  @Roles('ESTUDIANTE', 'DOCENTE')
  async disconnect(@Param('id') id: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.disconnectObjects({ userId: req.user.id, institutionId }, id);
  }

  // Timeline del equipo (memoria narrativa; fuente = log de eventos).
  @Get('teams/:teamId/timeline')
  @Roles('ESTUDIANTE', 'DOCENTE', 'COORDINADOR')
  async timeline(@Param('teamId') teamId: string, @Request() req: any, @Query('limit') limit?: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.teamTimeline({ userId: req.user.id, institutionId }, teamId, limit ? parseInt(limit, 10) : 50);
  }
}
