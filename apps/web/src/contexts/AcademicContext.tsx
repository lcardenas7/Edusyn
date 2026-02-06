import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react'
import api from '../lib/api'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS PARA CONFIGURACIÓN ACADÉMICA (SIEE)
// ═══════════════════════════════════════════════════════════════════════════

// Subproceso evaluativo (ej: Sub 1, Sub 2) - contiene instrumentos/notas
interface EvaluationSubprocess {
  id: string
  name: string
  weightPercentage: number
  numberOfGrades: number
  order: number
}

// Proceso evaluativo (ej: Cognitivo, Procedimental, Actitudinal)
interface EvaluationProcess {
  id: string
  name: string
  code: string
  weightPercentage: number
  order: number
  subprocesses: EvaluationSubprocess[]
  allowTeacherAddGrades: boolean
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
  isApproved: boolean
}

// Componente Final Institucional
interface FinalComponent {
  id: string
  name: string
  weightPercentage: number
  order: number
}

// Escala cualitativa para preescolar/transición
interface QualitativeLevel {
  id: string
  code: string
  name: string
  description: string
  color: string
  order: number
  isApproved: boolean
}

// Tipo de escala de calificación
type GradingScaleType = 
  | 'NUMERIC_1_5'
  | 'NUMERIC_1_10'
  | 'NUMERIC_0_100'
  | 'QUALITATIVE'
  | 'QUALITATIVE_DESC'

// Nivel Académico con configuración de evaluación
interface AcademicLevel {
  id: string
  name: string
  code: string
  order: number
  gradingScaleType: GradingScaleType
  shift?: 'MORNING' | 'AFTERNOON' | 'EVENING' | 'SINGLE'
  minGrade?: number
  maxGrade?: number
  minPassingGrade?: number
  qualitativeLevels?: QualitativeLevel[]
  performanceLevels?: PerformanceLevel[]
  // Grados asociados a este nivel (nombres de grados como strings)
  grades: string[]
}

// Período académico
interface AcademicPeriod {
  id: string
  name: string
  weight: number
  startDate: string
  endDate: string
  isActive?: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE ÁREAS (4 CAPAS)
// ═══════════════════════════════════════════════════════════════════════════

type AreaType = 'EVALUABLE' | 'INFORMATIVE' | 'FORMATIVE'
type AreaCalculationMethod = 'AVERAGE' | 'WEIGHTED' | 'DOMINANT'
type AreaApprovalCriteria = 'AREA_AVERAGE' | 'ALL_SUBJECTS' | 'DOMINANT_SUBJECT'
type AreaRecoveryType = 'BY_SUBJECT' | 'FULL_AREA' | 'CONDITIONAL' | 'NONE'

interface AreaConfig {
  areaType: AreaType
  calculationMethod: AreaCalculationMethod
  approvalCriteria: AreaApprovalCriteria
  recoveryType: AreaRecoveryType
  failIfAnySubjectFails: boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN DE CALIFICACIONES
// ═══════════════════════════════════════════════════════════════════════════

interface GradingConfig {
  evaluationProcesses: EvaluationProcess[]
  performanceLevels: PerformanceLevel[]
  minPassingGrade: number
  useFinalComponents: boolean
  finalComponents: FinalComponent[]
}

// ═══════════════════════════════════════════════════════════════════════════
// CONTEXTO ACADÉMICO
// ═══════════════════════════════════════════════════════════════════════════

// Objeto de compatibilidad para migración gradual
// Permite que componentes usen { institution } = useAcademic() temporalmente
interface AcademicInstitutionCompat {
  academicLevels: AcademicLevel[]
  academicYear: number
  academicCalendar: 'A' | 'B'
}

interface AcademicContextType {
  // Año académico activo
  academicYear: number
  setAcademicYear: (year: number) => void
  
  // Calendario (A o B)
  academicCalendar: 'A' | 'B'
  setAcademicCalendar: (calendar: 'A' | 'B') => void
  
  // Niveles académicos con configuración de evaluación
  academicLevels: AcademicLevel[]
  setAcademicLevels: (levels: AcademicLevel[]) => void
  
  // Períodos académicos
  periods: AcademicPeriod[]
  setPeriods: (periods: AcademicPeriod[]) => void
  selectedPeriod: string
  setSelectedPeriod: (periodId: string) => void
  
  // Configuración de calificaciones (SIEE)
  gradingConfig: GradingConfig
  setGradingConfig: (config: GradingConfig) => void
  
  // Configuración global de áreas
  areaConfig: AreaConfig
  setAreaConfig: (config: AreaConfig) => void
  
  // Funciones para guardar en API
  saveAcademicLevelsToAPI: () => Promise<boolean>
  savePeriodsToAPI: () => Promise<boolean>
  saveGradingConfigToAPI: () => Promise<boolean>
  saveAreaConfigToAPI: () => Promise<boolean>
  loadAcademicConfigFromAPI: () => Promise<void>
  loadPeriodsFromActiveYear: (institutionId: string) => Promise<void>
  
  // Estados
  isLoading: boolean
  isSaving: boolean
  
  // Alias de compatibilidad para migración gradual
  // Permite: const { institution } = useAcademic()
  institution: AcademicInstitutionCompat
  setInstitution: (config: Partial<AcademicInstitutionCompat>) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// VALORES POR DEFECTO
// ═══════════════════════════════════════════════════════════════════════════

const defaultQualitativeLevels: QualitativeLevel[] = [
  { id: 'q1', code: 'S', name: 'Superior', description: 'Supera los logros propuestos', color: '#22c55e', order: 0, isApproved: true },
  { id: 'q2', code: 'A', name: 'Alto', description: 'Alcanza satisfactoriamente los logros', color: '#3b82f6', order: 1, isApproved: true },
  { id: 'q3', code: 'B', name: 'Básico', description: 'Alcanza los logros mínimos', color: '#f59e0b', order: 2, isApproved: true },
  { id: 'q4', code: 'J', name: 'Bajo', description: 'No alcanza los logros mínimos', color: '#ef4444', order: 3, isApproved: false },
]

const defaultPerformanceLevels: PerformanceLevel[] = [
  { id: 'perf-1', name: 'Superior', code: 'SUPERIOR', minScore: 4.5, maxScore: 5.0, order: 0, color: '#22c55e', isApproved: true },
  { id: 'perf-2', name: 'Alto', code: 'ALTO', minScore: 4.0, maxScore: 4.4, order: 1, color: '#3b82f6', isApproved: true },
  { id: 'perf-3', name: 'Básico', code: 'BASICO', minScore: 3.0, maxScore: 3.9, order: 2, color: '#f59e0b', isApproved: true },
  { id: 'perf-4', name: 'Bajo', code: 'BAJO', minScore: 1.0, maxScore: 2.9, order: 3, color: '#ef4444', isApproved: false },
]

const defaultAcademicLevels: AcademicLevel[] = [
  {
    id: 'lvl-preescolar',
    name: 'Preescolar',
    code: 'PREESCOLAR',
    order: 0,
    gradingScaleType: 'QUALITATIVE',
    qualitativeLevels: defaultQualitativeLevels,
    grades: [],
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
    performanceLevels: defaultPerformanceLevels,
    grades: [],
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
    performanceLevels: defaultPerformanceLevels,
    grades: [],
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
    performanceLevels: defaultPerformanceLevels,
    grades: [],
  },
]

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
  performanceLevels: defaultPerformanceLevels,
  minPassingGrade: 3.0,
  useFinalComponents: false,
  finalComponents: [],
}

const defaultPeriods: AcademicPeriod[] = [
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

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS DE STORAGE
// ═══════════════════════════════════════════════════════════════════════════

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

const saveToStorage = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error(`Error saving ${key} to localStorage:`, e)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════

const AcademicContext = createContext<AcademicContextType | undefined>(undefined)

export function AcademicProvider({ children }: { children: ReactNode }) {
  const [academicYear, setAcademicYearState] = useState<number>(() => 
    loadFromStorage('edusyn_academicYear', new Date().getFullYear())
  )
  const [academicCalendar, setAcademicCalendarState] = useState<'A' | 'B'>(() => 
    loadFromStorage('edusyn_academicCalendar', 'A')
  )
  const [academicLevels, setAcademicLevelsState] = useState<AcademicLevel[]>(() => 
    loadFromStorage('edusyn_academicLevels', defaultAcademicLevels)
  )
  const [gradingConfig, setGradingConfigState] = useState<GradingConfig>(() => 
    loadFromStorage('edusyn_gradingConfig', defaultGradingConfig)
  )
  const [periods, setPeriodsState] = useState<AcademicPeriod[]>(() => 
    loadFromStorage('edusyn_periods', defaultPeriods)
  )
  const [selectedPeriod, setSelectedPeriod] = useState<string>('1')
  const [areaConfig, setAreaConfigState] = useState<AreaConfig>(() => 
    loadFromStorage('edusyn_areaConfig', defaultAreaConfig)
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const getAuthToken = () => localStorage.getItem('token')

  // Cargar configuración académica desde API
  const loadAcademicConfigFromAPI = useCallback(async () => {
    const token = getAuthToken()
    if (!token) return

    setIsLoading(true)
    try {
      const response = await api.get('/institution-config')

      if (response.status >= 200 && response.status < 300) {
        const data = response.data
        
        // Actualizar configuración de áreas
        if (data.areaConfig) {
          const legacyCalcType = data.areaConfig.calculationType
          const areaType: AreaType = legacyCalcType === 'INFORMATIVE' ? 'INFORMATIVE' : 'EVALUABLE'
          const calculationMethod: AreaCalculationMethod = 
            legacyCalcType === 'INFORMATIVE' ? 'AVERAGE' : 
            (legacyCalcType as AreaCalculationMethod) || 'WEIGHTED'
          
          const legacyApproval = data.areaConfig.approvalRule
          const approvalCriteria: AreaApprovalCriteria = 
            legacyApproval === 'ALL_SUBJECTS_PASS' || legacyApproval === 'ALL_SUBJECTS' ? 'ALL_SUBJECTS' : 
            legacyApproval === 'DOMINANT_SUBJECT_PASS' || legacyApproval === 'DOMINANT_SUBJECT' ? 'DOMINANT_SUBJECT' :
            'AREA_AVERAGE'
          
          const legacyRecovery = data.areaConfig.recoveryRule
          const recoveryType: AreaRecoveryType = 
            legacyRecovery === 'INDIVIDUAL_SUBJECT' ? 'BY_SUBJECT' :
            legacyRecovery === 'FULL_AREA' ? 'FULL_AREA' :
            legacyRecovery === 'CONDITIONAL' ? 'CONDITIONAL' :
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

        // Actualizar niveles académicos
        if (data.academicLevels && Array.isArray(data.academicLevels) && data.academicLevels.length > 0) {
          setAcademicLevelsState(data.academicLevels)
          saveToStorage('edusyn_academicLevels', data.academicLevels)
        }

        // Actualizar períodos
        if (data.periods && Array.isArray(data.periods) && data.periods.length > 0) {
          setPeriodsState(data.periods)
          saveToStorage('edusyn_periods', data.periods)
        }
      }
    } catch (error) {
      console.error('Error loading academic config from API:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Guardar niveles académicos en API
  const saveAcademicLevelsToAPI = useCallback(async (): Promise<boolean> => {
    const token = getAuthToken()
    if (!token) return false

    setIsSaving(true)
    try {
      await api.put('/institution-config/academic-levels', academicLevels)
      return true
    } catch (error) {
      console.error('Error saving academic levels:', error)
      return false
    } finally {
      setIsSaving(false)
    }
  }, [academicLevels])

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

  // Guardar configuración de áreas en API
  const saveAreaConfigToAPI = useCallback(async (): Promise<boolean> => {
    const token = getAuthToken()
    if (!token) return false

    setIsSaving(true)
    try {
      const legacyCalcType = areaConfig.areaType === 'INFORMATIVE' ? 'INFORMATIVE' : areaConfig.calculationMethod
      const legacyRecovery = areaConfig.recoveryType === 'BY_SUBJECT' ? 'INDIVIDUAL_SUBJECT' : areaConfig.recoveryType
      
      await api.put('/institution-config/areas', {
        calculationType: legacyCalcType,
        approvalRule: areaConfig.approvalCriteria,
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

  // Cargar períodos desde el año académico activo
  const loadPeriodsFromActiveYear = useCallback(async (institutionId: string) => {
    try {
      const yearResponse = await api.get(`/academic-years/institution/${institutionId}/current`)
      const activeYear = yearResponse.data
      
      if (activeYear && activeYear.terms && activeYear.terms.length > 0) {
        const periodsFromDB: AcademicPeriod[] = activeYear.terms.map((term: any) => ({
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

  // Cargar configuración al montar
  useEffect(() => {
    loadAcademicConfigFromAPI()
  }, [loadAcademicConfigFromAPI])

  // Wrappers con auto-save a localStorage
  const setAcademicYear = (year: number) => {
    setAcademicYearState(year)
    saveToStorage('edusyn_academicYear', year)
  }

  const setAcademicCalendar = (calendar: 'A' | 'B') => {
    setAcademicCalendarState(calendar)
    saveToStorage('edusyn_academicCalendar', calendar)
  }

  const setAcademicLevels = (levels: AcademicLevel[]) => {
    setAcademicLevelsState(levels)
    saveToStorage('edusyn_academicLevels', levels)
  }

  const setGradingConfig = (config: GradingConfig) => {
    setGradingConfigState(config)
    saveToStorage('edusyn_gradingConfig', config)
  }

  const setPeriods = (newPeriods: AcademicPeriod[]) => {
    setPeriodsState(newPeriods)
    saveToStorage('edusyn_periods', newPeriods)
  }

  const setAreaConfig = (config: AreaConfig) => {
    setAreaConfigState(config)
    saveToStorage('edusyn_areaConfig', config)
  }

  // Objeto de compatibilidad para migración gradual
  const institution: AcademicInstitutionCompat = {
    academicLevels,
    academicYear,
    academicCalendar,
  }

  // Setter de compatibilidad
  const setInstitution = (config: Partial<AcademicInstitutionCompat>) => {
    if (config.academicLevels) setAcademicLevels(config.academicLevels)
    if (config.academicYear) setAcademicYear(config.academicYear)
    if (config.academicCalendar) setAcademicCalendar(config.academicCalendar)
  }

  return (
    <AcademicContext.Provider
      value={{
        academicYear,
        setAcademicYear,
        academicCalendar,
        setAcademicCalendar,
        academicLevels,
        setAcademicLevels,
        periods,
        setPeriods,
        selectedPeriod,
        setSelectedPeriod,
        gradingConfig,
        setGradingConfig,
        areaConfig,
        setAreaConfig,
        saveAcademicLevelsToAPI,
        savePeriodsToAPI,
        saveGradingConfigToAPI,
        saveAreaConfigToAPI,
        loadAcademicConfigFromAPI,
        loadPeriodsFromActiveYear,
        isLoading,
        isSaving,
        // Compatibilidad para migración
        institution,
        setInstitution,
      }}
    >
      {children}
    </AcademicContext.Provider>
  )
}

export function useAcademic() {
  const context = useContext(AcademicContext)
  if (context === undefined) {
    throw new Error('useAcademic must be used within an AcademicProvider')
  }
  return context
}

export type {
  AcademicContextType,
  AcademicLevel,
  AcademicPeriod,
  GradingConfig,
  EvaluationProcess,
  EvaluationSubprocess,
  PerformanceLevel,
  FinalComponent,
  QualitativeLevel,
  GradingScaleType,
  AreaConfig,
  AreaType,
  AreaCalculationMethod,
  AreaApprovalCriteria,
  AreaRecoveryType,
}
