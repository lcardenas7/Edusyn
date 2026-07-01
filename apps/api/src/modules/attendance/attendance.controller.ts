import { Controller, Post, Put, Get, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AttendanceService } from './attendance.service';
import { RecordAttendanceDto, UpdateAttendanceDto } from './dto/record-attendance.dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /** Actor (quién hace el cambio) del JWT para la auditoría forense. */
  private actorFrom(req: any): { userId?: string; name?: string; role?: string } {
    const roles = req?.user?.roles;
    const role = Array.isArray(roles)
      ? roles.map((r: any) => (typeof r === 'string' ? r : r?.role?.name || r?.roleName || r?.name)).filter(Boolean).join(', ')
      : undefined;
    return { userId: req?.user?.id, name: req?.user?.email, role: role || undefined };
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  recordBulk(@Body() dto: RecordAttendanceDto, @Request() req: any) {
    return this.attendanceService.recordBulk(dto, this.actorFrom(req));
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  update(@Param('id') id: string, @Body() dto: UpdateAttendanceDto, @Request() req: any) {
    return this.attendanceService.update(id, dto, this.actorFrom(req));
  }

  @Get('by-assignment/:teacherAssignmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  getByAssignmentAndDate(
    @Param('teacherAssignmentId') teacherAssignmentId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.getByAssignmentAndDate(teacherAssignmentId, date);
  }

  @Get('by-student/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  getByStudent(
    @Param('studentEnrollmentId') studentEnrollmentId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.getByStudent(studentEnrollmentId, startDate, endDate);
  }

  @Get('summary/:studentEnrollmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE')
  getStudentSummary(
    @Param('studentEnrollmentId') studentEnrollmentId: string,
    @Query('academicTermId') academicTermId?: string,
  ) {
    return this.attendanceService.getStudentSummary(studentEnrollmentId, academicTermId);
  }

  @Get('report/consolidated')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  getConsolidatedReport(
    @Query('academicYearId') academicYearId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.attendanceService.getConsolidatedReport({
      academicYearId,
      startDate,
      endDate,
      subjectId,
    });
  }

  @Get('report/teacher-compliance')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
  getTeacherComplianceReport(
    @Request() req: any,
    @Query('academicYearId') academicYearId: string,
    @Query('teacherId') teacherId?: string,
    @Query('groupId') groupId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userRoles: string[] = (req.user?.roles || []).map((r: any) => typeof r === 'string' ? r : (r.role?.name || r.name || ''));
    const isAdminScope = userRoles.some((role) => ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR'].includes(role));

    return this.attendanceService.getTeacherComplianceReport({
      academicYearId,
      teacherId: isAdminScope ? teacherId : req.user?.id,
      groupId,
      subjectId,
      startDate,
      endDate,
    });
  }

  @Get('report/:teacherAssignmentId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  getGroupAttendanceReport(
    @Param('teacherAssignmentId') teacherAssignmentId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.attendanceService.getGroupAttendanceReport(teacherAssignmentId, startDate, endDate);
  }

  @Get('report-by-group/:groupId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
  getReportByGroup(
    @Param('groupId') groupId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.attendanceService.getReportByGroup(groupId, academicYearId, {
      startDate,
      endDate,
      subjectId,
    });
  }

  @Get('detailed-report')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  getDetailedReport(
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('subjectId') subjectId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('studentEnrollmentId') studentEnrollmentId?: string,
    @Query('status') status?: string,
  ) {
    return this.attendanceService.getDetailedReport({
      academicYearId,
      groupId,
      startDate,
      endDate,
      subjectId,
      teacherId,
      studentEnrollmentId,
      status,
    });
  }
}
