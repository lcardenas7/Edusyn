import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { UpsertPerformanceScaleDto } from './dto/upsert-performance-scale.dto';

@Injectable()
export class PerformanceScaleService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(dto: UpsertPerformanceScaleDto) {
    return this.prisma.performanceScale.upsert({
      where: {
        institutionId_level: {
          institutionId: dto.institutionId,
          level: dto.level,
        },
      },
      update: {
        minScore: dto.minScore,
        maxScore: dto.maxScore,
      },
      create: {
        institutionId: dto.institutionId,
        level: dto.level,
        minScore: dto.minScore,
        maxScore: dto.maxScore,
      },
    });
  }

  async list(params: { institutionId: string }) {
    return this.prisma.performanceScale.findMany({
      where: { institutionId: params.institutionId },
      orderBy: { level: 'asc' },
    });
  }
}
