import { BadRequestException, Body, Controller, Get, NotFoundException, Post, Query, Request, UseGuards } from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId, resolveInstitutionId } from '../../common/utils/institution-resolver';
import { TutoringAttendanceService } from './tutoring-attendance.service';

/**
 * Asistencia de tutoría (HTTP).
 *
 * **La institución la pone el ACTOR.** De las siete rutas solo `status`, `detailed-report` y
 * `toggle` la resolvían; `record` la deducía del grupo del cuerpo, y `by-group`, `student-summary`
 * y `report-by-group` no la recibían nunca. Ahora las siete la fijan antes de llamar al servicio.
 */
@Controller('tutoring-attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TutoringAttendanceController {
  constructor(
    private readonly tutoringService: TutoringAttendanceService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Contexto institucional obligatorio, como error de petición y no de servidor.
   *
   * `requireInstitutionId` lanza un `Error` genérico cuando no puede resolver la institución y Nest
   * lo traduce a **500**. Una sesión sin institución es una petición inválida, no un fallo del
   * servidor. El resolvedor vive fuera de los ficheros que este encargo permite tocar, así que la
   * comprobación se hace aquí, ANTES de la llamada real —que se conserva literal y sin envolver
   * porque es la evidencia que lee el contrato estructural de rutas—. Para un usuario normal
   * `resolveInstitutionId` no consulta la base: lee el claim del JWT.
   */
  private async exigeContexto(req: any, institutionIdSolicitada?: string): Promise<void> {
    const resuelta = await resolveInstitutionId(this.prisma as any, req, institutionIdSolicitada);
    if (!resuelta) throw new BadRequestException('No se pudo determinar la institución. Cierre sesión y vuelva a iniciar.');
  }

  /**
   * Verifica si la tutoría está habilitada y retorna los grupos que dirige el docente
   */
  @Get('status')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
  async getStatus(@Request() req: any, @Query('institutionId') institutionId?: string) {
    // `institutionId` de la query solo lo honra el resolvedor para SuperAdmin.
    await this.exigeContexto(req, institutionId);
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
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
    // Antes la institución salía del grupo del cuerpo: con un grupo ajeno se escribía tutoría en
    // otra institución y «solo el director» se comprobaba contra el director de ese grupo.
    await this.exigeContexto(req);
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    const userRoles: string[] = this.rolesOf(req);
    return this.tutoringService.recordBulk({
      groupId: body.groupId,
      institutionId,
      teacherId: req.user.id,
      date: body.date,
      userRoles,
      isSuperAdmin: req.user?.isSuperAdmin === true,
      records: body.records,
    });
  }

  /**
   * Obtiene registros de tutoría por grupo y fecha
   */
  @Get('by-group')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
  async getByGroupAndDate(
    @Request() req: any,
    @Query('groupId') groupId: string,
    @Query('date') date: string,
  ) {
    await this.exigeContexto(req);
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.tutoringService.getByGroupAndDate(groupId, date, institutionId);
  }

  /**
   * Resumen de asistencia de tutoría por estudiante
   */
  @Get('student-summary')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR', 'DOCENTE')
  async getStudentSummary(
    @Request() req: any,
    @Query('studentEnrollmentId') studentEnrollmentId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    await this.exigeContexto(req);
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.tutoringService.getStudentSummary(studentEnrollmentId, institutionId, startDate, endDate);
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
    await this.exigeContexto(req);
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    await this.tutoringService.assertCanReadGroupReport(groupId, institutionId, req.user.id, this.rolesOf(req), req.user?.isSuperAdmin === true);
    return this.tutoringService.getReportByGroup(groupId, academicYearId, institutionId, { startDate, endDate, includeWithdrawn: includeWithdrawn === 'true' });
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
    await this.exigeContexto(req, institutionId);
    const instId = await requireInstitutionId(this.prisma as any, req, institutionId);
    if (!academicYearId) throw new BadRequestException('Se requiere el año académico');

    const roles = this.rolesOf(req);
    const isAdmin = req.user?.isSuperAdmin === true || roles.some((r) => ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR'].includes(r));

    if (groupId) {
      await this.tutoringService.assertCanReadGroupReport(groupId, instId, req.user.id, roles, req.user?.isSuperAdmin === true);
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
    // Esta ruta cambia CONFIGURACIÓN institucional: `institutionId` del cuerpo solo lo honra el
    // resolvedor para SuperAdmin; a un ADMIN_INSTITUTIONAL se le ignora y manda el de su sesión.
    await this.exigeContexto(req, body.institutionId);
    const instId = await requireInstitutionId(this.prisma as any, req, body.institutionId);

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

    // `update` por id sin acotar podía tocar el módulo de otra institución si `mod` viniera de
    // una búsqueda no acotada; `updateMany` con la institución lo hace imposible.
    const filas = await this.prisma.institutionModule.updateMany({
      where: { id: mod.id, institutionId: instId },
      data: { features: Array.from(features) },
    });
    if (filas.count !== 1) throw new NotFoundException('Módulo no encontrado');

    return { enabled: body.enabled };
  }
}
