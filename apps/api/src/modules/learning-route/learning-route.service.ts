import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ApdAiService } from '../apd/ai/apd-ai.service';
import type { ApdAiRoutePlan } from '../apd/ai/apd-ai.interfaces';

/**
 * Rutas de aprendizaje.
 *
 * **Aislamiento (2026-09-11).** Antes, catorce de las dieciséis rutas HTTP pasaban el
 * identificador del cliente directo a una consulta por id: leer, editar, borrar, reordenar,
 * generar lecciones y crear actividades funcionaba igual con una ruta de otro colegio, y la
 * actividad creada aterrizaba en el aula ajena. Ahora **toda** operación recibe la institución del
 * ACTOR y valida la cadena real del esquema:
 *
 *   ruta → aula → institución · paso → ruta → institución · actividad → aula → institución
 *
 * `Competency` es catálogo global comprobado: no tiene `institutionId` en el esquema, así que se
 * consulta sin acotar. `ClassroomActivity` tampoco lo tiene, y por eso se filtra por su aula.
 * Un recurso ajeno responde 404, igual que uno inexistente.
 */
@Injectable()
export class LearningRouteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apdAi: ApdAiService,
  ) {}

  // ─── Guardas de pertenencia ────────────────────────────────────────────────

  /** La ruta, solo si es de esta institución. 404 si no existe o es ajena. */
  private async routeInScope(
    institutionId: string,
    routeId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const route = await db.learningRoute.findFirst({
      where: { id: routeId, institutionId, classroom: { institutionId } },
      select: { id: true, institutionId: true, classroomId: true, title: true, instructions: true, sourceMaterial: true },
    });
    if (!route) throw new NotFoundException('Ruta no encontrada');
    return route;
  }

  /** El paso, con su ruta, solo si es de esta institución. */
  private async stepInScope(
    institutionId: string,
    stepId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const step = await db.learningRouteStep.findFirst({
      where: {
        id: stepId,
        institutionId,
        route: { institutionId, classroom: { institutionId } },
      },
      select: {
        id: true, routeId: true, title: true, activityId: true, institutionId: true,
        competency: { select: { skill: true, level: true } },
        route: { select: { id: true, classroomId: true, title: true, instructions: true, sourceMaterial: true } },
      },
    });
    if (!step) throw new NotFoundException('Paso no encontrado');
    return step;
  }

  /** El aula, solo si es de esta institución. */
  private async classroomInScope(
    institutionId: string,
    classroomId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const classroom = await db.classroom.findFirst({
      where: { id: classroomId, institutionId },
      select: { id: true },
    });
    if (!classroom) throw new NotFoundException('Aula no encontrada');
    return classroom;
  }

  /**
   * Una actividad solo puede enlazarse a un paso si vive en el AULA de la ruta.
   * `ClassroomActivity` no tiene `institutionId`: la pertenencia se comprueba por su aula.
   */
  private async assertActivityBelongsToRoute(
    institutionId: string,
    classroomId: string,
    activityId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const activity = await db.classroomActivity.findFirst({
      where: { id: activityId, classroomId, classroom: { institutionId } },
      select: { id: true },
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    return activity;
  }

  /** La competencia existe en el catálogo global. Se valida antes de persistir la referencia. */
  private async assertCompetencyExists(
    competencyId: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const competency = await db.competency.findUnique({ where: { id: competencyId }, select: { id: true } });
    if (!competency) throw new NotFoundException('Competencia no encontrada');
    return competency;
  }

  // ─── Valeria arma la ruta ───────────────────────────────────────────────────
  /** Genera un plan de ruta con IA (no persiste). El docente lo revisa y confirma. */
  async generatePlan(
    objective: string, gradeName?: string, targetLevel?: string,
    instructions?: string, sourceMaterial?: string,
  ): Promise<ApdAiRoutePlan> {
    return this.apdAi.generateRoutePlan({ objective, gradeName, targetLevel, instructions, sourceMaterial });
  }

  /** Resuelve la primera competencia del grafo para (nivel, habilidad). */
  private async resolveCompetencyId(
    level: string,
    skill: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<string | undefined> {
    const c = await db.competency.findFirst({
      where: { framework: 'CEFR', level, skill, isActive: true },
      orderBy: { sortOrder: 'asc' }, select: { id: true },
    });
    return c?.id;
  }

  /**
   * Crea una ruta completa (con pasos) a partir de un plan de Valeria.
   * Persiste las indicaciones y el material base del docente en la ruta para que
   * la generación de CADA paso los reuse (coherencia en todo el recorrido).
   *
   * Del plan solo se leen campos conocidos: llega de la IA tras pasar por el cliente, así que no
   * se vuelca tal cual en la base.
   */
  async createFromPlan(
    institutionId: string, classroomId: string, plan: ApdAiRoutePlan,
    opts?: { instructions?: string; sourceMaterial?: string },
  ) {
    await this.classroomInScope(institutionId, classroomId);
    if (!plan?.title?.trim()) throw new BadRequestException('El plan no tiene título');
    const pasos = Array.isArray(plan.steps) ? plan.steps : [];

    const targetCompetencyId = await this.resolveCompetencyId(plan.targetLevel, plan.targetSkill);

    // Ruta y pasos, en una sola operación: si un paso falla, no queda media ruta.
    const routeId: string = await this.prisma.$transaction(async (tx) => {
      const route = await this.createRoute(institutionId, {
        classroomId, title: plan.title, description: plan.description,
        targetCompetencyId, targetLevel: plan.targetLevel,
      }, tx);
      if (opts?.instructions || opts?.sourceMaterial) {
        await tx.learningRoute.updateMany({
          where: { id: route.id, institutionId },
          data: { instructions: opts.instructions, sourceMaterial: opts.sourceMaterial },
        });
      }
      for (const step of pasos) {
        const competencyId = await this.resolveCompetencyId(plan.targetLevel, step.skill, tx);
        await this.addStep(institutionId, route.id, { title: step.title, competencyId }, tx);
      }
      return route.id;
    });
    return this.getRoute(institutionId, routeId);
  }

  // ─── Grafo de competencias (para el selector del docente) ──────────────────
  /**
   * Catálogo GLOBAL de can-do's (CEFR). `Competency` no lleva `institutionId` en el esquema: no
   * hay dato de ninguna institución que filtrar aquí.
   */
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
  }, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    await this.classroomInScope(institutionId, dto.classroomId, db);
    if (!dto.title?.trim()) throw new BadRequestException('El título es obligatorio');

    // Si se da competencia objetivo, derivar el nivel para mostrar.
    let targetLevel = dto.targetLevel;
    if (dto.targetCompetencyId) {
      const comp = await db.competency.findUnique({
        where: { id: dto.targetCompetencyId }, select: { id: true, level: true },
      });
      if (!comp) throw new NotFoundException('Competencia no encontrada');
      if (!targetLevel) targetLevel = comp.level ?? undefined;
    }

    const max = await db.learningRoute.aggregate({
      where: { classroomId: dto.classroomId, institutionId }, _max: { sortOrder: true },
    });

    return db.learningRoute.create({
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

  async listByClassroom(institutionId: string, classroomId: string) {
    await this.classroomInScope(institutionId, classroomId);
    const routes = await this.prisma.learningRoute.findMany({
      where: { classroomId, institutionId },
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

  async getRoute(institutionId: string, routeId: string) {
    const route = await this.prisma.learningRoute.findFirst({
      where: { id: routeId, institutionId, classroom: { institutionId } },
      include: {
        targetCompetency: { select: { code: true, statement: true, level: true, skill: true } },
        steps: {
          where: { institutionId },
          orderBy: { sortOrder: 'asc' },
          include: {
            activity: { select: { id: true, title: true, type: true, isPublished: true } },
            competency: { select: { code: true, statement: true, level: true, skill: true } },
          },
        },
      },
    });
    if (!route) throw new NotFoundException('Ruta no encontrada');
    // No exponer el material base ni las indicaciones en el payload (pesados y de
    // uso interno del docente): basta con saber si existen.
    const { sourceMaterial, instructions, ...rest } = route;
    return {
      ...rest,
      hasSourceMaterial: !!sourceMaterial,
      hasInstructions: !!instructions,
    };
  }

  /**
   * Actualiza la ruta con una lista EXPLÍCITA de campos. El cuerpo llegaba como `any` y se
   * volcaba en `data`: bastaba mandar `institutionId` o `classroomId` para mudar la ruta a otro
   * colegio o a un aula ajena.
   */
  async updateRoute(institutionId: string, routeId: string, dto: {
    title?: string; description?: string; targetCompetencyId?: string | null; targetLevel?: string; isPublished?: boolean;
  }) {
    await this.routeInScope(institutionId, routeId);

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) {
      if (!dto.title?.trim()) throw new BadRequestException('El título es obligatorio');
      data.title = dto.title.trim();
    }
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.targetLevel !== undefined) data.targetLevel = dto.targetLevel;
    if (dto.isPublished !== undefined) data.isPublished = !!dto.isPublished;
    if (dto.targetCompetencyId !== undefined) {
      if (dto.targetCompetencyId) await this.assertCompetencyExists(dto.targetCompetencyId);
      data.targetCompetencyId = dto.targetCompetencyId;
    }

    const filas = await this.prisma.learningRoute.updateMany({ where: { id: routeId, institutionId }, data });
    if (filas.count === 0) throw new NotFoundException('Ruta no encontrada');
    return this.getRoute(institutionId, routeId);
  }

  async deleteRoute(institutionId: string, routeId: string) {
    // Guarda primero: ante una ruta ajena no se ejecuta ninguna escritura, ni siquiera acotada.
    await this.routeInScope(institutionId, routeId);
    const filas = await this.prisma.learningRoute.deleteMany({ where: { id: routeId, institutionId } });
    if (filas.count === 0) throw new NotFoundException('Ruta no encontrada');
    return { success: true };
  }

  // ─── Pasos ───────────────────────────────────────────────────────────────
  async addStep(institutionId: string, routeId: string, dto: {
    title: string; activityId?: string; competencyId?: string; sortOrder?: number;
  }, db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const route = await this.routeInScope(institutionId, routeId, db);
    if (!dto.title?.trim()) throw new BadRequestException('El título del paso es obligatorio');
    if (dto.activityId) await this.assertActivityBelongsToRoute(institutionId, route.classroomId, dto.activityId, db);
    if (dto.competencyId) await this.assertCompetencyExists(dto.competencyId, db);

    let sortOrder = dto.sortOrder;
    if (sortOrder === undefined || sortOrder === null) {
      const max = await db.learningRouteStep.aggregate({
        where: { routeId, institutionId }, _max: { sortOrder: true },
      });
      sortOrder = (max._max.sortOrder ?? -1) + 1;
    }

    return db.learningRouteStep.create({
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
  async addStepWithNewActivity(institutionId: string, routeId: string, dto: {
    title: string; activityType?: string; description?: string; competencyId?: string; maxScore?: number;
  }) {
    const route = await this.routeInScope(institutionId, routeId);
    if (!dto.title?.trim()) throw new BadRequestException('El título es obligatorio');
    if (dto.competencyId) await this.assertCompetencyExists(dto.competencyId);

    // Actividad y paso van juntos: una actividad huérfana quedaría oculta en el aula.
    return this.prisma.$transaction(async (tx) => {
      const scopedRoute = await this.routeInScope(institutionId, routeId, tx);
      const activity = await tx.classroomActivity.create({
        data: {
          classroomId: scopedRoute.classroomId,
          type: (dto.activityType || 'TASK') as any,
          title: dto.title.trim(),
          description: dto.description,
          maxScore: dto.maxScore ?? 100,
          isRouteScoped: true,
          isPublished: true,
          isVisible: true,
        },
      });
      return this.addStep(institutionId, routeId, {
        title: dto.title.trim(), activityId: activity.id, competencyId: dto.competencyId,
      }, tx);
    });
  }

  /**
   * Valeria genera la LECCIÓN INTERACTIVA de un paso (ejercicios estilo Duolingo
   * de la habilidad/nivel del can-do del paso). Crea/asegura una actividad LESSON
   * propia de la ruta y guarda las slides. El estudiante la hace desde el mapa;
   * al completarla fluyen XP y evidencia (ya cableados).
   *
   * La generación con IA ocurre ANTES de escribir: si Valeria falla, la lección anterior sigue
   * en pie. Lo que se persiste va en una sola operación.
   */
  async generateStepLesson(institutionId: string, stepId: string, extraInstructions?: string) {
    const step = await this.stepInScope(institutionId, stepId);

    // Indicaciones: las de la ruta + las específicas de este paso (si las hay).
    const instructions = [step.route.instructions, extraInstructions]
      .filter(Boolean).join('\n').trim() || undefined;

    const skill = (step.competency?.skill as any) || 'READING';
    const level = step.competency?.level || 'A2';

    // Grado escolar (para que Valeria ajuste tema/registro a la edad).
    const classroom = await this.prisma.classroom.findFirst({
      where: { id: step.route.classroomId, institutionId },
      select: { teacherAssignment: { select: { group: { select: { grade: { select: { name: true } } } } } } },
    });
    const gradeName = classroom?.teacherAssignment?.group?.grade?.name;

    // Generar los ejercicios con Valeria ANTES de tocar la base.
    const draft = await this.apdAi.generateEnglishLessonSlides({
      skill, level, objective: step.route.title, title: step.title, gradeName,
      instructions, sourceMaterial: step.route.sourceMaterial ?? undefined,
    });

    return this.prisma.$transaction(async (tx) => {
      const scopedStep = await this.stepInScope(institutionId, stepId, tx);
      // Asegurar una actividad LESSON propia de la ruta para este paso.
      let activityId = scopedStep.activityId ?? undefined;
      const existingActivity = activityId
        ? await tx.classroomActivity.findFirst({
            where: { id: activityId, classroomId: scopedStep.route.classroomId, classroom: { institutionId } },
            select: { id: true, type: true },
          })
        : null;
      if (!existingActivity || existingActivity.type !== 'LESSON') {
        const created = await tx.classroomActivity.create({
          data: {
            classroomId: scopedStep.route.classroomId, type: 'LESSON', title: scopedStep.title,
            isRouteScoped: true, isPublished: true, isVisible: true, maxScore: 100,
          },
        });
        activityId = created.id;
        const linked = await tx.learningRouteStep.updateMany({
          where: { id: stepId, institutionId }, data: { activityId },
        });
        if (linked.count === 0) throw new NotFoundException('Paso no encontrado');
      }

      // Reemplazar la lección (regenerable).
      const existingLesson = await tx.lesson.findUnique({ where: { activityId }, select: { id: true } });
      if (existingLesson) await tx.lesson.delete({ where: { id: existingLesson.id } });
      await tx.lesson.create({
        data: {
          activityId: activityId!,
          title: draft.title,
          description: draft.description,
          slides: {
            create: draft.slides.map((s, i) => ({
              type: s.type as any, sortOrder: i, title: s.title, body: s.body,
              activityData: s.activityData ? (s.activityData as any) : undefined,
              badgeEmoji: s.badgeEmoji, badgeTitle: s.badgeTitle,
            })),
          },
        },
      });
      return { activityId, slides: draft.slides.length };
    });
  }

  /**
   * Actualiza un paso: enlazar/quitar actividad, cambiar competencia o título.
   * La actividad que se enlaza tiene que vivir en el aula de la ruta: antes se aceptaba el id de
   * una actividad de otro colegio, y con eso su evidencia entraba en esta ruta.
   */
  async updateStep(institutionId: string, stepId: string, dto: { title?: string; activityId?: string | null; competencyId?: string | null }) {
    const step = await this.stepInScope(institutionId, stepId);

    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) {
      if (!dto.title?.trim()) throw new BadRequestException('El título del paso es obligatorio');
      data.title = dto.title.trim();
    }
    if (dto.activityId !== undefined) {
      if (dto.activityId) await this.assertActivityBelongsToRoute(institutionId, step.route.classroomId, dto.activityId);
      data.activityId = dto.activityId;
    }
    if (dto.competencyId !== undefined) {
      if (dto.competencyId) await this.assertCompetencyExists(dto.competencyId);
      data.competencyId = dto.competencyId;
    }

    const filas = await this.prisma.learningRouteStep.updateMany({ where: { id: stepId, institutionId }, data });
    if (filas.count === 0) throw new NotFoundException('Paso no encontrado');
    return this.prisma.learningRouteStep.findFirst({
      where: { id: stepId, institutionId },
      include: {
        activity: { select: { id: true, title: true, type: true } },
        competency: { select: { code: true, statement: true, level: true, skill: true } },
      },
    });
  }

  /** Crea una actividad propia de la ruta y la ADJUNTA a un paso existente (que no tenía). */
  async createStepActivity(institutionId: string, stepId: string, dto: { activityType?: string; description?: string; maxScore?: number }) {
    const step = await this.stepInScope(institutionId, stepId);
    return this.prisma.$transaction(async (tx) => {
      const scopedStep = await this.stepInScope(institutionId, stepId, tx);
      const activity = await tx.classroomActivity.create({
        data: {
          classroomId: scopedStep.route.classroomId,
          type: (dto.activityType || 'TASK') as any,
          title: scopedStep.title,
          description: dto.description,
          maxScore: dto.maxScore ?? 100,
          isRouteScoped: true, isPublished: true, isVisible: true,
        },
      });
      const linked = await tx.learningRouteStep.updateMany({
        where: { id: stepId, institutionId }, data: { activityId: activity.id },
      });
      if (linked.count === 0) throw new NotFoundException('Paso no encontrado');
      return { activityId: activity.id };
    });
  }

  async deleteStep(institutionId: string, stepId: string) {
    await this.stepInScope(institutionId, stepId);
    const filas = await this.prisma.learningRouteStep.deleteMany({ where: { id: stepId, institutionId } });
    if (filas.count === 0) throw new NotFoundException('Paso no encontrado');
    return { success: true };
  }

  /**
   * Reordena los pasos de UNA ruta. Antes actualizaba por id suelto: con ids de otra ruta —o de
   * otro colegio— se reordenaban pasos ajenos, y un id de otra ruta se colaba en este orden.
   */
  async reorderSteps(institutionId: string, routeId: string, stepIds: string[]) {
    await this.routeInScope(institutionId, routeId);
    const ids = [...new Set(Array.isArray(stepIds) ? stepIds : [])];
    if (ids.length === 0) throw new BadRequestException('No se recibieron pasos para ordenar');

    await this.prisma.$transaction(async (tx) => {
      await this.routeInScope(institutionId, routeId, tx);
      const propios = await tx.learningRouteStep.count({
        where: { id: { in: ids }, routeId, institutionId },
      });
      if (propios !== ids.length) throw new NotFoundException('Paso no encontrado');
      await Promise.all(ids.map((id, i) => tx.learningRouteStep.updateMany({
        where: { id, routeId, institutionId }, data: { sortOrder: i },
      })));
    });
    return this.getRoute(institutionId, routeId);
  }
}
