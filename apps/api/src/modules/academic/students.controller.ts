import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards, Request } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CredentialsGuard } from '../auth/guards/credentials.guard';
import { StudentsGuard } from '../auth/guards/students.guard';
import { StudentsService } from './students.service';
import { CreateStudentDto, UpdateStudentDto, EnrollStudentDto, UpdateEnrollmentStatusDto } from './dto/create-student.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveInstitutionId, requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @UseGuards(StudentsGuard)
  async create(@Request() req: any, @Body() dto: CreateStudentDto) {
    const instId = await requireInstitutionId(this.prisma as any, req, dto.institutionId);
    return this.studentsService.create(dto, instId);
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async list(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('groupId') groupId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.studentsService.list({ institutionId: instId, groupId, academicYearId });
  }

  /**
   * Obtiene las credenciales de estudiantes con acceso al sistema
   * MUST be before :id routes to avoid 'credentials' being treated as an id
   * Acceso: Admin, Coordinador, o docentes con permiso delegado (canManageCredentials)
   */
  @Get('credentials/list')
  @UseGuards(CredentialsGuard)
  async getCredentials(@Request() req: any, @Query('institutionId') institutionId?: string) {
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    if (!instId) throw new Error('No se pudo determinar la institución');
    return this.studentsService.getCredentials(instId);
  }

  @Post('enroll')
  @UseGuards(StudentsGuard)
  async enroll(@Request() req: any, @Body() dto: EnrollStudentDto) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.studentsService.enroll(dto, instId);
  }

  @Post('bulk-import')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async bulkImport(@Request() req: any, @Body() data: {
    institutionId: string;
    academicYearId: string;
    students: any[];
  }) {
    const instId = await requireInstitutionId(this.prisma as any, req, data.institutionId);
    return this.studentsService.bulkImport(data, instId);
  }

  @Post('bulk-activate-access')
  @UseGuards(CredentialsGuard)
  async bulkActivateAccess(@Request() req: any, @Body() data: { studentIds: string[] }) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.studentsService.bulkActivateAccess(data.studentIds, instId);
  }

  @Post('bulk-reset-password')
  @UseGuards(CredentialsGuard)
  async bulkResetPassword(@Request() req: any, @Body() data: { studentIds: string[] }) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.studentsService.bulkResetPassword(data.studentIds, instId);
  }

  /**
   * Iguala la contraseña de cada estudiante a su nombre de usuario (usuario = contraseña).
   * Acceso: Admin, Coordinador, o docentes con permiso delegado (canManageCredentials)
   */
  @Post('bulk-password-equals-username')
  @UseGuards(CredentialsGuard)
  async bulkPasswordEqualsUsername(@Request() req: any, @Body() data: { studentIds: string[] }) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.studentsService.bulkSetPasswordToUsername(data.studentIds, instId);
  }

  /**
   * Regenera credenciales (username + password) de estudiantes sin acceso activo.
   * Útil cuando se actualizaron documentos pero los usernames quedaron con datos viejos.
   * Solo afecta estudiantes que nunca han iniciado sesión (mustChangePassword=true).
   * Acceso: Admin, Coordinador, o docentes con permiso delegado (canManageCredentials)
   */
  @Post('bulk-regenerate-credentials')
  @UseGuards(CredentialsGuard)
  async bulkRegenerateCredentials(@Request() req: any, @Body() data: { studentIds: string[] }) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.studentsService.bulkRegenerateCredentials(data.studentIds, instId);
  }

  @Post('bulk-delete-without-records')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async bulkDeleteWithoutRecords(@Request() req: any, @Body() data: { institutionId: string }) {
    const instId = await requireInstitutionId(this.prisma as any, req, data.institutionId);
    return this.studentsService.bulkDeleteWithoutRecords(instId);
  }

  /**
   * Exporta estudiantes con system_id para actualización masiva.
   * El Excel generado incluye el id interno como columna inmutable.
   * Permite filtrar por grupo y año académico.
   */
  @Get('export-for-update')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async exportForBulkUpdate(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('groupId') groupId?: string,
    @Query('academicYearId') academicYearId?: string,
  ) {
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    if (!instId) throw new Error('No se pudo determinar la institución');
    return this.studentsService.getStudentsForBulkUpdate(instId, { groupId, academicYearId });
  }

  /**
   * Actualización masiva de estudiantes usando system_id como identificador.
   * Permite cambiar cualquier dato incluyendo documento.
   * previewOnly=true retorna preview sin ejecutar.
   */
  @Post('bulk-update')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async bulkUpdate(
    @Request() req: any,
    @Body() data: { institutionId?: string; rows: any[]; previewOnly?: boolean },
  ) {
    const instId = await resolveInstitutionId(this.prisma as any, req, data.institutionId);
    if (!instId) throw new Error('No se pudo determinar la institución');
    return this.studentsService.bulkUpdateStudents(instId, data.rows, data.previewOnly ?? false);
  }

  @Put('enrollment/:enrollmentId/status')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async updateEnrollmentStatus(
    @Request() req: any,
    @Param('enrollmentId') enrollmentId: string,
    @Body() dto: UpdateEnrollmentStatusDto,
  ) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.studentsService.updateEnrollmentStatus(enrollmentId, dto, instId);
  }

  @Get(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async findById(@Request() req: any, @Param('id') id: string) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.studentsService.findById(id, instId);
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateStudentDto) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.studentsService.update(id, dto, instId);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async delete(@Request() req: any, @Param('id') id: string) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.studentsService.delete(id, instId);
  }

  @Get(':studentId/enrollments')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getEnrollments(@Request() req: any, @Param('studentId') studentId: string) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.studentsService.getEnrollmentsByStudent(studentId, instId);
  }

  @Post(':id/activate-access')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async activateAccess(@Request() req: any, @Param('id') id: string) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.studentsService.activateAccess(id, instId);
  }

  @Post(':id/deactivate-access')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async deactivateAccess(@Request() req: any, @Param('id') id: string) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.studentsService.deactivateAccess(id, instId);
  }

  @Post(':id/reset-password')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async resetPassword(@Request() req: any, @Param('id') id: string) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.studentsService.resetPassword(id, instId);
  }
}
