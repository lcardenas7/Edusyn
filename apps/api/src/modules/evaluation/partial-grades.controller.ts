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

  /** Extrae el actor (quién hace el cambio) del JWT para la auditoría forense. */
  private actorFrom(req: any): { userId?: string; name?: string; role?: string } {
    const roles = req?.user?.roles;
    const role = Array.isArray(roles)
      ? roles.map((r: any) => (typeof r === 'string' ? r : r?.role?.name || r?.roleName || r?.name)).filter(Boolean).join(', ')
      : undefined;
    return { userId: req?.user?.id, name: req?.user?.email, role: role || undefined };
  }

  @Post()
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async upsert(@Body() data: any, @Request() req: any) {
    return this.partialGradesService.upsert(data, this.actorFrom(req));
  }

  @Post('bulk')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async bulkUpsert(@Body() data: { grades: any[] }, @Request() req: any) {
    return this.partialGradesService.bulkUpsert(data.grades, this.actorFrom(req));
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
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.partialGradesService.delete(id, this.actorFrom(req));
  }

  @Post('recover-lost-grades')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR')
  async recoverLostGrades(@Request() req: any) {
    const instId = await requireInstitutionId(this.prisma as any, req);
    return this.partialGradesService.recoverLostGrades(instId);
  }

  @Delete('activity')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async deleteByActivity(
    @Query('teacherAssignmentId') teacherAssignmentId: string,
    @Query('academicTermId') academicTermId: string,
    @Query('componentType') componentType: string,
    @Query('activityIndex') activityIndex: string,
    @Request() req: any,
  ) {
    return this.partialGradesService.deleteByActivity(
      teacherAssignmentId,
      academicTermId,
      componentType,
      parseInt(activityIndex),
      this.actorFrom(req),
    );
  }
}
