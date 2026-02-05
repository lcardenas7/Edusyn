import { useState, useEffect } from 'react'
import { 
  Settings,
  Download,
  Printer,
  ArrowLeft,
  ChevronLeft,
  Shield,
  Users,
  Clock,
  Database,
  Activity
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { academicYearsApi } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'

interface ConfigItem {
  id: string
  name: string
  description: string
  icon: any
  feature?: string
}

const configItems: ConfigItem[] = [
  { id: 'config-audit', name: 'Auditoría de cambios', description: 'Registro de modificaciones en el sistema', icon: Activity, feature: 'ADMIN_AUDIT' },
  { id: 'config-users', name: 'Usuarios del sistema', description: 'Listado de usuarios y roles asignados', icon: Users, feature: 'ADMIN_USERS' },
  { id: 'config-permissions', name: 'Permisos por rol', description: 'Matriz de permisos configurados', icon: Shield, feature: 'ADMIN_PERMISSIONS' },
  { id: 'config-sessions', name: 'Sesiones activas', description: 'Usuarios conectados actualmente', icon: Clock, feature: 'ADMIN_SESSIONS' },
  { id: 'config-backup', name: 'Estado de backups', description: 'Historial de respaldos del sistema', icon: Database, feature: 'ADMIN_BACKUP' },
  { id: 'config-system', name: 'Configuración general', description: 'Parámetros del sistema institucional', icon: Settings, feature: 'ADMIN_SYSTEM' },
]

export default function SystemConfig() {
  const { hasFeature } = useAuth()
  
  // Estado local - no usa useReportsData porque esto NO es un reporte
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [filterYear, setFilterYear] = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  
  useEffect(() => {
    const loadYears = async () => {
      try {
        const response = await academicYearsApi.getAll()
        setAcademicYears(response.data || [])
      } catch (err) {
        console.error('Error loading years:', err)
      }
    }
    loadYears()
  }, [])

  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)

  // Filtrar reportes según features
  const filteredItems = configItems.filter(item => !item.feature || hasFeature(item.feature))

  const handleSelectReport = async (reportId: string) => {
    setSelectedReport(reportId)
    setShowReport(true)
  }

  const handleBack = () => {
    setShowReport(false)
    setSelectedReport(null)
  }

  const currentItem = filteredItems.find(item => item.id === selectedReport)

  // Renderizar filtros según el tipo de reporte
  const renderFilters = () => {
    if (selectedReport === 'config-audit') {
      return (
        <div className="bg-slate-100 border border-slate-300 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Desde</label>
              <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Hasta</label>
              <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de Acción</label>
              <select className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todas</option>
                <option value="create">Creación</option>
                <option value="update">Modificación</option>
                <option value="delete">Eliminación</option>
              </select>
            </div>
            <div className="flex items-end">
              <button className="px-4 py-1.5 bg-slate-600 text-white rounded text-sm hover:bg-slate-700 w-full">Buscar</button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="bg-slate-100 border border-slate-300 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Año Escolar</label>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="">Seleccionar...</option>
              {academicYears.map(year => (
                <option key={year.id} value={year.id}>{year.year}{year.status === 'ACTIVE' ? ' - Activo' : ''}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button className="px-4 py-1.5 bg-slate-600 text-white rounded text-sm hover:bg-slate-700">Generar Reporte</button>
          </div>
        </div>
      </div>
    )
  }

  // Renderizar contenido del reporte
  const renderReportContent = () => {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <Settings className="w-10 h-10 text-slate-600" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">{currentItem?.name}</h3>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">{currentItem?.description}</p>
        
        <div className="bg-slate-50 rounded-lg p-4 max-w-lg mx-auto text-left">
          <h4 className="font-medium text-slate-800 mb-3">Este reporte incluye:</h4>
          <ul className="space-y-2 text-sm text-slate-600">
            {selectedReport === 'config-audit' && (
              <>
                <li>• Registro de todas las acciones del sistema</li>
                <li>• Usuario que realizó cada acción</li>
                <li>• Fecha y hora de cada cambio</li>
                <li>• Detalle de valores anteriores y nuevos</li>
              </>
            )}
            {selectedReport === 'config-users' && (
              <>
                <li>• Listado completo de usuarios</li>
                <li>• Roles asignados a cada usuario</li>
                <li>• Estado de la cuenta (activo/inactivo)</li>
                <li>• Último acceso al sistema</li>
              </>
            )}
            {selectedReport === 'config-permissions' && (
              <>
                <li>• Matriz de permisos por rol</li>
                <li>• Módulos habilitados</li>
                <li>• Acciones permitidas por módulo</li>
              </>
            )}
            {selectedReport === 'config-sessions' && (
              <>
                <li>• Usuarios conectados actualmente</li>
                <li>• Tiempo de sesión activa</li>
                <li>• Dispositivo y ubicación</li>
              </>
            )}
            {selectedReport === 'config-backup' && (
              <>
                <li>• Historial de respaldos automáticos</li>
                <li>• Estado de cada backup</li>
                <li>• Tamaño y ubicación de archivos</li>
              </>
            )}
            {selectedReport === 'config-system' && (
              <>
                <li>• Configuración institucional</li>
                <li>• Parámetros del sistema</li>
                <li>• Módulos habilitados</li>
                <li>• Integraciones activas</li>
              </>
            )}
          </ul>
        </div>
        
        <p className="text-sm text-slate-400 mt-6">
          Configure los filtros y haga clic en "Generar Reporte"
        </p>
      </div>
    )
  }

  // Vista de selección de reporte
  if (!showReport) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/institution" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-200 rounded-xl flex items-center justify-center">
              <Settings className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Configuración / Control</h1>
              <p className="text-sm text-slate-500">Auditoría y configuración del sistema</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelectReport(item.id)}
              className="p-4 bg-white rounded-xl border border-slate-200 hover:border-slate-400 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-slate-600" />
                </div>
                <h3 className="font-medium text-slate-900">{item.name}</h3>
              </div>
              <p className="text-sm text-slate-500">{item.description}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Vista de reporte seleccionado
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center">
              {currentItem && <currentItem.icon className="w-5 h-5 text-slate-600" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{currentItem?.name}</h2>
              <p className="text-sm text-slate-500">{currentItem?.description}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
            <Download className="w-4 h-4" /> Exportar
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </div>

      {renderFilters()}

      <div className="mt-6 bg-white rounded-xl border border-slate-200 p-4">
        {renderReportContent()}
      </div>
    </div>
  )
}
