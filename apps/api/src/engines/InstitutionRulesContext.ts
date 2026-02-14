/**
 * INSTITUTION RULES CONTEXT
 * 
 * Interfaz central que define TODA la configuración institucional
 * necesaria para los motores de reglas.
 * 
 * FUENTE ÚNICA DE VERDAD para:
 * - Reglas académicas (escalas, aprobación, desempeño)
 * - Reglas de asistencia (mínimos, umbrales)
 * - Reglas de promoción (materias perdidas, asistencia mínima)
 * - Reglas de recuperación (nota máxima, elegibilidad)
 * - Estructura académica (DIMENSIONS, SUBJECTS_ONLY, AREAS_SUBJECTS)
 * 
 * NUNCA hardcodear valores. Todo viene de aquí.
 */

import type { AcademicStructureType } from './AcademicStructure'

// ============================================================================
// CONTEXTO PRINCIPAL
// ============================================================================

export interface InstitutionRulesContext {
  // ─── Escala de calificación ───
  minGradeValue: number           // Mínimo de la escala (ej: 1, 0)
  maxGradeValue: number           // Máximo de la escala (ej: 5, 10, 100)
  minPassingGrade: number         // Nota mínima aprobatoria (ej: 3.0, 6.0, 60)

  // ─── Estructura académica ───
  academicStructure: AcademicStructureType  // DIMENSIONS | SUBJECTS_ONLY | AREAS_SUBJECTS

  // ─── Promoción ───
  maxFailedSubjectsForPromotion: number     // Máx materias perdidas para promover (ej: 2)
  minAttendancePercentage: number           // % mínimo de asistencia para promover (ej: 80)

  // ─── Recuperación ───
  recoveryMaxScore: number                  // Nota máxima alcanzable en recuperación
  maxAreasRecoverable: number               // Máx áreas recuperables

  // ─── Niveles de desempeño (si configurados) ───
  performanceLevels: PerformanceLevelDef[]

  // ─── Niveles cualitativos (para DIMENSIONS) ───
  qualitativeLevels: QualitativeLevelDef[]
}

export interface PerformanceLevelDef {
  name: string
  code: string
  minScore: number
  maxScore: number
  order: number
  color: string
  isApproved: boolean
}

export interface QualitativeLevelDef {
  code: string
  name: string
  description: string
  color: string
  order: number
  isApproved: boolean
}

// ============================================================================
// DEFAULTS (solo si no hay configuración institucional)
// ============================================================================

export const DEFAULT_RULES_CONTEXT: InstitutionRulesContext = {
  minGradeValue: 1,
  maxGradeValue: 5,
  minPassingGrade: 3.0,
  academicStructure: 'AREAS_SUBJECTS',
  maxFailedSubjectsForPromotion: 2,
  minAttendancePercentage: 80,
  recoveryMaxScore: 3.0,
  maxAreasRecoverable: 2,
  performanceLevels: [],
  qualitativeLevels: [],
}
