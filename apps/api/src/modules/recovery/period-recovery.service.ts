import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryStatus, RecoveryImpactType } from '@prisma/client';
import { RecoveryConfigService } from './recovery-config.service';

@Injectable()
export class PeriodRecoveryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: RecoveryConfigService,
  ) {}

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

    // Buscar notas finales de período por debajo del mínimo
    const lowGrades = await this.prisma.periodFinalGrade.findMany({
      where: {
        academicTermId,
        finalScore: { lt: minScore },
      },
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

    return lowGrades.map((grade) => ({
      studentEnrollmentId: grade.studentEnrollmentId,
      studentName: `${grade.studentEnrollment.student.firstName} ${grade.studentEnrollment.student.lastName}`,
      group: `${grade.studentEnrollment.group.grade?.name} ${grade.studentEnrollment.group.name}`,
      subjectId: grade.subjectId,
      subjectName: grade.subject.name,
      areaName: grade.subject.area.name,
      originalScore: Number(grade.finalScore),
      needsRecovery: true,
    }));
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
