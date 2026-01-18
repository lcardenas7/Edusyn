import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EvaluationPlansService } from './evaluation-plans.service';
import { UpsertEvaluationPlanDto } from './dto/upsert-evaluation-plan.dto';

@Controller('evaluation-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EvaluationPlansController {
  constructor(private readonly evaluationPlansService: EvaluationPlansService) {}

  @Post('upsert')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async upsert(@Body() dto: UpsertEvaluationPlanDto) {
    return this.evaluationPlansService.upsert(dto);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async get(
    @Query('teacherAssignmentId') teacherAssignmentId: string,
    @Query('academicTermId') academicTermId: string,
  ) {
    return this.evaluationPlansService.get({ teacherAssignmentId, academicTermId });
  }
}
