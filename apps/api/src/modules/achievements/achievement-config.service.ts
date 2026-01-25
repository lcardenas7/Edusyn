import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AchievementConfigService {
  constructor(private prisma: PrismaService) {}

  async getConfig(institutionId: string) {
    return this.prisma.achievementConfig.findUnique({
      where: { institutionId },
      include: {
        valueJudgmentTemplates: {
          orderBy: { level: 'asc' },
        },
      },
    });
  }

  async upsertConfig(data: {
    institutionId: string;
    achievementsPerPeriod?: number;
    usePromotionalAchievement?: boolean;
    useAttitudinalAchievement?: boolean;
    attitudinalMode?: 'GENERAL_PER_PERIOD' | 'PER_ACADEMIC_ACHIEVEMENT';
    useValueJudgments?: boolean;
    displayMode?: 'SEPARATE' | 'COMBINED';
    displayFormat?: 'LIST' | 'PARAGRAPH';
    judgmentPosition?: 'END_OF_EACH' | 'END_OF_ALL' | 'NONE';
  }) {
    return this.prisma.achievementConfig.upsert({
      where: { institutionId: data.institutionId },
      update: {
        achievementsPerPeriod: data.achievementsPerPeriod,
        usePromotionalAchievement: data.usePromotionalAchievement,
        useAttitudinalAchievement: data.useAttitudinalAchievement,
        attitudinalMode: data.attitudinalMode,
        useValueJudgments: data.useValueJudgments,
        displayMode: data.displayMode,
        displayFormat: data.displayFormat,
        judgmentPosition: data.judgmentPosition,
      },
      create: {
        institutionId: data.institutionId,
        achievementsPerPeriod: data.achievementsPerPeriod ?? 1,
        usePromotionalAchievement: data.usePromotionalAchievement ?? true,
        useAttitudinalAchievement: data.useAttitudinalAchievement ?? false,
        attitudinalMode: data.attitudinalMode ?? 'GENERAL_PER_PERIOD',
        useValueJudgments: data.useValueJudgments ?? true,
        displayMode: data.displayMode ?? 'SEPARATE',
        displayFormat: data.displayFormat ?? 'LIST',
        judgmentPosition: data.judgmentPosition ?? 'END_OF_EACH',
      },
      include: {
        valueJudgmentTemplates: true,
      },
    });
  }

  async getValueJudgmentTemplates(institutionId: string) {
    const config = await this.prisma.achievementConfig.findUnique({
      where: { institutionId },
    });
    if (!config) return [];

    return this.prisma.valueJudgmentTemplate.findMany({
      where: { achievementConfigId: config.id },
      orderBy: { level: 'asc' },
    });
  }

  async upsertValueJudgmentTemplate(data: {
    institutionId: string;
    level: 'SUPERIOR' | 'ALTO' | 'BASICO' | 'BAJO';
    template: string;
    isActive?: boolean;
  }) {
    // Ensure config exists
    let config = await this.prisma.achievementConfig.findUnique({
      where: { institutionId: data.institutionId },
    });

    if (!config) {
      config = await this.prisma.achievementConfig.create({
        data: { institutionId: data.institutionId },
      });
    }

    return this.prisma.valueJudgmentTemplate.upsert({
      where: {
        achievementConfigId_level: {
          achievementConfigId: config.id,
          level: data.level,
        },
      },
      update: {
        template: data.template,
        isActive: data.isActive,
      },
      create: {
        achievementConfigId: config.id,
        level: data.level,
        template: data.template,
        isActive: data.isActive ?? true,
      },
    });
  }

  async bulkUpsertValueJudgmentTemplates(
    institutionId: string,
    templates: Array<{
      level: 'SUPERIOR' | 'ALTO' | 'BASICO' | 'BAJO';
      template: string;
      isActive?: boolean;
    }>,
  ) {
    const results = await Promise.all(
      templates.map((t) =>
        this.upsertValueJudgmentTemplate({
          institutionId,
          ...t,
        }),
      ),
    );
    return results;
  }

  async createDefaultTemplates(institutionId: string) {
    const defaultTemplates = [
      {
        level: 'BAJO' as const,
        template: 'Se recomienda reforzar los procesos de aprendizaje con acompañamiento constante.',
      },
      {
        level: 'BASICO' as const,
        template: 'Debe continuar fortaleciendo sus habilidades para consolidar los aprendizajes.',
      },
      {
        level: 'ALTO' as const,
        template: 'Demuestra un buen dominio de las competencias y mantiene un desempeño consistente.',
      },
      {
        level: 'SUPERIOR' as const,
        template: 'Demuestra compromiso, autonomía y excelencia en su proceso de aprendizaje.',
      },
    ];

    return this.bulkUpsertValueJudgmentTemplates(institutionId, defaultTemplates);
  }
}
