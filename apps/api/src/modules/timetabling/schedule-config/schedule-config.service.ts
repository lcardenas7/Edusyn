import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ScheduleMode } from '@prisma/client';

@Injectable()
export class ScheduleConfigService {
  constructor(private prisma: PrismaService) {}

  async findAll(institutionId: string, academicYearId: string) {
    return this.prisma.scheduleGradeConfig.findMany({
      where: { institutionId, academicYearId },
      orderBy: { grade: { number: 'asc' } },
      include: {
        grade: { select: { id: true, name: true, stage: true, number: true } },
      },
    });
  }

  async findOne(id: string, institutionId: string) {
    const config = await this.prisma.scheduleGradeConfig.findFirst({
      where: { id, institutionId },
      include: {
        grade: { select: { id: true, name: true, stage: true, number: true } },
      },
    });
    if (!config) throw new NotFoundException('Configuración de horario no encontrada');
    return config;
  }

  async upsert(institutionId: string, data: {
    academicYearId: string;
    gradeId: string;
    mode?: ScheduleMode;
    maxConsecutiveHours?: number;
    preferDistribution?: boolean;
    avoidHeavyLastHours?: boolean;
    allowDoubleBlocks?: boolean;
  }) {
    const existing = await this.prisma.scheduleGradeConfig.findFirst({
      where: {
        institutionId,
        academicYearId: data.academicYearId,
        gradeId: data.gradeId,
      },
    });

    if (existing) {
      return this.prisma.scheduleGradeConfig.update({
        where: { id: existing.id },
        data: {
          mode: data.mode,
          maxConsecutiveHours: data.maxConsecutiveHours,
          preferDistribution: data.preferDistribution,
          avoidHeavyLastHours: data.avoidHeavyLastHours,
          allowDoubleBlocks: data.allowDoubleBlocks,
        },
        include: {
          grade: { select: { id: true, name: true, stage: true, number: true } },
        },
      });
    }

    return this.prisma.scheduleGradeConfig.create({
      data: {
        institutionId,
        academicYearId: data.academicYearId,
        gradeId: data.gradeId,
        mode: data.mode || 'ROTATING_TEACHER',
        maxConsecutiveHours: data.maxConsecutiveHours,
        preferDistribution: data.preferDistribution ?? true,
        avoidHeavyLastHours: data.avoidHeavyLastHours ?? false,
        allowDoubleBlocks: data.allowDoubleBlocks ?? true,
      },
      include: {
        grade: { select: { id: true, name: true, stage: true, number: true } },
      },
    });
  }

  async bulkUpsert(institutionId: string, academicYearId: string, configs: Array<{
    gradeId: string;
    mode?: ScheduleMode;
    maxConsecutiveHours?: number;
    preferDistribution?: boolean;
    avoidHeavyLastHours?: boolean;
    allowDoubleBlocks?: boolean;
  }>) {
    const results: any[] = [];
    for (const config of configs) {
      const result = await this.upsert(institutionId, {
        academicYearId,
        ...config,
      });
      results.push(result);
    }
    return results;
  }

  async delete(id: string, institutionId: string) {
    await this.findOne(id, institutionId);
    return this.prisma.scheduleGradeConfig.delete({ where: { id } });
  }
}
