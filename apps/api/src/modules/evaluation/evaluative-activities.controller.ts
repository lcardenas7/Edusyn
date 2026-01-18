import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateEvaluativeActivityDto } from './dto/create-evaluative-activity.dto';
import { EvaluativeActivitiesService } from './evaluative-activities.service';

@Controller('evaluative-activities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluativeActivitiesController {
  constructor(
    private readonly evaluativeActivitiesService: EvaluativeActivitiesService,
  ) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async create(@Body() dto: CreateEvaluativeActivityDto) {
    return this.evaluativeActivitiesService.create(dto);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async list(
    @Query('teacherAssignmentId') teacherAssignmentId?: string,
    @Query('academicTermId') academicTermId?: string,
    @Query('evaluationPlanId') evaluationPlanId?: string,
    @Query('componentId') componentId?: string,
  ) {
    return this.evaluativeActivitiesService.list({
      teacherAssignmentId,
      academicTermId,
      evaluationPlanId,
      componentId,
    });
  }
}
