import { BadRequestException, Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveInstitutionId } from '../../common/utils/institution-resolver';
import { TutoringAttendanceService } from './tutoring-attendance.service';

@Controller('tutoring-attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TutoringAttendanceController {
  constructor(
    private readonly tutoringService: TutoringAttendanceService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Verifica si la tutoría está habilitada y retorna los grupos que dirige el docente
   */
  @Get('status')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getStatus(@Request() req: any, @Query('institutionId') institutionId?: string) {
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    if (!instId) throw new BadRequestException('No se pudo determinar la institución');
    const enabled = await this.tutoringService.isTutoringEnabled(instId);
    const groups = enabled
      ? await this.tutoringService.getDirectedGroups(req.user.id, instId)
      : [];

    return {
      enabled,
      directedGroups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        gradeName: g.grade?.name,
        shiftName: g.shift?.name,
        campusName: g.campus?.name,
      })),
    };
  }

  /**
   * Registra asistencia de tutoría en bulk
   */
  @Post('record')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async recordBulk(
    @Request() req: any,
    @Body()
    body: {
      groupId: string;
      date: string;
      records: Array<{
        studentEnrollmentId: string;
        status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
        observations?: string;
      }>;
    },
  ) {
    return this.tutoringService.recordBulk({
      groupId: body.groupId,
      teacherId: req.user.id,
      date: body.date,
      records: body.records,
    });
  }

  /**
   * Obtiene registros de tutoría por grupo y fecha
   */
  @Get('by-group')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getByGroupAndDate(
    @Query('groupId') groupId: string,
    @Query('date') date: string,
  ) {
    return this.tutoringService.getByGroupAndDate(groupId, date);
  }

  /**
   * Resumen de asistencia de tutoría por estudiante
   */
  @Get('student-summary')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getStudentSummary(
    @Query('studentEnrollmentId') studentEnrollmentId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.tutoringService.getStudentSummary(studentEnrollmentId, startDate, endDate);
  }

  /**
   * Reporte de asistencia de tutoría por grupo
   */
  @Get('report-by-group')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'DOCENTE')
  async getReportByGroup(
    @Query('groupId') groupId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.tutoringService.getReportByGroup(groupId, academicYearId, { startDate, endDate });
  }

  /**
   * Habilitar/deshabilitar la feature TUTORING_ATTENDANCE para una institución
   */
  @Post('toggle')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async toggleTutoring(
    @Request() req: any,
    @Body() body: { enabled: boolean; institutionId?: string },
  ) {
    const instId = await resolveInstitutionId(this.prisma as any, req, body.institutionId);
    if (!instId) throw new BadRequestException('No se pudo determinar la institución');

    // Buscar o crear el módulo ATTENDANCE
    let mod = await this.prisma.institutionModule.findFirst({
      where: { institutionId: instId, module: 'ATTENDANCE' },
    });

    if (!mod) {
      mod = await this.prisma.institutionModule.create({
        data: {
          institutionId: instId,
          module: 'ATTENDANCE',
          isActive: true,
          features: body.enabled ? ['TUTORING_ATTENDANCE'] : [],
        },
      });
      return { enabled: body.enabled };
    }

    const features = new Set(mod.features);
    if (body.enabled) {
      features.add('TUTORING_ATTENDANCE');
    } else {
      features.delete('TUTORING_ATTENDANCE');
    }

    await this.prisma.institutionModule.update({
      where: { id: mod.id },
      data: { features: Array.from(features) },
    });

    return { enabled: body.enabled };
  }
}
