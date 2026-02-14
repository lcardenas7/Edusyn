/**
 * ATTENDANCE RULES ENGINE (Pure Functions)
 * 
 * Motor de reglas de asistencia basado en InstitutionRulesContext.
 * Lógica pura — sin acceso a base de datos.
 * 
 * Usa minAttendancePercentage desde el contexto institucional.
 * Nunca usa valores hardcodeados.
 */

import type { InstitutionRulesContext } from './InstitutionRulesContext'

// ============================================================================
// TIPOS
// ============================================================================

export type AttendanceLevel = 'NORMAL' | 'ALERT' | 'CRITICAL'

export interface AttendanceResult {
  percent: number
  level: AttendanceLevel
  atRisk: boolean
}

// ============================================================================
// FUNCIONES PURAS
// ============================================================================

/**
 * Calcula el porcentaje de asistencia.
 */
export function calculateAttendancePercent(
  attended: number,
  total: number,
): number {
  if (total <= 0) return 100
  const pct = (attended / total) * 100
  return Math.round(pct * 100) / 100
}

/**
 * Determina si el porcentaje de asistencia está en riesgo.
 * En riesgo = por debajo del mínimo institucional.
 */
export function isAttendanceAtRisk(
  percent: number,
  ctx: InstitutionRulesContext,
): boolean {
  return percent < ctx.minAttendancePercentage
}

/**
 * Obtiene el nivel de asistencia basado en umbrales dinámicos.
 * 
 * NORMAL:   >= minAttendance
 * ALERT:    >= minAttendance - 15  y  < minAttendance
 * CRITICAL: < minAttendance - 15
 * 
 * El margen de alerta (15%) es relativo al mínimo configurado.
 */
export function getAttendanceLevel(
  percent: number,
  ctx: InstitutionRulesContext,
): AttendanceLevel {
  const min = ctx.minAttendancePercentage
  if (percent >= min) return 'NORMAL'
  if (percent >= min - 15) return 'ALERT'
  return 'CRITICAL'
}

/**
 * Evalúa la asistencia completa de un estudiante.
 */
export function evaluateAttendance(
  attended: number,
  total: number,
  ctx: InstitutionRulesContext,
): AttendanceResult {
  const percent = calculateAttendancePercent(attended, total)
  return {
    percent,
    level: getAttendanceLevel(percent, ctx),
    atRisk: isAttendanceAtRisk(percent, ctx),
  }
}

/**
 * Determina si la asistencia impide la promoción.
 */
export function attendanceBlocksPromotion(
  attendancePercent: number,
  ctx: InstitutionRulesContext,
): boolean {
  return attendancePercent < ctx.minAttendancePercentage
}
