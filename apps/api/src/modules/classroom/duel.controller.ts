import { Body, Controller, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClassroomActor } from './classroom-tenant-access.service';
import { DuelService } from './duel.service';

@Controller('classroom-duels')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DuelController {
  constructor(private readonly service: DuelService, private readonly prisma: PrismaService) {}

  private async actor(req: any): Promise<ClassroomActor> {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    const raw = req.user?.roles;
    const roles = Array.isArray(raw) ? raw.map((role: any) => typeof role === 'string' ? role : role?.role?.name || role?.name).filter(Boolean) : [];
    return { userId: req.user.id, institutionId, roles, isSuperAdmin: req.user?.isSuperAdmin === true };
  }

  @Get('classrooms/:classroomId')
  @Roles('DOCENTE', 'ESTUDIANTE')
  dashboard(@Param('classroomId') classroomId: string, @Request() req: any) {
    return this.actor(req).then((actor) => this.service.dashboard(actor, classroomId));
  }

  @Get('classrooms/:classroomId/status')
  @Roles('DOCENTE', 'ESTUDIANTE')
  status(@Param('classroomId') classroomId: string, @Request() req: any) {
    return this.actor(req).then((actor) => this.service.status(actor, classroomId));
  }

  @Get('classrooms/:classroomId/ranking')
  @Roles('DOCENTE', 'ESTUDIANTE')
  ranking(@Param('classroomId') classroomId: string, @Query('scope') scope: string, @Request() req: any) {
    const valid = scope === 'grade' || scope === 'general' ? scope : 'group';
    return this.actor(req).then((actor) => this.service.ranking(actor, classroomId, valid));
  }

  @Get('classrooms/:classroomId/me')
  @Roles('ESTUDIANTE')
  profile(@Param('classroomId') classroomId: string, @Request() req: any) {
    return this.actor(req).then((actor) => this.service.profile(actor, classroomId));
  }

  @Put('classrooms/:classroomId/sources/:activityId')
  @Roles('DOCENTE')
  setSource(@Param('classroomId') classroomId: string, @Param('activityId') activityId: string, @Body() body: { enabled: boolean }, @Request() req: any) {
    return this.actor(req).then((actor) => this.service.setSource(actor, classroomId, activityId, body?.enabled));
  }

  @Post('classrooms/:classroomId')
  @Roles('ESTUDIANTE')
  invite(@Param('classroomId') classroomId: string, @Body() body: { opponentEnrollmentId?: string; category?: string; selectionMode?: string; rivalMode?: string }, @Request() req: any) {
    return this.actor(req).then((actor) => this.service.invite(actor, classroomId, body?.opponentEnrollmentId, { category: body?.category, selectionMode: body?.selectionMode, rivalMode: body?.rivalMode }));
  }

  @Get(':duelId')
  @Roles('ESTUDIANTE')
  get(@Param('duelId') duelId: string, @Request() req: any) {
    return this.actor(req).then((actor) => this.service.get(actor, duelId));
  }

  @Post(':duelId/accept')
  @Roles('ESTUDIANTE')
  accept(@Param('duelId') duelId: string, @Request() req: any) {
    return this.actor(req).then((actor) => this.service.respond(actor, duelId, true));
  }

  @Post(':duelId/decline')
  @Roles('ESTUDIANTE')
  decline(@Param('duelId') duelId: string, @Request() req: any) {
    return this.actor(req).then((actor) => this.service.respond(actor, duelId, false));
  }

  @Post(':duelId/answers')
  @Roles('ESTUDIANTE')
  answer(@Param('duelId') duelId: string, @Body() body: { ordinal: number; answer: string }, @Request() req: any) {
    return this.actor(req).then((actor) => this.service.answer(actor, duelId, body?.ordinal, body?.answer));
  }

  @Post(':duelId/power')
  @Roles('ESTUDIANTE')
  usePower(@Param('duelId') duelId: string, @Body() body: { ordinal: number; kind?: string; category?: string }, @Request() req: any) {
    const kind = body?.kind === 'CATEGORY' ? 'CATEGORY' : 'FIFTY';
    return this.actor(req).then((actor) => this.service.usePower(actor, duelId, body?.ordinal, kind, body?.category));
  }
}
