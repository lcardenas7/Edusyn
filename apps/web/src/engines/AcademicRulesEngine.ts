/**
 * ACADEMIC RULES ENGINE - FRONTEND (Previsualización)
 * 
 * ⚠️ Este es un ESPEJO del motor del backend para previsualización.
 * 
 * 📌 FUENTE DE VERDAD: apps/api/src/engines/AcademicRulesEngine.ts
 * 
 * Este archivo existe para:
 * - Previsualizar cálculos en tiempo real (UX)
 * - Validar entradas antes de enviar al backend
 * - Mostrar niveles de desempeño mientras el usuario escribe
 * 
 * El backend SIEMPRE recalcula y es quien guarda los resultados oficiales.
 */

import type { 
  InstitutionConfig, 
  GradingConfig, 
  AreaConfig,
  Period,
  PerformanceLevel,
  QualitativeLevel
} from '../contexts/InstitutionContext'

// ============================================================================
// TIPOS DE ENTRADA (Eventos Académicos)
// ============================================================================

export interface GradeInput {
  studentId: string
  subjectId: string
  areaId: string
  periodId: string
  processId: string
  subprocessId?: string
  value: number | string // Numérico o cualitativo
  academicLevelId: string
}

export interface SubjectGrades {
  subjectId: string
  subjectName: string
  areaId: string
  periodGrades: {
    periodId: string
    processes: {
      processId: string
      processName: string
      weight: number
      subprocesses: {
        subprocessId: string
        subprocessName: string
        weight: number
        grades: number[]
        average: number
      }[]
      average: number
    }[]
    finalGrade: number
  }[]
  finalGrade: number
}

export interface AreaGrades {
  areaId: string
  areaName: string
  subjects: SubjectGrades[]
  periodGrades: {
    periodId: string
    average: number
    approved: boolean
  }[]
  finalGrade: number
  approved: boolean
}

// ============================================================================
// TIPOS DE SALIDA (Resultados)
// ============================================================================

export interface GradeResult {
  value: number
  performanceLevel: PerformanceLevel | null
  qualitativeLevel: QualitativeLevel | null
  approved: boolean
  alerts: Alert[]
}

export interface SubjectResult {
  subjectId: string
  subjectName: string
  periodResults: {
    periodId: string
    grade: number
    performanceLevel: PerformanceLevel | null
    approved: boolean
    canRecover: boolean
    recoveryDeadline?: string
  }[]
  finalGrade: number
  finalPerformanceLevel: PerformanceLevel | null
  approved: boolean
  affectsPromotion: boolean
  alerts: Alert[]
}

export interface AreaResult {
  areaId: string
  areaName: string
  subjects: SubjectResult[]
  periodResults: {
    periodId: string
    average: number
    approved: boolean
  }[]
  finalGrade: number
  approved: boolean
  dominantSubjectApplied: boolean
  affectsPromotion: boolean
  alerts: Alert[]
}

export interface StudentAcademicResult {
  studentId: string
  academicLevelId: string
  gradeLevel: string
  areas: AreaResult[]
  generalAverage: number
  promoted: boolean
  promotionStatus: 'PROMOTED' | 'NOT_PROMOTED' | 'PENDING' | 'IN_RECOVERY'
  alerts: Alert[]
  canGenerateReport: boolean
  reportBlockedReasons: string[]
}

export interface Alert {
  type: 'WARNING' | 'ERROR' | 'INFO'
  code: string
  message: string
  affectedEntity: 'STUDENT' | 'SUBJECT' | 'AREA' | 'PERIOD'
  entityId: string
}

// ============================================================================
// REGLAS DE CÁLCULO
// ============================================================================

export interface CalculationRules {
  // Cómo calcular promedio de subprocesos
  calculateSubprocessAverage: (grades: number[]) => number
  
  // Cómo calcular promedio de proceso (con subprocesos ponderados)
  calculateProcessAverage: (subprocesses: { average: number; weight: number }[]) => number
  
  // Cómo calcular nota final de período (procesos ponderados)
  calculatePeriodGrade: (processes: { average: number; weight: number }[]) => number
  
  // Cómo calcular nota final de asignatura (períodos ponderados)
  calculateSubjectFinalGrade: (periods: { grade: number; weight: number }[]) => number
  
  // Cómo calcular promedio de área
  calculateAreaAverage: (subjects: { grade: number; weight?: number; isDominant?: boolean }[], config: AreaConfig) => number
  
  // Cómo aplicar dominancia de asignatura
  applyDominantSubject: (subjects: SubjectResult[], dominantSubjectId: string) => number
}

// ============================================================================
// REGLAS DE FLUJO
// ============================================================================

export interface FlowRules {
  // ¿Se puede calificar en este período?
  canGradeInPeriod: (periodId: string, currentDate: Date, periods: Period[], gradingWindows: GradingWindow[]) => FlowResult
  
  // ¿Se puede recuperar esta asignatura?
  canRecoverSubject: (subjectResult: SubjectResult, periodId: string, recoveryWindows: RecoveryWindow[]) => FlowResult
  
  // ¿Está bloqueada la calificación?
  isGradingBlocked: (subjectId: string, periodId: string, blockRules: BlockRule[]) => FlowResult
  
  // ¿Se puede generar boletín?
  canGenerateReport: (studentResult: StudentAcademicResult, periodId: string) => FlowResult
  
  // ¿Se puede cerrar período?
  canClosePeriod: (periodId: string, allStudentsResults: StudentAcademicResult[]) => FlowResult
}

export interface FlowResult {
  allowed: boolean
  reason?: string
  blockedUntil?: Date
}

export interface GradingWindow {
  id: string
  periodId: string
  startDate: string
  endDate: string
  isOpen: boolean
}

export interface RecoveryWindow {
  id: string
  periodId: string
  startDate: string
  endDate: string
  maxAttempts: number
  isOpen: boolean
}

export interface BlockRule {
  id: string
  subjectId?: string
  periodId?: string
  reason: string
  blockedUntil?: string
}

// ============================================================================
// REGLAS DE IMPACTO
// ============================================================================

export interface ImpactRules {
  // ¿Afecta al boletín?
  affectsReport: (result: GradeResult, config: InstitutionConfig) => boolean
  
  // ¿Afecta la promoción?
  affectsPromotion: (subjectResult: SubjectResult, areaConfig: AreaConfig) => boolean
  
  // ¿Genera alertas?
  generateAlerts: (studentResult: StudentAcademicResult, config: InstitutionConfig) => Alert[]
  
  // ¿Requiere recuperación?
  requiresRecovery: (subjectResult: SubjectResult, areaConfig: AreaConfig) => boolean
}

// ============================================================================
// ACADEMIC RULES ENGINE - IMPLEMENTACIÓN
// ============================================================================

export class AcademicRulesEngine {
  private config: InstitutionConfig
  private gradingConfig: GradingConfig
  private areaConfig: AreaConfig
  private periods: Period[]

  constructor(
    config: InstitutionConfig,
    gradingConfig: GradingConfig,
    areaConfig: AreaConfig,
    periods: Period[]
  ) {
    this.config = config
    this.gradingConfig = gradingConfig
    this.areaConfig = areaConfig
    this.periods = periods
  }

  // ==========================================================================
  // REGLAS DE CÁLCULO
  // ==========================================================================

  /**
   * Calcula el promedio de un conjunto de notas (subproceso)
   */
  calculateSubprocessAverage(grades: number[]): number {
    if (grades.length === 0) return 0
    const sum = grades.reduce((acc, g) => acc + g, 0)
    return this.roundGrade(sum / grades.length)
  }

  /**
   * Calcula el promedio ponderado de subprocesos dentro de un proceso
   */
  calculateProcessAverage(subprocesses: { average: number; weight: number }[]): number {
    if (subprocesses.length === 0) return 0
    const totalWeight = subprocesses.reduce((acc, s) => acc + s.weight, 0)
    if (totalWeight === 0) return 0
    const weightedSum = subprocesses.reduce((acc, s) => acc + (s.average * s.weight), 0)
    return this.roundGrade(weightedSum / totalWeight)
  }

  /**
   * Calcula la nota final del período basada en procesos ponderados
   */
  calculatePeriodGrade(processes: { average: number; weight: number }[]): number {
    if (processes.length === 0) return 0
    const totalWeight = processes.reduce((acc, p) => acc + p.weight, 0)
    if (totalWeight === 0) return 0
    const weightedSum = processes.reduce((acc, p) => acc + (p.average * p.weight), 0)
    return this.roundGrade(weightedSum / totalWeight)
  }

  /**
   * Calcula la nota final de asignatura basada en períodos ponderados
   */
  calculateSubjectFinalGrade(periodGrades: { grade: number; weight: number }[]): number {
    if (periodGrades.length === 0) return 0
    const totalWeight = periodGrades.reduce((acc, p) => acc + p.weight, 0)
    if (totalWeight === 0) return 0
    const weightedSum = periodGrades.reduce((acc, p) => acc + (p.grade * p.weight), 0)
    return this.roundGrade(weightedSum / totalWeight)
  }

  /**
   * Calcula el promedio de área según configuración
   */
  calculateAreaAverage(
    subjects: { subjectId: string; grade: number; weight?: number; isDominant?: boolean }[],
    dominantSubjectId?: string
  ): number {
    if (subjects.length === 0) return 0

    // Si el área es INFORMATIVA o FORMATIVA, solo calcular promedio simple
    if (this.areaConfig.areaType === 'INFORMATIVE' || this.areaConfig.areaType === 'FORMATIVE') {
      return this.roundGrade(
        subjects.reduce((acc, s) => acc + s.grade, 0) / subjects.length
      )
    }

    // Si hay asignatura dominante configurada
    if (dominantSubjectId && this.areaConfig.calculationMethod === 'DOMINANT') {
      const dominant = subjects.find(s => s.subjectId === dominantSubjectId)
      if (dominant) {
        return dominant.grade
      }
    }

    // Cálculo según método configurado (solo para áreas EVALUABLE)
    switch (this.areaConfig.calculationMethod) {
      case 'AVERAGE':
        return this.roundGrade(
          subjects.reduce((acc, s) => acc + s.grade, 0) / subjects.length
        )
      
      case 'WEIGHTED': {
        const totalWeight = subjects.reduce((acc, s) => acc + (s.weight || 1), 0)
        const weightedSum = subjects.reduce((acc, s) => acc + (s.grade * (s.weight || 1)), 0)
        return this.roundGrade(weightedSum / totalWeight)
      }
      
      case 'DOMINANT':
        // Si no hay dominante específico, usar promedio simple
        return this.roundGrade(
          subjects.reduce((acc, s) => acc + s.grade, 0) / subjects.length
        )
      
      default:
        return this.roundGrade(
          subjects.reduce((acc, s) => acc + s.grade, 0) / subjects.length
        )
    }
  }

  // ==========================================================================
  // REGLAS DE APROBACIÓN
  // ==========================================================================

  /**
   * Determina si una nota aprueba según el nivel académico
   */
  isGradeApproved(grade: number, academicLevelId: string): boolean {
    const level = this.config.academicLevels.find(l => l.id === academicLevelId)
    if (!level) return grade >= this.gradingConfig.minPassingGrade

    // Para escalas numéricas, usar minPassingGrade del nivel
    if (level.gradingScaleType.startsWith('NUMERIC')) {
      return grade >= (level.minPassingGrade || this.gradingConfig.minPassingGrade)
    }

    // Para escalas cualitativas, verificar si el nivel cualitativo aprueba
    // (esto se maneja por separado con getQualitativeLevel)
    return true
  }

  /**
   * Determina si una asignatura aprueba según reglas de área
   */
  isSubjectApproved(subjectGrade: number, academicLevelId: string): boolean {
    return this.isGradeApproved(subjectGrade, academicLevelId)
  }

  /**
   * Determina si un área aprueba según configuración
   */
  isAreaApproved(
    areaAverage: number,
    subjects: { grade: number; approved: boolean }[],
    academicLevelId: string
  ): boolean {
    // Si está configurado que falla si alguna asignatura falla
    if (this.areaConfig.failIfAnySubjectFails) {
      const anyFailed = subjects.some(s => !s.approved)
      if (anyFailed) return false
    }

    // Si el área no es EVALUABLE, siempre aprueba (no afecta promoción)
    if (this.areaConfig.areaType !== 'EVALUABLE') {
      return true
    }

    // Según criterio de aprobación
    switch (this.areaConfig.approvalCriteria) {
      case 'AREA_AVERAGE':
        return this.isGradeApproved(areaAverage, academicLevelId)
      
      case 'ALL_SUBJECTS':
        return subjects.every(s => s.approved)
      
      case 'DOMINANT_SUBJECT':
        // Si hay asignatura dominante, verificar si aprueba
        return subjects.some(s => s.approved)
      
      default:
        return this.isGradeApproved(areaAverage, academicLevelId)
    }
  }

  // ==========================================================================
  // NIVELES DE DESEMPEÑO
  // ==========================================================================

  /**
   * Obtiene el nivel de desempeño para una nota numérica
   */
  getPerformanceLevel(grade: number, academicLevelId: string): PerformanceLevel | null {
    const level = this.config.academicLevels.find(l => l.id === academicLevelId)
    if (!level || !level.performanceLevels) return null

    // Ordenar por minScore descendente para encontrar el nivel correcto
    const sortedLevels = [...level.performanceLevels].sort((a, b) => b.minScore - a.minScore)
    
    for (const perfLevel of sortedLevels) {
      if (grade >= perfLevel.minScore && grade <= perfLevel.maxScore) {
        return perfLevel
      }
    }

    // Si no encuentra, retornar el nivel más bajo
    return sortedLevels[sortedLevels.length - 1] || null
  }

  /**
   * Obtiene el nivel cualitativo para una nota cualitativa
   */
  getQualitativeLevel(code: string, academicLevelId: string): QualitativeLevel | null {
    const level = this.config.academicLevels.find(l => l.id === academicLevelId)
    if (!level || !level.qualitativeLevels) return null

    return level.qualitativeLevels.find(ql => ql.code === code) || null
  }

  // ==========================================================================
  // REGLAS DE FLUJO
  // ==========================================================================

  /**
   * Verifica si se puede calificar en un período
   */
  canGradeInPeriod(periodId: string, currentDate: Date = new Date()): FlowResult {
    const period = this.periods.find(p => p.id === periodId)
    if (!period) {
      return { allowed: false, reason: 'Período no encontrado' }
    }

    const startDate = new Date(period.startDate)
    const periodEndDate = new Date(period.endDate)

    if (currentDate < startDate) {
      return { 
        allowed: false, 
        reason: 'El período aún no ha iniciado',
        blockedUntil: startDate
      }
    }

    if (currentDate > periodEndDate) {
      return { 
        allowed: false, 
        reason: 'El período ya finalizó'
      }
    }

    // Por ahora permitir calificar si estamos dentro del período
    // Las ventanas de calificación se verifican por separado
    return { allowed: true }
  }

  /**
   * Verifica si una asignatura REQUIERE recuperación según la configuración del área
   * 
   * CRITERIOS DE APROBACIÓN:
   * - AREA_AVERAGE: Aprueba si promedio del área ≥ nota mínima
   * - ALL_SUBJECTS: Aprueba si TODAS las asignaturas ≥ nota mínima
   * - DOMINANT_SUBJECT: Aprueba si la asignatura dominante ≥ nota mínima
   * 
   * CHECKBOX "Pierde el área si cualquier asignatura está perdida":
   * - Si está marcado, aunque el promedio pase, si hay una asignatura perdida SÍ debe recuperar
   * 
   * TIPOS DE RECUPERACIÓN:
   * - BY_SUBJECT: Recupera solo las asignaturas perdidas
   * - FULL_AREA: Debe recuperar toda el área completa
   * - CONDITIONAL: Según comité de evaluación
   * - NONE: No permite recuperación
   */
  requiresRecovery(
    subjectGrade: number,
    subjectIsDominant: boolean,
    areaAverage: number,
    allSubjects: { grade: number; approved: boolean; isDominant: boolean }[],
    academicLevelId: string
  ): { required: boolean; reason: string; recoveryType: string } {
    const subjectApproved = this.isGradeApproved(subjectGrade, academicLevelId)
    
    // Si la asignatura ya está aprobada, no requiere recuperación
    if (subjectApproved) {
      return { required: false, reason: 'La asignatura ya está aprobada', recoveryType: 'NONE' }
    }

    // Si el área no es EVALUABLE, no afecta promoción
    if (this.areaConfig.areaType !== 'EVALUABLE') {
      return { required: false, reason: 'El área no afecta promoción', recoveryType: 'NONE' }
    }

    // Si no permite recuperación
    if (this.areaConfig.recoveryType === 'NONE') {
      return { required: false, reason: 'Esta área no permite recuperación', recoveryType: 'NONE' }
    }

    const recoveryType = this.areaConfig.recoveryType

    // ═══════════════════════════════════════════════════════════════════════════
    // CASO ESPECIAL: "Pierde el área si cualquier asignatura está perdida"
    // ═══════════════════════════════════════════════════════════════════════════
    // Si está marcado, SIEMPRE debe recuperar la asignatura perdida, sin importar el promedio
    if (this.areaConfig.failIfAnySubjectFails) {
      return { 
        required: true, 
        reason: 'Configuración: pierde el área si cualquier asignatura está perdida',
        recoveryType
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VERIFICAR SEGÚN CRITERIO DE APROBACIÓN DEL ÁREA
    // ═══════════════════════════════════════════════════════════════════════════
    switch (this.areaConfig.approvalCriteria) {
      case 'AREA_AVERAGE': {
        // Si el promedio del área aprueba, NO se requiere recuperación
        const areaApproved = this.isGradeApproved(areaAverage, academicLevelId)
        if (areaApproved) {
          return { required: false, reason: 'El área aprueba por promedio, no requiere recuperación', recoveryType: 'NONE' }
        }
        // Si el área no aprueba, sí requiere recuperación
        return { required: true, reason: 'El promedio del área no alcanza la nota mínima', recoveryType }
      }
      
      case 'ALL_SUBJECTS':
        // TODAS las asignaturas deben aprobar, así que sí requiere recuperación
        return { required: true, reason: 'Todas las asignaturas deben estar aprobadas', recoveryType }
      
      case 'DOMINANT_SUBJECT': {
        // Solo importa si la asignatura dominante aprueba
        if (subjectIsDominant) {
          return { required: true, reason: 'La asignatura dominante debe aprobar', recoveryType }
        }
        // Si no es dominante, verificar si la dominante ya aprueba
        const dominantSubject = allSubjects.find(s => s.isDominant)
        if (dominantSubject && dominantSubject.approved) {
          return { required: false, reason: 'La asignatura dominante ya aprueba, esta no afecta', recoveryType: 'NONE' }
        }
        // Si la dominante no aprueba, esta asignatura no importa
        return { required: false, reason: 'Solo importa la asignatura dominante', recoveryType: 'NONE' }
      }
      
      default:
        return { required: true, reason: 'Asignatura reprobada', recoveryType }
    }
  }

  /**
   * Verifica si una asignatura puede entrar en recuperación (reglas de flujo)
   * Nota: Use requiresRecovery() para determinar si DEBE recuperar
   */
  canRecoverSubject(
    subjectGrade: number,
    academicLevelId: string,
    _periodId: string
  ): FlowResult {
    // Solo puede recuperar si no aprobó
    if (this.isGradeApproved(subjectGrade, academicLevelId)) {
      return { allowed: false, reason: 'La asignatura ya está aprobada' }
    }

    // Verificar tipo de recuperación del área
    switch (this.areaConfig.recoveryType) {
      case 'BY_SUBJECT':
        return { allowed: true }
      
      case 'FULL_AREA':
        return { 
          allowed: true, 
          reason: 'Debe recuperar todas las asignaturas del área' 
        }
      
      case 'CONDITIONAL':
        return { allowed: true, reason: 'Sujeto a condiciones del comité' }
      
      case 'NONE':
        return { allowed: false, reason: 'Esta área no permite recuperación' }
      
      default:
        return { allowed: true }
    }
  }

  // ==========================================================================
  // REGLAS DE IMPACTO
  // ==========================================================================

  /**
   * Genera alertas para un estudiante
   */
  generateAlerts(
    _studentId: string,
    areas: AreaResult[]
  ): Alert[] {
    const alerts: Alert[] = []

    for (const area of areas) {
      // Alerta si área no aprobada
      if (!area.approved) {
        alerts.push({
          type: 'WARNING',
          code: 'AREA_NOT_APPROVED',
          message: `Área "${area.areaName}" no aprobada`,
          affectedEntity: 'AREA',
          entityId: area.areaId
        })
      }

      // Alertas por asignaturas
      for (const subject of area.subjects) {
        if (!subject.approved) {
          alerts.push({
            type: 'WARNING',
            code: 'SUBJECT_NOT_APPROVED',
            message: `Asignatura "${subject.subjectName}" no aprobada`,
            affectedEntity: 'SUBJECT',
            entityId: subject.subjectId
          })
        }

        // Alerta si está en nivel bajo
        if (subject.finalPerformanceLevel && !subject.finalPerformanceLevel.isApproved) {
          alerts.push({
            type: 'ERROR',
            code: 'LOW_PERFORMANCE',
            message: `"${subject.subjectName}" en nivel ${subject.finalPerformanceLevel.name}`,
            affectedEntity: 'SUBJECT',
            entityId: subject.subjectId
          })
        }
      }
    }

    return alerts
  }

  /**
   * Determina si un estudiante es promovido
   */
  determinePromotion(areas: AreaResult[]): {
    promoted: boolean
    status: 'PROMOTED' | 'NOT_PROMOTED' | 'PENDING' | 'IN_RECOVERY'
    reasons: string[]
  } {
    const failedAreas = areas.filter(a => !a.approved)
    const areasInRecovery = areas.filter(a => 
      a.subjects.some(s => s.periodResults.some(p => p.canRecover))
    )

    if (areasInRecovery.length > 0) {
      return {
        promoted: false,
        status: 'IN_RECOVERY',
        reasons: [`${areasInRecovery.length} área(s) en proceso de recuperación`]
      }
    }

    if (failedAreas.length === 0) {
      return {
        promoted: true,
        status: 'PROMOTED',
        reasons: []
      }
    }

    // Regla: máximo 2 áreas reprobadas para promoción condicional
    // (esto debería ser configurable)
    if (failedAreas.length <= 2) {
      return {
        promoted: false,
        status: 'PENDING',
        reasons: failedAreas.map(a => `Área "${a.areaName}" no aprobada`)
      }
    }

    return {
      promoted: false,
      status: 'NOT_PROMOTED',
      reasons: failedAreas.map(a => `Área "${a.areaName}" no aprobada`)
    }
  }

  // ==========================================================================
  // UTILIDADES
  // ==========================================================================

  /**
   * Redondea una nota según configuración
   */
  private roundGrade(grade: number): number {
    // Redondear a 1 decimal
    return Math.round(grade * 10) / 10
  }

  /**
   * Obtiene la escala del nivel académico
   */
  getScaleRange(academicLevelId: string): { min: number; max: number } {
    const level = this.config.academicLevels.find(l => l.id === academicLevelId)
    if (!level) return { min: 1, max: 5 }

    switch (level.gradingScaleType) {
      case 'NUMERIC_1_5':
        return { min: 1, max: 5 }
      case 'NUMERIC_1_10':
        return { min: 1, max: 10 }
      case 'NUMERIC_0_100':
        return { min: 0, max: 100 }
      default:
        return { min: level.minGrade || 1, max: level.maxGrade || 5 }
    }
  }

  /**
   * Valida que una nota esté dentro del rango permitido
   */
  validateGrade(grade: number, academicLevelId: string): { valid: boolean; error?: string } {
    const range = this.getScaleRange(academicLevelId)
    
    if (grade < range.min || grade > range.max) {
      return {
        valid: false,
        error: `La nota debe estar entre ${range.min} y ${range.max}`
      }
    }

    return { valid: true }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createAcademicEngine(
  config: InstitutionConfig,
  gradingConfig: GradingConfig,
  areaConfig: AreaConfig,
  periods: Period[]
): AcademicRulesEngine {
  return new AcademicRulesEngine(config, gradingConfig, areaConfig, periods)
}

// ============================================================================
// HOOK PARA USO EN COMPONENTES
// ============================================================================

