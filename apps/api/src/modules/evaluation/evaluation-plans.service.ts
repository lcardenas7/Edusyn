import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { UpsertEvaluationPlanDto } from './dto/upsert-evaluation-plan.dto';

@Injectable()
export class EvaluationPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(dto: UpsertEvaluationPlanDto) {
    const total = dto.components.reduce((sum, c) => sum + c.percentage, 0);
    if (total !== 100) {
      throw new BadRequestException(
        'La suma de porcentajes de los componentes debe ser 100',
      );
    }

    const plan = await this.prisma.evaluationPlan.upsert({
      where: {
        teacherAssignmentId_academicTermId: {
          teacherAssignmentId: dto.teacherAssignmentId,
          academicTermId: dto.academicTermId,
        },
      },
      update: {},
      create: {
        teacherAssignmentId: dto.teacherAssignmentId,
        academicTermId: dto.academicTermId,
      },
    });

    await this.prisma.evaluationPlanComponentWeight.deleteMany({
      where: { evaluationPlanId: plan.id },
    });

    await this.prisma.evaluationPlanComponentWeight.createMany({
      data: dto.components.map((c) => ({
        evaluationPlanId: plan.id,
        componentId: c.componentId,
        percentage: c.percentage,
      })),
    });

    return this.get({
      teacherAssignmentId: dto.teacherAssignmentId,
      academicTermId: dto.academicTermId,
    });
  }

  async get(params: { teacherAssignmentId: string; academicTermId: string }) {
    return this.prisma.evaluationPlan.findUnique({
      where: {
        teacherAssignmentId_academicTermId: {
          teacherAssignmentId: params.teacherAssignmentId,
          academicTermId: params.academicTermId,
        },
      },
      include: {
        components: true,
      },
    });
  }
}
