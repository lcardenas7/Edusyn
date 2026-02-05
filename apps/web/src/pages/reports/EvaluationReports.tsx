import { useState } from 'react'
import { 
  ClipboardList,
  Download,
  Printer,
  ArrowLeft,
  ChevronLeft,
  CheckCircle,
  BarChart3,
  FileText,
  Users
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useReportsData } from '../../hooks/useReportsData'
import { useAuth } from '../../contexts/AuthContext'

interface ReportItem {
  id: string
  name: string
  description: string
  icon: any
  feature?: string
}

const evaluationReports: ReportItem[] = [
  { id: 'eval-compliance', name: 'Cumplimiento SIEE', description: 'Verificación del sistema de evaluación institucional', icon: CheckCircle, feature: 'RPT_EVAL_COMPLIANCE' },
  { id: 'eval-criteria', name: 'Criterios de evaluación', description: 'Configuración de criterios por asignatura', icon: ClipboardList, feature: 'RPT_EVAL_CRITERIA' },
  { id: 'eval-weights', name: 'Pesos de períodos', description: 'Distribución de porcentajes por período', icon: BarChart3, feature: 'RPT_EVAL_WEIGHTS' },
  { id: 'eval-recovery', name: 'Políticas de recuperación', description: 'Configuración de actividades de recuperación', icon: FileText, feature: 'RPT_EVAL_RECOVERY' },
  { id: 'eval-promotion', name: 'Criterios de promoción', description: 'Reglas para promoción de estudiantes', icon: Users, feature: 'RPT_EVAL_PROMOTION' },
  { id: 'eval-scale', name: 'Escala de valoración', description: 'Niveles de desempeño configurados', icon: BarChart3, feature: 'RPT_EVAL_SCALE' },
]

export default function EvaluationReports() {
  const { hasFeature } = useAuth()
  const {
    academicYears,
    filterYear, setFilterYear,
  } = useReportsData()

  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)

  // Filtrar reportes según features
  const filteredReports = evaluationReports.filter(r => !r.feature || hasFeature(r.feature))

  const handleSelectReport = async (reportId: string) => {
    setSelectedReport(reportId)
    setShowReport(true)
  }

  const handleBack = () => {
    setShowReport(false)
    setSelectedReport(null)
  }

  const currentReportData = filteredReports.find(r => r.id === selectedReport)

  // Renderizar filtros
  const renderFilters = () => {
    return (
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-4">
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
            <button className="px-4 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700">Generar Reporte</button>
          </div>
        </div>
      </div>
    )
  }

  // Renderizar contenido del reporte
  const renderReportContent = () => {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ClipboardList className="w-10 h-10 text-purple-600" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">{currentReportData?.name}</h3>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">{currentReportData?.description}</p>
        
        <div className="bg-slate-50 rounded-lg p-4 max-w-lg mx-auto text-left">
          <h4 className="font-medium text-slate-800 mb-3">Este reporte incluye:</h4>
          <ul className="space-y-2 text-sm text-slate-600">
            {selectedReport === 'eval-compliance' && (
              <>
                <li>• Verificación de configuración del SIEE</li>
                <li>• Estado de períodos académicos</li>
                <li>• Cumplimiento de criterios de evaluación</li>
                <li>• Alertas de configuración pendiente</li>
              </>
            )}
            {selectedReport === 'eval-criteria' && (
              <>
                <li>• Criterios configurados por asignatura</li>
                <li>• Porcentajes de cada criterio</li>
                <li>• Asignaturas sin criterios definidos</li>
              </>
            )}
            {selectedReport === 'eval-weights' && (
              <>
                <li>• Peso porcentual de cada período</li>
                <li>• Verificación de suma 100%</li>
                <li>• Configuración por nivel educativo</li>
              </>
            )}
            {selectedReport === 'eval-recovery' && (
              <>
                <li>• Políticas de recuperación vigentes</li>
                <li>• Ventanas de recuperación configuradas</li>
                <li>• Límites de nota de recuperación</li>
              </>
            )}
            {selectedReport === 'eval-promotion' && (
              <>
                <li>• Criterios de promoción por nivel</li>
                <li>• Número máximo de materias perdidas</li>
                <li>• Porcentaje mínimo de asistencia</li>
              </>
            )}
            {selectedReport === 'eval-scale' && (
              <>
                <li>• Escala de valoración configurada</li>
                <li>• Rangos de cada nivel de desempeño</li>
                <li>• Equivalencias cualitativas</li>
              </>
            )}
          </ul>
        </div>
        
        <p className="text-sm text-slate-400 mt-6">
          Seleccione un año escolar y haga clic en "Generar Reporte"
        </p>
      </div>
    )
  }

  // Vista de selección de reporte
  if (!showReport) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/reports" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Evaluación (SIEE)</h1>
              <p className="text-sm text-slate-500">Cumplimiento del sistema de evaluación institucional</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <button
              key={report.id}
              onClick={() => handleSelectReport(report.id)}
              className="p-4 bg-white rounded-xl border border-slate-200 hover:border-purple-300 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <report.icon className="w-5 h-5 text-purple-600" />
                </div>
                <h3 className="font-medium text-slate-900">{report.name}</h3>
              </div>
              <p className="text-sm text-slate-500">{report.description}</p>
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
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              {currentReportData && <currentReportData.icon className="w-5 h-5 text-purple-600" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{currentReportData?.name}</h2>
              <p className="text-sm text-slate-500">{currentReportData?.description}</p>
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
