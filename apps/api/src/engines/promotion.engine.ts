/**
 * PROMOTION ENGINE (Pure Functions)
 * 
 * Motor de reglas de promoción basado en InstitutionRulesContext.
 * Lógica pura — sin acceso a base de datos.
 * 
 * Evalúa si un estudiante promueve basándose en:
 * - Promedio final vs nota mínima aprobatoria
 * - Cantidad de materias perdidas vs máximo permitido
 * - Porcentaje de asistencia vs mínimo institucional
 * 
 * Todo configurable por institución. Nunca usa valores fijos.
 */

import type { InstitutionRulesContext } from './InstitutionRulesContext'

// ============================================================================
// TIPOS
// ============================================================================

export type PromotionStatus = 'PROMOTED' | 'AT_RISK' | 'NOT_PROMOTED'

export interface StudentPromotionData {
  studentId: string
  studentName: string
  finalAverage: number
  failedSubjectsCount: number
  failedSubjectNames: string[]
  attendancePercent: number
}

export interface PromotionResult {
  status: PromotionStatus
  reasons: string[]
  failedSubjectsCount: number
  attendancePercent: number
  finalAverage: number
}

// ============================================================================
// FUNCIONES PURAS
// ============================================================================

/**
 * Evalúa la promoción de un estudiante.
 * Retorna estado + razones detalladas.
 */
export function evaluatePromotion(
  data: StudentPromotionData,
  ctx: InstitutionRulesContext,
): PromotionResult {
  // DIMENSIONS (preescolar) siempre promueve
  if (ctx.academicStructure === 'DIMENSIONS') {
    return {
      status: 'PROMOTED',
      reasons: ['Preescolar: promoción automática (estructura de dimensiones)'],
      failedSubjectsCount: 0,
      attendancePercent: data.attendancePercent,
      finalAverage: data.finalAverage,
    }
  }

  const reasons: string[] = []
  let blocked = false

  // Regla 1: Promedio mínimo
  if (data.finalAverage < ctx.minPassingGrade) {
    reasons.push(
      `Promedio final (${data.finalAverage.toFixed(1)}) inferior a la nota mínima aprobatoria (${ctx.minPassingGrade})`
    )
    blocked = true
  }

  // Regla 2: Materias perdidas
  if (data.failedSubjectsCount > ctx.maxFailedSubjectsForPromotion) {
    reasons.push(
      `Materias perdidas (${data.failedSubjectsCount}) exceden el máximo permitido (${ctx.maxFailedSubjectsForPromotion}): ${data.failedSubjectNames.join(', ')}`
    )
    blocked = true
  }

  // Regla 3: Asistencia mínima
  if (data.attendancePercent < ctx.minAttendancePercentage) {
    reasons.push(
      `Asistencia (${data.attendancePercent.toFixed(1)}%) inferior al mínimo institucional (${ctx.minAttendancePercentage}%)`
    )
    blocked = true
  }

  // Determinar estado
  let status: PromotionStatus
  if (blocked) {
    // Si tiene materias perdidas pero dentro del límite y promedio OK → en riesgo
    const onlySubjectIssue = data.failedSubjectsCount > 0 &&
      data.failedSubjectsCount <= ctx.maxFailedSubjectsForPromotion &&
      data.finalAverage >= ctx.minPassingGrade &&
      data.attendancePercent >= ctx.minAttendancePercentage

    if (onlySubjectIssue) {
      status = 'AT_RISK'
      reasons.push(
        `Tiene ${data.failedSubjectsCount} materia(s) perdida(s) pero dentro del límite permitido`
      )
    } else {
      status = 'NOT_PROMOTED'
    }
  } else if (data.failedSubjectsCount > 0) {
    status = 'AT_RISK'
    reasons.push(
      `Promueve con ${data.failedSubjectsCount} materia(s) pendiente(s): ${data.failedSubjectNames.join(', ')}`
    )
  } else {
    status = 'PROMOTED'
    if (reasons.length === 0) {
      reasons.push('Cumple todos los requisitos de promoción')
    }
  }

  return {
    status,
    reasons,
    failedSubjectsCount: data.failedSubjectsCount,
    attendancePercent: data.attendancePercent,
    finalAverage: data.finalAverage,
  }
}

/**
 * Verifica rápidamente si un estudiante promueve (sin detalles).
 */
export function willPromote(
  data: StudentPromotionData,
  ctx: InstitutionRulesContext,
): boolean {
  const result = evaluatePromotion(data, ctx)
  return result.status === 'PROMOTED' || result.status === 'AT_RISK'
}
