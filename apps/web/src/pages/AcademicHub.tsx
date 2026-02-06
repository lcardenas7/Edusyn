import { 
  BookOpen, 
  Calendar, 
  Percent,
  GraduationCap,
  CalendarClock,
  RefreshCw,
  ChevronRight,
  Settings,
  Users,
  FileText,
  Layers
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAcademic } from '../contexts/AcademicContext'
import { useAuth } from '../contexts/AuthContext'

interface ConfigCard {
  title: string
  description: string
  icon: any
  href: string
  color: string
  bgColor: string
  borderColor: string
}

export default function AcademicHub() {
  const { institution: authInstitution } = useAuth()
  const { academicYear, academicCalendar, academicLevels } = useAcademic()

  // Tarjetas principales - acceso frecuente
  const mainCards: ConfigCard[] = [
    {
      title: 'Catálogo Académico',
      description: 'Áreas, asignaturas y plan de estudios',
      icon: BookOpen,
      href: '/academic/catalog',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      title: 'Plantillas Académicas',
      description: 'Plantillas de evaluación por asignatura',
      icon: FileText,
      href: '/academic/templates',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
    {
      title: 'Carga Docente',
      description: 'Asignación de docentes a grupos y materias',
      icon: Users,
      href: '/academic/assignments',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      title: 'Año Académico',
      description: 'Configuración y cierre del año escolar',
      icon: Calendar,
      href: '/academic/year/setup',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200'
    },
  ]

  // Configuración académica (SIEE)
  const configCards: ConfigCard[] = [
    {
      title: 'Niveles Académicos',
      description: 'Calendario y escalas por nivel educativo',
      icon: GraduationCap,
      href: '/academic/config/levels',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200'
    },
    {
      title: 'Sistema de Calificación',
      description: 'Procesos evaluativos y pesos (SIEE)',
      icon: Percent,
      href: '/academic/config/scale',
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      borderColor: 'border-teal-200'
    },
    {
      title: 'Períodos Académicos',
      description: 'Configuración de períodos y componentes',
      icon: Layers,
      href: '/academic/config/periods',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200'
    },
    {
      title: 'Ventanas de Calificación',
      description: 'Fechas para ingreso de notas',
      icon: CalendarClock,
      href: '/academic/config/windows/grading',
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200'
    },
    {
      title: 'Ventanas de Recuperación',
      description: 'Fechas para actividades de recuperación',
      icon: RefreshCw,
      href: '/academic/config/windows/recovery',
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
      borderColor: 'border-cyan-200'
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
          <BookOpen className="w-7 h-7 text-green-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión Académica</h1>
          <p className="text-slate-500">Configuración pedagógica de {authInstitution?.name || 'la institución'}</p>
        </div>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">{academicYear}</p>
          <p className="text-sm text-slate-500">Año Académico</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">{academicLevels.length}</p>
          <p className="text-sm text-slate-500">Niveles Educativos</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">{academicCalendar}</p>
          <p className="text-sm text-slate-500">Calendario</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-slate-600">Año activo</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Sistema en funcionamiento</p>
        </div>
      </div>

      {/* Tarjetas principales */}
      <h2 className="text-lg font-semibold text-slate-800 mb-4">Gestión Principal</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {mainCards.map((card) => (
          <Link
            key={card.href}
            to={card.href}
            className={`group p-5 rounded-xl border ${card.borderColor} ${card.bgColor} hover:shadow-md transition-all`}
          >
            <div className="flex items-start justify-between">
              <div className={`w-12 h-12 rounded-lg ${card.bgColor} flex items-center justify-center border ${card.borderColor}`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <ChevronRight className={`w-5 h-5 ${card.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
            </div>
            <h3 className="mt-4 font-semibold text-slate-900">{card.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{card.description}</p>
          </Link>
        ))}
      </div>

      {/* Configuración Académica (SIEE) */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-5 h-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-800">Configuración Académica (SIEE)</h2>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          Sistema Institucional de Evaluación de Estudiantes - Configuración de niveles, escalas, períodos y ventanas
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {configCards.map((card) => (
            <Link
              key={card.href}
              to={card.href}
              className={`group p-4 rounded-lg border ${card.borderColor} bg-white hover:${card.bgColor} hover:shadow-sm transition-all`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900">{card.title}</h3>
                  <p className="text-xs text-slate-500">{card.description}</p>
                </div>
                <ChevronRight className={`w-4 h-4 ${card.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Acceso rápido al cierre */}
      <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-amber-800">Cierre de Año Académico</h3>
            <p className="text-sm text-amber-600">Proceso de cierre, promoción y apertura del nuevo año</p>
          </div>
          <Link
            to="/academic/year/closure"
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            <span className="text-sm font-medium">Ir al Cierre</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
