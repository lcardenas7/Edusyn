import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateEvaluationComponentDto } from './dto/create-evaluation-component.dto';

@Injectable()
export class EvaluationComponentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEvaluationComponentDto) {
    return this.prisma.evaluationComponent.create({
      data: {
        institutionId: dto.institutionId,
        code: dto.code,
        name: dto.name,
        parentId: dto.parentId,
      },
    });
  }

  async list(institutionId: string) {
    return this.prisma.evaluationComponent.findMany({
      where: { institutionId },
      include: {
        children: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getHierarchy(institutionId: string) {
    const components = await this.prisma.evaluationComponent.findMany({
      where: { institutionId, parentId: null },
      include: {
        children: {
          include: {
            children: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return components;
  }

  async update(id: string, dto: Partial<CreateEvaluationComponentDto>) {
    return this.prisma.evaluationComponent.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string) {
    return this.prisma.evaluationComponent.delete({ where: { id } });
  }
}
