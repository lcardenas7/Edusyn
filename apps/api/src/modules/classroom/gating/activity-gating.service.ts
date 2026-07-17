import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CompletionService, satisfiesCondition } from './completion.service';
import { DependencyEdge, validateNewDependency } from './activity-graph.util';

// Un prerrequisito faltante mostrado al estudiante en la actividad bloqueada.
export interface MissingPrerequisite {
  prerequisiteId: string;
  title: string;
  condition: string;
  minScore: number | null;
  satisfied: boolean;
}

export interface GateState {
  locked: boolean;
  missing: MissingPrerequisite[];
}

@Injectable()
export class ActivityGatingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly completion: CompletionService,
  ) {}

  /** Aristas de dependencia del aula (para validación de grafo). */
  async getClassroomEdges(classroomId: string): Promise<DependencyEdge[]> {
    const rows = await this.prisma.activityDependency.findMany({
      where: { activity: { classroomId } },
      select: { activityId: true, prerequisiteId: true },
    });
    return rows.map(r => ({ activityId: r.activityId, prerequisiteId: r.prerequisiteId }));
  }

  /**
   * Valida que se pueda crear la dependencia (misma aula, sin auto-dependencia,
   * duplicado ni ciclo). Lanza BadRequest con mensaje claro si no.
   */
  async assertValidDependency(activityId: string, prerequisiteId: string): Promise<void> {
    const [activity, prerequisite] = await Promise.all([
      this.prisma.classroomActivity.findUnique({ where: { id: activityId }, select: { id: true, classroomId: true } }),
      this.prisma.classroomActivity.findUnique({ where: { id: prerequisiteId }, select: { id: true, classroomId: true } }),
    ]);
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    if (!prerequisite) throw new NotFoundException('Prerrequisito no encontrado');
    if (activity.classroomId !== prerequisite.classroomId) {
      throw new BadRequestException('El prerrequisito debe pertenecer a la misma aula');
    }

    const edges = await this.getClassroomEdges(activity.classroomId);
    const error = validateNewDependency(edges, activityId, prerequisiteId);
    if (error === 'SELF') throw new BadRequestException('Una actividad no puede depender de sí misma');
    if (error === 'DUPLICATE') throw new BadRequestException('Ese prerrequisito ya está configurado');
    if (error === 'CYCLE') throw new BadRequestException('Esa dependencia crearía un ciclo (dependencias circulares)');
  }

  /**
   * Evalúa el estado de candado de TODAS las actividades del aula para un
   * estudiante. Devuelve solo las que tienen dependencias (las demás están
   * libres por defecto). Backend autoritativo; el frontend solo pinta esto.
   *
   * Reglas: una actividad se desbloquea cuando TODOS sus prerrequisitos cumplen
   * su condición (AND). "Sticky unlock": si el estudiante ya inició/entregó la
   * actividad, no se vuelve a bloquear aunque cambien las dependencias.
   */
  async evaluateForStudent(classroomId: string, studentEnrollmentId: string): Promise<Map<string, GateState>> {
    const result = new Map<string, GateState>();

    const deps = await this.prisma.activityDependency.findMany({
      where: { activity: { classroomId } },
      select: { activityId: true, prerequisiteId: true, condition: true, minScore: true },
    });
    if (!deps.length) return result; // sin reglas → todo libre (retrocompatible)

    // Actividades involucradas (dependientes + prerrequisitos) para completitud y títulos.
    const involvedIds = new Set<string>();
    for (const d of deps) { involvedIds.add(d.activityId); involvedIds.add(d.prerequisiteId); }
    const activities = await this.prisma.classroomActivity.findMany({
      where: { id: { in: [...involvedIds] } },
      select: { id: true, type: true, maxScore: true, title: true },
    });
    const titleById = new Map(activities.map(a => [a.id, a.title]));

    const completion = await this.completion.getCompletionMap(
      activities.map(a => ({ id: a.id, type: a.type, maxScore: a.maxScore != null ? Number(a.maxScore) : null })),
      studentEnrollmentId,
    );

    // Agrupa dependencias por actividad dependiente.
    const byActivity = new Map<string, typeof deps>();
    for (const d of deps) {
      const list = byActivity.get(d.activityId);
      if (list) list.push(d);
      else byActivity.set(d.activityId, [d]);
    }

    for (const [activityId, rules] of byActivity) {
      // Sticky: si ya la inició/entregó, permanece desbloqueada.
      if (completion.get(activityId)?.started) {
        result.set(activityId, { locked: false, missing: [] });
        continue;
      }
      const missing: MissingPrerequisite[] = [];
      for (const r of rules) {
        const minScore = r.minScore != null ? Number(r.minScore) : null;
        const ok = satisfiesCondition(completion.get(r.prerequisiteId), r.condition, minScore);
        if (!ok) {
          missing.push({
            prerequisiteId: r.prerequisiteId,
            title: titleById.get(r.prerequisiteId) || 'Actividad',
            condition: r.condition,
            minScore,
            satisfied: false,
          });
        }
      }
      result.set(activityId, { locked: missing.length > 0, missing });
    }

    return result;
  }

  /**
   * ¿Puede el estudiante acceder a UNA actividad? (para el enforcement de Fase 3).
   * Fail-open: si la actividad no tiene reglas, siempre true.
   */
  async isUnlockedForStudent(activityId: string, classroomId: string, studentEnrollmentId: string): Promise<boolean> {
    const map = await this.evaluateForStudent(classroomId, studentEnrollmentId);
    return !(map.get(activityId)?.locked);
  }
}
