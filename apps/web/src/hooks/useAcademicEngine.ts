/**
 * HOOK: useAcademicEngine - FRONTEND (Solo previsualización y UX)
 * 
 * ⚠️ IMPORTANTE: Este hook es SOLO para:
 * - Previsualizar cálculos antes de guardar
 * - Validar UX (bloquear acciones inválidas)
 * - Mostrar niveles de desempeño en tiempo real
 * 
 * 📌 La FUENTE DE VERDAD está en el backend:
 * apps/api/src/engines/AcademicRulesEngine.ts
 * 
 * El backend:
 * - Calcula oficialmente
 * - Guarda en BD
 * - Decide promoción
 * - Genera resultados oficiales
 * 
 * USO:
 * const { previewGrade, validateGrade } = useGradePreview()
 * const preview = previewGrade(4.5, 'lvl-primaria')
 */

import { useMemo } from 'react'
import { useInstitution } from '../contexts/InstitutionContext'
import { AcademicRulesEngine, createAcademicEngine } from '../engines/AcademicRulesEngine'

export function useAcademicEngine(): AcademicRulesEngine {
  const { institution, gradingConfig, areaConfig, periods } = useInstitution()

  const engine = useMemo(() => {
    return createAcademicEngine(institution, gradingConfig, areaConfig, periods)
  }, [institution, gradingConfig, areaConfig, periods])

  return engine
}

/**
 * Hook para cálculos específicos de notas
 */
export function useGradeCalculations() {
  const engine = useAcademicEngine()

  return {
    // Calcular promedio de subproceso
    calculateSubprocessAverage: (grades: number[]) => 
      engine.calculateSubprocessAverage(grades),

    // Calcular promedio de proceso
    calculateProcessAverage: (subprocesses: { average: number; weight: number }[]) =>
      engine.calculateProcessAverage(subprocesses),

    // Calcular nota de período
    calculatePeriodGrade: (processes: { average: number; weight: number }[]) =>
      engine.calculatePeriodGrade(processes),

    // Calcular nota final de asignatura
    calculateSubjectFinalGrade: (periods: { grade: number; weight: number }[]) =>
      engine.calculateSubjectFinalGrade(periods),

    // Calcular promedio de área
    calculateAreaAverage: (
      subjects: { subjectId: string; grade: number; weight?: number }[],
      dominantSubjectId?: string
    ) => engine.calculateAreaAverage(subjects, dominantSubjectId),

    // Validar nota
    validateGrade: (grade: number, academicLevelId: string) =>
      engine.validateGrade(grade, academicLevelId),

    // Obtener rango de escala
    getScaleRange: (academicLevelId: string) =>
      engine.getScaleRange(academicLevelId),
  }
}

/**
 * Hook para verificar aprobación
 */
export function useApprovalRules() {
  const engine = useAcademicEngine()

  return {
    // ¿La nota aprueba?
    isGradeApproved: (grade: number, academicLevelId: string) =>
      engine.isGradeApproved(grade, academicLevelId),

    // ¿La asignatura aprueba?
    isSubjectApproved: (grade: number, academicLevelId: string) =>
      engine.isSubjectApproved(grade, academicLevelId),

    // ¿El área aprueba?
    isAreaApproved: (
      areaAverage: number,
      subjects: { grade: number; approved: boolean }[],
      academicLevelId: string
    ) => engine.isAreaApproved(areaAverage, subjects, academicLevelId),
  }
}

/**
 * Hook para niveles de desempeño
 */
export function usePerformanceLevels() {
  const engine = useAcademicEngine()

  return {
    // Obtener nivel de desempeño para nota numérica
    getPerformanceLevel: (grade: number, academicLevelId: string) =>
      engine.getPerformanceLevel(grade, academicLevelId),

    // Obtener nivel cualitativo
    getQualitativeLevel: (code: string, academicLevelId: string) =>
      engine.getQualitativeLevel(code, academicLevelId),
  }
}

/**
 * Hook para reglas de flujo
 */
export function useFlowRules() {
  const engine = useAcademicEngine()

  return {
    // ¿Se puede calificar en este período?
    canGradeInPeriod: (periodId: string, currentDate?: Date) =>
      engine.canGradeInPeriod(periodId, currentDate),

    // ¿Se puede recuperar esta asignatura?
    canRecoverSubject: (grade: number, academicLevelId: string, periodId: string) =>
      engine.canRecoverSubject(grade, academicLevelId, periodId),
  }
}

/**
 * Hook para alertas y promoción
 */
export function useAcademicAlerts() {
  const engine = useAcademicEngine()

  return {
    // Generar alertas para estudiante
    generateAlerts: engine.generateAlerts.bind(engine),

    // Determinar promoción
    determinePromotion: engine.determinePromotion.bind(engine),
  }
}

export default useAcademicEngine
