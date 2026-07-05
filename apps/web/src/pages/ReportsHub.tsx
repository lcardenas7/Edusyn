import { useState, useMemo } from 'react'
import { 
  FileText,
  Users,
  BookOpen,
  Calendar,
  AlertTriangle,
  BarChart3,
  FileSpreadsheet,
  Briefcase,
  ClipboardList,
  Bell,
  ChevronRight,
  Search,
  TrendingUp,
  GraduationCap,
  UserCheck,
  UserX,
  CheckCircle,
  TrendingDown,
  Shield,
  ShieldAlert
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface SubReport {
  id: string
  name: string
  href: string
  icon: any
}

interface ReportCategory {
  id: string
  name: string
  description: string
  icon: any
  href: string
  color: string        // e.g. 'blue'
  reports: SubReport[] // el conteo se deriva de aquí (no se hardcodea)
}

// Los ids de cada sub-reporte DEBEN coincidir con los de su página destino
// (deep-link ?report=id). El badge de cada categoría = reports.length.
const CATEGORIES: ReportCategory[] = [
  {
    id: 'admin', name: 'Administración', description: 'Carga docente, cobertura y gestión',
    icon: Briefcase, href: '/reports/admin', color: 'blue',
    reports: [
      { id: 'load-teacher', name: 'Carga docente', href: '/reports/admin', icon: Users },
      { id: 'load-group', name: 'Carga por grupo', href: '/reports/admin', icon: GraduationCap },
      { id: 'teachers-active', name: 'Docentes activos', href: '/reports/admin', icon: UserCheck },
      { id: 'teachers-no-load', name: 'Docentes sin carga', href: '/reports/admin', icon: UserX },
      { id: 'coverage', name: 'Cobertura académica', href: '/reports/admin', icon: ClipboardList },
      { id: 'hours-summary', name: 'Resumen de horas', href: '/reports/admin', icon: BarChart3 },
      { id: 'staff-list', name: 'Listado de personal', href: '/reports/admin', icon: Users },
      { id: 'enrollment-summary', name: 'Resumen de matrícula', href: '/reports/admin', icon: GraduationCap },
    ],
  },
  {
    id: 'academic', name: 'Académico', description: 'Consolidados, ranking y rendimiento estudiantil',
    icon: BookOpen, href: '/reports/academic', color: 'green',
    reports: [
      { id: 'cons-subjects', name: 'Consolidado por asignaturas', href: '/reports/academic', icon: ClipboardList },
      { id: 'cons-areas', name: 'Consolidado por áreas', href: '/reports/academic', icon: FileSpreadsheet },
      { id: 'avg-subject', name: 'Promedio por asignatura', href: '/reports/academic', icon: BookOpen },
      { id: 'avg-area', name: 'Promedio por áreas', href: '/reports/academic', icon: FileSpreadsheet },
      { id: 'ranking-students', name: 'Ranking de estudiantes', href: '/reports/academic', icon: TrendingUp },
      { id: 'ranking-institutional', name: 'Ranking institucional', href: '/reports/academic', icon: Users },
      { id: 'honor-roll', name: 'Top 5 por grado', href: '/reports/academic', icon: TrendingUp },
      { id: 'grade-distribution', name: 'Estudiantes por nivel', href: '/reports/academic', icon: BarChart3 },
      { id: 'subject-level-dist', name: 'Niveles por asignatura', href: '/reports/academic', icon: BarChart3 },
      { id: 'min-grade', name: 'Nota mínima requerida', href: '/reports/academic', icon: TrendingUp },
      { id: 'failed-subjects', name: 'Asignaturas reprobadas (parcial o final)', href: '/reports/academic', icon: AlertTriangle },
      { id: 'recovery-list', name: 'Listado de recuperación', href: '/reports/academic', icon: FileText },
      { id: 'promotion-projection', name: 'Proyección de promoción', href: '/reports/academic', icon: GraduationCap },
      { id: 'teacher-performance', name: 'Rendimiento por docente', href: '/reports/academic', icon: Users },
    ],
  },
  {
    id: 'convivencia', name: 'Convivencia', description: 'Observador, actas, situaciones y remisiones',
    icon: Shield, href: '/observer-stats', color: 'amber',
    reports: [
      { id: 'conv-stats', name: 'Informe convivencial', href: '/observer-stats', icon: BarChart3 },
      { id: 'conv-observer', name: 'Observador del estudiante', href: '/observer', icon: ClipboardList },
      { id: 'conv-actas', name: 'Actas formales (Tipo I, II, III)', href: '/observer-stats', icon: FileText },
      { id: 'conv-psico', name: 'Remisiones a psicoorientación', href: '/observer-stats', icon: UserX },
      { id: 'conv-alerts', name: 'Alertas convivenciales', href: '/observer-stats', icon: AlertTriangle },
    ],
  },
  {
    id: 'evaluation', name: 'Evaluación (SIEE)', description: 'Sistema de evaluación institucional',
    icon: ClipboardList, href: '/reports/evaluation', color: 'purple',
    reports: [
      { id: 'eval-compliance', name: 'Cumplimiento SIEE', href: '/reports/evaluation', icon: CheckCircle },
      { id: 'eval-criteria', name: 'Criterios de evaluación', href: '/reports/evaluation', icon: ClipboardList },
      { id: 'eval-weights', name: 'Pesos de períodos', href: '/reports/evaluation', icon: BarChart3 },
      { id: 'eval-recovery', name: 'Políticas de recuperación', href: '/reports/evaluation', icon: FileText },
      { id: 'eval-promotion', name: 'Criterios de promoción', href: '/reports/evaluation', icon: Users },
      { id: 'eval-scale', name: 'Escala de valoración', href: '/reports/evaluation', icon: BarChart3 },
    ],
  },
  {
    id: 'attendance', name: 'Asistencia', description: 'Control por grupo, estudiante y docente',
    icon: Calendar, href: '/reports/attendance', color: 'amber',
    reports: [
      { id: 'att-group', name: 'Asistencia por grupo', href: '/reports/attendance', icon: GraduationCap },
      { id: 'att-student', name: 'Asistencia por estudiante', href: '/reports/attendance', icon: Users },
      { id: 'att-subject', name: 'Asistencia por asignatura', href: '/reports/attendance', icon: ClipboardList },
      { id: 'att-teacher', name: 'Asistencia por docente', href: '/reports/attendance', icon: UserCheck },
      { id: 'att-critical', name: 'Inasistencias críticas', href: '/reports/attendance', icon: AlertTriangle },
      { id: 'att-consolidated', name: 'Consolidado institucional', href: '/reports/attendance', icon: BarChart3 },
      { id: 'att-tutoring', name: 'Asistencia de tutoría', href: '/reports/attendance', icon: Calendar },
    ],
  },
  {
    id: 'bulletins', name: 'Boletines', description: 'Boletines parciales, finales y certificados',
    icon: FileText, href: '/reports/bulletins', color: 'indigo',
    reports: [
      { id: 'report-partial', name: 'Boletín parcial (por período)', href: '/reports/bulletins', icon: FileText },
      { id: 'report-final', name: 'Boletín final (año)', href: '/reports/bulletins', icon: FileText },
      { id: 'report-certificate', name: 'Certificado de notas', href: '/reports/bulletins', icon: ClipboardList },
      { id: 'report-constancy', name: 'Constancia de estudio', href: '/reports/bulletins', icon: GraduationCap },
      { id: 'report-promotion', name: 'Acta de promoción', href: '/reports/bulletins', icon: GraduationCap },
    ],
  },
  {
    id: 'alerts', name: 'Alertas', description: 'Seguimiento continuo de riesgo (distinto del Corte Preventivo por fecha)',
    icon: Bell, href: '/reports/alerts', color: 'red',
    reports: [
      { id: 'alert-low-performance', name: 'Bajo rendimiento', href: '/reports/alerts', icon: TrendingDown },
      { id: 'alert-fail-risk', name: 'Riesgo de reprobación', href: '/reports/alerts', icon: AlertTriangle },
      { id: 'alert-attendance', name: 'Alertas de asistencia', href: '/reports/alerts', icon: Users },
    ],
  },
  {
    id: 'preventive', name: 'Corte Preventivo', description: 'Cómo va cada estudiante a una fecha, antes de cerrar el período',
    icon: ShieldAlert, href: '/reports/preventive-cut', color: 'orange',
    reports: [
      { id: 'preventive-group', name: 'Corte por grupo (con PDF)', href: '/reports/preventive-cut', icon: ShieldAlert },
    ],
  },
  {
    id: 'commission', name: 'Comisión de Evaluación', description: 'Genera el acta formal de comisión con datos académicos y convivenciales',
    icon: ClipboardList, href: '/reports/commission', color: 'teal',
    reports: [
      { id: 'commission-acta', name: 'Acta de comisión (configurable)', href: '/reports/commission', icon: FileText },
    ],
  },
]

const COLOR_MAP: Record<string, { bg: string; bgLight: string; border: string; text: string; hover: string; ring: string }> = {
  blue:   { bg: 'bg-blue-600',   bgLight: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-600',   hover: 'hover:border-blue-400',   ring: 'ring-blue-200' },
  green:  { bg: 'bg-green-600',  bgLight: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-600',  hover: 'hover:border-green-400',  ring: 'ring-green-200' },
  purple: { bg: 'bg-purple-600', bgLight: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', hover: 'hover:border-purple-400', ring: 'ring-purple-200' },
  amber:  { bg: 'bg-amber-500',  bgLight: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-600',  hover: 'hover:border-amber-400',  ring: 'ring-amber-200' },
  indigo: { bg: 'bg-indigo-600', bgLight: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-600', hover: 'hover:border-indigo-400', ring: 'ring-indigo-200' },
  red:    { bg: 'bg-red-500',    bgLight: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-600',    hover: 'hover:border-red-400',    ring: 'ring-red-200' },
  slate:  { bg: 'bg-slate-700',   bgLight: 'bg-slate-50',  border: 'border-slate-200',   text: 'text-slate-700',   hover: 'hover:border-slate-400',   ring: 'ring-slate-200' },
  teal:   { bg: 'bg-teal-600',   bgLight: 'bg-teal-50',   border: 'border-teal-200',   text: 'text-teal-600',   hover: 'hover:border-teal-400',   ring: 'ring-teal-200' },
  orange: { bg: 'bg-orange-600', bgLight: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', hover: 'hover:border-orange-400', ring: 'ring-orange-200' },
}

export default function ReportsHub() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')

  // Detectar si es docente sin roles administrativos
  const userRoles = useMemo(() => {
    if (!user?.roles) return []
    return user.roles.map((r: any) => typeof r === 'string' ? r : r.role?.name || r.name).filter(Boolean)
  }, [user?.roles])
  const normalizedRoles = useMemo(() => userRoles.map((role) => String(role).toUpperCase()), [userRoles])
  const isTeacher = normalizedRoles.includes('DOCENTE')
  const canViewAllReports = normalizedRoles.some((role) => ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR'].includes(role))
  const isTeacherOnly = isTeacher && !canViewAllReports

  // Docentes solo ven la categoría de Asistencia
  const visibleCategories = isTeacherOnly
    ? CATEGORIES.filter(cat => cat.id === 'attendance')
    : CATEGORIES

  const q = search.toLowerCase().trim()
  const filtered = q
    ? visibleCategories.map(cat => ({
        ...cat,
        reports: cat.reports.filter(r => r.name.toLowerCase().includes(q)),
      })).filter(cat => cat.reports.length > 0 || cat.name.toLowerCase().includes(q))
    : visibleCategories

  const totalReports = visibleCategories.reduce((s, c) => s + c.reports.length, 0)

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header compacto */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Reportes</h1>
            <p className="text-xs text-slate-500">{CATEGORIES.length} categorías · {totalReports} informes disponibles</p>
          </div>
        </div>
        {/* Búsqueda sutil */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar reporte..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
          />
        </div>
      </div>

      {/* Categorías con sub-reportes inline */}
      <div className="space-y-4">
        {filtered.map(cat => {
          const c = COLOR_MAP[cat.color] || COLOR_MAP.blue
          return (
            <div key={cat.id} className={`bg-white rounded-xl border ${c.border} overflow-hidden`}>
              {/* Cabecera de categoría */}
              <Link
                to={cat.href}
                className={`flex items-center justify-between px-5 py-4 ${c.bgLight} ${c.hover} transition-colors group`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 ${c.bg} rounded-lg flex items-center justify-center`}>
                    <cat.icon className="w-4.5 h-4.5 text-white" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-900 text-sm">{cat.name}</h2>
                    <p className="text-xs text-slate-500">{cat.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${c.text} bg-white/80 px-2 py-0.5 rounded-full border ${c.border}`}>
                    {cat.reports.length}
                  </span>
                  <ChevronRight className={`w-4 h-4 text-slate-400 group-hover:${c.text} transition-colors`} />
                </div>
              </Link>

              {/* Sub-reportes como chips */}
              <div className="px-5 py-3 flex flex-wrap gap-2 border-t border-slate-100">
                {cat.reports.map(r => (
                  <Link
                    key={r.id}
                    to={`${cat.href}?report=${r.id}`}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:${c.bgLight} ${c.hover} transition-all hover:shadow-sm`}
                  >
                    <r.icon className={`w-3.5 h-3.5 ${c.text}`} />
                    {r.name}
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {search && filtered.length === 0 && (
        <div className="text-center py-16">
          <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No se encontraron reportes para "{search}"</p>
        </div>
      )}
    </div>
  )
}
