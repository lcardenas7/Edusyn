/**
 * MAPEO EXPLÍCITO: Nivel Cualitativo ↔ PerformanceLevel
 * 
 * Alineado exactamente con el seed (seed-demo-transicion.ts):
 *   LOGRADO    → SUPERIOR
 *   EN_PROCESO → BASICO
 *   INICIANDO  → BAJO
 * 
 * NOTA: PerformanceLevel es un enum fijo en Prisma (BAJO|BASICO|ALTO|SUPERIOR).
 * Para preescolar (DIMENSIONS), solo se usan 3 de los 4 valores.
 * ALTO no se usa en modo cualitativo descriptivo.
 * 
 * Este mapeo NO debe usarse para modo numérico.
 * Solo aplica cuando academicStructure === 'DIMENSIONS'.
 */

export type QualitativeCode = 'LOGRADO' | 'EN_PROCESO' | 'INICIANDO'
export type PerformanceLevelEnum = 'BAJO' | 'BASICO' | 'ALTO' | 'SUPERIOR'

// Cualitativo → PerformanceLevel (para guardar en StudentAchievement)
export const qualitativeToPerformanceMap: Record<QualitativeCode, PerformanceLevelEnum> = {
  LOGRADO: 'SUPERIOR',
  EN_PROCESO: 'BASICO',
  INICIANDO: 'BAJO',
}

// PerformanceLevel → Cualitativo (para leer desde StudentAchievement)
export const performanceToQualitativeMap: Record<string, QualitativeCode> = {
  SUPERIOR: 'LOGRADO',
  BASICO: 'EN_PROCESO',
  BAJO: 'INICIANDO',
}

/**
 * Convierte un código cualitativo a PerformanceLevel.
 * Retorna null si no hay mapeo (con warning en consola).
 */
export function toPerformanceLevel(qualitativeCode: string): PerformanceLevelEnum | null {
  const mapped = qualitativeToPerformanceMap[qualitativeCode as QualitativeCode]
  if (!mapped) {
    console.warn(`[qualitativeMapper] No mapping found for qualitative level: "${qualitativeCode}"`)
    return null
  }
  return mapped
}

/**
 * Convierte un PerformanceLevel a código cualitativo.
 * Retorna cadena vacía si no hay mapeo (sin romper render).
 */
export function toQualitativeCode(performanceLevel: string): string {
  return performanceToQualitativeMap[performanceLevel] || ''
}
