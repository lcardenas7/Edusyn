import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { UpsertStudentGradeDto } from './dto/upsert-student-grade.dto';

@Injectable()
export class StudentGradesService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(dto: UpsertStudentGradeDto) {
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

    const componentResults = await Promise.all(
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

    if (!plan) return { grade: null, components: [] };

    const componentResults = await Promise.all(
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
   * Promedio ponderado de todos los cortes académicos según sus pesos.
   */
  async calculateAnnualGrade(
    studentEnrollmentId: string,
    teacherAssignmentId: string,
    academicYearId: string,
  ): Promise<{ annualGrade: number | null; terms: { termId: string; name: string; grade: number | null; weight: number }[] }> {
    const terms = await this.prisma.academicTerm.findMany({
      where: { academicYearId },
      orderBy: { order: 'asc' },
    });

    const termResults = await Promise.all(
      terms.map(async (term) => {
        const result = await this.calculateTermGrade(
          studentEnrollmentId,
          teacherAssignmentId,
          term.id,
        );
        return {
          termId: term.id,
          name: term.name,
          grade: result.grade,
          weight: term.weightPercentage,
        };
      }),
    );

    const validTerms = termResults.filter((t) => t.grade !== null);
    if (validTerms.length === 0) return { annualGrade: null, terms: termResults };

    const weightedSum = validTerms.reduce(
      (acc, t) => acc + (t.grade! * t.weight) / 100,
      0,
    );

    const totalWeight = validTerms.reduce((acc, t) => acc + t.weight, 0);
    const annualGrade = totalWeight > 0 ? this.roundToOneDecimal((weightedSum * 100) / totalWeight) : null;

    return { annualGrade, terms: termResults };
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

  /**
   * Redondea a 1 decimal según reglas INEDIC.
   */
  private roundToOneDecimal(value: number): number {
    return Math.round(value * 10) / 10;
  }
}
