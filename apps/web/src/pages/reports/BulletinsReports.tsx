import { useState } from 'react'
import { 
  FileText,
  Download,
  Printer,
  ArrowLeft,
  ChevronLeft,
  GraduationCap,
  Award,
  ClipboardList,
  ExternalLink
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useReportsData } from '../../hooks/useReportsData'
import { useAuth } from '../../contexts/AuthContext'

interface ReportItem {
  id: string
  name: string
  description: string
  icon: any
  feature?: string
}

const bulletinsReports: ReportItem[] = [
  { id: 'report-partial', name: 'Boletín parcial', description: 'Informe de notas por período', icon: FileText, feature: 'RPT_BULLETIN_PARTIAL' },
  { id: 'report-final', name: 'Boletín final', description: 'Informe consolidado del año', icon: Award, feature: 'RPT_BULLETIN_FINAL' },
  { id: 'report-certificate', name: 'Certificado de notas', description: 'Documento oficial de calificaciones', icon: ClipboardList, feature: 'RPT_CERTIFICATE' },
  { id: 'report-constancy', name: 'Constancia de estudio', description: 'Certificación de matrícula activa', icon: GraduationCap, feature: 'RPT_CONSTANCY' },
  { id: 'report-promotion', name: 'Acta de promoción', description: 'Documento de promoción al siguiente grado', icon: Award, feature: 'RPT_PROMOTION_ACT' },
]

export default function BulletinsReports() {
  const { hasFeature } = useAuth()
  const {
    academicYears, terms, groups, students,
    filterYear, setFilterYear,
    filterPeriod, setFilterPeriod,
    filterGrade, setFilterGrade,
    filterStudentId, setFilterStudentId,
  } = useReportsData()

  const navigate = useNavigate()
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)

  // Filtrar reportes según features
  const filteredReports = bulletinsReports.filter(r => !r.feature || hasFeature(r.feature))

  const handleSelectReport = async (reportId: string) => {
    setSelectedReport(reportId)
    setShowReport(true)
  }

  const generateReport = async () => {
    if (!filterYear) {
      alert('Seleccione un año escolar')
      return
    }
    
    if ((selectedReport === 'report-partial') && !filterPeriod) {
      alert('Seleccione un período')
      return
    }

    if (filterGrade === 'all' && filterStudentId === 'all') {
      alert('Seleccione un grupo o un estudiante específico')
      return
    }

    // Boletín parcial y final: redirigir a la página de Boletines Académicos
    if (selectedReport === 'report-partial' || selectedReport === 'report-final') {
      navigate('/report-cards')
      return
    }

    setGeneratingPDF(true)
    
    try {
      // Certificados y constancias: próximamente con generación PDF completa
      await new Promise(resolve => setTimeout(resolve, 800))
      alert('La generación de este documento estará disponible próximamente. Use la sección de Boletines Académicos para generar boletines de notas.')
    } catch (err) {
      console.error('Error generating report:', err)
      alert('Error al generar el reporte')
    } finally {
      setGeneratingPDF(false)
    }
  }

  const handleBack = () => {
    setShowReport(false)
    setSelectedReport(null)
  }

  const currentReportData = filteredReports.find(r => r.id === selectedReport)

  // Renderizar filtros según el tipo de boletín
  const renderFilters = () => {
    return (
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-4">
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
          
          {selectedReport === 'report-partial' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Período</label>
              <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="">Seleccionar...</option>
                {terms.map(term => (
                  <option key={term.id} value={term.id}>{term.name}</option>
                ))}
              </select>
            </div>
          )}
          
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Grupo</label>
            <select value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setFilterStudentId('all'); }} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="all">Seleccionar grupo...</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>{group.grade?.name} {group.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Estudiante (opcional)</label>
            <select value={filterStudentId} onChange={(e) => setFilterStudentId(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" disabled={filterGrade === 'all'}>
              <option value="all">Todos los estudiantes</option>
              {students.map(s => (
                <option key={s.enrollmentId || s.id} value={s.enrollmentId || s.id}>{[s.lastName, s.secondLastName, s.firstName, s.secondName].filter(Boolean).join(' ')}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="flex items-center justify-between pt-2">
          <div className="text-sm text-indigo-700">
            {filterStudentId !== 'all' 
              ? '📄 Se generará boletín individual'
              : filterGrade !== 'all'
                ? '📚 Se generarán boletines para todo el grupo'
                : '⚠️ Seleccione un grupo o estudiante'
            }
          </div>
          <button 
            onClick={generateReport} 
            disabled={generatingPDF}
            className="px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
          >
            {generatingPDF ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Generando...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Generar {selectedReport === 'report-partial' ? 'Boletín' : currentReportData?.name}
              </>
            )}
          </button>
        </div>
      </div>
    )
  }

  // Renderizar vista previa o información
  const renderPreview = () => {
    const isBoletinType = selectedReport === 'report-partial' || selectedReport === 'report-final'
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="w-10 h-10 text-indigo-600" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">{currentReportData?.name}</h3>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">{currentReportData?.description}</p>
        {isBoletinType && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-lg mx-auto mb-6">
            <p className="text-sm text-blue-800 flex items-center justify-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Para generar y previsualizar boletines, use la sección de <strong>Boletines Académicos</strong> (Reportes &gt; Boletines)
            </p>
            <button onClick={() => navigate('/report-cards')} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors inline-flex items-center gap-2">
              <FileText className="w-4 h-4" /> Ir a Boletines Académicos
            </button>
          </div>
        )}
        
        <div className="bg-slate-50 rounded-lg p-4 max-w-lg mx-auto text-left">
          <h4 className="font-medium text-slate-800 mb-3">Información del documento:</h4>
          <ul className="space-y-2 text-sm text-slate-600">
            {selectedReport === 'report-partial' && (
              <>
                <li>• Notas de todas las asignaturas del período</li>
                <li>• Promedio general y desempeño</li>
                <li>• Observaciones del director de grupo</li>
                <li>• Fallas y retardos del período</li>
              </>
            )}
            {selectedReport === 'report-final' && (
              <>
                <li>• Consolidado de todos los períodos</li>
                <li>• Nota definitiva por asignatura</li>
                <li>• Promedio final y puesto</li>
                <li>• Estado de promoción</li>
              </>
            )}
            {selectedReport === 'report-certificate' && (
              <>
                <li>• Documento oficial con membrete</li>
                <li>• Historial de notas certificado</li>
                <li>• Firma digital del rector</li>
              </>
            )}
            {selectedReport === 'report-constancy' && (
              <>
                <li>• Certificación de matrícula vigente</li>
                <li>• Datos del estudiante y grado</li>
                <li>• Válido para trámites externos</li>
              </>
            )}
            {selectedReport === 'report-promotion' && (
              <>
                <li>• Acta oficial de promoción</li>
                <li>• Grado actual y grado promovido</li>
                <li>• Firmas de comisión de evaluación</li>
              </>
            )}
          </ul>
        </div>
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
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Boletines y Certificados</h1>
              <p className="text-sm text-slate-500">Documentos oficiales para estudiantes</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <button
              key={report.id}
              onClick={() => handleSelectReport(report.id)}
              className="p-4 bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <report.icon className="w-5 h-5 text-indigo-600" />
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
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              {currentReportData && <currentReportData.icon className="w-5 h-5 text-indigo-600" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{currentReportData?.name}</h2>
              <p className="text-sm text-slate-500">{currentReportData?.description}</p>
            </div>
          </div>
        </div>
      </div>

      {renderFilters()}

      <div className="mt-6 bg-white rounded-xl border border-slate-200 p-4">
        {renderPreview()}
      </div>
    </div>
  )
}
