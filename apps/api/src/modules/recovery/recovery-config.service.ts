import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RecoveryImpactType } from '@prisma/client';

@Injectable()
export class RecoveryConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(institutionId: string, academicYearId: string) {
    return this.prisma.recoveryConfig.findUnique({
      where: {
        institutionId_academicYearId: {
          institutionId,
          academicYearId,
        },
      },
      include: {
        recoveryRules: {
          orderBy: [{ appliesTo: 'asc' }, { activityType: 'asc' }],
        },
      },
    });
  }

  async upsertConfig(data: {
    institutionId: string;
    academicYearId: string;
    minPassingScore?: number;
    periodRecoveryEnabled?: boolean;
    periodMaxScore?: number;
    periodImpactType?: RecoveryImpactType;
    periodRecoveryMaxAttempts?: number;
    periodRequiresReviewApproval?: boolean;
    finalRecoveryEnabled?: boolean;
    finalMaxScore?: number;
    finalImpactType?: RecoveryImpactType;
    finalRecoveryMaxAttempts?: number;
    maxAreasRecoverable?: number;
    maxSubjectsRecoverable?: number;
    autoRetainAreas?: number;
    autoRetainSubjects?: number;
    periodRecoveryStartDate?: Date;
    periodRecoveryEndDate?: Date;
    finalRecoveryStartDate?: Date;
    finalRecoveryEndDate?: Date;
    requiresAcademicCouncilAct?: boolean;
    requiresPromotionAct?: boolean;
  }) {
    const { institutionId, academicYearId, ...rest } = data;

    // Only pick allowed scalar fields — ignore id, timestamps, relations, etc.
    const configData: Record<string, any> = {};
    const allowedKeys = [
      'minPassingScore', 'periodRecoveryEnabled', 'periodMaxScore',
      'periodImpactType', 'periodRecoveryMaxAttempts', 'periodRequiresReviewApproval',
      'finalRecoveryEnabled', 'finalMaxScore', 'finalImpactType',
      'finalRecoveryMaxAttempts', 'maxAreasRecoverable', 'maxSubjectsRecoverable',
      'autoRetainAreas', 'autoRetainSubjects',
      'periodRecoveryStartDate', 'periodRecoveryEndDate',
      'finalRecoveryStartDate', 'finalRecoveryEndDate',
      'requiresAcademicCouncilAct', 'requiresPromotionAct',
    ];
    for (const key of allowedKeys) {
      if (key in rest) configData[key] = (rest as any)[key];
    }

    return this.prisma.recoveryConfig.upsert({
      where: {
        institutionId_academicYearId: {
          institutionId,
          academicYearId,
        },
      },
      update: configData,
      create: {
        institutionId,
        academicYearId,
        ...configData,
      },
    });
  }

  async getOrCreateDefaultConfig(institutionId: string, academicYearId: string) {
    const existing = await this.prisma.recoveryConfig.findUnique({
      where: {
        institutionId_academicYearId: { institutionId, academicYearId },
      },
    });
    
    if (existing) return existing;

    return this.prisma.recoveryConfig.create({
      data: {
        institutionId,
        academicYearId,
        minPassingScore: 3.0,
        periodRecoveryEnabled: true,
        periodMaxScore: 3.0,
        periodImpactType: 'ADJUST_TO_MINIMUM',
        periodRecoveryMaxAttempts: 1,
        periodRequiresReviewApproval: true,
        finalRecoveryEnabled: true,
        finalMaxScore: 3.0,
        finalImpactType: 'ADJUST_TO_MINIMUM',
        finalRecoveryMaxAttempts: 1,
        maxAreasRecoverable: 2,
        requiresAcademicCouncilAct: true,
        requiresPromotionAct: true,
      },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD DE REGLAS GRANULARES (RecoveryRule)
  // ═══════════════════════════════════════════════════════════════════════════

  async upsertRule(data: {
    recoveryConfigId: string;
    institutionId: string;
    appliesTo: 'PERIOD' | 'FINAL';
    activityType: string;
    maxScore: number;
    impactType?: RecoveryImpactType;
    maxAttempts?: number;
    isEnabled?: boolean;
    label?: string;
    description?: string;
  }) {
    const { recoveryConfigId, institutionId, appliesTo, activityType, ...ruleData } = data;

    return this.prisma.recoveryRule.upsert({
      where: {
        recoveryConfigId_appliesTo_activityType: {
          recoveryConfigId,
          appliesTo,
          activityType: activityType as any,
        },
      },
      update: ruleData,
      create: {
        recoveryConfigId,
        institutionId,
        appliesTo,
        activityType: activityType as any,
        ...ruleData,
      },
    });
  }

  async deleteRule(id: string) {
    return this.prisma.recoveryRule.delete({ where: { id } });
  }

  async listRules(recoveryConfigId: string) {
    return this.prisma.recoveryRule.findMany({
      where: { recoveryConfigId },
      orderBy: [{ appliesTo: 'asc' }, { activityType: 'asc' }],
    });
  }
}
