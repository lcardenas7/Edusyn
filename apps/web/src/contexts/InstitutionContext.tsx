import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

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

// Tipos de cálculo del área
type AreaCalculationType = 
  | 'INFORMATIVE'      // Solo informativa, no se calcula
  | 'AVERAGE'          // Promedio simple
  | 'WEIGHTED'         // Promedio ponderado
  | 'DOMINANT'         // Asignatura dominante

// Reglas de aprobación del área
type AreaApprovalRule = 
  | 'AREA_AVERAGE'           // Aprueba si el promedio del área >= mínima
  | 'ALL_SUBJECTS'           // Aprueba si TODAS las asignaturas >= mínima
  | 'DOMINANT_SUBJECT'       // Aprueba si la asignatura dominante >= mínima

// Reglas de recuperación
type AreaRecoveryRule = 
  | 'INDIVIDUAL_SUBJECT'     // Recupera cada asignatura perdida individualmente
  | 'FULL_AREA'              // Recupera el área completa
  | 'CONDITIONAL'            // Recupera según condiciones

// Configuración GLOBAL de Áreas (aplica a todas las áreas de la institución)
// Nota: La nota mínima se toma de gradingConfig.minPassingGrade
interface AreaConfig {
  calculationType: AreaCalculationType
  approvalRule: AreaApprovalRule
  recoveryRule: AreaRecoveryRule
  failIfAnySubjectFails: boolean
}

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

// Nivel Académico (Preescolar, Primaria, Secundaria, Media, etc.)
interface AcademicLevel {
  id: string
  name: string                    // Ej: "Preescolar", "Básica Primaria", "Básica Secundaria", "Media"
  code: string                    // Ej: "PREESCOLAR", "PRIMARIA", "SECUNDARIA", "MEDIA"
  order: number
  gradingScaleType: GradingScaleType
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
  calculationType: 'WEIGHTED',
  approvalRule: 'AREA_AVERAGE',
  recoveryRule: 'INDIVIDUAL_SUBJECT',
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
      const response = await fetch(`${API_URL}/institution-config`, {
        headers: { 'Authorization': `Bearer ${token}` },
      })

      if (response.ok) {
        const data = await response.json()
        
        // Actualizar configuración de áreas
        if (data.areaConfig) {
          const mappedAreaConfig: AreaConfig = {
            calculationType: data.areaConfig.calculationType as AreaCalculationType,
            approvalRule: data.areaConfig.approvalRule === 'ALL_SUBJECTS_PASS' ? 'ALL_SUBJECTS' : 
                         data.areaConfig.approvalRule === 'DOMINANT_SUBJECT_PASS' ? 'DOMINANT_SUBJECT' :
                         'AREA_AVERAGE',
            recoveryRule: data.areaConfig.recoveryRule as AreaRecoveryRule,
            failIfAnySubjectFails: data.areaConfig.failIfAnySubjectFails,
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

  // Guardar configuración de áreas en API
  const saveAreaConfigToAPI = useCallback(async (): Promise<boolean> => {
    const token = getAuthToken()
    if (!token) return false

    setIsSaving(true)
    try {
      const response = await fetch(`${API_URL}/institution-config/areas`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          calculationType: areaConfig.calculationType,
          approvalRule: areaConfig.approvalRule === 'ALL_SUBJECTS' ? 'ALL_SUBJECTS_PASS' :
                       areaConfig.approvalRule === 'DOMINANT_SUBJECT' ? 'DOMINANT_SUBJECT_PASS' :
                       'AREA_AVERAGE',
          recoveryRule: areaConfig.recoveryRule,
          failIfAnySubjectFails: areaConfig.failIfAnySubjectFails,
        }),
      })
      return response.ok
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
      const response = await fetch(`${API_URL}/institution-config/grading`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gradingConfig),
      })
      return response.ok
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
      const response = await fetch(`${API_URL}/institution-config/academic-levels`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(institution.academicLevels),
      })
      return response.ok
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
      const response = await fetch(`${API_URL}/institution-config/periods`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(periods),
      })
      return response.ok
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
  AreaCalculationType,
  AreaApprovalRule,
  AreaRecoveryRule,
  AcademicCalendar,
  AcademicLevel,
  GradingScaleType,
  QualitativeLevel,
}
