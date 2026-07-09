import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class LearningRouteService {
  constructor(private readonly prisma: PrismaService) {}

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
