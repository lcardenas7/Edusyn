import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, Request } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StudentsService } from './students.service';
import { CreateStudentDto, UpdateStudentDto, EnrollStudentDto, UpdateEnrollmentStatusDto } from './dto/create-student.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async create(@Body() dto: CreateStudentDto) {
    return this.studentsService.create(dto);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async list(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('groupId') groupId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    return this.studentsService.list({ institutionId: instId, groupId, academicYearId });
  }

  /**
   * Obtiene las credenciales de estudiantes con acceso al sistema
   * MUST be before :id routes to avoid 'credentials' being treated as an id
   */
  @Get('credentials/list')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getCredentials(@Request() req: any, @Query('institutionId') institutionId?: string) {
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    if (!instId) throw new Error('No se pudo determinar la institución');
    return this.studentsService.getCredentials(instId);
  }

  @Post('enroll')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async enroll(@Body() dto: EnrollStudentDto) {
    return this.studentsService.enroll(dto);
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

  @Post('bulk-activate-access')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async bulkActivateAccess(@Body() data: { studentIds: string[] }) {
    return this.studentsService.bulkActivateAccess(data.studentIds);
  }

  @Post('bulk-reset-password')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async bulkResetPassword(@Body() data: { studentIds: string[] }) {
    return this.studentsService.bulkResetPassword(data.studentIds);
  }

  @Post('bulk-delete-without-records')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async bulkDeleteWithoutRecords(@Body() data: { institutionId: string }) {
    return this.studentsService.bulkDeleteWithoutRecords(data.institutionId);
  }

  @Put('enrollment/:enrollmentId/status')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async updateEnrollmentStatus(
    @Param('enrollmentId') enrollmentId: string,
    @Body() dto: UpdateEnrollmentStatusDto,
  ) {
    return this.studentsService.updateEnrollmentStatus(enrollmentId, dto);
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

  @Get(':studentId/enrollments')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getEnrollments(@Param('studentId') studentId: string) {
    return this.studentsService.getEnrollmentsByStudent(studentId);
  }

  @Post(':id/activate-access')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async activateAccess(@Param('id') id: string) {
    return this.studentsService.activateAccess(id);
  }

  @Post(':id/deactivate-access')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async deactivateAccess(@Param('id') id: string) {
    return this.studentsService.deactivateAccess(id);
  }

  @Post(':id/reset-password')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async resetPassword(@Param('id') id: string) {
    return this.studentsService.resetPassword(id);
  }
}
