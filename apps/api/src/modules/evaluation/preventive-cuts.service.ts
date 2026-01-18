import { BadRequestException, Injectable } from '@nestjs/common';
import { PerformanceLevel, PreventiveAlertStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ExecutePreventiveCutDto } from './dto/execute-preventive-cut.dto';
import { UpsertPreventiveCutConfigDto } from './dto/upsert-preventive-cut-config.dto';
import { UpdatePreventiveAlertDto } from './dto/update-preventive-alert.dto';
import { StudentGradesService } from './student-grades.service';

@Injectable()
export class PreventiveCutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentGradesService: StudentGradesService,
  ) {}

  async upsertConfig(dto: UpsertPreventiveCutConfigDto) {
    return this.prisma.preventiveCutConfig.upsert({
      where: { academicTermId: dto.academicTermId },
      update: {
        cutoffDate: dto.cutoffDate,
        riskThresholdScore: dto.riskThresholdScore,
      },
      create: {
        academicTermId: dto.academicTermId,
        cutoffDate: dto.cutoffDate,
        riskThresholdScore: dto.riskThresholdScore,
      },
    });
  }

  async getConfig(academicTermId: string) {
    return this.prisma.preventiveCutConfig.findUnique({
      where: { academicTermId },
    });
  }

  async listAlerts(params: {
    teacherAssignmentId?: string;
    academicTermId?: string;
    studentEnrollmentId?: string;
    status?: PreventiveAlertStatus;
  }) {
    return this.prisma.preventiveAlert.findMany({
      where: {
        teacherAssignmentId: params.teacherAssignmentId,
        academicTermId: params.academicTermId,
        studentEnrollmentId: params.studentEnrollmentId,
        status: params.status,
      },
      include: {
        studentEnrollment: {
          include: {
            student: true,
          },
        },
        teacherAssignment: {
          include: {
            subject: true,
            group: true,
          },
        },
        academicTerm: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAlert(id: string, dto: UpdatePreventiveAlertDto) {
    return this.prisma.preventiveAlert.update({
      where: { id },
      data: {
        status: dto.status as any,
        recoveryPlan: dto.recoveryPlan,
        meetingAt: dto.meetingAt,
        notes: dto.notes,
      },
    });
  }

  async execute(dto: ExecutePreventiveCutDto) {
    const teacherAssignment = await this.prisma.teacherAssignment.findUnique({
      where: { id: dto.teacherAssignmentId },
      include: {
        academicYear: true,
      },
    });

    if (!teacherAssignment) {
      throw new BadRequestException('teacherAssignmentId inválido');
    }

    const config = await this.prisma.preventiveCutConfig.findUnique({
      where: { academicTermId: dto.academicTermId },
    });

    if (!config && !dto.cutoffDate) {
      throw new BadRequestException(
        'No hay configuración de corte preventivo para el academicTermId y no se envió cutoffDate',
      );
    }

    const cutoffDate = dto.cutoffDate ?? config!.cutoffDate;
    const threshold = Number(config?.riskThresholdScore ?? 3.0);

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        academicYearId: teacherAssignment.academicYearId,
        groupId: teacherAssignment.groupId,
        status: 'ACTIVE',
      },
      include: {
        student: true,
      },
      orderBy: {
        student: { lastName: 'asc' },
      },
    });

    const alerts = await Promise.all(
      enrollments.map(async (enrollment) => {
        const termGrade = await this.studentGradesService.calculateTermGradeAtDate(
          enrollment.id,
          teacherAssignment.id,
          dto.academicTermId,
          cutoffDate,
        );

        const computedGrade = termGrade.grade;
        const isRisk = computedGrade === null || computedGrade < threshold;

        let performanceLevel: PerformanceLevel | null = null;
        if (computedGrade !== null) {
          const scale = await this.prisma.performanceScale.findFirst({
            where: {
              institutionId: teacherAssignment.academicYear.institutionId,
              minScore: { lte: computedGrade },
              maxScore: { gte: computedGrade },
            },
          });
          performanceLevel = scale?.level ?? null;
        }

        const existing = await this.prisma.preventiveAlert.findUnique({
          where: {
            teacherAssignmentId_studentEnrollmentId_academicTermId: {
              teacherAssignmentId: teacherAssignment.id,
              studentEnrollmentId: enrollment.id,
              academicTermId: dto.academicTermId,
            },
          },
        });

        const nextStatus: PreventiveAlertStatus = isRisk
          ? PreventiveAlertStatus.OPEN
          : PreventiveAlertStatus.RESOLVED;

        const statusToPersist =
          existing?.status === PreventiveAlertStatus.IN_RECOVERY
            ? existing.status
            : nextStatus;

        return this.prisma.preventiveAlert.upsert({
          where: {
            teacherAssignmentId_studentEnrollmentId_academicTermId: {
              teacherAssignmentId: teacherAssignment.id,
              studentEnrollmentId: enrollment.id,
              academicTermId: dto.academicTermId,
            },
          },
          update: {
            cutoffDate,
            computedGrade: computedGrade === null ? null : computedGrade,
            performanceLevel,
            status: statusToPersist,
          },
          create: {
            teacherAssignmentId: teacherAssignment.id,
            studentEnrollmentId: enrollment.id,
            academicTermId: dto.academicTermId,
            cutoffDate,
            computedGrade: computedGrade === null ? null : computedGrade,
            performanceLevel,
            status: statusToPersist,
          },
        });
      }),
    );

    const inRisk = alerts.filter((a) => a.status !== PreventiveAlertStatus.RESOLVED);

    return {
      cutoffDate,
      threshold,
      totalStudents: alerts.length,
      atRisk: inRisk.length,
      alerts,
    };
  }
}
