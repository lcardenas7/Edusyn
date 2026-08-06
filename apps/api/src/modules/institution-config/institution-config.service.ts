import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { deriveScaleFromConfig, validateScaleRanges } from '../evaluation/performance-scale.util'

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
  primaryColor?: string
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

    // RE-6: los componentes de evaluación deben sumar 100% (antes se aceptaba
    // cualquier suma y la renormalización la ocultaba).
    const processes = (config as any)?.processes as Array<{ weightPercentage?: number }> | undefined
    if (Array.isArray(processes) && processes.length > 0) {
      const total = processes.reduce((s, p) => s + (Number(p?.weightPercentage) || 0), 0)
      if (Math.abs(total - 100) > 0.01) {
        throw new BadRequestException(
          `Los componentes de evaluación deben sumar 100% (actualmente suman ${total}%).`,
        )
      }
    }

    // RE-4: la escala de desempeño resultante debe ser válida (sin solapes ni huecos).
    // Se valida ANTES de escribir para no dejar config inválida persistida.
    await this.assertDerivedScaleValid(institutionId, { gradingConfig: config })

    const configJson = JSON.stringify(config)
    await this.prisma.$executeRaw`
      UPDATE "Institution" SET "gradingConfig" = ${configJson}::jsonb WHERE id = ${institutionId}
    `

    // Consolidación: proyectar los niveles configurados a la tabla PerformanceScale
    // (la fuente que leen boletines/desempeños/promoción).
    await this.syncScaleFromConfig(institutionId)

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

    // RE-4: validar la escala resultante ANTES de escribir.
    await this.assertDerivedScaleValid(institutionId, { academicLevelsConfig: levels })

    const levelsJson = JSON.stringify(levels)
    await this.prisma.$executeRaw`
      UPDATE "Institution" SET "academicLevelsConfig" = ${levelsJson}::jsonb WHERE id = ${institutionId}
    `

    // Consolidación: proyectar los niveles configurados a la tabla PerformanceScale.
    await this.syncScaleFromConfig(institutionId)

    return { success: true, academicLevelsConfig: levels }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSOLIDACIÓN DE ESCALA — mantiene PerformanceScale (tabla) sincronizada con
  // la config JSON. La tabla es la que leen boletines, desempeños y promoción.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * RE-4: valida (bloqueante) que la escala de desempeño DERIVADA de la configuración
   * sea coherente (sin solapes ni huecos). Se llama ANTES de persistir el config para
   * no dejar una escala inválida viva (que haría no-determinista getPerformanceLevel).
   * `opts` permite validar contra el config ENTRANTE antes de escribirlo.
   */
  private async assertDerivedScaleValid(
    institutionId: string,
    opts: { gradingConfig?: any; academicLevelsConfig?: any },
  ): Promise<void> {
    const inst = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { gradingConfig: true, academicLevelsConfig: true },
    })
    const gradingConfig =
      opts.gradingConfig !== undefined ? opts.gradingConfig : inst?.gradingConfig
    const academicLevelsConfig =
      opts.academicLevelsConfig !== undefined ? opts.academicLevelsConfig : inst?.academicLevelsConfig

    const rows = deriveScaleFromConfig(gradingConfig, academicLevelsConfig)
    const issues = validateScaleRanges(rows)
    if (issues.length > 0) {
      throw new BadRequestException({
        message:
          'La escala de desempeño resultante tiene rangos inválidos (solapes o huecos). Corrígela antes de guardar.',
        issues,
      })
    }
  }

  async syncScaleFromConfig(institutionId: string): Promise<{ synced: number }> {
    const inst = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { gradingConfig: true, academicLevelsConfig: true },
    })
    if (!inst) return { synced: 0 }

    const rows = deriveScaleFromConfig(inst.gradingConfig, inst.academicLevelsConfig)

    // RE-4: validación BLOQUEANTE (antes solo era console.warn).
    const issues = validateScaleRanges(rows)
    if (issues.length > 0) {
      throw new BadRequestException({
        message:
          'La escala de desempeño resultante tiene rangos inválidos (solapes o huecos). Corrígela antes de guardar.',
        issues,
      })
    }

    // RE-5: todo-o-nada. Antes el upsert fila-por-fila podía dejar la escala a medias
    // (unos niveles nuevos, otros viejos → solapes/huecos) si fallaba a mitad.
    await this.prisma.$transaction(
      rows.map((r) =>
        this.prisma.performanceScale.upsert({
          where: { institutionId_level: { institutionId, level: r.level } },
          update: {
            minScore: r.minScore,
            maxScore: r.maxScore,
            label: r.label,
            order: r.order,
            isApproved: r.isApproved,
            // No pisar un descriptor ya configurado con null (el JSON no trae descriptor)
            ...(r.descriptor != null && { descriptor: r.descriptor }),
          },
          create: {
            institutionId,
            level: r.level,
            minScore: r.minScore,
            maxScore: r.maxScore,
            label: r.label,
            order: r.order,
            isApproved: r.isApproved,
            descriptor: r.descriptor,
          },
        }),
      ),
    )
    return { synced: rows.length }
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

    // RE-6: los pesos de los períodos deben sumar 100% (antes cualquier suma se
    // aceptaba y la renormalización del anual lo ocultaba).
    if (Array.isArray(periods) && periods.length > 0) {
      const totalWeight = periods.reduce((s, p) => s + (Number((p as any)?.weight) || 0), 0)
      if (Math.abs(totalWeight - 100) > 0.01) {
        throw new BadRequestException(
          `Los pesos de los períodos deben sumar 100% (actualmente suman ${totalWeight}%).`,
        )
      }
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
          await this.prisma.academicTerm.update({
            where: { id: existingTerm.id },
            data: {
              name: period.name,
              order,
              weightPercentage: Math.round(period.weight),
              startDate: period.startDate ? new Date(period.startDate) : null,
              endDate: period.endDate ? new Date(period.endDate) : null,
            }
          })
        } else {
          await this.prisma.academicTerm.create({
            data: {
              academicYearId: academicYear.id,
              type: 'PERIOD',
              name: period.name,
              order,
              weightPercentage: Math.round(period.weight),
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
        primaryColor: true,
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
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.logo !== undefined && { logo: dto.logo }),
        ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
      },
      select: {
        id: true,
        name: true,
        daneCode: true,
        nit: true,
        city: true,
        address: true,
        phone: true,
        email: true,
        website: true,
        logo: true,
        primaryColor: true,
        slug: true,
        status: true,
      },
    })

    return updated
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MÓDULO 2 (Onboarding v2) — CONFIGURACIÓN BASE + COMPLETITUD
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Aplica la configuración base ("plantilla") a una institución recién creada:
   * composición de la nota (procesos/pesos 40/40/20) + períodos (4×25). La escala
   * de desempeño ya se sembró al crear la institución (DEFAULT_PERFORMANCE_SCALE).
   *
   * Reusa los setters validados (RE-4 escala, RE-6 pesos=100); los defaults ya
   * cumplen esas reglas, así que no fallan. La composición (EvaluationComponent)
   * se materializa de forma perezosa en la primera lectura de la estructura (Fase 2),
   * a partir del gradingConfig escrito aquí.
   *
   * Idempotente/protegido: no pisa una config existente salvo `overwrite=true`.
   *
   * NOTA (reportada): no es una única transacción — cada setter abre la suya. Como
   * se aplican DEFAULTS válidos y la operación es reintentable, un fallo parcial se
   * recupera reejecutando. Atomizar exigiría refactorizar los setters (fuera de alcance).
   */
  async applyBaseConfig(institutionId: string, opts: { overwrite?: boolean } = {}) {
    const inst = await this.prisma.institution.findUnique({
      where: { id: institutionId },
      select: { id: true, gradingConfig: true, periodsConfig: true },
    })
    if (!inst) throw new NotFoundException('Institución no encontrada')

    const alreadyConfigured = inst.gradingConfig != null || inst.periodsConfig != null
    if (alreadyConfigured && !opts.overwrite) {
      throw new ConflictException(
        'La institución ya tiene configuración. Usa overwrite=true para reemplazarla.',
      )
    }

    await this.updateGradingConfig(institutionId, this.getDefaultGradingConfig())
    await this.updatePeriods(institutionId, this.getDefaultPeriods())

    return this.getFullConfig(institutionId)
  }

  /**
   * Gate del onboarding: ¿la configuración mínima está lista para importar y activar?
   * Chequea la config a nivel de definición (JSON/escala), NO las tablas que dependen
   * de que ya exista un año lectivo (los AcademicTerm se crean al configurar el año).
   */
  async getConfigCompleteness(institutionId: string) {
    const [scaleCount, roots, inst] = await Promise.all([
      this.prisma.performanceScale.count({ where: { institutionId } }),
      this.prisma.evaluationComponent.findMany({
        where: { institutionId, parentId: null },
        select: { weightPercentage: true },
      }),
      this.prisma.institution.findUnique({
        where: { id: institutionId },
        select: { gradingConfig: true, periodsConfig: true },
      }),
    ])

    const sumBy = (arr: any, key: string) =>
      (Array.isArray(arr) ? arr : []).reduce((s: number, x: any) => s + (Number(x?.[key]) || 0), 0)

    const escala = scaleCount > 0
    let periodos = Math.abs(sumBy((inst?.periodsConfig as any), 'weight') - 100) < 0.01
    if (!periodos) {
      const year = await this.prisma.academicYear.findFirst({
        where: { institutionId, status: { in: ['DRAFT', 'ACTIVE'] } },
        orderBy: { year: 'desc' },
        select: { id: true },
      })
      if (year) {
        const terms = await this.prisma.academicTerm.findMany({
          where: { academicYearId: year.id, type: 'PERIOD' },
          select: { weightPercentage: true },
        })
        if (terms.length > 0) {
          const termSum = terms.reduce((s, t) => s + (t.weightPercentage ?? 0), 0)
          periodos = Math.abs(termSum - 100) < 0.01
        }
      }
    }
    // Composición: fuente única EvaluationComponent; si aún no está materializada,
    // se valida desde el gradingConfig (que la sembrará en la primera lectura).
    let compTotal = roots.reduce((s, r) => s + (r.weightPercentage ?? 0), 0)
    if (roots.length === 0) {
      compTotal = sumBy((inst?.gradingConfig as any)?.evaluationProcesses, 'weightPercentage')
    }
    const composicion = Math.abs(compTotal - 100) < 0.01

    const missing: string[] = []
    if (!escala) missing.push('escala')
    if (!periodos) missing.push('periodos')
    if (!composicion) missing.push('composicion')

    return { ready: missing.length === 0, missing, checks: { escala, periodos, composicion } }
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
