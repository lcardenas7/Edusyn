import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CreateEvaluativeActivityDto } from './dto/create-evaluative-activity.dto';

@Injectable()
export class EvaluativeActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEvaluativeActivityDto) {
    return this.prisma.evaluativeActivity.create({
      data: {
        teacherAssignmentId: dto.teacherAssignmentId,
        academicTermId: dto.academicTermId,
        evaluationPlanId: dto.evaluationPlanId,
        componentId: dto.componentId,
        name: dto.name,
        dueDate: dto.dueDate,
      },
    });
  }

  async list(params: {
    teacherAssignmentId?: string;
    academicTermId?: string;
    evaluationPlanId?: string;
    componentId?: string;
  }) {
    return this.prisma.evaluativeActivity.findMany({
      where: {
        teacherAssignmentId: params.teacherAssignmentId,
        academicTermId: params.academicTermId,
        evaluationPlanId: params.evaluationPlanId,
        componentId: params.componentId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
