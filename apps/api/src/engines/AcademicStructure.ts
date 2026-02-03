/**
 * ACADEMIC STRUCTURE ENGINE
 * 
 * Define el comportamiento del sistema según la estructura académica del grado.
 * Esta es la FUENTE DE VERDAD para determinar qué funcionalidades aplican.
 * 
 * PRINCIPIO CLAVE:
 * "El sistema está modelado sobre la Estructura Académica del Grado,
 *  no sobre la entidad Asignatura."
 */

// ============================================================================
// TIPOS
// ============================================================================

export type AcademicStructureType = 'DIMENSIONS' | 'SUBJECTS_ONLY' | 'AREAS_SUBJECTS'

export interface AcademicBehavior {
  // Calificaciones
  usesNumericGrades: boolean      // ¿Usa notas numéricas (1-5)?
  usesQualitativeOnly: boolean    // ¿Solo evaluación cualitativa?
  
  // Promedios y rankings
  usesAverages: boolean           // ¿Calcula promedios?
  usesRanking: boolean            // ¿Genera puestos/ranking?
  
  // Ponderaciones
  usesWeightPercentages: boolean  // ¿Usa porcentajes de área?
  usesAreaStructure: boolean      // ¿Agrupa asignaturas en áreas?
  
  // Reportes
  supportsMinGradeReport: boolean // ¿Soporta reporte de nota mínima?
  supportsRecovery: boolean       // ¿Soporta recuperaciones?
  
  // Boletines
  qualitativeReportCard: boolean  // ¿Boletín cualitativo automático?
}

// ============================================================================
// FUNCIÓN PRINCIPAL - ÚNICA FUENTE DE VERDAD
// ============================================================================

/**
 * Obtiene el comportamiento del sistema según la estructura académica.
 * NO se guarda en BD - se calcula siempre desde el enum.
 */
export function getAcademicBehavior(type: AcademicStructureType): AcademicBehavior {
  switch (type) {
    case 'DIMENSIONS':
      // Preescolar: Evaluación cualitativa por dimensiones del desarrollo
      return {
        usesNumericGrades: false,
        usesQualitativeOnly: true,
        usesAverages: false,
        usesRanking: false,
        usesWeightPercentages: false,
        usesAreaStructure: false,
        supportsMinGradeReport: false,
        supportsRecovery: false,
        qualitativeReportCard: true,
      }
    
    case 'SUBJECTS_ONLY':
      // Asignaturas simples sin áreas (primaria baja opcional)
      return {
        usesNumericGrades: true,
        usesQualitativeOnly: false,
        usesAverages: true,
        usesRanking: true,
        usesWeightPercentages: false,  // Sin ponderación por áreas
        usesAreaStructure: false,
        supportsMinGradeReport: true,
        supportsRecovery: true,
        qualitativeReportCard: false,
      }
    
    case 'AREAS_SUBJECTS':
    default:
      // Modelo tradicional: Áreas con asignaturas ponderadas
      return {
        usesNumericGrades: true,
        usesQualitativeOnly: false,
        usesAverages: true,
        usesRanking: true,
        usesWeightPercentages: true,
        usesAreaStructure: true,
        supportsMinGradeReport: true,
        supportsRecovery: true,
        qualitativeReportCard: false,
      }
  }
}

// ============================================================================
// LABELS PARA UI
// ============================================================================

export const structureLabels: Record<AcademicStructureType, { 
  name: string
  description: string
  icon: string
  examples: string[]
}> = {
  DIMENSIONS: {
    name: 'Dimensiones del desarrollo',
    description: 'Evaluación cualitativa sin notas numéricas. Ideal para educación inicial.',
    icon: '🎨',
    examples: ['Transición', 'Jardín', 'Pre-jardín']
  },
  SUBJECTS_ONLY: {
    name: 'Asignaturas simples',
    description: 'Notas numéricas sin ponderación por áreas. Estructura simplificada.',
    icon: '📚',
    examples: ['Primero', 'Segundo', 'Tercero']
  },
  AREAS_SUBJECTS: {
    name: 'Áreas con asignaturas',
    description: 'Modelo tradicional con áreas que agrupan asignaturas y ponderaciones.',
    icon: '📊',
    examples: ['Cuarto a Once', 'Media técnica']
  }
}

// ============================================================================
// DIMENSIONES ESTÁNDAR (Catálogo base)
// ============================================================================

export const standardDimensions = [
  {
    name: 'Dimensión Cognitiva',
    code: 'COG',
    description: 'Desarrollo del pensamiento lógico, resolución de problemas y construcción de conocimiento.',
    order: 1
  },
  {
    name: 'Dimensión Comunicativa',
    code: 'COM',
    description: 'Desarrollo del lenguaje oral, escrito, gestual y expresión de ideas.',
    order: 2
  },
  {
    name: 'Dimensión Corporal',
    code: 'COR',
    description: 'Desarrollo de habilidades motrices, coordinación y conciencia corporal.',
    order: 3
  },
  {
    name: 'Dimensión Socioafectiva',
    code: 'SOC',
    description: 'Desarrollo emocional, relaciones interpersonales y autoestima.',
    order: 4
  },
  {
    name: 'Dimensión Estética',
    code: 'EST',
    description: 'Desarrollo de la sensibilidad artística, creatividad y apreciación estética.',
    order: 5
  },
  {
    name: 'Dimensión Ética',
    code: 'ETI',
    description: 'Desarrollo de valores, normas de convivencia y responsabilidad.',
    order: 6
  },
  {
    name: 'Dimensión Espiritual',
    code: 'ESP',
    description: 'Desarrollo de la trascendencia, sentido de vida y valores espirituales.',
    order: 7
  }
]

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Determina la estructura académica sugerida según el stage del grado
 */
export function suggestStructureByStage(stage: string): AcademicStructureType {
  switch (stage) {
    case 'PREESCOLAR':
      return 'DIMENSIONS'
    case 'PRIMARIA':
      return 'SUBJECTS_ONLY' // Puede cambiarse a AREAS_SUBJECTS si la institución lo prefiere
    case 'SECUNDARIA':
    case 'MEDIA':
    case 'MEDIA_TECNICA':
    default:
      return 'AREAS_SUBJECTS'
  }
}

/**
 * Valida si un reporte está disponible para una estructura académica
 */
export function isReportAvailable(
  reportId: string, 
  structureType: AcademicStructureType
): boolean {
  const behavior = getAcademicBehavior(structureType)
  
  const reportRequirements: Record<string, keyof AcademicBehavior> = {
    'min-grade': 'supportsMinGradeReport',
    'ranking': 'usesRanking',
    'averages': 'usesAverages',
    'recovery': 'supportsRecovery',
  }
  
  const requirement = reportRequirements[reportId]
  if (!requirement) return true // Reporte sin restricción
  
  return behavior[requirement] as boolean
}
