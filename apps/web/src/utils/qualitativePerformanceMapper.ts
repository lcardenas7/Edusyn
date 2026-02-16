/**
 * MAPEO DINÁMICO: Nivel Cualitativo ↔ PerformanceLevel
 *
 * El enum Prisma PerformanceLevel es FIJO: SUPERIOR | ALTO | BASICO | BAJO
 * Pero la escala cualitativa es CONFIGURABLE por institución (2, 3 o 4 niveles).
 *
 * Este mapper construye mapas bidireccionales dinámicamente a partir de los
 * qualitativeLevels configurados en el AcademicLevel, ordenados por `order`.
 *
 * Estrategia de asignación (por cantidad de niveles):
 *   4 niveles → SUPERIOR, ALTO, BASICO, BAJO  (1:1)
 *   3 niveles → SUPERIOR, BASICO, BAJO        (salta ALTO)
 *   2 niveles → SUPERIOR, BAJO                (salta ALTO y BASICO)
 *
 * Esto funciona con cualquier escala: S/A/B/J, L/EP/I, o personalizada.
 * Solo aplica cuando academicStructure === 'DIMENSIONS'.
 */

export type PerformanceLevelEnum = 'BAJO' | 'BASICO' | 'ALTO' | 'SUPERIOR'

interface QualitativeLevel {
  code: string
  order: number
  isApproved?: boolean
}

// Distribución fija de PerformanceLevel según cantidad de niveles cualitativos
const PERF_SLOTS: Record<number, PerformanceLevelEnum[]> = {
  4: ['SUPERIOR', 'ALTO', 'BASICO', 'BAJO'],
  3: ['SUPERIOR', 'BASICO', 'BAJO'],
  2: ['SUPERIOR', 'BAJO'],
}

/**
 * Construye mapas bidireccionales a partir de los qualitativeLevels configurados.
 * Retorna { toPerf, toQual } donde:
 *   toPerf[qualitativeCode] → PerformanceLevelEnum
 *   toQual[performanceLevel] → qualitativeCode
 */
export function buildQualitativeMaps(levels: QualitativeLevel[]): {
  toPerf: Record<string, PerformanceLevelEnum>
  toQual: Record<string, string>
} {
  const toPerf: Record<string, PerformanceLevelEnum> = {}
  const toQual: Record<string, string> = {}

  if (!levels || levels.length === 0) return { toPerf, toQual }

  const sorted = [...levels].sort((a, b) => a.order - b.order)
  const count = sorted.length
  const slots = PERF_SLOTS[count] || PERF_SLOTS[4] || []

  // Si hay más de 4 niveles, distribuir linealmente
  const effectiveSlots = count <= 4
    ? slots
    : sorted.map((_, i) => {
        const allSlots: PerformanceLevelEnum[] = ['SUPERIOR', 'ALTO', 'BASICO', 'BAJO']
        const idx = Math.round(i * (allSlots.length - 1) / (count - 1))
        return allSlots[idx]
      })

  sorted.forEach((level, i) => {
    const perf = effectiveSlots[i]
    if (perf) {
      toPerf[level.code] = perf
      toQual[perf] = level.code
    }
  })

  return { toPerf, toQual }
}

/**
 * Convierte un código cualitativo a PerformanceLevel usando mapas preconstruidos.
 * Retorna null si no hay mapeo (con warning en consola).
 */
export function toPerformanceLevel(
  qualitativeCode: string,
  toPerf: Record<string, PerformanceLevelEnum>
): PerformanceLevelEnum | null {
  const mapped = toPerf[qualitativeCode]
  if (!mapped) {
    console.warn(`[qualitativeMapper] No mapping for qualitative code: "${qualitativeCode}"`)
    return null
  }
  return mapped
}

/**
 * Convierte un PerformanceLevel a código cualitativo usando mapas preconstruidos.
 * Retorna cadena vacía si no hay mapeo (sin romper render).
 */
export function toQualitativeCode(
  performanceLevel: string,
  toQual: Record<string, string>
): string {
  return toQual[performanceLevel] || ''
}
