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
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
  async getStatus(@Request() req: any, @Query('institutionId') institutionId?: string) {
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    if (!instId) throw new BadRequestException('No se pudo determinar la institución');
    const enabled = await this.tutoringService.isTutoringEnabled(instId);

    // Admin/Rector/Coordinador ven TODOS los grupos; docentes solo sus grupos dirigidos
    const userRoles: string[] = (req.user.roles || []).map((r: any) => typeof r === 'string' ? r : (r.role?.name || r.name || ''));
    const isAdmin = req.user?.isSuperAdmin === true || userRoles.some((r: string) => ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR'].includes(r));

    let groups: any[] = [];
    if (enabled) {
      if (isAdmin) {
        groups = await this.prisma.group.findMany({
          where: { campus: { institutionId: instId } },
          include: { grade: true, shift: true, campus: true },
          orderBy: [{ grade: { name: 'asc' } }, { name: 'asc' }],
        });
      } else {
        groups = await this.tutoringService.getDirectedGroups(req.user.id, instId);
      }
    }

    return {
      enabled,
      directedGroups: groups.map((g: any) => ({
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
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
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
    const userRoles: string[] = (req.user.roles || []).map((r: any) => typeof r === 'string' ? r : (r.role?.name || r.name || ''));
    return this.tutoringService.recordBulk({
      groupId: body.groupId,
      teacherId: req.user.id,
      date: body.date,
      userRoles,
      records: body.records,
    });
  }

  /**
   * Obtiene registros de tutoría por grupo y fecha
   */
  @Get('by-group')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
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
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
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
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
  async getReportByGroup(
    @Request() req: any,
    @Query('groupId') groupId: string,
    @Query('academicYearId') academicYearId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('includeWithdrawn') includeWithdrawn?: string,
  ) {
    if (!groupId || !academicYearId) {
      throw new BadRequestException('Se requiere grupo y año académico');
    }
    await this.tutoringService.assertCanReadGroupReport(groupId, req.user.id, this.rolesOf(req), req.user?.isSuperAdmin === true);
    return this.tutoringService.getReportByGroup(groupId, academicYearId, { startDate, endDate, includeWithdrawn: includeWithdrawn === 'true' });
  }

  /**
   * Reporte detallado (día a día) de tutoría, para consultar por estudiante
   */
  @Get('detailed-report')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
  async getDetailedReport(
    @Request() req: any,
    @Query('academicYearId') academicYearId: string,
    @Query('institutionId') institutionId?: string,
    @Query('groupId') groupId?: string,
    @Query('studentEnrollmentId') studentEnrollmentId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('includeWithdrawn') includeWithdrawnRaw?: string,
  ) {
    const includeWithdrawn = includeWithdrawnRaw === 'true';
    const instId = await resolveInstitutionId(this.prisma as any, req, institutionId);
    if (!instId) throw new BadRequestException('No se pudo determinar la institución');
    if (!academicYearId) throw new BadRequestException('Se requiere el año académico');

    const roles = this.rolesOf(req);
    const isAdmin = req.user?.isSuperAdmin === true || roles.some((r) => ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR'].includes(r));

    if (groupId) {
      await this.tutoringService.assertCanReadGroupReport(groupId, req.user.id, roles, req.user?.isSuperAdmin === true);
      return this.tutoringService.getDetailedReport({
        institutionId: instId, academicYearId, groupId, studentEnrollmentId, startDate, endDate, status, includeWithdrawn,
      });
    }

    // Sin grupo: el docente queda acotado a los grupos que dirige; si no dirige
    // ninguno no ve nada (en vez de ver toda la institución).
    let groupIds: string[] | undefined;
    if (!isAdmin) {
      const directed = await this.tutoringService.getDirectedGroups(req.user.id, instId);
      groupIds = directed.map((g: any) => g.id);
      if (groupIds.length === 0) return [];
    }

    return this.tutoringService.getDetailedReport({
      institutionId: instId, academicYearId, groupIds, studentEnrollmentId, startDate, endDate, status, includeWithdrawn,
    });
  }

  private rolesOf(req: any): string[] {
    return (req.user?.roles || []).map((r: any) =>
      typeof r === 'string' ? r : r.role?.name || r.name || '',
    );
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
