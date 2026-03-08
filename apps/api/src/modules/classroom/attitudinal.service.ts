import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AttitudinalRubricType } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════
// DTOs
// ═══════════════════════════════════════════════════════════════════════════

interface CreateRubricDto {
  institutionId: string;
  name: string;
  description?: string;
  type: AttitudinalRubricType;
  targetProcess?: string;
  isDefault?: boolean;
  createdById?: string;
  criteria: {
    name: string;
    description?: string;
    weight: number;
    order: number;
    levels: {
      score: number;
      label: string;
      description?: string;
      order: number;
    }[];
  }[];
}

interface UpdateRubricDto {
  name?: string;
  description?: string;
  targetProcess?: string;
  isDefault?: boolean;
  isActive?: boolean;
  criteria?: {
    id?: string;
    name: string;
    description?: string;
    weight: number;
    order: number;
    levels: {
      id?: string;
      score: number;
      label: string;
      description?: string;
      order: number;
    }[];
  }[];
}

interface SubmitSelfAssessmentDto {
  activityId: string;
  evaluatorEnrollmentId: string;
  responses: { criterionId: string; levelId: string }[];
  reflection?: string;
}

interface SubmitPeerAssessmentDto {
  activityId: string;
  evaluatorEnrollmentId: string;
  targetEnrollmentId: string;
  responses: { criterionId: string; levelId: string }[];
  reflection?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class AttitudinalService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // RÚBRICAS CRUD
  // ─────────────────────────────────────────────────────────────────────────

  async createRubric(dto: CreateRubricDto) {
    // Validar que los pesos sumen 100
    const totalWeight = dto.criteria.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight !== 100) {
      throw new BadRequestException(`Los pesos de los criterios deben sumar 100% (actual: ${totalWeight}%)`);
    }

    // Si es default, quitar default de otras rúbricas del mismo tipo
    if (dto.isDefault) {
      await this.prisma.attitudinalRubric.updateMany({
        where: { institutionId: dto.institutionId, type: dto.type, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.attitudinalRubric.create({
      data: {
        institutionId: dto.institutionId,
        name: dto.name,
        description: dto.description,
        type: dto.type,
        targetProcess: dto.targetProcess,
        isDefault: dto.isDefault ?? false,
        createdById: dto.createdById,
        criteria: {
          create: dto.criteria.map((c) => ({
            name: c.name,
            description: c.description,
            weight: c.weight,
            order: c.order,
            levels: {
              create: c.levels.map((l) => ({
                score: l.score,
                label: l.label,
                description: l.description,
                order: l.order,
              })),
            },
          })),
        },
      },
      include: {
        criteria: {
          include: { levels: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async listRubrics(institutionId: string, type?: AttitudinalRubricType) {
    return this.prisma.attitudinalRubric.findMany({
      where: {
        institutionId,
        isActive: true,
        ...(type && { type }),
      },
      include: {
        criteria: {
          include: { levels: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
        _count: { select: { activities: true, submissions: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async getRubric(id: string) {
    const rubric = await this.prisma.attitudinalRubric.findUnique({
      where: { id },
      include: {
        criteria: {
          include: { levels: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!rubric) throw new NotFoundException('Rúbrica no encontrada');
    return rubric;
  }

  async updateRubric(id: string, dto: UpdateRubricDto) {
    const existing = await this.prisma.attitudinalRubric.findUnique({
      where: { id },
      include: { criteria: true },
    });
    if (!existing) throw new NotFoundException('Rúbrica no encontrada');

    // Si se actualiza isDefault a true, quitar de otras
    if (dto.isDefault) {
      await this.prisma.attitudinalRubric.updateMany({
        where: { institutionId: existing.institutionId, type: existing.type, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    // Si se envían criterios, validar pesos
    if (dto.criteria) {
      const totalWeight = dto.criteria.reduce((sum, c) => sum + c.weight, 0);
      if (totalWeight !== 100) {
        throw new BadRequestException(`Los pesos de los criterios deben sumar 100% (actual: ${totalWeight}%)`);
      }

      // Eliminar criterios existentes y recrear (más simple que merge)
      await this.prisma.attitudinalCriterion.deleteMany({ where: { rubricId: id } });

      await this.prisma.attitudinalCriterion.createMany({
        data: dto.criteria.map((c) => ({
          rubricId: id,
          name: c.name,
          description: c.description,
          weight: c.weight,
          order: c.order,
        })),
      });

      // Crear niveles para cada criterio
      const newCriteria = await this.prisma.attitudinalCriterion.findMany({ where: { rubricId: id } });
      for (let i = 0; i < dto.criteria.length; i++) {
        const criterion = newCriteria.find((c) => c.order === dto.criteria![i].order);
        if (criterion && dto.criteria[i].levels) {
          await this.prisma.criterionLevel.createMany({
            data: dto.criteria[i].levels.map((l) => ({
              criterionId: criterion.id,
              score: l.score,
              label: l.label,
              description: l.description,
              order: l.order,
            })),
          });
        }
      }
    }

    return this.prisma.attitudinalRubric.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        targetProcess: dto.targetProcess,
        isDefault: dto.isDefault,
        isActive: dto.isActive,
      },
      include: {
        criteria: {
          include: { levels: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async deleteRubric(id: string) {
    // Verificar que no tenga submissions
    const submissionCount = await this.prisma.attitudinalSubmission.count({ where: { rubricId: id } });
    if (submissionCount > 0) {
      throw new BadRequestException(`No se puede eliminar la rúbrica porque tiene ${submissionCount} evaluaciones asociadas. Desactívela en su lugar.`);
    }

    return this.prisma.attitudinalRubric.delete({ where: { id } });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RÚBRICAS POR DEFECTO (SEED)
  // ─────────────────────────────────────────────────────────────────────────

  async seedDefaultRubrics(institutionId: string, createdById?: string) {
    const existing = await this.prisma.attitudinalRubric.count({ where: { institutionId } });
    if (existing > 0) return { message: 'Ya existen rúbricas para esta institución', created: 0 };

    const defaultRubrics: CreateRubricDto[] = [
      {
        institutionId,
        name: 'Autoevaluación - Actitud Personal',
        description: 'Rúbrica para que el estudiante evalúe su actitud personal en clase',
        type: 'SELF_ASSESSMENT',
        targetProcess: 'Autoevaluación',
        isDefault: true,
        createdById,
        criteria: [
          {
            name: 'Responsabilidad',
            description: 'Cumplimiento de tareas y compromisos académicos',
            weight: 25,
            order: 0,
            levels: [
              { score: 5, label: 'Siempre', description: 'Siempre cumplo con mis tareas y compromisos', order: 0 },
              { score: 4, label: 'Casi siempre', description: 'Casi siempre cumplo con mis tareas', order: 1 },
              { score: 3, label: 'A veces', description: 'A veces cumplo con mis tareas', order: 2 },
              { score: 2, label: 'Rara vez', description: 'Rara vez cumplo con mis tareas', order: 3 },
              { score: 1, label: 'Nunca', description: 'No cumplo con mis tareas', order: 4 },
            ],
          },
          {
            name: 'Participación',
            description: 'Participación activa en clase',
            weight: 25,
            order: 1,
            levels: [
              { score: 5, label: 'Siempre', description: 'Siempre participo activamente', order: 0 },
              { score: 4, label: 'Casi siempre', description: 'Casi siempre participo', order: 1 },
              { score: 3, label: 'A veces', description: 'A veces participo', order: 2 },
              { score: 2, label: 'Rara vez', description: 'Rara vez participo', order: 3 },
              { score: 1, label: 'Nunca', description: 'No participo en clase', order: 4 },
            ],
          },
          {
            name: 'Respeto',
            description: 'Respeto hacia compañeros y docentes',
            weight: 25,
            order: 2,
            levels: [
              { score: 5, label: 'Siempre', description: 'Siempre muestro respeto', order: 0 },
              { score: 4, label: 'Casi siempre', description: 'Casi siempre muestro respeto', order: 1 },
              { score: 3, label: 'A veces', description: 'A veces muestro respeto', order: 2 },
              { score: 2, label: 'Rara vez', description: 'Rara vez muestro respeto', order: 3 },
              { score: 1, label: 'Nunca', description: 'No muestro respeto', order: 4 },
            ],
          },
          {
            name: 'Puntualidad',
            description: 'Llegada a tiempo a clases y entrega de trabajos',
            weight: 25,
            order: 3,
            levels: [
              { score: 5, label: 'Siempre', description: 'Siempre soy puntual', order: 0 },
              { score: 4, label: 'Casi siempre', description: 'Casi siempre soy puntual', order: 1 },
              { score: 3, label: 'A veces', description: 'A veces soy puntual', order: 2 },
              { score: 2, label: 'Rara vez', description: 'Rara vez soy puntual', order: 3 },
              { score: 1, label: 'Nunca', description: 'Nunca soy puntual', order: 4 },
            ],
          },
        ],
      },
      {
        institutionId,
        name: 'Coevaluación - Trabajo en Equipo',
        description: 'Rúbrica para evaluar el desempeño de compañeros en trabajo grupal',
        type: 'PEER_ASSESSMENT',
        targetProcess: 'Coevaluación',
        isDefault: true,
        createdById,
        criteria: [
          {
            name: 'Colaboración',
            description: 'Aporta ideas y ayuda al equipo',
            weight: 35,
            order: 0,
            levels: [
              { score: 5, label: 'Excelente', description: 'Siempre aporta y ayuda al equipo', order: 0 },
              { score: 4, label: 'Bueno', description: 'Frecuentemente aporta al equipo', order: 1 },
              { score: 3, label: 'Regular', description: 'A veces aporta al equipo', order: 2 },
              { score: 2, label: 'Deficiente', description: 'Rara vez aporta al equipo', order: 3 },
              { score: 1, label: 'Insuficiente', description: 'No aporta al equipo', order: 4 },
            ],
          },
          {
            name: 'Responsabilidad',
            description: 'Cumple con las tareas asignadas dentro del grupo',
            weight: 35,
            order: 1,
            levels: [
              { score: 5, label: 'Excelente', description: 'Siempre cumple sus tareas', order: 0 },
              { score: 4, label: 'Bueno', description: 'Frecuentemente cumple', order: 1 },
              { score: 3, label: 'Regular', description: 'A veces cumple', order: 2 },
              { score: 2, label: 'Deficiente', description: 'Rara vez cumple', order: 3 },
              { score: 1, label: 'Insuficiente', description: 'No cumple sus tareas', order: 4 },
            ],
          },
          {
            name: 'Comunicación',
            description: 'Se comunica efectivamente con el equipo',
            weight: 30,
            order: 2,
            levels: [
              { score: 5, label: 'Excelente', description: 'Comunicación clara y constante', order: 0 },
              { score: 4, label: 'Bueno', description: 'Buena comunicación', order: 1 },
              { score: 3, label: 'Regular', description: 'Comunicación aceptable', order: 2 },
              { score: 2, label: 'Deficiente', description: 'Poca comunicación', order: 3 },
              { score: 1, label: 'Insuficiente', description: 'No se comunica', order: 4 },
            ],
          },
        ],
      },
    ];

    let created = 0;
    for (const rubric of defaultRubrics) {
      await this.createRubric(rubric);
      created++;
    }

    return { message: `Se crearon ${created} rúbricas por defecto`, created };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AUTOEVALUACIÓN
  // ─────────────────────────────────────────────────────────────────────────

  async submitSelfAssessment(dto: SubmitSelfAssessmentDto) {
    // Verificar actividad existe y es SELF_ASSESSMENT
    const activity = await this.prisma.classroomActivity.findUnique({
      where: { id: dto.activityId },
      include: { rubric: { include: { criteria: true } } },
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    if (activity.type !== 'SELF_ASSESSMENT') {
      throw new BadRequestException('Esta actividad no es de autoevaluación');
    }
    if (!activity.rubricId || !activity.rubric) {
      throw new BadRequestException('La actividad no tiene una rúbrica asociada');
    }

    // Verificar que no haya enviado ya
    const existing = await this.prisma.attitudinalSubmission.findFirst({
      where: {
        activityId: dto.activityId,
        evaluatorEnrollmentId: dto.evaluatorEnrollmentId,
        targetEnrollmentId: null,
      },
    });
    if (existing) {
      throw new BadRequestException('Ya has enviado tu autoevaluación para esta actividad');
    }

    // Validar que todas las respuestas correspondan a criterios de la rúbrica
    const criteriaIds = activity.rubric.criteria.map((c) => c.id);
    for (const r of dto.responses) {
      if (!criteriaIds.includes(r.criterionId)) {
        throw new BadRequestException(`Criterio ${r.criterionId} no pertenece a esta rúbrica`);
      }
    }

    // Calcular nota ponderada
    const calculatedScore = await this.calculateScore(activity.rubricId, dto.responses);

    // Crear submission con respuestas
    const submission = await this.prisma.attitudinalSubmission.create({
      data: {
        activityId: dto.activityId,
        rubricId: activity.rubricId,
        evaluatorEnrollmentId: dto.evaluatorEnrollmentId,
        targetEnrollmentId: null, // null = autoevaluación
        reflection: dto.reflection,
        calculatedScore,
        responses: {
          create: dto.responses.map((r) => ({
            criterionId: r.criterionId,
            levelId: r.levelId,
          })),
        },
      },
      include: {
        responses: {
          include: {
            criterion: true,
            level: true,
          },
        },
      },
    });

    return submission;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // COEVALUACIÓN
  // ─────────────────────────────────────────────────────────────────────────

  async submitPeerAssessment(dto: SubmitPeerAssessmentDto) {
    // Verificar actividad
    const activity = await this.prisma.classroomActivity.findUnique({
      where: { id: dto.activityId },
      include: { rubric: { include: { criteria: true } } },
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');
    if (activity.type !== 'PEER_ASSESSMENT') {
      throw new BadRequestException('Esta actividad no es de coevaluación');
    }
    if (!activity.rubricId || !activity.rubric) {
      throw new BadRequestException('La actividad no tiene una rúbrica asociada');
    }

    // Verificar que el par esté asignado
    const pair = await this.prisma.peerAssessmentPair.findFirst({
      where: {
        activityId: dto.activityId,
        evaluatorEnrollmentId: dto.evaluatorEnrollmentId,
        targetEnrollmentId: dto.targetEnrollmentId,
      },
    });
    if (!pair) {
      throw new BadRequestException('No estás asignado para evaluar a este compañero');
    }
    if (pair.isCompleted) {
      throw new BadRequestException('Ya evaluaste a este compañero');
    }

    // Calcular nota
    const calculatedScore = await this.calculateScore(activity.rubricId, dto.responses);

    // Crear submission
    const submission = await this.prisma.attitudinalSubmission.create({
      data: {
        activityId: dto.activityId,
        rubricId: activity.rubricId,
        evaluatorEnrollmentId: dto.evaluatorEnrollmentId,
        targetEnrollmentId: dto.targetEnrollmentId,
        reflection: dto.reflection,
        calculatedScore,
        responses: {
          create: dto.responses.map((r) => ({
            criterionId: r.criterionId,
            levelId: r.levelId,
          })),
        },
      },
    });

    // Marcar par como completado
    await this.prisma.peerAssessmentPair.update({
      where: { id: pair.id },
      data: { isCompleted: true, completedAt: new Date() },
    });

    return submission;
  }

  async getPendingPeerAssessments(activityId: string, evaluatorEnrollmentId: string) {
    return this.prisma.peerAssessmentPair.findMany({
      where: {
        activityId,
        evaluatorEnrollmentId,
        isCompleted: false,
      },
      include: {
        targetEnrollment: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RESULTADOS Y SINCRONIZACIÓN
  // ─────────────────────────────────────────────────────────────────────────

  async getActivityResults(activityId: string) {
    const activity = await this.prisma.classroomActivity.findUnique({
      where: { id: activityId },
      include: {
        rubric: { include: { criteria: { include: { levels: true } } } },
        classroom: { include: { teacherAssignment: { include: { group: true } } } },
      },
    });
    if (!activity) throw new NotFoundException('Actividad no encontrada');

    const submissions = await this.prisma.attitudinalSubmission.findMany({
      where: { activityId },
      include: {
        evaluatorEnrollment: {
          include: { student: { select: { id: true, firstName: true, lastName: true } } },
        },
        targetEnrollment: {
          include: { student: { select: { id: true, firstName: true, lastName: true } } },
        },
        responses: {
          include: { criterion: true, level: true },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });

    // Para coevaluación, calcular promedio por estudiante evaluado
    let consolidatedScores: { studentId: string; studentName: string; averageScore: number; evaluationCount: number }[] = [];
    if (activity.type === 'PEER_ASSESSMENT') {
      const byTarget = new Map<string, { scores: number[]; name: string }>();
      for (const sub of submissions) {
        if (sub.targetEnrollmentId && sub.calculatedScore) {
          const key = sub.targetEnrollmentId;
          if (!byTarget.has(key)) {
            byTarget.set(key, {
              scores: [],
              name: `${sub.targetEnrollment?.student.firstName} ${sub.targetEnrollment?.student.lastName}`,
            });
          }
          byTarget.get(key)!.scores.push(Number(sub.calculatedScore));
        }
      }
      consolidatedScores = Array.from(byTarget.entries()).map(([studentId, data]) => ({
        studentId,
        studentName: data.name,
        averageScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        evaluationCount: data.scores.length,
      }));
    }

    return {
      activity,
      submissions,
      consolidatedScores,
      stats: {
        totalSubmissions: submissions.length,
        averageScore: submissions.length > 0
          ? submissions.reduce((sum, s) => sum + Number(s.calculatedScore || 0), 0) / submissions.length
          : 0,
      },
    };
  }

  async syncToGradebook(activityId: string, academicTermId: string) {
    const results = await this.getActivityResults(activityId);
    const activity = results.activity;

    if (!activity.classroom?.teacherAssignmentId) {
      throw new BadRequestException('La actividad no está asociada a una asignación docente');
    }

    const teacherAssignmentId = activity.classroom.teacherAssignmentId;
    const targetProcess = activity.rubric?.targetProcess || 'Actitudinal';

    // Determinar qué notas sincronizar
    let gradesToSync: { enrollmentId: string; score: number }[] = [];

    if (activity.type === 'SELF_ASSESSMENT') {
      // Autoevaluación: cada estudiante tiene su propia nota
      gradesToSync = results.submissions
        .filter((s) => s.calculatedScore !== null)
        .map((s) => ({
          enrollmentId: s.evaluatorEnrollmentId,
          score: Number(s.calculatedScore),
        }));
    } else if (activity.type === 'PEER_ASSESSMENT') {
      // Coevaluación: promedio de las evaluaciones recibidas
      gradesToSync = results.consolidatedScores.map((c) => ({
        enrollmentId: c.studentId,
        score: c.averageScore,
      }));
    }

    // Sincronizar a PartialGrade
    let synced = 0;
    for (const grade of gradesToSync) {
      await this.prisma.partialGrade.upsert({
        where: {
          studentEnrollmentId_teacherAssignmentId_academicTermId_componentType_activityIndex: {
            studentEnrollmentId: grade.enrollmentId,
            teacherAssignmentId,
            academicTermId,
            componentType: 'ACTITUDINAL',
            activityIndex: 0,
          },
        },
        update: { score: grade.score },
        create: {
          institutionId: activity.classroom!.institutionId,
          studentEnrollmentId: grade.enrollmentId,
          teacherAssignmentId,
          academicTermId,
          componentType: 'ACTITUDINAL',
          activityIndex: 0,
          activityName: targetProcess,
          score: grade.score,
        },
      });
      synced++;
    }

    // Marcar submissions como sincronizadas
    await this.prisma.attitudinalSubmission.updateMany({
      where: { activityId },
      data: { syncedToGradebook: true, syncedAt: new Date() },
    });

    return { synced, targetProcess };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private async calculateScore(rubricId: string, responses: { criterionId: string; levelId: string }[]): Promise<number> {
    const criteria = await this.prisma.attitudinalCriterion.findMany({
      where: { rubricId },
      include: { levels: true },
    });

    let totalScore = 0;
    let totalWeight = 0;

    for (const response of responses) {
      const criterion = criteria.find((c) => c.id === response.criterionId);
      if (!criterion) continue;

      const level = criterion.levels.find((l) => l.id === response.levelId);
      if (!level) continue;

      // Normalizar score a escala 0-5 y ponderar
      const normalizedScore = Number(level.score);
      totalScore += normalizedScore * (criterion.weight / 100);
      totalWeight += criterion.weight;
    }

    // Si no se respondieron todos los criterios, ajustar
    if (totalWeight < 100) {
      totalScore = (totalScore / totalWeight) * 100;
    }

    return Math.round(totalScore * 100) / 100; // 2 decimales
  }

  async createPeerAssessmentPairs(activityId: string, mode: 'random' | 'all' = 'random', peersPerStudent = 3) {
    const activity = await this.prisma.classroomActivity.findUnique({
      where: { id: activityId },
      include: {
        classroom: {
          include: {
            teacherAssignment: {
              include: {
                group: true,
              },
            },
          },
        },
      },
    });

    if (!activity) throw new NotFoundException('Actividad no encontrada');
    if (activity.type !== 'PEER_ASSESSMENT') {
      throw new BadRequestException('Esta actividad no es de coevaluación');
    }

    // Obtener enrollments del grupo
    const groupId = activity.classroom?.teacherAssignment?.groupId;
    if (!groupId) throw new BadRequestException('No se encontró el grupo asociado');
    
    const enrollmentRecords = await this.prisma.studentEnrollment.findMany({
      where: { groupId, status: 'ACTIVE' },
      select: { id: true },
    });
    const enrollments = enrollmentRecords;
    if (enrollments.length < 2) {
      throw new BadRequestException('Se necesitan al menos 2 estudiantes para coevaluación');
    }

    const pairs: { evaluatorEnrollmentId: string; targetEnrollmentId: string }[] = [];

    if (mode === 'all') {
      // Todos evalúan a todos
      for (const evaluator of enrollments) {
        for (const target of enrollments) {
          if (evaluator.id !== target.id) {
            pairs.push({ evaluatorEnrollmentId: evaluator.id, targetEnrollmentId: target.id });
          }
        }
      }
    } else {
      // Asignación aleatoria
      const shuffled = [...enrollments].sort(() => Math.random() - 0.5);
      for (let i = 0; i < shuffled.length; i++) {
        const evaluator = shuffled[i];
        const targets: string[] = [];
        for (let j = 1; j <= peersPerStudent && j < shuffled.length; j++) {
          const targetIdx = (i + j) % shuffled.length;
          targets.push(shuffled[targetIdx].id);
        }
        for (const targetId of targets) {
          pairs.push({ evaluatorEnrollmentId: evaluator.id, targetEnrollmentId: targetId });
        }
      }
    }

    // Crear pares en BD
    await this.prisma.peerAssessmentPair.createMany({
      data: pairs.map((p) => ({
        activityId,
        evaluatorEnrollmentId: p.evaluatorEnrollmentId,
        targetEnrollmentId: p.targetEnrollmentId,
      })),
      skipDuplicates: true,
    });

    return { created: pairs.length };
  }
}
