import { Body, Controller, Get, Param, Patch, Post, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { ConstruyeService } from './construye.service';

// Cada ruta resuelve la institución del actor al inicio (contrato institution-route-contract):
// el servicio nunca recibe una institución que venga del cliente.
@Controller('construye')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConstruyeController {
  constructor(private readonly service: ConstruyeService, private readonly prisma: PrismaService) {}

  @Post('projects') @Roles('DOCENTE', 'COORDINADOR')
  async createProject(@Request() req: any, @Body() body: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.createProject(institutionId, req.user.id, body);
  }

  @Patch('projects/:projectId') @Roles('DOCENTE', 'COORDINADOR')
  async updateProject(@Param('projectId') projectId: string, @Request() req: any, @Body() body: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.updateProject(projectId, institutionId, req.user.id, body);
  }

  @Get('classrooms/:classroomId/projects') @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async listProjects(@Param('classroomId') classroomId: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    const isTeacher = req.user.roles?.some((role: any) => role === 'DOCENTE' || role === 'COORDINADOR');
    return this.service.listClassroomProjects(classroomId, institutionId, req.user.id, isTeacher);
  }

  @Post('projects/:projectId/teams') @Roles('DOCENTE', 'COORDINADOR')
  async createTeam(@Param('projectId') projectId: string, @Request() req: any, @Body() body: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.createTeam(projectId, institutionId, req.user.id, body);
  }

  @Get('projects/:projectId/my-team') @Roles('ESTUDIANTE')
  async myTeam(@Param('projectId') projectId: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.getMyTeam(projectId, institutionId, req.user.id);
  }

  @Get('teams/:teamId') @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async team(@Param('teamId') teamId: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.teamDetail(teamId, institutionId, req.user.id);
  }

  @Patch('teams/:teamId/brief') @Roles('ESTUDIANTE')
  async updateBrief(@Param('teamId') teamId: string, @Request() req: any, @Body() body: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.updateBrief(teamId, institutionId, req.user.id, body);
  }

  @Put('teams/:teamId/code-draft') @Roles('ESTUDIANTE')
  async codeDraft(@Param('teamId') teamId: string, @Request() req: any, @Body() body: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.saveCodeDraft(teamId, institutionId, req.user.id, body);
  }

  @Post('teams/:teamId/versions') @Roles('ESTUDIANTE')
  async version(@Param('teamId') teamId: string, @Request() req: any, @Body() body: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.createVersion(teamId, institutionId, req.user.id, body);
  }

  @Post('teams/:teamId/build-unlock') @Roles('DOCENTE', 'COORDINADOR')
  async unlockBuild(@Param('teamId') teamId: string, @Request() req: any, @Body() body: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.unlockBuild(teamId, institutionId, req.user.id, body);
  }

  @Post('teams/:teamId/journal') @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async journal(@Param('teamId') teamId: string, @Request() req: any, @Body() body: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.addJournalEntry(teamId, institutionId, req.user.id, body);
  }

  @Get('projects/:projectId/dashboard') @Roles('DOCENTE', 'COORDINADOR')
  async dashboard(@Param('projectId') projectId: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.dashboard(projectId, institutionId, req.user.id);
  }
}
