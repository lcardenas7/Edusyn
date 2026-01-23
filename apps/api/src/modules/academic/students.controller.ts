import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StudentsService } from './students.service';
import { CreateStudentDto, UpdateStudentDto, EnrollStudentDto, UpdateEnrollmentStatusDto } from './dto/create-student.dto';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async list(
    @Query('institutionId') institutionId?: string,
    @Query('groupId') groupId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    return this.studentsService.list({ institutionId, groupId, academicYearId });
  }

  @Get(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async findById(@Param('id') id: string) {
    return this.studentsService.findById(id);
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.studentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async delete(@Param('id') id: string) {
    return this.studentsService.delete(id);
  }

  @Post('enroll')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async enroll(@Body() dto: EnrollStudentDto) {
    return this.studentsService.enroll(dto);
  }

  @Put('enrollment/:enrollmentId/status')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async updateEnrollmentStatus(
    @Param('enrollmentId') enrollmentId: string,
    @Body() dto: UpdateEnrollmentStatusDto,
  ) {
    return this.studentsService.updateEnrollmentStatus(enrollmentId, dto);
  }

  @Get(':studentId/enrollments')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getEnrollments(@Param('studentId') studentId: string) {
    return this.studentsService.getEnrollmentsByStudent(studentId);
  }

  @Post('bulk-import')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async bulkImport(@Body() data: {
    institutionId: string;
    academicYearId: string;
    students: any[];
  }) {
    return this.studentsService.bulkImport(data);
  }

  /**
   * Activa acceso al sistema para un estudiante
   */
  @Post(':id/activate-access')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async activateAccess(@Param('id') id: string) {
    return this.studentsService.activateAccess(id);
  }

  /**
   * Desactiva acceso al sistema para un estudiante
   */
  @Post(':id/deactivate-access')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async deactivateAccess(@Param('id') id: string) {
    return this.studentsService.deactivateAccess(id);
  }

  /**
   * Activa acceso masivo para múltiples estudiantes
   */
  @Post('bulk-activate-access')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async bulkActivateAccess(@Body() data: { studentIds: string[] }) {
    return this.studentsService.bulkActivateAccess(data.studentIds);
  }
}
