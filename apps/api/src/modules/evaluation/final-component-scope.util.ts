/**
 * Regla canónica de alcance de las fuentes de evaluación final (D-19).
 *
 * Vive aparte y como función PURA porque la consumen varios servicios —el
 * cálculo de la nota anual, la planilla, el boletín y la validación de pesos—
 * y una regla académica duplicada en varios sitios es exactamente el patrón de
 * doble fuente de verdad que este rediseño está eliminando.
 *
 * EL PROBLEMA QUE RESUELVE
 *   Hasta ahora «esta asignatura no presenta el examen semestral» sólo podía
 *   INFERIRSE de que no hubiera nota. Y eso es indistinguible de «al docente le
 *   falta subirla». Misma trampa que D-12 rechazó al negarse a deducir el
 *   retiro de un imprescindible desde la existencia de valoraciones.
 *
 * REGLA (excluir siempre resta, nunca suma)
 *   1. exclusión (componente, grado, asignatura) → NO aplica a esa asignatura
 *   2. exclusión (componente, grado, null)       → NO aplica a todo el grado
 *   3. sin exclusión                             → APLICA
 *
 *   No hay re-inclusión: no existe «excluir el grado pero rescatar una
 *   asignatura». Si un grado presenta el semestral sólo en tres asignaturas, se
 *   excluyen las demás explícitamente. Más filas, cero ambigüedad al resolver.
 *
 * FAIL-OPEN deliberado
 *   Si no se conoce el grado de la matrícula, la fuente APLICA. Descartar una
 *   fuente por un dato incompleto alteraría una nota anual en silencio; que
 *   aparezca de más es visible y corregible. Mismo criterio que la vigencia de
 *   evidencias en D-12.
 *
 * IMPORTANTE: la ausencia de exclusiones equivale al comportamiento histórico.
 * Con la tabla vacía este filtro es un no-op, y por eso las instituciones que
 * no configuren nada no cambian en absoluto.
 */

/** Fila mínima de exclusión que necesita la regla. */
export interface ComponentExclusionRow {
  finalComponentId: string;
  gradeId: string;
  /** null ⇒ la exclusión cubre TODAS las asignaturas de ese grado. */
  subjectId: string | null;
}

/**
 * ¿Aplica este componente final a la coordenada (grado, asignatura)?
 *
 * @param finalComponentId componente a evaluar
 * @param gradeId          grado de la matrícula; `null`/`undefined` ⇒ fail-open
 * @param subjectId        asignatura; `null`/`undefined` ⇒ sólo puede caer por
 *                         una exclusión de grado completo
 * @param exclusions       exclusiones del año (idealmente ya filtradas)
 */
export function componentApplies(
  finalComponentId: string,
  gradeId: string | null | undefined,
  subjectId: string | null | undefined,
  exclusions: ComponentExclusionRow[],
): boolean {
  if (!exclusions.length) return true; // caso mayoritario: nadie configuró nada
  if (!gradeId) return true; // fail-open: sin grado no se descarta una fuente

  for (const ex of exclusions) {
    if (ex.finalComponentId !== finalComponentId) continue;
    if (ex.gradeId !== gradeId) continue;

    // Precedencia 2: el grado completo queda fuera.
    if (ex.subjectId === null) return false;

    // Precedencia 1: sólo esa asignatura queda fuera.
    if (subjectId && ex.subjectId === subjectId) return false;
  }

  return true;
}

/**
 * Motivo por el que una fuente no aplica, para poder explicárselo al usuario
 * en vez de que la columna desaparezca sin más.
 */
export function exclusionReason(
  finalComponentId: string,
  gradeId: string | null | undefined,
  subjectId: string | null | undefined,
  exclusions: ComponentExclusionRow[],
): 'GRADE' | 'GRADE_SUBJECT' | null {
  if (!gradeId) return null;
  for (const ex of exclusions) {
    if (ex.finalComponentId !== finalComponentId) continue;
    if (ex.gradeId !== gradeId) continue;
    if (ex.subjectId === null) return 'GRADE';
    if (subjectId && ex.subjectId === subjectId) return 'GRADE_SUBJECT';
  }
  return null;
}
