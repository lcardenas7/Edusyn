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
  ChevronRight
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface ReportCategory {
  id: string
  name: string
  description: string
  icon: any
  href: string
  color: string
  bgColor: string
  borderColor: string
  feature?: string
  reportCount: number
}

export default function ReportsHub() {
  const { hasFeature } = useAuth()

  const categories: ReportCategory[] = [
    {
      id: 'admin',
      name: 'Administración / Rectoría',
      description: 'Carga docente, cobertura y gestión de personal',
      icon: Briefcase,
      href: '/reports/admin',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      feature: 'RPT_ADMIN',
      reportCount: 8
    },
    {
      id: 'academic',
      name: 'Académico (Coordinación)',
      description: 'Promedios, consolidados y rendimiento estudiantil',
      icon: BookOpen,
      href: '/reports/academic',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      feature: 'RPT_ACAD',
      reportCount: 14
    },
    {
      id: 'evaluation',
      name: 'Evaluación (SIEE)',
      description: 'Cumplimiento del sistema de evaluación institucional',
      icon: ClipboardList,
      href: '/reports/evaluation',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      feature: 'RPT_EVAL',
      reportCount: 6
    },
    {
      id: 'attendance',
      name: 'Asistencia',
      description: 'Control de asistencia por grupo, estudiante y docente',
      icon: Calendar,
      href: '/reports/attendance',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      feature: 'RPT_ATT',
      reportCount: 6
    },
    {
      id: 'official',
      name: 'Boletines',
      description: 'Boletines parciales, finales y certificados',
      icon: FileText,
      href: '/reports/bulletins',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      feature: 'RPT_BULLETIN',
      reportCount: 5
    },
    {
      id: 'alerts',
      name: 'Alertas y Estadísticas',
      description: 'Estudiantes en riesgo y análisis de rendimiento',
      icon: Bell,
      href: '/reports/alerts',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      feature: 'RPT_STAT',
      reportCount: 3
    },
  ]

  // Filtrar categorías según features habilitadas
  const filteredCategories = categories.filter(cat => 
    !cat.feature || hasFeature(cat.feature)
  )

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center">
          <BarChart3 className="w-7 h-7 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Centro de Reportes</h1>
          <p className="text-slate-500">Informes y estadísticas institucionales</p>
        </div>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">{filteredCategories.length}</p>
          <p className="text-sm text-slate-500">Categorías disponibles</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">
            {filteredCategories.reduce((sum, cat) => sum + cat.reportCount, 0)}
          </p>
          <p className="text-sm text-slate-500">Reportes totales</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-600" />
            <span className="text-sm text-slate-600">Exportación CSV</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Disponible en todos los reportes</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-slate-600">Impresión</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Formato optimizado</p>
        </div>
      </div>

      {/* Grid de categorías */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCategories.map((cat) => (
          <Link
            key={cat.id}
            to={cat.href}
            className={`group p-5 rounded-xl border ${cat.borderColor} ${cat.bgColor} hover:shadow-md transition-all`}
          >
            <div className="flex items-start justify-between">
              <div className={`w-12 h-12 rounded-lg ${cat.bgColor} flex items-center justify-center border ${cat.borderColor}`}>
                <cat.icon className={`w-6 h-6 ${cat.color}`} />
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${cat.color} bg-white px-2 py-1 rounded-full`}>
                  {cat.reportCount} reportes
                </span>
                <ChevronRight className={`w-5 h-5 ${cat.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
              </div>
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">{cat.name}</h3>
            <p className="mt-1 text-sm text-slate-600">{cat.description}</p>
          </Link>
        ))}
      </div>

      {/* Accesos rápidos */}
      <div className="mt-8 p-4 bg-slate-50 rounded-xl border border-slate-200">
        <h3 className="font-semibold text-slate-800 mb-3">Reportes más utilizados</h3>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/reports/academic?report=cons-subjects"
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200 hover:border-green-300 hover:bg-green-50 transition-colors"
          >
            <BookOpen className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-slate-700">Consolidado Asignaturas</span>
          </Link>
          <Link
            to="/reports/attendance?report=att-group"
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50 transition-colors"
          >
            <Calendar className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-slate-700">Asistencia por Grupo</span>
          </Link>
          <Link
            to="/reports/bulletins?report=report-partial"
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors"
          >
            <FileText className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-slate-700">Boletines Parciales</span>
          </Link>
          <Link
            to="/reports/alerts?report=alert-low-performance"
            className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200 hover:border-red-300 hover:bg-red-50 transition-colors"
          >
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-slate-700">Bajo Rendimiento</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
