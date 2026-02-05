import { useState, useEffect } from 'react'
import { 
  Briefcase,
  Users,
  UserCheck,
  UserX,
  ClipboardList,
  BarChart3,
  Download,
  Printer,
  ArrowLeft,
  ChevronLeft,
  GraduationCap
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useReportsData } from '../../hooks/useReportsData'
import { useAuth } from '../../contexts/AuthContext'
import { teacherAssignmentsApi } from '../../lib/api'

interface ReportItem {
  id: string
  name: string
  description: string
  icon: any
  feature?: string
}

const adminReports: ReportItem[] = [
  { id: 'load-teacher', name: 'Carga docente', description: 'Horas, materias y grupos asignados por docente', icon: Users, feature: 'RPT_LOAD_TEACHER' },
  { id: 'load-group', name: 'Carga por grupo', description: 'Materias y docentes asignados por grupo', icon: GraduationCap, feature: 'RPT_LOAD_GROUP' },
  { id: 'teachers-active', name: 'Docentes activos', description: 'Listado de docentes con asignación', icon: UserCheck, feature: 'RPT_TEACHERS_ACTIVE' },
  { id: 'teachers-no-load', name: 'Docentes sin carga', description: 'Docentes sin asignación académica', icon: UserX, feature: 'RPT_TEACHERS_NOLOAD' },
  { id: 'coverage', name: 'Cobertura académica', description: 'Porcentaje de asignaturas cubiertas', icon: ClipboardList, feature: 'RPT_COVERAGE' },
  { id: 'hours-summary', name: 'Resumen de horas', description: 'Total de horas por nivel y jornada', icon: BarChart3, feature: 'RPT_HOURS' },
  { id: 'staff-list', name: 'Listado de personal', description: 'Directivos, docentes y administrativos', icon: Users, feature: 'RPT_STAFF' },
  { id: 'enrollment-summary', name: 'Resumen de matrícula', description: 'Estudiantes por grado y grupo', icon: GraduationCap, feature: 'RPT_ENROLLMENT' },
]

export default function AdminReports() {
  const { hasFeature } = useAuth()
  const {
    academicYears,
    filterYear, setFilterYear,
  } = useReportsData()

  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)

  // Datos de reportes
  const [teacherLoadData, setTeacherLoadData] = useState<any[]>([])
  const [groupLoadData, setGroupLoadData] = useState<any[]>([])

  // Filtrar reportes según features
  const filteredReports = adminReports.filter(r => !r.feature || hasFeature(r.feature))

  const handleSelectReport = async (reportId: string) => {
    setSelectedReport(reportId)
    setShowReport(true)
    await loadReportData(reportId)
  }

  const loadReportData = async (reportId: string) => {
    if (!filterYear) return
    setLoadingReport(true)

    try {
      // Reportes de carga docente
      if (reportId === 'load-teacher' || reportId === 'teachers-active' || reportId === 'teachers-no-load') {
        const assignmentsRes = await teacherAssignmentsApi.getAll({ academicYearId: filterYear })
        const assignments = assignmentsRes.data || []
        
        // Agrupar por docente
        const teacherMap = new Map<string, any>()
        assignments.forEach((a: any) => {
          const teacherId = a.teacherId
          if (!teacherMap.has(teacherId)) {
            teacherMap.set(teacherId, {
              id: teacherId,
              name: a.teacher ? `${a.teacher.firstName} ${a.teacher.lastName}`.toUpperCase() : 'Sin nombre',
              subjects: new Set(),
              groups: new Set(),
              hours: 0
            })
          }
          const teacher = teacherMap.get(teacherId)
          if (a.subject?.name) teacher.subjects.add(a.subject.name)
          if (a.group) teacher.groups.add(`${a.group.grade?.name || ''} ${a.group.name}`)
          teacher.hours += a.weeklyHours || 2
        })
        
        let teacherData = Array.from(teacherMap.values()).map((t, idx) => ({
          nro: idx + 1,
          name: t.name,
          subjects: Array.from(t.subjects).join(', '),
          groups: Array.from(t.groups).join(', '),
          hours: t.hours,
          status: t.hours >= 10 ? 'Completo' : 'Parcial'
        }))

        // Filtrar según el reporte
        if (reportId === 'teachers-no-load') {
          teacherData = teacherData.filter(t => t.hours === 0)
        } else if (reportId === 'teachers-active') {
          teacherData = teacherData.filter(t => t.hours > 0)
        }
        
        setTeacherLoadData(teacherData)
      }
      
      // Reportes de carga por grupo
      if (reportId === 'load-group') {
        const assignmentsRes = await teacherAssignmentsApi.getAll({ academicYearId: filterYear })
        const assignments = assignmentsRes.data || []
        
        // Agrupar por grupo
        const groupMap = new Map<string, any>()
        assignments.forEach((a: any) => {
          const groupId = a.group?.id
          if (!groupId) return
          if (!groupMap.has(groupId)) {
            groupMap.set(groupId, {
              id: groupId,
              name: `${a.group.grade?.name || ''} ${a.group.name}`,
              director: '',
              subjects: new Set(),
              teachers: new Set()
            })
          }
          const group = groupMap.get(groupId)
          if (a.subject?.name) group.subjects.add(a.subject.name)
          if (a.teacherId) group.teachers.add(a.teacherId)
        })
        
        const groupData = Array.from(groupMap.values()).map((g, idx) => ({
          nro: idx + 1,
          group: g.name,
          director: g.director || 'Sin asignar',
          students: 0,
          subjects: g.subjects.size,
          teachers: g.teachers.size,
          complete: g.subjects.size >= 8
        }))
        
        setGroupLoadData(groupData)
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
    let filename = 'reporte_admin'

    if (selectedReport === 'load-teacher' || selectedReport === 'teachers-active' || selectedReport === 'teachers-no-load') {
      filename = selectedReport === 'load-teacher' ? 'carga_docente' : selectedReport === 'teachers-active' ? 'docentes_activos' : 'docentes_sin_carga'
      csvContent = 'Nro,Docente,Asignaturas,Grupos,Horas,Estado\n'
      teacherLoadData.forEach((row, idx) => {
        csvContent += `${idx + 1},"${row.name || ''}","${row.subjects || ''}","${row.groups || ''}",${row.hours || 0},${row.status || ''}\n`
      })
    } else if (selectedReport === 'load-group') {
      filename = 'carga_por_grupo'
      csvContent = 'Nro,Grupo,Director,Estudiantes,Asignaturas,Docentes,Completo\n'
      groupLoadData.forEach((row, idx) => {
        csvContent += `${idx + 1},"${row.group || ''}","${row.director || ''}",${row.students || 0},${row.subjects || 0},${row.teachers || 0},${row.complete ? 'Sí' : 'No'}\n`
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
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
            <label className="block text-xs font-medium text-slate-600 mb-1">Sede</label>
            <select className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="all">Todas</option>
              <option value="principal">Principal</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Jornada</label>
            <select className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="all">Todas</option>
              <option value="manana">Mañana</option>
              <option value="tarde">Tarde</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => selectedReport && loadReportData(selectedReport)} className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 w-full">Buscar</button>
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )
    }

    if ((selectedReport === 'load-teacher' || selectedReport === 'teachers-active' || selectedReport === 'teachers-no-load') && teacherLoadData.length > 0) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">Nro</th>
                <th className="px-3 py-2 text-left">Docente</th>
                <th className="px-3 py-2 text-left">Asignaturas</th>
                <th className="px-3 py-2 text-left">Grupos</th>
                <th className="px-3 py-2 text-center">Horas</th>
                <th className="px-3 py-2 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {teacherLoadData.map((row, idx) => (
                <tr key={idx} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2">{row.nro}</td>
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2 text-slate-600 max-w-xs truncate">{row.subjects}</td>
                  <td className="px-3 py-2 text-slate-600 max-w-xs truncate">{row.groups}</td>
                  <td className="px-3 py-2 text-center">{row.hours}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${
                      row.status === 'Completo' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (selectedReport === 'load-group' && groupLoadData.length > 0) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">Nro</th>
                <th className="px-3 py-2 text-left">Grupo</th>
                <th className="px-3 py-2 text-left">Director</th>
                <th className="px-3 py-2 text-center">Estudiantes</th>
                <th className="px-3 py-2 text-center">Asignaturas</th>
                <th className="px-3 py-2 text-center">Docentes</th>
                <th className="px-3 py-2 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {groupLoadData.map((row, idx) => (
                <tr key={idx} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2">{row.nro}</td>
                  <td className="px-3 py-2 font-medium">{row.group}</td>
                  <td className="px-3 py-2 text-slate-600">{row.director}</td>
                  <td className="px-3 py-2 text-center">{row.students}</td>
                  <td className="px-3 py-2 text-center">{row.subjects}</td>
                  <td className="px-3 py-2 text-center">{row.teachers}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${
                      row.complete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>{row.complete ? 'Completo' : 'Incompleto'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    return (
      <div className="text-center py-12 text-slate-500">
        <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-50" />
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
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Reportes de Administración</h1>
              <p className="text-sm text-slate-500">Carga docente, cobertura y gestión de personal</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <button
              key={report.id}
              onClick={() => handleSelectReport(report.id)}
              className="p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <report.icon className="w-5 h-5 text-blue-600" />
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
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              {currentReportData && <currentReportData.icon className="w-5 h-5 text-blue-600" />}
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
