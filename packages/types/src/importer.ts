/**
 * @edusyn/types — Contrato del patrón Importador (§7 de la Constitución).
 *
 * Toda incorporación masiva de datos sigue:
 *   ANALYZE (read-only, I1) → VALIDACIÓN (I2) → RESUMEN (I3)
 *   → CONFIRMACIÓN humana (I4) → APPLY (idempotente y reanudable, I5)
 *   → RESULTADO (cuadre estándar, I6)
 *
 * Y el progreso DURANTE el apply viaja en `ImportState` (nunca calculado
 * por el cliente — UX4).
 */

import type { CanonicalState, SummaryFact } from './canonical-state.js';
import type { Issue } from './common.js';

/**
 * Respuesta de la fase ANALYZE (I1–I3).
 * Correrla mil veces no tiene efectos secundarios (I1).
 */
export interface ImportAnalysis {
  contractVersion: 1;
  /** Qué detectó e inferirá el sistema, antes de escribir (I3, P-PROD-3). */
  summary: SummaryFact[];
  /**
   * Hallazgos clasificados por severidad (I2):
   * 'blocking' (P0) impide el apply; 'warning' (P1) se destaca; 'info' (P2) informa.
   */
  issues: Issue[];
  /**
   * Si el apply puede ejecutarse. Lo decide el backend (hay P0, faltan
   * precondiciones I7…). El frontend NUNCA lo deduce de `issues` (AR2).
   */
  canApply: boolean;
  /** Por qué no se puede aplicar / qué lo desbloquea. Localizado (es). */
  blockedReason?: string;
}

/**
 * Fase de una operación de importación en curso.
 * Permite al cliente pintar el "durante" sin inventar estados.
 */
export type ImportPhase =
  /** ANALYZE corriendo en el servidor. */
  | 'analyzing'
  /** Resumen listo; esperando la confirmación humana (I4). */
  | 'awaiting_confirmation'
  /** APPLY escribiendo (idempotente y reanudable, I5). */
  | 'applying'
  /** Terminó; el cuadre está disponible (I6). */
  | 'done'
  /** Falló; ver `steps[].issues` y acciones de reintento. */
  | 'failed';

/**
 * Estado canónico de una importación (§5.2 `ImportState`).
 *
 * APPLY responde con el `operationId` (handle de la operación) y el progreso
 * EN VIVO se consulta vía este estado (polling o equivalente). El cliente
 * nunca simula progreso ni lo calcula: lo recibe (UX4, AR2).
 *
 * Como todo Estado Canónico, sirve para el diagnóstico, la reanudación
 * (UX3) y el cierre (E4).
 */
export interface ImportState extends CanonicalState {
  kind: 'import';
  /** Handle de la operación devuelto al iniciar analyze/apply. */
  operationId: string;
  /** Fase actual del proceso, calculada por el backend. */
  phase: ImportPhase;
  /** Cuadre final cuando `phase === 'done'`. */
  result?: ApplyResult;
  /**
   * Contador estructurado del lote en curso (ej. 1.200 de 1.500 filas).
   * Lo calcula el backend durante `analyzing`/`applying`; el cliente lo
   * muestra tal cual ("1.200 / 1.500") y NUNCA lo deriva de `progress`
   * ni de timers. Si el backend no puede conocer el total, omite el campo
   * y la UI cae al `progress` porcentual.
   */
  progressDetail?: {
    processed: number;
    total: number;
  };
}

/**
 * Cuadre estándar de RESULTADO (C3, I6).
 * TODA operación de importación/proceso masivo responde con esta forma.
 * Nada se aplica en silencio.
 */
export interface ApplyResult {
  contractVersion: 1;
  /** Resumen de lo aplicado, ya formateado para mostrar. */
  summary: SummaryFact[];
  created: number;
  updated: number;
  /** Filas omitidas por ya existir / no aplicar (idempotencia, AR4). */
  skipped: number;
  /** Errores por fila (AR5: una fila mala no tumba el lote). */
  errors: Issue[];
  warnings: Issue[];
}
