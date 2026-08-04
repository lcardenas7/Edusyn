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
  imageUrl?: string // LABEL_IMAGE: imagen de fondo sobre la que se etiqueta
  // SHORT_ANSWER abierta: no hay respuesta exacta; se acepta cualquier texto (reflexión,
  // opinión…). No marca error ni baja XP. Lo decide el docente.
  openAnswer?: boolean
}

// Punto a etiquetar (LABEL_IMAGE): vive en `options` como "etiqueta::x::y" (x,y en %).
export interface Hotspot { label: string; x: number; y: number }
export function parseHotspots(options?: string[]): Hotspot[] {
  return (options || [])
    .map(o => {
      const p = String(o).split('::')
      return { label: (p[0] || '').trim(), x: parseFloat(p[1]) || 0, y: parseFloat(p[2]) || 0 }
    })
    .filter(h => h.label)
}

// trim + minúsculas + colapsa espacios internos (clave para ORDERING).
export function norm(s: any): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

// Signos de puntuación que NO deben decidir si una respuesta escrita es correcta
// (van al inicio/fin del texto). No incluye "-" ni "°" para no alterar números.
const EDGE_PUNCT = /^[\s.,;:!?¿¡"'“”‘’()…]+|[\s.,;:!?¿¡"'“”‘’()…]+$/g

// Normaliza una respuesta ESCRITA para compararla con tolerancia: minúsculas,
// sin acentos/diacríticos, sin espacios extra y sin puntuación en los extremos.
// Así "Canción", "cancion" y "cancion." se consideran la misma respuesta.
export function canonicalText(s: any): string {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(EDGE_PUNCT, '')
    .trim()
}

// Juez de respuestas escritas (FILL_BLANK / SHORT_ANSWER). Acepta varias
// respuestas válidas separadas por "|" (p. ej. "big|large" o "sí|si|claro").
export function textMatches(correct: any, value: any): boolean {
  const answer = canonicalText(value)
  if (!answer) return false
  return String(correct ?? '')
    .split('|')
    .map(canonicalText)
    .filter(Boolean)
    .some(c => c === answer)
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
    case 'CROSSWORD':
    case 'MEMORY': {
      // Completa cuando se han resuelto todas las parejas (pares "izq::der").
      const n = parsePairs(act.options).length
      return n > 0 && Array.isArray(value) && value.length >= n
    }
    case 'LABEL_IMAGE': {
      // Completa cuando cada punto tiene una etiqueta asignada.
      const n = parseHotspots(act.options).length
      return n > 0 && Array.isArray(value) && value.filter(v => v).length >= n
    }
    case 'PUZZLE': {
      // Completa = resuelto: cada pieza en su lugar (arreglo identidad).
      const n = parseInt(act.options?.[0] || '3') || 3
      return Array.isArray(value) && value.length === n * n && value.every((v: number, i: number) => v === i)
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
    case 'CROSSWORD':
    case 'MEMORY': {
      // Correcto = todas las parejas (izquierda de los pares) resueltas/emparejadas.
      const target = parsePairs(act.options).map(p => norm(p.left)).filter(Boolean)
      const solved = (Array.isArray(value) ? value : []).map(norm)
      return target.length > 0 && target.every(w => solved.includes(w))
    }
    case 'LABEL_IMAGE': {
      // Correcto = cada punto (en orden) tiene su etiqueta correcta.
      const spots = parseHotspots(act.options)
      return spots.length > 0 && Array.isArray(value) && spots.every((h, i) => norm(value[i]) === norm(h.label))
    }
    case 'PUZZLE': {
      // Correcto = resuelto: cada pieza en su posición (arreglo identidad).
      const n = parseInt(act.options?.[0] || '3') || 3
      return Array.isArray(value) && value.length === n * n && value.every((v: number, i: number) => v === i)
    }
    case 'SHORT_ANSWER':
      // Abierta: se acepta cualquier respuesta no vacía (sin respuesta exacta) → no
      // marca error ni penaliza. Si no es abierta, compara con tolerancia.
      if (act.openAnswer) return canonicalText(value) !== ''
      return textMatches(act.correctAnswer, value)
    case 'FILL_BLANK':
      // El alumno escribe la palabra del hueco: comparación tolerante (acentos,
      // mayúsculas, puntuación) y admite alternativas separadas por "|".
      return textMatches(act.correctAnswer, value)
    default:
      return norm(value) === norm(act.correctAnswer)
  }
}
