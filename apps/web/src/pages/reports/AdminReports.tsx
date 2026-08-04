import { useState, useEffect } from 'react'
import { toast } from '../../lib/toast'
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
import { teacherAssignmentsApi, enrollmentsApi, groupsApi } from '../../lib/api'
import { useSortable, SortableHeader } from '../../components/reports/SortableTable'

interface ReportItem {
  id: string
  name: string
  description: string
  icon: any
  feature?: string
}

const adminReports: ReportItem[] = [
  { id: 'load-teacher', name: 'Carga docente', description: 'Horas, materias y grupos asignados por docente', icon: Users },
  { id: 'load-group', name: 'Carga por grupo', description: 'Materias y docentes asignados por grupo', icon: GraduationCap },
  { id: 'teachers-active', name: 'Docentes activos', description: 'Listado de docentes con asignación', icon: UserCheck },
  { id: 'teachers-no-load', name: 'Docentes sin carga', description: 'Docentes sin asignación académica', icon: UserX },
  { id: 'coverage', name: 'Cobertura académica', description: 'Porcentaje de asignaturas cubiertas', icon: ClipboardList },
  { id: 'hours-summary', name: 'Resumen de horas', description: 'Total de horas por nivel y jornada', icon: BarChart3 },
  { id: 'staff-list', name: 'Listado de personal', description: 'Directivos, docentes y administrativos', icon: Users },
  { id: 'enrollment-summary', name: 'Resumen de matrícula', description: 'Estudiantes por grado y grupo', icon: GraduationCap },
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
  const [hoursSummaryData, setHoursSummaryData] = useState<any[]>([])
  const [enrollmentSummaryData, setEnrollmentSummaryData] = useState<any[]>([])
  const [coverageData, setCoverageData] = useState<any[]>([])
  const [staffListData, setStaffListData] = useState<any[]>([])
  const { sortData, sortState } = useSortable<any>()

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
              name: a.teacher ? [a.teacher.lastName, a.teacher.secondLastName, a.teacher.firstName, a.teacher.secondName].filter(Boolean).join(' ').toUpperCase() : 'Sin nombre',
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
        const [assignmentsRes, enrollmentsRes] = await Promise.all([
          teacherAssignmentsApi.getAll({ academicYearId: filterYear }),
          enrollmentsApi.getAll({ academicYearId: filterYear, status: 'ACTIVE' }),
        ])
        const assignments = assignmentsRes.data || []
        const enrollments: any[] = enrollmentsRes.data || []

        // Conteo real de estudiantes activos por grupo
        const studentsByGroup = new Map<string, number>()
        enrollments.forEach((e: any) => {
          const gid = e.groupId || e.group?.id
          if (!gid) return
          studentsByGroup.set(gid, (studentsByGroup.get(gid) || 0) + 1)
        })

        // Agrupar asignaciones por grupo (incluye director)
        const groupMap = new Map<string, any>()
        assignments.forEach((a: any) => {
          const groupId = a.group?.id
          if (!groupId) return
          if (!groupMap.has(groupId)) {
            const dir = a.group?.director
            const directorName = dir ? [dir.lastName, dir.firstName].filter(Boolean).join(' ') : ''
            groupMap.set(groupId, {
              id: groupId,
              name: `${a.group.grade?.name || ''} ${a.group.name}`.trim(),
              director: directorName,
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
          students: studentsByGroup.get(g.id) || 0,
          subjects: g.subjects.size,
          teachers: g.teachers.size,
          complete: g.subjects.size >= 8
        }))

        setGroupLoadData(groupData)
      }

      // Resumen de horas por nivel/jornada
      if (reportId === 'hours-summary') {
        const res = await teacherAssignmentsApi.getAll({ academicYearId: filterYear })
        const rows: any[] = res.data || []
        const byKey = new Map<string, any>()
        rows.forEach((a: any) => {
          const stage = a.group?.grade?.stage || 'SIN_NIVEL'
          const shift = a.group?.shift?.name || a.group?.shift?.type || 'SIN_JORNADA'
          const key = `${stage}|${shift}`
          if (!byKey.has(key)) byKey.set(key, { stage, shift, hours: 0, teachers: new Set(), groups: new Set(), subjects: new Set() })
          const e = byKey.get(key)
          e.hours += Number(a.weeklyHours) || 2
          if (a.teacherId) e.teachers.add(a.teacherId)
          if (a.group?.id) e.groups.add(a.group.id)
          if (a.subject?.id) e.subjects.add(a.subject.id)
        })
        setHoursSummaryData(Array.from(byKey.values()).map((e, idx) => ({
          nro: idx + 1, stage: e.stage, shift: e.shift, hours: e.hours,
          teachers: e.teachers.size, groups: e.groups.size, subjects: e.subjects.size,
        })))
      }

      // Resumen de matrícula: estudiantes por grado y por grupo
      if (reportId === 'enrollment-summary') {
        const res = await enrollmentsApi.getAll({ academicYearId: filterYear, status: 'ACTIVE' })
        const enrollments: any[] = res.data || []
        const byGroup = new Map<string, any>()
        enrollments.forEach((e: any) => {
          const gid = e.groupId || e.group?.id
          if (!gid) return
          if (!byGroup.has(gid)) {
            byGroup.set(gid, {
              groupId: gid,
              grade: e.group?.grade?.name || '-',
              stage: e.group?.grade?.stage || '-',
              group: `${e.group?.grade?.name || ''} ${e.group?.name || ''}`.trim(),
              capacity: e.group?.maxCapacity || 0,
              enrolled: 0,
            })
          }
          byGroup.get(gid).enrolled += 1
        })
        setEnrollmentSummaryData(Array.from(byGroup.values()).map((g, idx) => ({
          ...g, nro: idx + 1,
          occupancy: g.capacity > 0 ? Math.round((g.enrolled / g.capacity) * 100) : 0,
        })))
      }

      // Listado de personal: docentes (de asignaciones) + directores (de grupos)
      if (reportId === 'staff-list') {
        const [assignmentsRes, groupsRes] = await Promise.all([
          teacherAssignmentsApi.getAll({ academicYearId: filterYear }),
          groupsApi.getAll(),
        ])
        const assignments: any[] = assignmentsRes.data || []
        const groups: any[] = groupsRes.data || []

        type StaffEntry = { id: string; name: string; email: string; roles: Set<string>; subjects: Set<string>; groups: Set<string> }
        const staffMap = new Map<string, StaffEntry>()

        const ensure = (id: string, name: string, email?: string) => {
          if (!staffMap.has(id)) {
            staffMap.set(id, { id, name, email: email || '', roles: new Set(), subjects: new Set(), groups: new Set() })
          }
          return staffMap.get(id)!
        }

        // Docentes
        assignments.forEach((a: any) => {
          if (!a.teacher?.id) return
          const t = a.teacher
          const name = [t.lastName, t.secondLastName, t.firstName, t.secondName].filter(Boolean).join(' ').toUpperCase() || 'Docente'
          const entry = ensure(t.id, name, t.email)
          entry.roles.add('DOCENTE')
          if (a.subject?.name) entry.subjects.add(a.subject.name)
          if (a.group) entry.groups.add(`${a.group.grade?.name || ''} ${a.group.name || ''}`.trim())
        })

        // Directores de grupo
        groups.forEach((g: any) => {
          if (!g.director?.id) return
          const d = g.director
          const name = [d.lastName, d.firstName].filter(Boolean).join(' ').toUpperCase() || 'Director'
          const entry = ensure(d.id, name)
          entry.roles.add('DIRECTOR_GRUPO')
          entry.groups.add(`${g.grade?.name || ''} ${g.name || ''}`.trim())
        })

        setStaffListData(Array.from(staffMap.values()).map((s, idx) => ({
          nro: idx + 1,
          name: s.name,
          email: s.email,
          roles: Array.from(s.roles).join(', '),
          subjects: Array.from(s.subjects).join(', '),
          groups: Array.from(s.groups).join(', '),
          roleCount: s.roles.size,
        })))
      }

      // Cobertura académica: % de asignaturas cubiertas por grupo
      if (reportId === 'coverage') {
        const res = await teacherAssignmentsApi.getAll({ academicYearId: filterYear })
        const assignments: any[] = res.data || []
        const byGroup = new Map<string, any>()
        assignments.forEach((a: any) => {
          const gid = a.group?.id; if (!gid) return
          if (!byGroup.has(gid)) {
            byGroup.set(gid, {
              groupId: gid,
              group: `${a.group.grade?.name || ''} ${a.group.name || ''}`.trim(),
              subjects: new Set<string>(),
              assignedSubjects: new Set<string>(),
            })
          }
          const e = byGroup.get(gid)
          if (a.subject?.id) e.subjects.add(a.subject.id)
          if (a.teacherId && a.subject?.id) e.assignedSubjects.add(a.subject.id)
        })
        setCoverageData(Array.from(byGroup.values()).map((g, idx) => {
          const total = g.subjects.size
          const covered = g.assignedSubjects.size
          const pct = total > 0 ? Math.round((covered / total) * 100) : 0
          return { nro: idx + 1, group: g.group, totalSubjects: total, coveredSubjects: covered, coveragePct: pct }
        }))
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
      toast.warning('No hay datos para exportar')
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Año Escolar</label>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="">Seleccionar...</option>
              {academicYears.map(year => (
                <option key={year.id} value={year.id}>{year.year}{year.status === 'ACTIVE' ? ' - Activo' : ''}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end sm:col-span-2">
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
                <SortableHeader column="name" label="Docente" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="subjects" label="Asignaturas" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="groups" label="Grupos" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="hours" label="Horas" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="status" label="Estado" align="center" sort={sortState} className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {sortData(teacherLoadData).map((row, idx) => (
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
                <SortableHeader column="group" label="Grupo" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="director" label="Director" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="students" label="Estudiantes" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="subjects" label="Asignaturas" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="teachers" label="Docentes" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="complete" label="Estado" align="center" sort={sortState} className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {sortData(groupLoadData).map((row, idx) => (
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

    // Resumen de horas
    if (selectedReport === 'hours-summary' && hoursSummaryData.length > 0) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100"><tr>
              <th className="px-3 py-2 text-left">Nro</th>
              <SortableHeader column="stage" label="Nivel" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="shift" label="Jornada" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="hours" label="Horas semanales" align="center" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="teachers" label="Docentes" align="center" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="groups" label="Grupos" align="center" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="subjects" label="Asignaturas" align="center" sort={sortState} className="px-3 py-2" />
            </tr></thead>
            <tbody>
              {sortData(hoursSummaryData).map((r, i) => (
                <tr key={i} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{r.stage}</td>
                  <td className="px-3 py-2">{r.shift}</td>
                  <td className="px-3 py-2 text-center font-bold">{r.hours}</td>
                  <td className="px-3 py-2 text-center">{r.teachers}</td>
                  <td className="px-3 py-2 text-center">{r.groups}</td>
                  <td className="px-3 py-2 text-center">{r.subjects}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    // Resumen matrícula
    if (selectedReport === 'enrollment-summary' && enrollmentSummaryData.length > 0) {
      const total = enrollmentSummaryData.reduce((s, r) => s + r.enrolled, 0)
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-xs text-blue-500 uppercase">Total matriculados</p><p className="text-2xl font-bold text-blue-700">{total}</p></div>
            <div className="bg-slate-50 rounded-xl p-3 text-center"><p className="text-xs text-slate-500 uppercase">Grupos</p><p className="text-2xl font-bold text-slate-700">{enrollmentSummaryData.length}</p></div>
            <div className="bg-green-50 rounded-xl p-3 text-center"><p className="text-xs text-green-500 uppercase">Promedio por grupo</p><p className="text-2xl font-bold text-green-700">{Math.round(total / Math.max(enrollmentSummaryData.length, 1))}</p></div>
            <div className="bg-amber-50 rounded-xl p-3 text-center"><p className="text-xs text-amber-500 uppercase">Ocupación promedio</p><p className="text-2xl font-bold text-amber-700">{Math.round(enrollmentSummaryData.reduce((s, r) => s + r.occupancy, 0) / Math.max(enrollmentSummaryData.length, 1))}%</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100"><tr>
                <th className="px-3 py-2 text-left">Nro</th>
                <SortableHeader column="stage" label="Nivel" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="grade" label="Grado" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="group" label="Grupo" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="enrolled" label="Matriculados" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="capacity" label="Capacidad" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="occupancy" label="Ocupación %" align="center" sort={sortState} className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {sortData(enrollmentSummaryData).map((r, i) => (
                  <tr key={i} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{r.stage}</td>
                    <td className="px-3 py-2">{r.grade}</td>
                    <td className="px-3 py-2 font-medium">{r.group}</td>
                    <td className="px-3 py-2 text-center font-bold">{r.enrolled}</td>
                    <td className="px-3 py-2 text-center text-slate-500">{r.capacity || '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${r.occupancy >= 90 ? 'bg-red-100 text-red-700' : r.occupancy >= 70 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {r.capacity > 0 ? `${r.occupancy}%` : '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    // Listado de personal
    if (selectedReport === 'staff-list' && staffListData.length > 0) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100"><tr>
              <th className="px-3 py-2 text-left">Nro</th>
              <SortableHeader column="name" label="Nombre" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="email" label="Email" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="roles" label="Rol(es)" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="subjects" label="Asignaturas" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="groups" label="Grupos" sort={sortState} className="px-3 py-2" />
            </tr></thead>
            <tbody>
              {sortData(staffListData).map((r, i) => (
                <tr key={i} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-slate-500 text-xs">{r.email || '—'}</td>
                  <td className="px-3 py-2">
                    {r.roles.split(', ').map((role: string) => (
                      <span key={role} className="inline-block mr-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs">{role}</span>
                    ))}
                  </td>
                  <td className="px-3 py-2 text-slate-600 max-w-xs truncate">{r.subjects || '—'}</td>
                  <td className="px-3 py-2 text-slate-600 max-w-xs truncate">{r.groups || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    // Cobertura académica
    if (selectedReport === 'coverage' && coverageData.length > 0) {
      const avgCoverage = Math.round(coverageData.reduce((s, r) => s + r.coveragePct, 0) / coverageData.length)
      const fullCoverage = coverageData.filter(r => r.coveragePct >= 100).length
      const partialCoverage = coverageData.length - fullCoverage
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className={`rounded-xl p-3 text-center ${avgCoverage >= 90 ? 'bg-green-50' : avgCoverage >= 70 ? 'bg-amber-50' : 'bg-red-50'}`}>
              <p className="text-xs uppercase text-slate-500">Cobertura promedio</p>
              <p className={`text-2xl font-bold ${avgCoverage >= 90 ? 'text-green-700' : avgCoverage >= 70 ? 'text-amber-700' : 'text-red-700'}`}>{avgCoverage}%</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center"><p className="text-xs text-green-500 uppercase">Grupos cubiertos</p><p className="text-2xl font-bold text-green-700">{fullCoverage}</p></div>
            <div className="bg-amber-50 rounded-xl p-3 text-center"><p className="text-xs text-amber-500 uppercase">Grupos incompletos</p><p className="text-2xl font-bold text-amber-700">{partialCoverage}</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100"><tr>
                <th className="px-3 py-2 text-left">Nro</th>
                <SortableHeader column="group" label="Grupo" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="totalSubjects" label="Asignaturas" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="coveredSubjects" label="Cubiertas" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="coveragePct" label="Cobertura %" align="center" sort={sortState} className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {sortData(coverageData).map((r, i) => (
                  <tr key={i} className={`border-b hover:bg-slate-50 ${r.coveragePct < 70 ? 'bg-red-50/40' : r.coveragePct < 100 ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2 font-medium">{r.group}</td>
                    <td className="px-3 py-2 text-center">{r.totalSubjects}</td>
                    <td className="px-3 py-2 text-center">{r.coveredSubjects}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.coveragePct >= 100 ? 'bg-green-100 text-green-700' : r.coveragePct >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{r.coveragePct}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
