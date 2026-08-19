// ═══════════════════════════════════════════════════════════════════════════
// JUEZ DE RESPUESTAS ESCRITAS — fuente única de verdad del backend
// ─────────────────────────────────────────────────────────────────────────
// Debe coincidir EXACTAMENTE con web/src/components/lesson/grading.ts. Antes
// cada motor (lección, quiz en casa, Live Quiz) tenía su propia comparación:
// la lección era tolerante y los quizzes exigían coincidencia literal, así que
// escribir "cancion" o "Bogota" en un "Completar" se marcaba como ERROR aunque
// la palabra fuera la correcta.
// ═══════════════════════════════════════════════════════════════════════════

// Signos de puntuación que NO deben decidir si una respuesta escrita es correcta
// (solo se recortan en los extremos). No incluye "-" ni "°" para no alterar números.
const EDGE_PUNCT = /^[\s.,;:!?¿¡"'“”‘’()…]+|[\s.,;:!?¿¡"'“”‘’()…]+$/g;

/** trim + minúsculas + colapsa espacios internos (comparación de opciones). */
export function norm(s: any): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Normaliza una respuesta ESCRITA para compararla con tolerancia: minúsculas,
 * sin acentos/diacríticos, sin espacios extra y sin puntuación en los extremos.
 * Así "Canción", "cancion" y "cancion." son la misma respuesta.
 */
export function canonicalText(s: any): string {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(EDGE_PUNCT, '')
    .trim();
}

/**
 * Juez de respuestas escritas (FILL_BLANK / SHORT_ANSWER). Acepta varias
 * respuestas válidas separadas por "|" (p. ej. "big|large" o "sí|si|claro").
 */
export function textMatches(correct: any, value: any): boolean {
  const answer = canonicalText(value);
  if (!answer) return false;
  return String(correct ?? '')
    .split('|')
    .map(canonicalText)
    .filter(Boolean)
    .some(c => c === answer);
}

/**
 * Lee una lista de huecos venga como venga. El editor del aula guarda un JSON
 * (`["Bogotá","8"]`), pero hay preguntas creadas por otras vías (importación,
 * Play, cambio de tipo de pregunta) donde `correctAnswer` es texto plano: ahí
 * `JSON.parse` reventaba y TODA respuesta se marcaba incorrecta.
 */
export function parseBlanks(raw: any): string[] {
  if (Array.isArray(raw)) return raw.map(v => (v == null ? '' : String(v)));
  const s = String(raw ?? '').trim();
  if (!s) return [];
  if (s.startsWith('[')) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(v => (v == null ? '' : String(v)));
    } catch {
      /* cae al texto plano */
    }
  }
  return [s]; // hueco único guardado como texto plano
}

/**
 * ¿El "Completar" está bien respondido? Todos los huecos esperados deben
 * coincidir (con tolerancia) en orden.
 *
 * Si el número de respuestas no cuadra con el de huecos, se comparan las
 * respuestas NO vacías compactadas: el formulario del docente descarta los
 * huecos que dejó sin respuesta (`filter`) mientras el alumno envía un arreglo
 * posicional, y ese desfase marcaba como error respuestas correctas.
 */
export function fillBlankMatches(correctRaw: any, givenRaw: any): boolean {
  const expected = parseBlanks(correctRaw).filter(c => canonicalText(c) !== '');
  if (!expected.length) return false;

  let given = parseBlanks(givenRaw);
  if (given.length !== expected.length) {
    given = given.filter(g => canonicalText(g) !== '');
  }
  return expected.every((c, i) => textMatches(c, given[i]));
}
