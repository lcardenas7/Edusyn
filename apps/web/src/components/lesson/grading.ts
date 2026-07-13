// ═══════════════════════════════════════════════════════════════════════════
// GRADING (DS-1) — lógica pura de completitud y corrección por tipo de bloque
// ─────────────────────────────────────────────────────────────────────────
// Sin React ni UI: es el único juez de si una respuesta es correcta, y de si
// hay suficiente para comprobar. Testeable de forma aislada.
// Camino A (sin cambio de schema): ORDERING y MATCHING se codifican sobre los
// campos existentes `options` / `correctAnswer`.
// ═══════════════════════════════════════════════════════════════════════════

export interface ActivityData {
  questionType: string
  question: string
  options?: string[]
  correctAnswer?: string
  explanation?: string
  points?: number
  hint?: string
}

// trim + minúsculas + colapsa espacios internos (clave para ORDERING).
export function norm(s: any): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

// Los pares de MATCHING viven en `options` como "izquierda::derecha".
export function parsePairs(options?: string[]): { left: string; right: string }[] {
  return (options || [])
    .map(o => {
      const [left, right] = String(o).split('::')
      return { left: (left || '').trim(), right: (right || '').trim() }
    })
    .filter(p => p.left && p.right)
}

// ¿Hay suficiente para comprobar? (gobierna el botón "Comprobar")
export function isAnswerComplete(act: ActivityData, value: any): boolean {
  switch (act.questionType) {
    case 'ORDERING':
      return Array.isArray(value) && value.length > 0 && value.length === (act.options?.length || 0)
    case 'MATCHING': {
      const lefts = parsePairs(act.options).map(p => p.left)
      return lefts.length > 0 && !!value && typeof value === 'object' && lefts.every(l => value[l])
    }
    case 'WORDSEARCH': {
      // Completa cuando se han encontrado TODAS las palabras.
      const n = act.options?.length || 0
      return n > 0 && Array.isArray(value) && value.length >= n
    }
    default:
      return value !== null && value !== undefined && value !== ''
  }
}

// El único juez de si la respuesta es correcta.
export function gradeAnswer(act: ActivityData, value: any): boolean {
  switch (act.questionType) {
    case 'ORDERING':
      return norm((Array.isArray(value) ? value : []).join(' ')) === norm(act.correctAnswer)
    case 'MATCHING': {
      const pairs = parsePairs(act.options)
      return pairs.length > 0 && !!value && pairs.every(p => norm(value[p.left]) === norm(p.right))
    }
    case 'WORDSEARCH': {
      // Correcto = todas las palabras objetivo aparecen entre las encontradas.
      const target = (act.options || []).map(norm).filter(Boolean)
      const found = (Array.isArray(value) ? value : []).map(norm)
      return target.length > 0 && target.every(w => found.includes(w))
    }
    default:
      return norm(value) === norm(act.correctAnswer)
  }
}
