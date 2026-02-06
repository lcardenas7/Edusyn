import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

// DTOs para la configuración
export interface ProfileDto {
  name?: string
  nit?: string
  daneCode?: string
  address?: string
  phone?: string
  email?: string
  website?: string
  logo?: string
  city?: string
  rector?: string
}

export interface AreaConfigDto {
  calculationType: string
  approvalRule: string
  recoveryRule: string
  failIfAnySubjectFails: boolean
}

export interface GradingConfigDto {
  evaluationProcesses: Array<{
    id: string
    name: string
    code?: string
    weightPercentage: number
    order?: number
    allowTeacherAddGrades: boolean
    subprocesses: Array<{
      id: string
      name: string
      weightPercentage: number
      numberOfGrades: number
      order?: number
    }>
  }>
  useFinalComponents: boolean
  finalComponents: Array<{
    id: string
    name: string
    weightPercentage: number
    order: number
  }>
  minPassingGrade?: number
  performanceLevels?: Array<{
    id: string
    name: string
    code: string
    minScore: number
    maxScore: number
    order: number
    color: string
    isApproved: boolean
  }>
}

export interface AcademicLevelConfig {
  id: string
  name: string
  code: string
  gradingScaleType: string
  grades: string[]
  minGrade?: number
  maxGrade?: number
  minPassingGrade?: number
  performanceLevels?: Array<{
    id: string
    name: string
    code: string
    minScore: number
    maxScore: number
    order: number
    color: string
    isApproved: boolean
  }>
  qualitativeLevels?: Array<{
    id: string
    code: string
    name: string
    description: string
    color: string
    order: number
    isApproved: boolean
  }>
}

export interface PeriodConfig {
  id: string
  name: string
  weight: number
  startDate: string
  endDate: string
}

interface InstitutionConfigRow {
  id: string
  name: string
  daneCode: string | null
  nit: string | null
  address: string | null
  phone: string | null
  email: string | null
  website: string | null
  logo: string | null
  areaCalculationType: string
  areaApprovalRule: string
  areaRecoveryRule: string
  areaFailIfAnyFails: boolean
  gradingConfig: any
  academicLevelsConfig: any
  periodsConfig: any
}

@Injectable()
export class InstitutionConfigService {
  constructor(private prisma: PrismaService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // OBTENER CONFIGURACIÓN COMPLETA (usando raw query para nuevos campos)
  // ═══════════════════════════════════════════════════════════════════════════
  
  async getFullConfig(institutionId: string) {
    const results = await this.prisma.$queryRaw<InstitutionConfigRow[]>`
      SELECT id, name, "daneCode", nit, address, phone, email, website, logo,
        "areaCalculationType", "areaApprovalRule", "areaRecoveryRule", "areaFailIfAnyFails",
        "gradingConfig", "academicLevelsConfig", "periodsConfig"
      FROM "Institution" WHERE id = ${institutionId}
    `

    if (!results || results.length === 0) {
      throw new NotFoundException('Institución no encontrada')
    }

    const institution = results[0]

    // Obtener jornadas (shifts) de la institución
    const shifts = await this.prisma.shift.findMany({
      where: {
        campus: {
          institutionId
        }
      },
      include: {
        campus: true
      }
    })

    return {
      institutionId: institution.id,
      institutionName: institution.name,
      // Información básica de la institución
      institutionInfo: {
        id: institution.id,
        name: institution.name,
        daneCode: institution.daneCode || '',
        nit: institution.nit || '',
        address: institution.address || '',
        phone: institution.phone || '',
        email: institution.email || '',
        website: institution.website || '',
        logo: institution.logo || '',
      },
      // Jornadas disponibles
      shifts: shifts.map(s => ({
        id: s.id,
        name: s.name,
        type: s.type,
        campusId: s.campusId,
        campusName: s.campus.name,
      })),
      areaConfig: {
        calculationType: institution.areaCalculationType || 'WEIGHTED',
        approvalRule: institution.areaApprovalRule || 'AREA_AVERAGE',
        recoveryRule: institution.areaRecoveryRule || 'INDIVIDUAL_SUBJECT',
        failIfAnySubjectFails: institution.areaFailIfAnyFails || false,
      },
      gradingConfig: institution.gradingConfig || this.getDefaultGradingConfig(),
      academicLevels: institution.academicLevelsConfig || [],
      periods: institution.periodsConfig || this.getDefaultPeriods(),
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN DE ÁREAS
  // ═══════════════════════════════════════════════════════════════════════════

  async getAreaConfig(institutionId: string): Promise<AreaConfigDto> {
    const results = await this.prisma.$queryRaw<Array<{
      areaCalculationType: string
      areaApprovalRule: string
      areaRecoveryRule: string
      areaFailIfAnyFails: boolean
    }>>`
      SELECT "areaCalculationType", "areaApprovalRule", "areaRecoveryRule", "areaFailIfAnyFails"
      FROM "Institution" WHERE id = ${institutionId}
    `

    if (!results || results.length === 0) {
      throw new NotFoundException('Institución no encontrada')
    }

    const institution = results[0]
    return {
      calculationType: institution.areaCalculationType || 'WEIGHTED',
      approvalRule: institution.areaApprovalRule || 'AREA_AVERAGE',
      recoveryRule: institution.areaRecoveryRule || 'INDIVIDUAL_SUBJECT',
      failIfAnySubjectFails: institution.areaFailIfAnyFails || false,
    }
  }

  async updateAreaConfig(institutionId: string, config: AreaConfigDto) {
    // Verificar que existe
    const exists = await this.prisma.institution.findUnique({ where: { id: institutionId } })
    if (!exists) {
      throw new NotFoundException('Institución no encontrada')
    }

    await this.prisma.$executeRaw`
      UPDATE "Institution" SET
        "areaCalculationType" = ${config.calculationType}::"AreaCalculationType",
        "areaApprovalRule" = ${config.approvalRule}::"AreaApprovalRule",
        "areaRecoveryRule" = ${config.recoveryRule}::"AreaRecoveryRule",
        "areaFailIfAnyFails" = ${config.failIfAnySubjectFails}
      WHERE id = ${institutionId}
    `

    return { success: true, ...config }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURACIÓN DE CALIFICACIONES
  // ═══════════════════════════════════════════════════════════════════════════

  async getGradingConfig(institutionId: string) {
    const results = await this.prisma.$queryRaw<Array<{ gradingConfig: any }>>`
      SELECT "gradingConfig" FROM "Institution" WHERE id = ${institutionId}
    `

    if (!results || results.length === 0) {
      throw new NotFoundException('Institución no encontrada')
    }

    return results[0].gradingConfig || this.getDefaultGradingConfig()
  }

  async updateGradingConfig(institutionId: string, config: GradingConfigDto) {
    const exists = await this.prisma.institution.findUnique({ where: { id: institutionId } })
    if (!exists) {
      throw new NotFoundException('Institución no encontrada')
    }

    const configJson = JSON.stringify(config)
    await this.prisma.$executeRaw`
      UPDATE "Institution" SET "gradingConfig" = ${configJson}::jsonb WHERE id = ${institutionId}
    `

    return { success: true, gradingConfig: config }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NIVELES ACADÉMICOS
  // ═══════════════════════════════════════════════════════════════════════════

  async getAcademicLevels(institutionId: string) {
    const results = await this.prisma.$queryRaw<Array<{ academicLevelsConfig: any }>>`
      SELECT "academicLevelsConfig" FROM "Institution" WHERE id = ${institutionId}
    `

    if (!results || results.length === 0) {
      throw new NotFoundException('Institución no encontrada')
    }

    return results[0].academicLevelsConfig || []
  }

  async updateAcademicLevels(institutionId: string, levels: AcademicLevelConfig[]) {
    const exists = await this.prisma.institution.findUnique({ where: { id: institutionId } })
    if (!exists) {
      throw new NotFoundException('Institución no encontrada')
    }

    const levelsJson = JSON.stringify(levels)
    await this.prisma.$executeRaw`
      UPDATE "Institution" SET "academicLevelsConfig" = ${levelsJson}::jsonb WHERE id = ${institutionId}
    `

    return { success: true, academicLevelsConfig: levels }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERÍODOS ACADÉMICOS
  // ═══════════════════════════════════════════════════════════════════════════

  async getPeriods(institutionId: string) {
    const results = await this.prisma.$queryRaw<Array<{ periodsConfig: any }>>`
      SELECT "periodsConfig" FROM "Institution" WHERE id = ${institutionId}
    `

    if (!results || results.length === 0) {
      throw new NotFoundException('Institución no encontrada')
    }

    return results[0].periodsConfig || this.getDefaultPeriods()
  }

  async updatePeriods(institutionId: string, periods: PeriodConfig[]) {
    const exists = await this.prisma.institution.findUnique({ where: { id: institutionId } })
    if (!exists) {
      throw new NotFoundException('Institución no encontrada')
    }

    const periodsJson = JSON.stringify(periods)
    await this.prisma.$executeRaw`
      UPDATE "Institution" SET "periodsConfig" = ${periodsJson}::jsonb WHERE id = ${institutionId}
    `

    // Sincronizar con AcademicTerm para las ventanas de calificación
    await this.syncPeriodsToAcademicTerms(institutionId, periods)

    return { success: true, periodsConfig: periods }
  }

  // Sincroniza los períodos con AcademicTerm para que funcionen las ventanas de calificación
  private async syncPeriodsToAcademicTerms(institutionId: string, periods: PeriodConfig[]) {
    try {
      // Obtener el año académico existente (NO crear automáticamente)
      // Preferir ACTIVE; si no existe, usar el DRAFT más reciente
      const activeYear = await this.prisma.academicYear.findFirst({
        where: { institutionId, status: 'ACTIVE' },
        orderBy: { year: 'desc' },
      })
      const draftYear = await this.prisma.academicYear.findFirst({
        where: { institutionId, status: 'DRAFT' },
        orderBy: { year: 'desc' },
      })
      const academicYear = activeYear || draftYear

      // Si no hay año lectivo, no se sincroniza (el wizard debe crear el año)
      if (!academicYear) {
        return
      }

      // Obtener términos existentes
      const existingTerms = await this.prisma.academicTerm.findMany({
        where: { academicYearId: academicYear.id },
      })

      // Crear o actualizar términos para cada período
      for (let i = 0; i < periods.length; i++) {
        const period = periods[i]
        const order = i + 1
        const existingTerm = existingTerms.find(t => t.type === 'PERIOD' && (t.order === order || t.name === period.name))

        if (existingTerm) {
          // Actualizar término existente
          await this.prisma.academicTerm.update({
            where: { id: existingTerm.id },
            data: {
              name: period.name,
              order,
              weightPercentage: period.weight,
              startDate: period.startDate ? new Date(period.startDate) : null,
              endDate: period.endDate ? new Date(period.endDate) : null,
            }
          })
        } else {
          // Crear nuevo término
          await this.prisma.academicTerm.create({
            data: {
              academicYearId: academicYear.id,
              type: 'PERIOD',
              name: period.name,
              order,
              weightPercentage: period.weight,
              startDate: period.startDate ? new Date(period.startDate) : null,
              endDate: period.endDate ? new Date(period.endDate) : null,
            }
          })
        }
      }

      // Eliminar términos que ya no existen en los períodos
      const periodNames = periods.map(p => p.name)
      const maxOrder = periods.length
      const termsToDelete = existingTerms.filter(t =>
        t.type === 'PERIOD' &&
        (!periodNames.includes(t.name) || t.order > maxOrder)
      )
      for (const term of termsToDelete) {
        await this.prisma.academicTerm.delete({ where: { id: term.id } }).catch(() => {
          // Ignorar errores si hay datos relacionados
        })
      }
    } catch (error) {
      console.error('Error syncing periods to academic terms:', error)
      // No lanzar error para no interrumpir el guardado de períodos
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PERFIL INSTITUCIONAL
  // ═══════════════════════════════════════════════════════════════════════════

  async getProfile(institutionId: string) {
    const institution = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: {
        id: true,
        name: true,
        daneCode: true,
        nit: true,
        address: true,
        phone: true,
        email: true,
        website: true,
        logo: true,
        slug: true,
        status: true,
      },
    })

    if (!institution) {
      throw new NotFoundException('Institución no encontrada')
    }

    return institution
  }

  async updateProfile(institutionId: string, dto: ProfileDto) {
    const exists = await this.prisma.institution.findUnique({ where: { id: institutionId } })
    if (!exists) {
      throw new NotFoundException('Institución no encontrada')
    }

    const updated = await this.prisma.institution.update({
      where: { id: institutionId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nit !== undefined && { nit: dto.nit }),
        ...(dto.daneCode !== undefined && { daneCode: dto.daneCode }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.logo !== undefined && { logo: dto.logo }),
      },
      select: {
        id: true,
        name: true,
        daneCode: true,
        nit: true,
        address: true,
        phone: true,
        email: true,
        website: true,
        logo: true,
        slug: true,
        status: true,
      },
    })

    return updated
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VALORES POR DEFECTO
  // ═══════════════════════════════════════════════════════════════════════════

  private getDefaultGradingConfig(): GradingConfigDto {
    return {
      evaluationProcesses: [
        {
          id: 'proc-1',
          name: 'Cognitivo',
          code: 'COGNITIVO',
          weightPercentage: 40,
          order: 0,
          allowTeacherAddGrades: true,
          subprocesses: [
            { id: 'sub-1-1', name: 'Sub 1', weightPercentage: 100, numberOfGrades: 3, order: 0 },
          ],
        },
        {
          id: 'proc-2',
          name: 'Procedimental',
          code: 'PROCEDIMENTAL',
          weightPercentage: 40,
          order: 1,
          allowTeacherAddGrades: true,
          subprocesses: [
            { id: 'sub-2-1', name: 'Sub 1', weightPercentage: 100, numberOfGrades: 3, order: 0 },
          ],
        },
        {
          id: 'proc-3',
          name: 'Actitudinal',
          code: 'ACTITUDINAL',
          weightPercentage: 20,
          order: 2,
          allowTeacherAddGrades: false,
          subprocesses: [
            { id: 'sub-3-1', name: 'Personal', weightPercentage: 25, numberOfGrades: 1, order: 0 },
            { id: 'sub-3-2', name: 'Social', weightPercentage: 25, numberOfGrades: 1, order: 1 },
            { id: 'sub-3-3', name: 'Autoevaluación', weightPercentage: 25, numberOfGrades: 1, order: 2 },
            { id: 'sub-3-4', name: 'Coevaluación', weightPercentage: 25, numberOfGrades: 1, order: 3 },
          ],
        },
      ],
      useFinalComponents: false,
      finalComponents: [],
      minPassingGrade: 3.0,
    }
  }

  private getDefaultPeriods(): PeriodConfig[] {
    return [
      { id: '1', name: 'Período 1', weight: 25, startDate: '2026-01-20', endDate: '2026-03-31' },
      { id: '2', name: 'Período 2', weight: 25, startDate: '2026-04-01', endDate: '2026-06-15' },
      { id: '3', name: 'Período 3', weight: 25, startDate: '2026-07-15', endDate: '2026-09-30' },
      { id: '4', name: 'Período 4', weight: 25, startDate: '2026-10-01', endDate: '2026-11-30' },
    ]
  }
}
