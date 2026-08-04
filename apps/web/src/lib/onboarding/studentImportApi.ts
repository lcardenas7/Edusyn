import type { ApplyResult, ImportAnalysis } from '@edusyn/types';
import api from '../api';

/**
 * API de importación de estudiantes (Onboarding v2, §7).
 *
 * Funciones tipadas contra el contrato @edusyn/types. El cliente NO interpreta
 * las respuestas: las entrega tal cual a los componentes (AR2).
 *
 * Guardia de contrato (fail-loud, espejo de AR13): si el backend responde con
 * una forma anterior al contrato (StudentAnalysis/StudentApplyResult de
 * Módulo 3, sin summary/canApply/cuadre estándar), lanzamos un error claro en
 * vez de pintar datos corruptos o botones muertos. La validación de FORMA es
 * higiene de entrega; no es lógica de negocio.
 */

const MULTIPART = { headers: { 'Content-Type': undefined as unknown as string } };

function isImportAnalysis(data: unknown): data is ImportAnalysis {
  const d = data as Partial<ImportAnalysis> | null;
  return (
    !!d &&
    Array.isArray(d.summary) &&
    Array.isArray(d.issues) &&
    typeof d.canApply === 'boolean'
  );
}

function isApplyResult(data: unknown): data is ApplyResult {
  const d = data as Partial<ApplyResult> | null;
  return (
    !!d &&
    Array.isArray(d.summary) &&
    typeof d.created === 'number' &&
    typeof d.updated === 'number' &&
    typeof d.skipped === 'number' &&
    Array.isArray(d.errors) &&
    Array.isArray(d.warnings)
  );
}

export class ContractMismatchError extends Error {
  constructor(endpoint: string, expected: string) {
    super(
      `El backend respondió ${endpoint} en un formato que no cumple el contrato (${expected}). ` +
        'El módulo de importación del servidor debe adaptarse a @edusyn/types antes de usar esta pantalla.',
    );
    this.name = 'ContractMismatchError';
  }
}

/**
 * ANALYZE (I1, read-only): sube el Excel y devuelve el análisis del servidor.
 * multipart/form-data, campo estándar `file` (enmienda punto 9); el navegador
 * pone el Content-Type con boundary.
 */
export async function analyzeStudents(file: File): Promise<ImportAnalysis> {
  const body = new FormData();
  body.append('file', file);
  const { data } = await api.post('/onboarding/students/analyze', body, MULTIPART);
  if (!isImportAnalysis(data)) {
    throw new ContractMismatchError('POST /onboarding/students/analyze', 'ImportAnalysis');
  }
  return data;
}

/**
 * APPLY (I4/I5): aplica la importación. El backend re-parsa el mismo archivo
 * (idempotente) y requiere el academicYearId del año destino (DRAFT en
 * onboarding; el año "current" que resuelve el backend).
 */
export async function applyStudents(file: File, academicYearId: string): Promise<ApplyResult> {
  const body = new FormData();
  body.append('file', file);
  body.append('academicYearId', academicYearId);
  const { data } = await api.post('/onboarding/students/apply', body, MULTIPART);
  if (!isApplyResult(data)) {
    throw new ContractMismatchError('POST /onboarding/students/apply', 'ApplyResult');
  }
  return data;
}
