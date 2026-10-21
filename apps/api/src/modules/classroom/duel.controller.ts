import { Body, Controller, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ValidateTenantContextGuard } from '../../common/guards/validate-tenant-context.guard';
import { ClassroomActor } from './classroom-tenant-access.service';
import { DuelService } from './duel.service';

@Controller('classroom-duels')
@UseGuards(JwtAuthGuard, RolesGuard, ValidateTenantContextGuard)
export class DuelController {
  constructor(private readonly service: DuelService, private readonly prisma: PrismaService) {}

  private actor(req: any, institutionId: string): ClassroomActor {
    const raw = req.user?.roles;
    const roles = Array.isArray(raw) ? raw.map((role: any) => typeof role === 'string' ? role : role?.role?.name || role?.name).filter(Boolean) : [];
    return { userId: req.user.id, institutionId, roles, isSuperAdmin: req.user?.isSuperAdmin === true };
  }

  @Get('classrooms/:classroomId')
  @Roles('DOCENTE', 'ESTUDIANTE')
  async dashboard(@Param('classroomId') classroomId: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.service.dashboard(this.actor(req, institutionId), classroomId);
  }

  @Get('classrooms/:classroomId/status')
  @Roles('DOCENTE', 'ESTUDIANTE')
  async status(@Param('classroomId') classroomId: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.service.status(this.actor(req, institutionId), classroomId);
  }

  @Get('classrooms/:classroomId/ranking')
  @Roles('DOCENTE', 'ESTUDIANTE')
  async ranking(@Param('classroomId') classroomId: string, @Query('scope') scope: string, @Request() req: any) {
    const valid = scope === 'grade' || scope === 'general' ? scope : 'group';
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.service.ranking(this.actor(req, institutionId), classroomId, valid);
  }

  @Get('classrooms/:classroomId/me')
  @Roles('ESTUDIANTE')
  async profile(@Param('classroomId') classroomId: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.service.profile(this.actor(req, institutionId), classroomId);
  }

  @Put('classrooms/:classroomId/sources/:activityId')
  @Roles('DOCENTE')
  async setSource(@Param('classroomId') classroomId: string, @Param('activityId') activityId: string, @Body() body: { enabled: boolean }, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.service.setSource(this.actor(req, institutionId), classroomId, activityId, body?.enabled);
  }

  @Post('classrooms/:classroomId')
  @Roles('ESTUDIANTE')
  async invite(@Param('classroomId') classroomId: string, @Body() body: { opponentEnrollmentId?: string; category?: string; selectionMode?: string; rivalMode?: string }, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.service.invite(this.actor(req, institutionId), classroomId, body?.opponentEnrollmentId, { category: body?.category, selectionMode: body?.selectionMode, rivalMode: body?.rivalMode });
  }

  @Get(':duelId')
  @Roles('ESTUDIANTE')
  async get(@Param('duelId') duelId: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.service.get(this.actor(req, institutionId), duelId);
  }

  @Post(':duelId/accept')
  @Roles('ESTUDIANTE')
  async accept(@Param('duelId') duelId: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.service.respond(this.actor(req, institutionId), duelId, true);
  }

  @Post(':duelId/decline')
  @Roles('ESTUDIANTE')
  async decline(@Param('duelId') duelId: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.service.respond(this.actor(req, institutionId), duelId, false);
  }

  @Post(':duelId/answers')
  @Roles('ESTUDIANTE')
  async answer(@Param('duelId') duelId: string, @Body() body: { ordinal: number; answer: string }, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.service.answer(this.actor(req, institutionId), duelId, body?.ordinal, body?.answer);
  }

  @Post(':duelId/power')
  @Roles('ESTUDIANTE')
  async usePower(@Param('duelId') duelId: string, @Body() body: { ordinal: number; kind?: string; category?: string }, @Request() req: any) {
    const kind = body?.kind === 'CATEGORY' ? 'CATEGORY' : 'FIFTY';
    const institutionId = await requireInstitutionId(this.prisma as any, req, req.query?.institutionId);
    return this.service.usePower(this.actor(req, institutionId), duelId, body?.ordinal, kind, body?.category);
  }
}
