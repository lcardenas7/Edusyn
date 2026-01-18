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
    });
  }

  async upsertConfig(data: {
    institutionId: string;
    academicYearId: string;
    minPassingScore?: number;
    periodRecoveryEnabled?: boolean;
    periodMaxScore?: number;
    periodImpactType?: RecoveryImpactType;
    finalRecoveryEnabled?: boolean;
    finalMaxScore?: number;
    finalImpactType?: RecoveryImpactType;
    maxAreasRecoverable?: number;
    periodRecoveryStartDate?: Date;
    periodRecoveryEndDate?: Date;
    finalRecoveryStartDate?: Date;
    finalRecoveryEndDate?: Date;
    requiresAcademicCouncilAct?: boolean;
    requiresPromotionAct?: boolean;
  }) {
    const { institutionId, academicYearId, ...configData } = data;

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
    let config = await this.getConfig(institutionId, academicYearId);
    
    if (!config) {
      config = await this.prisma.recoveryConfig.create({
        data: {
          institutionId,
          academicYearId,
          minPassingScore: 3.0,
          periodRecoveryEnabled: true,
          periodMaxScore: 3.0,
          periodImpactType: 'ADJUST_TO_MINIMUM',
          finalRecoveryEnabled: true,
          finalMaxScore: 3.0,
          finalImpactType: 'ADJUST_TO_MINIMUM',
          maxAreasRecoverable: 2,
          requiresAcademicCouncilAct: true,
          requiresPromotionAct: true,
        },
      });
    }
    
    return config;
  }
}
