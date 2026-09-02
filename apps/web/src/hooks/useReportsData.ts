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

// Valor por defecto de `gradingScale`, tanto al iniciar como al cambiar de
// institución. Es una factoría y no una constante a propósito: hay consumidores
// que ordenan `performanceLevels` con `.sort()`, que muta el array en su sitio,
// y una única instancia compartida se corrompería entre reinicios y entre usos
// del hook. Cada llamada devuelve un objeto y arrays nuevos.
const createDefaultGradingScale = (): GradingScaleInfo => ({
  minGrade: 1, maxGrade: 5, minPassingGrade: 3.0,
  performanceLevels: [], academicLevels: [],
})

export function useReportsData(options: { institutionId?: string; enabled?: boolean } = {}) {
  const { institution } = useAuth()
  const institutionId = options.institutionId ?? institution?.id
  const enabled = options.enabled ?? true
  
  // Datos base compartidos
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [terms, setTerms] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  
  // Configuración de calificación institucional
  const [gradingScale, setGradingScale] = useState<GradingScaleInfo>(createDefaultGradingScale)
  
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
    // Al cambiar de destino, nada del anterior sigue a la vista: se vacía de
    // forma síncrona, antes de pedir nada. Si la carga del destino nuevo falla,
    // el estado se queda vacío en lugar de recuperar el catálogo previo.
    setAcademicYears([])
    setTerms([])
    setGroups([])
    setSubjects([])
    setTeachers([])
    setStudents([])
    setGradingScale(createDefaultGradingScale())
    setRulesContext(DEFAULT_RULES_CONTEXT)

    // Descarta respuestas de un destino anterior: React ejecuta esta limpieza
    // antes de volver a lanzar el efecto, de modo que la petición en vuelo de la
    // institución anterior ya no puede escribir estado cuando resuelva.
    let cancelled = false
    const loadInitial = async () => {
      if (!enabled || !institutionId) return
      try {
        // Cargar config institucional + años en paralelo
        // Pasar institutionId explícitamente para asegurar resolución correcta
        const instId = institutionId
        const [yearsRes, yearsLifecycleRes, gradingRes, levelsRes, rulesRes] = await Promise.allSettled([
          academicYearsApi.getAll(instId),
          Promise.resolve({ data: [] }),
          institutionConfigApi.getGradingConfig(instId),
          institutionConfigApi.getAcademicLevels(instId),
          institutionConfigApi.getRulesContext(instId),
        ])
        if (cancelled) return

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
    return () => { cancelled = true }
  }, [enabled, institutionId])

  // Cargar datos cuando cambia el año
  useEffect(() => {
    let cancelled = false
    const loadData = async () => {
      if (!enabled || !institutionId || !filterYear) return
      setLoading(true)
      try {
        const [termsRes, groupsRes, subjectsRes, assignmentsRes] = await Promise.all([
          academicTermsApi.getAll(filterYear),
          groupsApi.getAll({ institutionId }),
          subjectsApi.getAll(undefined, institutionId),
          teacherAssignmentsApi.getAll({ academicYearId: filterYear, institutionId })
        ])
        if (cancelled) return
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
        // Si este efecto quedó obsoleto, quien manda es la carga vigente: no le
        // apagamos su indicador de carga.
        if (!cancelled) setLoading(false)
      }
    }
    loadData()
    return () => { cancelled = true }
  }, [enabled, filterYear, institutionId])

  // Cargar estudiantes cuando cambia el grupo
  useEffect(() => {
    let cancelled = false
    const loadStudents = async () => {
      if (!filterGrade || filterGrade === 'all') {
        setStudents([])
        return
      }
      try {
        // El destino de esta pantalla viaja explícito: una sesión de SuperAdmin
        // no tiene institución en el JWT y esta ruta no la hereda del contexto
        // temporal de Reportes. Para un usuario institucional el servidor sigue
        // ignorando este valor y usando el de su sesión.
        const response = await studentsApi.getAll({ groupId: filterGrade, institutionId })
        if (cancelled) return
        const raw = response.data || []
        // Normalizar: si viene de StudentEnrollment, aplanar student data.
        // Se conservan los 4 componentes del nombre (primer/segundo nombre y
        // apellido): los selectores de reportes arman el nombre completo con
        // ellos y si se pierden aquí el filtro muestra nombres truncados.
        const normalized = raw.map((s: any) => {
          const st = s.student || s
          const fullName = [st.lastName, st.secondLastName, st.firstName, st.secondName]
            .filter(Boolean)
            .join(' ')
          return {
            id: st.id || s.id,
            enrollmentId: s.id, // El ID del enrollment es el top-level id
            firstName: st.firstName || '',
            secondName: st.secondName || '',
            lastName: st.lastName || '',
            secondLastName: st.secondLastName || '',
            documentNumber: st.documentNumber || '',
            fullName,
            group: s.group,
          }
        })
        setStudents(normalized)
      } catch (err) {
        if (cancelled) return
        console.error('Error loading students:', err)
        setStudents([])
      }
    }
    loadStudents()
    return () => { cancelled = true }
    // `institutionId` entra aquí porque nada reinicia `filterGrade` al cambiar
    // de institución: sin esta dependencia, la lista quedaría con los
    // estudiantes del destino anterior.
  }, [filterGrade, institutionId])

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
