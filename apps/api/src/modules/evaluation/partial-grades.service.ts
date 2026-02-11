import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PartialGradesService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(data: {
    studentEnrollmentId: string;
    teacherAssignmentId: string;
    academicTermId: string;
    componentType: string;
    activityIndex: number;
    activityName: string;
    activityType?: string;
    score: number;
    observations?: string;
  }) {
    const ta = await this.prisma.teacherAssignment.findUnique({ where: { id: data.teacherAssignmentId }, select: { institutionId: true } });
    return this.prisma.partialGrade.upsert({
      where: {
        studentEnrollmentId_teacherAssignmentId_academicTermId_componentType_activityIndex: {
          studentEnrollmentId: data.studentEnrollmentId,
          teacherAssignmentId: data.teacherAssignmentId,
          academicTermId: data.academicTermId,
          componentType: data.componentType,
          activityIndex: data.activityIndex,
        },
      },
      update: {
        activityName: data.activityName,
        activityType: data.activityType,
        score: data.score,
        observations: data.observations,
      },
      create: { ...data, institutionId: ta!.institutionId },
    });
  }

  async bulkUpsert(grades: Array<{
    studentEnrollmentId: string;
    teacherAssignmentId: string;
    academicTermId: string;
    componentType: string;
    activityIndex: number;
    activityName: string;
    activityType?: string;
    score: number;
    observations?: string;
  }>) {
    const results: any[] = [];
    for (const grade of grades) {
      if (grade.score > 0) {
        const result = await this.upsert(grade);
        results.push({ action: 'upsert', ...result });
      } else {
        try {
          await this.prisma.partialGrade.deleteMany({
            where: {
              studentEnrollmentId: grade.studentEnrollmentId,
              teacherAssignmentId: grade.teacherAssignmentId,
              academicTermId: grade.academicTermId,
              componentType: grade.componentType,
              activityIndex: grade.activityIndex,
            },
          });
          results.push({ action: 'delete', ...grade });
        } catch (e) {
          // Ignorar si no existe
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // AUTO-RECOMPUTE: PeriodFinalGrade como dato derivado de PartialGrade
    // ═══════════════════════════════════════════════════════════════════════
    const uniqueKeys = new Map<string, { studentEnrollmentId: string; teacherAssignmentId: string; academicTermId: string }>();
    for (const g of grades) {
      const key = `${g.studentEnrollmentId}|${g.teacherAssignmentId}|${g.academicTermId}`;
      if (!uniqueKeys.has(key)) {
        uniqueKeys.set(key, {
          studentEnrollmentId: g.studentEnrollmentId,
          teacherAssignmentId: g.teacherAssignmentId,
          academicTermId: g.academicTermId,
        });
      }
    }

    for (const params of uniqueKeys.values()) {
      try {
        await this.recomputePeriodFinalGrade(params);
      } catch (err) {
        console.error('[PartialGrades] Error recomputing final grade:', err);
      }
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RECOMPUTE: Recalcular PeriodFinalGrade desde PartialGrades
  // ═══════════════════════════════════════════════════════════════════════

  async recomputePeriodFinalGrade(params: {
    studentEnrollmentId: string;
    teacherAssignmentId: string;
    academicTermId: string;
  }) {
    const { studentEnrollmentId, teacherAssignmentId, academicTermId } = params;

    // 1. Obtener la asignación para saber subjectId y teacherId
    const assignment = await this.prisma.teacherAssignment.findUnique({
      where: { id: teacherAssignmentId },
      select: { subjectId: true, teacherId: true, institutionId: true },
    });
    if (!assignment) return;

    // 2. Obtener TODOS los PartialGrades restantes de este estudiante/asignatura/período
    const partials = await this.prisma.partialGrade.findMany({
      where: { studentEnrollmentId, teacherAssignmentId, academicTermId },
    });

    // 3. Si no quedan notas parciales → eliminar PeriodFinalGrade
    if (partials.length === 0) {
      await this.prisma.periodFinalGrade.deleteMany({
        where: {
          studentEnrollmentId,
          academicTermId,
          subjectId: assignment.subjectId,
        },
      });
      return;
    }

    // 4. Obtener pesos de los componentes evaluativos
    const plan = await this.prisma.evaluationPlan.findUnique({
      where: {
        teacherAssignmentId_academicTermId: { teacherAssignmentId, academicTermId },
      },
      include: {
        components: {
          include: { component: true },
        },
      },
    });

    // 5. Calcular nota final ponderada
    let finalScore: number;

    if (plan && plan.components.length > 0) {
      // Con plan de evaluación → promedio ponderado por componentType
      const componentWeights = new Map<string, number>();
      for (const cw of plan.components) {
        componentWeights.set(cw.component.code, cw.percentage);
      }

      // Agrupar notas por componentType y calcular promedio
      const componentScores = new Map<string, number[]>();
      for (const p of partials) {
        const scores = componentScores.get(p.componentType) || [];
        scores.push(Number(p.score));
        componentScores.set(p.componentType, scores);
      }

      let weightedSum = 0;
      let totalWeight = 0;

      for (const [componentType, scores] of componentScores) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        const weight = componentWeights.get(componentType) || 0;
        if (weight > 0) {
          weightedSum += avg * weight;
          totalWeight += weight;
        }
      }

      finalScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
    } else {
      // Sin plan de evaluación → promedio simple de todas las notas
      const allScores = partials.map(p => Number(p.score));
      finalScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
    }

    // 6. Redondear a 1 decimal
    finalScore = Math.round(finalScore * 10) / 10;

    // 7. Upsert PeriodFinalGrade
    if (finalScore > 0) {
      await this.prisma.periodFinalGrade.upsert({
        where: {
          studentEnrollmentId_academicTermId_subjectId: {
            studentEnrollmentId,
            academicTermId,
            subjectId: assignment.subjectId,
          },
        },
        update: { finalScore },
        create: {
          institutionId: assignment.institutionId,
          studentEnrollmentId,
          academicTermId,
          subjectId: assignment.subjectId,
          finalScore,
          enteredById: assignment.teacherId,
        },
      });
    } else {
      // Score = 0 → eliminar
      await this.prisma.periodFinalGrade.deleteMany({
        where: {
          studentEnrollmentId,
          academicTermId,
          subjectId: assignment.subjectId,
        },
      });
    }
  }

  async count(institutionId?: string) {
    const count = await this.prisma.partialGrade.count({
      where: institutionId ? {
        studentEnrollment: {
          academicYear: { institutionId },
        },
      } : undefined,
    });
    return { count };
  }

  async getByAssignment(teacherAssignmentId: string, academicTermId: string) {
    return this.prisma.partialGrade.findMany({
      where: {
        teacherAssignmentId,
        academicTermId,
      },
      include: {
        studentEnrollment: {
          include: {
            student: true,
          },
        },
      },
      orderBy: [
        { componentType: 'asc' },
        { activityIndex: 'asc' },
      ],
    });
  }

  async getByStudent(studentEnrollmentId: string, academicTermId?: string) {
    return this.prisma.partialGrade.findMany({
      where: {
        studentEnrollmentId,
        ...(academicTermId && { academicTermId }),
      },
      orderBy: [
        { componentType: 'asc' },
        { activityIndex: 'asc' },
      ],
    });
  }

  async delete(id: string) {
    return this.prisma.partialGrade.delete({ where: { id } });
  }

  async deleteByActivity(
    teacherAssignmentId: string,
    academicTermId: string,
    componentType: string,
    activityIndex: number,
  ) {
    return this.prisma.partialGrade.deleteMany({
      where: {
        teacherAssignmentId,
        academicTermId,
        componentType,
        activityIndex,
      },
    });
  }
}
