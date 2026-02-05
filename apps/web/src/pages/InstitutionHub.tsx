import { 
  Building2, 
  UsersRound,
  Users,
  ChevronRight,
  Settings
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useInstitution } from '../contexts/InstitutionContext'

interface ConfigCard {
  title: string
  description: string
  icon: any
  href: string
  color: string
  bgColor: string
  borderColor: string
}

export default function InstitutionHub() {
  const { institution } = useInstitution()

  // Solo lo que corresponde a INSTITUCIÓN (identidad y estructura)
  const configCards: ConfigCard[] = [
    {
      title: 'Información General',
      description: 'Datos básicos, logo, DANE, rector',
      icon: Building2,
      href: '/institution/profile',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      title: 'Estructura Organizacional',
      description: 'Sedes, jornadas, grados y grupos',
      icon: UsersRound,
      href: '/institution/structure',
      color: 'text-teal-600',
      bgColor: 'bg-teal-50',
      borderColor: 'border-teal-200'
    },
    {
      title: 'Usuarios',
      description: 'Gestión de usuarios y roles del sistema',
      icon: Users,
      href: '/staff',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    },
  ]

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
          <Settings className="w-7 h-7 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuración Institucional</h1>
          <p className="text-slate-500">{institution.name}</p>
        </div>
      </div>

      {/* Resumen rápido - Solo datos institucionales */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">{institution.nit || '-'}</p>
          <p className="text-sm text-slate-500">NIT</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">{institution.dane || '-'}</p>
          <p className="text-sm text-slate-500">Código DANE</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-2xl font-bold text-slate-900">{institution.city || '-'}</p>
          <p className="text-sm text-slate-500">Ciudad</p>
        </div>
      </div>

      {/* Grid de configuraciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {configCards.map((card) => (
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
            <h3 className={`mt-4 font-semibold text-slate-900`}>{card.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{card.description}</p>
          </Link>
        ))}
      </div>

      {/* Administración del Sistema - Acceso secundario */}
      <div className="mt-6 p-4 bg-slate-100 rounded-xl border border-slate-300">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-700">Administración del Sistema</h3>
            <p className="text-sm text-slate-500">Usuarios, permisos, auditoría y configuración avanzada</p>
          </div>
          <Link
            to="/admin/system"
            className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="text-sm font-medium">Configuración del Sistema</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
