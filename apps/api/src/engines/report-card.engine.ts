/**
 * REPORT CARD ENGINE (Pure Functions)
 *
 * Motor único de boletines adaptable al tipo de estructura académica.
 * Decide layout, cálculos y formato según:
 *   - InstitutionRulesContext (escala, niveles, config)
 *   - AcademicStructureType  (DIMENSIONS | SUBJECTS_ONLY | AREAS_SUBJECTS)
 *
 * NO depende del tipo de grado ni de un booleano.
 * Depende EXCLUSIVAMENTE de configuración institucional + nivel.
 *
 * Tres modos:
 *   DIMENSIONS     → Cualitativo (dimensiones, logros descriptivos, sin notas)
 *   SUBJECTS_ONLY  → Cuantitativo plano (asignaturas sin áreas)
 *   AREAS_SUBJECTS → Cuantitativo jerárquico (áreas → asignaturas)
 */

import type { InstitutionRulesContext, PerformanceLevelDef, QualitativeLevelDef } from './InstitutionRulesContext'
import type { AcademicStructureType, AcademicBehavior } from './AcademicStructure'
import { getAcademicBehavior } from './AcademicStructure'
import { isFailing, getPerformanceLevel } from './academic-rules.engine'

// ============================================================================
// TIPOS DE ENTRADA
// ============================================================================

/** Datos de una asignatura/dimensión con sus notas parciales ya calculadas */
export interface SubjectGradeInput {
  subjectId: string
  subjectName: string
  subjectCode: string | null
  teacherName: string | null
  teacherAssignmentId: string | null
  weightPercentage: number
  /** Nota numérica calculada (null si no hay datos o es cualitativo) */
  grade: number | null
  /** Componentes desglosados (Saber, Hacer, Ser, etc.) */
  components: ComponentGradeInput[]
  /** Logro textual (del módulo de logros) */
  achievement: string | null
  achievementObservation: string | null
  judgment: string | null
  /** Nivel cualitativo (para DIMENSIONS) */
  qualitativeLevel: string | null
  qualitativeObservation: string | null
}

export interface ComponentGradeInput {
  componentId: string
  name: string
  average: number | null
  percentage: number
}

export interface AreaInput {
  areaName: string
  areaCode: string | null
  weightPercentage: number
  calculationType: 'AVERAGE' | 'WEIGHTED' | 'INFORMATIVE'
  subjects: SubjectGradeInput[]
}

export interface AttendanceInput {
  total: number
  present: number
  absent: number
  late: number
  excused: number
  attendanceRate: number
}

export interface ObservationInput {
  date: Date | string
  type: string
  category: string
  description: string
  author: string
}

export interface StudentInput {
  id: string
  firstName: string
  lastName: string
  documentType: string | null
  documentNumber: string | null
}

export interface GroupInput {
  id: string
  name: string
  gradeLevel: string
}

export interface ReportCardInput {
  student: StudentInput
  group: GroupInput
  areas: AreaInput[]
  attendance: AttendanceInput
  achievements: any[]
  observations: ObservationInput[]
}

// ============================================================================
// TIPOS DE SALIDA
// ============================================================================

export type ReportCardMode = 'QUALITATIVE' | 'QUANTITATIVE_FLAT' | 'QUANTITATIVE_HIERARCHICAL'

/** Configuración de visualización decidida por el engine */
export interface ReportCardDisplayConfig {
  mode: ReportCardMode
  showNumericGrades: boolean
  showPerformanceLevel: boolean
  showAverages: boolean
  showAreaAverages: boolean
  showRanking: boolean
  showRecovery: boolean
  showQualitativeDescriptors: boolean
  showComponents: boolean
}

/** Resultado de una asignatura procesada */
export interface SubjectGradeResult {
  subjectName: string
  subjectCode: string | null
  teacherName: string | null
  grade: number | null
  performanceLevel: string | null
  performanceTier: string | null
  isFailing: boolean
  weightPercentage: number
  components: ComponentGradeInput[]
  // Logros
  achievement: string | null
  achievementObservation: string | null
  judgment: string | null
  // Cualitativo (DIMENSIONS)
  qualitativeLevel: string | null
  qualitativeObservation: string | null
}

/** Resultado de un área procesada */
export interface AreaGradeResult {
  area: string
  areaCode: string | null
  weightPercentage: number
  calculationType: string
  areaAverage: number | null
  areaPerformanceLevel: string | null
  subjects: SubjectGradeResult[]
}

/** Resultado completo del boletín */
export interface ReportCardResult {
  mode: ReportCardMode
  displayConfig: ReportCardDisplayConfig
  student: StudentInput
  group: GroupInput
  areaGrades: AreaGradeResult[]
  subjectGrades: SubjectGradeResult[]
  generalAverage: number | null
  generalPerformanceLevel: string | null
  totalSubjects: number
  approvedSubjects: number
  failedSubjects: number
  attendance: AttendanceInput
  observations: ObservationInput[]
  achievements: any[]
}

// ============================================================================
// FUNCIONES PRINCIPALES
// ============================================================================

/**
 * Determina el modo de boletín según la estructura académica.
 * Esta es la ÚNICA función que decide qué tipo de boletín generar.
 */
export function getReportCardMode(structure: AcademicStructureType): ReportCardMode {
  switch (structure) {
    case 'DIMENSIONS':
      return 'QUALITATIVE'
    case 'SUBJECTS_ONLY':
      return 'QUANTITATIVE_FLAT'
    case 'AREAS_SUBJECTS':
    default:
      return 'QUANTITATIVE_HIERARCHICAL'
  }
}

/**
 * Genera la configuración de visualización según estructura + comportamiento.
 * El frontend usa esto para decidir qué mostrar/ocultar.
 */
export function getDisplayConfig(
  structure: AcademicStructureType,
  showComponents = false,
): ReportCardDisplayConfig {
  const behavior = getAcademicBehavior(structure)
  const mode = getReportCardMode(structure)

  return {
    mode,
    showNumericGrades: behavior.usesNumericGrades,
    showPerformanceLevel: true, // Siempre disponible (cualitativo o cuantitativo)
    showAverages: behavior.usesAverages,
    showAreaAverages: behavior.usesAreaStructure,
    showRanking: behavior.usesRanking,
    showRecovery: behavior.supportsRecovery,
    showQualitativeDescriptors: behavior.usesQualitativeOnly,
    showComponents,
  }
}

/**
 * Genera el boletín completo para un estudiante.
 * Motor único — se adapta automáticamente al tipo de estructura.
 */
export function generateReportCard(
  input: ReportCardInput,
  ctx: InstitutionRulesContext,
  showComponents = false,
): ReportCardResult {
  const mode = getReportCardMode(ctx.academicStructure)
  const displayConfig = getDisplayConfig(ctx.academicStructure, showComponents)

  switch (mode) {
    case 'QUALITATIVE':
      return generateQualitativeReport(input, ctx, displayConfig)
    case 'QUANTITATIVE_FLAT':
      return generateQuantitativeFlat(input, ctx, displayConfig)
    case 'QUANTITATIVE_HIERARCHICAL':
      return generateQuantitativeHierarchical(input, ctx, displayConfig)
  }
}

// ============================================================================
// GENERADORES INTERNOS
// ============================================================================

/**
 * DIMENSIONS — Boletín cualitativo.
 * Sin notas numéricas, sin promedios, sin ranking.
 * Muestra dimensiones con descriptores cualitativos y observaciones.
 */
function generateQualitativeReport(
  input: ReportCardInput,
  ctx: InstitutionRulesContext,
  displayConfig: ReportCardDisplayConfig,
): ReportCardResult {
  const areaGrades: AreaGradeResult[] = input.areas.map(area => {
    const subjects: SubjectGradeResult[] = area.subjects.map(s => ({
      subjectName: s.subjectName,
      subjectCode: s.subjectCode,
      teacherName: s.teacherName,
      grade: null, // Sin nota numérica
      performanceLevel: resolveQualitativeLevel(s.qualitativeLevel, ctx),
      performanceTier: null,
      isFailing: false, // Preescolar no reprueba
      weightPercentage: s.weightPercentage,
      components: [],
      achievement: s.achievement,
      achievementObservation: s.achievementObservation,
      judgment: s.judgment,
      qualitativeLevel: s.qualitativeLevel,
      qualitativeObservation: s.qualitativeObservation,
    }))

    return {
      area: area.areaName,
      areaCode: area.areaCode,
      weightPercentage: area.weightPercentage,
      calculationType: area.calculationType,
      areaAverage: null, // Sin promedio
      areaPerformanceLevel: null,
      subjects,
    }
  })

  const subjectGrades = areaGrades.flatMap(a => a.subjects)

  return {
    mode: 'QUALITATIVE',
    displayConfig,
    student: input.student,
    group: input.group,
    areaGrades,
    subjectGrades,
    generalAverage: null,
    generalPerformanceLevel: null,
    totalSubjects: subjectGrades.length,
    approvedSubjects: subjectGrades.length, // Todos "aprobados" en preescolar
    failedSubjects: 0,
    attendance: input.attendance,
    observations: input.observations,
    achievements: input.achievements,
  }
}

/**
 * SUBJECTS_ONLY — Cuantitativo plano.
 * Notas numéricas, promedios, ranking. Sin agrupación por áreas.
 */
function generateQuantitativeFlat(
  input: ReportCardInput,
  ctx: InstitutionRulesContext,
  displayConfig: ReportCardDisplayConfig,
): ReportCardResult {
  // Aplanar todas las asignaturas (ignorar estructura de áreas)
  const allSubjects = input.areas.flatMap(a => a.subjects)

  const subjectGrades: SubjectGradeResult[] = allSubjects.map(s =>
    processQuantitativeSubject(s, ctx, displayConfig),
  )

  // Un solo "área" virtual que contiene todas las asignaturas
  const areaGrades: AreaGradeResult[] = [{
    area: 'Asignaturas',
    areaCode: null,
    weightPercentage: 100,
    calculationType: 'AVERAGE',
    areaAverage: calculateSimpleAverage(subjectGrades),
    areaPerformanceLevel: null,
    subjects: subjectGrades,
  }]

  const validGrades = subjectGrades.filter(s => s.grade !== null)
  const generalAverage = calculateSimpleAverage(subjectGrades)
  const generalPerf = generalAverage !== null ? getPerformanceLevel(generalAverage, ctx) : null

  return {
    mode: 'QUANTITATIVE_FLAT',
    displayConfig,
    student: input.student,
    group: input.group,
    areaGrades,
    subjectGrades,
    generalAverage,
    generalPerformanceLevel: generalPerf?.label || null,
    totalSubjects: subjectGrades.length,
    approvedSubjects: validGrades.filter(s => !s.isFailing).length,
    failedSubjects: validGrades.filter(s => s.isFailing).length,
    attendance: input.attendance,
    observations: input.observations,
    achievements: input.achievements,
  }
}

/**
 * AREAS_SUBJECTS — Cuantitativo jerárquico.
 * Áreas → Asignaturas → Nota → Promedio de área → Promedio general.
 */
function generateQuantitativeHierarchical(
  input: ReportCardInput,
  ctx: InstitutionRulesContext,
  displayConfig: ReportCardDisplayConfig,
): ReportCardResult {
  const areaGrades: AreaGradeResult[] = input.areas.map(area => {
    const subjects: SubjectGradeResult[] = area.subjects.map(s =>
      processQuantitativeSubject(s, ctx, displayConfig),
    )

    const areaAverage = calculateAreaAverage(subjects, area.calculationType)
    const areaPerf = areaAverage !== null ? getPerformanceLevel(areaAverage, ctx) : null

    return {
      area: area.areaName,
      areaCode: area.areaCode,
      weightPercentage: area.weightPercentage,
      calculationType: area.calculationType,
      areaAverage,
      areaPerformanceLevel: areaPerf?.label || null,
      subjects,
    }
  })

  const subjectGrades = areaGrades.flatMap(a => a.subjects)
  const countableSubjectGrades = areaGrades
    .filter(a => a.calculationType !== 'INFORMATIVE')
    .flatMap(a => a.subjects)

  const validGrades = countableSubjectGrades.filter(s => s.grade !== null)
  const generalAverage = calculateSimpleAverage(countableSubjectGrades)
  const generalPerf = generalAverage !== null ? getPerformanceLevel(generalAverage, ctx) : null

  return {
    mode: 'QUANTITATIVE_HIERARCHICAL',
    displayConfig,
    student: input.student,
    group: input.group,
    areaGrades,
    subjectGrades,
    generalAverage,
    generalPerformanceLevel: generalPerf?.label || null,
    totalSubjects: subjectGrades.length,
    approvedSubjects: validGrades.filter(s => !s.isFailing).length,
    failedSubjects: validGrades.filter(s => s.isFailing).length,
    attendance: input.attendance,
    observations: input.observations,
    achievements: input.achievements,
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function processQuantitativeSubject(
  s: SubjectGradeInput,
  ctx: InstitutionRulesContext,
  displayConfig: ReportCardDisplayConfig,
): SubjectGradeResult {
  const perf = s.grade !== null ? getPerformanceLevel(s.grade, ctx) : null

  return {
    subjectName: s.subjectName,
    subjectCode: s.subjectCode,
    teacherName: s.teacherName,
    grade: s.grade,
    performanceLevel: perf?.label || null,
    performanceTier: perf?.tier || null,
    isFailing: s.grade !== null ? isFailing(s.grade, ctx) : false,
    weightPercentage: s.weightPercentage,
    components: displayConfig.showComponents ? s.components : [],
    achievement: s.achievement,
    achievementObservation: s.achievementObservation,
    judgment: s.judgment,
    qualitativeLevel: null,
    qualitativeObservation: null,
  }
}

function resolveQualitativeLevel(
  levelCode: string | null,
  ctx: InstitutionRulesContext,
): string | null {
  if (!levelCode) return null
  if (ctx.qualitativeLevels.length > 0) {
    const found = ctx.qualitativeLevels.find(l => l.code === levelCode)
    if (found) return found.name
  }
  // Fallback: devolver el código tal cual
  return levelCode
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10
}

function calculateSimpleAverage(subjects: SubjectGradeResult[]): number | null {
  const valid = subjects.filter(s => s.grade !== null)
  if (valid.length === 0) return null
  return roundToOneDecimal(
    valid.reduce((sum, s) => sum + s.grade!, 0) / valid.length,
  )
}

function calculateAreaAverage(
  subjects: SubjectGradeResult[],
  calculationType: string,
): number | null {
  const valid = subjects.filter(s => s.grade !== null)
  if (valid.length === 0) return null

  if (calculationType === 'WEIGHTED') {
    const weightedSum = valid.reduce((acc, s) => acc + (s.grade! * s.weightPercentage), 0)
    const totalWeight = valid.reduce((acc, s) => acc + s.weightPercentage, 0)
    return totalWeight > 0 ? roundToOneDecimal(weightedSum / totalWeight) : null
  }

  if (calculationType === 'INFORMATIVE') {
    return null // Áreas informativas no tienen promedio
  }

  // AVERAGE (default)
  return roundToOneDecimal(
    valid.reduce((acc, s) => acc + s.grade!, 0) / valid.length,
  )
}

// ============================================================================
// RANKING
// ============================================================================

export interface RankedStudent {
  enrollmentId: string
  studentName: string
  generalAverage: number | null
  rank: number | null
}

/**
 * Genera ranking de estudiantes. Solo aplica si la estructura lo soporta.
 * Retorna null si el modo es QUALITATIVE.
 */
export function generateRanking(
  students: { enrollmentId: string; studentName: string; generalAverage: number | null }[],
  structure: AcademicStructureType,
): RankedStudent[] | null {
  const behavior = getAcademicBehavior(structure)
  if (!behavior.usesRanking) return null

  const withGrades = students
    .filter(s => s.generalAverage !== null)
    .sort((a, b) => b.generalAverage! - a.generalAverage!)

  let currentRank = 0
  let lastAvg: number | null = null

  return withGrades.map((s, idx) => {
    if (s.generalAverage !== lastAvg) {
      currentRank = idx + 1
      lastAvg = s.generalAverage
    }
    return { ...s, rank: currentRank }
  })
}
