import { Body, Controller, Get, Post, Query, UseGuards, Request } from '@nestjs/common';

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

  @Get()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async list(
    @Request() req: any,
    @Query('academicYearId') academicYearId?: string,
    @Query('groupId') groupId?: string,
    @Query('teacherId') teacherId?: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    return this.teacherAssignmentsService.list({ academicYearId, groupId, teacherId, institutionId: instId });
  }
}
