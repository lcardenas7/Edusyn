import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react'
import { institutionProfileApi } from '../lib/api'

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS - Se mantienen aquí para compatibilidad con AcademicRulesEngine
// y otros consumidores que importan tipos desde este archivo.
// La GESTIÓN DE ESTADO académico está en AcademicContext.
// ═══════════════════════════════════════════════════════════════════════════

interface EvaluationSubprocess {
  id: string
  name: string
  weightPercentage: number
  numberOfGrades: number
  order: number
}

interface EvaluationProcess {
  id: string
  name: string
  code: string
  weightPercentage: number
  order: number
  subprocesses: EvaluationSubprocess[]
  allowTeacherAddGrades: boolean
}

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

interface FinalComponent {
  id: string
  name: string
  weightPercentage: number
  order: number
}

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

type AreaCalculationType = AreaCalculationMethod | 'INFORMATIVE'
type AreaApprovalRule = AreaApprovalCriteria
type AreaRecoveryRule = 'INDIVIDUAL_SUBJECT' | 'FULL_AREA' | 'CONDITIONAL'

type AcademicCalendar = 'A' | 'B'

type GradingScaleType = 
  | 'NUMERIC_1_5'
  | 'NUMERIC_1_10'
  | 'NUMERIC_0_100'
  | 'QUALITATIVE'
  | 'QUALITATIVE_DESC'

interface QualitativeLevel {
  id: string
  code: string
  name: string
  description: string
  color: string
  order: number
  isApproved: boolean
}

type SchoolShift = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'SINGLE' | 'OTHER'

interface AcademicLevel {
  id: string
  name: string
  code: string
  order: number
  gradingScaleType: GradingScaleType
  shift?: SchoolShift
  minGrade?: number
  maxGrade?: number
  minPassingGrade?: number
  qualitativeLevels?: QualitativeLevel[]
  grades: string[]
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
  useFinalComponents: boolean
  finalComponents: FinalComponent[]
}

// ═══════════════════════════════════════════════════════════════════════════
// INSTITUTIONAL PROFILE - Lo único que este contexto gestiona como estado
// ═══════════════════════════════════════════════════════════════════════════

interface InstitutionConfig {
  id: string
  name: string
  nit: string
  dane: string
  address: string
  city: string
  phone: string
  email: string
  website: string
  rector: string
  slug: string
  status: string
}

interface InstitutionContextType {
  institution: InstitutionConfig
  setInstitution: (config: InstitutionConfig) => void
  saveProfileToAPI: () => Promise<boolean>
  loadProfileFromAPI: () => Promise<void>
  isLoading: boolean
  isSaving: boolean
}

const defaultInstitution: InstitutionConfig = {
  id: '',
  name: '',
  nit: '',
  dane: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  website: '',
  rector: '',
  slug: '',
  status: '',
}

const STORAGE_KEY = 'edusyn_inst_profile'

const InstitutionContext = createContext<InstitutionContextType | undefined>(undefined)

const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key)
    if (stored) return JSON.parse(stored)
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

export function InstitutionProvider({ children }: { children: ReactNode }) {
  const [institution, setInstitutionState] = useState<InstitutionConfig>(() => 
    loadFromStorage(STORAGE_KEY, defaultInstitution)
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Cargar perfil institucional desde la API
  const loadProfileFromAPI = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) return

    setIsLoading(true)
    try {
      const response = await institutionProfileApi.get()
      if (response.status >= 200 && response.status < 300 && response.data) {
        const data = response.data
        const profile: InstitutionConfig = {
          id: data.id || '',
          name: data.name || '',
          nit: data.nit || '',
          dane: data.daneCode || '',
          address: data.address || '',
          city: '',
          phone: data.phone || '',
          email: data.email || '',
          website: data.website || '',
          rector: '',
          slug: data.slug || '',
          status: data.status || '',
        }
        setInstitutionState(profile)
        saveToStorage(STORAGE_KEY, profile)
      }
    } catch (error) {
      console.error('[InstitutionContext] Error loading profile from API:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Guardar perfil institucional en la API
  const saveProfileToAPI = useCallback(async (): Promise<boolean> => {
    const token = localStorage.getItem('token')
    if (!token) return false

    setIsSaving(true)
    try {
      await institutionProfileApi.update({
        name: institution.name,
        nit: institution.nit,
        daneCode: institution.dane,
        address: institution.address,
        phone: institution.phone,
        email: institution.email,
        website: institution.website,
      })
      return true
    } catch (error) {
      console.error('[InstitutionContext] Error saving profile:', error)
      return false
    } finally {
      setIsSaving(false)
    }
  }, [institution])

  // Cargar al montar
  useEffect(() => {
    loadProfileFromAPI()
  }, [loadProfileFromAPI])

  const setInstitution = (value: InstitutionConfig | ((prev: InstitutionConfig) => InstitutionConfig)) => {
    setInstitutionState(prev => {
      const newValue = typeof value === 'function' ? value(prev) : value
      saveToStorage(STORAGE_KEY, newValue)
      return newValue
    })
  }

  return (
    <InstitutionContext.Provider
      value={{
        institution,
        setInstitution,
        saveProfileToAPI,
        loadProfileFromAPI,
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
  AreaType,
  AreaCalculationMethod,
  AreaApprovalCriteria,
  AreaRecoveryType,
  AreaCalculationType,
  AreaApprovalRule,
  AreaRecoveryRule,
  AcademicCalendar,
  AcademicLevel,
  GradingScaleType,
  QualitativeLevel,
  SchoolShift,
}
