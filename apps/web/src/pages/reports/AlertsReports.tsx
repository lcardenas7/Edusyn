import { useState } from 'react'
import { 
  Bell,
  AlertTriangle,
  TrendingDown,
  Users,
  Download,
  Printer,
  ArrowLeft,
  ChevronLeft
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useReportsData } from '../../hooks/useReportsData'
import { useAuth } from '../../contexts/AuthContext'
import { teacherAssignmentsApi, periodFinalGradesApi } from '../../lib/api'

interface ReportItem {
  id: string
  name: string
  description: string
  icon: any
  feature?: string
}

const alertsReports: ReportItem[] = [
  { id: 'alert-low-performance', name: 'Bajo rendimiento', description: 'Estudiantes con promedio inferior a 3.5', icon: TrendingDown, feature: 'RPT_ALERT_LOW' },
  { id: 'alert-fail-risk', name: 'Riesgo de reprobación', description: 'Estudiantes con 2+ materias perdidas', icon: AlertTriangle, feature: 'RPT_ALERT_FAIL' },
  { id: 'alert-attendance', name: 'Alertas de asistencia', description: 'Estudiantes con asistencia crítica', icon: Users, feature: 'RPT_ALERT_ATT' },
]

export default function AlertsReports() {
  const { hasFeature } = useAuth()
  const {
    academicYears, terms, groups,
    filterYear, setFilterYear,
    filterPeriod, setFilterPeriod,
    filterGrade, setFilterGrade,
  } = useReportsData()

  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)

  // Datos de reportes
  const [alertsData, setAlertsData] = useState<any[]>([])

  // Filtrar reportes según features
  const filteredReports = alertsReports.filter(r => !r.feature || hasFeature(r.feature))

  const handleSelectReport = async (reportId: string) => {
    setSelectedReport(reportId)
    setShowReport(true)
  }

  const loadReportData = async (reportId: string) => {
    if (!filterYear || !filterPeriod) return
    setLoadingReport(true)

    try {
      // Reportes de alertas - bajo rendimiento
      if (reportId === 'alert-low-performance' || reportId === 'alert-fail-risk') {
        const assignmentsRes = await teacherAssignmentsApi.getAll({ academicYearId: filterYear })
        const assignments = assignmentsRes.data || []
        const groupIds = [...new Set(assignments.map((a: any) => a.group?.id).filter(Boolean))]
        
        const alertsList: any[] = []
        
        for (const groupId of groupIds) {
          if (filterGrade !== 'all' && groupId !== filterGrade) continue
          
          try {
            const gradesRes = await periodFinalGradesApi.getByGroup(groupId as string, filterPeriod)
            const grades = gradesRes.data || []
            
            // Agrupar por estudiante
            const studentGrades = new Map<string, any>()
            grades.forEach((g: any) => {
              const studentId = g.studentEnrollmentId
              const student = g.studentEnrollment?.student
              if (!studentGrades.has(studentId)) {
                studentGrades.set(studentId, {
                  name: student ? `${student.lastName} ${student.firstName}`.toUpperCase() : 'Estudiante',
                  group: g.studentEnrollment?.group?.name || '',
                  grades: [],
                  failedCount: 0
                })
              }
              const sData = studentGrades.get(studentId)
              const score = Number(g.finalScore)
              sData.grades.push(score)
              if (score < 3.0) sData.failedCount++
            })
            
            // Filtrar estudiantes con bajo rendimiento
            studentGrades.forEach((s) => {
              const avg = s.grades.length > 0 ? s.grades.reduce((a: number, b: number) => a + b, 0) / s.grades.length : 0
              
              // Para bajo rendimiento: promedio < 3.5
              // Para riesgo de reprobación: 2+ materias perdidas
              const shouldInclude = reportId === 'alert-low-performance' 
                ? (avg < 3.5 || s.failedCount > 0)
                : (s.failedCount >= 2)
              
              if (shouldInclude) {
                alertsList.push({
                  nro: alertsList.length + 1,
                  name: s.name,
                  group: s.group,
                  avg: avg,
                  failed: s.failedCount,
                  risk: avg < 3.0 ? 'Alto' : s.failedCount >= 2 ? 'Alto' : 'Medio'
                })
              }
            })
          } catch (err) {
            // Ignorar errores
          }
        }
        
        // Ordenar por riesgo y promedio
        alertsList.sort((a, b) => {
          if (a.risk === 'Alto' && b.risk !== 'Alto') return -1
          if (a.risk !== 'Alto' && b.risk === 'Alto') return 1
          return a.avg - b.avg
        })
        
        setAlertsData(alertsList.map((item, idx) => ({ ...item, nro: idx + 1 })))
      }

    } catch (err) {
      console.error('Error loading report data:', err)
    } finally {
      setLoadingReport(false)
    }
  }

  // Exportar a CSV
  const exportToCSV = () => {
    let csvContent = ''
    let filename = 'alertas'

    if (selectedReport === 'alert-low-performance' || selectedReport === 'alert-fail-risk') {
      filename = selectedReport === 'alert-low-performance' ? 'bajo_rendimiento' : 'riesgo_reprobacion'
      csvContent = 'Nro,Estudiante,Grupo,Promedio,Materias Perdidas,Nivel de Riesgo\n'
      alertsData.forEach((row, idx) => {
        csvContent += `${idx + 1},"${row.name || ''}","${row.group || ''}",${row.avg?.toFixed(1) || '-'},${row.failed || 0},${row.risk || ''}\n`
      })
    }

    if (!csvContent || csvContent.split('\n').length <= 1) {
      alert('No hay datos para exportar')
      return
    }

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const handleBack = () => {
    setShowReport(false)
    setSelectedReport(null)
  }

  const currentReportData = filteredReports.find(r => r.id === selectedReport)

  // Renderizar filtros
  const renderFilters = () => {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-4">
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
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Período</label>
            <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="">Seleccionar...</option>
              {terms.map(term => (
                <option key={term.id} value={term.id}>{term.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Grupo</label>
            <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="all">Todos</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>{group.grade?.name} {group.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => selectedReport && loadReportData(selectedReport)} className="px-4 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 w-full">Buscar</button>
          </div>
        </div>
      </div>
    )
  }

  // Renderizar tabla de resultados
  const renderReportTable = () => {
    if (loadingReport) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        </div>
      )
    }

    if (alertsData.length > 0) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">Nro</th>
                <th className="px-3 py-2 text-left">Estudiante</th>
                <th className="px-3 py-2 text-left">Grupo</th>
                <th className="px-3 py-2 text-center">Promedio</th>
                <th className="px-3 py-2 text-center">Materias Perdidas</th>
                <th className="px-3 py-2 text-center">Nivel de Riesgo</th>
              </tr>
            </thead>
            <tbody>
              {alertsData.map((row, idx) => (
                <tr key={idx} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2">{row.nro}</td>
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2">{row.group}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={row.avg < 3.0 ? 'text-red-600 font-medium' : ''}>{row.avg?.toFixed(1)}</span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {row.failed > 0 ? (
                      <span className="text-red-600 font-medium">{row.failed}</span>
                    ) : (
                      <span className="text-green-600">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${
                      row.risk === 'Alto' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>{row.risk}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Resumen */}
          <div className="mt-4 p-4 bg-slate-50 rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-slate-900">{alertsData.length}</p>
                <p className="text-sm text-slate-500">Total estudiantes</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{alertsData.filter(a => a.risk === 'Alto').length}</p>
                <p className="text-sm text-slate-500">Riesgo alto</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{alertsData.filter(a => a.risk === 'Medio').length}</p>
                <p className="text-sm text-slate-500">Riesgo medio</p>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="text-center py-12 text-slate-500">
        <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Seleccione los filtros y haga clic en "Buscar" para generar el reporte</p>
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
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <Bell className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Alertas y Estadísticas</h1>
              <p className="text-sm text-slate-500">Estudiantes en riesgo y análisis de rendimiento</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <button
              key={report.id}
              onClick={() => handleSelectReport(report.id)}
              className="p-4 bg-white rounded-xl border border-slate-200 hover:border-red-300 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <report.icon className="w-5 h-5 text-red-600" />
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
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              {currentReportData && <currentReportData.icon className="w-5 h-5 text-red-600" />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{currentReportData?.name}</h2>
              <p className="text-sm text-slate-500">{currentReportData?.description}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToCSV} className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </div>

      {renderFilters()}

      <div className="mt-6 bg-white rounded-xl border border-slate-200 p-4">
        {renderReportTable()}
      </div>
    </div>
  )
}
