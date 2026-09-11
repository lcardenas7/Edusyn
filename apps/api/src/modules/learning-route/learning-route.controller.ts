import { Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { LearningRouteService } from './learning-route.service';
import { CompetencyEvidenceService } from './competency-evidence.service';

/**
 * Rutas de aprendizaje (HTTP).
 *
 * **La institución la pone el ACTOR, nunca el recurso que nombra el cliente.** Antes solo dos de
 * las dieciséis rutas la resolvían, y el resto pasaba el id recibido directo al servicio.
 *
 * Dos rutas no son institucionales y se documentan como tales: `competencies` lee el catálogo
 * global CEFR (`Competency` no tiene `institutionId` en el esquema) y `generate` solo le pide un
 * borrador a Valeria, sin tocar la base.
 */
@Controller('learning-routes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LearningRouteController {
  constructor(
    private readonly service: LearningRouteService,
    private readonly evidence: CompetencyEvidenceService,
    private readonly prisma: PrismaService,
  ) {}

  // Grafo de competencias (para el selector de competencia objetivo).
  // CATÁLOGO GLOBAL comprobado: `Competency` no lleva institución en el esquema.
  @Get('competencies')
  @Roles('DOCENTE', 'COORDINADOR')
  async competencies(@Query('framework') framework?: string, @Query('level') level?: string, @Query('skill') skill?: string) {
    return this.service.listCompetencies({ framework, level, skill });
  }

  @Get('classroom/:classroomId')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async byClassroom(@Request() req: any, @Param('classroomId') classroomId: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.listByClassroom(institutionId, classroomId);
  }

  @Get(':routeId')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE')
  async getOne(@Request() req: any, @Param('routeId') routeId: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.getRoute(institutionId, routeId);
  }

  /**
   * Progreso del estudiante autenticado en una ruta (% dominado + por paso).
   *
   * Tres cosas, en este orden: la institución sale del actor; la RUTA tiene que ser de esa
   * institución (si no, 404, para no revelar que existe); y solo entonces se busca la matrícula.
   *
   * **La matrícula ya no se elige por «la última creada».** Se exige `ACTIVE`, de la institución
   * de la ruta y del año y grupo del aula de esa ruta —las relaciones que el esquema expone:
   * ruta → aula → asignación docente → (año, grupo)—. Sin matrícula compatible responde 404,
   * igual que un recurso ajeno; antes lanzaba un error genérico que terminaba en 500. Si dos
   * matrículas compatibles apuntan a estudiantes distintos hay ambigüedad real de identidad: se
   * responde 409 en vez de adivinar.
   */
  @Get(':routeId/progress')
  @Roles('ESTUDIANTE')
  async myProgress(@Param('routeId') routeId: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);

    const route = await this.prisma.learningRoute.findFirst({
      where: { id: routeId, institutionId },
      select: {
        id: true,
        classroom: { select: { teacherAssignment: { select: { academicYearId: true, groupId: true } } } },
      },
    });
    if (!route) throw new NotFoundException('Ruta no encontrada');

    const asignacion = route.classroom?.teacherAssignment;
    const matriculas = await this.prisma.studentEnrollment.findMany({
      where: {
        student: { userId: req.user.id },
        institutionId,
        status: 'ACTIVE',
        ...(asignacion?.academicYearId ? { academicYearId: asignacion.academicYearId } : {}),
        ...(asignacion?.groupId ? { groupId: asignacion.groupId } : {}),
      },
      select: { studentId: true },
    });

    const estudiantes = [...new Set(matriculas.map((m) => m.studentId))];
    if (estudiantes.length === 0) throw new NotFoundException('Ruta no encontrada');
    if (estudiantes.length > 1) {
      // Dos identidades de estudiante bajo el mismo usuario: no se elige una por antigüedad.
      throw new ConflictException('Tu usuario está asociado a más de un estudiante en este grupo. Comunícate con la institución.');
    }

    return this.evidence.getRouteProgress(institutionId, routeId, estudiantes[0]);
  }

  @Post()
  @Roles('DOCENTE', 'COORDINADOR')
  async create(@Request() req: any, @Body() body: {
    classroomId: string; title: string; description?: string; targetCompetencyId?: string; targetLevel?: string;
  }) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.createRoute(institutionId, {
      classroomId: body.classroomId,
      title: body.title,
      description: body.description,
      targetCompetencyId: body.targetCompetencyId,
      targetLevel: body.targetLevel,
    });
  }

  // Valeria arma la ruta: genera un plan (preview, no persiste).
  // NO INSTITUCIONAL: no hay operación de base en este camino.
  @Post('generate')
  @Roles('DOCENTE', 'COORDINADOR')
  async generate(@Body() body: {
    objective: string; gradeName?: string; targetLevel?: string;
    instructions?: string; sourceMaterial?: string;
  }) {
    return this.service.generatePlan(body.objective, body.gradeName, body.targetLevel, body.instructions, body.sourceMaterial);
  }

  // Crea la ruta a partir de un plan de Valeria (que el docente confirmó).
  // Persiste indicaciones/material para que cada paso los reuse.
  @Post('from-plan')
  @Roles('DOCENTE', 'COORDINADOR')
  async fromPlan(@Request() req: any, @Body() body: {
    classroomId: string; plan: any; instructions?: string; sourceMaterial?: string;
  }) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.createFromPlan(institutionId, body.classroomId, body.plan, {
      instructions: body.instructions, sourceMaterial: body.sourceMaterial,
    });
  }

  @Put(':routeId')
  @Roles('DOCENTE', 'COORDINADOR')
  async update(@Request() req: any, @Param('routeId') routeId: string, @Body() body: {
    title?: string; description?: string; targetCompetencyId?: string | null; targetLevel?: string; isPublished?: boolean;
  }) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.updateRoute(institutionId, routeId, {
      title: body.title,
      description: body.description,
      targetCompetencyId: body.targetCompetencyId,
      targetLevel: body.targetLevel,
      isPublished: body.isPublished,
    });
  }

  @Delete(':routeId')
  @Roles('DOCENTE', 'COORDINADOR')
  async remove(@Request() req: any, @Param('routeId') routeId: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.deleteRoute(institutionId, routeId);
  }

  @Post(':routeId/steps')
  @Roles('DOCENTE', 'COORDINADOR')
  async addStep(@Request() req: any, @Param('routeId') routeId: string, @Body() body: {
    title: string; activityId?: string; competencyId?: string; sortOrder?: number;
  }) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.addStep(institutionId, routeId, {
      title: body.title, activityId: body.activityId, competencyId: body.competencyId, sortOrder: body.sortOrder,
    });
  }

  // Crea una actividad propia de la ruta (oculta de Actividades) + el paso
  @Post(':routeId/steps/new-activity')
  @Roles('DOCENTE', 'COORDINADOR')
  async addStepWithNewActivity(@Request() req: any, @Param('routeId') routeId: string, @Body() body: {
    title: string; activityType?: string; description?: string; competencyId?: string; maxScore?: number;
  }) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.addStepWithNewActivity(institutionId, routeId, {
      title: body.title, activityType: body.activityType, description: body.description,
      competencyId: body.competencyId, maxScore: body.maxScore,
    });
  }

  @Put(':routeId/steps/reorder')
  @Roles('DOCENTE', 'COORDINADOR')
  async reorder(@Request() req: any, @Param('routeId') routeId: string, @Body() body: { stepIds: string[] }) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.reorderSteps(institutionId, routeId, body?.stepIds);
  }

  // Valeria genera la lección interactiva (ejercicios) del paso
  @Post('steps/:stepId/generate-lesson')
  @Roles('DOCENTE', 'COORDINADOR')
  async generateStepLesson(@Request() req: any, @Param('stepId') stepId: string, @Body() body?: { instructions?: string }) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.generateStepLesson(institutionId, stepId, body?.instructions);
  }

  // Actualizar un paso (enlazar/quitar actividad, competencia, título)
  @Put('steps/:stepId')
  @Roles('DOCENTE', 'COORDINADOR')
  async updateStep(@Request() req: any, @Param('stepId') stepId: string, @Body() body: { title?: string; activityId?: string | null; competencyId?: string | null }) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.updateStep(institutionId, stepId, {
      title: body.title, activityId: body.activityId, competencyId: body.competencyId,
    });
  }

  // Crear una actividad propia de la ruta y adjuntarla a un paso existente
  @Post('steps/:stepId/activity')
  @Roles('DOCENTE', 'COORDINADOR')
  async createStepActivity(@Request() req: any, @Param('stepId') stepId: string, @Body() body: { activityType?: string; description?: string; maxScore?: number }) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.createStepActivity(institutionId, stepId, {
      activityType: body.activityType, description: body.description, maxScore: body.maxScore,
    });
  }

  @Delete('steps/:stepId')
  @Roles('DOCENTE', 'COORDINADOR')
  async removeStep(@Request() req: any, @Param('stepId') stepId: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.deleteStep(institutionId, stepId);
  }
}
