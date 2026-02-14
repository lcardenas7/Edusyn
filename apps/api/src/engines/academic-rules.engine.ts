/**
 * ACADEMIC RULES ENGINE (Pure Functions)
 * 
 * Motor de reglas académicas basado en InstitutionRulesContext.
 * Lógica pura — sin acceso a base de datos.
 * 
 * Funciona con CUALQUIER escala: 0–5, 0–10, 0–100.
 * Nunca usa valores hardcodeados.
 */

import type { InstitutionRulesContext, PerformanceLevelDef } from './InstitutionRulesContext'

// ============================================================================
// TIPOS DE RESULTADO
// ============================================================================

export type PerformanceTier = 'LOW' | 'BASIC' | 'HIGH' | 'SUPERIOR'

export interface PerformanceResult {
  percent: number
  tier: PerformanceTier
  level: PerformanceLevelDef | null
  label: string
}

// ============================================================================
// FUNCIONES PURAS
// ============================================================================

/**
 * Calcula el porcentaje de desempeño relativo a la escala institucional.
 * Normaliza cualquier escala a 0–100%.
 * 
 * Ejemplo: escala 1–5, nota 3.5 → (3.5-1)/(5-1) = 62.5%
 */
export function calculatePerformancePercent(
  grade: number,
  ctx: InstitutionRulesContext,
): number {
  const range = ctx.maxGradeValue - ctx.minGradeValue
  if (range <= 0) return 0
  const pct = ((grade - ctx.minGradeValue) / range) * 100
  return Math.max(0, Math.min(100, Math.round(pct * 100) / 100))
}

/**
 * Determina si una nota está reprobada.
 */
export function isFailing(
  grade: number,
  ctx: InstitutionRulesContext,
): boolean {
  if (ctx.academicStructure === 'DIMENSIONS') return false // Preescolar no reprueba
  return grade < ctx.minPassingGrade
}

/**
 * Determina si un estudiante está en riesgo académico.
 * Riesgo = nota por debajo de la aprobatoria.
 */
export function isInAcademicRisk(
  grade: number,
  ctx: InstitutionRulesContext,
): boolean {
  if (ctx.academicStructure === 'DIMENSIONS') return false
  return grade < ctx.minPassingGrade
}

/**
 * Obtiene el tier de desempeño basado en porcentaje de la escala.
 * Si hay performanceLevels configurados, usa esos.
 * Sino, usa clasificación porcentual estándar.
 */
export function getPerformanceTier(
  grade: number,
  ctx: InstitutionRulesContext,
): PerformanceTier {
  if (ctx.academicStructure === 'DIMENSIONS') return 'BASIC' // N/A para cualitativo

  // Si hay niveles configurados, buscar por rango
  if (ctx.performanceLevels.length > 0) {
    const sorted = [...ctx.performanceLevels].sort((a, b) => b.minScore - a.minScore)
    for (const level of sorted) {
      if (grade >= level.minScore && grade <= level.maxScore) {
        if (level.code === 'SUP' || level.code === 'SUPERIOR') return 'SUPERIOR'
        if (level.code === 'ALT' || level.code === 'ALTO' || level.code === 'HIGH') return 'HIGH'
        if (level.code === 'BAS' || level.code === 'BASICO' || level.code === 'BASIC') return 'BASIC'
        return 'LOW'
      }
    }
  }

  // Fallback: porcentaje de la escala
  const pct = calculatePerformancePercent(grade, ctx)
  if (pct >= 85) return 'SUPERIOR'
  if (pct >= 70) return 'HIGH'
  if (pct >= 50) return 'BASIC'
  return 'LOW'
}

/**
 * Obtiene el resultado completo de desempeño para una nota.
 */
export function getPerformanceLevel(
  grade: number,
  ctx: InstitutionRulesContext,
): PerformanceResult {
  const percent = calculatePerformancePercent(grade, ctx)
  const tier = getPerformanceTier(grade, ctx)

  // Buscar nivel configurado que coincida
  let level: PerformanceLevelDef | null = null
  if (ctx.performanceLevels.length > 0) {
    level = ctx.performanceLevels.find(
      l => grade >= l.minScore && grade <= l.maxScore
    ) || null
  }

  // Label legible
  const tierLabels: Record<PerformanceTier, string> = {
    SUPERIOR: 'Superior',
    HIGH: 'Alto',
    BASIC: 'Básico',
    LOW: 'Bajo',
  }

  return {
    percent,
    tier,
    level,
    label: level?.name || tierLabels[tier],
  }
}

/**
 * Calcula la nota mínima requerida para aprobar dado un promedio actual
 * y el peso restante.
 * 
 * Fórmula: requiredGrade = (minPassingGrade - currentAverage × (1 - remainingWeight)) / remainingWeight
 * 
 * @param currentAverage - Promedio actual del estudiante
 * @param remainingWeight - Peso restante (0–1), ej: 0.25 si falta 1 de 4 períodos
 * @returns Nota requerida, o Infinity si es imposible
 */
export function calculateRequiredGradeToPass(
  currentAverage: number,
  remainingWeight: number,
  ctx: InstitutionRulesContext,
): number {
  if (remainingWeight <= 0) {
    return currentAverage >= ctx.minPassingGrade ? 0 : Infinity
  }

  const required = (ctx.minPassingGrade - currentAverage * (1 - remainingWeight)) / remainingWeight

  if (required > ctx.maxGradeValue) return Infinity
  if (required < ctx.minGradeValue) return ctx.minGradeValue

  return Math.round(required * 100) / 100
}

/**
 * Clasifica un conjunto de notas en segmentos de distribución dinámicos.
 * Divide la escala en N segmentos proporcionales.
 */
export function getGradeDistributionRanges(
  ctx: InstitutionRulesContext,
  segments: number = 4,
): { label: string; min: number; max: number }[] {
  const range = ctx.maxGradeValue - ctx.minGradeValue
  const step = range / segments
  const ranges: { label: string; min: number; max: number }[] = []

  for (let i = 0; i < segments; i++) {
    const min = Math.round((ctx.minGradeValue + step * i) * 10) / 10
    const max = Math.round((ctx.minGradeValue + step * (i + 1)) * 10) / 10
    ranges.push({
      label: `${min} – ${max}`,
      min,
      max: i === segments - 1 ? ctx.maxGradeValue : max,
    })
  }

  return ranges
}
