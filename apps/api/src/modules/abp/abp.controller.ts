import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';
import { AbpService } from './abp.service';
import { ABP_PHASES } from './abp.constants';

// ═══════════════════════════════════════════════════════════════════════════
// EXPEDICIÓN ABP — controller. Ticket 1: crear proyecto, roster, armar equipos.
// ═══════════════════════════════════════════════════════════════════════════

@Controller('abp')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AbpController {
  constructor(
    private readonly service: AbpService,
    private readonly prisma: PrismaService,
  ) {}

  private async ctx(req: any) {
    const userId = req.user.id;
    const institutionId = await resolveInstitutionId(this.prisma as any, req);
    if (!institutionId) throw new Error('No se pudo resolver la institución');
    return { userId, institutionId };
  }

  // Catálogo de las 6 fases (para el front).
  @Get('phases')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  phases() {
    return ABP_PHASES;
  }

  // Proyectos ABP de un aula.
  @Get('classroom/:classroomId/projects')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async listByClassroom(@Param('classroomId') classroomId: string, @Request() req: any) {
    const { institutionId } = await this.ctx(req);
    return this.service.listByClassroom(classroomId, institutionId);
  }

  // Matriculados del aula (para armar equipos) — docente.
  @Get('classroom/:classroomId/roster')
  @Roles('DOCENTE', 'COORDINADOR')
  async roster(@Param('classroomId') classroomId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.getRoster(classroomId, institutionId, userId);
  }

  // Detalle de un proyecto con sus equipos — docente.
  @Get('projects/:projectId')
  @Roles('DOCENTE', 'COORDINADOR')
  async getProject(@Param('projectId') projectId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.getProject(projectId, institutionId, userId);
  }

  // Crear proyecto ABP — docente.
  @Post('projects')
  @Roles('DOCENTE', 'COORDINADOR')
  async createProject(@Request() req: any, @Body() body: {
    classroomId: string; title: string; challenge?: string; phaseConfig?: any; startDate?: string; endDate?: string;
  }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.createProject(institutionId, userId, body);
  }

  // Armar equipo — docente.
  @Post('teams')
  @Roles('DOCENTE', 'COORDINADOR')
  async createTeam(@Request() req: any, @Body() body: {
    projectId: string; name: string; emoji?: string; color?: string; problem?: string; memberEnrollmentIds: string[];
  }) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.createTeam(institutionId, userId, body);
  }

  // Eliminar equipo — docente.
  @Delete('teams/:teamId')
  @Roles('DOCENTE', 'COORDINADOR')
  async deleteTeam(@Param('teamId') teamId: string, @Request() req: any) {
    const { institutionId, userId } = await this.ctx(req);
    return this.service.deleteTeam(teamId, institutionId, userId);
  }
}
