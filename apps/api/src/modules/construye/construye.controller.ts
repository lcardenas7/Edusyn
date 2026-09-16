import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';
import { ConstruyeService } from './construye.service';

@Controller('construye')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConstruyeController {
  constructor(private readonly service: ConstruyeService, private readonly prisma: PrismaService) {}
  private async ctx(req: any) {
    const institutionId = await resolveInstitutionId(this.prisma as any, req);
    if (!institutionId) throw new Error('No se pudo resolver la institución');
    return { institutionId, userId: req.user.id };
  }

  @Post('projects') @Roles('DOCENTE', 'COORDINADOR')
  createProject(@Request() req: any, @Body() body: any) { return this.ctx(req).then(({ institutionId, userId }) => this.service.createProject(institutionId, userId, body)); }

  @Get('classrooms/:classroomId/projects') @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  listProjects(@Param('classroomId') classroomId: string, @Request() req: any) { return this.ctx(req).then(({ institutionId, userId }) => this.service.listClassroomProjects(classroomId, institutionId, userId, req.user.roles?.some((role: any) => role === 'DOCENTE' || role === 'COORDINADOR'))); }

  @Post('projects/:projectId/teams') @Roles('DOCENTE', 'COORDINADOR')
  createTeam(@Param('projectId') projectId: string, @Request() req: any, @Body() body: any) { return this.ctx(req).then(({ institutionId, userId }) => this.service.createTeam(projectId, institutionId, userId, body)); }

  @Get('projects/:projectId/my-team') @Roles('ESTUDIANTE')
  myTeam(@Param('projectId') projectId: string, @Request() req: any) { return this.ctx(req).then(({ institutionId, userId }) => this.service.getMyTeam(projectId, institutionId, userId)); }

  @Get('teams/:teamId') @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  team(@Param('teamId') teamId: string, @Request() req: any) { return this.ctx(req).then(({ institutionId, userId }) => this.service.teamDetail(teamId, institutionId, userId)); }

  @Patch('teams/:teamId/brief') @Roles('ESTUDIANTE')
  updateBrief(@Param('teamId') teamId: string, @Request() req: any, @Body() body: any) { return this.ctx(req).then(({ institutionId, userId }) => this.service.updateBrief(teamId, institutionId, userId, body)); }

  @Post('teams/:teamId/versions') @Roles('ESTUDIANTE')
  version(@Param('teamId') teamId: string, @Request() req: any, @Body() body: any) { return this.ctx(req).then(({ institutionId, userId }) => this.service.createVersion(teamId, institutionId, userId, body)); }

  @Post('teams/:teamId/journal') @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  journal(@Param('teamId') teamId: string, @Request() req: any, @Body() body: any) { return this.ctx(req).then(({ institutionId, userId }) => this.service.addJournalEntry(teamId, institutionId, userId, body)); }

  @Get('projects/:projectId/dashboard') @Roles('DOCENTE', 'COORDINADOR')
  dashboard(@Param('projectId') projectId: string, @Request() req: any) { return this.ctx(req).then(({ institutionId, userId }) => this.service.dashboard(projectId, institutionId, userId)); }
}
