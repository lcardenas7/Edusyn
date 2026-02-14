/**
 * INSTITUTION CONTEXT SERVICE
 * 
 * Servicio NestJS que carga la configuración institucional desde la BD
 * y la expone como InstitutionRulesContext para todos los engines.
 * 
 * FUENTE ÚNICA: Este servicio es el ÚNICO punto de acceso a la configuración
 * institucional para reglas de negocio. Otros servicios NO deben consultar
 * la configuración directamente.
 * 
 * CACHE: Cachea por institutionId para evitar múltiples queries en el mismo request.
 */

import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import {
  type InstitutionRulesContext,
  DEFAULT_RULES_CONTEXT,
} from '../../engines/InstitutionRulesContext'
import type { AcademicStructureType } from '../../engines/AcademicStructure'

@Injectable()
export class InstitutionContextService {
  // Cache en memoria por institutionId (vive mientras viva el servicio singleton)
  // En producción NestJS, el servicio es singleton → el cache persiste entre requests.
  // Usamos TTL para invalidar automáticamente.
  private cache = new Map<string, { ctx: InstitutionRulesContext; loadedAt: number }>()
  private readonly CACHE_TTL_MS = 60_000 // 1 minuto

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Obtiene el InstitutionRulesContext para una institución.
   * Lee de cache si existe y no ha expirado, sino carga desde BD.
   */
  async getContext(institutionId: string): Promise<InstitutionRulesContext> {
    // Verificar cache
    const cached = this.cache.get(institutionId)
    if (cached && Date.now() - cached.loadedAt < this.CACHE_TTL_MS) {
      return cached.ctx
    }

    // Cargar desde BD
    const ctx = await this.loadFromDatabase(institutionId)
    this.cache.set(institutionId, { ctx, loadedAt: Date.now() })
    return ctx
  }

  /**
   * Invalida el cache para una institución (útil al cambiar configuración).
   */
  invalidateCache(institutionId: string): void {
    this.cache.delete(institutionId)
  }

  /**
   * Invalida todo el cache.
   */
  invalidateAll(): void {
    this.cache.clear()
  }

  /**
   * Resuelve el institutionId desde un userId.
   */
  async resolveInstitutionId(userId: string): Promise<string | null> {
    const iu = await this.prisma.institutionUser.findFirst({
      where: { userId, isActive: true },
      select: { institutionId: true },
    })
    if (iu) return iu.institutionId

    const ta = await this.prisma.teacherAssignment.findFirst({
      where: { teacherId: userId },
      select: { academicYear: { select: { institutionId: true } } },
    })
    return ta?.academicYear?.institutionId || null
  }

  /**
   * Atajo: obtiene contexto desde userId (resuelve institutionId internamente).
   */
  async getContextForUser(userId: string): Promise<InstitutionRulesContext> {
    const institutionId = await this.resolveInstitutionId(userId)
    if (!institutionId) return { ...DEFAULT_RULES_CONTEXT }
    return this.getContext(institutionId)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARGA DESDE BASE DE DATOS
  // ═══════════════════════════════════════════════════════════════════════════

  private async loadFromDatabase(institutionId: string): Promise<InstitutionRulesContext> {
    try {
      // Query 1: Configuración de la institución
      const results = await this.prisma.$queryRaw<Array<{
        gradingConfig: any
        academicLevelsConfig: any
      }>>`
        SELECT "gradingConfig", "academicLevelsConfig"
        FROM "Institution" WHERE id = ${institutionId}
      `

      if (!results || results.length === 0) {
        return { ...DEFAULT_RULES_CONTEXT }
      }

      const row = results[0]
      const gradingConfig = row.gradingConfig || {}
      const academicLevels: any[] = row.academicLevelsConfig || []

      // Query 2: Recovery config (si existe)
      const recoveryConfig = await this.prisma.$queryRaw<Array<{
        minPassingScore: any
        periodMaxScore: any
        maxAreasRecoverable: number
      }>>`
        SELECT "minPassingScore", "periodMaxScore", "maxAreasRecoverable"
        FROM "RecoveryConfig" 
        WHERE "institutionId" = ${institutionId}
        LIMIT 1
      `.catch(() => [])

      // Derivar escala desde academic levels o grading config
      let minGradeValue = DEFAULT_RULES_CONTEXT.minGradeValue
      let maxGradeValue = DEFAULT_RULES_CONTEXT.maxGradeValue
      let minPassingGrade = DEFAULT_RULES_CONTEXT.minPassingGrade
      let academicStructure: AcademicStructureType = DEFAULT_RULES_CONTEXT.academicStructure
      let performanceLevels = DEFAULT_RULES_CONTEXT.performanceLevels
      let qualitativeLevels = DEFAULT_RULES_CONTEXT.qualitativeLevels

      // Buscar el primer nivel numérico para derivar escala
      if (academicLevels.length > 0) {
        const numericLevel = academicLevels.find(
          (l: any) => l.gradingScaleType?.startsWith('NUMERIC')
        )
        if (numericLevel) {
          minGradeValue = numericLevel.minGrade ?? minGradeValue
          maxGradeValue = numericLevel.maxGrade ?? maxGradeValue
          if (numericLevel.minPassingGrade != null) {
            minPassingGrade = numericLevel.minPassingGrade
          }
          if (numericLevel.performanceLevels?.length > 0) {
            performanceLevels = numericLevel.performanceLevels
          }
        }

        // Buscar nivel DIMENSIONS para cualitativos
        const dimensionsLevel = academicLevels.find(
          (l: any) => l.gradingScaleType === 'QUALITATIVE' || l.gradingScaleType === 'QUALITATIVE_DESC'
        )
        if (dimensionsLevel?.qualitativeLevels?.length > 0) {
          qualitativeLevels = dimensionsLevel.qualitativeLevels
        }
      }

      // Grading config overrides
      if (gradingConfig.minPassingGrade != null) {
        minPassingGrade = gradingConfig.minPassingGrade
      }
      if (gradingConfig.performanceLevels?.length > 0 && performanceLevels.length === 0) {
        performanceLevels = gradingConfig.performanceLevels
      }

      // Recovery config
      const recCfg = recoveryConfig?.[0]
      const recoveryMaxScore = recCfg?.periodMaxScore != null
        ? Number(recCfg.periodMaxScore)
        : minPassingGrade // Default: nota mínima aprobatoria
      const maxAreasRecoverable = recCfg?.maxAreasRecoverable ?? DEFAULT_RULES_CONTEXT.maxAreasRecoverable

      return {
        minGradeValue,
        maxGradeValue,
        minPassingGrade,
        academicStructure,
        maxFailedSubjectsForPromotion: DEFAULT_RULES_CONTEXT.maxFailedSubjectsForPromotion,
        minAttendancePercentage: DEFAULT_RULES_CONTEXT.minAttendancePercentage,
        recoveryMaxScore,
        maxAreasRecoverable,
        performanceLevels,
        qualitativeLevels,
      }
    } catch (error) {
      console.error(`[InstitutionContextService] Error loading config for ${institutionId}:`, error)
      return { ...DEFAULT_RULES_CONTEXT }
    }
  }
}
