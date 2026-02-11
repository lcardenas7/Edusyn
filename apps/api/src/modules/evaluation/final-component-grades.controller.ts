import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { FinalComponentGradesService } from './final-component-grades.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('final-component-grades')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinalComponentGradesController {
  constructor(private readonly service: FinalComponentGradesService) {}

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getByComponent(
    @Query('finalComponentId') finalComponentId: string,
    @Query('teacherAssignmentId') teacherAssignmentId: string,
  ) {
    return this.service.getByComponent(finalComponentId, teacherAssignmentId);
  }

  @Get('student')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getByStudent(
    @Query('studentEnrollmentId') studentEnrollmentId: string,
    @Query('academicYearId') academicYearId: string,
  ) {
    return this.service.getByStudent(studentEnrollmentId, academicYearId);
  }

  @Post('upsert')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async upsert(@Body() body: {
    studentEnrollmentId: string;
    teacherAssignmentId: string;
    finalComponentId: string;
    grade: number;
  }) {
    return this.service.upsert(body);
  }

  @Post('bulk-upsert')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async bulkUpsert(@Body() body: Array<{
    studentEnrollmentId: string;
    teacherAssignmentId: string;
    finalComponentId: string;
    grade: number;
  }>) {
    return this.service.bulkUpsert(body);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
