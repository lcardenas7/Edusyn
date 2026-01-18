import { useState } from 'react'
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

type ReportCategory = 'admin' | 'academic' | 'evaluation' | 'attendance' | 'official' | 'alerts' | 'config'

interface ReportItem {
  id: string
  name: string
  description: string
  icon: any
  available: boolean
}

const reportCategories = [
  { id: 'admin' as ReportCategory, name: 'Administración / Rectoría', icon: Briefcase, color: 'blue' },
  { id: 'academic' as ReportCategory, name: 'Académico (Coordinación)', icon: BookOpen, color: 'green' },
  { id: 'evaluation' as ReportCategory, name: 'Evaluación (SIEE)', icon: ClipboardList, color: 'purple' },
  { id: 'attendance' as ReportCategory, name: 'Asistencia', icon: Calendar, color: 'amber' },
  { id: 'official' as ReportCategory, name: 'Oficiales', icon: FileText, color: 'indigo' },
  { id: 'alerts' as ReportCategory, name: 'Alertas', icon: Bell, color: 'red' },
  { id: 'config' as ReportCategory, name: 'Configuración / Control', icon: Settings, color: 'slate' },
]

const reportsByCategory: Record<ReportCategory, ReportItem[]> = {
  admin: [
    { id: 'load-teacher', name: 'Carga académica por docente', description: 'Asignaturas y grupos asignados a cada docente', icon: Users, available: true },
    { id: 'load-group', name: 'Carga académica por grupo', description: 'Docentes y asignaturas por cada grupo', icon: GraduationCap, available: true },
    { id: 'load-area', name: 'Carga académica por área', description: 'Distribución de carga por áreas académicas', icon: Layers, available: true },
    { id: 'coverage-no-teacher', name: 'Asignaturas sin docente', description: 'Asignaturas que no tienen docente asignado', icon: UserX, available: true },
    { id: 'coverage-incomplete', name: 'Grupos sin asignación completa', description: 'Grupos con asignaturas pendientes de asignar', icon: AlertTriangle, available: true },
    { id: 'teachers-active', name: 'Docentes activos', description: 'Listado de docentes activos en la institución', icon: UserCheck, available: true },
    { id: 'teachers-no-load', name: 'Docentes sin carga', description: 'Docentes sin asignación académica', icon: UserX, available: true },
    { id: 'teachers-hours', name: 'Horas asignadas vs contratadas', description: 'Comparativo de horas por docente', icon: Clock, available: true },
  ],
  academic: [
    { id: 'avg-group', name: 'Promedios por grupo', description: 'Rendimiento académico promedio de cada grupo', icon: BarChart3, available: true },
    { id: 'avg-area', name: 'Promedios por área', description: 'Rendimiento académico promedio por área', icon: Layers, available: true },
    { id: 'avg-institution', name: 'Promedios institucionales', description: 'Indicadores generales de la institución', icon: TrendingUp, available: true },
    { id: 'approved-areas', name: 'Áreas aprobadas', description: 'Estudiantes que aprobaron cada área', icon: CheckCircle, available: true },
    { id: 'failed-areas', name: 'Áreas reprobadas', description: 'Estudiantes que reprobaron cada área', icon: XCircle, available: true },
    { id: 'promotion-rate', name: 'Porcentaje de promoción', description: 'Tasa de promoción por grupo y grado', icon: TrendingUp, available: true },
    { id: 'period-comparison', name: 'Comparativo por períodos', description: 'Evolución del rendimiento entre períodos', icon: Activity, available: true },
    { id: 'student-history', name: 'Historial por estudiante', description: 'Trayectoria académica individual', icon: History, available: true },
    { id: 'cons-subjects', name: 'Asignaturas - Consolidado Acumulado', description: 'Tabla con el acumulado de los estudiantes en cada una de las asignaturas', icon: BookOpen, available: true },
    { id: 'cons-areas', name: 'Áreas - Consolidado Acumulado', description: 'Acumula los consolidados de las Áreas durante los períodos solicitados', icon: Layers, available: true },
    { id: 'cons-dimensions', name: 'Dimensiones - Consolidado Acumulado', description: 'Tabla con el acumulado de los estudiantes en cada una de las asignaturas por dimensión', icon: PieChart, available: true },
    { id: 'min-grade', name: 'Nota Mínima', description: 'Calcula la nota mínima que necesita el estudiante en cada asignatura para no reprobar', icon: AlertTriangle, available: true },
    { id: 'cons-dba', name: 'DBA - Cons. Acumulado Por Período', description: 'Tabla con el acumulado de los estudiantes en cada una de las asignaturas por DBA', icon: FileText, available: true },
    { id: 'cons-pecab', name: 'Pecab - Cons. Acumulado Por Período', description: 'Tabla con el acumulado de los estudiantes en cada una de las asignaturas por PECAB', icon: ClipboardList, available: true },
    { id: 'report-period-avg', name: 'Reporte Acumulado por Período', description: 'Refleja un promedio de notas de convivencia por períodos', icon: Calendar, available: true },
  ],
  evaluation: [
    { id: 'siee-compliance', name: 'Cumplimiento del SIEE', description: 'Porcentajes por dimensión evaluativa', icon: PieChart, available: true },
    { id: 'activities-created', name: 'Actividades evaluativas creadas', description: 'Cantidad de actividades por docente/asignatura', icon: ClipboardList, available: true },
    { id: 'activity-types', name: 'Tipos de actividades', description: 'Distribución por tipo de evaluación', icon: PieChart, available: true },
    { id: 'dimension-weight', name: 'Peso por dimensión', description: 'Distribución de pesos evaluativos', icon: BarChart3, available: true },
    { id: 'pending-grades', name: 'Docentes con notas incompletas', description: 'Docentes que no han completado calificaciones', icon: AlertTriangle, available: true },
    { id: 'open-periods', name: 'Períodos abiertos', description: 'Estado de cierre de períodos académicos', icon: Calendar, available: true },
  ],
  attendance: [
    { id: 'att-student', name: 'Asistencia por estudiante', description: 'Registro individual de asistencia', icon: Users, available: true },
    { id: 'att-group', name: 'Asistencia por grupo', description: 'Estadísticas de asistencia grupal', icon: GraduationCap, available: true },
    { id: 'att-critical', name: 'Inasistencia crítica', description: 'Estudiantes con alta inasistencia', icon: AlertTriangle, available: true },
    { id: 'att-risk', name: 'Estudiantes en riesgo', description: 'Estudiantes cerca del límite de inasistencia', icon: UserX, available: true },
    { id: 'att-groups-high', name: 'Grupos con alta inasistencia', description: 'Grupos que superan el promedio de inasistencia', icon: TrendingDown, available: true },
  ],
  official: [
    { id: 'report-partial', name: 'Boletines parciales', description: 'Boletines de período', icon: FileText, available: true },
    { id: 'report-final', name: 'Boletines finales', description: 'Boletines de fin de año', icon: FileCheck, available: true },
    { id: 'promoted', name: 'Estudiantes promovidos', description: 'Listado de estudiantes promovidos', icon: CheckCircle, available: true },
    { id: 'not-promoted', name: 'Estudiantes no promovidos', description: 'Listado de estudiantes reprobados', icon: XCircle, available: true },
    { id: 'recovery', name: 'Estudiantes en recuperación', description: 'Estudiantes con actividades de recuperación', icon: Clock, available: true },
  ],
  alerts: [
    { id: 'alert-low-performance', name: 'Bajo rendimiento', description: 'Estudiantes con promedio bajo', icon: TrendingDown, available: true },
    { id: 'alert-fail-risk', name: 'Riesgo de reprobación', description: 'Estudiantes en riesgo de perder el año', icon: AlertTriangle, available: true },
    { id: 'alert-attendance', name: 'Inasistencia reiterada', description: 'Estudiantes con patrón de inasistencia', icon: UserX, available: true },
  ],
  config: [
    { id: 'config-areas', name: 'Áreas configuradas', description: 'Listado de áreas académicas', icon: Layers, available: true },
    { id: 'config-subjects', name: 'Asignaturas configuradas', description: 'Listado de asignaturas por área', icon: BookOpen, available: true },
    { id: 'config-periods', name: 'Períodos académicos', description: 'Configuración de períodos', icon: Calendar, available: true },
    { id: 'config-siee', name: 'Porcentajes SIEE', description: 'Configuración del sistema de evaluación', icon: Settings, available: true },
    { id: 'audit-changes', name: 'Cambios administrativos', description: 'Historial de modificaciones', icon: History, available: true },
    { id: 'audit-adjustments', name: 'Historial de ajustes', description: 'Ajustes de notas y correcciones', icon: ClipboardList, available: true },
  ],
}

// Mock data for dashboard
const dashboardStats = {
  institutionalAverage: 3.85,
  approvalRate: 87.5,
  attendanceRate: 94.2,
  sieeCompliance: 92.0,
  totalStudents: 1250,
  totalTeachers: 48,
  totalGroups: 32,
  pendingGrades: 5,
}

export default function Reports() {
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('academic')
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  
  // Filtros específicos
  const [filterYear, setFilterYear] = useState('2025')
  const [filterLevel, setFilterLevel] = useState('all')
  const [filterGrade, setFilterGrade] = useState('all')
  const [filterPeriod, setFilterPeriod] = useState('1')
  const [filterProcess, setFilterProcess] = useState('all')
  const [showOnlyFailed, setShowOnlyFailed] = useState(false)
  const [showGrades, setShowGrades] = useState(true)
  const [showPerformance, setShowPerformance] = useState(false)
  const [decimalPlaces, setDecimalPlaces] = useState('1')
  const [showRecovery, setShowRecovery] = useState(false)
  const [searchStudent, setSearchStudent] = useState('')

  const currentCategory = reportCategories.find(c => c.id === selectedCategory)
  const currentReports = reportsByCategory[selectedCategory]
  const currentReportData = currentReports.find(r => r.id === selectedReport)

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

  const handleSelectReport = (reportId: string) => {
    setSelectedReport(reportId)
    setShowReport(true)
  }

  const handleBack = () => {
    setShowReport(false)
    setSelectedReport(null)
  }


  // Renderizar filtros según la categoría
  const renderFilters = () => {
    if (selectedCategory === 'academic') {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Año Escolar</label>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="2025">2025 - On</option>
                <option value="2024">2024</option>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Grado</label>
              <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todos</option>
                <option value="0">Transición</option>
                <option value="1">Primero 01</option>
                <option value="6">Sexto 01</option>
                <option value="7">Séptimo 01</option>
                <option value="8">Octavo 01</option>
                <option value="9">Noveno 01</option>
                <option value="10">Décimo 01</option>
                <option value="11">Undécimo 01</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Ciclo</label>
              <select className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="2025">2025</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Período</label>
              <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
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

    if (selectedCategory === 'admin') {
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

    if (selectedCategory === 'attendance') {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Año</label>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="2025">2025</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Grado</label>
              <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todos</option>
                <option value="6">Sexto</option>
                <option value="7">Séptimo</option>
                <option value="8">Octavo</option>
                <option value="9">Noveno</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Grupo</label>
              <select className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todos</option>
                <option value="A">A</option>
                <option value="B">B</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Desde</label>
              <input type="date" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Hasta</label>
              <input type="date" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </div>
          </div>
          <button className="px-4 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700">Buscar</button>
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
            <button className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700">
              <Download className="w-4 h-4" />
              Exportar
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-600 text-white rounded text-sm hover:bg-slate-700">
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Grado: {filterGrade === 'all' ? 'Todos' : `${filterGrade}°`} | Período: {filterPeriod} | Fecha: {new Date().toLocaleDateString()}</span>
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
                  {[
                    { nro: 1, name: 'AHUMADA MARTINEZ ARLETH PATRICIA', subjects: 'Matemáticas', groups: '6°A, 6°B, 7°A', hours: 15, status: 'Completo' },
                    { nro: 2, name: 'AICARDI LOPEZ SANDRA MILENA', subjects: 'Lengua Castellana', groups: '6°A, 6°B, 7°A, 7°B', hours: 20, status: 'Completo' },
                    { nro: 3, name: 'ALEMAN ROJAS JAIDIVIS ISABEL', subjects: 'Biología, Química', groups: '8°A, 8°B, 9°A', hours: 18, status: 'Completo' },
                    { nro: 4, name: 'ALVAREZ VERA MARISOL', subjects: 'Educación Física', groups: '6°A, 6°B', hours: 8, status: 'Parcial' },
                    { nro: 5, name: 'BARRIOS MENDOZA CARLOS ANDRES', subjects: 'Inglés', groups: '6°A, 7°A, 8°A, 9°A', hours: 16, status: 'Completo' },
                    { nro: 6, name: 'CASTRO PEREZ MARIA ELENA', subjects: 'Ciencias Sociales, Filosofía', groups: '10°A, 11°A', hours: 14, status: 'Completo' },
                    { nro: 7, name: 'DIAZ GOMEZ PEDRO LUIS', subjects: 'Física', groups: '10°A, 11°A', hours: 10, status: 'Completo' },
                    { nro: 8, name: 'FERNANDEZ RUIZ ANA MARIA', subjects: 'Artes, Ética', groups: '6°A, 6°B, 7°A, 7°B', hours: 12, status: 'Completo' },
                  ].map((teacher) => (
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
                  {[
                    { group: '6°A', director: 'AHUMADA MARTINEZ ARLETH', students: 35, subjects: 12, teachers: 10, complete: true },
                    { group: '6°B', director: 'AICARDI LOPEZ SANDRA', students: 34, subjects: 12, teachers: 10, complete: true },
                    { group: '7°A', director: 'BARRIOS MENDOZA CARLOS', students: 38, subjects: 12, teachers: 9, complete: false },
                    { group: '8°A', director: 'CASTRO PEREZ MARIA', students: 36, subjects: 13, teachers: 11, complete: true },
                    { group: '9°A', director: 'DIAZ GOMEZ PEDRO', students: 32, subjects: 13, teachers: 11, complete: true },
                    { group: '10°A', director: 'FERNANDEZ RUIZ ANA', students: 30, subjects: 14, teachers: 12, complete: true },
                    { group: '11°A', director: 'GONZALEZ MORA LUIS', students: 28, subjects: 14, teachers: 12, complete: true },
                  ].map((g) => (
                    <tr key={g.group} className="hover:bg-slate-50">
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
              <table className="w-full text-xs">
                <thead className="bg-amber-100">
                  <tr>
                    <th className="px-2 py-2 text-left font-medium text-slate-700">Nro</th>
                    <th className="px-2 py-2 text-left font-medium text-slate-700 min-w-[200px]">Nombre Estudiante</th>
                    <th className="px-2 py-2 text-center font-medium text-slate-700">Mat</th>
                    <th className="px-2 py-2 text-center font-medium text-slate-700">Ingl</th>
                    <th className="px-2 py-2 text-center font-medium text-slate-700">Biolo</th>
                    <th className="px-2 py-2 text-center font-medium text-slate-700">Fís</th>
                    <th className="px-2 py-2 text-center font-medium text-slate-700">Quí</th>
                    <th className="px-2 py-2 text-center font-medium text-slate-700">Soci</th>
                    <th className="px-2 py-2 text-center font-medium text-slate-700">Ética</th>
                    <th className="px-2 py-2 text-center font-medium text-slate-700">Ed.Fi</th>
                    <th className="px-2 py-2 text-center font-medium text-slate-700">ARTE</th>
                    <th className="px-2 py-2 text-center font-medium text-slate-700">Lengua</th>
                    <th className="px-2 py-2 text-center font-medium text-slate-700 bg-blue-100">Prom.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { nro: 1, name: 'ACOSTA GUTIERREZ ALEXANDER', grades: [3.3, 4.1, 4.5, 4.3, 4.6, 4.4, 4.2, 4.5, 4.3, 4.5] },
                    { nro: 2, name: 'ALVAREZ LARIOS DANYER', grades: [3.2, 3.5, 3.6, 3.5, 4.5, 4.3, 3.5, 4.2, 3.6, 3.9] },
                    { nro: 3, name: 'AMARIS CASTRO KAROLAY', grades: [3.5, 3.4, 4.3, 4.4, 4.1, 3.7, 4.1, 4.3, 4.4, 4.3] },
                  ].map((s) => (
                    <tr key={s.nro} className="hover:bg-slate-50">
                      <td className="px-2 py-1.5 text-center">{s.nro}</td>
                      <td className="px-2 py-1.5 font-medium">{s.name}</td>
                      {s.grades.map((g, i) => (
                        <td key={i} className={`px-2 py-1.5 text-center ${g < 3 ? 'text-red-600 font-bold' : g >= 4.5 ? 'text-green-600' : ''}`}>{g}</td>
                      ))}
                      <td className="px-2 py-1.5 text-center font-bold bg-blue-50">{(s.grades.reduce((a, b) => a + b, 0) / s.grades.length).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* REPORTES DE ASISTENCIA */}
            {selectedReport === 'att-student' && (
              <table className="w-full text-sm">
                <thead className="bg-amber-100">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">Nro</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700 min-w-[250px]">Estudiante</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Días Hábiles</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Asistencias</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Fallas</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">% Asistencia</th>
                    <th className="px-3 py-2 text-center font-medium text-slate-700">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { nro: 1, name: 'ACOSTA GUTIERREZ ALEXANDER DAVID', days: 45, att: 43, abs: 2, pct: 95.6 },
                    { nro: 2, name: 'ALVAREZ LARIOS DANYER JESIT', days: 45, att: 40, abs: 5, pct: 88.9 },
                    { nro: 3, name: 'AMARIS CASTRO KAROLAY', days: 45, att: 44, abs: 1, pct: 97.8 },
                    { nro: 4, name: 'ARRIETA CARVAJALINO JHON BREINER', days: 45, att: 35, abs: 10, pct: 77.8 },
                  ].map((s) => (
                    <tr key={s.nro} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center">{s.nro}</td>
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2 text-center">{s.days}</td>
                      <td className="px-3 py-2 text-center text-green-600">{s.att}</td>
                      <td className="px-3 py-2 text-center text-red-600">{s.abs}</td>
                      <td className="px-3 py-2 text-center font-semibold">{s.pct}%</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${s.pct >= 80 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {s.pct >= 80 ? 'Normal' : 'En riesgo'}
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
                  {[
                    { nro: 1, name: 'CORENA RAMOS TALIANA MICHELL', group: '9°A', avg: 2.8, failed: 4, risk: 'Alto' },
                    { nro: 2, name: 'BROCHERO VELÁSQUEZ SHARICK', group: '9°A', avg: 2.9, failed: 3, risk: 'Alto' },
                    { nro: 3, name: 'ARRIETA CARVAJALINO JHON', group: '9°A', avg: 3.1, failed: 2, risk: 'Medio' },
                  ].map((s) => (
                    <tr key={s.nro} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-center">{s.nro}</td>
                      <td className="px-3 py-2 font-medium">{s.name}</td>
                      <td className="px-3 py-2">{s.group}</td>
                      <td className="px-3 py-2 text-center font-bold text-red-600">{s.avg}</td>
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
            {!['load-teacher', 'load-group', 'teachers-active', 'cons-subjects', 'avg-group', 'att-student', 'alert-low-performance'].includes(selectedReport) && (
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
              {reportCategories.map((category) => (
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
                    {reportsByCategory[category.id].length}
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
              {currentReports.map((report) => (
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
