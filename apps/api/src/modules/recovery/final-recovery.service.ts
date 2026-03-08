import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryStatus, RecoveryActivityType } from '@prisma/client';
import { RecoveryConfigService } from './recovery-config.service';
import { RecoveryEngineService } from './recovery-engine.service';

@Injectable()
export class FinalRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: RecoveryConfigService,
    private readonly engine: RecoveryEngineService,
  ) {}

  async detectAreasNeedingRecovery(
    academicYearId: string,
    institutionId: string,
  ) {
    const config = await this.configService.getOrCreateDefaultConfig(
      institutionId,
      academicYearId,
    );

    const minScore = Number(config.minPassingScore);

    // Obtener todas las matrículas activas del año
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        academicYearId,
        status: 'ACTIVE',
      },
      include: {
        student: true,
        group: { include: { grade: true } },
        periodFinalGrades: {
          include: {
            subject: { include: { area: true } },
            academicTerm: true,
          },
        },
      },
    });

    const studentsNeedingRecovery: any[] = [];

    for (const enrollment of enrollments) {
      // Agrupar notas por área
      const areaScores: Record<string, { scores: number[]; areaName: string }> = {};

      for (const grade of enrollment.periodFinalGrades) {
        const areaId = grade.subject.areaId;
        const areaName = grade.subject.area.name;

        if (!areaScores[areaId]) {
          areaScores[areaId] = { scores: [], areaName };
        }
        areaScores[areaId].scores.push(Number(grade.finalScore));
      }

      // Calcular promedio por área y detectar reprobadas
      const failedAreas: any[] = [];
      for (const [areaId, data] of Object.entries(areaScores)) {
        const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        if (avgScore < minScore) {
          failedAreas.push({
            areaId,
            areaName: data.areaName,
            avgScore: Math.round(avgScore * 10) / 10,
          });
        }
      }

      if (failedAreas.length > 0) {
        studentsNeedingRecovery.push({
          studentEnrollmentId: enrollment.id,
          studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
          group: `${enrollment.group.grade?.name} ${enrollment.group.name}`,
          failedAreas,
          canRecover: failedAreas.length <= config.maxAreasRecoverable,
        });
      }
    }

    return studentsNeedingRecovery;
  }

  async create(data: {
    studentEnrollmentId: string;
    academicYearId: string;
    areaId: string;
    originalAreaScore: number;
    activityType?: RecoveryActivityType;
    activities?: string;
    objectives?: string;
    resources?: string;
    startDate?: Date;
    endDate?: Date;
    responsibleTeacherId: string;
    supervisorId?: string;
  }) {
    const enr = await this.prisma.studentEnrollment.findUnique({
      where: { id: data.studentEnrollmentId },
      select: { institutionId: true },
    });
    if (!enr) throw new BadRequestException('Matrícula no encontrada');

    // Validar que la recuperación final esté permitida
    const validation = await this.engine.validateRecoveryCreation({
      institutionId: enr.institutionId,
      academicYearId: data.academicYearId,
      type: 'FINAL',
    });
    if (!validation.allowed) throw new BadRequestException(validation.reason);

    // Validar intentos restantes
    const rule = await this.engine.getApplicableRule({
      institutionId: enr.institutionId,
      academicYearId: data.academicYearId,
      type: 'FINAL',
      activityType: data.activityType,
    });

    const attemptCheck = await this.engine.validateAttempt({
      studentEnrollmentId: data.studentEnrollmentId,
      areaId: data.areaId,
      academicYearId: data.academicYearId,
      maxAttempts: rule.maxAttempts,
      type: 'FINAL',
    });
    if (!attemptCheck.canAttempt) throw new BadRequestException(attemptCheck.reason);

    // Actualizar promotionStatus a PENDING_RECOVERY
    await this.prisma.studentEnrollment.update({
      where: { id: data.studentEnrollmentId },
      data: { promotionStatus: 'PENDING_RECOVERY' },
    });

    return this.prisma.finalRecoveryPlan.create({
      data: {
        studentEnrollmentId: data.studentEnrollmentId,
        academicYearId: data.academicYearId,
        areaId: data.areaId,
        originalAreaScore: data.originalAreaScore,
        activityType: data.activityType,
        activities: data.activities,
        objectives: data.objectives,
        resources: data.resources,
        startDate: data.startDate,
        endDate: data.endDate,
        responsibleTeacherId: data.responsibleTeacherId,
        supervisorId: data.supervisorId,
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
        area: true,
        responsibleTeacher: { select: { firstName: true, lastName: true } },
        supervisor: { select: { firstName: true, lastName: true } },
      },
    });
  }

  async findByYear(academicYearId: string, status?: RecoveryStatus) {
    return this.prisma.finalRecoveryPlan.findMany({
      where: {
        academicYearId,
        ...(status && { status }),
      },
      include: {
        studentEnrollment: {
          include: {
            student: true,
            group: { include: { grade: true } },
          },
        },
        area: true,
        responsibleTeacher: { select: { firstName: true, lastName: true } },
        supervisor: { select: { firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
        academicActs: true,
      },
      orderBy: [
        { studentEnrollment: { student: { lastName: 'asc' } } },
        { area: { name: 'asc' } },
      ],
    });
  }

  async findByStudent(studentEnrollmentId: string) {
    return this.prisma.finalRecoveryPlan.findMany({
      where: { studentEnrollmentId },
      include: {
        academicYear: true,
        area: true,
        responsibleTeacher: { select: { firstName: true, lastName: true } },
        supervisor: { select: { firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
        academicActs: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePlan(
    id: string,
    data: {
      activities?: string;
      objectives?: string;
      resources?: string;
      startDate?: Date;
      endDate?: Date;
      evidences?: string;
      observations?: string;
    },
  ) {
    return this.prisma.finalRecoveryPlan.update({
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
    },
    institutionId: string,
  ) {
    const plan = await this.prisma.finalRecoveryPlan.findUnique({
      where: { id },
    });

    if (!plan) throw new BadRequestException('Plan de recuperación no encontrado');

    // Obtener regla aplicable (granular o general)
    const rule = await this.engine.getApplicableRule({
      institutionId,
      academicYearId: plan.academicYearId,
      type: 'FINAL',
      activityType: plan.activityType || undefined,
    });

    const config = await this.configService.getOrCreateDefaultConfig(
      institutionId,
      plan.academicYearId,
    );

    // Usar el engine para calcular impacto
    const { finalScore: finalAreaScore } = this.engine.calculateRecoveryImpact({
      originalScore: Number(plan.originalAreaScore),
      recoveryScore: data.recoveryScore,
      maxScore: rule.maxScore,
      minPassingScore: Number(config.minPassingScore),
      impactType: rule.impactType,
    });

    return this.prisma.finalRecoveryPlan.update({
      where: { id },
      data: {
        recoveryScore: data.recoveryScore,
        finalAreaScore,
        impactType: rule.impactType,
        evidences: data.evidences,
        observations: data.observations,
        completedDate: new Date(),
        status: 'REVIEW_PENDING',
      },
    });
  }

  async approveRecovery(
    id: string,
    data: {
      finalDecision: string;
      approvedById: string;
    },
    institutionId: string,
  ) {
    const plan = await this.prisma.finalRecoveryPlan.findUnique({
      where: { id },
    });

    if (!plan) throw new BadRequestException('Plan de recuperación no encontrado');

    const config = await this.configService.getOrCreateDefaultConfig(
      institutionId,
      plan.academicYearId,
    );

    const minPassing = Number(config.minPassingScore);
    const finalScore = plan.finalAreaScore ? Number(plan.finalAreaScore) : 0;
    const status: RecoveryStatus = finalScore >= minPassing ? 'APPROVED' : 'NOT_APPROVED';

    const updated = await this.prisma.finalRecoveryPlan.update({
      where: { id },
      data: {
        finalDecision: data.finalDecision,
        approvedById: data.approvedById,
        approvalDate: new Date(),
        status,
      },
    });

    // Recalcular promotionStatus del estudiante
    await this.engine.recalculatePromotionStatus(
      plan.studentEnrollmentId,
      institutionId,
    );

    return updated;
  }

  async getRecoveryStats(academicYearId: string, institutionId: string) {
    return this.engine.getEnrichedStats({
      academicYearId,
      institutionId,
      type: 'FINAL',
    });
  }
}
