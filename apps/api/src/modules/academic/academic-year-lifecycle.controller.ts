import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AcademicYearLifecycleService } from './academic-year-lifecycle.service';
import type { CreateAcademicYearDto } from './academic-year-lifecycle.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

/**
 * Ciclo de vida del año lectivo.
 *
 * ⚠️ AISLAMIENTO MULTI-TENANT — el `:yearId` de la ruta no es fuente de autoridad.
 * Antes, `getYearById` hacía `findUnique({ where: { id } })` sin filtro, y todas las
 * mutaciones lo invocaban primero: un ADMIN de la institución A que conociera el `yearId`
 * de B podía **cerrar su año lectivo**, lo que dispara el cálculo de promociones y
 * reescribe el estado de matrícula de todos sus estudiantes
 * (docs/security/RLS-AUDIT-ACADEMIC-YEARS.md).
 *
 * Ahora la institución la resuelve el servidor con `requireInstitutionId` y viaja hasta el
 * servicio, que acota la consulta. El parámetro `institutionId` se conserva en las rutas de
 * listado para no romper el contrato del frontend —14 consumidores lo envían—; lo único que
 * cambia es a qué valor se hace caso, y el SuperAdmin conserva su alcance explícito.
 *
 * Los `@Roles` existentes no se tocan: autorización y aislamiento de tenant son controles
 * distintos y ninguno sustituye al otro.
 */
@Controller('academic-years')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AcademicYearLifecycleController {
  constructor(
    private readonly yearService: AcademicYearLifecycleService,
    private readonly prisma: PrismaService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD BÁSICO
  // ═══════════════════════════════════════════════════════════════════════════

  @Post()
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async createYear(@Request() req: any, @Body() dto: CreateAcademicYearDto) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, dto.institutionId);
    return this.yearService.createYear(dto, institutionId);
  }

  // Endpoint con query param (para compatibilidad con frontend)
  @Get()
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'DOCENTE', 'RECTOR', 'SECRETARIA')
  async getYears(@Request() req: any, @Query('institutionId') institutionId?: string) {
    const resolved = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.yearService.getYearsByInstitution(resolved);
  }

  @Get('institution/:institutionId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'DOCENTE', 'RECTOR', 'SECRETARIA')
  async getYearsByInstitution(@Request() req: any, @Param('institutionId') institutionId: string) {
    const resolved = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.yearService.getYearsByInstitution(resolved);
  }

  @Get('institution/:institutionId/current')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'DOCENTE', 'RECTOR', 'SECRETARIA', 'ESTUDIANTE')
  async getCurrentYear(@Request() req: any, @Param('institutionId') institutionId: string) {
    const resolved = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.yearService.getCurrentYear(resolved);
  }

  @Get(':yearId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'DOCENTE', 'RECTOR', 'SECRETARIA')
  async getYearById(@Request() req: any, @Param('yearId') yearId: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.yearService.getYearById(yearId, institutionId);
  }

  @Put(':yearId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async updateYear(
    @Request() req: any,
    @Param('yearId') yearId: string,
    @Body() data: Partial<CreateAcademicYearDto>,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.yearService.updateYear(yearId, data, institutionId);
  }

  /** Destructiva: conserva sus salvaguardas (solo DRAFT y sin matrículas). */
  @Delete(':yearId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async deleteYear(@Request() req: any, @Param('yearId') yearId: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.yearService.deleteYear(yearId, institutionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CICLO DE VIDA DEL AÑO
  // ═══════════════════════════════════════════════════════════════════════════

  @Post(':yearId/activate')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async activateYear(@Param('yearId') yearId: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.yearService.activateYear({
      yearId,
      userId: req.user.id,
      institutionId,
    });
  }

  @Post(':yearId/close')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async closeYear(
    @Param('yearId') yearId: string,
    @Body() body: { calculatePromotions?: boolean },
    @Request() req: any,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.yearService.closeYear({
      yearId,
      userId: req.user.id,
      institutionId,
      calculatePromotions: body.calculatePromotions,
    });
  }

  @Get(':yearId/validate-activation')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async validateForActivation(@Request() req: any, @Param('yearId') yearId: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.yearService.validateYearForActivation(yearId, institutionId);
  }

  @Get(':yearId/validate-closure')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async validateForClosure(@Request() req: any, @Param('yearId') yearId: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    const errors = await this.yearService.validateYearForClosure(yearId, institutionId);
    return { canClose: errors.length === 0, errors };
  }

  @Get(':yearId/promotion-preview')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async previewPromotions(@Request() req: any, @Param('yearId') yearId: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.yearService.previewPromotions(yearId, institutionId);
  }

  /**
   * ⚠️ Dos identificadores del cliente. `promoteStudents` valida AMBOS años contra la
   * institución resuelta: sin eso se podía crear una matrícula con la institución de A y
   * el año lectivo de B — una fila incoherente entre tenants.
   */
  @Post(':fromYearId/promote-to/:toYearId')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN')
  async promoteStudents(
    @Param('fromYearId') fromYearId: string,
    @Param('toYearId') toYearId: string,
    @Request() req: any,
  ) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.yearService.promoteStudents({
      fromYearId,
      toYearId,
      userId: req.user.id,
      institutionId,
    });
  }

  /**
   * El año se valida primero con `getYearById` acotado; después se consultan los lectores
   * de estado, que son internos y no acotan por institución a propósito.
   */
  @Get(':yearId/permissions')
  @Roles('ADMIN_INSTITUTIONAL', 'SUPERADMIN', 'COORDINADOR', 'DOCENTE', 'RECTOR', 'SECRETARIA')
  async getYearPermissions(@Request() req: any, @Param('yearId') yearId: string) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    await this.yearService.getYearById(yearId, institutionId);

    return {
      canEditStructure: await this.yearService.canEditStructure(yearId),
      canRecordGrades: await this.yearService.canRecordGrades(yearId),
      canEnrollStudents: await this.yearService.canEnrollStudents(yearId),
      canModify: await this.yearService.canModify(yearId),
    };
  }
}
