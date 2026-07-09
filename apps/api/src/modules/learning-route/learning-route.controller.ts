import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';
import { LearningRouteService } from './learning-route.service';
import { CompetencyEvidenceService } from './competency-evidence.service';

@Controller('learning-routes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LearningRouteController {
  constructor(
    private readonly service: LearningRouteService,
    private readonly evidence: CompetencyEvidenceService,
    private readonly prisma: PrismaService,
  ) {}

  // Grafo de competencias (para el selector de competencia objetivo)
  @Get('competencies')
  @Roles('DOCENTE', 'COORDINADOR')
  async competencies(@Query('framework') framework?: string, @Query('level') level?: string, @Query('skill') skill?: string) {
    return this.service.listCompetencies({ framework, level, skill });
  }

  @Get('classroom/:classroomId')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async byClassroom(@Param('classroomId') classroomId: string) {
    return this.service.listByClassroom(classroomId);
  }

  @Get(':routeId')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async getOne(@Param('routeId') routeId: string) {
    return this.service.getRoute(routeId);
  }

  // Progreso del estudiante autenticado en una ruta (% dominado + por paso)
  @Get(':routeId/progress')
  @Roles('ESTUDIANTE')
  async myProgress(@Param('routeId') routeId: string, @Request() req: any) {
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: { student: { userId: req.user.id }, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }, select: { studentId: true },
    });
    if (!enrollment) throw new Error('No se encontró matrícula activa');
    return this.evidence.getRouteProgress(routeId, enrollment.studentId);
  }

  @Post()
  @Roles('DOCENTE', 'COORDINADOR')
  async create(@Request() req: any, @Body() body: {
    classroomId: string; title: string; description?: string; targetCompetencyId?: string; targetLevel?: string;
  }) {
    const institutionId = await resolveInstitutionId(this.prisma as any, req);
    if (!institutionId) throw new Error('No se pudo resolver la institución');
    return this.service.createRoute(institutionId, body);
  }

  // Valeria arma la ruta: genera un plan (preview, no persiste)
  @Post('generate')
  @Roles('DOCENTE', 'COORDINADOR')
  async generate(@Body() body: { objective: string; gradeName?: string; targetLevel?: string }) {
    return this.service.generatePlan(body.objective, body.gradeName, body.targetLevel);
  }

  // Crea la ruta a partir de un plan de Valeria (que el docente confirmó)
  @Post('from-plan')
  @Roles('DOCENTE', 'COORDINADOR')
  async fromPlan(@Request() req: any, @Body() body: { classroomId: string; plan: any }) {
    const institutionId = await resolveInstitutionId(this.prisma as any, req);
    if (!institutionId) throw new Error('No se pudo resolver la institución');
    return this.service.createFromPlan(institutionId, body.classroomId, body.plan);
  }

  @Put(':routeId')
  @Roles('DOCENTE', 'COORDINADOR')
  async update(@Param('routeId') routeId: string, @Body() body: any) {
    return this.service.updateRoute(routeId, body);
  }

  @Delete(':routeId')
  @Roles('DOCENTE', 'COORDINADOR')
  async remove(@Param('routeId') routeId: string) {
    return this.service.deleteRoute(routeId);
  }

  @Post(':routeId/steps')
  @Roles('DOCENTE', 'COORDINADOR')
  async addStep(@Param('routeId') routeId: string, @Body() body: {
    title: string; activityId?: string; competencyId?: string; sortOrder?: number;
  }) {
    return this.service.addStep(routeId, body);
  }

  // Crea una actividad propia de la ruta (oculta de Actividades) + el paso
  @Post(':routeId/steps/new-activity')
  @Roles('DOCENTE', 'COORDINADOR')
  async addStepWithNewActivity(@Param('routeId') routeId: string, @Body() body: {
    title: string; activityType?: string; description?: string; competencyId?: string; maxScore?: number;
  }) {
    return this.service.addStepWithNewActivity(routeId, body);
  }

  @Put(':routeId/steps/reorder')
  @Roles('DOCENTE', 'COORDINADOR')
  async reorder(@Param('routeId') routeId: string, @Body() body: { stepIds: string[] }) {
    return this.service.reorderSteps(routeId, body.stepIds);
  }

  @Delete('steps/:stepId')
  @Roles('DOCENTE', 'COORDINADOR')
  async removeStep(@Param('stepId') stepId: string) {
    return this.service.deleteStep(stepId);
  }
}
