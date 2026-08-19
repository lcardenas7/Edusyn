import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { UpsertStudentGradeDto } from './dto/upsert-student-grade.dto';
import { filterApplicableComponents } from './final-component-scope.util';

@Injectable()
export class StudentGradesService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(dto: UpsertStudentGradeDto) {
    const enr = await this.prisma.studentEnrollment.findUnique({ where: { id: dto.studentEnrollmentId }, select: { institutionId: true } });
    return this.prisma.studentGrade.upsert({
      where: {
        studentEnrollmentId_evaluativeActivityId: {
          studentEnrollmentId: dto.studentEnrollmentId,
          evaluativeActivityId: dto.evaluativeActivityId,
        },
      },
      update: {
        score: dto.score,
        observations: dto.observations,
      },
      create: {
        institutionId: enr!.institutionId,
        studentEnrollmentId: dto.studentEnrollmentId,
        evaluativeActivityId: dto.evaluativeActivityId,
        score: dto.score,
        observations: dto.observations,
      },
    });
  }

  async bulkUpsert(evaluativeActivityId: string, grades: { studentEnrollmentId: string; score: number; observations?: string }[]) {
    const results = await Promise.all(
      grades.map((g) =>
        this.upsert({
          studentEnrollmentId: g.studentEnrollmentId,
          evaluativeActivityId,
          score: g.score,
          observations: g.observations,
        }),
      ),
    );
    return results;
  }

  async getByActivity(evaluativeActivityId: string) {
    return this.prisma.studentGrade.findMany({
      where: { evaluativeActivityId },
      include: {
        studentEnrollment: {
          include: {
            student: true,
          },
        },
      },
      orderBy: {
        studentEnrollment: {
          student: {
            lastName: 'asc',
          },
        },
      },
    });
  }

  async getByStudent(studentEnrollmentId: string) {
    return this.prisma.studentGrade.findMany({
      where: { studentEnrollmentId },
      include: {
        evaluativeActivity: {
          include: {
            component: true,
            academicTerm: true,
          },
        },
      },
    });
  }

  /**
   * Calcula el promedio de un componente para un estudiante en un corte académico.
   * Promedio simple de todas las actividades del componente.
   */
  async calculateComponentAverage(
    studentEnrollmentId: string,
    academicTermId: string,
    componentId: string,
  ): Promise<number | null> {
    const grades = await this.prisma.studentGrade.findMany({
      where: {
        studentEnrollmentId,
        evaluativeActivity: {
          academicTermId,
          componentId,
        },
      },
    });

    if (grades.length === 0) return null;

    const sum = grades.reduce((acc, g) => acc + Number(g.score), 0);
    const avg = sum / grades.length;
    return this.roundToOneDecimal(avg);
  }

  async calculateComponentAverageAtDate(
    studentEnrollmentId: string,
    academicTermId: string,
    componentId: string,
    cutoffDate: Date,
  ): Promise<number | null> {
    const grades = await this.prisma.studentGrade.findMany({
      where: {
        studentEnrollmentId,
        evaluativeActivity: {
          academicTermId,
          componentId,
          OR: [{ dueDate: null }, { dueDate: { lte: cutoffDate } }],
        },
      },
    });

    if (grades.length === 0) return null;

    const sum = grades.reduce((acc, g) => acc + Number(g.score), 0);
    const avg = sum / grades.length;
    return this.roundToOneDecimal(avg);
  }

  /**
   * Calcula la nota del corte para un estudiante en una asignatura.
   * Promedio ponderado de componentes según el plan de evaluación.
   * Lee de PartialGrade (fuente de verdad), fallback a StudentGrade.
   */
  async calculateTermGrade(
    studentEnrollmentId: string,
    teacherAssignmentId: string,
    academicTermId: string,
  ): Promise<{ grade: number | null; components: { componentId: string; name: string; average: number | null; percentage: number }[] }> {
    const plan = await this.prisma.evaluationPlan.findUnique({
      where: {
        teacherAssignmentId_academicTermId: {
          teacherAssignmentId,
          academicTermId,
        },
      },
      include: {
        components: {
          include: {
            component: true,
          },
        },
      },
    });

    if (!plan) return { grade: null, components: [] };

    // Leer de PartialGrade (fuente de verdad desde la planilla)
    const partials = await this.prisma.partialGrade.findMany({
      where: { studentEnrollmentId, teacherAssignmentId, academicTermId },
    });

    let componentResults: { componentId: string; name: string; average: number | null; percentage: number }[];

    if (partials.length > 0) {
      // Agrupar PartialGrades por componentType (matches EvaluationComponent.code)
      const scoresByType = new Map<string, number[]>();
      for (const p of partials) {
        const scores = scoresByType.get(p.componentType) || [];
        scores.push(Number(p.score));
        scoresByType.set(p.componentType, scores);
      }

      componentResults = plan.components.map((cw) => {
        const scores = scoresByType.get(cw.component.code) || [];
        const avg = scores.length > 0
          ? this.roundToOneDecimal(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null;
        return {
          componentId: cw.componentId,
          name: cw.component.name,
          average: avg,
          percentage: cw.percentage,
        };
      });
    } else {
      // Fallback: leer de StudentGrade (sistema anterior)
      componentResults = await Promise.all(
        plan.components.map(async (cw) => {
          const avg = await this.calculateComponentAverage(
            studentEnrollmentId,
            academicTermId,
            cw.componentId,
          );
          return {
            componentId: cw.componentId,
            name: cw.component.name,
            average: avg,
            percentage: cw.percentage,
          };
        }),
      );
    }

    const validComponents = componentResults.filter((c) => c.average !== null);
    if (validComponents.length === 0) return { grade: null, components: componentResults };

    const weightedSum = validComponents.reduce(
      (acc, c) => acc + (c.average! * c.percentage) / 100,
      0,
    );

    const totalPercentage = validComponents.reduce((acc, c) => acc + c.percentage, 0);
    const grade = totalPercentage > 0 ? this.roundToOneDecimal((weightedSum * 100) / totalPercentage) : null;

    return { grade, components: componentResults };
  }

  async calculateTermGradeAtDate(
    studentEnrollmentId: string,
    teacherAssignmentId: string,
    academicTermId: string,
    cutoffDate: Date,
  ): Promise<{ grade: number | null; components: { componentId: string; name: string; average: number | null; percentage: number }[] }> {
    const plan = await this.prisma.evaluationPlan.findUnique({
      where: {
        teacherAssignmentId_academicTermId: {
          teacherAssignmentId,
          academicTermId,
        },
      },
      include: {
        components: {
          include: {
            component: true,
          },
        },
      },
    });

    // Fuente de verdad: PartialGrade (planilla), HASTA la fecha de corte.
    // PartialGrade no tiene fecha por actividad → se usa createdAt (cuándo se digitó).
    // Se toma el fin del día del corte para incluir las notas cargadas ese mismo día.
    const upperBound = new Date(cutoffDate);
    upperBound.setHours(23, 59, 59, 999);
    const partials = await this.prisma.partialGrade.findMany({
      where: {
        studentEnrollmentId,
        teacherAssignmentId,
        academicTermId,
        createdAt: { lte: upperBound },
      },
    });

    // Sin plan de evaluación → promedio simple de los parciales hasta la fecha,
    // igual que recomputePeriodFinalGrade (antes devolvía null → "s/d" para todos).
    if (!plan || plan.components.length === 0) {
      if (partials.length === 0) return { grade: null, components: [] };
      const avg = this.roundToOneDecimal(
        partials.reduce((a, p) => a + Number(p.score), 0) / partials.length,
      );
      return { grade: avg, components: [] };
    }

    let componentResults: { componentId: string; name: string; average: number | null; percentage: number }[];

    if (partials.length > 0) {
      // Agrupar PartialGrades por componentType (== EvaluationComponent.code)
      const scoresByType = new Map<string, number[]>();
      for (const p of partials) {
        const scores = scoresByType.get(p.componentType) || [];
        scores.push(Number(p.score));
        scoresByType.set(p.componentType, scores);
      }
      componentResults = plan.components.map((cw) => {
        const scores = scoresByType.get(cw.component.code) || [];
        const avg = scores.length > 0
          ? this.roundToOneDecimal(scores.reduce((a, b) => a + b, 0) / scores.length)
          : null;
        return { componentId: cw.componentId, name: cw.component.name, average: avg, percentage: cw.percentage };
      });
    } else {
      // Fallback legado: StudentGrade / EvaluativeActivity con fecha (sistema anterior)
      componentResults = await Promise.all(
        plan.components.map(async (cw) => {
          const avg = await this.calculateComponentAverageAtDate(
            studentEnrollmentId,
            academicTermId,
            cw.componentId,
            cutoffDate,
          );
          return {
            componentId: cw.componentId,
            name: cw.component.name,
            average: avg,
            percentage: cw.percentage,
          };
        }),
      );
    }

    const validComponents = componentResults.filter((c) => c.average !== null);
    if (validComponents.length === 0)
      return { grade: null, components: componentResults };

    const weightedSum = validComponents.reduce(
      (acc, c) => acc + (c.average! * c.percentage) / 100,
      0,
    );

    const totalPercentage = validComponents.reduce(
      (acc, c) => acc + c.percentage,
      0,
    );
    const grade =
      totalPercentage > 0
        ? this.roundToOneDecimal((weightedSum * 100) / totalPercentage)
        : null;

    return { grade, components: componentResults };
  }

  /**
   * Calcula la nota anual para un estudiante en una asignatura.
   * Fórmula universal: Σ(fuentes de nota ponderadas)
   * Fuentes = períodos (PeriodFinalGrade) + componentes finales (FinalComponentGrade)
   * El motor no sabe qué es un período o una prueba. Solo suma componentes ponderados.
   */
  async calculateAnnualGrade(
    studentEnrollmentId: string,
    teacherAssignmentId: string,
    academicYearId: string,
  ): Promise<{
    annualGrade: number | null;
    sources: Array<{ id: string; name: string; type: 'period' | 'final_component'; grade: number | null; weight: number }>;
  }> {
    // Fuente 1: Períodos académicos
    const terms = await this.prisma.academicTerm.findMany({
      where: { academicYearId },
      orderBy: { order: 'asc' },
    });

    // A-11 / INV-10: PeriodFinalGrade se indexa por subjectId (no por asignación).
    // Resolvemos el subjectId una sola vez para leer la nota canónica del período.
    // `group.gradeId` se añade para resolver el alcance de las fuentes finales
    // (D-19): una prueba semestral puede no aplicar a un grado o a una
    // asignatura concreta de ese grado.
    const assignment = await this.prisma.teacherAssignment.findUnique({
      where: { id: teacherAssignmentId },
      select: { subjectId: true, group: { select: { gradeId: true } } },
    });
    const subjectId = assignment?.subjectId ?? null;
    const gradeId = assignment?.group?.gradeId ?? null;

    const termSources = await Promise.all(
      terms.map(async (term) => {
        // A-11 / INV-10: leer la nota CANÓNICA del período (PeriodFinalGrade respeta
        // el override manual C-1 y la recuperación). Fallback a recompute si aún no
        // existe PeriodFinalGrade. Mismo criterio que buildGroupReportCards en boletines.
        const grade = subjectId
          ? await this.resolveCanonicalPeriodGrade(
              studentEnrollmentId,
              teacherAssignmentId,
              subjectId,
              term.id,
            )
          : (await this.calculateTermGrade(
              studentEnrollmentId,
              teacherAssignmentId,
              term.id,
            )).grade;
        return {
          id: term.id,
          name: term.name,
          type: 'period' as const,
          grade,
          weight: term.weightPercentage,
        };
      }),
    );

    // Fuente 2: Componentes finales (pruebas semestrales, proyecto final, etc.)
    const allFinalComponents = await this.prisma.finalComponent.findMany({
      where: { academicYearId },
      orderBy: { order: 'asc' },
    });

    // D-19 · Alcance explícito, resuelto por la regla canónica compartida.
    // Con scopeMode = ALL_GRADES (el DEFAULT) y sin reglas —el caso de todas las
    // instituciones que no configuren nada— esto es un no-op: el conjunto de
    // fuentes es idéntico al histórico y ninguna nota anual cambia.
    //
    // Se consulta UNA vez, no por componente. Y sólo si hay componentes: las
    // instituciones sin pruebas semestrales ni siquiera tocan la tabla.
    const scopeRules = allFinalComponents.length
      ? await this.prisma.finalComponentScope.findMany({
          where: {
            finalComponentId: { in: allFinalComponents.map((fc) => fc.id) },
            ...(gradeId ? { gradeId } : {}),
          },
          select: { finalComponentId: true, gradeId: true, subjectId: true, applies: true },
        })
      : [];

    const finalComponents = filterApplicableComponents(
      allFinalComponents,
      gradeId,
      subjectId,
      scopeRules,
    );

    const componentSources = await Promise.all(
      finalComponents.map(async (fc) => {
        const gradeRecord = await this.prisma.finalComponentGrade.findUnique({
          where: {
            studentEnrollmentId_teacherAssignmentId_finalComponentId: {
              studentEnrollmentId,
              teacherAssignmentId,
              finalComponentId: fc.id,
            },
          },
        });
        return {
          id: fc.id,
          name: fc.name,
          type: 'final_component' as const,
          grade: gradeRecord ? Number(gradeRecord.grade) : null,
          weight: fc.weightPercentage,
        };
      }),
    );

    // Unificar todas las fuentes de nota
    const allSources = [...termSources, ...componentSources];

    const validSources = allSources.filter((s) => s.grade !== null);
    if (validSources.length === 0) return { annualGrade: null, sources: allSources };

    const weightedSum = validSources.reduce(
      (acc, s) => acc + (s.grade! * s.weight) / 100,
      0,
    );

    const totalWeight = validSources.reduce((acc, s) => acc + s.weight, 0);
    const annualGrade = totalWeight > 0 ? this.roundToOneDecimal((weightedSum * 100) / totalWeight) : null;

    return { annualGrade, sources: allSources };
  }

  /**
   * A-11 / INV-10 — Resuelve la nota CANÓNICA de un período para una asignatura.
   *
   * `PeriodFinalGrade` es la fuente única de verdad del período: ya refleja el
   * override manual (`isManualOverride`, C-1) y la nota de recuperación
   * (`period-recovery` escribe ahí). Leerlo garantiza que promoción, boletines,
   * MEN y dashboard consuman el MISMO valor (INV-10).
   *
   * Solo si aún no existe `PeriodFinalGrade` para la coordenada, se recae en el
   * recálculo desde `PartialGrade` (mismo comportamiento previo, sin regresión).
   */
  private async resolveCanonicalPeriodGrade(
    studentEnrollmentId: string,
    teacherAssignmentId: string,
    subjectId: string,
    academicTermId: string,
  ): Promise<number | null> {
    const pfg = await this.prisma.periodFinalGrade.findUnique({
      where: {
        studentEnrollmentId_academicTermId_subjectId: {
          studentEnrollmentId,
          academicTermId,
          subjectId,
        },
      },
      select: { finalScore: true },
    });
    if (pfg) return Number(pfg.finalScore);

    const recomputed = await this.calculateTermGrade(
      studentEnrollmentId,
      teacherAssignmentId,
      academicTermId,
    );
    return recomputed.grade;
  }

  /**
   * Obtiene el desempeño cualitativo según la escala institucional.
   * El redondeo se aplica ANTES de clasificar.
   */
  async getPerformanceLevel(
    institutionId: string,
    score: number,
  ): Promise<{ level: string; score: number } | null> {
    const roundedScore = this.roundToOneDecimal(score);

    const scale = await this.prisma.performanceScale.findFirst({
      where: {
        institutionId,
        minScore: { lte: roundedScore },
        maxScore: { gte: roundedScore },
      },
    });

    if (!scale) return null;

    return {
      level: scale.level,
      score: roundedScore,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MÉTODOS PRELOADED (0 queries — operan 100% en memoria)
  // Para uso en buildGroupReportCards() y reportes batch
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Calcula la nota del período usando datos precargados.
   * 0 queries a la DB — toda la lógica opera en memoria.
   *
   * @param enrollmentId - ID de la matrícula
   * @param teacherAssignmentId - ID de la asignación docente
   * @param termId - ID del período
   * @param plansMap - Map<teacherAssignmentId_termId, { components: [...] }>
   * @param partialsMap - Map<enrollmentId, PartialGrade[]>
   */
  calculateTermGradeFromPreloaded(
    enrollmentId: string,
    teacherAssignmentId: string,
    termId: string,
    plansMap: Map<string, { components: { componentId: string; code: string; name: string; percentage: number }[] }>,
    partialsMap: Map<string, { teacherAssignmentId: string; academicTermId: string; componentType: string; score: number }[]>,
  ): { grade: number | null; components: { componentId: string; name: string; average: number | null; percentage: number }[] } {
    const planKey = `${teacherAssignmentId}_${termId}`;
    const plan = plansMap.get(planKey);
    if (!plan) return { grade: null, components: [] };

    // Filtrar partials de este estudiante para esta asignación y período
    const allPartials = partialsMap.get(enrollmentId) || [];
    const partials = allPartials.filter(
      p => p.teacherAssignmentId === teacherAssignmentId && p.academicTermId === termId,
    );

    // Agrupar scores por componentType
    const scoresByType = new Map<string, number[]>();
    for (const p of partials) {
      const scores = scoresByType.get(p.componentType) || [];
      scores.push(p.score);
      scoresByType.set(p.componentType, scores);
    }

    const componentResults = plan.components.map((cw) => {
      const scores = scoresByType.get(cw.code) || [];
      const avg = scores.length > 0
        ? this.roundToOneDecimal(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;
      return {
        componentId: cw.componentId,
        name: cw.name,
        average: avg,
        percentage: cw.percentage,
      };
    });

    const validComponents = componentResults.filter((c) => c.average !== null);
    if (validComponents.length === 0) return { grade: null, components: componentResults };

    const weightedSum = validComponents.reduce(
      (acc, c) => acc + (c.average! * c.percentage) / 100,
      0,
    );
    const totalPercentage = validComponents.reduce((acc, c) => acc + c.percentage, 0);
    const grade = totalPercentage > 0 ? this.roundToOneDecimal((weightedSum * 100) / totalPercentage) : null;

    return { grade, components: componentResults };
  }

  /**
   * Clasifica una nota según la escala de desempeño precargada.
   * 0 queries a la DB — lookup en memoria.
   *
   * @param scale - Array de { level, minScore, maxScore } precargado
   * @param score - Nota a clasificar
   */
  getPerformanceLevelFromScale(
    scale: { level: string; minScore: number; maxScore: number }[],
    score: number,
  ): { level: string; score: number } | null {
    const roundedScore = this.roundToOneDecimal(score);

    const match = scale.find(
      s => roundedScore >= s.minScore && roundedScore <= s.maxScore,
    );

    if (!match) return null;

    return {
      level: match.level,
      score: roundedScore,
    };
  }

  /**
   * Redondea a 1 decimal según reglas INEDIC.
   */
  private roundToOneDecimal(value: number): number {
    return Math.round(value * 10) / 10;
  }
}
