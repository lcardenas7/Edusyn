/**
 * @edusyn/types — Contratos tipados backend/frontend de Edusyn.
 *
 * Formaliza en TypeScript:
 *  - §4.3 C4  Errores como datos (Issue, Severity)
 *  - §5       Estado Canónico (CanonicalState, OnboardingState)
 *  - §7       Patrón Importador (ImportAnalysis, ImportState, ApplyResult)
 *
 * Paquete TYPE-ONLY: no emite runtime. Importar siempre con `import type`.
 * Ver README.md para las decisiones del contrato y su trazabilidad a la
 * Constitución (docs/EDUSYN_PRODUCT_ARCHITECTURE.md).
 */

export type {
  Severity,
  IssueLocation,
  Issue,
  ActionVariant,
  ActionIntent,
  Action,
} from './common.js';

export type {
  StepStatus,
  BlockedBy,
  SummaryFact,
  CanonicalStep,
  CanonicalState,
  OnboardingState,
} from './canonical-state.js';

export type {
  ImportAnalysis,
  ImportPhase,
  ImportState,
  ApplyResult,
} from './importer.js';
