import { Body, Controller, Get, Post, Query, UseGuards, Request } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { TeacherAssignmentsService } from './teacher-assignments.service';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('teacher-assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TeacherAssignmentsController {
  constructor(
    private readonly teacherAssignmentsService: TeacherAssignmentsService,
    private readonly prisma: PrismaService,
  ) {}

  // Helper para obtener institutionId del usuario
  private async resolveInstitutionId(req: any, queryInstitutionId?: string): Promise<string | undefined> {
    let instId = queryInstitutionId || req.user?.institutionId;
    if (!instId && req.user?.id) {
      const institutionUser = await this.prisma.institutionUser.findFirst({
        where: { userId: req.user.id },
        select: { institutionId: true }
      });
      instId = institutionUser?.institutionId;
    }
    return instId;
  }

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
    const instId = await this.resolveInstitutionId(req, institutionId);
    return this.teacherAssignmentsService.list({ academicYearId, groupId, teacherId, institutionId: instId });
  }
}
