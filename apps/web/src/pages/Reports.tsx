import { useState, useEffect, useMemo } from 'react'
import { 
  FileText,
  Users,
  BookOpen,
  Calendar,
  AlertTriangle,
  Settings,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Download,
  Printer,
  CheckCircle,
  XCircle,
  Clock,
  UserCheck,
  UserX,
  Briefcase,
  Layers,
  GraduationCap,
  ClipboardList,
  Bell,
  FileCheck,
  History,
  PieChart,
  Activity,
  Search,
  ChevronLeft
} from 'lucide-react'
import { academicYearsApi, academicTermsApi, teacherAssignmentsApi, groupsApi, periodFinalGradesApi, attendanceApi, subjectsApi, studentsApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

type ReportCategory = 'admin' | 'academic' | 'evaluation' | 'attendance' | 'official' | 'alerts' | 'config'

interface ReportItem {
  id: string
  name: string
  description: string
  icon: any
  available: boolean
  feature?: string  // Feature requerida para mostrar este reporte
}

interface CategoryItem {
  id: ReportCategory
  name: string
  icon: any
  color: string
  feature?: string  // Feature requerida para mostrar esta categoría
}

// Mapeo de categorías a features de REPORTS:
// Cada categoría tiene su propia feature para control granular
const reportCategories: CategoryItem[] = [
  { id: 'admin', name: 'Administración / Rectoría', icon: Briefcase, color: 'blue', feature: 'RPT_ADMIN' },
  { id: 'academic', name: 'Académico (Coordinación)', icon: BookOpen, color: 'green', feature: 'RPT_ACAD' },
  { id: 'evaluation', name: 'Evaluación (SIEE)', icon: ClipboardList, color: 'purple', feature: 'RPT_EVAL' },
  { id: 'attendance', name: 'Asistencia', icon: Calendar, color: 'amber', feature: 'RPT_ATT' },
  { id: 'official', name: 'Boletines', icon: FileText, color: 'indigo', feature: 'RPT_BULLETIN' },
  { id: 'alerts', name: 'Alertas y Estadísticas', icon: Bell, color: 'red', feature: 'RPT_STAT' },
  { id: 'config', name: 'Configuración / Control', icon: Settings, color: 'slate', feature: 'RPT_CONFIG' },
]

const reportsByCategory: Record<ReportCategory, ReportItem[]> = {
  admin: [
    { id: 'load-teacher', name: 'Carga académica por docente', description: 'Asignaturas y grupos asignados a cada docente', icon: Users, available: true, feature: 'RPT_ADMIN_LOAD_TEACHER' },
    { id: 'load-group', name: 'Carga académica por grupo', description: 'Docentes y asignaturas por cada grupo', icon: GraduationCap, available: true, feature: 'RPT_ADMIN_LOAD_GROUP' },
    { id: 'load-area', name: 'Carga académica por área', description: 'Distribución de carga por áreas académicas', icon: Layers, available: true, feature: 'RPT_ADMIN_LOAD_AREA' },
    { id: 'coverage-no-teacher', name: 'Asignaturas sin docente', description: 'Asignaturas que no tienen docente asignado', icon: UserX, available: true, feature: 'RPT_ADMIN_NO_TEACHER' },
    { id: 'coverage-incomplete', name: 'Grupos sin asignación completa', description: 'Grupos con asignaturas pendientes de asignar', icon: AlertTriangle, available: true, feature: 'RPT_ADMIN_INCOMPLETE' },
    { id: 'teachers-active', name: 'Docentes activos', description: 'Listado de docentes activos en la institución', icon: UserCheck, available: true, feature: 'RPT_ADMIN_TEACHERS_ACTIVE' },
    { id: 'teachers-no-load', name: 'Docentes sin carga', description: 'Docentes sin asignación académica', icon: UserX, available: true, feature: 'RPT_ADMIN_TEACHERS_NO_LOAD' },
    { id: 'teachers-hours', name: 'Horas asignadas vs contratadas', description: 'Comparativo de horas por docente', icon: Clock, available: true, feature: 'RPT_ADMIN_TEACHERS_HOURS' },
  ],
  academic: [
    { id: 'avg-group', name: 'Promedios por grupo', description: 'Rendimiento académico promedio de cada grupo', icon: BarChart3, available: true, feature: 'RPT_ACAD_AVG_GROUP' },
    { id: 'avg-area', name: 'Promedios por área', description: 'Rendimiento académico promedio por área', icon: Layers, available: true, feature: 'RPT_ACAD_AVG_AREA' },
    { id: 'avg-institution', name: 'Promedios institucionales', description: 'Indicadores generales de la institución', icon: TrendingUp, available: true, feature: 'RPT_ACAD_AVG_INST' },
    { id: 'approved-areas', name: 'Áreas aprobadas', description: 'Estudiantes que aprobaron cada área', icon: CheckCircle, available: true, feature: 'RPT_ACAD_APPROVED' },
    { id: 'failed-areas', name: 'Áreas reprobadas', description: 'Estudiantes que reprobaron cada área', icon: XCircle, available: true, feature: 'RPT_ACAD_FAILED' },
    { id: 'promotion-rate', name: 'Porcentaje de promoción', description: 'Tasa de promoción por grupo y grado', icon: TrendingUp, available: true, feature: 'RPT_ACAD_PROMOTION' },
    { id: 'period-comparison', name: 'Comparativo por períodos', description: 'Evolución del rendimiento entre períodos', icon: Activity, available: true, feature: 'RPT_ACAD_PERIODS' },
    { id: 'student-history', name: 'Historial por estudiante', description: 'Trayectoria académica individual', icon: History, available: true, feature: 'RPT_ACAD_HISTORY' },
    { id: 'cons-subjects', name: 'Asignaturas - Consolidado Acumulado', description: 'Tabla con el acumulado de los estudiantes en cada una de las asignaturas', icon: BookOpen, available: true, feature: 'RPT_ACAD_CONS_SUBJ' },
    { id: 'cons-areas', name: 'Áreas - Consolidado Acumulado', description: 'Acumula los consolidados de las Áreas durante los períodos solicitados', icon: Layers, available: true, feature: 'RPT_ACAD_CONS_AREAS' },
    { id: 'cons-dimensions', name: 'Dimensiones - Consolidado Acumulado', description: 'Tabla con el acumulado de los estudiantes en cada una de las asignaturas por dimensión', icon: PieChart, available: true, feature: 'RPT_ACAD_CONS_DIM' },
    { id: 'min-grade', name: 'Nota Mínima', description: 'Calcula la nota mínima que necesita el estudiante en cada asignatura para no reprobar', icon: AlertTriangle, available: true, feature: 'RPT_ACAD_MIN_GRADE' },
    { id: 'cons-dba', name: 'DBA - Cons. Acumulado Por Período', description: 'Tabla con el acumulado de los estudiantes en cada una de las asignaturas por DBA', icon: FileText, available: true, feature: 'RPT_ACAD_DBA' },
    { id: 'cons-pecab', name: 'Pecab - Cons. Acumulado Por Período', description: 'Tabla con el acumulado de los estudiantes en cada una de las asignaturas por PECAB', icon: ClipboardList, available: true, feature: 'RPT_ACAD_PECAB' },
    { id: 'report-period-avg', name: 'Reporte Acumulado por Período', description: 'Refleja un promedio de notas de convivencia por períodos', icon: Calendar, available: true, feature: 'RPT_ACAD_PERIOD_AVG' },
  ],
  evaluation: [
    { id: 'siee-compliance', name: 'Cumplimiento del SIEE', description: 'Porcentajes por dimensión evaluativa', icon: PieChart, available: true, feature: 'RPT_EVAL_SIEE' },
    { id: 'activities-created', name: 'Actividades evaluativas creadas', description: 'Cantidad de actividades por docente/asignatura', icon: ClipboardList, available: true, feature: 'RPT_EVAL_ACTIVITIES' },
    { id: 'activity-types', name: 'Tipos de actividades', description: 'Distribución por tipo de evaluación', icon: PieChart, available: true, feature: 'RPT_EVAL_TYPES' },
    { id: 'dimension-weight', name: 'Peso por dimensión', description: 'Distribución de pesos evaluativos', icon: BarChart3, available: true, feature: 'RPT_EVAL_WEIGHTS' },
    { id: 'pending-grades', name: 'Docentes con notas incompletas', description: 'Docentes que no han completado calificaciones', icon: AlertTriangle, available: true, feature: 'RPT_EVAL_PENDING' },
    { id: 'open-periods', name: 'Períodos abiertos', description: 'Estado de cierre de períodos académicos', icon: Calendar, available: true, feature: 'RPT_EVAL_PERIODS' },
  ],
  attendance: [
    { id: 'att-group', name: 'Asistencia por grupo', description: 'Estado general de asistencia de un grupo o curso', icon: GraduationCap, available: true, feature: 'RPT_ATT_GROUP' },
    { id: 'att-student', name: 'Asistencia por estudiante', description: 'Seguimiento individual de asistencia (casos especiales)', icon: Users, available: true, feature: 'RPT_ATT_STUDENT' },
    { id: 'att-subject', name: 'Asistencia por asignatura', description: 'Analizar comportamiento por materia', icon: ClipboardList, available: true, feature: 'RPT_ATT_SUBJECT' },
    { id: 'att-teacher', name: 'Asistencia por docente', description: 'Control institucional del registro de clases', icon: UserCheck, available: true, feature: 'RPT_ATT_TEACHER' },
    { id: 'att-critical', name: 'Inasistencias críticas', description: 'Detectar estudiantes en riesgo por inasistencia', icon: AlertTriangle, available: true, feature: 'RPT_ATT_CRITICAL' },
    { id: 'att-consolidated', name: 'Consolidado institucional', description: 'Datos macro para informes oficiales', icon: BarChart3, available: true, feature: 'RPT_ATT_CONSOLIDATED' },
  ],
  official: [
    { id: 'report-partial', name: 'Boletines parciales', description: 'Boletines de período', icon: FileText, available: true, feature: 'RPT_BULLETIN_PARTIAL' },
    { id: 'report-final', name: 'Boletines finales', description: 'Boletines de fin de año', icon: FileCheck, available: true, feature: 'RPT_BULLETIN_FINAL' },
    { id: 'promoted', name: 'Estudiantes promovidos', description: 'Listado de estudiantes promovidos', icon: CheckCircle, available: true, feature: 'RPT_BULLETIN_PROMOTED' },
    { id: 'not-promoted', name: 'Estudiantes no promovidos', description: 'Listado de estudiantes reprobados', icon: XCircle, available: true, feature: 'RPT_BULLETIN_NOT_PROMOTED' },
    { id: 'recovery', name: 'Estudiantes en recuperación', description: 'Estudiantes con actividades de recuperación', icon: Clock, available: true, feature: 'RPT_BULLETIN_RECOVERY' },
  ],
  alerts: [
    { id: 'alert-low-performance', name: 'Bajo rendimiento', description: 'Estudiantes con promedio bajo', icon: TrendingDown, available: true, feature: 'RPT_STAT_LOW_PERF' },
    { id: 'alert-fail-risk', name: 'Riesgo de reprobación', description: 'Estudiantes en riesgo de perder el año', icon: AlertTriangle, available: true, feature: 'RPT_STAT_FAIL_RISK' },
    { id: 'alert-attendance', name: 'Inasistencia reiterada', description: 'Estudiantes con patrón de inasistencia', icon: UserX, available: true, feature: 'RPT_STAT_ATTENDANCE' },
  ],
  config: [
    { id: 'config-areas', name: 'Áreas configuradas', description: 'Listado de áreas académicas', icon: Layers, available: true, feature: 'RPT_CONFIG_AREAS' },
    { id: 'config-subjects', name: 'Asignaturas configuradas', description: 'Listado de asignaturas por área', icon: BookOpen, available: true, feature: 'RPT_CONFIG_SUBJECTS' },
    { id: 'config-periods', name: 'Períodos académicos', description: 'Configuración de períodos', icon: Calendar, available: true, feature: 'RPT_CONFIG_PERIODS' },
    { id: 'config-siee', name: 'Porcentajes SIEE', description: 'Configuración del sistema de evaluación', icon: Settings, available: true, feature: 'RPT_CONFIG_SIEE' },
    { id: 'audit-changes', name: 'Cambios administrativos', description: 'Historial de modificaciones', icon: History, available: true, feature: 'RPT_CONFIG_AUDIT' },
    { id: 'audit-adjustments', name: 'Historial de ajustes', description: 'Ajustes de notas y correcciones', icon: ClipboardList, available: true, feature: 'RPT_CONFIG_ADJUSTMENTS' },
  ],
}

export default function Reports() {
  const { hasFeature } = useAuth()
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory | null>(null)
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)

  // Filtrar reportes individuales según features habilitadas
  const getFilteredReports = (categoryId: ReportCategory) => {
    const reports = reportsByCategory[categoryId] || []
    // Si la categoría está habilitada, mostrar los reportes que tengan su feature habilitada
    return reports.filter(report => !report.feature || hasFeature(report.feature))
  }

  // Filtrar categorías: mostrar si la categoría está habilitada Y tiene al menos un reporte habilitado
  const filteredCategories = useMemo(() => {
    return reportCategories.filter(cat => {
      // Verificar si la categoría principal está habilitada
      const categoryEnabled = !cat.feature || hasFeature(cat.feature)
      if (!categoryEnabled) return false
      
      // Verificar si tiene al menos un reporte habilitado
      const filteredReports = getFilteredReports(cat.id)
      return filteredReports.length > 0
    })
  }, [hasFeature])

  // Seleccionar primera categoría disponible al cargar
  useEffect(() => {
    if (filteredCategories.length > 0 && !selectedCategory) {
      setSelectedCategory(filteredCategories[0].id)
    }
  }, [filteredCategories, selectedCategory])
  
  // Datos reales
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [terms, setTerms] = useState<any[]>([])
  const [groups, setGroups] = useState<any[]>([])
  const [dashboardStats, setDashboardStats] = useState({
    institutionalAverage: 0,
    approvalRate: 0,
    attendanceRate: 0,
    sieeCompliance: 0,
    totalStudents: 0,
    totalTeachers: 0,
    totalGroups: 0,
    pendingGrades: 0,
  })
  const [, setLoadingStats] = useState(true)
  
  // Datos de reportes
  const [teacherLoadData, setTeacherLoadData] = useState<any[]>([])
  const [groupLoadData, setGroupLoadData] = useState<any[]>([])
  const [studentsGradesData, setStudentsGradesData] = useState<any[]>([])
  const [attendanceData, setAttendanceData] = useState<any[]>([])
  const [attendanceDetailData, setAttendanceDetailData] = useState<any[]>([])
  const [attendanceBySubjectData, setAttendanceBySubjectData] = useState<any[]>([])
  const [teacherComplianceData, setTeacherComplianceData] = useState<any[]>([])
  const [criticalAbsencesData, setCriticalAbsencesData] = useState<any[]>([])
  const [consolidatedData, setConsolidatedData] = useState<{ byGrade: any[], bySubject: any[], byPeriod: any[] }>({ byGrade: [], bySubject: [], byPeriod: [] })
  const [alertsData, setAlertsData] = useState<any[]>([])
  const [filterMinPercent, setFilterMinPercent] = useState('80')
  const [loadingReport, setLoadingReport] = useState(false)
  const [students, setStudents] = useState<any[]>([])
  const [filterStudentId, setFilterStudentId] = useState('all')
  
  // Filtros específicos
  const [filterYear, setFilterYear] = useState('')
  const [filterLevel, setFilterLevel] = useState('all')
  const [filterGrade, setFilterGrade] = useState('all')
  const [filterPeriod, setFilterPeriod] = useState('')
  const [filterProcess, setFilterProcess] = useState('all')
  const [showOnlyFailed, setShowOnlyFailed] = useState(false)
  const [showGrades, setShowGrades] = useState(true)
  const [showPerformance, setShowPerformance] = useState(false)
  const [decimalPlaces, setDecimalPlaces] = useState('1')
  const [showRecovery, setShowRecovery] = useState(false)
  const [searchStudent, setSearchStudent] = useState('')
  
  // Filtros de asistencia
  const [filterSubject, setFilterSubject] = useState('all')
  const [filterTeacher, setFilterTeacher] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [subjects, setSubjects] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])

  // Cargar años académicos
  useEffect(() => {
    const loadYears = async () => {
      try {
        const response = await academicYearsApi.getAll()
        const years = response.data || []
        setAcademicYears(years)
        const activeYear = years.find((y: any) => y.status === 'ACTIVE') || years[0]
        if (activeYear) setFilterYear(activeYear.id)
      } catch (err) {
        console.error('Error loading years:', err)
      }
    }
    loadYears()
  }, [])

  // Cargar períodos, grupos, asignaturas y docentes cuando cambia el año
  useEffect(() => {
    const loadData = async () => {
      if (!filterYear) return
      try {
        const [termsRes, groupsRes, subjectsRes, assignmentsRes] = await Promise.all([
          academicTermsApi.getAll(filterYear),
          groupsApi.getAll(),
          subjectsApi.getAll(),
          teacherAssignmentsApi.getAll({ academicYearId: filterYear })
        ])
        setTerms(termsRes.data || [])
        setGroups(groupsRes.data || [])
        setSubjects(subjectsRes.data || [])
        
        // Extraer docentes únicos de las asignaciones
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
        setStudents(response.data || [])
      } catch (err) {
        console.error('Error loading students:', err)
        setStudents([])
      }
    }
    loadStudents()
  }, [filterGrade])

  // Cargar estadísticas del dashboard
  useEffect(() => {
    const loadStats = async () => {
      if (!filterYear) return
      setLoadingStats(true)
      try {
        const assignmentsRes = await teacherAssignmentsApi.getAll({ academicYearId: filterYear })
        
        const assignments = assignmentsRes.data || []
        
        // Contar docentes únicos
        const uniqueTeachers = new Set(assignments.map((a: any) => a.teacherId))
        
        // Contar estudiantes (aproximado basado en grupos)
        let totalStudents = 0
        const groupIds = [...new Set(assignments.map((a: any) => a.group?.id).filter(Boolean))]
        
        // Calcular promedio institucional si hay período seleccionado
        let institutionalAvg = 0
        let approvalRate = 0
        
        if (filterPeriod && groupIds.length > 0) {
          let allGrades: number[] = []
          let approvedCount = 0
          let totalGradesCount = 0
          
          for (const groupId of groupIds) {
            try {
              const gradesRes = await periodFinalGradesApi.getByGroup(groupId as string, filterPeriod)
              const grades = gradesRes.data || []
              grades.forEach((g: any) => {
                const score = Number(g.finalScore)
                if (!isNaN(score)) {
                  allGrades.push(score)
                  totalGradesCount++
                  if (score >= 3.0) approvedCount++
                }
              })
            } catch (err) {
              // Ignorar errores de grupos individuales
            }
          }
          
          if (allGrades.length > 0) {
            institutionalAvg = allGrades.reduce((a, b) => a + b, 0) / allGrades.length
            approvalRate = (approvedCount / totalGradesCount) * 100
          }
        }
        
        setDashboardStats({
          institutionalAverage: institutionalAvg,
          approvalRate: approvalRate,
          attendanceRate: 0, // TODO: Calcular desde asistencia
          sieeCompliance: 0, // TODO: Calcular desde evaluaciones
          totalStudents: totalStudents,
          totalTeachers: uniqueTeachers.size,
          totalGroups: groupIds.length,
          pendingGrades: 0, // TODO: Calcular docentes con notas pendientes
        })
      } catch (err) {
        console.error('Error loading stats:', err)
      } finally {
        setLoadingStats(false)
      }
    }
    loadStats()
  }, [filterYear, filterPeriod])

  const currentCategory = selectedCategory ? reportCategories.find(c => c.id === selectedCategory) : null
  const currentReports = selectedCategory ? getFilteredReports(selectedCategory) : []
  const currentReportData = currentReports.find((r: ReportItem) => r.id === selectedReport)

  const getCategoryColor = (color: string) => {
    const colors: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-600 border-blue-200',
      green: 'bg-green-100 text-green-600 border-green-200',
      purple: 'bg-purple-100 text-purple-600 border-purple-200',
      amber: 'bg-amber-100 text-amber-600 border-amber-200',
      indigo: 'bg-indigo-100 text-indigo-600 border-indigo-200',
      red: 'bg-red-100 text-red-600 border-red-200',
      slate: 'bg-slate-100 text-slate-600 border-slate-200',
    }
    return colors[color] || colors.blue
  }

  const handleSelectReport = async (reportId: string) => {
    setSelectedReport(reportId)
    setShowReport(true)
    await loadReportData(reportId)
  }

  // Función para exportar a CSV
  const exportToCSV = () => {
    let csvContent = ''
    let filename = 'reporte'

    if (selectedReport === 'att-group') {
      filename = 'asistencia_por_grupo'
      csvContent = 'Nro,Estudiante,Grupo,Total Clases,Asistencias,Fallas,Tardanzas,Excusas,% Asist.,Estado\n'
      attendanceData.forEach((row, idx) => {
        csvContent += `${idx + 1},"${row.name || ''}","${row.group || ''}",${row.totalClasses || 0},${row.attended || 0},${row.absent || 0},${row.late || 0},${row.excused || 0},${row.pct || 0}%,${row.status || ''}\n`
      })
    } else if (selectedReport === 'att-student') {
      filename = 'asistencia_por_estudiante'
      csvContent = 'Nro,Fecha,Estudiante,Grupo,Asignatura,Docente,Estado,Observación\n'
      attendanceDetailData.forEach((row, idx) => {
        const statusText = row.status === 'PRESENT' ? 'Presente' : row.status === 'ABSENT' ? 'Ausente' : row.status === 'LATE' ? 'Tarde' : 'Excusa'
        csvContent += `${idx + 1},"${row.date || ''}","${row.student || ''}","${row.group || ''}","${row.subject || ''}","${row.teacher || ''}",${statusText},"${row.observations || ''}"\n`
      })
    } else if (selectedReport === 'att-subject') {
      filename = 'asistencia_por_asignatura'
      csvContent = 'Nro,Estudiante,Grupo,Total Clases,Asistencias,Fallas,% Asist.,Estado\n'
      attendanceBySubjectData.forEach((row, idx) => {
        csvContent += `${idx + 1},"${row.name || ''}","${row.group || ''}",${row.totalClasses || 0},${row.attended || 0},${row.absent || 0},${row.pct || 0}%,${row.status || ''}\n`
      })
    } else if (selectedReport === 'att-teacher') {
      filename = 'asistencia_por_docente'
      csvContent = 'Nro,Docente,Clases Programadas,Clases Registradas,Clases NO Registradas,% Cumplimiento\n'
      teacherComplianceData.forEach((row, idx) => {
        csvContent += `${idx + 1},"${row.teacher || ''}",${row.classesScheduled || 0},${row.classesRegistered || 0},${row.classesNotRegistered || 0},${row.complianceRate || 0}%\n`
      })
    } else if (selectedReport === 'att-critical') {
      filename = 'inasistencias_criticas'
      csvContent = 'Nro,Estudiante,Grupo,Total Clases,Fallas,% Asist.,Estado\n'
      criticalAbsencesData.forEach((row, idx) => {
        csvContent += `${idx + 1},"${row.name || ''}","${row.group || ''}",${row.totalClasses || 0},${row.absent || 0},${row.pct || 0}%,${row.status || ''}\n`
      })
    } else if (selectedReport === 'att-consolidated') {
      filename = 'consolidado_institucional'
      csvContent = 'ASISTENCIA POR GRADO\nNro,Grado,Estudiantes,Total Registros,Presentes,Ausentes,% Asistencia\n'
      consolidatedData.byGrade.forEach((g, idx) => {
        csvContent += `${idx + 1},"${g.grade}",${g.totalStudents},${g.totalRecords},${g.present},${g.absent},${g.pct}%\n`
      })
      csvContent += '\nASISTENCIA POR ASIGNATURA\nNro,Asignatura,Registros,Total Registros,Presentes,Ausentes,% Asistencia\n'
      consolidatedData.bySubject.forEach((s, idx) => {
        csvContent += `${idx + 1},"${s.subject}",${s.totalStudents},${s.totalRecords},${s.present},${s.absent},${s.pct}%\n`
      })
    } else {
      alert('No hay datos para exportar en este reporte')
      return
    }

    if (!csvContent || csvContent.split('\n').length <= 1) {
      alert('No hay datos para exportar')
      return
    }

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  // Función para imprimir
  const handlePrint = () => {
    window.print()
  }

  // Cargar datos del reporte seleccionado
  const loadReportData = async (reportId: string) => {
    console.log('loadReportData called with reportId:', reportId, 'filterYear:', filterYear, 'filterGrade:', filterGrade)
    if (!filterYear) {
      console.log('filterYear is empty, returning early')
      return
    }
    setLoadingReport(true)
    
    try {
      // Reportes de carga docente
      if (reportId === 'load-teacher' || reportId === 'teachers-active' || reportId === 'teachers-no-load') {
        const assignmentsRes = await teacherAssignmentsApi.getAll({ academicYearId: filterYear })
        const assignments = assignmentsRes.data || []
        
        // Agrupar por docente
        const teacherMap = new Map<string, any>()
        assignments.forEach((a: any) => {
          const teacherId = a.teacherId
          if (!teacherMap.has(teacherId)) {
            teacherMap.set(teacherId, {
              id: teacherId,
              name: a.teacher ? `${a.teacher.firstName} ${a.teacher.lastName}`.toUpperCase() : 'Sin nombre',
              subjects: new Set(),
              groups: new Set(),
              hours: 0
            })
          }
          const teacher = teacherMap.get(teacherId)
          if (a.subject?.name) teacher.subjects.add(a.subject.name)
          if (a.group) teacher.groups.add(`${a.group.grade?.name || ''} ${a.group.name}`)
          teacher.hours += a.weeklyHours || 2
        })
        
        const teacherData = Array.from(teacherMap.values()).map((t, idx) => ({
          nro: idx + 1,
          name: t.name,
          subjects: Array.from(t.subjects).join(', '),
          groups: Array.from(t.groups).join(', '),
          hours: t.hours,
          status: t.hours >= 10 ? 'Completo' : 'Parcial'
        }))
        
        setTeacherLoadData(teacherData)
      }
      
      // Reportes de carga por grupo
      if (reportId === 'load-group') {
        const assignmentsRes = await teacherAssignmentsApi.getAll({ academicYearId: filterYear })
        const assignments = assignmentsRes.data || []
        
        // Agrupar por grupo
        const groupMap = new Map<string, any>()
        assignments.forEach((a: any) => {
          const groupId = a.group?.id
          if (!groupId) return
          if (!groupMap.has(groupId)) {
            groupMap.set(groupId, {
              id: groupId,
              name: `${a.group.grade?.name || ''} ${a.group.name}`,
              director: '',
              subjects: new Set(),
              teachers: new Set()
            })
          }
          const group = groupMap.get(groupId)
          if (a.subject?.name) group.subjects.add(a.subject.name)
          if (a.teacherId) group.teachers.add(a.teacherId)
        })
        
        const groupData = Array.from(groupMap.values()).map((g) => ({
          group: g.name,
          director: g.director || 'Sin asignar',
          students: 0,
          subjects: g.subjects.size,
          teachers: g.teachers.size,
          complete: g.subjects.size >= 8
        }))
        
        setGroupLoadData(groupData)
      }
      
      // Reportes académicos - notas por estudiante
      if (reportId === 'cons-subjects' || reportId === 'avg-group') {
        if (!filterPeriod) return
        
        const assignmentsRes = await teacherAssignmentsApi.getAll({ academicYearId: filterYear })
        const assignments = assignmentsRes.data || []
        const groupIds = [...new Set(assignments.map((a: any) => a.group?.id).filter(Boolean))]
        
        // Obtener notas de todos los grupos
        const studentGradesMap = new Map<string, any>()
        
        for (const groupId of groupIds) {
          if (filterGrade !== 'all' && groupId !== filterGrade) continue
          
          try {
            const gradesRes = await periodFinalGradesApi.getByGroup(groupId as string, filterPeriod)
            const grades = gradesRes.data || []
            
            grades.forEach((g: any) => {
              const studentId = g.studentEnrollmentId
              const student = g.studentEnrollment?.student
              if (!studentGradesMap.has(studentId)) {
                studentGradesMap.set(studentId, {
                  id: studentId,
                  name: student ? `${student.lastName} ${student.firstName}`.toUpperCase() : 'Estudiante',
                  grades: {}
                })
              }
              const studentData = studentGradesMap.get(studentId)
              studentData.grades[g.subject?.name || 'Asignatura'] = Number(g.finalScore)
            })
          } catch (err) {
            // Ignorar errores de grupos individuales
          }
        }
        
        const studentsData = Array.from(studentGradesMap.values()).map((s, idx) => {
          const gradeValues = Object.values(s.grades) as number[]
          const avg = gradeValues.length > 0 ? gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length : 0
          return {
            nro: idx + 1,
            name: s.name,
            grades: s.grades,
            average: avg
          }
        })
        
        setStudentsGradesData(studentsData)
      }
      
      // Reportes de asistencia
      if (reportId === 'att-group') {
        try {
          // Construir parámetros de filtro
          const params: any = {
            startDate: filterDateFrom || undefined,
            endDate: filterDateTo || undefined,
            subjectId: filterSubject !== 'all' ? filterSubject : undefined,
          }
          
          let rawData: any[] = []
          
          if (filterGrade && filterGrade !== 'all') {
            const response = await attendanceApi.getReportByGroup(filterGrade, filterYear, params)
            rawData = response.data || []
          } else {
            // Cargar todos los grupos
            const groupsRes = await groupsApi.getAll()
            const allGroups = groupsRes.data || []
            
            for (const group of allGroups) {
              try {
                const response = await attendanceApi.getReportByGroup(group.id, filterYear, params)
                const data = response.data || []
                rawData.push(...data)
              } catch (err) {
                // Ignorar errores de grupos individuales
              }
            }
          }
          
          // Mapear campos del backend a los esperados por el frontend
          rawData = rawData.map((item: any) => ({
            name: item.studentName || item.name,
            group: item.groupName || item.group,
            totalClasses: item.totalClasses || 0,
            attended: item.present || item.attended || 0,
            absent: item.absent || 0,
            late: item.late || 0,
            excused: item.excused || 0,
            pct: item.attendanceRate || item.pct || 0,
            status: item.status || 'Normal',
          }))
          
          // Aplicar filtro de estado (Normal/Alerta/Riesgo)
          if (filterStatus !== 'all') {
            rawData = rawData.filter((item: any) => item.status === filterStatus)
          }
          
          // Renumerar después de filtrar
          setAttendanceData(rawData.map((item, idx) => ({ ...item, nro: idx + 1 })))
        } catch (err) {
          console.error('Error loading attendance report:', err)
          setAttendanceData([])
        }
      }
      
      // Reporte de asistencia por estudiante (detallado)
      if (reportId === 'att-student') {
        try {
          const params: any = {
            academicYearId: filterYear,
            groupId: filterGrade !== 'all' ? filterGrade : undefined,
            subjectId: filterSubject !== 'all' ? filterSubject : undefined,
            startDate: filterDateFrom || undefined,
            endDate: filterDateTo || undefined,
            status: filterStatus !== 'all' ? filterStatus : undefined,
            studentEnrollmentId: filterStudentId !== 'all' ? filterStudentId : undefined,
          }
          
          const response = await attendanceApi.getDetailedReport(params)
          // Mapear campos del backend a los esperados por el frontend
          const mappedData = (response.data || []).map((item: any, idx: number) => ({
            nro: idx + 1,
            date: item.date ? new Date(item.date).toLocaleDateString('es-CO') : '',
            student: item.studentName || item.student || '',
            group: item.groupName || item.group || '',
            subject: item.subjectName || item.subject || '',
            teacher: item.teacherName || item.teacher || '',
            status: item.status || '',
            observations: item.observations || '',
          }))
          setAttendanceDetailData(mappedData)
        } catch (err) {
          console.error('Error loading student attendance report:', err)
          setAttendanceDetailData([])
        }
      }
      
      // Reporte de asistencia por asignatura
      if (reportId === 'att-subject') {
        try {
          const params: any = {
            startDate: filterDateFrom || undefined,
            endDate: filterDateTo || undefined,
            subjectId: filterSubject !== 'all' ? filterSubject : undefined,
          }
          
          let rawData: any[] = []
          
          if (filterGrade && filterGrade !== 'all') {
            const response = await attendanceApi.getReportByGroup(filterGrade, filterYear, params)
            rawData = response.data || []
          } else {
            // Cargar todos los grupos
            const groupsRes = await groupsApi.getAll()
            const allGroups = groupsRes.data || []
            
            for (const group of allGroups) {
              try {
                const response = await attendanceApi.getReportByGroup(group.id, filterYear, params)
                const data = response.data || []
                rawData.push(...data)
              } catch (err) {
                // Ignorar errores de grupos individuales
              }
            }
          }
          
          // Mapear campos del backend a los esperados por el frontend
          rawData = rawData.map((item: any) => ({
            name: item.studentName || item.name,
            group: item.groupName || item.group,
            totalClasses: item.totalClasses || 0,
            attended: item.present || item.attended || 0,
            absent: item.absent || 0,
            late: item.late || 0,
            excused: item.excused || 0,
            pct: item.attendanceRate || item.pct || 0,
            status: item.status || 'Normal',
          }))
          
          // Aplicar filtro de estado (Normal/Alerta/Riesgo)
          if (filterStatus !== 'all') {
            rawData = rawData.filter((item: any) => item.status === filterStatus)
          }
          
          // Renumerar después de filtrar
          setAttendanceBySubjectData(rawData.map((item, idx) => ({ ...item, nro: idx + 1 })))
        } catch (err) {
          console.error('Error loading subject attendance report:', err)
          setAttendanceBySubjectData([])
        }
      }
      
      // Reporte de gestión docente - clases programadas vs registradas
      if (reportId === 'att-teacher') {
        try {
          const params: any = {
            academicYearId: filterYear,
            teacherId: filterTeacher !== 'all' ? filterTeacher : undefined,
            groupId: filterGrade !== 'all' ? filterGrade : undefined,
            subjectId: filterSubject !== 'all' ? filterSubject : undefined,
            startDate: filterDateFrom || undefined,
            endDate: filterDateTo || undefined,
          }
          
          const response = await attendanceApi.getTeacherComplianceReport(params)
          // Mapear campos del backend a los esperados por el frontend
          const mappedData = (response.data || []).map((item: any, idx: number) => ({
            nro: idx + 1,
            teacher: item.teacherName || item.teacher || '',
            classesScheduled: item.classesScheduled || 0,
            classesRegistered: item.classesRegistered || 0,
            classesNotRegistered: item.classesNotRegistered || 0,
            complianceRate: item.complianceRate || 0,
          }))
          setTeacherComplianceData(mappedData)
        } catch (err) {
          console.error('Error loading teacher compliance report:', err)
          setTeacherComplianceData([])
        }
      }
      
      // Reporte de inasistencias críticas
      if (reportId === 'att-critical') {
        try {
          const params: any = {
            startDate: filterDateFrom || undefined,
            endDate: filterDateTo || undefined,
            subjectId: filterSubject !== 'all' ? filterSubject : undefined,
          }
          
          let rawData: any[] = []
          
          if (filterGrade && filterGrade !== 'all') {
            const response = await attendanceApi.getReportByGroup(filterGrade, filterYear, params)
            rawData = response.data || []
          } else {
            // Cargar todos los grupos
            const groupsRes = await groupsApi.getAll()
            const allGroups = groupsRes.data || []
            
            for (const group of allGroups) {
              try {
                const response = await attendanceApi.getReportByGroup(group.id, filterYear, params)
                const data = response.data || []
                rawData.push(...data)
              } catch (err) {
                // Ignorar errores de grupos individuales
              }
            }
          }
          
          // Mapear campos del backend a los esperados por el frontend
          rawData = rawData.map((item: any) => ({
            name: item.studentName || item.name,
            group: item.groupName || item.group,
            totalClasses: item.totalClasses || 0,
            attended: item.present || item.attended || 0,
            absent: item.absent || 0,
            late: item.late || 0,
            excused: item.excused || 0,
            pct: item.attendanceRate || item.pct || 0,
            status: item.status || 'Normal',
          }))
          
          // Filtrar por porcentaje mínimo configurable
          const minPct = parseInt(filterMinPercent) || 80
          rawData = rawData.filter((item: any) => item.pct < minPct)
          
          // Filtrar por estado si está seleccionado
          if (filterStatus !== 'all') {
            rawData = rawData.filter((item: any) => item.status === filterStatus)
          }
          
          // Ordenar por porcentaje ascendente (los más críticos primero)
          rawData.sort((a, b) => a.pct - b.pct)
          
          // Renumerar después de filtrar
          setCriticalAbsencesData(rawData.map((item, idx) => ({ ...item, nro: idx + 1 })))
        } catch (err) {
          console.error('Error loading critical absences report:', err)
          setCriticalAbsencesData([])
        }
      }
      
      // Reporte consolidado institucional - usando endpoint optimizado
      if (reportId === 'att-consolidated') {
        try {
          const params = {
            academicYearId: filterYear,
            startDate: filterDateFrom || undefined,
            endDate: filterDateTo || undefined,
            subjectId: filterSubject !== 'all' ? filterSubject : undefined,
          }
          
          const response = await attendanceApi.getConsolidatedReport(params)
          
          // Mapear campos del backend a los esperados por el frontend
          const mappedByGrade = (response.data?.byGrade || []).map((item: any, idx: number) => ({
            nro: idx + 1,
            grade: item.name || item.grade || '',
            totalStudents: item.totalStudents || '-',
            totalClasses: item.total || item.totalClasses || 0,
            totalAttended: item.present || item.totalAttended || 0,
            totalAbsent: item.absent || item.totalAbsent || 0,
            pct: item.attendanceRate || item.pct || 0,
          }))
          
          const mappedBySubject = (response.data?.bySubject || []).map((item: any, idx: number) => ({
            nro: idx + 1,
            subject: item.name || item.subject || '',
            totalRecords: item.total || item.totalRecords || 0,
            totalClasses: item.total || item.totalClasses || 0,
            totalAttended: item.present || item.totalAttended || 0,
            totalAbsent: item.absent || item.totalAbsent || 0,
            pct: item.attendanceRate || item.pct || 0,
          }))
          
          setConsolidatedData({ 
            byGrade: mappedByGrade, 
            bySubject: mappedBySubject, 
            byPeriod: [] 
          })
        } catch (err) {
          console.error('Error loading consolidated report:', err)
          setConsolidatedData({ byGrade: [], bySubject: [], byPeriod: [] })
        }
      }
      
      // Reportes de alertas - bajo rendimiento
      if (reportId === 'alert-low-performance' || reportId === 'alert-fail-risk') {
        if (!filterPeriod) return
        
        const assignmentsRes = await teacherAssignmentsApi.getAll({ academicYearId: filterYear })
        const assignments = assignmentsRes.data || []
        const groupIds = [...new Set(assignments.map((a: any) => a.group?.id).filter(Boolean))]
        
        const alertsList: any[] = []
        
        for (const groupId of groupIds) {
          try {
            const gradesRes = await periodFinalGradesApi.getByGroup(groupId as string, filterPeriod)
            const grades = gradesRes.data || []
            
            // Agrupar por estudiante
            const studentGrades = new Map<string, any>()
            grades.forEach((g: any) => {
              const studentId = g.studentEnrollmentId
              const student = g.studentEnrollment?.student
              if (!studentGrades.has(studentId)) {
                studentGrades.set(studentId, {
                  name: student ? `${student.lastName} ${student.firstName}`.toUpperCase() : 'Estudiante',
                  group: g.studentEnrollment?.group?.name || '',
                  grades: [],
                  failedCount: 0
                })
              }
              const sData = studentGrades.get(studentId)
              const score = Number(g.finalScore)
              sData.grades.push(score)
              if (score < 3.0) sData.failedCount++
            })
            
            // Filtrar estudiantes con bajo rendimiento
            studentGrades.forEach((s) => {
              const avg = s.grades.length > 0 ? s.grades.reduce((a: number, b: number) => a + b, 0) / s.grades.length : 0
              if (avg < 3.5 || s.failedCount > 0) {
                alertsList.push({
                  nro: alertsList.length + 1,
                  name: s.name,
                  group: s.group,
                  avg: avg,
                  failed: s.failedCount,
                  risk: avg < 3.0 ? 'Alto' : s.failedCount >= 2 ? 'Alto' : 'Medio'
                })
              }
            })
          } catch (err) {
            // Ignorar errores
          }
        }
        
        setAlertsData(alertsList)
      }
      
    } catch (err) {
      console.error('Error loading report data:', err)
    } finally {
      setLoadingReport(false)
    }
  }

  const handleBack = () => {
    setShowReport(false)
    setSelectedReport(null)
  }


  // Determinar la categoría del reporte seleccionado
  const getReportCategory = (reportId: string | null): ReportCategory | null => {
    if (!reportId) return selectedCategory
    for (const [category, reports] of Object.entries(reportsByCategory)) {
      if (reports.some((r: ReportItem) => r.id === reportId)) {
        return category as ReportCategory
      }
    }
    return selectedCategory
  }

  const reportCategory = getReportCategory(selectedReport)

  // Renderizar filtros según la categoría
  const renderFilters = () => {
    if (reportCategory === 'academic') {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Año Escolar</label>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="">Seleccionar...</option>
                {academicYears.map(year => (
                  <option key={year.id} value={year.id}>{year.year}{year.status === 'ACTIVE' ? ' - Activo' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nivel Educativo</label>
              <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todos</option>
                <option value="preescolar">Preescolar</option>
                <option value="primaria">Educación Básica Primaria</option>
                <option value="secundaria">Educación Básica Secundaria</option>
                <option value="media">Educación Media</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Grupo</label>
              <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todos</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>{group.grade?.name} {group.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ciclo</label>
              <select className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                {academicYears.map(year => (
                  <option key={year.id} value={year.id}>{year.year}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Período</label>
              <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="">Seleccionar...</option>
                {terms.map(term => (
                  <option key={term.id} value={term.id}>{term.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <label className="block text-xs font-medium text-slate-600">Filtrar Notas Por Proceso:</label>
              <select value={filterProcess} onChange={(e) => setFilterProcess(e.target.value)} className="px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todos</option>
                <option value="cognitivo">Cognitivo</option>
                <option value="procedimental">Procedimental</option>
                <option value="actitudinal">Actitudinal</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={showOnlyFailed} onChange={(e) => setShowOnlyFailed(e.target.checked)} className="w-4 h-4 rounded" />
              Ver solo reprobadas
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={showGrades} onChange={(e) => setShowGrades(e.target.checked)} className="w-4 h-4 rounded" />
              Ver Notas
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={showPerformance} onChange={(e) => setShowPerformance(e.target.checked)} className="w-4 h-4 rounded" />
              Ver Desempeños
            </label>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-slate-600">Decimales Promedio:</span>
              <select value={decimalPlaces} onChange={(e) => setDecimalPlaces(e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-sm w-16">
                <option value="0">0</option>
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={showRecovery} onChange={(e) => setShowRecovery(e.target.checked)} className="w-4 h-4 rounded" />
              Mostrar Recuperación por Separado
            </label>
          </div>
          <div className="flex items-center justify-between">
            <button className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Buscar</button>
          </div>
        </div>
      )
    }

    if (reportCategory === 'admin') {
      return (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Año Escolar</label>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="2025">2025</option>
                <option value="2024">2024</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Sede</label>
              <select className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todas</option>
                <option value="principal">Principal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Jornada</label>
              <select className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todas</option>
                <option value="manana">Mañana</option>
                <option value="tarde">Tarde</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Estado Docente</label>
              <select className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
                <option value="all">Todos</option>
              </select>
            </div>
          </div>
          <button className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Buscar</button>
        </div>
      )
    }

    if (reportCategory === 'attendance') {
      // Filtros para Asistencia por Grupo
      if (selectedReport === 'att-group') {
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Año</label>
                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="">Seleccionar...</option>
                  {academicYears.map(year => (
                    <option key={year.id} value={year.id}>{year.year}{year.status === 'ACTIVE' ? ' - Activo' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Grupo *</label>
                <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos los grupos</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{group.grade?.name} {group.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Período</label>
                <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos</option>
                  {terms.map(term => (
                    <option key={term.id} value={term.id}>{term.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Asignatura (opcional)</label>
                <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todas</option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Docente (opcional)</label>
                <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Desde</label>
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Hasta</label>
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos</option>
                  <option value="Normal">Normal (≥90%)</option>
                  <option value="Alerta">Alerta (80-89%)</option>
                  <option value="Riesgo">Riesgo (&lt;80%)</option>
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={() => {
                  if (selectedReport) loadReportData(selectedReport)
                }} className="px-4 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700">Buscar</button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">Buscar estudiante</label>
                <input 
                  type="text" 
                  value={searchStudent} 
                  onChange={(e) => setSearchStudent(e.target.value)} 
                  placeholder="Nombre del estudiante..." 
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" 
                />
              </div>
            </div>
          </div>
        )
      }
      
      // Filtros para Asistencia por Estudiante (seguimiento individual)
      if (selectedReport === 'att-student') {
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Año</label>
                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="">Seleccionar...</option>
                  {academicYears.map(year => (
                    <option key={year.id} value={year.id}>{year.year}{year.status === 'ACTIVE' ? ' - Activo' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Grupo</label>
                <select value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setFilterStudentId('all') }} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos los grupos</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{group.grade?.name} {group.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Estudiante *</label>
                <select value={filterStudentId} onChange={(e) => setFilterStudentId(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos los estudiantes</option>
                  {students.map(student => (
                    <option key={student.id} value={student.enrollmentId || student.id}>{student.lastName} {student.firstName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Período</label>
                <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos</option>
                  {terms.map(term => (
                    <option key={term.id} value={term.id}>{term.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Asignatura</label>
                <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todas</option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Desde</label>
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Hasta</label>
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos</option>
                  <option value="PRESENT">Presente</option>
                  <option value="ABSENT">Ausente</option>
                  <option value="LATE">Tarde</option>
                  <option value="EXCUSED">Excusa</option>
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={() => {
                  if (selectedReport) loadReportData(selectedReport)
                }} className="px-4 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700">Buscar</button>
              </div>
            </div>
          </div>
        )
      }
      
      // Filtros para Asistencia por Asignatura
      if (selectedReport === 'att-subject') {
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Año</label>
                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="">Seleccionar...</option>
                  {academicYears.map(year => (
                    <option key={year.id} value={year.id}>{year.year}{year.status === 'ACTIVE' ? ' - Activo' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Asignatura *</label>
                <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todas las asignaturas</option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Grupo</label>
                <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos los grupos</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{group.grade?.name} {group.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Docente</label>
                <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Período</label>
                <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos</option>
                  {terms.map(term => (
                    <option key={term.id} value={term.id}>{term.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Desde</label>
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Hasta</label>
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos</option>
                  <option value="Normal">Normal (≥90%)</option>
                  <option value="Alerta">Alerta (80-89%)</option>
                  <option value="Riesgo">Riesgo (&lt;80%)</option>
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={() => {
                  if (selectedReport) loadReportData(selectedReport)
                }} className="px-4 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700">Buscar</button>
              </div>
            </div>
          </div>
        )
      }
      
      // Filtros para Asistencia por Docente (gestión docente)
      if (selectedReport === 'att-teacher') {
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Año</label>
                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="">Seleccionar...</option>
                  {academicYears.map(year => (
                    <option key={year.id} value={year.id}>{year.year}{year.status === 'ACTIVE' ? ' - Activo' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Docente</label>
                <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos los docentes</option>
                  {teachers.map(teacher => (
                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Grupo</label>
                <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos los grupos</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{group.grade?.name} {group.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Asignatura</label>
                <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todas</option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Período</label>
                <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos</option>
                  {terms.map(term => (
                    <option key={term.id} value={term.id}>{term.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Desde</label>
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Hasta</label>
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div className="flex items-end">
                <button onClick={() => {
                  if (selectedReport) loadReportData(selectedReport)
                }} className="px-4 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700">Buscar</button>
              </div>
            </div>
          </div>
        )
      }
      
      // Filtros para Inasistencias Críticas
      if (selectedReport === 'att-critical') {
        return (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Año</label>
                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="">Seleccionar...</option>
                  {academicYears.map(year => (
                    <option key={year.id} value={year.id}>{year.year}{year.status === 'ACTIVE' ? ' - Activo' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Grupo</label>
                <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos los grupos</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{group.grade?.name} {group.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Período</label>
                <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos</option>
                  {terms.map(term => (
                    <option key={term.id} value={term.id}>{term.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Asignatura</label>
                <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todas</option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos</option>
                  <option value="Alerta">Alerta (80-89%)</option>
                  <option value="Riesgo">Riesgo (&lt;80%)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">% Mínimo (mostrar menores a)</label>
                <input 
                  type="number" 
                  value={filterMinPercent} 
                  onChange={(e) => setFilterMinPercent(e.target.value)} 
                  min="0" 
                  max="100" 
                  className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" 
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Desde</label>
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Hasta</label>
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div className="flex items-end">
                <button onClick={() => {
                  if (selectedReport) loadReportData(selectedReport)
                }} className="px-4 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700">Buscar Alertas</button>
              </div>
            </div>
          </div>
        )
      }
      
      // Filtros para Consolidado Institucional
      if (selectedReport === 'att-consolidated') {
        return (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Año</label>
                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="">Seleccionar...</option>
                  {academicYears.map(year => (
                    <option key={year.id} value={year.id}>{year.year}{year.status === 'ACTIVE' ? ' - Activo' : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Período</label>
                <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todos</option>
                  {terms.map(term => (
                    <option key={term.id} value={term.id}>{term.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Asignatura (opcional)</label>
                <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                  <option value="all">Todas</option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Desde</label>
                <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Hasta</label>
                <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={() => {
                if (selectedReport) loadReportData(selectedReport)
              }} className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">Generar Consolidado</button>
            </div>
          </div>
        )
      }
      
      // Filtros genéricos para otros reportes de asistencia
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Año</label>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="">Seleccionar...</option>
                {academicYears.map(year => (
                  <option key={year.id} value={year.id}>{year.year}{year.status === 'ACTIVE' ? ' - Activo' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Grupo</label>
              <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todos</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>{group.grade?.name} {group.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => {
                if (selectedReport) loadReportData(selectedReport)
              }} className="px-4 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700">Buscar</button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Año</label>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="2025">2025</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Período</label>
            <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="all">Todos</option>
              <option value="1">Período 1</option>
              <option value="2">Período 2</option>
              <option value="3">Período 3</option>
              <option value="4">Período 4</option>
            </select>
          </div>
          <div className="flex items-end">
            <button className="px-4 py-1.5 bg-slate-600 text-white rounded text-sm hover:bg-slate-700">Buscar</button>
          </div>
        </div>
      </div>
    )
  }

  // Vista de reporte seleccionado
  if (showReport && selectedReport) {
    return (
      <div>
        {/* Header del reporte */}
        <div className="flex items-center gap-4 mb-4">
          <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{currentReportData?.name}</h1>
            <p className="text-sm text-slate-500">{currentReportData?.description}</p>
          </div>
        </div>

        {/* Filtros específicos */}
        {renderFilters()}

        {/* Barra de acciones */}
        <div className="flex items-center justify-between my-4">
          <div className="flex items-center gap-2">
            <button 
              onClick={exportToCSV}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              <Download className="w-4 h-4" />
              Exportar
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-600 text-white rounded text-sm hover:bg-slate-700"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Grupo: {filterGrade === 'all' ? 'Todos' : groups.find(g => g.id === filterGrade)?.name || filterGrade} | Período: {terms.find(t => t.id === filterPeriod)?.name || 'Todos'} | Fecha: {filterDateFrom && filterDateTo ? `${filterDateFrom} al ${filterDateTo}` : new Date().toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Buscar:</span>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                placeholder="Nombre estudiante..."
                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded text-sm w-48"
              />
            </div>
          </div>
        </div>

        {/* Tabla de datos según el reporte */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            {/* REPORTES ADMINISTRATIVOS */}
            {selectedReport === 'load-teacher' && (
              <table className="w-full text-sm">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Nro</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700 min-w-[250px]">Docente</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Asignaturas</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Grupos Asignados</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Horas/Sem</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingReport ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>
                  ) : teacherLoadData.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No hay datos disponibles. Selecciona un año académico.</td></tr>
                  ) : teacherLoadData.map((teacher) => (
                    <tr key={teacher.nro} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center">{teacher.nro}</td>
                      <td className="px-3 py-2 font-medium">{teacher.name}</td>
                      <td className="px-3 py-2">{teacher.subjects}</td>
                      <td className="px-3 py-2">{teacher.groups}</td>
                      <td className="px-3 py-2 text-center font-semibold">{teacher.hours}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${teacher.status === 'Completo' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {teacher.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReport === 'load-group' && (
              <table className="w-full text-sm">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Grupo</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Director</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Estudiantes</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Asignaturas</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Docentes</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingReport ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>
                  ) : groupLoadData.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No hay datos disponibles. Selecciona un año académico.</td></tr>
                  ) : groupLoadData.map((g, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-semibold">{g.group}</td>
                      <td className="px-3 py-2">{g.director}</td>
                      <td className="px-3 py-2 text-center">{g.students}</td>
                      <td className="px-3 py-2 text-center">{g.subjects}</td>
                      <td className="px-3 py-2 text-center">{g.teachers}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${g.complete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {g.complete ? 'Completo' : 'Incompleto'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {selectedReport === 'teachers-active' && (
              <table className="w-full text-sm">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Nro</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Documento</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700 min-w-[250px]">Nombre Completo</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Tipo Contrato</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Horas Contratadas</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Horas Asignadas</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { nro: 1, doc: '1.065.234.567', name: 'AHUMADA MARTINEZ ARLETH PATRICIA', contract: 'Planta', hoursC: 22, hoursA: 15 },
                    { nro: 2, doc: '1.065.345.678', name: 'AICARDI LOPEZ SANDRA MILENA', contract: 'Planta', hoursC: 22, hoursA: 20 },
                    { nro: 3, doc: '1.065.456.789', name: 'ALEMAN ROJAS JAIDIVIS ISABEL', contract: 'Provisional', hoursC: 20, hoursA: 18 },
                    { nro: 4, doc: '1.065.567.890', name: 'ALVAREZ VERA MARISOL', contract: 'Provisional', hoursC: 15, hoursA: 8 },
                    { nro: 5, doc: '1.065.678.901', name: 'BARRIOS MENDOZA CARLOS ANDRES', contract: 'Planta', hoursC: 22, hoursA: 16 },
                  ].map((t) => (
                    <tr key={t.nro} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center">{t.nro}</td>
                      <td className="px-3 py-2">{t.doc}</td>
                      <td className="px-3 py-2 font-medium">{t.name}</td>
                      <td className="px-3 py-2">{t.contract}</td>
                      <td className="px-3 py-2 text-center">{t.hoursC}</td>
                      <td className="px-3 py-2 text-center">{t.hoursA}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">Activo</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* REPORTES ACADÉMICOS - Consolidado de Asignaturas */}
            {(selectedReport === 'cons-subjects' || selectedReport === 'avg-group') && (
              <div>
                {loadingReport ? (
                  <div className="p-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></div>
                ) : studentsGradesData.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">No hay datos disponibles. Selecciona un año académico y período.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-amber-100">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium text-slate-700">Nro</th>
                        <th className="px-2 py-2 text-left font-medium text-slate-700 min-w-[200px]">Nombre Estudiante</th>
                        {Object.keys(studentsGradesData[0]?.grades || {}).map((subject, i) => (
                          <th key={i} className="px-2 py-2 text-center font-medium text-slate-700">{subject.substring(0, 5)}</th>
                        ))}
                        <th className="px-2 py-2 text-center font-medium text-slate-700 bg-blue-100">Prom.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentsGradesData.map((s) => (
                        <tr key={s.nro} className="hover:bg-slate-50">
                          <td className="px-2 py-1.5 text-center">{s.nro}</td>
                          <td className="px-2 py-1.5 font-medium">{s.name}</td>
                          {Object.values(s.grades).map((g: any, i) => (
                            <td key={i} className={`px-2 py-1.5 text-center ${g < 3 ? 'text-red-600 font-bold' : g >= 4.5 ? 'text-green-600' : ''}`}>{g?.toFixed(1)}</td>
                          ))}
                          <td className="px-2 py-1.5 text-center font-bold bg-blue-50">{s.average.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* REPORTES DE ASISTENCIA - Por Grupo */}
            {selectedReport === 'att-group' && (
              <table className="w-full text-sm">
                <thead className="bg-amber-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Nro</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700 min-w-[200px]">Estudiante</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Grupo</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Total Clases</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Asistencias</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Fallas</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Tardanzas</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Excusas</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">% Asist.</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingReport ? (
                    <tr><td colSpan={10} className="px-3 py-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>
                  ) : attendanceData.filter(s => !searchStudent || s.name?.toLowerCase().includes(searchStudent.toLowerCase())).length === 0 ? (
                    <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-500">No hay registros de asistencia guardados. Solo se muestran clases donde el docente registró y guardó la asistencia.</td></tr>
                  ) : attendanceData.filter(s => !searchStudent || s.name?.toLowerCase().includes(searchStudent.toLowerCase())).map((s, idx) => (
                    <tr key={s.nro} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center">{idx + 1}</td>
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2">{s.group}</td>
                      <td className="px-3 py-2 text-center font-semibold">{s.totalClasses || 0}</td>
                      <td className="px-3 py-2 text-center text-green-600">{s.attended || 0}</td>
                      <td className="px-3 py-2 text-center text-red-600">{s.absent || 0}</td>
                      <td className="px-3 py-2 text-center text-amber-600">{s.late || 0}</td>
                      <td className="px-3 py-2 text-center text-blue-600">{s.excused || 0}</td>
                      <td className="px-3 py-2 text-center font-semibold">{s.pct}%</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${
                          s.status === 'Riesgo' || s.pct < 80 ? 'bg-red-100 text-red-700' : 
                          s.status === 'Alerta' || s.pct < 90 ? 'bg-amber-100 text-amber-700' : 
                          'bg-green-100 text-green-700'
                        }`}>
                          {s.status || (s.pct >= 90 ? 'Normal' : s.pct >= 80 ? 'Alerta' : 'Riesgo')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* REPORTES DE ASISTENCIA - Por Estudiante (Detallado) */}
            {selectedReport === 'att-student' && (
              <table className="w-full text-sm">
                <thead className="bg-amber-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Nro</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Fecha</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700 min-w-[150px]">Estudiante</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Grupo</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Asignatura</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Docente</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Estado</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Observación</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingReport ? (
                    <tr><td colSpan={8} className="px-3 py-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>
                  ) : attendanceDetailData.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">No hay registros de asistencia. Selecciona los filtros y presiona "Buscar".</td></tr>
                  ) : attendanceDetailData.map((record, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center">{record.nro || idx + 1}</td>
                      <td className="px-3 py-2">{record.date}</td>
                      <td className="px-3 py-2 font-medium">{record.student}</td>
                      <td className="px-3 py-2">{record.group}</td>
                      <td className="px-3 py-2">{record.subject}</td>
                      <td className="px-3 py-2">{record.teacher}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${
                          record.status === 'PRESENT' ? 'bg-green-100 text-green-700' : 
                          record.status === 'ABSENT' ? 'bg-red-100 text-red-700' : 
                          record.status === 'LATE' ? 'bg-amber-100 text-amber-700' : 
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {record.status === 'PRESENT' ? 'Presente' : 
                           record.status === 'ABSENT' ? 'Ausente' : 
                           record.status === 'LATE' ? 'Tarde' : 'Excusa'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500 text-xs">{record.observations || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* REPORTES DE ASISTENCIA - Por Asignatura */}
            {selectedReport === 'att-subject' && (
              <table className="w-full text-sm">
                <thead className="bg-amber-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Nro</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700 min-w-[200px]">Estudiante</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Grupo</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Total Clases</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Asistencias</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Fallas</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">% Asist.</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingReport ? (
                    <tr><td colSpan={8} className="px-3 py-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>
                  ) : attendanceBySubjectData.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">No hay registros de asistencia. Selecciona una asignatura y presiona "Buscar".</td></tr>
                  ) : attendanceBySubjectData.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center">{s.nro || idx + 1}</td>
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2">{s.group}</td>
                      <td className="px-3 py-2 text-center font-semibold">{s.totalClasses || 0}</td>
                      <td className="px-3 py-2 text-center text-green-600">{s.attended || 0}</td>
                      <td className="px-3 py-2 text-center text-red-600">{s.absent || 0}</td>
                      <td className="px-3 py-2 text-center font-semibold">{s.pct}%</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${
                          s.status === 'Riesgo' || s.pct < 80 ? 'bg-red-100 text-red-700' : 
                          s.status === 'Alerta' || s.pct < 90 ? 'bg-amber-100 text-amber-700' : 
                          'bg-green-100 text-green-700'
                        }`}>
                          {s.status || (s.pct >= 90 ? 'Normal' : s.pct >= 80 ? 'Alerta' : 'Riesgo')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* REPORTES DE ASISTENCIA - Por Docente (Gestión) */}
            {selectedReport === 'att-teacher' && (
              <table className="w-full text-sm">
                <thead className="bg-amber-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Nro</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700 min-w-[200px]">Docente</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Clases Programadas</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Clases Registradas</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Clases NO Registradas</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">% Cumplimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingReport ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>
                  ) : teacherComplianceData.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No hay datos de gestión docente. Selecciona los filtros y presiona "Buscar".</td></tr>
                  ) : teacherComplianceData.map((t, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center">{t.nro || idx + 1}</td>
                      <td className="px-3 py-2 font-medium">{t.teacher}</td>
                      <td className="px-3 py-2 text-center font-semibold">{t.classesScheduled}</td>
                      <td className="px-3 py-2 text-center text-green-600">{t.classesRegistered}</td>
                      <td className="px-3 py-2 text-center text-red-600">{t.classesNotRegistered}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          t.complianceRate >= 90 ? 'bg-green-100 text-green-700' : 
                          t.complianceRate >= 70 ? 'bg-amber-100 text-amber-700' : 
                          'bg-red-100 text-red-700'
                        }`}>
                          {t.complianceRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* REPORTES DE ASISTENCIA - Consolidado Institucional */}
            {selectedReport === 'att-consolidated' && (
              <div className="space-y-6">
                {loadingReport ? (
                  <div className="py-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></div>
                ) : (
                  <>
                    {/* Tabla por Grado */}
                    <div>
                      <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" /> % Asistencia por Grado
                      </h4>
                      <table className="w-full text-sm">
                        <thead className="bg-blue-100">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-slate-700">Nro</th>
                            <th className="px-3 py-2 text-left font-medium text-slate-700">Grado</th>
                            <th className="px-3 py-2 text-center font-medium text-slate-700">Estudiantes</th>
                            <th className="px-3 py-2 text-center font-medium text-slate-700">Total Clases</th>
                            <th className="px-3 py-2 text-center font-medium text-slate-700">Asistencias</th>
                            <th className="px-3 py-2 text-center font-medium text-slate-700">Fallas</th>
                            <th className="px-3 py-2 text-center font-medium text-slate-700">% Asistencia</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {consolidatedData.byGrade.length === 0 ? (
                            <tr><td colSpan={7} className="px-3 py-4 text-center text-slate-500">No hay datos. Selecciona un año y presiona "Generar Consolidado".</td></tr>
                          ) : consolidatedData.byGrade.map((g, idx) => (
                            <tr key={idx} className="hover:bg-blue-50">
                              <td className="px-3 py-2 text-center">{g.nro}</td>
                              <td className="px-3 py-2 font-medium">{g.grade}</td>
                              <td className="px-3 py-2 text-center">{g.totalStudents}</td>
                              <td className="px-3 py-2 text-center">{g.totalClasses}</td>
                              <td className="px-3 py-2 text-center text-green-600">{g.totalAttended}</td>
                              <td className="px-3 py-2 text-center text-red-600">{g.totalAbsent}</td>
                              <td className="px-3 py-2 text-center">
                                <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                  g.pct >= 90 ? 'bg-green-100 text-green-700' : 
                                  g.pct >= 80 ? 'bg-amber-100 text-amber-700' : 
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {g.pct}%
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Tabla por Asignatura */}
                    {consolidatedData.bySubject.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                          <BookOpen className="w-4 h-4" /> % Asistencia por Asignatura
                        </h4>
                        <table className="w-full text-sm">
                          <thead className="bg-green-100">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-slate-700">Nro</th>
                              <th className="px-3 py-2 text-left font-medium text-slate-700">Asignatura</th>
                              <th className="px-3 py-2 text-center font-medium text-slate-700">Registros</th>
                              <th className="px-3 py-2 text-center font-medium text-slate-700">Total Clases</th>
                              <th className="px-3 py-2 text-center font-medium text-slate-700">Asistencias</th>
                              <th className="px-3 py-2 text-center font-medium text-slate-700">Fallas</th>
                              <th className="px-3 py-2 text-center font-medium text-slate-700">% Asistencia</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {consolidatedData.bySubject.map((s, idx) => (
                              <tr key={idx} className="hover:bg-green-50">
                                <td className="px-3 py-2 text-center">{s.nro}</td>
                                <td className="px-3 py-2 font-medium">{s.subject}</td>
                                <td className="px-3 py-2 text-center">{s.totalStudents}</td>
                                <td className="px-3 py-2 text-center">{s.totalClasses}</td>
                                <td className="px-3 py-2 text-center text-green-600">{s.totalAttended}</td>
                                <td className="px-3 py-2 text-center text-red-600">{s.totalAbsent}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    s.pct >= 90 ? 'bg-green-100 text-green-700' : 
                                    s.pct >= 80 ? 'bg-amber-100 text-amber-700' : 
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {s.pct}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* REPORTES DE ASISTENCIA - Inasistencias Críticas */}
            {selectedReport === 'att-critical' && (
              <table className="w-full text-sm">
                <thead className="bg-red-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Nro</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700 min-w-[200px]">Estudiante</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Grupo</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Total Clases</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Fallas</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">% Asist.</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingReport ? (
                    <tr><td colSpan={7} className="px-3 py-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div></td></tr>
                  ) : criticalAbsencesData.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-500">No hay estudiantes con inasistencia crítica. Ajusta el % mínimo o los filtros.</td></tr>
                  ) : criticalAbsencesData.map((s, idx) => (
                    <tr key={idx} className="hover:bg-red-50">
                      <td className="px-3 py-2 text-center">{s.nro || idx + 1}</td>
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2">{s.group}</td>
                      <td className="px-3 py-2 text-center font-semibold">{s.totalClasses || 0}</td>
                      <td className="px-3 py-2 text-center text-red-600 font-bold">{s.absent || 0}</td>
                      <td className="px-3 py-2 text-center font-semibold">{s.pct}%</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          s.status === 'Riesgo' || s.pct < 80 ? 'bg-red-100 text-red-700' : 
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {s.status || (s.pct < 80 ? 'Riesgo' : 'Alerta')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* REPORTES DE ALERTAS */}
            {selectedReport === 'alert-low-performance' && (
              <table className="w-full text-sm">
                <thead className="bg-red-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Nro</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700 min-w-[250px]">Estudiante</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Grupo</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Promedio</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Áreas Perdidas</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Riesgo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingReport ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div></td></tr>
                  ) : alertsData.length === 0 ? (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No hay estudiantes con bajo rendimiento. Selecciona un año y período para ver alertas.</td></tr>
                  ) : alertsData.map((s) => (
                    <tr key={s.nro} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center">{s.nro}</td>
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2">{s.group}</td>
                      <td className="px-3 py-2 text-center font-bold text-red-600">{s.avg.toFixed(1)}</td>
                      <td className="px-3 py-2 text-center">{s.failed}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${s.risk === 'Alto' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {s.risk}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Reporte genérico para los demás */}
            {!['load-teacher', 'load-group', 'teachers-active', 'cons-subjects', 'avg-group', 'att-group', 'att-student', 'att-subject', 'att-teacher', 'att-critical', 'att-consolidated', 'alert-low-performance'].includes(selectedReport) && (
              <div className="p-8 text-center text-slate-500">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">Reporte: {currentReportData?.name}</p>
                <p className="text-sm mt-1">Selecciona los filtros y presiona "Buscar" para generar el reporte</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Vista principal - Lista de reportes
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Centro de Reportes</h1>
          <p className="text-slate-500 mt-1">Genera y descarga reportes institucionales</p>
        </div>
      </div>

      {/* Dashboard Resumen Ejecutivo */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-6 mb-6 text-white">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Resumen Ejecutivo - Indicadores Clave
        </h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <p className="text-white/70 text-sm">Promedio Institucional</p>
            <p className="text-3xl font-bold">{dashboardStats.institutionalAverage.toFixed(2)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <p className="text-white/70 text-sm">% Aprobación</p>
            <p className="text-3xl font-bold">{dashboardStats.approvalRate}%</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <p className="text-white/70 text-sm">% Asistencia</p>
            <p className="text-3xl font-bold">{dashboardStats.attendanceRate}%</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4">
            <p className="text-white/70 text-sm">Cumplimiento SIEE</p>
            <p className="text-3xl font-bold">{dashboardStats.sieeCompliance}%</p>
          </div>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar de categorías */}
        <div className="w-72 flex-shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="font-medium text-slate-700">Categorías de Reportes</h3>
            </div>
            <nav className="p-2">
              {filteredCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => { setSelectedCategory(category.id); setSelectedReport(null); setShowReport(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory === category.id
                      ? `${getCategoryColor(category.color)}`
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <category.icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{category.name}</span>
                  <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                    {getFilteredReports(category.id).length}
                  </span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Contenido principal */}
        <div className="flex-1">
          {/* Lista de reportes */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                {currentCategory && <currentCategory.icon className="w-5 h-5 text-slate-600" />}
                <h2 className="font-semibold text-slate-900">{currentCategory?.name}</h2>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {currentReports.map((report: ReportItem) => (
                <div
                  key={report.id}
                  className="px-6 py-4 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => {
                    if (report.available) {
                      handleSelectReport(report.id)
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        report.available ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <report.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-900">{report.name}</h3>
                        <p className="text-sm text-slate-500">{report.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {report.available ? (
                        <button 
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectReport(report.id)
                          }}
                        >
                          <Settings className="w-4 h-4" />
                          Abrir
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">Próximamente</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
