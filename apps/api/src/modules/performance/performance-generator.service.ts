import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PerformanceDimension, PerformanceLevel } from '@prisma/client';

export interface GeneratedPerformance {
  dimension: PerformanceDimension;
  dimensionLabel: string;
  baseDescription: string;
  score: number;
  level: PerformanceLevel;
  levelLabel: string;
  complement: string;
  displayMode: 'CONCATENATE' | 'SEPARATE_LINE';
  finalText: string;
}

export interface StudentSubjectPerformance {
  subjectId: string;
  subjectName: string;
  areaId: string;
  areaName: string;
  performances: GeneratedPerformance[];
}

@Injectable()
export class PerformanceGeneratorService {
  constructor(private prisma: PrismaService) {}

  private readonly DIMENSION_LABELS: Record<PerformanceDimension, string> = {
    COGNITIVO: 'Cognitivo',
    PROCEDIMENTAL: 'Procedimental',
    ACTITUDINAL: 'Actitudinal',
  };

  private readonly LEVEL_LABELS: Record<PerformanceLevel, string> = {
    SUPERIOR: 'Superior',
    ALTO: 'Alto',
    BASICO: 'Básico',
    BAJO: 'Bajo',
  };

  async getPerformanceScale(institutionId: string) {
    return this.prisma.performanceScale.findMany({
      where: { institutionId },
      orderBy: { minScore: 'desc' },
    });
  }

  async getLevelComplements(institutionId: string) {
    return this.prisma.performanceLevelComplement.findMany({
      where: { institutionId, isActive: true },
    });
  }

  determineLevel(
    score: number,
    scale: Array<{ level: PerformanceLevel; minScore: any; maxScore: any }>,
  ): PerformanceLevel {
    for (const range of scale) {
      const min = Number(range.minScore);
      const max = Number(range.maxScore);
      if (score >= min && score <= max) {
        return range.level;
      }
    }
    return 'BAJO';
  }

  buildFinalText(
    baseDescription: string,
    complement: string,
    displayMode: 'CONCATENATE' | 'SEPARATE_LINE',
  ): string {
    if (!complement) return baseDescription;

    if (displayMode === 'SEPARATE_LINE') {
      return `${baseDescription}\n${complement}`;
    }
    
    // CONCATENATE: ensure proper punctuation
    let base = baseDescription.trim();
    if (base.endsWith('.')) {
      base = base.slice(0, -1);
    }
    return `${base}, ${complement}`;
  }

  async generateStudentPerformances(
    studentEnrollmentId: string,
    academicTermId: string,
    institutionId: string,
  ): Promise<StudentSubjectPerformance[]> {
    // Get student enrollment with group
    const enrollment = await this.prisma.studentEnrollment.findUnique({
      where: { id: studentEnrollmentId },
      include: { group: true },
    });

    if (!enrollment) {
      throw new Error('Student enrollment not found');
    }

    // Get performance scale
    const scale = await this.getPerformanceScale(institutionId);
    if (scale.length === 0) {
      throw new Error('Performance scale not configured for institution');
    }

    // Get level complements
    const complements = await this.getLevelComplements(institutionId);
    const complementMap = new Map(complements.map((c) => [c.level, c]));

    // Get all teacher assignments for the group
    const teacherAssignments = await this.prisma.teacherAssignment.findMany({
      where: {
        groupId: enrollment.groupId,
        academicYearId: enrollment.academicYearId,
      },
      include: {
        subject: {
          include: { area: true },
        },
        subjectPerformances: {
          where: { academicTermId },
        },
      },
    });

    // Get student grades by component for each subject
    const results: StudentSubjectPerformance[] = [];

    for (const ta of teacherAssignments) {
      // Q-0: la fuente de verdad de las notas es PartialGrade (planilla moderna).
      // Solo si no hay parciales se recae en StudentGrade (legacy).
      const dimensionScores = await this.getDimensionScores(
        studentEnrollmentId,
        ta.id,
        academicTermId,
      );

      // Build performances for each dimension
      const performances: GeneratedPerformance[] = [];

      for (const dimension of ['COGNITIVO', 'PROCEDIMENTAL', 'ACTITUDINAL'] as PerformanceDimension[]) {
        const basePerformance = ta.subjectPerformances.find((p) => p.dimension === dimension);
        const score = dimensionScores[dimension] ?? 0;
        const level = this.determineLevel(score, scale);
        const complementInfo = complementMap.get(level);

        const baseDescription = basePerformance?.baseDescription || '';
        const complement = complementInfo?.complement || '';
        const displayMode = complementInfo?.displayMode || 'CONCATENATE';

        performances.push({
          dimension,
          dimensionLabel: this.DIMENSION_LABELS[dimension],
          baseDescription,
          score,
          level,
          levelLabel: this.LEVEL_LABELS[level],
          complement,
          displayMode,
          finalText: this.buildFinalText(baseDescription, complement, displayMode),
        });
      }

      results.push({
        subjectId: ta.subject.id,
        subjectName: ta.subject.name,
        areaId: ta.subject.area.id,
        areaName: ta.subject.area.name,
        performances,
      });
    }

    // Sort by area order, then subject order
    results.sort((a, b) => {
      const areaCompare = a.areaName.localeCompare(b.areaName);
      if (areaCompare !== 0) return areaCompare;
      return a.subjectName.localeCompare(b.subjectName);
    });

    return results;
  }

  /**
   * Q-0: obtiene los puntajes por dimensión (COG/PROC/ACT) desde PartialGrade
   * (fuente de verdad de la planilla moderna). Si no hay parciales, cae en
   * StudentGrade (sistema legacy) para no romper instituciones que aún lo usan.
   */
  private async getDimensionScores(
    studentEnrollmentId: string,
    teacherAssignmentId: string,
    academicTermId: string,
  ): Promise<Record<PerformanceDimension, number>> {
    const partials = await this.prisma.partialGrade.findMany({
      where: { studentEnrollmentId, teacherAssignmentId, academicTermId },
      select: { componentType: true, score: true },
    });

    if (partials.length > 0) {
      return this.accumulateDimensionScores(
        partials.map((p) => ({ code: p.componentType, score: Number(p.score) })),
      );
    }

    // Fallback legacy: StudentGrade (vía EvaluativeActivity → component.code)
    const grades = await this.prisma.studentGrade.findMany({
      where: {
        studentEnrollmentId,
        evaluativeActivity: { teacherAssignmentId, academicTermId },
      },
      include: { evaluativeActivity: { include: { component: true } } },
    });
    return this.accumulateDimensionScores(
      grades.map((g) => ({ code: g.evaluativeActivity.component.code, score: Number(g.score) })),
    );
  }

  /**
   * Mapea un código de componente / componentType al saber (dimensión).
   * Misma heurística para PartialGrade.componentType y EvaluationComponent.code.
   */
  private componentCodeToDimension(rawCode: string): PerformanceDimension | null {
    const code = (rawCode || '').toUpperCase();
    if (code.includes('COG') || code === 'SABER') return 'COGNITIVO';
    if (code.includes('PROC') || code === 'HACER') return 'PROCEDIMENTAL';
    if (code.includes('ACT') || code === 'SER') return 'ACTITUDINAL';
    return null;
  }

  /**
   * Promedia los puntajes por dimensión a partir de una lista { code, score }.
   */
  private accumulateDimensionScores(
    items: Array<{ code: string; score: number }>,
  ): Record<PerformanceDimension, number> {
    const buckets: Record<PerformanceDimension, number[]> = {
      COGNITIVO: [],
      PROCEDIMENTAL: [],
      ACTITUDINAL: [],
    };

    for (const item of items) {
      const dimension = this.componentCodeToDimension(item.code);
      if (dimension) buckets[dimension].push(item.score);
    }

    const result: Record<PerformanceDimension, number> = {
      COGNITIVO: 0,
      PROCEDIMENTAL: 0,
      ACTITUDINAL: 0,
    };

    for (const dimension of Object.keys(buckets) as PerformanceDimension[]) {
      const scores = buckets[dimension];
      if (scores.length > 0) {
        result[dimension] = scores.reduce((a, b) => a + b, 0) / scores.length;
      }
    }

    return result;
  }

  async getPerformanceReport(
    institutionId: string,
    academicTermId: string,
    groupId?: string,
  ) {
    const whereClause: any = {
      academicTerm: { id: academicTermId },
    };

    if (groupId) {
      whereClause.teacherAssignment = { groupId };
    }

    const performances = await this.prisma.subjectPerformance.findMany({
      where: whereClause,
      include: {
        teacherAssignment: {
          include: {
            subject: { include: { area: true } },
            group: { include: { grade: true } },
            teacher: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    // Group by subject
    const bySubject = new Map<string, any>();
    for (const p of performances) {
      const key = p.teacherAssignment.subject.id;
      if (!bySubject.has(key)) {
        bySubject.set(key, {
          subject: p.teacherAssignment.subject,
          group: p.teacherAssignment.group,
          teacher: p.teacherAssignment.teacher,
          dimensions: {},
        });
      }
      bySubject.get(key).dimensions[p.dimension] = p.baseDescription;
    }

    return Array.from(bySubject.values());
  }
}
