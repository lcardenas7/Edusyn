import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import type { ProfileDto, AreaConfigDto, GradingConfigDto, AcademicLevelConfig, PeriodConfig } from './institution-config.service'
import { InstitutionConfigService } from './institution-config.service'
import { PrismaService } from '../../prisma/prisma.service'

@Controller('institution-config')
@UseGuards(JwtAuthGuard)
export class InstitutionConfigController {
  constructor(
    private configService: InstitutionConfigService,
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

    throw new Error('Usuario no asociado a ninguna institución')
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
  async updatePeriods(@Request() req, @Body() periods: PeriodConfig[]) {
    const institutionId = await this.getInstitutionId(req.user.id)
    return this.configService.updatePeriods(institutionId, periods)
  }
}
