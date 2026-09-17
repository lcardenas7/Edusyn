import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PartialGradesService } from '../evaluation/partial-grades.service';
import { ApdAiService } from '../apd/ai/apd-ai.service';

/** Tipos de evaluador disponibles en esta versión. TEACHER existe en el esquema, pero todavía no
 * hay una pantalla para que el docente responda, así que no se ofrece: una dimensión que nadie
 * puede completar nunca se consolidaría. */
export const FORMATIVE_EVALUATOR_TYPES = ['SELF', 'PEER'] as const;
type EvaluatorType = (typeof FORMATIVE_EVALUATOR_TYPES)[number];

type DimensionInput = {
  label: string; evaluatorType: EvaluatorType; rubricId: string; evaluationComponentId?: string | null;
  peersPerStudent?: number | null; revealEvaluator?: boolean; requireCommentReview?: boolean; allowIncomplete?: boolean;
};

const MAX_PEERS = 10;
const MAX_COMMENT = 1000;
const MAX_QUESTIONS = 40;

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Solo los campos que el docente puede decidir por dimensión. Nunca se copia el objeto del
 * cliente tal cual: podría traer índices de planilla, ids u otros campos internos. */
export function sanitizeDimensionInput(d: any): DimensionInput {
  const evaluatorType = FORMATIVE_EVALUATOR_TYPES.includes(d?.evaluatorType) ? d.evaluatorType as EvaluatorType : null;
  if (!evaluatorType) throw new BadRequestException('Cada dimensión debe ser de autoevaluación o de coevaluación');
  const label = text(d?.label, 120);
  if (!label) throw new BadRequestException('Cada dimensión necesita un nombre');
  if (typeof d?.rubricId !== 'string' || !d.rubricId) throw new BadRequestException(`La dimensión "${label}" no tiene rúbrica`);
  const peers = evaluatorType === 'PEER' ? Math.max(1, Math.min(Math.trunc(Number(d?.peersPerStudent) || 1), MAX_PEERS)) : null;
  return {
    label, evaluatorType, rubricId: d.rubricId,
    evaluationComponentId: typeof d?.evaluationComponentId === 'string' && d.evaluationComponentId ? d.evaluationComponentId : null,
    peersPerStudent: peers,
    revealEvaluator: d?.revealEvaluator === true,
    requireCommentReview: d?.requireCommentReview !== false,
    allowIncomplete: d?.allowIncomplete === true,
  };
}

/** Rotación determinista (peer-ring-v1): cada estudiante evalúa a los k siguientes de la lista
 * ordenada. Cobertura y carga exactamente balanceadas, sin autoevaluación ni duplicados. */
export function peerRing(ids: string[], k: number): Array<{ evaluator: string; target: string }> {
  const sorted = [...ids].sort();
  const steps = Math.min(k, sorted.length - 1);
  if (steps < 1) throw new BadRequestException('Se requieren al menos dos estudiantes para coevaluación');
  const pairs: Array<{ evaluator: string; target: string }> = [];
  sorted.forEach((evaluator, i) => {
    for (let step = 1; step <= steps; step++) pairs.push({ evaluator, target: sorted[(i + step) % sorted.length] });
  });
  return pairs;
}

/** Barajado determinista a partir de una semilla (misma semilla → mismo orden), para que un
 * reparto "al azar" se pueda auditar y reproducir exactamente. */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  const next = () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const out = [...items].sort();
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

/** Reparto automático (peer-shuffled-ring-v1): se baraja la lista con la semilla y se aplica el
 * anillo. Sigue siendo exactamente equilibrado (cada uno da y recibe k), pero los compañeros ya no
 * dependen del orden de la lista. */
export function shuffledPeerRing(ids: string[], k: number, seed: string): Array<{ evaluator: string; target: string }> {
  const order = seededShuffle(ids, seed);
  const steps = Math.min(k, order.length - 1);
  if (steps < 1) throw new BadRequestException('Se requieren al menos dos estudiantes para coevaluación');
  const pairs: Array<{ evaluator: string; target: string }> = [];
  order.forEach((evaluator, i) => {
    for (let step = 1; step <= steps; step++) pairs.push({ evaluator, target: order[(i + step) % order.length] });
  });
  return pairs;
}

export type PeerPlanInput = { mode?: unknown; seed?: unknown; pairs?: unknown };
export type ManualPair = { dimensionId: string; evaluator: string; target: string };

/** Valida un reparto manual: solo dimensiones de coevaluación de la actividad, estudiantes activos
 * del grupo, nadie se evalúa a sí mismo, sin duplicados y al menos una pareja por dimensión. */
export function validateManualPairs(raw: unknown, peerDimensionIds: string[], studentIds: string[]): ManualPair[] {
  if (!Array.isArray(raw)) throw new BadRequestException('El reparto manual no tiene un formato válido');
  const dims = new Set(peerDimensionIds);
  const students = new Set(studentIds);
  const seen = new Set<string>();
  const pairs: ManualPair[] = [];
  for (const item of raw as any[]) {
    const dimensionId = item?.dimensionId, evaluator = item?.evaluator, target = item?.target;
    if (!dims.has(dimensionId)) throw new BadRequestException('El reparto incluye una dimensión que no es de coevaluación');
    if (!students.has(evaluator) || !students.has(target)) throw new BadRequestException('El reparto incluye un estudiante que no está activo en el grupo');
    if (evaluator === target) throw new BadRequestException('Un estudiante no puede coevaluarse a sí mismo');
    const key = `${dimensionId}|${evaluator}|${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ dimensionId, evaluator, target });
  }
  for (const dimensionId of peerDimensionIds) {
    if (!pairs.some(p => p.dimensionId === dimensionId)) throw new BadRequestException('Cada coevaluación necesita al menos una pareja');
  }
  if (pairs.length > studentIds.length * 20) throw new BadRequestException('El reparto tiene demasiadas parejas');
  return pairs;
}

/** Revisa que las respuestas cubran cada criterio publicado exactamente una vez y calcula el
 * puntaje ponderado. */
export function scoreAnswers(criteria: any[], answers: unknown): number {
  if (!Array.isArray(answers)) throw new BadRequestException('Las respuestas no tienen un formato válido');
  const seen = new Set<string>();
  let score = 0;
  for (const answer of answers as any[]) {
    const criterion = criteria.find((c: any) => c.id === answer?.criterionId);
    const level = criterion?.levels?.find((l: any) => l.id === answer?.levelId);
    if (!criterion || !level) throw new BadRequestException('La respuesta no corresponde a la rúbrica publicada');
    if (seen.has(criterion.id)) throw new BadRequestException('Cada criterio se responde una sola vez');
    seen.add(criterion.id);
    score += Number(level.score) * (Number(criterion.weight) / 100);
  }
  if (seen.size !== criteria.length) throw new BadRequestException('Debes responder todos los criterios');
  return Math.round(score * 100) / 100;
}

@Injectable()
export class FormativeEvaluationService {
  constructor(private readonly prisma: PrismaService, private readonly partialGrades: PartialGradesService, private readonly apdAi: ApdAiService) {}

  private async teacherClassroom(classroomId: string, institutionId: string, userId: string) {
    const classroom = await this.prisma.classroom.findFirst({
      where: { id: classroomId, institutionId, teacherAssignment: { teacherId: userId } },
      include: { teacherAssignment: { include: { group: { include: { grade: true } }, subject: true } } },
    });
    if (!classroom) throw new ForbiddenException('Aula no encontrada o sin permisos');
    return classroom;
  }

  private async activeEnrollment(institutionId: string, userId: string) {
    const enrollment = await this.prisma.studentEnrollment.findFirst({ where: { institutionId, student: { userId }, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
    if (!enrollment) throw new ForbiddenException('No tienes matrícula activa');
    return enrollment;
  }

  /** Componentes de la estructura de evaluación de la institución a los que puede ir la nota. */
  async components(classroomId: string, institutionId: string, userId: string) {
    await this.teacherClassroom(classroomId, institutionId, userId);
    return this.prisma.evaluationComponent.findMany({
      where: { institutionId, parentId: null },
      select: { id: true, code: true, name: true, weightPercentage: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });
  }

  async generateDraft(institutionId: string, userId: string, body: { classroomId: string; purpose: string; dimensions?: string[]; minScore?: number; maxScore?: number; levels?: number; criteriaPerDimension?: number; aspects?: string[]; perAspect?: number; mirrorPeer?: boolean }) {
    const classroom = await this.teacherClassroom(body?.classroomId, institutionId, userId);
    const purpose = text(body?.purpose, 1500);
    if (!purpose) throw new BadRequestException('Indica el propósito de la evaluación');
    let draft: any;
    try {
      draft = await this.apdAi.generateFormativeRubric({
        purpose, dimensions: Array.isArray(body.dimensions) ? body.dimensions.map(d => text(d, 60)).filter(Boolean) : undefined,
        minScore: body.minScore, maxScore: body.maxScore, levels: body.levels, criteriaPerDimension: body.criteriaPerDimension,
        aspects: Array.isArray(body.aspects) ? body.aspects.map(a => text(a, 80)).filter(Boolean) : undefined, perAspect: body.perAspect, mirrorPeer: body.mirrorPeer === true,
        gradeName: classroom.teacherAssignment.group.grade?.name, subjectName: classroom.teacherAssignment.subject?.name,
      });
    } catch (error: any) {
      throw new ServiceUnavailableException(error?.message || 'La IA no pudo generar el borrador. Intenta de nuevo.');
    }
    // Contrato defensivo: el cliente recibe un borrador limpio y lo revisa antes de persistirlo.
    const dimensions = (Array.isArray(draft?.dimensions) ? draft.dimensions : []).map((d: any) => ({
      label: text(d?.label, 120),
      evaluatorType: d?.evaluatorType === 'PEER' ? 'PEER' : 'SELF',
      evaluationComponentId: null,
      peersPerStudent: d?.evaluatorType === 'PEER' ? Math.max(1, Math.min(Number(d.peersPerStudent) || 2, MAX_PEERS)) : null,
      criteria: (Array.isArray(d?.criteria) ? d.criteria : []).map((c: any) => ({
        name: text(c?.name, 160), description: text(c?.description, 600), weight: Number(c?.weight) || 0,
        levels: (Array.isArray(c?.levels) ? c.levels : []).map((l: any) => ({ label: text(l?.label, 80), description: text(l?.description, 400), score: Number(l?.score) }))
          .filter((l: any) => l.label && Number.isFinite(l.score)),
      })).filter((c: any) => c.name && c.levels.length >= 2),
    })).filter((d: any) => d.label && d.criteria.length);
    if (!dimensions.length) throw new BadRequestException('La IA devolvió un borrador incompleto; intenta reformular la solicitud');
    return { title: text(draft.title, 180) || 'Evaluación formativa', description: text(draft.description, 1500), dimensions, source: 'AI', requiresTeacherReview: true };
  }

  /** Valida lo que se puede validar ANTES de escribir nada: así un período o aula inválidos no
   * dejan plantillas de rúbrica huérfanas. */
  private async assertCanCreate(institutionId: string, userId: string, body: any) {
    if (!text(body?.title, 180)) throw new BadRequestException('Debes indicar un título');
    const classroom = await this.teacherClassroom(body?.classroomId, institutionId, userId);
    const term = await this.prisma.academicTerm.findFirst({ where: { id: body?.academicTermId, academicYearId: classroom.teacherAssignment.academicYearId } });
    if (!term) throw new BadRequestException('El período no pertenece al año académico del aula');
    return { classroom, term };
  }

  /** Materializa un borrador ya revisado por el docente: crea plantillas privadas y el ciclo en DRAFT. */
  async createFromAiDraft(institutionId: string, userId: string, body: any) {
    const prepared = this.prepareDraft(body);
    await this.assertCanCreate(institutionId, userId, body);
    const rubricIds = await this.createDraftRubrics(institutionId, userId, text(body.title, 180), prepared);
    return this.create(institutionId, userId, {
      ...body,
      dimensions: prepared.map(({ d, label }, index) => ({ ...d, label, rubricId: rubricIds[index] })),
    });
  }

  /** El borrador completo (con sus preguntas) para verlo o editarlo. */
  async getForTeacher(id: string, institutionId: string, userId: string) {
    const activity = await this.activityForTeacher(id, institutionId, userId);
    return {
      id: activity.id, title: activity.title, description: activity.description, status: activity.status, academicTermId: activity.academicTermId,
      dimensions: activity.dimensions.map(d => ({ id: d.id, label: d.label, evaluatorType: d.evaluatorType, peersPerStudent: d.peersPerStudent, rubricSnapshot: d.rubricSnapshot })),
    };
  }

  /** Mientras siga en borrador, el docente puede cambiar título, período y preguntas. Las
   * plantillas anteriores se desactivan (no se borran) si nadie más las usa. */
  async updateDraft(id: string, institutionId: string, userId: string, body: any) {
    const activity = await this.activityForTeacher(id, institutionId, userId);
    if (activity.status !== 'DRAFT') throw new BadRequestException('Solo se puede editar una evaluación en borrador');
    const payload = { ...body, classroomId: activity.classroomId };
    const prepared = this.prepareDraft(payload);
    const { term } = await this.assertCanCreate(institutionId, userId, payload);
    const rubricIds = await this.createDraftRubrics(institutionId, userId, text(body.title, 180), prepared);
    const dimensions = prepared.map(({ d, label }, index) => sanitizeDimensionInput({ ...d, label, rubricId: rubricIds[index], evaluationComponentId: null }));
    const rubrics = await this.rubricsWithCriteria(institutionId, rubricIds);
    const oldRubricIds = activity.dimensions.map(d => d.rubricId).filter((r): r is string => !!r);
    await this.prisma.$transaction(async tx => {
      await tx.formativeEvaluationDimension.deleteMany({ where: { activityId: id } });
      await tx.formativeEvaluationActivity.update({ where: { id }, data: {
        title: text(body.title, 180), description: text(body.description, 1500) || null, academicTermId: term.id,
        dimensions: { create: this.dimensionRows(dimensions, rubrics) },
      } });
      await this.retireRubrics(tx, institutionId, oldRubricIds);
    });
    return this.getForTeacher(id, institutionId, userId);
  }

  /** Un borrador que no se publicó se puede eliminar (p. ej. uno creado por error o repetido). */
  async deleteDraft(id: string, institutionId: string, userId: string) {
    const activity = await this.activityForTeacher(id, institutionId, userId);
    if (activity.status !== 'DRAFT') throw new BadRequestException('Solo se puede eliminar una evaluación en borrador');
    const oldRubricIds = activity.dimensions.map(d => d.rubricId).filter((r): r is string => !!r);
    await this.prisma.$transaction(async tx => {
      await tx.formativeEvaluationActivity.delete({ where: { id } });
      await this.retireRubrics(tx, institutionId, oldRubricIds);
    });
    return { deleted: true };
  }

  private async retireRubrics(tx: Prisma.TransactionClient, institutionId: string, ids: string[]) {
    if (!ids.length) return;
    await tx.attitudinalRubric.updateMany({
      where: { id: { in: ids }, institutionId, formativeDimensions: { none: {} }, activities: { none: {} }, submissions: { none: {} } },
      data: { isActive: false },
    });
  }

  private rubricsWithCriteria(institutionId: string, ids: string[]) {
    return this.prisma.attitudinalRubric.findMany({
      where: { id: { in: ids }, institutionId, isActive: true },
      include: { criteria: { include: { levels: { orderBy: { order: 'asc' } } }, orderBy: { order: 'asc' } } },
    });
  }

  private dimensionRows(dimensions: DimensionInput[], rubrics: Array<{ id: string }>) {
    return dimensions.map((d, order) => ({
      label: d.label, evaluatorType: d.evaluatorType, rubricId: d.rubricId, evaluationComponentId: d.evaluationComponentId,
      peersPerStudent: d.peersPerStudent, revealEvaluator: !!d.revealEvaluator, requireCommentReview: d.requireCommentReview !== false,
      allowIncomplete: !!d.allowIncomplete, order,
      rubricSnapshot: rubrics.find(r => r.id === d.rubricId) as unknown as Prisma.InputJsonValue,
    }));
  }

  /** Valida las dimensiones de un borrador antes de escribir nada. */
  private prepareDraft(body: any): Array<{ d: any; label: string; criteria: any[] }> {
    const draftDimensions = Array.isArray(body?.dimensions) ? body.dimensions : [];
    if (!draftDimensions.length) throw new BadRequestException('El borrador no contiene dimensiones');
    return draftDimensions.map((d: any, index: number) => {
      const label = text(d?.label, 120) || `Dimensión ${index + 1}`;
      const criteria = Array.isArray(d?.criteria) ? d.criteria : [];
      const weight = criteria.reduce((sum: number, c: any) => sum + Number(c?.weight || 0), 0);
      if (!criteria.length || Math.abs(weight - 100) > 0.01) throw new BadRequestException(`Los criterios de "${label}" deben sumar 100%`);
      if (criteria.length > MAX_QUESTIONS) throw new BadRequestException(`"${label}" tiene más de ${MAX_QUESTIONS} preguntas`);
      for (const c of criteria) {
        const levels = Array.isArray(c?.levels) ? c.levels : [];
        if (!text(c?.name, 160) || levels.length < 2 || levels.some((l: any) => !text(l?.label, 80) || !Number.isFinite(Number(l?.score)))) {
          throw new BadRequestException(`Revisa los criterios de "${label}": cada uno necesita nombre y al menos dos niveles con puntaje`);
        }
      }
      return { d, label, criteria };
    });
  }

  private async createDraftRubrics(institutionId: string, userId: string, title: string, prepared: Array<{ d: any; label: string; criteria: any[] }>) {
    // El nombre de la plantilla es único por institución: repetir el título de una evaluación
    // (o dos dimensiones con la misma etiqueta) no debe romper la creación con un 500.
    const bases: string[] = prepared.map(({ label }) => `${title} — ${label}`.slice(0, 170));
    const taken = new Set((await this.prisma.attitudinalRubric.findMany({
      where: { institutionId, OR: [...new Set(bases)].map(base => ({ name: { startsWith: base } })) },
      select: { name: true },
    })).map(r => r.name));
    const names = bases.map((base: string) => {
      let name = base;
      for (let n = 2; taken.has(name); n++) name = `${base} (${n})`;
      taken.add(name);
      return name;
    });
    return this.prisma.$transaction(async tx => {
      const ids: string[] = [];
      for (const [index, { d, label, criteria }] of prepared.entries()) {
        const rubric = await tx.attitudinalRubric.create({ data: {
          institutionId, createdById: userId, name: names[index],
          type: d?.evaluatorType === 'PEER' ? 'PEER_ASSESSMENT' : 'SELF_ASSESSMENT', targetProcess: label,
          criteria: { create: criteria.map((c: any, order: number) => ({
            name: text(c.name, 160), description: text(c.description, 600) || null, weight: Number(c.weight), order,
            levels: { create: c.levels.map((l: any, levelOrder: number) => ({ score: Number(l.score), label: text(l.label, 80), description: text(l.description, 400) || null, order: levelOrder })) },
          })) },
        } });
        ids.push(rubric.id);
      }
      return ids;
    });
  }

  private async activityForTeacher(id: string, institutionId: string, userId: string) {
    const activity = await this.prisma.formativeEvaluationActivity.findFirst({
      where: { id, institutionId, teacherAssignment: { teacherId: userId } },
      include: { dimensions: { orderBy: { order: 'asc' } }, teacherAssignment: true },
    });
    if (!activity) throw new ForbiddenException('Evaluación no encontrada o sin permisos');
    return activity;
  }

  async listForClassroom(classroomId: string, institutionId: string, userId: string, role: 'teacher' | 'student') {
    if (role === 'teacher') {
      await this.teacherClassroom(classroomId, institutionId, userId);
      return this.prisma.formativeEvaluationActivity.findMany({
        where: { classroomId, institutionId },
        include: { academicTerm: { select: { name: true } }, dimensions: { orderBy: { order: 'asc' }, include: { evaluationComponent: { select: { code: true, name: true } } } }, _count: { select: { assignments: true, results: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }
    const enrollment = await this.activeEnrollment(institutionId, userId);
    return this.prisma.formativeEvaluationActivity.findMany({
      where: {
        classroomId, institutionId, status: { in: ['PUBLISHED', 'IN_PROGRESS'] },
        teacherAssignment: { groupId: enrollment.groupId, academicYearId: enrollment.academicYearId },
        assignments: { some: { evaluatorEnrollmentId: enrollment.id } },
      },
      select: {
        id: true, title: true, description: true, status: true, opensAt: true, closesAt: true, publishedAt: true,
        assignments: {
          where: { evaluatorEnrollmentId: enrollment.id },
          select: {
            id: true, status: true, submittedAt: true,
            dimension: { select: { id: true, label: true, evaluatorType: true, rubricSnapshot: true, revealEvaluator: true } },
            targetEnrollment: { select: { id: true, student: { select: { firstName: true, lastName: true } } } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async create(institutionId: string, userId: string, body: any) {
    const rawDimensions = Array.isArray(body?.dimensions) ? body.dimensions : [];
    if (!rawDimensions.length) throw new BadRequestException('Debes indicar al menos una dimensión');
    const dimensions = rawDimensions.map(sanitizeDimensionInput);
    const { classroom, term } = await this.assertCanCreate(institutionId, userId, body);
    const componentIds = dimensions.map((d: DimensionInput) => d.evaluationComponentId).filter(Boolean) as string[];
    if (componentIds.length) {
      const count = await this.prisma.evaluationComponent.count({ where: { id: { in: componentIds }, institutionId } });
      if (count !== new Set(componentIds).size) throw new BadRequestException('Un componente destino no pertenece a la institución');
    }
    const rubrics = await this.rubricsWithCriteria(institutionId, dimensions.map((d: DimensionInput) => d.rubricId));
    if (rubrics.length !== new Set(dimensions.map((d: DimensionInput) => d.rubricId)).size) throw new BadRequestException('Una rúbrica no está disponible para la institución');
    return this.prisma.formativeEvaluationActivity.create({ data: {
      institutionId, classroomId: classroom.id, teacherAssignmentId: classroom.teacherAssignmentId, academicTermId: term.id,
      title: text(body.title, 180), description: text(body.description, 1500) || null, createdById: userId,
      opensAt: body.opensAt ? new Date(body.opensAt) : null, closesAt: body.closesAt ? new Date(body.closesAt) : null,
      dimensions: { create: this.dimensionRows(dimensions, rubrics) },
    }, include: { dimensions: true } });
  }

  /** Mientras siga en borrador, el docente puede corregir el destino en la planilla. */
  async updateDimensionComponent(activityId: string, dimensionId: string, institutionId: string, userId: string, evaluationComponentId: string | null) {
    const activity = await this.activityForTeacher(activityId, institutionId, userId);
    if (['SYNCED'].includes(activity.status)) throw new BadRequestException('La evaluación ya se sincronizó con la planilla');
    const dimension = activity.dimensions.find(d => d.id === dimensionId);
    if (!dimension) throw new BadRequestException('La dimensión no pertenece a esta evaluación');
    if (dimension.gradebookActivityIndex != null) throw new BadRequestException('Esta dimensión ya tiene una columna en la planilla');
    if (evaluationComponentId) {
      const component = await this.prisma.evaluationComponent.findFirst({ where: { id: evaluationComponentId, institutionId } });
      if (!component) throw new BadRequestException('El componente no pertenece a la institución');
    }
    return this.prisma.formativeEvaluationDimension.update({ where: { id: dimensionId }, data: { evaluationComponentId: evaluationComponentId || null } });
  }

  private async groupStudents(activity: { teacherAssignment: { groupId: string; academicYearId: string } }, institutionId: string) {
    return this.prisma.studentEnrollment.findMany({
      where: { institutionId, groupId: activity.teacherAssignment.groupId, academicYearId: activity.teacherAssignment.academicYearId, status: 'ACTIVE' },
      select: { id: true, student: { select: { firstName: true, lastName: true } } },
      orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
    });
  }

  /** Propuesta de reparto automático antes de publicar. El docente la ve, puede volver a sortear
   * (otra semilla) o usarla como punto de partida del reparto manual. */
  async peerPreview(id: string, institutionId: string, userId: string, seed?: string) {
    const activity = await this.activityForTeacher(id, institutionId, userId);
    if (activity.status !== 'DRAFT') throw new BadRequestException('Solo se puede preparar el reparto de un borrador');
    const students = await this.groupStudents(activity, institutionId);
    const ids = students.map(s => s.id);
    const useSeed = typeof seed === 'string' && seed.length >= 8 && seed.length <= 64 ? seed : randomUUID();
    const peerDimensions = activity.dimensions.filter(d => d.evaluatorType === 'PEER');
    return {
      seed: useSeed,
      students: students.map(s => ({ id: s.id, name: `${s.student.firstName} ${s.student.lastName}`.trim() })),
      dimensions: peerDimensions.map(d => ({
        id: d.id, label: d.label, peersPerStudent: d.peersPerStudent || 1,
        pairs: ids.length >= 2 ? shuffledPeerRing(ids, d.peersPerStudent || 1, useSeed + ':' + d.id) : [],
      })),
    };
  }

  async publish(id: string, institutionId: string, userId: string, body?: { peer?: PeerPlanInput }) {
    const activity = await this.activityForTeacher(id, institutionId, userId);
    if (activity.status !== 'DRAFT') throw new BadRequestException('Solo se puede publicar un borrador');
    const students = await this.groupStudents(activity, institutionId);
    if (!students.length) throw new BadRequestException('No hay estudiantes activos en el grupo');
    const ids = students.map(s => s.id);
    const peerDimensions = activity.dimensions.filter(d => d.evaluatorType === 'PEER');
    const manual = body?.peer?.mode === 'manual';
    const seed = typeof body?.peer?.seed === 'string' && body.peer.seed.length >= 8 && body.peer.seed.length <= 64 ? body.peer.seed : randomUUID();
    const manualPairs = manual ? validateManualPairs(body?.peer?.pairs, peerDimensions.map(d => d.id), ids) : [];
    const assignments: Prisma.FormativeEvaluationAssignmentCreateManyInput[] = [];
    for (const dimension of activity.dimensions) {
      if (dimension.evaluatorType === 'SELF') ids.forEach(studentId => assignments.push({ activityId: id, dimensionId: dimension.id, evaluatorEnrollmentId: studentId, targetEnrollmentId: studentId }));
      else if (dimension.evaluatorType === 'PEER') {
        const pairs = manual ? manualPairs.filter(p => p.dimensionId === dimension.id) : shuffledPeerRing(ids, dimension.peersPerStudent || 1, seed + ':' + dimension.id);
        pairs.forEach(({ evaluator, target }) => assignments.push({ activityId: id, dimensionId: dimension.id, evaluatorEnrollmentId: evaluator, targetEnrollmentId: target }));
      }
      else throw new BadRequestException('Esta evaluación tiene una dimensión que todavía no se puede publicar');
    }
    const algorithmVersion = peerDimensions.length ? (manual ? 'peer-manual-v1' : 'peer-shuffled-ring-v1') : 'self-only-v1';
    await this.prisma.$transaction(async tx => {
      await tx.formativeEvaluationAssignment.createMany({ data: assignments });
      await tx.formativeEvaluationActivity.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date(), publishedById: userId, assignmentSeed: manual ? null : seed, algorithmVersion } });
    });
    return { published: true, assignments: assignments.length, algorithmVersion };
  }

  async submit(assignmentId: string, institutionId: string, userId: string, body: { answers: Array<{ criterionId: string; levelId: string }>; comments?: Array<{ prompt?: string; text: string }> }) {
    const enrollment = await this.activeEnrollment(institutionId, userId);
    const assignment = await this.prisma.formativeEvaluationAssignment.findFirst({
      where: { id: assignmentId, evaluatorEnrollmentId: enrollment.id, activity: { institutionId, status: { in: ['PUBLISHED', 'IN_PROGRESS'] } } },
      include: { dimension: true, activity: { select: { opensAt: true, closesAt: true } } },
    });
    if (!assignment) throw new ForbiddenException('Asignación no disponible');
    if (assignment.status !== 'PENDING') throw new BadRequestException('Esta evaluación ya fue enviada');
    const now = new Date();
    if (assignment.activity.opensAt && now < assignment.activity.opensAt) throw new BadRequestException('Esta evaluación todavía no está abierta');
    if (assignment.activity.closesAt && now > assignment.activity.closesAt) throw new BadRequestException('El plazo para responder terminó');
    const rubric: any = assignment.dimension.rubricSnapshot;
    const score = scoreAnswers(rubric?.criteria || [], body?.answers);
    const comments = (Array.isArray(body?.comments) ? body.comments : []).slice(0, 5)
      .map(c => ({ prompt: text(c?.prompt, 120) || 'Comentario', text: text(c?.text, MAX_COMMENT) })).filter(c => c.text);
    return this.prisma.formativeEvaluationAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'SUBMITTED', submittedAt: now, answers: body.answers as unknown as Prisma.InputJsonValue,
        qualitativeComments: comments as unknown as Prisma.InputJsonValue, calculatedScore: score,
        commentStatus: assignment.dimension.requireCommentReview && comments.length ? 'PENDING_REVIEW' : 'APPROVED',
      },
      select: { id: true, status: true, submittedAt: true },
    });
  }

  async consolidate(id: string, institutionId: string, userId: string) {
    const activity = await this.activityForTeacher(id, institutionId, userId);
    if (!['PUBLISHED', 'IN_PROGRESS', 'CLOSED', 'CONSOLIDATED', 'CHANGED_AFTER_SYNC'].includes(activity.status)) throw new BadRequestException('Esta evaluación no se puede consolidar en su estado actual');
    const assignments = await this.prisma.formativeEvaluationAssignment.findMany({ where: { activityId: id, status: { not: 'EXEMPTED' } } });
    const results: Prisma.FormativeEvaluationResultCreateManyInput[] = [];
    for (const dimension of activity.dimensions) {
      for (const target of new Set(assignments.filter(a => a.dimensionId === dimension.id).map(a => a.targetEnrollmentId))) {
        const rows = assignments.filter(a => a.dimensionId === dimension.id && a.targetEnrollmentId === target);
        const done = rows.filter(a => a.status === 'SUBMITTED');
        // Faltantes nunca cuentan como 0: sin todas las respuestas (o sin permiso de incompleto) no hay nota.
        const ready = (dimension.allowIncomplete || done.length === rows.length) && done.length > 0;
        results.push({
          activityId: id, dimensionId: dimension.id, studentEnrollmentId: target,
          quantitativeScore: ready ? Math.round((done.reduce((n, a) => n + Number(a.calculatedScore), 0) / done.length) * 100) / 100 : null,
          expectedResponses: rows.length, receivedResponses: done.length, isReady: ready, consolidatedAt: new Date(),
        });
      }
    }
    await this.prisma.$transaction(async tx => {
      await tx.formativeEvaluationResult.deleteMany({ where: { activityId: id, consolidationVersion: 1, syncItems: { none: {} } } });
      for (const result of results) {
        await tx.formativeEvaluationResult.upsert({
          where: { dimensionId_studentEnrollmentId_consolidationVersion: { dimensionId: result.dimensionId, studentEnrollmentId: result.studentEnrollmentId, consolidationVersion: 1 } },
          create: result,
          update: { quantitativeScore: result.quantitativeScore, expectedResponses: result.expectedResponses, receivedResponses: result.receivedResponses, isReady: result.isReady, consolidatedAt: result.consolidatedAt },
        });
      }
      await tx.formativeEvaluationActivity.update({ where: { id }, data: { status: 'CONSOLIDATED', consolidatedAt: new Date() } });
    });
    return this.dashboard(id, institutionId, userId);
  }

  async previewSync(id: string, institutionId: string, userId: string) {
    const activity = await this.activityForTeacher(id, institutionId, userId);
    if (!['CONSOLIDATED', 'SYNCED', 'CHANGED_AFTER_SYNC'].includes(activity.status)) throw new BadRequestException('Primero debes consolidar la evaluación');
    const term = await this.prisma.academicTerm.findUnique({ where: { id: activity.academicTermId }, select: { status: true, name: true } });
    if (!term || term.status !== 'OPEN') throw new BadRequestException('Solo se puede sincronizar con un período abierto');
    const results = await this.prisma.formativeEvaluationResult.findMany({
      where: { activityId: id, consolidationVersion: 1 },
      include: { dimension: { include: { evaluationComponent: true } }, studentEnrollment: { include: { student: { select: { firstName: true, lastName: true } } } } },
      orderBy: [{ dimensionId: 'asc' }, { studentEnrollmentId: 'asc' }],
    });
    const rows = results.map(r => ({
      resultId: r.id, studentEnrollmentId: r.studentEnrollmentId, studentName: `${r.studentEnrollment.student.firstName} ${r.studentEnrollment.student.lastName}`,
      dimensionId: r.dimensionId, dimensionLabel: r.dimension.label, componentId: r.dimension.evaluationComponentId, componentCode: r.dimension.evaluationComponent?.code ?? null,
      componentName: r.dimension.evaluationComponent?.name ?? null, score: r.quantitativeScore === null ? null : Number(r.quantitativeScore), ready: r.isReady,
    }));
    const hash = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
    return {
      hash, term: term.name, rows,
      summary: {
        ready: rows.filter(r => r.ready && r.componentId && r.score !== null).length,
        incomplete: rows.filter(r => !r.ready).length,
        withoutComponent: rows.filter(r => r.ready && !r.componentId).length,
      },
    };
  }

  async sync(id: string, institutionId: string, userId: string, body: { idempotencyKey: string; previewHash: string }) {
    if (!body?.idempotencyKey || !body?.previewHash) throw new BadRequestException('Confirma la previsualización con una clave idempotente');
    const previous = await this.prisma.formativeGradeSync.findUnique({ where: { institutionId_idempotencyKey: { institutionId, idempotencyKey: body.idempotencyKey } }, include: { items: true } });
    if (previous) {
      if (previous.activityId !== id) throw new BadRequestException('Esa clave ya se usó para otra evaluación');
      return previous;
    }
    const preview = await this.previewSync(id, institutionId, userId);
    if (preview.hash !== body.previewHash) throw new BadRequestException('La previsualización cambió; vuelve a confirmarla');
    const activity = await this.activityForTeacher(id, institutionId, userId);
    let sync;
    try {
      sync = await this.prisma.formativeGradeSync.create({ data: { activityId: id, institutionId, idempotencyKey: body.idempotencyKey, previewHash: preview.hash, requestedById: userId, status: 'PROCESSING' } });
    } catch (error) {
      // Dos solicitudes con la misma clave al mismo tiempo: la segunda devuelve la primera.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.formativeGradeSync.findUnique({ where: { institutionId_idempotencyKey: { institutionId, idempotencyKey: body.idempotencyKey } }, include: { items: true } });
      }
      throw error;
    }
    const items: Prisma.FormativeGradeSyncItemCreateManyInput[] = [];
    const errors: string[] = [];
    for (const row of preview.rows.filter(r => r.ready && r.componentId && r.componentCode && r.score !== null)) {
      const dimension = activity.dimensions.find(d => d.id === row.dimensionId)!;
      try {
        if (dimension.gradebookActivityIndex == null) {
          const latest = await this.prisma.partialGrade.aggregate({ where: { teacherAssignmentId: activity.teacherAssignmentId, academicTermId: activity.academicTermId, componentType: row.componentCode! }, _max: { activityIndex: true } });
          dimension.gradebookActivityIndex = Math.max((latest._max.activityIndex || 0) + 1, 1);
          await this.prisma.formativeEvaluationDimension.update({ where: { id: dimension.id }, data: { gradebookActivityIndex: dimension.gradebookActivityIndex } });
        }
        const grade = await this.partialGrades.upsert({ studentEnrollmentId: row.studentEnrollmentId, teacherAssignmentId: activity.teacherAssignmentId, academicTermId: activity.academicTermId, componentType: row.componentCode!, activityIndex: dimension.gradebookActivityIndex, activityName: `${activity.title} · ${dimension.label}`.slice(0, 180), activityType: 'FORMATIVE_RUBRIC', score: row.score! }, { userId, role: 'DOCENTE' });
        if ((grade as any).conflict) throw new Error('Conflicto de edición en la planilla');
        await this.partialGrades.recomputePeriodFinalGrade({ studentEnrollmentId: row.studentEnrollmentId, teacherAssignmentId: activity.teacherAssignmentId, academicTermId: activity.academicTermId });
        items.push({ syncId: sync.id, resultId: row.resultId, destinationComponentId: row.componentId!, activityIndex: dimension.gradebookActivityIndex, scoreSent: row.score, status: 'APPLIED', partialGradeId: (grade as any).id ?? null });
      } catch (e: any) {
        errors.push(`${row.studentName}: ${e?.message || 'error'}`);
        items.push({ syncId: sync.id, resultId: row.resultId, destinationComponentId: row.componentId!, activityIndex: dimension.gradebookActivityIndex || 0, scoreSent: row.score, status: 'ERROR', errorDetail: e?.message || 'error' });
      }
    }
    if (items.length) await this.prisma.formativeGradeSyncItem.createMany({ data: items });
    const status = errors.length ? (items.some(i => i.status === 'APPLIED') ? 'PARTIAL_FAILURE' : 'FAILED') : 'COMPLETED';
    await this.prisma.formativeGradeSync.update({ where: { id: sync.id }, data: { status, completedAt: new Date(), errorSummary: errors.join('\n') || null } });
    if (!errors.length) await this.prisma.formativeEvaluationActivity.update({ where: { id }, data: { status: 'SYNCED' } });
    return this.prisma.formativeGradeSync.findUnique({ where: { id: sync.id }, include: { items: true } });
  }

  async dashboard(id: string, institutionId: string, userId: string) {
    await this.activityForTeacher(id, institutionId, userId);
    return this.prisma.formativeEvaluationActivity.findFirst({
      where: { id, institutionId },
      include: {
        academicTerm: { select: { name: true, status: true } },
        dimensions: { orderBy: { order: 'asc' }, include: { evaluationComponent: { select: { id: true, code: true, name: true } } } },
        results: { include: { studentEnrollment: { include: { student: { select: { firstName: true, lastName: true } } } } } },
        assignments: { select: { dimensionId: true, status: true, targetEnrollmentId: true, qualitativeComments: true } },
      },
    });
  }
}
