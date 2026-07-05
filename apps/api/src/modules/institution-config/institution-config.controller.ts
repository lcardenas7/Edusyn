import { Controller, Get, Put, Body, UseGuards, Request, BadRequestException } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import type { ProfileDto, AreaConfigDto, GradingConfigDto, AcademicLevelConfig, PeriodConfig } from './institution-config.service'
import { InstitutionConfigService } from './institution-config.service'
import { InstitutionContextService } from '../institution-context/institution-context.service'
import { PrismaService } from '../../prisma/prisma.service'

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
  private async getInstitutionId(userId: string): Promise<string> {
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
  async getFullConfig(@Request() req) {
    const institutionId = await this.getInstitutionId(req.user.id)
    return this.configService.getFullConfig(institutionId)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERFIL INSTITUCIONAL
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('profile')
  async getProfile(@Request() req) {
    const institutionId = await this.getInstitutionId(req.user.id)
    return this.configService.getProfile(institutionId)
  }

  @Put('profile')
  @Roles(...CONFIG_WRITE_ROLES)
  async updateProfile(@Request() req, @Body() dto: ProfileDto) {
    const institutionId = await this.getInstitutionId(req.user.id)
    return this.configService.updateProfile(institutionId, dto)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN DE ÁREAS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('areas')
  async getAreaConfig(@Request() req) {
    const institutionId = await this.getInstitutionId(req.user.id)
    return this.configService.getAreaConfig(institutionId)
  }

  @Put('areas')
  @Roles(...CONFIG_WRITE_ROLES)
  async updateAreaConfig(@Request() req, @Body() config: AreaConfigDto) {
    const institutionId = await this.getInstitutionId(req.user.id)
    return this.configService.updateAreaConfig(institutionId, config)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN DE CALIFICACIONES
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('grading')
  async getGradingConfig(@Request() req) {
    const institutionId = await this.getInstitutionId(req.user.id)
    return this.configService.getGradingConfig(institutionId)
  }

  @Put('grading')
  @Roles(...CONFIG_WRITE_ROLES)
  async updateGradingConfig(@Request() req, @Body() config: GradingConfigDto) {
    const institutionId = await this.getInstitutionId(req.user.id)
    return this.configService.updateGradingConfig(institutionId, config)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NIVELES ACADÉMICOS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('academic-levels')
  async getAcademicLevels(@Request() req) {
    const institutionId = await this.getInstitutionId(req.user.id)
    return this.configService.getAcademicLevels(institutionId)
  }

  @Put('academic-levels')
  @Roles(...CONFIG_WRITE_ROLES)
  async updateAcademicLevels(@Request() req, @Body() levels: AcademicLevelConfig[]) {
    const institutionId = await this.getInstitutionId(req.user.id)
    return this.configService.updateAcademicLevels(institutionId, levels)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERÍODOS ACADÉMICOS
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('periods')
  async getPeriods(@Request() req) {
    const institutionId = await this.getInstitutionId(req.user.id)
    return this.configService.getPeriods(institutionId)
  }

  @Put('periods')
  @Roles(...CONFIG_WRITE_ROLES)
  async updatePeriods(@Request() req, @Body() periods: PeriodConfig[]) {
    const institutionId = await this.getInstitutionId(req.user.id)
    return this.configService.updatePeriods(institutionId, periods)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXTO DE REGLAS INSTITUCIONALES (para frontend)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('rules-context')
  async getRulesContext(@Request() req) {
    const institutionId = await this.getInstitutionId(req.user.id)
    return this.institutionContext.getContext(institutionId)
  }
}
