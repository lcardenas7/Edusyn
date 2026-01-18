import { Controller, Post, Put, Get, Body, Param, Query, UseGuards } from '@nestjs/common';

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
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER')
  recordBulk(@Body() dto: RecordAttendanceDto) {
    return this.attendanceService.recordBulk(dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER')
  update(@Param('id') id: string, @Body() dto: UpdateAttendanceDto) {
    return this.attendanceService.update(id, dto);
  }

  @Get('by-assignment/:teacherAssignmentId')
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER')
  getByAssignmentAndDate(
    @Param('teacherAssignmentId') teacherAssignmentId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.getByAssignmentAndDate(teacherAssignmentId, date);
  }

  @Get('by-student/:studentEnrollmentId')
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER', 'STUDENT')
  getByStudent(
    @Param('studentEnrollmentId') studentEnrollmentId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.attendanceService.getByStudent(studentEnrollmentId, startDate, endDate);
  }

  @Get('summary/:studentEnrollmentId')
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER', 'STUDENT')
  getStudentSummary(
    @Param('studentEnrollmentId') studentEnrollmentId: string,
    @Query('academicTermId') academicTermId?: string,
  ) {
    return this.attendanceService.getStudentSummary(studentEnrollmentId, academicTermId);
  }

  @Get('report/:teacherAssignmentId')
  @Roles('ADMIN', 'COORDINATOR', 'TEACHER')
  getGroupAttendanceReport(
    @Param('teacherAssignmentId') teacherAssignmentId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.attendanceService.getGroupAttendanceReport(teacherAssignmentId, startDate, endDate);
  }
}
