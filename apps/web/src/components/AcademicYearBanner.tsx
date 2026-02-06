import { Lock } from 'lucide-react'
import { useAcademicYearStatus, YearStatus } from '../hooks/useAcademicYearStatus'

interface Props {
  yearStatus: YearStatus
}

export default function AcademicYearBanner({ yearStatus }: Props) {
  if (!yearStatus) return null

  return (
    <div className={`mb-4 p-3 rounded-lg flex items-center justify-between ${
      yearStatus === 'DRAFT' ? 'bg-amber-50 border border-amber-200' :
      yearStatus === 'ACTIVE' ? 'bg-green-50 border border-green-200' :
      'bg-red-50 border border-red-200'
    }`}>
      <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full ${
          yearStatus === 'DRAFT' ? 'bg-amber-500' :
          yearStatus === 'ACTIVE' ? 'bg-green-500 animate-pulse' :
          'bg-red-500'
        }`} />
        <div>
          <p className={`text-sm font-medium ${
            yearStatus === 'DRAFT' ? 'text-amber-800' :
            yearStatus === 'ACTIVE' ? 'text-green-800' :
            'text-red-800'
          }`}>
            Año en estado: <strong>{
              yearStatus === 'DRAFT' ? 'Borrador' :
              yearStatus === 'ACTIVE' ? 'Activo' :
              'Cerrado'
            }</strong>
          </p>
          <p className={`text-xs ${
            yearStatus === 'DRAFT' ? 'text-amber-600' :
            yearStatus === 'ACTIVE' ? 'text-green-600' :
            'text-red-600'
          }`}>
            {yearStatus === 'DRAFT' && 'Toda la configuración es editable. Active el año cuando esté listo.'}
            {yearStatus === 'ACTIVE' && 'Algunos cambios están restringidos para proteger datos existentes.'}
            {yearStatus === 'CLOSED' && 'El año está cerrado. Solo lectura. Correcciones requieren Acta Académica.'}
          </p>
        </div>
      </div>
      {yearStatus === 'CLOSED' && (
        <Lock className="w-5 h-5 text-red-500" />
      )}
    </div>
  )
}

export { useAcademicYearStatus }
