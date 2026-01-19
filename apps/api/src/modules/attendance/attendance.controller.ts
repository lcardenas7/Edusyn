import { Controller, Post, Put, Get, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AttendanceService } from './attendance.service';
import { RecordAttendanceDto, UpdateAttendanceDto } from './dto/record-attendance.dto';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  recordBulk(@Body() dto: RecordAttendanceDto) {
    return this.attendanceService.recordBulk(dto);
  }

  @Put(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  update(@Param('id') id: string, @Body() dto: UpdateAttendanceDto) {
    return this.attendanceService.update(id, dto);
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

  @Get('report/teacher-compliance')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR')
  getTeacherComplianceReport(
    @Query('academicYearId') academicYearId: string,
    @Query('teacherId') teacherId?: string,
    @Query('groupId') groupId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.getTeacherComplianceReport({
      academicYearId,
      teacherId,
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
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  getAttendanceReportByGroup(
    @Param('groupId') groupId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('subjectId') subjectId?: string,
  ) {
    return this.attendanceService.getAttendanceReportByGroup(groupId, academicYearId, startDate, endDate, subjectId);
  }

  @Get('detailed-report')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  getDetailedReport(
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId?: string,
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('subjectId') subjectId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('studentEnrollmentId') studentEnrollmentId?: string,
    @Query('status') status?: string,
  ) {
    return this.attendanceService.getDetailedAttendanceReport({
      academicYearId,
      groupId,
      date,
      startDate,
      endDate,
      subjectId,
      teacherId,
      studentEnrollmentId,
      status,
    });
  }

  @Delete('all')
  @Roles('SUPERADMIN')
  deleteAllRecords() {
    return this.attendanceService.deleteAllRecords();
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
}
