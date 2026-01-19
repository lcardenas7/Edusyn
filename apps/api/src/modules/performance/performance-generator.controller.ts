import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PerformanceGeneratorService } from './performance-generator.service';

@Controller('performance-generator')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PerformanceGeneratorController {
  constructor(private readonly generatorService: PerformanceGeneratorService) {}

  @Get('student')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async generateStudentPerformances(
    @Query('studentEnrollmentId') studentEnrollmentId: string,
    @Query('academicTermId') academicTermId: string,
    @Query('institutionId') institutionId: string,
  ) {
    return this.generatorService.generateStudentPerformances(
      studentEnrollmentId,
      academicTermId,
      institutionId,
    );
  }

  @Get('report')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getPerformanceReport(
    @Query('institutionId') institutionId: string,
    @Query('academicTermId') academicTermId: string,
    @Query('groupId') groupId?: string,
  ) {
    return this.generatorService.getPerformanceReport(
      institutionId,
      academicTermId,
      groupId,
    );
  }

  @Get('scale')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getPerformanceScale(@Query('institutionId') institutionId: string) {
    return this.generatorService.getPerformanceScale(institutionId);
  }
}
