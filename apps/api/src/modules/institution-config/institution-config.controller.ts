import { Controller, Get, Put, Post, Body, UseGuards, Request, BadRequestException, Query } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import type { ProfileDto, AreaConfigDto, GradingConfigDto, AcademicLevelConfig, PeriodConfig } from './institution-config.service'
import { InstitutionConfigService } from './institution-config.service'
import { InstitutionContextService } from '../institution-context/institution-context.service'
import { PrismaService } from '../../prisma/prisma.service'
import { resolveInstitutionId } from '../../common/utils/institution-resolver'
import { RequireTenantContext } from '../auth/decorators/require-tenant-context.decorator'
import { ValidateTenantContextGuard } from '../../common/guards/validate-tenant-context.guard'

// Escribir la config de evaluación (perfil, áreas, calificación, niveles, períodos)
// recalcula boletines/promoción de TODA la institución → solo Admin/Rector.
// Los GET quedan abiertos (leer la config para contexto es inofensivo).
const CONFIG_WRITE_ROLES = ['SUPERADMIN', 'SUPER_ADMIN', 'ADMIN_INSTITUTIONAL', 'RECTOR'] as const

@Controller('institution-config')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InstitutionConfigController {
  constructor(
    private configService: InstitutionConfigService,
    private institutionContext: InstitutionContextService,
    private prisma: PrismaService,
  ) {}

  // Helper para obtener el institutionId del usuario
  private async getInstitutionId(req: any, requestedInstitutionId?: string): Promise<string> {
    const resolved = await resolveInstitutionId(this.prisma as any, req, requestedInstitutionId)
    if (resolved) return resolved

    const userId = req.user.id
    // Buscar en InstitutionUser
    const institutionUser = await this.prisma.institutionUser.findFirst({
      where: { userId, isActive: true },
      select: { institutionId: true },
    })

    if (institutionUser) {
      return institutionUser.institutionId
    }

    // Buscar en TeacherAssignment con relaciones correctas
    const teacherAssignment = await this.prisma.teacherAssignment.findFirst({
      where: { teacherId: userId },
      select: {
        academicYear: {
          select: { institutionId: true }
        }
      },
    })

    if (teacherAssignment?.academicYear?.institutionId) {
      return teacherAssignment.academicYear.institutionId
    }

    // SuperAdmin u otros usuarios sin institución → retornar null-safe
    throw new BadRequestException('Este usuario no está asociado a ninguna institución. Si es SuperAdmin, seleccione una institución primero.')
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN COMPLETA
  // ═══════════════════════════════════════════════════════════════════════════

  @Get()
  @UseGuards(ValidateTenantContextGuard)
  @RequireTenantContext()
  async getFullConfig(@Request() req, @Query('institutionId') institutionId?: string) {
    const targetId = await this.getInstitutionId(req, institutionId)
    return this.configService.getFullConfig(targetId)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERFIL INSTITUCIONAL
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('profile')
  @UseGuards(ValidateTenantContextGuard)
  @RequireTenantContext()
  async getProfile(@Request() req, @Query('institutionId') institutionId?: string) {
    return this.configService.getProfile(await this.getInstitutionId(req, institutionId))
  }

  @Put('profile')
  @Roles(...CONFIG_WRITE_ROLES)
  async updateProfile(@Request() req, @Body() dto: ProfileDto) {
    const institutionId = await this.getInstitutionId(req)
    return this.configService.updateProfile(institutionId, dto)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN DE ÁREAS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('areas')
  @UseGuards(ValidateTenantContextGuard)
  @RequireTenantContext()
  async getAreaConfig(@Request() req, @Query('institutionId') institutionId?: string) {
    return this.configService.getAreaConfig(await this.getInstitutionId(req, institutionId))
  }

  @Put('areas')
  @Roles(...CONFIG_WRITE_ROLES)
  async updateAreaConfig(@Request() req, @Body() config: AreaConfigDto) {
    const institutionId = await this.getInstitutionId(req)
    return this.configService.updateAreaConfig(institutionId, config)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN DE CALIFICACIONES
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('grading')
  @UseGuards(ValidateTenantContextGuard)
  @RequireTenantContext()
  async getGradingConfig(@Request() req, @Query('institutionId') institutionId?: string) {
    return this.configService.getGradingConfig(await this.getInstitutionId(req, institutionId))
  }

  @Put('grading')
  @Roles(...CONFIG_WRITE_ROLES)
  async updateGradingConfig(@Request() req, @Body() config: GradingConfigDto) {
    const institutionId = await this.getInstitutionId(req)
    return this.configService.updateGradingConfig(institutionId, config)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NIVELES ACADÉMICOS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('academic-levels')
  @UseGuards(ValidateTenantContextGuard)
  @RequireTenantContext()
  async getAcademicLevels(@Request() req, @Query('institutionId') institutionId?: string) {
    return this.configService.getAcademicLevels(await this.getInstitutionId(req, institutionId))
  }

  @Put('academic-levels')
  @Roles(...CONFIG_WRITE_ROLES)
  async updateAcademicLevels(@Request() req, @Body() levels: AcademicLevelConfig[]) {
    const institutionId = await this.getInstitutionId(req)
    return this.configService.updateAcademicLevels(institutionId, levels)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERÍODOS ACADÉMICOS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('periods')
  @UseGuards(ValidateTenantContextGuard)
  @RequireTenantContext()
  async getPeriods(@Request() req, @Query('institutionId') institutionId?: string) {
    return this.configService.getPeriods(await this.getInstitutionId(req, institutionId))
  }

  @Put('periods')
  @Roles(...CONFIG_WRITE_ROLES)
  async updatePeriods(@Request() req, @Body() periods: PeriodConfig[]) {
    const institutionId = await this.getInstitutionId(req)
    return this.configService.updatePeriods(institutionId, periods)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO 2 (Onboarding v2) — CONFIGURACIÓN BASE + COMPLETITUD
  // ═══════════════════════════════════════════════════════════════════════════

  // Aplica la configuración base estándar (composición 40/40/20 + 4 períodos).
  // Idempotente: 409 si ya hay config y no se pasa overwrite=true.
  @Post('apply-base')
  @Roles(...CONFIG_WRITE_ROLES)
  async applyBaseConfig(@Request() req, @Body() body: { overwrite?: boolean }) {
    const institutionId = await this.getInstitutionId(req)
    return this.configService.applyBaseConfig(institutionId, { overwrite: body?.overwrite })
  }

  // Gate del onboarding: ¿la config mínima está lista? { ready, missing[] }.
  @Get('completeness')
  @UseGuards(ValidateTenantContextGuard)
  @RequireTenantContext()
  async getCompleteness(@Request() req, @Query('institutionId') institutionId?: string) {
    return this.configService.getConfigCompleteness(await this.getInstitutionId(req, institutionId))
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXTO DE REGLAS INSTITUCIONALES (para frontend)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('rules-context')
  @UseGuards(ValidateTenantContextGuard)
  @RequireTenantContext()
  async getRulesContext(@Request() req, @Query('institutionId') institutionId?: string) {
    return this.institutionContext.getContext(await this.getInstitutionId(req, institutionId))
  }
}
