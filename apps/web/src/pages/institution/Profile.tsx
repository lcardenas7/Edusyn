import { 
  Building2,
  Eye,
  ArrowLeft,
  Save
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useInstitution } from '../../contexts/InstitutionContext'
import { usePermissions, PERMISSIONS } from '../../hooks/usePermissions'

export default function Profile() {
  const { institution, setInstitution, isSaving } = useInstitution()
  const { can } = usePermissions()
  
  const canEditInfo = can(PERMISSIONS.CONFIG_INFO_EDIT)

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link 
            to="/dashboard" 
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Información General</h1>
              <p className="text-sm text-slate-500">Datos básicos de la institución</p>
            </div>
          </div>
        </div>
        
        {!canEditInfo && (
          <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
            <Eye className="w-3 h-3" /> Solo lectura
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Institución</label>
              <input
                type="text"
                value={institution.name}
                onChange={(e) => canEditInfo && setInstitution({ ...institution, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                readOnly={!canEditInfo}
                disabled={!canEditInfo}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">NIT</label>
              <input
                type="text"
                value={institution.nit}
                onChange={(e) => canEditInfo && setInstitution({ ...institution, nit: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                readOnly={!canEditInfo}
                disabled={!canEditInfo}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Código DANE</label>
              <input
                type="text"
                value={institution.dane}
                onChange={(e) => canEditInfo && setInstitution({ ...institution, dane: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                readOnly={!canEditInfo}
                disabled={!canEditInfo}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rector(a)</label>
              <input
                type="text"
                value={institution.rector}
                onChange={(e) => canEditInfo && setInstitution({ ...institution, rector: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                readOnly={!canEditInfo}
                disabled={!canEditInfo}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
              <input
                type="text"
                value={institution.address}
                onChange={(e) => canEditInfo && setInstitution({ ...institution, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                readOnly={!canEditInfo}
                disabled={!canEditInfo}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ciudad</label>
              <input
                type="text"
                value={institution.city}
                onChange={(e) => canEditInfo && setInstitution({ ...institution, city: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                readOnly={!canEditInfo}
                disabled={!canEditInfo}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
              <input
                type="text"
                value={institution.phone}
                onChange={(e) => canEditInfo && setInstitution({ ...institution, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                readOnly={!canEditInfo}
                disabled={!canEditInfo}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
              <input
                type="email"
                value={institution.email}
                onChange={(e) => canEditInfo && setInstitution({ ...institution, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                readOnly={!canEditInfo}
                disabled={!canEditInfo}
              />
            </div>
          </div>

          {/* Enlace a estructura organizacional */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Estructura Organizacional</h3>
            <Link
              to="/institution/structure"
              className="inline-flex items-center gap-2 p-4 bg-teal-50 rounded-lg border border-teal-200 hover:bg-teal-100 transition-colors"
            >
              <div>
                <div className="font-medium text-teal-700">Sedes, Grados y Grupos</div>
                <p className="text-xs text-teal-600 mt-1">Configurar la estructura física y organizacional</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
