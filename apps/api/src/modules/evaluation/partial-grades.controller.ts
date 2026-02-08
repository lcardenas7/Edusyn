import { Body, Controller, Delete, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PartialGradesService } from './partial-grades.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

@Controller('partial-grades')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PartialGradesController {
  constructor(
    private readonly partialGradesService: PartialGradesService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async upsert(@Body() data: any) {
    return this.partialGradesService.upsert(data);
  }

  @Post('bulk')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async bulkUpsert(@Body() data: { grades: any[] }) {
    return this.partialGradesService.bulkUpsert(data.grades);
  }

  @Get('by-assignment')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getByAssignment(
    @Query('teacherAssignmentId') teacherAssignmentId: string,
    @Query('academicTermId') academicTermId: string,
  ) {
    return this.partialGradesService.getByAssignment(teacherAssignmentId, academicTermId);
  }

  @Get('by-student')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE', 'ACUDIENTE')
  async getByStudent(
    @Query('studentEnrollmentId') studentEnrollmentId: string,
    @Query('academicTermId') academicTermId?: string,
  ) {
    return this.partialGradesService.getByStudent(studentEnrollmentId, academicTermId);
  }

  @Get('count')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async count(@Request() req: any) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.partialGradesService.count(instId);
  }

  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async delete(@Param('id') id: string) {
    return this.partialGradesService.delete(id);
  }

  @Delete('activity')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async deleteByActivity(
    @Query('teacherAssignmentId') teacherAssignmentId: string,
    @Query('academicTermId') academicTermId: string,
    @Query('componentType') componentType: string,
    @Query('activityIndex') activityIndex: string,
  ) {
    return this.partialGradesService.deleteByActivity(
      teacherAssignmentId,
      academicTermId,
      componentType,
      parseInt(activityIndex),
    );
  }
}
