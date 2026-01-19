import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PerformanceConfigService {
  constructor(private prisma: PrismaService) {}

  async getConfig(institutionId: string) {
    return this.prisma.performanceConfig.findUnique({
      where: { institutionId },
    });
  }

  async upsertConfig(data: {
    institutionId: string;
    isEnabled?: boolean;
    showByDimension?: boolean;
    allowManualEdit?: boolean;
  }) {
    return this.prisma.performanceConfig.upsert({
      where: { institutionId: data.institutionId },
      update: {
        isEnabled: data.isEnabled,
        showByDimension: data.showByDimension,
        allowManualEdit: data.allowManualEdit,
      },
      create: {
        institutionId: data.institutionId,
        isEnabled: data.isEnabled ?? true,
        showByDimension: data.showByDimension ?? true,
        allowManualEdit: data.allowManualEdit ?? false,
      },
    });
  }

  async getLevelComplements(institutionId: string) {
    return this.prisma.performanceLevelComplement.findMany({
      where: { institutionId },
      orderBy: { level: 'asc' },
    });
  }

  async upsertLevelComplement(data: {
    institutionId: string;
    level: 'SUPERIOR' | 'ALTO' | 'BASICO' | 'BAJO';
    complement: string;
    isActive?: boolean;
    displayMode?: 'CONCATENATE' | 'SEPARATE_LINE';
  }) {
    return this.prisma.performanceLevelComplement.upsert({
      where: {
        institutionId_level: {
          institutionId: data.institutionId,
          level: data.level,
        },
      },
      update: {
        complement: data.complement,
        isActive: data.isActive,
        displayMode: data.displayMode,
      },
      create: {
        institutionId: data.institutionId,
        level: data.level,
        complement: data.complement,
        isActive: data.isActive ?? true,
        displayMode: data.displayMode ?? 'CONCATENATE',
      },
    });
  }

  async bulkUpsertLevelComplements(
    institutionId: string,
    complements: Array<{
      level: 'SUPERIOR' | 'ALTO' | 'BASICO' | 'BAJO';
      complement: string;
      isActive?: boolean;
      displayMode?: 'CONCATENATE' | 'SEPARATE_LINE';
    }>,
  ) {
    const results = await Promise.all(
      complements.map((c) =>
        this.upsertLevelComplement({
          institutionId,
          ...c,
        }),
      ),
    );
    return results;
  }

  async createDefaultComplements(institutionId: string) {
    const defaultComplements = [
      {
        level: 'BAJO' as const,
        complement: 'presentando dificultades significativas en el desarrollo de las competencias.',
      },
      {
        level: 'BASICO' as const,
        complement: 'desarrollando las competencias con apoyo y acompañamiento del docente.',
      },
      {
        level: 'ALTO' as const,
        complement: 'demostrando un adecuado dominio y aplicación de las competencias.',
      },
      {
        level: 'SUPERIOR' as const,
        complement: 'evidenciando un desempeño autónomo, crítico y sobresaliente.',
      },
    ];

    return this.bulkUpsertLevelComplements(institutionId, defaultComplements);
  }
}
