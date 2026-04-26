import { useState, useMemo } from 'react'
import { 
  FileText,
  Users,
  BookOpen,
  Calendar,
  AlertTriangle,
  BarChart3,
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
  TrendingDown
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
  reportCount: number
  reports: SubReport[]
}

const CATEGORIES: ReportCategory[] = [
  {
    id: 'admin', name: 'Administración', description: 'Carga docente, cobertura y gestión',
    icon: Briefcase, href: '/reports/admin', color: 'blue', reportCount: 8,
    reports: [
      { id: 'load-teacher', name: 'Carga docente', href: '/reports/admin', icon: Users },
      { id: 'load-group', name: 'Carga por grupo', href: '/reports/admin', icon: GraduationCap },
      { id: 'teachers-active', name: 'Docentes activos', href: '/reports/admin', icon: UserCheck },
      { id: 'enrollment-summary', name: 'Resumen matrícula', href: '/reports/admin', icon: GraduationCap },
    ],
  },
  {
    id: 'academic', name: 'Académico', description: 'Consolidados y rendimiento estudiantil',
    icon: BookOpen, href: '/reports/academic', color: 'green', reportCount: 14,
    reports: [
      { id: 'cons-subjects', name: 'Consolidado asignaturas', href: '/reports/academic', icon: ClipboardList },
      { id: 'ranking-students', name: 'Ranking estudiantes', href: '/reports/academic', icon: TrendingUp },
      { id: 'avg-subject', name: 'Promedio asignaturas', href: '/reports/academic', icon: BookOpen },
      { id: 'teacher-performance', name: 'Rendimiento docente', href: '/reports/academic', icon: Users },
    ],
  },
  {
    id: 'evaluation', name: 'Evaluación (SIEE)', description: 'Sistema de evaluación institucional',
    icon: ClipboardList, href: '/reports/evaluation', color: 'purple', reportCount: 6,
    reports: [
      { id: 'eval-compliance', name: 'Cumplimiento SIEE', href: '/reports/evaluation', icon: CheckCircle },
      { id: 'eval-weights', name: 'Pesos de períodos', href: '/reports/evaluation', icon: BarChart3 },
      { id: 'eval-recovery', name: 'Políticas recuperación', href: '/reports/evaluation', icon: FileText },
    ],
  },
  {
    id: 'attendance', name: 'Asistencia', description: 'Control por grupo, estudiante y docente',
    icon: Calendar, href: '/reports/attendance', color: 'amber', reportCount: 6,
    reports: [
      { id: 'att-group', name: 'Asistencia por grupo', href: '/reports/attendance', icon: Users },
      { id: 'att-student', name: 'Asistencia individual', href: '/reports/attendance', icon: UserCheck },
      { id: 'att-summary', name: 'Resumen general', href: '/reports/attendance', icon: BarChart3 },
    ],
  },
  {
    id: 'bulletins', name: 'Boletines', description: 'Boletines parciales, finales y certificados',
    icon: FileText, href: '/reports/bulletins', color: 'indigo', reportCount: 5,
    reports: [
      { id: 'report-partial', name: 'Boletines parciales', href: '/reports/bulletins', icon: FileText },
      { id: 'report-final', name: 'Boletines finales', href: '/reports/bulletins', icon: FileText },
      { id: 'certificate', name: 'Certificados', href: '/reports/bulletins', icon: GraduationCap },
    ],
  },
  {
    id: 'alerts', name: 'Alertas', description: 'Riesgo académico y análisis de rendimiento',
    icon: Bell, href: '/reports/alerts', color: 'red', reportCount: 3,
    reports: [
      { id: 'alert-low', name: 'Bajo rendimiento', href: '/reports/alerts', icon: TrendingDown },
      { id: 'alert-fail', name: 'Riesgo reprobación', href: '/reports/alerts', icon: AlertTriangle },
      { id: 'alert-att', name: 'Alertas asistencia', href: '/reports/alerts', icon: Users },
    ],
  },
  {
    id: 'commission', name: 'Comisión', description: 'Acta consolidada, top 5 y convivencia por grado',
    icon: ClipboardList, href: '/reports/commission', color: 'slate', reportCount: 4,
    reports: [
      { id: 'commission-academic', name: 'Resumen académico', href: '/reports/commission', icon: BarChart3 },
      { id: 'commission-top5', name: 'Top 5 por curso', href: '/reports/commission', icon: TrendingUp },
      { id: 'commission-convivencia', name: 'Situación convivencial', href: '/reports/commission', icon: Shield },
      { id: 'commission-acta', name: 'Acta consolidada', href: '/reports/commission', icon: FileText },
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

  const totalReports = visibleCategories.reduce((s, c) => s + c.reportCount, 0)

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
                    {cat.reportCount}
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
                {cat.reports.length < cat.reportCount && (
                  <Link
                    to={cat.href}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    +{cat.reportCount - cat.reports.length} más
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                )}
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
