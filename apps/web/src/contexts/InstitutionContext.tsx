import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react'
import api from '../lib/api'

// Subproceso evaluativo (ej: Sub 1, Sub 2) - contiene instrumentos/notas
interface EvaluationSubprocess {
  id: string
  name: string
  weightPercentage: number
  numberOfGrades: number // Cantidad de casillas de notas
  order: number
}

// Proceso evaluativo (ej: Cognitivo, Procedimental, Actitudinal, Saber Ser, etc.)
interface EvaluationProcess {
  id: string
  name: string
  code: string
  weightPercentage: number
  order: number
  subprocesses: EvaluationSubprocess[]
  allowTeacherAddGrades: boolean // Si el docente puede agregar más casillas de notas
}

// Nivel de desempeño configurable
interface PerformanceLevel {
  id: string
  name: string
  code: string
  minScore: number
  maxScore: number
  order: number
  color: string
  isApproved: boolean // Si este nivel representa aprobación
}

// Componente Final Institucional (Pruebas Semestrales, Evaluaciones Globales, etc.)
interface FinalComponent {
  id: string
  name: string
  weightPercentage: number
  order: number
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE ÁREAS - NUEVA ESTRUCTURA (4 CAPAS)
// ═══════════════════════════════════════════════════════════════════════════

// CAPA 1: Tipo de Área (impacto académico)
type AreaType = 
  | 'EVALUABLE'      // Afecta promoción, se calcula nota numérica
  | 'INFORMATIVE'    // No afecta promoción, solo informativa (ej: Orientación)
  | 'FORMATIVE'      // Cualitativa, solo observaciones (ej: Comportamiento)

// CAPA 2: Método de cálculo (solo si es EVALUABLE)
type AreaCalculationMethod = 
  | 'AVERAGE'        // Promedio simple de asignaturas
  | 'WEIGHTED'       // Ponderado por % de cada asignatura
  | 'DOMINANT'       // Solo cuenta la asignatura principal

// CAPA 3: Criterio de aprobación (solo si es EVALUABLE)
type AreaApprovalCriteria = 
  | 'AREA_AVERAGE'       // Nota final del área ≥ mínima
  | 'ALL_SUBJECTS'       // Todas las asignaturas ≥ mínima
  | 'DOMINANT_SUBJECT'   // Solo la dominante ≥ mínima

// CAPA 4: Tipo de recuperación
type AreaRecoveryType = 
  | 'BY_SUBJECT'     // Recupera solo las asignaturas perdidas
  | 'FULL_AREA'      // Evalúa toda el área completa
  | 'CONDITIONAL'    // Según comité/acta de evaluación
  | 'NONE'           // No recuperable

// Configuración GLOBAL de Áreas (aplica a todas las áreas de la institución)
interface AreaConfig {
  // CAPA 1: Tipo de área
  areaType: AreaType
  // CAPA 2: Método de cálculo (solo si EVALUABLE)
  calculationMethod: AreaCalculationMethod
  // CAPA 3: Criterio de aprobación (solo si EVALUABLE)
  approvalCriteria: AreaApprovalCriteria
  // CAPA 4: Tipo de recuperación
  recoveryType: AreaRecoveryType
  // Opción adicional: pierde área si cualquier asignatura falla (solo si EVALUABLE)
  failIfAnySubjectFails: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS LEGACY (para compatibilidad con código existente)
// ═══════════════════════════════════════════════════════════════════════════
// TODO: Migrar gradualmente y eliminar estos tipos
type AreaCalculationType = AreaCalculationMethod | 'INFORMATIVE'
type AreaApprovalRule = AreaApprovalCriteria
type AreaRecoveryRule = 'INDIVIDUAL_SUBJECT' | 'FULL_AREA' | 'CONDITIONAL'

// Calendario Académico
type AcademicCalendar = 'A' | 'B'

// Tipo de escala de calificación
type GradingScaleType = 
  | 'NUMERIC_1_5'      // Numérico 1.0 - 5.0 (Colombia estándar)
  | 'NUMERIC_1_10'     // Numérico 1 - 10
  | 'NUMERIC_0_100'    // Numérico 0 - 100
  | 'QUALITATIVE'      // Cualitativo (letras: E, S, A, I, D)
  | 'QUALITATIVE_DESC' // Cualitativo descriptivo (Excelente, Sobresaliente, etc.)

// Escala cualitativa para preescolar/transición
interface QualitativeLevel {
  id: string
  code: string        // E, S, A, I, D
  name: string        // Excelente, Sobresaliente, Aceptable, Insuficiente, Deficiente
  description: string // Descripción detallada
  color: string
  order: number
  isApproved: boolean // Si este nivel representa aprobación
}

// Jornada escolar
type SchoolShift = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'SINGLE' | 'OTHER'

// Nivel Académico (Preescolar, Primaria, Secundaria, Media, etc.)
interface AcademicLevel {
  id: string
  name: string                    // Ej: "Preescolar", "Básica Primaria", "Básica Secundaria", "Media"
  code: string                    // Ej: "PREESCOLAR", "PRIMARIA", "SECUNDARIA", "MEDIA"
  order: number
  gradingScaleType: GradingScaleType
  // Jornada escolar
  shift?: SchoolShift             // Ej: "MORNING", "AFTERNOON", "SINGLE"
  // Para escala numérica
  minGrade?: number               // Ej: 1.0
  maxGrade?: number               // Ej: 5.0
  minPassingGrade?: number        // Ej: 3.0
  // Para escala cualitativa
  qualitativeLevels?: QualitativeLevel[]
  // Grados que pertenecen a este nivel
  grades: string[]                // Ej: ["Transición"], ["1°", "2°", "3°", "4°", "5°"]
  // Escala de valoración (niveles de desempeño) - Solo para escalas numéricas
  performanceLevels?: PerformanceLevel[]
}

interface Period {
  id: string
  name: string
  weight: number
  startDate: string
  endDate: string
}

interface GradingConfig {
  evaluationProcesses: EvaluationProcess[]
  performanceLevels: PerformanceLevel[]
  minPassingGrade: number
  // Componentes Finales Institucionales
  useFinalComponents: boolean
  finalComponents: FinalComponent[]
}

interface InstitutionConfig {
  id: string
  name: string
  nit: string
  dane: string
  address: string
  city: string
  phone: string
  email: string
  rector: string
  academicYear: number
  academicCalendar: AcademicCalendar
  academicLevels: AcademicLevel[]
}

interface InstitutionContextType {
  institution: InstitutionConfig
  setInstitution: (config: InstitutionConfig) => void
  gradingConfig: GradingConfig
  setGradingConfig: (config: GradingConfig) => void
  periods: Period[]
  setPeriods: (periods: Period[]) => void
  selectedPeriod: string
  setSelectedPeriod: (periodId: string) => void
  // Configuración global de áreas
  areaConfig: AreaConfig
  setAreaConfig: (config: AreaConfig) => void
  // Funciones para guardar en API
  saveAreaConfigToAPI: () => Promise<boolean>
  saveGradingConfigToAPI: () => Promise<boolean>
  saveAcademicLevelsToAPI: () => Promise<boolean>
  savePeriodsToAPI: () => Promise<boolean>
  loadConfigFromAPI: () => Promise<void>
  loadPeriodsFromActiveYear: (institutionId: string) => Promise<void>
  isLoading: boolean
  isSaving: boolean
}

// Escala cualitativa por defecto para preescolar
const defaultQualitativeLevels: QualitativeLevel[] = [
  { id: 'q1', code: 'S', name: 'Superior', description: 'Supera los logros propuestos', color: '#22c55e', order: 0, isApproved: true },
  { id: 'q2', code: 'A', name: 'Alto', description: 'Alcanza satisfactoriamente los logros', color: '#3b82f6', order: 1, isApproved: true },
  { id: 'q3', code: 'B', name: 'Básico', description: 'Alcanza los logros mínimos', color: '#f59e0b', order: 2, isApproved: true },
  { id: 'q4', code: 'J', name: 'Bajo', description: 'No alcanza los logros mínimos', color: '#ef4444', order: 3, isApproved: false },
]

// Escala de valoración por defecto para niveles numéricos
const defaultPerformanceLevels: PerformanceLevel[] = [
  { id: 'perf-1', name: 'Superior', code: 'SUPERIOR', minScore: 4.5, maxScore: 5.0, order: 0, color: '#22c55e', isApproved: true },
  { id: 'perf-2', name: 'Alto', code: 'ALTO', minScore: 4.0, maxScore: 4.4, order: 1, color: '#3b82f6', isApproved: true },
  { id: 'perf-3', name: 'Básico', code: 'BASICO', minScore: 3.0, maxScore: 3.9, order: 2, color: '#f59e0b', isApproved: true },
  { id: 'perf-4', name: 'Bajo', code: 'BAJO', minScore: 1.0, maxScore: 2.9, order: 3, color: '#ef4444', isApproved: false },
]

// Niveles académicos por defecto
const defaultAcademicLevels: AcademicLevel[] = [
  {
    id: 'lvl-preescolar',
    name: 'Preescolar',
    code: 'PREESCOLAR',
    order: 0,
    gradingScaleType: 'QUALITATIVE',
    qualitativeLevels: defaultQualitativeLevels,
    grades: ['Pre-Jardín', 'Jardín', 'Transición'],
  },
  {
    id: 'lvl-primaria',
    name: 'Básica Primaria',
    code: 'PRIMARIA',
    order: 1,
    gradingScaleType: 'NUMERIC_1_5',
    minGrade: 1.0,
    maxGrade: 5.0,
    minPassingGrade: 3.0,
    grades: ['1°', '2°', '3°', '4°', '5°'],
    performanceLevels: defaultPerformanceLevels,
  },
  {
    id: 'lvl-secundaria',
    name: 'Básica Secundaria',
    code: 'SECUNDARIA',
    order: 2,
    gradingScaleType: 'NUMERIC_1_5',
    minGrade: 1.0,
    maxGrade: 5.0,
    minPassingGrade: 3.0,
    grades: ['6°', '7°', '8°', '9°'],
    performanceLevels: defaultPerformanceLevels,
  },
  {
    id: 'lvl-media',
    name: 'Media',
    code: 'MEDIA',
    order: 3,
    gradingScaleType: 'NUMERIC_1_5',
    minGrade: 1.0,
    maxGrade: 5.0,
    minPassingGrade: 3.0,
    grades: ['10°', '11°'],
    performanceLevels: defaultPerformanceLevels,
  },
]

const defaultInstitution: InstitutionConfig = {
  id: '1',
  name: 'Institución Educativa Demo',
  nit: '900123456-7',
  dane: '123456789012',
  address: 'Calle 123 #45-67',
  city: 'Bogotá',
  phone: '601 1234567',
  email: 'contacto@institucion.edu.co',
  rector: 'Dr. Juan Pérez',
  academicYear: 2026,
  academicCalendar: 'A',
  academicLevels: defaultAcademicLevels,
}

const defaultGradingConfig: GradingConfig = {
  evaluationProcesses: [
    {
      id: 'proc-1',
      name: 'Cognitivo',
      code: 'COGNITIVO',
      weightPercentage: 40,
      order: 0,
      allowTeacherAddGrades: true,
      subprocesses: [
        { id: 'sub-1-1', name: 'Sub 1', weightPercentage: 100, numberOfGrades: 3, order: 0 },
      ]
    },
    {
      id: 'proc-2',
      name: 'Procedimental',
      code: 'PROCEDIMENTAL',
      weightPercentage: 40,
      order: 1,
      allowTeacherAddGrades: true,
      subprocesses: [
        { id: 'sub-2-1', name: 'Sub 1', weightPercentage: 100, numberOfGrades: 3, order: 0 },
      ]
    },
    {
      id: 'proc-3',
      name: 'Actitudinal',
      code: 'ACTITUDINAL',
      weightPercentage: 20,
      order: 2,
      allowTeacherAddGrades: false,
      subprocesses: [
        { id: 'sub-3-1', name: 'Personal', weightPercentage: 25, numberOfGrades: 1, order: 0 },
        { id: 'sub-3-2', name: 'Social', weightPercentage: 25, numberOfGrades: 1, order: 1 },
        { id: 'sub-3-3', name: 'Autoevaluación', weightPercentage: 25, numberOfGrades: 1, order: 2 },
        { id: 'sub-3-4', name: 'Coevaluación', weightPercentage: 25, numberOfGrades: 1, order: 3 },
      ]
    },
  ],
  performanceLevels: [
    { id: 'lvl-1', name: 'Superior', code: 'SUPERIOR', minScore: 4.5, maxScore: 5.0, order: 0, color: '#22c55e', isApproved: true },
    { id: 'lvl-2', name: 'Alto', code: 'ALTO', minScore: 4.0, maxScore: 4.4, order: 1, color: '#3b82f6', isApproved: true },
    { id: 'lvl-3', name: 'Básico', code: 'BASICO', minScore: 3.0, maxScore: 3.9, order: 2, color: '#f59e0b', isApproved: true },
    { id: 'lvl-4', name: 'Bajo', code: 'BAJO', minScore: 1.0, maxScore: 2.9, order: 3, color: '#ef4444', isApproved: false },
  ],
  minPassingGrade: 3.0,
  useFinalComponents: false,
  finalComponents: [],
}

const defaultPeriods: Period[] = [
  { id: '1', name: 'Período 1', weight: 25, startDate: '2026-01-20', endDate: '2026-04-05' },
  { id: '2', name: 'Período 2', weight: 25, startDate: '2026-04-06', endDate: '2026-06-20' },
  { id: '3', name: 'Período 3', weight: 25, startDate: '2026-07-15', endDate: '2026-09-30' },
  { id: '4', name: 'Período 4', weight: 25, startDate: '2026-10-01', endDate: '2026-11-30' },
]

const defaultAreaConfig: AreaConfig = {
  areaType: 'EVALUABLE',
  calculationMethod: 'WEIGHTED',
  approvalCriteria: 'AREA_AVERAGE',
  recoveryType: 'BY_SUBJECT',
  failIfAnySubjectFails: false,
}

const InstitutionContext = createContext<InstitutionContextType | undefined>(undefined)

// Cargar desde localStorage
const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (e) {
    console.error(`Error loading ${key} from localStorage:`, e)
  }
  return defaultValue
}

// Guardar en localStorage
const saveToStorage = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error(`Error saving ${key} to localStorage:`, e)
  }
}

export function InstitutionProvider({ children }: { children: ReactNode }) {
  const [institution, setInstitutionState] = useState<InstitutionConfig>(() => 
    loadFromStorage('edusyn_institution', defaultInstitution)
  )
  const [gradingConfig, setGradingConfigState] = useState<GradingConfig>(() => 
    loadFromStorage('edusyn_gradingConfig', defaultGradingConfig)
  )
  const [periods, setPeriodsState] = useState<Period[]>(() => 
    loadFromStorage('edusyn_periods', defaultPeriods)
  )
  const [selectedPeriod, setSelectedPeriod] = useState<string>('1')
  const [areaConfig, setAreaConfigState] = useState<AreaConfig>(() => 
    loadFromStorage('edusyn_areaConfig', defaultAreaConfig)
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Helper para obtener el token
  const getAuthToken = () => localStorage.getItem('token')

  // Cargar configuración desde la API
  const loadConfigFromAPI = useCallback(async () => {
    const token = getAuthToken()
    if (!token) return

    setIsLoading(true)
    try {
      const response = await api.get('/institution-config')

      if (response.status >= 200 && response.status < 300) {
        const data = response.data
        
        // Actualizar configuración de áreas (mapear desde formato legacy del backend)
        if (data.areaConfig) {
          // Determinar areaType basado en calculationType legacy
          const legacyCalcType = data.areaConfig.calculationType
          const areaType: AreaType = legacyCalcType === 'INFORMATIVE' ? 'INFORMATIVE' : 'EVALUABLE'
          const calculationMethod: AreaCalculationMethod = 
            legacyCalcType === 'INFORMATIVE' ? 'AVERAGE' : 
            (legacyCalcType as AreaCalculationMethod) || 'WEIGHTED'
          
          // Mapear approvalRule legacy
          const legacyApproval = data.areaConfig.approvalRule
          const approvalCriteria: AreaApprovalCriteria = 
            legacyApproval === 'ALL_SUBJECTS_PASS' || legacyApproval === 'ALL_SUBJECTS' ? 'ALL_SUBJECTS' : 
            legacyApproval === 'DOMINANT_SUBJECT_PASS' || legacyApproval === 'DOMINANT_SUBJECT' ? 'DOMINANT_SUBJECT' :
            'AREA_AVERAGE'
          
          // Mapear recoveryRule legacy
          const legacyRecovery = data.areaConfig.recoveryRule
          const recoveryType: AreaRecoveryType = 
            legacyRecovery === 'INDIVIDUAL_SUBJECT' ? 'BY_SUBJECT' :
            legacyRecovery === 'FULL_AREA' ? 'FULL_AREA' :
            legacyRecovery === 'CONDITIONAL' ? 'CONDITIONAL' :
            legacyRecovery === 'BY_SUBJECT' ? 'BY_SUBJECT' :
            'BY_SUBJECT'
          
          const mappedAreaConfig: AreaConfig = {
            areaType,
            calculationMethod,
            approvalCriteria,
            recoveryType,
            failIfAnySubjectFails: data.areaConfig.failIfAnySubjectFails ?? false,
          }
          setAreaConfigState(mappedAreaConfig)
          saveToStorage('edusyn_areaConfig', mappedAreaConfig)
        }

        // Actualizar configuración de calificaciones
        if (data.gradingConfig && typeof data.gradingConfig === 'object') {
          setGradingConfigState(prev => {
            const newConfig = { ...prev, ...data.gradingConfig }
            saveToStorage('edusyn_gradingConfig', newConfig)
            return newConfig
          })
        }

        // Actualizar información de la institución
        if (data.institutionInfo) {
          setInstitutionState(prev => {
            const newInst = { 
              ...prev, 
              name: data.institutionInfo.name || prev.name,
              nit: data.institutionInfo.nit || prev.nit,
              dane: data.institutionInfo.daneCode || prev.dane,
              address: data.institutionInfo.address || prev.address,
              phone: data.institutionInfo.phone || prev.phone,
              email: data.institutionInfo.email || prev.email,
            }
            saveToStorage('edusyn_institution', newInst)
            return newInst
          })
        }

        // Actualizar niveles académicos
        if (data.academicLevels && Array.isArray(data.academicLevels) && data.academicLevels.length > 0) {
          setInstitutionState(prev => {
            const newInst = { ...prev, academicLevels: data.academicLevels }
            saveToStorage('edusyn_institution', newInst)
            return newInst
          })
        }

        // Actualizar períodos
        if (data.periods && Array.isArray(data.periods) && data.periods.length > 0) {
          setPeriodsState(data.periods)
          saveToStorage('edusyn_periods', data.periods)
        }
      }
    } catch (error) {
      console.error('Error loading config from API:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Guardar configuración de áreas en API (convertir a formato legacy del backend)
  const saveAreaConfigToAPI = useCallback(async (): Promise<boolean> => {
    const token = getAuthToken()
    if (!token) return false

    setIsSaving(true)
    try {
      // Convertir nuevo formato a legacy para el backend
      const legacyCalcType = areaConfig.areaType === 'INFORMATIVE' ? 'INFORMATIVE' : areaConfig.calculationMethod
      const legacyApproval = areaConfig.approvalCriteria
      const legacyRecovery = areaConfig.recoveryType === 'BY_SUBJECT' ? 'INDIVIDUAL_SUBJECT' : areaConfig.recoveryType
      
      await api.put('/institution-config/areas', {
        calculationType: legacyCalcType,
        approvalRule: legacyApproval,
        recoveryRule: legacyRecovery,
        failIfAnySubjectFails: areaConfig.failIfAnySubjectFails,
      })
      return true
    } catch (error) {
      console.error('Error saving area config:', error)
      return false
    } finally {
      setIsSaving(false)
    }
  }, [areaConfig])

  // Guardar configuración de calificaciones en API
  const saveGradingConfigToAPI = useCallback(async (): Promise<boolean> => {
    const token = getAuthToken()
    if (!token) return false

    setIsSaving(true)
    try {
      await api.put('/institution-config/grading', gradingConfig)
      return true
    } catch (error) {
      console.error('Error saving grading config:', error)
      return false
    } finally {
      setIsSaving(false)
    }
  }, [gradingConfig])

  // Guardar niveles académicos en API
  const saveAcademicLevelsToAPI = useCallback(async (): Promise<boolean> => {
    const token = getAuthToken()
    if (!token) return false

    setIsSaving(true)
    try {
      await api.put('/institution-config/academic-levels', institution.academicLevels)
      return true
    } catch (error) {
      console.error('Error saving academic levels:', error)
      return false
    } finally {
      setIsSaving(false)
    }
  }, [institution.academicLevels])

  // Guardar períodos en API
  const savePeriodsToAPI = useCallback(async (): Promise<boolean> => {
    const token = getAuthToken()
    if (!token) return false

    setIsSaving(true)
    try {
      await api.put('/institution-config/periods', periods)
      return true
    } catch (error) {
      console.error('Error saving periods:', error)
      return false
    } finally {
      setIsSaving(false)
    }
  }, [periods])

  // Cargar configuración al montar el componente
  useEffect(() => {
    loadConfigFromAPI()
  }, [loadConfigFromAPI])

  // Wrappers que guardan automáticamente en localStorage
  const setInstitution = (value: InstitutionConfig | ((prev: InstitutionConfig) => InstitutionConfig)) => {
    setInstitutionState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value
      saveToStorage('edusyn_institution', newValue)
      return newValue
    })
  }

  const setGradingConfig = (value: GradingConfig | ((prev: GradingConfig) => GradingConfig)) => {
    setGradingConfigState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value
      saveToStorage('edusyn_gradingConfig', newValue)
      return newValue
    })
  }

  const setPeriods = (value: Period[] | ((prev: Period[]) => Period[])) => {
    setPeriodsState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value
      saveToStorage('edusyn_periods', newValue)
      return newValue
    })
  }

  const setAreaConfig = (value: AreaConfig | ((prev: AreaConfig) => AreaConfig)) => {
    setAreaConfigState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value
      saveToStorage('edusyn_areaConfig', newValue)
      return newValue
    })
  }

  // Cargar períodos desde el año académico activo
  const loadPeriodsFromActiveYear = useCallback(async (institutionId: string) => {
    try {
      // Obtener el año académico activo
      const yearResponse = await api.get(`/academic-years/institution/${institutionId}/current`)
      const activeYear = yearResponse.data
      
      if (activeYear && activeYear.terms && activeYear.terms.length > 0) {
        // Convertir AcademicTerms a formato Period
        const periodsFromDB: Period[] = activeYear.terms.map((term: any) => ({
          id: term.id,
          name: term.name,
          startDate: term.startDate ? new Date(term.startDate).toISOString().split('T')[0] : '',
          endDate: term.endDate ? new Date(term.endDate).toISOString().split('T')[0] : '',
          weight: term.weightPercentage || 25
        }))
        
        setPeriodsState(periodsFromDB)
        saveToStorage('edusyn_periods', periodsFromDB)
      }
    } catch (error) {
      console.error('Error loading periods from active year:', error)
    }
  }, [])

  return (
    <InstitutionContext.Provider
      value={{
        institution,
        setInstitution,
        gradingConfig,
        setGradingConfig,
        periods,
        setPeriods,
        selectedPeriod,
        setSelectedPeriod,
        areaConfig,
        setAreaConfig,
        saveAreaConfigToAPI,
        saveGradingConfigToAPI,
        saveAcademicLevelsToAPI,
        savePeriodsToAPI,
        loadConfigFromAPI,
        loadPeriodsFromActiveYear,
        isLoading,
        isSaving,
      }}
    >
      {children}
    </InstitutionContext.Provider>
  )
}

export function useInstitution() {
  const context = useContext(InstitutionContext)
  if (context === undefined) {
    throw new Error('useInstitution must be used within an InstitutionProvider')
  }
  return context
}

export type { 
  GradingConfig, 
  Period, 
  InstitutionConfig, 
  EvaluationProcess, 
  EvaluationSubprocess, 
  PerformanceLevel, 
  FinalComponent,
  AreaConfig,
  // Nuevos tipos (4 capas)
  AreaType,
  AreaCalculationMethod,
  AreaApprovalCriteria,
  AreaRecoveryType,
  // Tipos legacy (para compatibilidad)
  AreaCalculationType,
  AreaApprovalRule,
  AreaRecoveryRule,
  AcademicCalendar,
  AcademicLevel,
  GradingScaleType,
  QualitativeLevel,
}
