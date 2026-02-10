import { Body, Controller, Get, Param, Post, Query, UseGuards, Request } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { TeacherAssignmentsService } from './teacher-assignments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';

@Controller('teacher-assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeacherAssignmentsController {
  constructor(
    private readonly teacherAssignmentsService: TeacherAssignmentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async create(@Body() dto: CreateTeacherAssignmentDto) {
    return this.teacherAssignmentsService.create(dto);
  }

  @Post(':id/replace')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async replaceTeacher(
    @Param('id') id: string,
    @Body() body: { newTeacherId: string; reason: string; endDate?: string },
  ) {
    return this.teacherAssignmentsService.replaceTeacher(
      id,
      body.newTeacherId,
      body.reason,
      body.endDate ? new Date(body.endDate) : undefined,
    );
  }

  @Post(':id/end')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async endAssignment(
    @Param('id') id: string,
    @Body() body: { reason: string; endDate?: string },
  ) {
    return this.teacherAssignmentsService.endAssignment(
      id,
      body.reason,
      body.endDate ? new Date(body.endDate) : undefined,
    );
  }

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async list(
    @Request() req: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('groupId') groupId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('institutionId') institutionId?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    return this.teacherAssignmentsService.list({
      academicYearId,
      groupId,
      teacherId,
      institutionId: instId,
      activeOnly: activeOnly === 'false' ? false : true,
    });
  }

  @Get('history')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async getHistory(
    @Query('academicYearId') academicYearId: string,
    @Query('groupId') groupId: string,
    @Query('subjectId') subjectId: string,
  ) {
    return this.teacherAssignmentsService.getHistory(academicYearId, groupId, subjectId);
  }
}
