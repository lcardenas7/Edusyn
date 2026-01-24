import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryStatus, RecoveryImpactType } from '@prisma/client';
import { RecoveryConfigService } from './recovery-config.service';

// Tipos para la configuración de áreas
interface AreaConfig {
  calculationType: string;
  approvalRule: string;
  recoveryRule: string;
  failIfAnySubjectFails: boolean;
}

@Injectable()
export class PeriodRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: RecoveryConfigService,
  ) {}

  /**
   * Detecta estudiantes que necesitan recuperación según la configuración del área
   * 
   * CRITERIOS DE APROBACIÓN:
   * - AREA_AVERAGE: Si el promedio del área aprueba, NO necesita recuperar asignaturas individuales
   * - ALL_SUBJECTS: Cada asignatura reprobada DEBE recuperarse
   * - DOMINANT_SUBJECT: Solo importa si la asignatura dominante aprueba
   * 
   * CHECKBOX "Pierde el área si cualquier asignatura está perdida":
   * - Si está marcado, aunque el promedio pase, SÍ debe recuperar
   */
  async detectStudentsNeedingRecovery(
    academicTermId: string,
    institutionId: string,
  ) {
    const term = await this.prisma.academicTerm.findUnique({
      where: { id: academicTermId },
      include: { academicYear: true },
    });

    if (!term) return [];

    const config = await this.configService.getOrCreateDefaultConfig(
      institutionId,
      term.academicYearId,
    );

    const minScore = Number(config.minPassingScore);

    // Cargar configuración de áreas de la institución
    const areaConfig = await this.getAreaConfig(institutionId);

    // Buscar TODAS las notas finales de período (no solo las bajas)
    // para poder calcular promedios de área
    const allGrades = await this.prisma.periodFinalGrade.findMany({
      where: { academicTermId },
      include: {
        studentEnrollment: {
          include: {
            student: true,
            group: { include: { grade: true } },
          },
        },
        subject: { include: { area: true, levelConfigs: true } },
      },
    });

    // Agrupar por estudiante y área para calcular promedios
    const studentAreaGrades = new Map<string, Map<string, {
      grades: { subjectId: string; subjectName: string; score: number; weight: number; isDominant: boolean }[];
      areaId: string;
      areaName: string;
    }>>();

    for (const grade of allGrades) {
      const studentKey = grade.studentEnrollmentId;
      const areaId = grade.subject.areaId;
      
      if (!studentAreaGrades.has(studentKey)) {
        studentAreaGrades.set(studentKey, new Map());
      }
      
      const studentAreas = studentAreaGrades.get(studentKey)!;
      if (!studentAreas.has(areaId)) {
        studentAreas.set(areaId, {
          grades: [],
          areaId,
          areaName: grade.subject.area.name,
        });
      }
      
      // Obtener configuración de nivel (usar la primera disponible o valores por defecto)
      const levelConfig = grade.subject.levelConfigs?.[0];
      studentAreas.get(areaId)!.grades.push({
        subjectId: grade.subjectId,
        subjectName: grade.subject.name,
        score: Number(grade.finalScore),
        weight: levelConfig ? Number(levelConfig.weight) : 1.0,
        isDominant: levelConfig?.isDominant ?? false,
      });
    }

    // Determinar quién necesita recuperación según configuración del área
    const studentsNeedingRecovery: any[] = [];

    for (const [studentEnrollmentId, areas] of studentAreaGrades) {
      const studentGrade = allGrades.find(g => g.studentEnrollmentId === studentEnrollmentId);
      if (!studentGrade) continue;

      for (const [areaId, areaData] of areas) {
        // Calcular promedio del área
        const areaAverage = this.calculateAreaAverage(areaData.grades, areaConfig.calculationType);
        const areaApproved = areaAverage >= minScore;

        // Verificar cada asignatura
        for (const subjectGrade of areaData.grades) {
          const subjectApproved = subjectGrade.score >= minScore;
          
          if (subjectApproved) continue; // Si aprobó, no necesita recuperación

          // Determinar si REQUIERE recuperación según configuración
          const recoveryResult = this.requiresRecovery(
            subjectGrade.score,
            subjectGrade.isDominant,
            areaAverage,
            areaData.grades.map(g => ({
              grade: g.score,
              approved: g.score >= minScore,
              isDominant: g.isDominant,
            })),
            minScore,
            areaConfig
          );

          if (recoveryResult.required) {
            studentsNeedingRecovery.push({
              studentEnrollmentId,
              studentName: `${studentGrade.studentEnrollment.student.firstName} ${studentGrade.studentEnrollment.student.lastName}`,
              group: `${studentGrade.studentEnrollment.group.grade?.name} ${studentGrade.studentEnrollment.group.name}`,
              subjectId: subjectGrade.subjectId,
              subjectName: subjectGrade.subjectName,
              areaId,
              areaName: areaData.areaName,
              originalScore: subjectGrade.score,
              areaAverage,
              areaApproved,
              needsRecovery: true,
              reason: recoveryResult.reason,
              recoveryType: recoveryResult.recoveryType,
            });
          }
        }
      }
    }

    return studentsNeedingRecovery;
  }

  /**
   * Obtiene la configuración de áreas de la institución
   */
  private async getAreaConfig(institutionId: string): Promise<AreaConfig> {
    const institution = await this.prisma.$queryRaw<any[]>`
      SELECT "areaCalculationType", "areaApprovalRule", "areaRecoveryRule", "areaFailIfAnyFails"
      FROM "Institution"
      WHERE id = ${institutionId}
    `;

    if (institution.length === 0) {
      // Valores por defecto
      return {
        calculationType: 'WEIGHTED',
        approvalRule: 'AREA_AVERAGE',
        recoveryRule: 'INDIVIDUAL_SUBJECT',
        failIfAnySubjectFails: false,
      };
    }

    return {
      calculationType: institution[0].areaCalculationType || 'WEIGHTED',
      approvalRule: institution[0].areaApprovalRule || 'AREA_AVERAGE',
      recoveryRule: institution[0].areaRecoveryRule || 'INDIVIDUAL_SUBJECT',
      failIfAnySubjectFails: institution[0].areaFailIfAnyFails || false,
    };
  }

  /**
   * Calcula el promedio del área según el tipo de cálculo configurado
   */
  private calculateAreaAverage(
    grades: { score: number; weight: number; isDominant: boolean }[],
    calculationType: string
  ): number {
    if (grades.length === 0) return 0;

    switch (calculationType) {
      case 'AVERAGE':
        return grades.reduce((sum, g) => sum + g.score, 0) / grades.length;
      
      case 'WEIGHTED': {
        const totalWeight = grades.reduce((sum, g) => sum + g.weight, 0);
        if (totalWeight === 0) return grades.reduce((sum, g) => sum + g.score, 0) / grades.length;
        return grades.reduce((sum, g) => sum + (g.score * g.weight), 0) / totalWeight;
      }
      
      case 'DOMINANT': {
        const dominant = grades.find(g => g.isDominant);
        return dominant ? dominant.score : grades.reduce((sum, g) => sum + g.score, 0) / grades.length;
      }
      
      default:
        return grades.reduce((sum, g) => sum + g.score, 0) / grades.length;
    }
  }

  /**
   * Determina si una asignatura REQUIERE recuperación según la configuración del área
   */
  private requiresRecovery(
    subjectGrade: number,
    subjectIsDominant: boolean,
    areaAverage: number,
    allSubjects: { grade: number; approved: boolean; isDominant: boolean }[],
    minScore: number,
    areaConfig: AreaConfig
  ): { required: boolean; reason: string; recoveryType: string } {
    const subjectApproved = subjectGrade >= minScore;
    
    if (subjectApproved) {
      return { required: false, reason: 'La asignatura ya está aprobada', recoveryType: 'NONE' };
    }

    if (areaConfig.recoveryRule === 'NONE') {
      return { required: false, reason: 'Esta área no permite recuperación', recoveryType: 'NONE' };
    }

    const recoveryType = areaConfig.recoveryRule;

    // CASO ESPECIAL: "Pierde el área si cualquier asignatura está perdida"
    if (areaConfig.failIfAnySubjectFails) {
      return { 
        required: true, 
        reason: 'Configuración: pierde el área si cualquier asignatura está perdida',
        recoveryType
      };
    }

    // Verificar según criterio de aprobación del área
    switch (areaConfig.approvalRule) {
      case 'AREA_AVERAGE': {
        const areaApproved = areaAverage >= minScore;
        if (areaApproved) {
          return { required: false, reason: 'El área aprueba por promedio, no requiere recuperación', recoveryType: 'NONE' };
        }
        return { required: true, reason: 'El promedio del área no alcanza la nota mínima', recoveryType };
      }
      
      case 'ALL_SUBJECTS':
        return { required: true, reason: 'Todas las asignaturas deben estar aprobadas', recoveryType };
      
      case 'DOMINANT_SUBJECT': {
        if (subjectIsDominant) {
          return { required: true, reason: 'La asignatura dominante debe aprobar', recoveryType };
        }
        const dominantSubject = allSubjects.find(s => s.isDominant);
        if (dominantSubject && dominantSubject.approved) {
          return { required: false, reason: 'La asignatura dominante ya aprueba, esta no afecta', recoveryType: 'NONE' };
        }
        return { required: false, reason: 'Solo importa la asignatura dominante', recoveryType: 'NONE' };
      }
      
      default:
        return { required: true, reason: 'Asignatura reprobada', recoveryType };
    }
  }

  async create(data: {
    studentEnrollmentId: string;
    academicTermId: string;
    subjectId: string;
    originalScore: number;
    activityDescription?: string;
    scheduledDate?: Date;
    reinforcedDimension?: string;
    assignedById: string;
  }) {
    return this.prisma.periodRecovery.create({
      data: {
        ...data,
        status: 'PENDING',
      },
      include: {
        studentEnrollment: {
          include: {
            student: true,
            group: { include: { grade: true } },
          },
        },
        subject: true,
        assignedBy: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async findByTerm(academicTermId: string, status?: RecoveryStatus) {
    return this.prisma.periodRecovery.findMany({
      where: {
        academicTermId,
        ...(status && { status }),
      },
      include: {
        studentEnrollment: {
          include: {
            student: true,
            group: { include: { grade: true } },
          },
        },
        subject: true,
        assignedBy: { select: { firstName: true, lastName: true } },
        evaluatedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: [
        { studentEnrollment: { student: { lastName: 'asc' } } },
        { subject: { name: 'asc' } },
      ],
    });
  }

  async findByStudent(studentEnrollmentId: string) {
    return this.prisma.periodRecovery.findMany({
      where: { studentEnrollmentId },
      include: {
        academicTerm: true,
        subject: true,
        assignedBy: { select: { firstName: true, lastName: true } },
        evaluatedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateActivity(
    id: string,
    data: {
      activityDescription?: string;
      scheduledDate?: Date;
      reinforcedDimension?: string;
      evidences?: string;
      observations?: string;
    },
  ) {
    return this.prisma.periodRecovery.update({
      where: { id },
      data: {
        ...data,
        status: 'IN_PROGRESS',
      },
    });
  }

  async registerResult(
    id: string,
    data: {
      recoveryScore: number;
      evidences?: string;
      observations?: string;
      evaluatedById: string;
    },
    institutionId: string,
  ) {
    const recovery = await this.prisma.periodRecovery.findUnique({
      where: { id },
      include: {
        academicTerm: true,
      },
    });

    if (!recovery) throw new Error('Recovery not found');

    const config = await this.configService.getOrCreateDefaultConfig(
      institutionId,
      recovery.academicTerm.academicYearId,
    );

    // Calcular nota final según el tipo de impacto configurado
    const originalScore = Number(recovery.originalScore);
    const recoveryScore = data.recoveryScore;
    const maxScore = Number(config.periodMaxScore);
    const minPassing = Number(config.minPassingScore);

    let finalScore: number;
    let status: RecoveryStatus;

    switch (config.periodImpactType) {
      case 'ADJUST_TO_MINIMUM':
        finalScore = Math.min(recoveryScore >= minPassing ? minPassing : recoveryScore, maxScore);
        break;
      case 'AVERAGE_WITH_ORIGINAL':
        finalScore = Math.min((originalScore + recoveryScore) / 2, maxScore);
        break;
      case 'REPLACE_IF_HIGHER':
        finalScore = Math.min(Math.max(originalScore, recoveryScore), maxScore);
        break;
      case 'QUALITATIVE_ONLY':
        finalScore = originalScore; // No cambia la nota
        break;
      default:
        finalScore = Math.min(recoveryScore, maxScore);
    }

    status = finalScore >= minPassing ? 'APPROVED' : 'NOT_APPROVED';

    return this.prisma.periodRecovery.update({
      where: { id },
      data: {
        recoveryScore: data.recoveryScore,
        finalScore,
        impactType: config.periodImpactType,
        evidences: data.evidences,
        observations: data.observations,
        evaluatedById: data.evaluatedById,
        completedDate: new Date(),
        status,
      },
      include: {
        studentEnrollment: {
          include: { student: true },
        },
        subject: true,
      },
    });
  }

  async getRecoveryStats(academicTermId: string) {
    const recoveries = await this.prisma.periodRecovery.groupBy({
      by: ['status'],
      where: { academicTermId },
      _count: true,
    });

    return recoveries.reduce((acc, r) => {
      acc[r.status] = r._count;
      return acc;
    }, {} as Record<string, number>);
  }
}
