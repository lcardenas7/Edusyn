/**
 * Regla canónica de alcance de las fuentes de evaluación final (D-19).
 *
 * FUENTE ÚNICA DE VERDAD. La consumen el cálculo de la nota anual, las
 * proyecciones de nota mínima requerida y la captura de notas. Una regla
 * académica duplicada en varios sitios es el patrón de doble fuente de verdad
 * que este rediseño está eliminando, así que vive aquí y como función PURA.
 *
 * EL PROBLEMA QUE RESUELVE
 *   Una institución puede tener pruebas semestrales sin que todos sus grados o
 *   asignaturas las presenten. Hasta ahora «no aplica» sólo podía INFERIRSE de
 *   la ausencia de nota, y eso es indistinguible de «al docente le falta
 *   subirla» — la misma trampa que D-12 rechazó al negarse a deducir el retiro
 *   de un imprescindible desde la existencia de valoraciones.
 *
 * RESOLUCIÓN JERÁRQUICA — de más específica a menos:
 *   1. regla (componente, grado, asignatura) → su `applies`
 *   2. regla (componente, grado, null)       → su `applies`
 *   3. sin regla                             → `scopeMode === 'ALL_GRADES'`
 *
 *   `applies` permite la EXCEPCIÓN, que una lista negra pura no sabe expresar:
 *   excluir 8.º entero y rescatar Matemáticas es
 *       (8.º, null, applies=false) + (8.º, Matemáticas, applies=true)
 *
 * COMPATIBILIDAD HACIA ATRÁS
 *   `ALL_GRADES` es el DEFAULT de la columna, así que los componentes que ya
 *   existen se comportan exactamente igual que antes. Sin filas de alcance esta
 *   función devuelve `true` siempre: es un no-op y ninguna nota anual cambia.
 *
 * FAIL-OPEN deliberado
 *   Si no se conoce el grado, la fuente APLICA. Descartar una fuente por un
 *   dato incompleto alteraría una nota anual en silencio; que aparezca de más
 *   es visible y corregible. Mismo criterio que la vigencia de D-12.
 */

export type ScopeMode = 'ALL_GRADES' | 'SELECTED_GRADES';

/** Fila mínima de alcance que necesita la regla. */
export interface ScopeRuleRow {
  finalComponentId: string;
  gradeId: string;
  /** null ⇒ la regla cubre TODAS las asignaturas de ese grado. */
  subjectId: string | null;
  applies: boolean;
}

/** Fuente evaluable mínima. */
export interface ScopedComponent {
  id: string;
  scopeMode: ScopeMode;
}

/** Resultado de resolver el alcance, con el porqué. */
export interface ScopeDecision {
  applies: boolean;
  /** Qué nivel de la jerarquía decidió. Sirve para explicarlo en la UI. */
  source: 'SUBJECT_RULE' | 'GRADE_RULE' | 'DEFAULT_MODE' | 'FAIL_OPEN';
}

/**
 * Resuelve si un componente aplica a la coordenada (grado, asignatura),
 * devolviendo también quién tomó la decisión.
 */
export function resolveComponentScope(
  component: ScopedComponent,
  gradeId: string | null | undefined,
  subjectId: string | null | undefined,
  rules: ScopeRuleRow[],
): ScopeDecision {
  // Sin grado no se descarta una fuente: alterar una nota en silencio es peor
  // que mostrar una columna de más.
  if (!gradeId) return { applies: true, source: 'FAIL_OPEN' };

  let gradeRule: ScopeRuleRow | undefined;

  for (const r of rules) {
    if (r.finalComponentId !== component.id) continue;
    if (r.gradeId !== gradeId) continue;

    // Precedencia 1 — la más específica gana de inmediato.
    if (r.subjectId !== null && subjectId && r.subjectId === subjectId) {
      return { applies: r.applies, source: 'SUBJECT_RULE' };
    }
    // Precedencia 2 — se retiene por si no aparece una de asignatura.
    if (r.subjectId === null) gradeRule = r;
  }

  if (gradeRule) return { applies: gradeRule.applies, source: 'GRADE_RULE' };

  // Precedencia 3 — el modo declarado en el propio componente.
  return { applies: component.scopeMode === 'ALL_GRADES', source: 'DEFAULT_MODE' };
}

/** Azúcar booleano para los consumidores que sólo necesitan el sí/no. */
export function componentApplies(
  component: ScopedComponent,
  gradeId: string | null | undefined,
  subjectId: string | null | undefined,
  rules: ScopeRuleRow[],
): boolean {
  return resolveComponentScope(component, gradeId, subjectId, rules).applies;
}

/**
 * Filtra una lista de componentes a los que aplican a esa coordenada.
 * Es la forma en que lo consumen el cálculo anual y las proyecciones: se
 * descartan ANTES de ponderar, de modo que la fórmula de renormalización no
 * cambia y una fuente que no aplica nunca se convierte en 0.
 */
export function filterApplicableComponents<T extends ScopedComponent>(
  components: T[],
  gradeId: string | null | undefined,
  subjectId: string | null | undefined,
  rules: ScopeRuleRow[],
): T[] {
  if (!rules.length && components.every((c) => c.scopeMode === 'ALL_GRADES')) {
    return components; // atajo del caso mayoritario: nadie configuró nada
  }
  return components.filter((c) => componentApplies(c, gradeId, subjectId, rules));
}

/** Mensaje legible del motivo, para la UI y para los errores de captura. */
export function scopeReasonLabel(decision: ScopeDecision): string | null {
  if (decision.applies) return null;
  switch (decision.source) {
    case 'SUBJECT_RULE':
      return 'Esta asignatura no presenta esta evaluación.';
    case 'GRADE_RULE':
      return 'Este grado no presenta esta evaluación.';
    case 'DEFAULT_MODE':
      return 'Esta evaluación sólo aplica a los grados seleccionados.';
    default:
      return null;
  }
}
