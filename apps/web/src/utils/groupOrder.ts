/**
 * ORDEN CANÓNICO DE GRUPOS (frontend) — espejo de apps/api/src/common/utils/group-order.util.ts
 *
 * Ordena "por grupo": grado en orden académico (Preescolar → Primaria → Secundaria → Media,
 * y dentro de cada nivel por número de grado) y luego la letra del grupo (A, B, C…).
 * Ej.: Sexto A, Sexto B, Sexto C, Séptimo A… Robusto a grade.number sin poblar.
 */

const STAGE_BASE: Record<string, number> = {
  PREESCOLAR: 0,
  BASICA_PRIMARIA: 100,
  BASICA_SECUNDARIA: 200,
  MEDIA: 300,
}

const NAME_RANK: Record<string, number> = {
  prejardin: -3, parvulos: -3, prekinder: -3,
  jardin: -2, kinder: -2,
  transicion: 0, cero: 0, preescolar: 0,
  primero: 1, segundo: 2, tercero: 3, cuarto: 4, quinto: 5,
  sexto: 6, septimo: 7, octavo: 8, noveno: 9, decimo: 10,
  undecimo: 11, once: 11, duodecimo: 12, doce: 12,
}

const normalize = (s?: string | null): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

export function gradeAcademicRank(grade: any): number {
  const base = STAGE_BASE[grade?.stage as string] ?? 400
  let n = grade?.number
  if (n === null || n === undefined) {
    const key = normalize(grade?.name).split(/\s+/)[0]
    n = NAME_RANK[key] ?? 50
  }
  return base + Number(n || 0)
}

export function compareGroups(a: any, b: any): number {
  const ra = gradeAcademicRank(a?.grade)
  const rb = gradeAcademicRank(b?.grade)
  if (ra !== rb) return ra - rb
  return String(a?.name || '').localeCompare(String(b?.name || ''), 'es', { numeric: true, sensitivity: 'base' })
}

export function sortGroups<T extends { grade?: any; name?: string }>(groups: T[]): T[] {
  return [...groups].sort(compareGroups)
}
