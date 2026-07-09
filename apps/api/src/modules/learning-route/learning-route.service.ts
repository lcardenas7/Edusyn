import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApdAiService } from '../apd/ai/apd-ai.service';
import type { ApdAiRoutePlan } from '../apd/ai/apd-ai.interfaces';

@Injectable()
export class LearningRouteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apdAi: ApdAiService,
  ) {}

  // ─── Valeria arma la ruta ───────────────────────────────────────────────────
  /** Genera un plan de ruta con IA (no persiste). El docente lo revisa y confirma. */
  async generatePlan(objective: string, gradeName?: string, targetLevel?: string): Promise<ApdAiRoutePlan> {
    return this.apdAi.generateRoutePlan({ objective, gradeName, targetLevel });
  }

  /** Resuelve la primera competencia del grafo para (nivel, habilidad). */
  private async resolveCompetencyId(level: string, skill: string): Promise<string | undefined> {
    const c = await this.prisma.competency.findFirst({
      where: { framework: 'CEFR', level, skill, isActive: true },
      orderBy: { sortOrder: 'asc' }, select: { id: true },
    });
    return c?.id;
  }

  /** Crea una ruta completa (con pasos) a partir de un plan de Valeria. */
  async createFromPlan(institutionId: string, classroomId: string, plan: ApdAiRoutePlan) {
    const classroom = await this.prisma.classroom.findFirst({ where: { id: classroomId, institutionId }, select: { id: true } });
    if (!classroom) throw new NotFoundException('Aula no encontrada');

    const targetCompetencyId = await this.resolveCompetencyId(plan.targetLevel, plan.targetSkill);
    const route = await this.createRoute(institutionId, {
      classroomId, title: plan.title, description: plan.description,
      targetCompetencyId, targetLevel: plan.targetLevel,
    });
    for (const step of plan.steps) {
      const competencyId = await this.resolveCompetencyId(plan.targetLevel, step.skill);
      await this.addStep(route.id, { title: step.title, competencyId });
    }
    return this.getRoute(route.id);
  }

  // ─── Grafo de competencias (para el selector del docente) ──────────────────
  async listCompetencies(filters: { framework?: string; level?: string; skill?: string }) {
    return this.prisma.competency.findMany({
      where: {
        framework: filters.framework || 'CEFR',
        isActive: true,
        ...(filters.level ? { level: filters.level } : {}),
        ...(filters.skill ? { skill: filters.skill } : {}),
      },
      orderBy: [{ level: 'asc' }, { skill: 'asc' }, { sortOrder: 'asc' }],
      select: { id: true, framework: true, level: true, skill: true, code: true, statement: true },
    });
  }

  // ─── Rutas ─────────────────────────────────────────────────────────────────
  async createRoute(institutionId: string, dto: {
    classroomId: string;
    title: string;
    description?: string;
    targetCompetencyId?: string;
    targetLevel?: string;
  }) {
    const classroom = await this.prisma.classroom.findFirst({
      where: { id: dto.classroomId, institutionId },
      select: { id: true },
    });
    if (!classroom) throw new NotFoundException('Aula no encontrada');
    if (!dto.title?.trim()) throw new BadRequestException('El título es obligatorio');

    // Si se da competencia objetivo, derivar el nivel para mostrar.
    let targetLevel = dto.targetLevel;
    if (dto.targetCompetencyId && !targetLevel) {
      const comp = await this.prisma.competency.findUnique({
        where: { id: dto.targetCompetencyId }, select: { level: true },
      });
      targetLevel = comp?.level ?? undefined;
    }

    const max = await this.prisma.learningRoute.aggregate({
      where: { classroomId: dto.classroomId }, _max: { sortOrder: true },
    });

    return this.prisma.learningRoute.create({
      data: {
        institutionId,
        classroomId: dto.classroomId,
        title: dto.title.trim(),
        description: dto.description,
        targetCompetencyId: dto.targetCompetencyId,
        targetLevel,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
      include: { targetCompetency: { select: { code: true, statement: true, level: true, skill: true } } },
    });
  }

  async listByClassroom(classroomId: string) {
    const routes = await this.prisma.learningRoute.findMany({
      where: { classroomId },
      orderBy: { sortOrder: 'asc' },
      include: {
        targetCompetency: { select: { code: true, statement: true, level: true, skill: true } },
        _count: { select: { steps: true } },
      },
    });
    return routes.map(r => ({
      id: r.id, title: r.title, description: r.description,
      isPublished: r.isPublished, targetLevel: r.targetLevel,
      targetCompetency: r.targetCompetency, stepsCount: r._count.steps,
    }));
  }

  async getRoute(routeId: string) {
    const route = await this.prisma.learningRoute.findUnique({
      where: { id: routeId },
      include: {
        targetCompetency: { select: { code: true, statement: true, level: true, skill: true } },
        steps: {
          orderBy: { sortOrder: 'asc' },
          include: {
            activity: { select: { id: true, title: true, type: true, isPublished: true } },
            competency: { select: { code: true, statement: true, level: true, skill: true } },
          },
        },
      },
    });
    if (!route) throw new NotFoundException('Ruta no encontrada');
    return route;
  }

  async updateRoute(routeId: string, dto: {
    title?: string; description?: string; targetCompetencyId?: string | null; targetLevel?: string; isPublished?: boolean;
  }) {
    return this.prisma.learningRoute.update({ where: { id: routeId }, data: dto });
  }

  async deleteRoute(routeId: string) {
    return this.prisma.learningRoute.delete({ where: { id: routeId } });
  }

  // ─── Pasos ───────────────────────────────────────────────────────────────
  async addStep(routeId: string, dto: {
    title: string; activityId?: string; competencyId?: string; sortOrder?: number;
  }) {
    const route = await this.prisma.learningRoute.findUnique({
      where: { id: routeId }, select: { institutionId: true },
    });
    if (!route) throw new NotFoundException('Ruta no encontrada');
    if (!dto.title?.trim()) throw new BadRequestException('El título del paso es obligatorio');

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined || sortOrder === null) {
      const max = await this.prisma.learningRouteStep.aggregate({
        where: { routeId }, _max: { sortOrder: true },
      });
      sortOrder = (max._max.sortOrder ?? -1) + 1;
    }

    return this.prisma.learningRouteStep.create({
      data: {
        institutionId: route.institutionId,
        routeId,
        title: dto.title.trim(),
        activityId: dto.activityId,
        competencyId: dto.competencyId,
        sortOrder,
      },
      include: {
        activity: { select: { id: true, title: true, type: true } },
        competency: { select: { code: true, statement: true, level: true, skill: true } },
      },
    });
  }

  /**
   * Crea una actividad PROPIA de la ruta (isRouteScoped: oculta de la pestaña
   * Actividades) y la añade como paso. Una Tarea de ruta es, de hecho, el
   * componente Writing (consigna de texto libre). Se publica para que el
   * estudiante pueda hacerla desde el mapa de la ruta.
   */
  async addStepWithNewActivity(routeId: string, dto: {
    title: string; activityType?: string; description?: string; competencyId?: string; maxScore?: number;
  }) {
    const route = await this.prisma.learningRoute.findUnique({
      where: { id: routeId }, select: { classroomId: true },
    });
    if (!route) throw new NotFoundException('Ruta no encontrada');
    if (!dto.title?.trim()) throw new BadRequestException('El título es obligatorio');

    const activity = await this.prisma.classroomActivity.create({
      data: {
        classroomId: route.classroomId,
        type: (dto.activityType || 'TASK') as any,
        title: dto.title.trim(),
        description: dto.description,
        maxScore: dto.maxScore ?? 100,
        isRouteScoped: true,
        isPublished: true,
        isVisible: true,
      },
    });
    return this.addStep(routeId, { title: dto.title.trim(), activityId: activity.id, competencyId: dto.competencyId });
  }

  async deleteStep(stepId: string) {
    return this.prisma.learningRouteStep.delete({ where: { id: stepId } });
  }

  async reorderSteps(routeId: string, stepIds: string[]) {
    await this.prisma.$transaction(
      stepIds.map((id, i) => this.prisma.learningRouteStep.update({ where: { id }, data: { sortOrder: i } })),
    );
    return this.getRoute(routeId);
  }
}
