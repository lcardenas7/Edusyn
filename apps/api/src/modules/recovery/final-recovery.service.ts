import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryStatus } from '@prisma/client';
import { RecoveryConfigService } from './recovery-config.service';

@Injectable()
export class FinalRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: RecoveryConfigService,
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
    activities?: string;
    objectives?: string;
    resources?: string;
    startDate?: Date;
    endDate?: Date;
    responsibleTeacherId: string;
    supervisorId?: string;
  }) {
    return this.prisma.finalRecoveryPlan.create({
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

    if (!plan) throw new Error('Recovery plan not found');

    const config = await this.configService.getOrCreateDefaultConfig(
      institutionId,
      plan.academicYearId,
    );

    const originalScore = Number(plan.originalAreaScore);
    const recoveryScore = data.recoveryScore;
    const maxScore = Number(config.finalMaxScore);
    const minPassing = Number(config.minPassingScore);

    let finalAreaScore: number;

    switch (config.finalImpactType) {
      case 'ADJUST_TO_MINIMUM':
        finalAreaScore = Math.min(recoveryScore >= minPassing ? minPassing : recoveryScore, maxScore);
        break;
      case 'AVERAGE_WITH_ORIGINAL':
        finalAreaScore = Math.min((originalScore + recoveryScore) / 2, maxScore);
        break;
      case 'REPLACE_IF_HIGHER':
        finalAreaScore = Math.min(Math.max(originalScore, recoveryScore), maxScore);
        break;
      case 'QUALITATIVE_ONLY':
        finalAreaScore = originalScore;
        break;
      default:
        finalAreaScore = Math.min(recoveryScore, maxScore);
    }

    return this.prisma.finalRecoveryPlan.update({
      where: { id },
      data: {
        recoveryScore: data.recoveryScore,
        finalAreaScore,
        impactType: config.finalImpactType,
        evidences: data.evidences,
        observations: data.observations,
        completedDate: new Date(),
        status: 'COMPLETED',
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

    if (!plan) throw new Error('Recovery plan not found');

    const config = await this.configService.getOrCreateDefaultConfig(
      institutionId,
      plan.academicYearId,
    );

    const minPassing = Number(config.minPassingScore);
    const finalScore = plan.finalAreaScore ? Number(plan.finalAreaScore) : 0;
    const status: RecoveryStatus = finalScore >= minPassing ? 'APPROVED' : 'NOT_APPROVED';

    return this.prisma.finalRecoveryPlan.update({
      where: { id },
      data: {
        finalDecision: data.finalDecision,
        approvedById: data.approvedById,
        approvalDate: new Date(),
        status,
      },
    });
  }

  async getRecoveryStats(academicYearId: string) {
    const plans = await this.prisma.finalRecoveryPlan.groupBy({
      by: ['status'],
      where: { academicYearId },
      _count: true,
    });

    return plans.reduce((acc, p) => {
      acc[p.status] = p._count;
      return acc;
    }, {} as Record<string, number>);
  }
}
