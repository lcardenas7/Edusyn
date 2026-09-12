import { Controller, Post, Put, Get, Body, Param, Query, UseGuards, Request, NotFoundException } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AttendanceService } from './attendance.service';
import { RecordAttendanceDto, UpdateAttendanceDto } from './dto/record-attendance.dto';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

/** Roles con alcance institucional: ven y editan dentro de SU colegio. */
const ROLES_INSTITUCIONALES = ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE'];

/**
 * Asistencia por asignatura (HTTP).
 *
 * **La institución la pone el ACTOR, nunca el recurso que nombra el cliente.** Antes solo
 * `summary` la resolvía; las otras nueve pasaban la asignación, la matrícula, el grupo, el año o la
 * materia recibidos directo al servicio, y el consolidado aceptaba incluso `institutionId` por
 * query para cualquier usuario.
 */
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly prisma: PrismaService,
  ) {}

  /** Actor (quién hace el cambio) del JWT para la auditoría forense. */
  private actorFrom(req: any): { userId?: string; name?: string; role?: string } {
    const roles = this.rolesOf(req);
    return { userId: req?.user?.id, name: req?.user?.email, role: roles.join(', ') || undefined };
  }

  private rolesOf(req: any): string[] {
    const roles = req?.user?.roles;
    return Array.isArray(roles)
      ? roles.map((r: any) => (typeof r === 'string' ? r : r?.role?.name || r?.roleName || r?.name)).filter(Boolean)
      : [];
  }

  /** ¿El actor tiene alcance institucional, o es una familia/estudiante? */
  private tieneAlcanceInstitucional(req: any): boolean {
    return req?.user?.isSuperAdmin === true || this.rolesOf(req).some((r) => ROLES_INSTITUCIONALES.includes(r));
  }

  /**
   * Un ESTUDIANTE solo consulta la matrícula ligada a SU sesión.
   *
   * Las rutas `by-student` y `summary` admiten el rol ESTUDIANTE, y con la matrícula de un
   * compañero devolvían su asistencia. La comprobación va **dentro de la institución** y responde
   * 404 —igual que un recurso ajeno— para no revelar que la matrícula existe.
   */
  private async assertMatriculaDelActor(req: any, institutionId: string, studentEnrollmentId: string) {
    if (this.tieneAlcanceInstitucional(req)) return;
    const propia = await this.prisma.studentEnrollment.count({
      where: { id: studentEnrollmentId, institutionId, student: { userId: req?.user?.id, institutionId } },
    });
    if (propia !== 1) throw new NotFoundException('Matrícula no encontrada');
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async recordBulk(@Body() dto: RecordAttendanceDto, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.attendanceService.recordBulk(dto, institutionId, this.actorFrom(req));
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async update(@Param('id') id: string, @Body() dto: UpdateAttendanceDto, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.attendanceService.update(id, dto, institutionId, this.actorFrom(req));
  }

  @Get('by-assignment/:teacherAssignmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getByAssignmentAndDate(
    @Request() req: any,
    @Param('teacherAssignmentId') teacherAssignmentId: string,
    @Query('date') date: string,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.attendanceService.getByAssignmentAndDate(teacherAssignmentId, date, institutionId);
  }

  @Get('by-student/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  async getByStudent(
    @Request() req: any,
    @Param('studentEnrollmentId') studentEnrollmentId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    await this.assertMatriculaDelActor(req, institutionId, studentEnrollmentId);
    return this.attendanceService.getByStudent(studentEnrollmentId, institutionId, startDate, endDate);
  }

  @Get('summary/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  async getStudentSummary(
    @Request() req: any,
    @Param('studentEnrollmentId') studentEnrollmentId: string,
    @Query('academicTermId') academicTermId?: string,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    await this.assertMatriculaDelActor(req, institutionId, studentEnrollmentId);
    return this.attendanceService.getStudentSummary(studentEnrollmentId, institutionId, academicTermId);
  }

  @Get('report/consolidated')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async getConsolidatedReport(
    @Request() req: any,
    @Query('academicYearId') academicYearId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('subjectId') subjectId?: string,
    @Query('includeWithdrawn') includeWithdrawn?: string,
    @Query('institutionId') institutionId?: string,
  ) {
    // `institutionId` de la query solo lo honra el resolvedor para SuperAdmin; a un usuario
    // institucional se le ignora y se usa el de su sesión.
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.attendanceService.getConsolidatedReport({
      academicYearId,
      institutionId: instId,
      startDate,
      endDate,
      subjectId,
      includeWithdrawn: includeWithdrawn === 'true',
    });
  }

  @Get('report/teacher-compliance')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
  async getTeacherComplianceReport(
    @Request() req: any,
    @Query('academicYearId') academicYearId: string,
    @Query('teacherId') teacherId?: string,
    @Query('groupId') groupId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    // Límite existente que se conserva: un docente solo ve su propio cumplimiento.
    const userRoles = this.rolesOf(req);
    const isAdminScope = req.user?.isSuperAdmin === true
      || userRoles.some((role) => ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR'].includes(role));

    return this.attendanceService.getTeacherComplianceReport({
      academicYearId,
      institutionId,
      teacherId: isAdminScope ? teacherId : req.user?.id,
      groupId,
      subjectId,
      startDate,
      endDate,
    });
  }

  @Get('report/:teacherAssignmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getGroupAttendanceReport(
    @Request() req: any,
    @Param('teacherAssignmentId') teacherAssignmentId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.attendanceService.getGroupAttendanceReport(teacherAssignmentId, startDate, endDate, institutionId);
  }

  @Get('report-by-group/:groupId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
  async getReportByGroup(
    @Request() req: any,
    @Param('groupId') groupId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('subjectId') subjectId?: string,
    @Query('includeWithdrawn') includeWithdrawn?: string,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.attendanceService.getReportByGroup(groupId, academicYearId, institutionId, {
      startDate,
      endDate,
      subjectId,
      includeWithdrawn: includeWithdrawn === 'true',
    });
  }

  @Get('detailed-report')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  async getDetailedReport(
    @Request() req: any,
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('subjectId') subjectId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('studentEnrollmentId') studentEnrollmentId?: string,
    @Query('status') status?: string,
    @Query('includeWithdrawn') includeWithdrawn?: string,
    @Query('limit') limit?: string,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.attendanceService.getDetailedReport({
      academicYearId,
      institutionId,
      groupId,
      startDate,
      endDate,
      subjectId,
      teacherId,
      studentEnrollmentId,
      status,
      includeWithdrawn: includeWithdrawn === 'true',
      limit: limit ? Number(limit) : undefined,
    });
  }
}
