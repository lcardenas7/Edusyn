import { Controller, Get, Post, Put, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { GuardiansService } from './guardians.service';
import {
  CreateGuardianDto,
  UpdateGuardianDto,
  LinkGuardianToStudentDto,
  CreateGuardianWithLinkDto
} from './dto/guardian.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StudentsGuard } from '../auth/guards/students.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';

/**
 * Acudientes: datos personales de terceros y su vínculo con estudiantes.
 *
 * ⚠️ AUTORIZACIÓN — este controlador NO tenía ni un solo `@Roles`, y `RolesGuard` sin
 * roles requeridos devuelve `true`. Resultado: cualquier usuario autenticado —incluido un
 * ESTUDIANTE, cuyo token dura 24 h— alcanzaba las diez rutas, en cualquier institución
 * (docs/security/RLS-AUDIT-FASE0.3.md).
 *
 * Se aplica `StudentsGuard` a nivel de clase en lugar de una lista inventada de `@Roles`:
 * ese guard ya codifica el conjunto legítimo real —SUPERADMIN, ADMIN_INSTITUTIONAL,
 * COORDINADOR o docente con el permiso delegado `canManageStudents`— y es el mismo que
 * protege `POST /students`. Una lista de roles habría dejado fuera a los docentes
 * delegados, que sí usan estas rutas desde la ficha del estudiante.
 *
 * Las operaciones DESTRUCTIVAS llevan además `@Roles('SUPERADMIN','ADMIN_INSTITUTIONAL')`.
 * No se concede el borrado al docente delegado: la auditoría no encontró ningún flujo que
 * lo requiera (`guardiansApi.delete` y `unlinkFromStudent` están declarados en el cliente
 * pero no se invocan en ninguna parte). Se sigue el precedente ya existente en el
 * proyecto para operaciones destructivas sobre datos de estudiantes
 * (`POST /students/bulk-delete-without-records`). No se inventa ningún rol nuevo.
 *
 * ⚠️ AISLAMIENTO — el `institutionId` que llegue por body, query o ruta no es fuente de
 * autoridad. Todas las rutas resuelven la institución con `requireInstitutionId`, que la
 * ignora para usuarios normales y solo la honra para SuperAdmin. Se mantiene el parámetro
 * opcional en las rutas por identificador para que el SuperAdmin conserve su alcance
 * multi-institución explícito.
 */
@Controller('guardians')
@UseGuards(JwtAuthGuard, RolesGuard, StudentsGuard)
export class GuardiansController {
  constructor(
    private readonly guardiansService: GuardiansService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async create(@Request() req: any, @Body() dto: CreateGuardianDto) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, dto.institutionId);
    return this.guardiansService.create(dto, institutionId);
  }

  @Post('with-link')
  async createWithLink(@Request() req: any, @Body() dto: CreateGuardianWithLinkDto) {
    const institutionId = await requireInstitutionId(this.prisma as any, req, dto.institutionId);
    return this.guardiansService.createWithLink(dto, institutionId);
  }

  /**
   * Antes, omitir `institutionId` eliminaba el filtro y devolvía los acudientes de TODA
   * la plataforma. Ahora la institución la resuelve el servidor y nunca puede faltar.
   */
  @Get()
  async list(
    @Request() req: any,
    @Query('institutionId') institutionId?: string,
    @Query('search') search?: string,
  ) {
    const resolved = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.guardiansService.list({ institutionId: resolved, search });
  }

  @Get(':id')
  async findById(
    @Request() req: any,
    @Param('id') id: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const resolved = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.guardiansService.findById(id, resolved);
  }

  @Get('student/:studentId')
  async findByStudent(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const resolved = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.guardiansService.findByStudent(studentId, resolved);
  }

  @Put(':id')
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateGuardianDto,
    @Query('institutionId') institutionId?: string,
  ) {
    const resolved = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.guardiansService.update(id, dto, resolved);
  }

  /** Destructiva: reservada a perfiles administrativos. */
  @Delete(':id')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async delete(
    @Request() req: any,
    @Param('id') id: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const resolved = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.guardiansService.delete(id, resolved);
  }

  @Post('link')
  async linkToStudent(@Request() req: any, @Body() dto: LinkGuardianToStudentDto) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.guardiansService.linkToStudent(dto, institutionId);
  }

  /** Destructiva: reservada a perfiles administrativos. */
  @Delete('link/:studentId/:guardianId')
  @Roles('SUPERADMIN', 'ADMIN_INSTITUTIONAL')
  async unlinkFromStudent(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Param('guardianId') guardianId: string,
    @Query('institutionId') institutionId?: string,
  ) {
    const resolved = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.guardiansService.unlinkFromStudent(studentId, guardianId, resolved);
  }

  @Put('link/:studentId/:guardianId')
  async updateLink(
    @Request() req: any,
    @Param('studentId') studentId: string,
    @Param('guardianId') guardianId: string,
    @Body() data: Partial<LinkGuardianToStudentDto>,
    @Query('institutionId') institutionId?: string,
  ) {
    const resolved = await requireInstitutionId(this.prisma as any, req, institutionId);
    return this.guardiansService.updateLink(studentId, guardianId, data, resolved);
  }
}
