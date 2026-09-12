import { Body, Controller, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClassroomService } from './classroom.service';
import { PrismaService } from '../../prisma/prisma.service';
import { requireInstitutionId } from '../../common/utils/institution-resolver';
import { ClassroomActor } from './classroom-tenant-access.service';
import { CreateClassroomDto, UpdateClassroomDto } from './dto/classroom-b1.dto';

/**
 * Classroom Bloque 1 — rutas blindadas (17/98).
 *
 * Estas rutas vivían en ClassroomController sin aislamiento institucional
 * acreditado. Se mueven aquí DURANTE el blindaje para no tocar las huellas de las
 * 81 rutas pendientes (el contrato estructural huella imports + decoradores de
 * clase + cuerpo del método). Reglas:
 *
 * - Cada handler llama directa, incondicionalmente y primero a
 *   `requireInstitutionId(this.prisma as any, req)`: la institución la pone el
 *   ACTOR (sesión), nunca el recurso que nombra el cliente.
 * - El actor explícito { userId, institutionId, roles, isSuperAdmin } se construye
 *   SOLO desde req.user. Body/query no pueden sustituir institución, docente,
 *   estudiante ni rol.
 * - El query `role` deja de existir en estas rutas: la rama estudiante/docente se
 *   deriva de los roles del JWT (CAMBIO OBSERVABLE documentado).
 * - Se registra DESPUÉS de ClassroomController en classroom.module.ts: las rutas
 *   literales restantes del controlador original (p. ej. GET /classrooms/rubrics)
 *   se resuelven primero y `@Get(':id')` de aquí no las puede sombrear.
 */
@Controller('classrooms')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassroomB1Controller {
  constructor(
    private readonly service: ClassroomService,
    private readonly prisma: PrismaService,
  ) {}

  /** Actor explícito construido exclusivamente desde la sesión. */
  private actorFrom(req: any, institutionId: string): ClassroomActor {
    const raw = req.user?.roles;
    const roles = Array.isArray(raw)
      ? raw.map((r: any) => (typeof r === 'string' ? r : r?.role?.name || r?.name)).filter(Boolean)
      : [];
    return {
      userId: req.user.id,
      institutionId,
      roles,
      isSuperAdmin: req.user?.isSuperAdmin === true,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLASSROOMS (Aulas)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get()
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE', 'ACUDIENTE')
  async list(@Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    const actor = this.actorFrom(req, institutionId);
    // Antes `?role=student` decidía la rama (selección de privilegio controlada por
    // el cliente). Ahora la decide el JWT: ESTUDIANTE → vista de estudiante; el
    // resto → vista docente (acotada a SUS asignaciones de ESTA institución).
    if (actor.roles.includes('ESTUDIANTE')) {
      return this.service.listForStudent(actor);
    }
    return this.service.listForTeacher(actor);
  }

  @Get('available-assignments')
  @Roles('DOCENTE', 'COORDINADOR')
  async getAvailableAssignments(@Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.getAvailableAssignments(this.actorFrom(req, institutionId));
  }

  @Post()
  @Roles('DOCENTE', 'COORDINADOR')
  async create(@Request() req: any, @Body() dto: CreateClassroomDto) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.create(this.actorFrom(req, institutionId), dto);
  }

  @Get(':id')
  @Roles('DOCENTE', 'COORDINADOR', 'ESTUDIANTE', 'ACUDIENTE')
  async getById(@Param('id') id: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.getById(this.actorFrom(req, institutionId), id);
  }

  @Put(':id')
  @Roles('DOCENTE', 'COORDINADOR')
  async update(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateClassroomDto) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.update(this.actorFrom(req, institutionId), id, dto);
  }

  @Get(':id/students')
  @Roles('DOCENTE', 'COORDINADOR')
  async getStudents(@Param('id') id: string, @Request() req: any) {
    const institutionId = await requireInstitutionId(this.prisma as any, req);
    return this.service.getStudents(this.actorFrom(req, institutionId), id);
  }
}
