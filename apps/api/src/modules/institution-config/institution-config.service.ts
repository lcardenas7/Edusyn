import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

// DTOs para la configuración
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
    weightPercentage: number
    allowTeacherAddGrades: boolean
    subprocesses: Array<{
      id: string
      name: string
      weightPercentage: number
    }>
  }>
  useFinalComponents: boolean
  finalComponents: Array<{
    id: string
    name: string
    weightPercentage: number
    order: number
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
      // Obtener o crear el año académico actual
      const currentYear = new Date().getFullYear()
      let academicYear = await this.prisma.academicYear.findFirst({
        where: { institutionId, year: currentYear }
      })

      if (!academicYear) {
        academicYear = await this.prisma.academicYear.create({
          data: {
            institutionId,
            year: currentYear,
            startDate: new Date(currentYear, 0, 1),
            endDate: new Date(currentYear, 11, 31),
          }
        })
      }

      // Obtener términos existentes
      const existingTerms = await this.prisma.academicTerm.findMany({
        where: { academicYearId: academicYear.id }
      })

      // Crear o actualizar términos para cada período
      for (let i = 0; i < periods.length; i++) {
        const period = periods[i]
        const existingTerm = existingTerms.find(t => t.name === period.name || t.order === i)

        if (existingTerm) {
          // Actualizar término existente
          await this.prisma.academicTerm.update({
            where: { id: existingTerm.id },
            data: {
              name: period.name,
              order: i,
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
              order: i,
              weightPercentage: period.weight,
              startDate: period.startDate ? new Date(period.startDate) : null,
              endDate: period.endDate ? new Date(period.endDate) : null,
            }
          })
        }
      }

      // Eliminar términos que ya no existen en los períodos
      const periodNames = periods.map(p => p.name)
      const termsToDelete = existingTerms.filter(t => !periodNames.includes(t.name) && t.order >= periods.length)
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
  // VALORES POR DEFECTO
  // ═══════════════════════════════════════════════════════════════════════════

  private getDefaultGradingConfig(): GradingConfigDto {
    return {
      evaluationProcesses: [
        {
          id: 'proc-1',
          name: 'Cognitivo',
          weightPercentage: 40,
          allowTeacherAddGrades: true,
          subprocesses: [
            { id: 'sub-1', name: 'Evaluaciones', weightPercentage: 60 },
            { id: 'sub-2', name: 'Talleres', weightPercentage: 40 },
          ],
        },
        {
          id: 'proc-2',
          name: 'Procedimental',
          weightPercentage: 30,
          allowTeacherAddGrades: true,
          subprocesses: [
            { id: 'sub-3', name: 'Trabajos', weightPercentage: 50 },
            { id: 'sub-4', name: 'Exposiciones', weightPercentage: 50 },
          ],
        },
        {
          id: 'proc-3',
          name: 'Actitudinal',
          weightPercentage: 30,
          allowTeacherAddGrades: true,
          subprocesses: [
            { id: 'sub-5', name: 'Participación', weightPercentage: 50 },
            { id: 'sub-6', name: 'Responsabilidad', weightPercentage: 50 },
          ],
        },
      ],
      useFinalComponents: false,
      finalComponents: [],
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
