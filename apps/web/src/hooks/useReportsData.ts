import { useState, useEffect, useMemo } from 'react'
import { academicYearsApi, academicYearLifecycleApi, academicTermsApi, teacherAssignmentsApi, groupsApi, subjectsApi, studentsApi, institutionConfigApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { sortGroups } from '../utils/groupOrder'

export interface PerformanceLevelConfig {
  id: string
  name: string
  code: string
  minScore: number
  maxScore: number
  order: number
  color: string
  isApproved: boolean
}

export interface AcademicLevelConfig {
  id: string
  name: string
  code: string
  gradingScaleType: string
  grades: string[]
  minGrade?: number
  maxGrade?: number
  minPassingGrade?: number
  performanceLevels?: PerformanceLevelConfig[]
  qualitativeLevels?: Array<{
    id: string
    code: string
    name: string
    description: string
    color: string
    order: number
    isApproved: boolean
  }>
}

export interface GradingScaleInfo {
  minGrade: number
  maxGrade: number
  minPassingGrade: number
  performanceLevels: PerformanceLevelConfig[]
  academicLevels: AcademicLevelConfig[]
}

export interface InstitutionRulesContext {
  minGradeValue: number
  maxGradeValue: number
  minPassingGrade: number
  minAttendancePercentage: number
  maxFailedSubjectsForPromotion: number
  academicStructure: string
  recoveryMaxScore: number
  maxAreasRecoverable: number
  performanceLevels: PerformanceLevelConfig[]
  qualitativeLevels: any[]
}

const DEFAULT_RULES_CONTEXT: InstitutionRulesContext = {
  minGradeValue: 1,
  maxGradeValue: 5,
  minPassingGrade: 3.0,
  minAttendancePercentage: 80,
  maxFailedSubjectsForPromotion: 2,
  academicStructure: 'SUBJECTS_ONLY',
  recoveryMaxScore: 3.0,
  maxAreasRecoverable: 3,
  performanceLevels: [],
  qualitativeLevels: [],
}

export function useReportsData() {
  const { institution } = useAuth()
  
  // Datos base compartidos
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [terms, setTerms] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  
  // Configuración de calificación institucional
  const [gradingScale, setGradingScale] = useState<GradingScaleInfo>({
    minGrade: 1, maxGrade: 5, minPassingGrade: 3.0,
    performanceLevels: [], academicLevels: [],
  })
  
  // Contexto de reglas institucionales (fuente única de verdad)
  const [rulesContext, setRulesContext] = useState<InstitutionRulesContext>(DEFAULT_RULES_CONTEXT)
  
  // Filtros compartidos
  const [filterYear, setFilterYear] = useState('')
  const [filterPeriod, setFilterPeriod] = useState('')
  const [filterGrade, setFilterGrade] = useState('all')
  const [filterSubject, setFilterSubject] = useState('all')
  const [filterTeacher, setFilterTeacher] = useState('all')
  const [filterStudentId, setFilterStudentId] = useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  
  const [loading, setLoading] = useState(false)

  // Cargar configuración institucional y años académicos al iniciar
  useEffect(() => {
    const loadInitial = async () => {
      try {
        // Cargar config institucional + años en paralelo
        // Pasar institutionId explícitamente para asegurar resolución correcta
        const instId = institution?.id
        const [yearsRes, yearsLifecycleRes, gradingRes, levelsRes, rulesRes] = await Promise.allSettled([
          academicYearsApi.getAll(instId),
          instId ? academicYearLifecycleApi.getByInstitution(instId) : Promise.resolve({ data: [] }),
          institutionConfigApi.getGradingConfig(),
          institutionConfigApi.getAcademicLevels(),
          institutionConfigApi.getRulesContext(),
        ])

        // Reglas institucionales
        if (rulesRes.status === 'fulfilled' && rulesRes.value.data) {
          setRulesContext(rulesRes.value.data)
        }

        // Años académicos — combinar ambas fuentes y deduplicar
        let years: any[] = []
        if (yearsRes.status === 'fulfilled') {
          years = yearsRes.value.data || []
        }
        if (yearsLifecycleRes.status === 'fulfilled') {
          const lifecycleYears = (yearsLifecycleRes.value as any).data || []
          // Agregar años del lifecycle que no estén ya en la lista
          const existingIds = new Set(years.map((y: any) => y.id))
          lifecycleYears.forEach((y: any) => {
            if (!existingIds.has(y.id)) years.push(y)
          })
        }
        // Ordenar por año descendente
        years.sort((a: any, b: any) => (b.year || 0) - (a.year || 0))
        setAcademicYears(years)
        const activeYear = years.find((y: any) => y.status === 'ACTIVE') || years[0]
        if (activeYear) setFilterYear(activeYear.id)

        // Configuración de calificación
        const gradingConfig = gradingRes.status === 'fulfilled' ? gradingRes.value.data : null
        const academicLevels = levelsRes.status === 'fulfilled' ? (levelsRes.value.data || []) : []

        // Derivar escala desde academic levels o grading config
        let minGrade = 1, maxGrade = 5, minPassingGrade = 3.0
        let performanceLevels: PerformanceLevelConfig[] = []

        if (academicLevels.length > 0) {
          // Usar el primer nivel numérico como referencia de escala
          const numericLevel = academicLevels.find((l: any) => l.gradingScaleType?.startsWith('NUMERIC'))
          if (numericLevel) {
            minGrade = numericLevel.minGrade ?? 1
            maxGrade = numericLevel.maxGrade ?? 5
            minPassingGrade = numericLevel.minPassingGrade ?? gradingConfig?.minPassingGrade ?? 3.0
            if (numericLevel.performanceLevels?.length > 0) {
              performanceLevels = numericLevel.performanceLevels
            }
          }
        }

        if (gradingConfig) {
          if (gradingConfig.minPassingGrade != null) minPassingGrade = gradingConfig.minPassingGrade
          if (gradingConfig.performanceLevels?.length > 0 && performanceLevels.length === 0) {
            performanceLevels = gradingConfig.performanceLevels
          }
        }

        setGradingScale({ minGrade, maxGrade, minPassingGrade, performanceLevels, academicLevels })
      } catch (err) {
        console.error('Error loading initial data:', err)
      }
    }
    loadInitial()
  }, [institution?.id])

  // Cargar datos cuando cambia el año
  useEffect(() => {
    const loadData = async () => {
      if (!filterYear) return
      setLoading(true)
      try {
        const [termsRes, groupsRes, subjectsRes, assignmentsRes] = await Promise.all([
          academicTermsApi.getAll(filterYear),
          groupsApi.getAll(),
          subjectsApi.getAll(),
          teacherAssignmentsApi.getAll({ academicYearId: filterYear })
        ])
        setTerms(termsRes.data || [])
        setGroups(sortGroups(groupsRes.data || [])) // orden canónico "por grupo"
        setSubjects(subjectsRes.data || [])
        
        // Extraer docentes únicos
        const assignments = assignmentsRes.data || []
        const uniqueTeachers = new Map()
        assignments.forEach((a: any) => {
          if (a.teacher && !uniqueTeachers.has(a.teacherId)) {
            uniqueTeachers.set(a.teacherId, {
              id: a.teacherId,
              name: `${a.teacher.firstName} ${a.teacher.lastName}`
            })
          }
        })
        setTeachers(Array.from(uniqueTeachers.values()))
        
        if (termsRes.data?.length > 0) setFilterPeriod(termsRes.data[0].id)
      } catch (err) {
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [filterYear])

  // Cargar estudiantes cuando cambia el grupo
  useEffect(() => {
    const loadStudents = async () => {
      if (!filterGrade || filterGrade === 'all') {
        setStudents([])
        return
      }
      try {
        const response = await studentsApi.getAll({ groupId: filterGrade })
        const raw = response.data || []
        // Normalizar: si viene de StudentEnrollment, aplanar student data
        const normalized = raw.map((s: any) => ({
          id: s.student?.id || s.id,
          enrollmentId: s.id, // El ID del enrollment es el top-level id
          firstName: s.student?.firstName || s.firstName || '',
          lastName: s.student?.lastName || s.lastName || '',
          group: s.group,
        }))
        setStudents(normalized)
      } catch (err) {
        console.error('Error loading students:', err)
        setStudents([])
      }
    }
    loadStudents()
  }, [filterGrade])

  return {
    // Datos
    academicYears,
    terms,
    groups,
    subjects,
    teachers,
    students,
    loading,
    gradingScale,
    rulesContext,
    
    // Filtros
    filterYear, setFilterYear,
    filterPeriod, setFilterPeriod,
    filterGrade, setFilterGrade,
    filterSubject, setFilterSubject,
    filterTeacher, setFilterTeacher,
    filterStudentId, setFilterStudentId,
    filterDateFrom, setFilterDateFrom,
    filterDateTo, setFilterDateTo,
    filterStatus, setFilterStatus,
  }
}
