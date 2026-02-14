/**
 * RECOVERY ENGINE (Pure Functions)
 * 
 * Motor de reglas de recuperación basado en InstitutionRulesContext.
 * Lógica pura — sin acceso a base de datos.
 * 
 * Determina elegibilidad para recuperación y calcula notas requeridas.
 * Todo basado en configuración institucional.
 */

import type { InstitutionRulesContext } from './InstitutionRulesContext'

// ============================================================================
// TIPOS
// ============================================================================

export interface RecoveryEligibility {
  canRecover: boolean
  reason: string
  requiredGrade: number
  currentGrade: number
  maxAchievableScore: number
}

// ============================================================================
// FUNCIONES PURAS
// ============================================================================

/**
 * Determina si una asignatura es elegible para recuperación.
 * Solo puede recuperar si la nota está por debajo de la aprobatoria.
 */
export function canRecoverSubject(
  grade: number,
  ctx: InstitutionRulesContext,
): boolean {
  if (ctx.academicStructure === 'DIMENSIONS') return false // Preescolar no recupera
  return grade < ctx.minPassingGrade
}

/**
 * Calcula la nota requerida en recuperación para aprobar.
 * 
 * Si el impacto es ADJUST_TO_MINIMUM: la nota de recuperación debe ser >= minPassingGrade
 * Si el impacto es AVERAGE_WITH_ORIGINAL: (original + recovery) / 2 >= minPassingGrade
 *   → recovery >= 2 * minPassingGrade - original
 * Si el impacto es REPLACE: recovery >= minPassingGrade
 * 
 * @param currentGrade - Nota actual del estudiante
 * @param impactType - Tipo de impacto de la recuperación
 */
export function calculateRecoveryRequiredGrade(
  currentGrade: number,
  ctx: InstitutionRulesContext,
  impactType: 'ADJUST_TO_MINIMUM' | 'AVERAGE_WITH_ORIGINAL' | 'REPLACE' = 'ADJUST_TO_MINIMUM',
): number {
  switch (impactType) {
    case 'ADJUST_TO_MINIMUM':
    case 'REPLACE':
      return ctx.minPassingGrade

    case 'AVERAGE_WITH_ORIGINAL': {
      const required = 2 * ctx.minPassingGrade - currentGrade
      return Math.max(ctx.minGradeValue, Math.min(ctx.maxGradeValue, Math.round(required * 100) / 100))
    }

    default:
      return ctx.minPassingGrade
  }
}

/**
 * Evalúa la elegibilidad completa de recuperación para una asignatura.
 */
export function evaluateRecoveryEligibility(
  currentGrade: number,
  ctx: InstitutionRulesContext,
  impactType: 'ADJUST_TO_MINIMUM' | 'AVERAGE_WITH_ORIGINAL' | 'REPLACE' = 'ADJUST_TO_MINIMUM',
): RecoveryEligibility {
  const eligible = canRecoverSubject(currentGrade, ctx)
  const requiredGrade = calculateRecoveryRequiredGrade(currentGrade, ctx, impactType)
  const maxAchievable = ctx.recoveryMaxScore

  if (!eligible) {
    return {
      canRecover: false,
      reason: currentGrade >= ctx.minPassingGrade
        ? 'La nota actual ya es aprobatoria'
        : 'Estructura académica no permite recuperación',
      requiredGrade: 0,
      currentGrade,
      maxAchievableScore: maxAchievable,
    }
  }

  const isPossible = requiredGrade <= maxAchievable
  return {
    canRecover: isPossible,
    reason: isPossible
      ? `Necesita ${requiredGrade.toFixed(1)} en recuperación (máximo alcanzable: ${maxAchievable})`
      : `Requiere ${requiredGrade.toFixed(1)} pero el máximo de recuperación es ${maxAchievable}`,
    requiredGrade,
    currentGrade,
    maxAchievableScore: maxAchievable,
  }
}
