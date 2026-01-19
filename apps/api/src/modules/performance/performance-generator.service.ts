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
      // Get grades for this student in this subject/term
      const grades = await this.prisma.studentGrade.findMany({
        where: {
          studentEnrollmentId,
          evaluativeActivity: {
            teacherAssignmentId: ta.id,
            academicTermId,
          },
        },
        include: {
          evaluativeActivity: {
            include: { component: true },
          },
        },
      });

      // Calculate scores by dimension (component)
      const dimensionScores = this.calculateDimensionScores(grades);

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

  private calculateDimensionScores(
    grades: Array<{
      score: any;
      evaluativeActivity: {
        component: { code: string; name: string };
      };
    }>,
  ): Record<PerformanceDimension, number> {
    const dimensionGrades: Record<PerformanceDimension, number[]> = {
      COGNITIVO: [],
      PROCEDIMENTAL: [],
      ACTITUDINAL: [],
    };

    for (const grade of grades) {
      const componentCode = grade.evaluativeActivity.component.code.toUpperCase();
      const score = Number(grade.score);

      if (componentCode.includes('COG') || componentCode === 'SABER') {
        dimensionGrades.COGNITIVO.push(score);
      } else if (componentCode.includes('PROC') || componentCode === 'HACER') {
        dimensionGrades.PROCEDIMENTAL.push(score);
      } else if (componentCode.includes('ACT') || componentCode === 'SER') {
        dimensionGrades.ACTITUDINAL.push(score);
      }
    }

    const result: Record<PerformanceDimension, number> = {
      COGNITIVO: 0,
      PROCEDIMENTAL: 0,
      ACTITUDINAL: 0,
    };

    for (const dimension of Object.keys(dimensionGrades) as PerformanceDimension[]) {
      const scores = dimensionGrades[dimension];
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
