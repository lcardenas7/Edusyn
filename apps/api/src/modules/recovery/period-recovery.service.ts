import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryStatus, RecoveryImpactType, RecoveryActivityType } from '@prisma/client';
import { RecoveryConfigService } from './recovery-config.service';
import { RecoveryEngineService } from './recovery-engine.service';

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
    private readonly engine: RecoveryEngineService,
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
        subject: { include: { area: true } },
      },
    });

    // Agrupar por estudiante y área para calcular promedios
    const studentAreaGrades = new Map<string, Map<string, {
      grades: { subjectId: string; subjectName: string; score: number; weight: number; isDominant: boolean }[];
      areaId: string;
      areaName: string;
    }>>();

    for (const gradeRecord of allGrades) {
      const studentKey = gradeRecord.studentEnrollmentId;
      const areaId = gradeRecord.subject.areaId;
      
      if (!studentAreaGrades.has(studentKey)) {
        studentAreaGrades.set(studentKey, new Map());
      }
      
      const studentAreas = studentAreaGrades.get(studentKey)!;
      if (!studentAreas.has(areaId)) {
        studentAreas.set(areaId, {
          grades: [],
          areaId,
          areaName: gradeRecord.subject.area.name,
        });
      }
      
      // Usar valores por defecto (la configuración ahora viene de las plantillas)
      studentAreas.get(areaId)!.grades.push({
        subjectId: gradeRecord.subjectId,
        subjectName: gradeRecord.subject.name,
        score: Number(gradeRecord.finalScore),
        weight: 1.0,  // Peso por defecto, se obtiene de plantillas
        isDominant: false,  // Por defecto, se obtiene de plantillas
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
            const enrollment = studentGrade.studentEnrollment;
            studentsNeedingRecovery.push({
              studentEnrollmentId,
              studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
              group: `${enrollment.group.grade?.name} ${enrollment.group.name}`,
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
    activityType?: RecoveryActivityType;
    activityDescription?: string;
    scheduledDate?: Date;
    reinforcedDimension?: string;
    assignedById: string;
  }) {
    const enr = await this.prisma.studentEnrollment.findUnique({
      where: { id: data.studentEnrollmentId },
      select: { institutionId: true, academicYearId: true },
    });
    if (!enr) throw new BadRequestException('Matrícula no encontrada');

    // Validar que la recuperación esté permitida
    const term = await this.prisma.academicTerm.findUnique({ where: { id: data.academicTermId } });
    if (!term) throw new BadRequestException('Período no encontrado');

    const validation = await this.engine.validateRecoveryCreation({
      institutionId: enr.institutionId,
      academicYearId: enr.academicYearId,
      academicTermId: data.academicTermId,
      type: 'PERIOD',
    });
    if (!validation.allowed) throw new BadRequestException(validation.reason);

    // Validar intentos restantes
    const rule = await this.engine.getApplicableRule({
      institutionId: enr.institutionId,
      academicYearId: enr.academicYearId,
      type: 'PERIOD',
      activityType: data.activityType,
    });

    const attemptCheck = await this.engine.validateAttempt({
      studentEnrollmentId: data.studentEnrollmentId,
      subjectId: data.subjectId,
      academicTermId: data.academicTermId,
      maxAttempts: rule.maxAttempts,
      type: 'PERIOD',
    });
    if (!attemptCheck.canAttempt) throw new BadRequestException(attemptCheck.reason);

    return this.prisma.periodRecovery.create({
      data: {
        studentEnrollmentId: data.studentEnrollmentId,
        academicTermId: data.academicTermId,
        subjectId: data.subjectId,
        originalScore: data.originalScore,
        activityType: data.activityType,
        activityDescription: data.activityDescription,
        scheduledDate: data.scheduledDate,
        reinforcedDimension: data.reinforcedDimension,
        assignedById: data.assignedById,
        institutionId: enr.institutionId,
        attemptNumber: attemptCheck.currentAttempt,
        status: 'ASSIGNED',
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
    const recovery = await this.prisma.periodRecovery.findUnique({
      where: { id },
      include: {
        studentEnrollment: {
          select: { institutionId: true, academicYearId: true },
        },
      },
    });

    if (!recovery) throw new BadRequestException('Recuperación no encontrada');

    const validation = await this.engine.validateRecoveryCreation({
      institutionId: recovery.studentEnrollment.institutionId,
      academicYearId: recovery.studentEnrollment.academicYearId,
      academicTermId: recovery.academicTermId,
      type: 'PERIOD',
    });
    if (!validation.allowed) throw new BadRequestException(validation.reason);

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

    if (!recovery) throw new BadRequestException('Recuperación no encontrada');

    const validation = await this.engine.validateRecoveryCreation({
      institutionId,
      academicYearId: recovery.academicTerm.academicYearId,
      academicTermId: recovery.academicTermId,
      type: 'PERIOD',
    });
    if (!validation.allowed) throw new BadRequestException(validation.reason);

    // Obtener regla aplicable (granular o general)
    const rule = await this.engine.getApplicableRule({
      institutionId,
      academicYearId: recovery.academicTerm.academicYearId,
      type: 'PERIOD',
      activityType: recovery.activityType || undefined,
    });

    const config = await this.configService.getOrCreateDefaultConfig(
      institutionId,
      recovery.academicTerm.academicYearId,
    );

    // Usar el engine para calcular impacto
    const { finalScore, status } = this.engine.calculateRecoveryImpact({
      originalScore: Number(recovery.originalScore),
      recoveryScore: data.recoveryScore,
      maxScore: rule.maxScore,
      minPassingScore: Number(config.minPassingScore),
      impactType: rule.impactType,
    });

    const nextStatus = config.periodRequiresReviewApproval ? 'REVIEW_PENDING' : status;

    const updatedRecovery = await this.prisma.periodRecovery.update({
      where: { id },
      data: {
        recoveryScore: data.recoveryScore,
        finalScore,
        impactType: rule.impactType,
        evidences: data.evidences,
        observations: data.observations,
        evaluatedById: data.evaluatedById,
        completedDate: new Date(),
        status: nextStatus,
      },
      include: {
        studentEnrollment: {
          include: { student: true },
        },
        subject: true,
      },
    });

    if (nextStatus === 'APPROVED') {
      await this.prisma.periodFinalGrade.updateMany({
        where: {
          studentEnrollmentId: recovery.studentEnrollmentId,
          subjectId: recovery.subjectId,
          academicTermId: recovery.academicTermId,
        },
        data: {
          finalScore,
          updatedAt: new Date(),
        },
      });
    }

    return updatedRecovery;
  }

  /**
   * Coordinador aprueba/rechaza el resultado de una recuperación.
   * Flujo: REVIEW_PENDING → APPROVED / NOT_APPROVED
   */
  async reviewResult(
    id: string,
    data: {
      approved: boolean;
      reviewedById: string;
      observations?: string;
    },
  ) {
    const recovery = await this.prisma.periodRecovery.findUnique({ where: { id } });
    if (!recovery) throw new BadRequestException('Recuperación no encontrada');
    if (recovery.status !== 'REVIEW_PENDING') {
      throw new BadRequestException('Solo se pueden revisar recuperaciones en estado REVIEW_PENDING');
    }

    const config = await this.configService.getOrCreateDefaultConfig(
      recovery.institutionId,
      (await this.prisma.academicTerm.findUnique({ where: { id: recovery.academicTermId } }))!.academicYearId,
    );

    // Si aprueba, recalcular nota final; si rechaza, mantener nota original
    let finalStatus: RecoveryStatus;
    let finalScore = recovery.finalScore;

    if (data.approved) {
      finalStatus = Number(recovery.finalScore) >= Number(config.minPassingScore) ? 'APPROVED' : 'NOT_APPROVED';
    } else {
      finalStatus = 'NOT_APPROVED';
      finalScore = recovery.originalScore;
    }

    // Actualizar PeriodRecovery
    const updatedRecovery = await this.prisma.periodRecovery.update({
      where: { id },
      data: {
        status: finalStatus,
        reviewedById: data.reviewedById,
        observations: data.observations
          ? `${recovery.observations || ''}\n[Revisión]: ${data.observations}`
          : recovery.observations,
      },
      include: {
        studentEnrollment: { include: { student: true } },
        subject: true,
        reviewedBy: { select: { firstName: true, lastName: true } },
      },
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // PROPAGACIÓN A PeriodFinalGrade
    // Si la recuperación fue aprobada, actualizar la nota final del período
    // para que los boletines reflejen la nota recuperada
    // ═══════════════════════════════════════════════════════════════════════════
    if (finalStatus === 'APPROVED' && recovery.finalScore !== null) {
      await this.prisma.periodFinalGrade.updateMany({
        where: {
          studentEnrollmentId: recovery.studentEnrollmentId,
          subjectId: recovery.subjectId,
          academicTermId: recovery.academicTermId,
        },
        data: {
          finalScore: recovery.finalScore,
          // Marcar que fue modificada por recuperación
          updatedAt: new Date(),
        },
      });
    }

    return updatedRecovery;
  }

  async getRecoveryStats(academicTermId: string, institutionId: string) {
    return this.engine.getEnrichedStats({
      academicTermId,
      institutionId,
      type: 'PERIOD',
    });
  }
}
