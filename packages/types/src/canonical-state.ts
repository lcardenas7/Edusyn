/**
 * @edusyn/types — Estado Canónico (§5 de la Constitución, AR10).
 *
 * Un único recurso, calculado por el backend, que responde TODO lo que el
 * frontend necesita para pintar la experiencia sin calcular nada:
 * diagnóstico inicial, reanudación y cierre usan el mismo objeto (E4).
 *
 * Futuro endpoint de referencia: GET /onboarding/state → OnboardingState.
 */

import type { Action, Issue } from './common.js';

/**
 * Estado de un paso dentro de un proceso con ciclo de vida.
 * Lo calcula SIEMPRE el backend (E1). El frontend solo lo pinta.
 */
export type StepStatus =
  /** Bloqueado por precondiciones: ver `blockedBy`. */
  | 'locked'
  /** Disponible para ejecutarse ahora. */
  | 'available'
  /** En curso (incluye operaciones largas del lado del servidor). */
  | 'in_progress'
  /** Completado. */
  | 'done'
  /** Falló; ver `issues` y las acciones de reintento en `actions`. */
  | 'error';

/**
 * Precondición faltante de un paso (§5.3 `blockedBy`, I7, UX5).
 * El grafo de dependencias lo declara el backend; el cliente lo muestra.
 */
export interface BlockedBy {
  /** Key estable del paso/requisito del que depende (ej. 'academic-year'). */
  key: string;
  /** Explicación humana y accionable: qué falta y cómo resolverlo. Localizado (es). */
  message: string;
}

/**
 * Hecho ya resuelto por el sistema, para mostrar conteos sin que el cliente
 * calcule nada ("3 niveles · 42 grupos · 1.500 estudiantes").
 * El orden del arreglo ES el orden de presentación.
 */
export interface SummaryFact {
  /** Key estable del hecho (ej. 'students', 'groups'). */
  key: string;
  /** Etiqueta corta, localizada (es). */
  label: string;
  /** Valor ya formateado para mostrar (ej. '1.500'). El cliente no formatea. */
  value: string;
}

/** Paso de un Estado Canónico (§5.3). */
export interface CanonicalStep {
  /** Key estable y única dentro del proceso (ej. 'students-import'). */
  key: string;
  /** Nombre del paso para humanos, localizado (es). */
  label: string;
  /** Calculado por el backend (E1). */
  status: StepStatus;
  /** Precondiciones faltantes. Vacío si no hay bloqueo. */
  blockedBy: BlockedBy[];
  /** Conteos/hechos ya resueltos por este paso. */
  summary: SummaryFact[];
  /** Hallazgos del paso (errores, advertencias, sugerencias). */
  issues: Issue[];
  /** Qué se puede hacer AHORA (E2). Incluye acciones deshabilitadas con `reason`. */
  actions: Action[];
}

/**
 * Estado Canónico base (§5.3, AR10).
 *
 * Todo módulo con ciclo de vida expone una especialización de esta forma
 * (§5.2: OnboardingState, EnrollmentState, ImportState, WorkflowState,
 * GradingPeriodState, AcademicYearState…).
 */
export interface CanonicalState {
  /**
   * Versión del contrato de ESTE estado (C6, AR11). Empieza en 1.
   * Un cambio incompatible del shape incrementa la versión y se comunica
   * de forma explícita; nunca se rompe silenciosamente.
   */
  contractVersion: 1;
  /**
   * Progreso 0..100, PONDERADO (no lineal), calculado por el backend (E1).
   * El frontend lo muestra tal cual; nunca lo deriva de los pasos.
   */
  progress: number;
  /**
   * Key del paso que el sistema SUGIERE hacer ahora (E3: sugerir, no forzar).
   * El cliente puede destacarlo, pero nunca salta pasos automáticamente.
   */
  recommendedNext?: string;
  steps: CanonicalStep[];
}

/**
 * Estado canónico del Onboarding Institucional.
 * Respuesta de GET /onboarding/state (cuando exista).
 * Hoy el frontend lo obtiene de un adaptador intercambiable con esta misma forma.
 */
export interface OnboardingState extends CanonicalState {
  kind: 'onboarding';
}
