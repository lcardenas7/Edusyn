import { useState, useEffect } from 'react'
import { 
  Calendar,
  Users,
  GraduationCap,
  ClipboardList,
  UserCheck,
  AlertTriangle,
  BarChart3,
  Download,
  Printer,
  ArrowLeft,
  ChevronLeft,
  Search
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useReportsData } from '../../hooks/useReportsData'
import { useAuth } from '../../contexts/AuthContext'
import { attendanceApi, groupsApi } from '../../lib/api'

interface ReportItem {
  id: string
  name: string
  description: string
  icon: any
  feature?: string
}

const attendanceReports: ReportItem[] = [
  { id: 'att-group', name: 'Asistencia por grupo', description: 'Estado general de asistencia de un grupo o curso', icon: GraduationCap, feature: 'RPT_ATT_GROUP' },
  { id: 'att-student', name: 'Asistencia por estudiante', description: 'Seguimiento individual de asistencia (casos especiales)', icon: Users, feature: 'RPT_ATT_STUDENT' },
  { id: 'att-subject', name: 'Asistencia por asignatura', description: 'Analizar comportamiento por materia', icon: ClipboardList, feature: 'RPT_ATT_SUBJECT' },
  { id: 'att-teacher', name: 'Asistencia por docente', description: 'Control institucional del registro de clases', icon: UserCheck, feature: 'RPT_ATT_TEACHER' },
  { id: 'att-critical', name: 'Inasistencias críticas', description: 'Detectar estudiantes en riesgo por inasistencia', icon: AlertTriangle, feature: 'RPT_ATT_CRITICAL' },
  { id: 'att-consolidated', name: 'Consolidado institucional', description: 'Datos macro para informes oficiales', icon: BarChart3, feature: 'RPT_ATT_CONSOLIDATED' },
]

export default function AttendanceReports() {
  const { hasFeature } = useAuth()
  const {
    academicYears, terms, groups, subjects, teachers, students,
    filterYear, setFilterYear,
    filterPeriod, setFilterPeriod,
    filterGrade, setFilterGrade,
    filterSubject, setFilterSubject,
    filterTeacher, setFilterTeacher,
    filterStudentId, setFilterStudentId,
    filterDateFrom, setFilterDateFrom,
    filterDateTo, setFilterDateTo,
    filterStatus, setFilterStatus,
  } = useReportsData()

  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)
  const [searchStudent, setSearchStudent] = useState('')
  const [filterMinPercent, setFilterMinPercent] = useState('80')

  // Datos de reportes
  const [attendanceData, setAttendanceData] = useState<any[]>([])
  const [attendanceDetailData, setAttendanceDetailData] = useState<any[]>([])
  const [attendanceBySubjectData, setAttendanceBySubjectData] = useState<any[]>([])
  const [teacherComplianceData, setTeacherComplianceData] = useState<any[]>([])
  const [criticalAbsencesData, setCriticalAbsencesData] = useState<any[]>([])
  const [consolidatedData, setConsolidatedData] = useState<{ byGrade: any[], bySubject: any[], byPeriod: any[] }>({ byGrade: [], bySubject: [], byPeriod: [] })

  // Filtrar reportes según features
  const filteredReports = attendanceReports.filter(r => !r.feature || hasFeature(r.feature))

  const handleSelectReport = async (reportId: string) => {
    setSelectedReport(reportId)
    setShowReport(true)
    await loadReportData(reportId)
  }

  const loadReportData = async (reportId: string) => {
    if (!filterYear) return
    setLoadingReport(true)

    try {
      // Reporte de asistencia por grupo
      if (reportId === 'att-group') {
        const params: any = {
          startDate: filterDateFrom || undefined,
          endDate: filterDateTo || undefined,
          subjectId: filterSubject !== 'all' ? filterSubject : undefined,
        }
        
        let rawData: any[] = []
        
        if (filterGrade && filterGrade !== 'all') {
          const response = await attendanceApi.getReportByGroup(filterGrade, filterYear, params)
          rawData = response.data || []
        } else {
          const groupsRes = await groupsApi.getAll()
          const allGroups = groupsRes.data || []
          
          for (const group of allGroups) {
            try {
              const response = await attendanceApi.getReportByGroup(group.id, filterYear, params)
              rawData.push(...(response.data || []))
            } catch (err) { /* ignore */ }
          }
        }
        
        rawData = rawData.map((item: any) => ({
          name: item.studentName || item.name,
          group: item.groupName || item.group,
          totalClasses: item.totalClasses || 0,
          attended: item.present || item.attended || 0,
          absent: item.absent || 0,
          late: item.late || 0,
          excused: item.excused || 0,
          pct: item.attendanceRate || item.pct || 0,
          status: item.status || 'Normal',
        }))
        
        if (filterStatus !== 'all') {
          rawData = rawData.filter((item: any) => item.status === filterStatus)
        }
        
        setAttendanceData(rawData.map((item, idx) => ({ ...item, nro: idx + 1 })))
      }

      // Reporte de asistencia por estudiante (detallado)
      if (reportId === 'att-student') {
        const params: any = {
          academicYearId: filterYear,
          groupId: filterGrade !== 'all' ? filterGrade : undefined,
          subjectId: filterSubject !== 'all' ? filterSubject : undefined,
          startDate: filterDateFrom || undefined,
          endDate: filterDateTo || undefined,
          status: filterStatus !== 'all' ? filterStatus : undefined,
          studentEnrollmentId: filterStudentId !== 'all' ? filterStudentId : undefined,
        }
        
        const response = await attendanceApi.getDetailedReport(params)
        const mappedData = (response.data || []).map((item: any, idx: number) => ({
          nro: idx + 1,
          date: item.date ? new Date(item.date).toLocaleDateString('es-CO') : '',
          student: item.studentName || item.student || '',
          group: item.groupName || item.group || '',
          subject: item.subjectName || item.subject || '',
          teacher: item.teacherName || item.teacher || '',
          status: item.status || '',
          observations: item.observations || '',
        }))
        setAttendanceDetailData(mappedData)
      }

      // Reporte de asistencia por asignatura
      if (reportId === 'att-subject') {
        const params: any = {
          startDate: filterDateFrom || undefined,
          endDate: filterDateTo || undefined,
          subjectId: filterSubject !== 'all' ? filterSubject : undefined,
        }
        
        let rawData: any[] = []
        
        if (filterGrade && filterGrade !== 'all') {
          const response = await attendanceApi.getReportByGroup(filterGrade, filterYear, params)
          rawData = response.data || []
        } else {
          const groupsRes = await groupsApi.getAll()
          const allGroups = groupsRes.data || []
          
          for (const group of allGroups) {
            try {
              const response = await attendanceApi.getReportByGroup(group.id, filterYear, params)
              rawData.push(...(response.data || []))
            } catch (err) { /* ignore */ }
          }
        }
        
        rawData = rawData.map((item: any) => ({
          name: item.studentName || item.name,
          group: item.groupName || item.group,
          totalClasses: item.totalClasses || 0,
          attended: item.present || item.attended || 0,
          absent: item.absent || 0,
          pct: item.attendanceRate || item.pct || 0,
          status: item.status || 'Normal',
        }))
        
        if (filterStatus !== 'all') {
          rawData = rawData.filter((item: any) => item.status === filterStatus)
        }
        
        setAttendanceBySubjectData(rawData.map((item, idx) => ({ ...item, nro: idx + 1 })))
      }

      // Reporte de gestión docente
      if (reportId === 'att-teacher') {
        const params: any = {
          academicYearId: filterYear,
          teacherId: filterTeacher !== 'all' ? filterTeacher : undefined,
          groupId: filterGrade !== 'all' ? filterGrade : undefined,
          subjectId: filterSubject !== 'all' ? filterSubject : undefined,
          startDate: filterDateFrom || undefined,
          endDate: filterDateTo || undefined,
        }
        
        const response = await attendanceApi.getTeacherComplianceReport(params)
        const mappedData = (response.data || []).map((item: any, idx: number) => ({
          nro: idx + 1,
          teacher: item.teacherName || item.teacher || '',
          classesScheduled: item.classesScheduled || 0,
          classesRegistered: item.classesRegistered || 0,
          classesNotRegistered: item.classesNotRegistered || 0,
          complianceRate: item.complianceRate || 0,
        }))
        setTeacherComplianceData(mappedData)
      }

      // Reporte de inasistencias críticas
      if (reportId === 'att-critical') {
        const params: any = {
          startDate: filterDateFrom || undefined,
          endDate: filterDateTo || undefined,
          subjectId: filterSubject !== 'all' ? filterSubject : undefined,
        }
        
        let rawData: any[] = []
        
        if (filterGrade && filterGrade !== 'all') {
          const response = await attendanceApi.getReportByGroup(filterGrade, filterYear, params)
          rawData = response.data || []
        } else {
          const groupsRes = await groupsApi.getAll()
          const allGroups = groupsRes.data || []
          
          for (const group of allGroups) {
            try {
              const response = await attendanceApi.getReportByGroup(group.id, filterYear, params)
              rawData.push(...(response.data || []))
            } catch (err) { /* ignore */ }
          }
        }
        
        rawData = rawData.map((item: any) => ({
          name: item.studentName || item.name,
          group: item.groupName || item.group,
          totalClasses: item.totalClasses || 0,
          absent: item.absent || 0,
          pct: item.attendanceRate || item.pct || 0,
          status: item.status || 'Normal',
        }))
        
        const minPct = parseInt(filterMinPercent) || 80
        rawData = rawData.filter((item: any) => item.pct < minPct)
        
        if (filterStatus !== 'all') {
          rawData = rawData.filter((item: any) => item.status === filterStatus)
        }
        
        rawData.sort((a, b) => a.pct - b.pct)
        setCriticalAbsencesData(rawData.map((item, idx) => ({ ...item, nro: idx + 1 })))
      }

      // Reporte consolidado institucional
      if (reportId === 'att-consolidated') {
        const params = {
          academicYearId: filterYear,
          startDate: filterDateFrom || undefined,
          endDate: filterDateTo || undefined,
          subjectId: filterSubject !== 'all' ? filterSubject : undefined,
        }
        
        const response = await attendanceApi.getConsolidatedReport(params)
        
        const mappedByGrade = (response.data?.byGrade || []).map((item: any, idx: number) => ({
          nro: idx + 1,
          grade: item.name || item.grade || '',
          totalStudents: item.totalStudents || '-',
          totalClasses: item.total || item.totalClasses || 0,
          totalAttended: item.present || item.totalAttended || 0,
          totalAbsent: item.absent || item.totalAbsent || 0,
          pct: item.attendanceRate || item.pct || 0,
        }))
        
        const mappedBySubject = (response.data?.bySubject || []).map((item: any, idx: number) => ({
          nro: idx + 1,
          subject: item.name || item.subject || '',
          totalRecords: item.total || item.totalRecords || 0,
          totalClasses: item.total || item.totalClasses || 0,
          totalAttended: item.present || item.totalAttended || 0,
          totalAbsent: item.absent || item.totalAbsent || 0,
          pct: item.attendanceRate || item.pct || 0,
        }))
        
        setConsolidatedData({ byGrade: mappedByGrade, bySubject: mappedBySubject, byPeriod: [] })
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
    let filename = 'reporte_asistencia'

    if (selectedReport === 'att-group') {
      filename = 'asistencia_por_grupo'
      csvContent = 'Nro,Estudiante,Grupo,Total Clases,Asistencias,Fallas,Tardanzas,Excusas,% Asist.,Estado\n'
      attendanceData.forEach((row, idx) => {
        csvContent += `${idx + 1},"${row.name || ''}","${row.group || ''}",${row.totalClasses || 0},${row.attended || 0},${row.absent || 0},${row.late || 0},${row.excused || 0},${row.pct || 0}%,${row.status || ''}\n`
      })
    } else if (selectedReport === 'att-student') {
      filename = 'asistencia_por_estudiante'
      csvContent = 'Nro,Fecha,Estudiante,Grupo,Asignatura,Docente,Estado,Observación\n'
      attendanceDetailData.forEach((row, idx) => {
        const statusText = row.status === 'PRESENT' ? 'Presente' : row.status === 'ABSENT' ? 'Ausente' : row.status === 'LATE' ? 'Tarde' : 'Excusa'
        csvContent += `${idx + 1},"${row.date || ''}","${row.student || ''}","${row.group || ''}","${row.subject || ''}","${row.teacher || ''}",${statusText},"${row.observations || ''}"\n`
      })
    } else if (selectedReport === 'att-subject') {
      filename = 'asistencia_por_asignatura'
      csvContent = 'Nro,Estudiante,Grupo,Total Clases,Asistencias,Fallas,% Asist.,Estado\n'
      attendanceBySubjectData.forEach((row, idx) => {
        csvContent += `${idx + 1},"${row.name || ''}","${row.group || ''}",${row.totalClasses || 0},${row.attended || 0},${row.absent || 0},${row.pct || 0}%,${row.status || ''}\n`
      })
    } else if (selectedReport === 'att-teacher') {
      filename = 'asistencia_por_docente'
      csvContent = 'Nro,Docente,Clases Programadas,Clases Registradas,Clases NO Registradas,% Cumplimiento\n'
      teacherComplianceData.forEach((row, idx) => {
        csvContent += `${idx + 1},"${row.teacher || ''}",${row.classesScheduled || 0},${row.classesRegistered || 0},${row.classesNotRegistered || 0},${row.complianceRate || 0}%\n`
      })
    } else if (selectedReport === 'att-critical') {
      filename = 'inasistencias_criticas'
      csvContent = 'Nro,Estudiante,Grupo,Total Clases,Fallas,% Asist.,Estado\n'
      criticalAbsencesData.forEach((row, idx) => {
        csvContent += `${idx + 1},"${row.name || ''}","${row.group || ''}",${row.totalClasses || 0},${row.absent || 0},${row.pct || 0}%,${row.status || ''}\n`
      })
    } else if (selectedReport === 'att-consolidated') {
      filename = 'consolidado_institucional'
      csvContent = 'ASISTENCIA POR GRADO\nNro,Grado,Estudiantes,Total Registros,Presentes,Ausentes,% Asistencia\n'
      consolidatedData.byGrade.forEach((g, idx) => {
        csvContent += `${idx + 1},"${g.grade}",${g.totalStudents},${g.totalClasses},${g.totalAttended},${g.totalAbsent},${g.pct}%\n`
      })
      csvContent += '\nASISTENCIA POR ASIGNATURA\nNro,Asignatura,Total Registros,Presentes,Ausentes,% Asistencia\n'
      consolidatedData.bySubject.forEach((s, idx) => {
        csvContent += `${idx + 1},"${s.subject}",${s.totalClasses},${s.totalAttended},${s.totalAbsent},${s.pct}%\n`
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

  // Renderizar filtros según el reporte seleccionado
  const renderFilters = () => {
    if (selectedReport === 'att-group') {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Año</label>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="">Seleccionar...</option>
                {academicYears.map(year => (
                  <option key={year.id} value={year.id}>{year.year}{year.status === 'ACTIVE' ? ' - Activo' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Grupo</label>
              <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todos los grupos</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>{group.grade?.name} {group.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Asignatura</label>
              <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todas</option>
                {subjects.map(subject => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todos</option>
                <option value="Normal">Normal (≥90%)</option>
                <option value="Alerta">Alerta (80-89%)</option>
                <option value="Riesgo">Riesgo (&lt;80%)</option>
              </select>
            </div>
          </div>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Buscar estudiante</label>
              <input type="text" value={searchStudent} onChange={(e) => setSearchStudent(e.target.value)} placeholder="Nombre..." className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </div>
            <div className="flex items-end">
              <button onClick={() => loadReportData(selectedReport!)} className="px-4 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 w-full">Buscar</button>
            </div>
          </div>
        </div>
      )
    }

    if (selectedReport === 'att-student') {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Año</label>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="">Seleccionar...</option>
                {academicYears.map(year => (
                  <option key={year.id} value={year.id}>{year.year}{year.status === 'ACTIVE' ? ' - Activo' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Grupo</label>
              <select value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setFilterStudentId('all') }} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todos los grupos</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>{group.grade?.name} {group.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Estudiante</label>
              <select value={filterStudentId} onChange={(e) => setFilterStudentId(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todos</option>
                {students.map(student => (
                  <option key={student.id} value={student.enrollmentId || student.id}>{student.lastName} {student.firstName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todos</option>
                <option value="PRESENT">Presente</option>
                <option value="ABSENT">Ausente</option>
                <option value="LATE">Tarde</option>
                <option value="EXCUSED">Excusa</option>
              </select>
            </div>
          </div>
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
              <label className="block text-xs font-medium text-slate-600 mb-1">Asignatura</label>
              <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todas</option>
                {subjects.map(subject => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => loadReportData(selectedReport!)} className="px-4 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 w-full">Buscar</button>
            </div>
          </div>
        </div>
      )
    }

    if (selectedReport === 'att-teacher') {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Año</label>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="">Seleccionar...</option>
                {academicYears.map(year => (
                  <option key={year.id} value={year.id}>{year.year}{year.status === 'ACTIVE' ? ' - Activo' : ''}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Docente</label>
              <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todos</option>
                {teachers.map(teacher => (
                  <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Desde</label>
              <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Hasta</label>
              <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={() => loadReportData(selectedReport!)} className="px-4 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700">Buscar</button>
          </div>
        </div>
      )
    }

    if (selectedReport === 'att-critical') {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Año</label>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="">Seleccionar...</option>
                {academicYears.map(year => (
                  <option key={year.id} value={year.id}>{year.year}{year.status === 'ACTIVE' ? ' - Activo' : ''}</option>
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
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">% Mínimo</label>
              <input type="number" value={filterMinPercent} onChange={(e) => setFilterMinPercent(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
                <option value="all">Todos</option>
                <option value="Alerta">Alerta</option>
                <option value="Riesgo">Riesgo</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => loadReportData(selectedReport!)} className="px-4 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 w-full">Buscar</button>
            </div>
          </div>
        </div>
      )
    }

    // Filtros genéricos para otros reportes
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Año</label>
            <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="">Seleccionar...</option>
              {academicYears.map(year => (
                <option key={year.id} value={year.id}>{year.year}{year.status === 'ACTIVE' ? ' - Activo' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Desde</label>
            <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Hasta</label>
            <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
          </div>
          <div className="flex items-end">
            <button onClick={() => loadReportData(selectedReport!)} className="px-4 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700 w-full">Buscar</button>
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
        </div>
      )
    }

    if (selectedReport === 'att-group' && attendanceData.length > 0) {
      const filteredData = searchStudent 
        ? attendanceData.filter(d => d.name?.toLowerCase().includes(searchStudent.toLowerCase()))
        : attendanceData
      
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">Nro</th>
                <th className="px-3 py-2 text-left">Estudiante</th>
                <th className="px-3 py-2 text-left">Grupo</th>
                <th className="px-3 py-2 text-center">Total</th>
                <th className="px-3 py-2 text-center">Asist.</th>
                <th className="px-3 py-2 text-center">Fallas</th>
                <th className="px-3 py-2 text-center">Tardanzas</th>
                <th className="px-3 py-2 text-center">Excusas</th>
                <th className="px-3 py-2 text-center">%</th>
                <th className="px-3 py-2 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, idx) => (
                <tr key={idx} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2">{row.nro}</td>
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2">{row.group}</td>
                  <td className="px-3 py-2 text-center">{row.totalClasses}</td>
                  <td className="px-3 py-2 text-center text-green-600">{row.attended}</td>
                  <td className="px-3 py-2 text-center text-red-600">{row.absent}</td>
                  <td className="px-3 py-2 text-center text-amber-600">{row.late}</td>
                  <td className="px-3 py-2 text-center text-blue-600">{row.excused}</td>
                  <td className="px-3 py-2 text-center font-medium">{row.pct}%</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${
                      row.status === 'Normal' ? 'bg-green-100 text-green-700' :
                      row.status === 'Alerta' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (selectedReport === 'att-student' && attendanceDetailData.length > 0) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">Nro</th>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Estudiante</th>
                <th className="px-3 py-2 text-left">Grupo</th>
                <th className="px-3 py-2 text-left">Asignatura</th>
                <th className="px-3 py-2 text-left">Docente</th>
                <th className="px-3 py-2 text-center">Estado</th>
                <th className="px-3 py-2 text-left">Observación</th>
              </tr>
            </thead>
            <tbody>
              {attendanceDetailData.map((row, idx) => (
                <tr key={idx} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2">{row.nro}</td>
                  <td className="px-3 py-2">{row.date}</td>
                  <td className="px-3 py-2 font-medium">{row.student}</td>
                  <td className="px-3 py-2">{row.group}</td>
                  <td className="px-3 py-2">{row.subject}</td>
                  <td className="px-3 py-2">{row.teacher}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${
                      row.status === 'PRESENT' ? 'bg-green-100 text-green-700' :
                      row.status === 'ABSENT' ? 'bg-red-100 text-red-700' :
                      row.status === 'LATE' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {row.status === 'PRESENT' ? 'Presente' : row.status === 'ABSENT' ? 'Ausente' : row.status === 'LATE' ? 'Tarde' : 'Excusa'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{row.observations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (selectedReport === 'att-teacher' && teacherComplianceData.length > 0) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">Nro</th>
                <th className="px-3 py-2 text-left">Docente</th>
                <th className="px-3 py-2 text-center">Clases Programadas</th>
                <th className="px-3 py-2 text-center">Clases Registradas</th>
                <th className="px-3 py-2 text-center">Sin Registrar</th>
                <th className="px-3 py-2 text-center">% Cumplimiento</th>
              </tr>
            </thead>
            <tbody>
              {teacherComplianceData.map((row, idx) => (
                <tr key={idx} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2">{row.nro}</td>
                  <td className="px-3 py-2 font-medium">{row.teacher}</td>
                  <td className="px-3 py-2 text-center">{row.classesScheduled}</td>
                  <td className="px-3 py-2 text-center text-green-600">{row.classesRegistered}</td>
                  <td className="px-3 py-2 text-center text-red-600">{row.classesNotRegistered}</td>
                  <td className="px-3 py-2 text-center font-medium">{row.complianceRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (selectedReport === 'att-critical' && criticalAbsencesData.length > 0) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">Nro</th>
                <th className="px-3 py-2 text-left">Estudiante</th>
                <th className="px-3 py-2 text-left">Grupo</th>
                <th className="px-3 py-2 text-center">Total Clases</th>
                <th className="px-3 py-2 text-center">Fallas</th>
                <th className="px-3 py-2 text-center">% Asist.</th>
                <th className="px-3 py-2 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {criticalAbsencesData.map((row, idx) => (
                <tr key={idx} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2">{row.nro}</td>
                  <td className="px-3 py-2 font-medium">{row.name}</td>
                  <td className="px-3 py-2">{row.group}</td>
                  <td className="px-3 py-2 text-center">{row.totalClasses}</td>
                  <td className="px-3 py-2 text-center text-red-600">{row.absent}</td>
                  <td className="px-3 py-2 text-center font-medium">{row.pct}%</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-1 rounded text-xs ${
                      row.status === 'Alerta' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (selectedReport === 'att-consolidated') {
      return (
        <div className="space-y-6">
          {consolidatedData.byGrade.length > 0 && (
            <div>
              <h4 className="font-medium text-slate-800 mb-2">Asistencia por Grado</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Nro</th>
                      <th className="px-3 py-2 text-left">Grado</th>
                      <th className="px-3 py-2 text-center">Estudiantes</th>
                      <th className="px-3 py-2 text-center">Total Registros</th>
                      <th className="px-3 py-2 text-center">Presentes</th>
                      <th className="px-3 py-2 text-center">Ausentes</th>
                      <th className="px-3 py-2 text-center">% Asist.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidatedData.byGrade.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-slate-50">
                        <td className="px-3 py-2">{row.nro}</td>
                        <td className="px-3 py-2 font-medium">{row.grade}</td>
                        <td className="px-3 py-2 text-center">{row.totalStudents}</td>
                        <td className="px-3 py-2 text-center">{row.totalClasses}</td>
                        <td className="px-3 py-2 text-center text-green-600">{row.totalAttended}</td>
                        <td className="px-3 py-2 text-center text-red-600">{row.totalAbsent}</td>
                        <td className="px-3 py-2 text-center font-medium">{row.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {consolidatedData.bySubject.length > 0 && (
            <div>
              <h4 className="font-medium text-slate-800 mb-2">Asistencia por Asignatura</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Nro</th>
                      <th className="px-3 py-2 text-left">Asignatura</th>
                      <th className="px-3 py-2 text-center">Total Registros</th>
                      <th className="px-3 py-2 text-center">Presentes</th>
                      <th className="px-3 py-2 text-center">Ausentes</th>
                      <th className="px-3 py-2 text-center">% Asist.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidatedData.bySubject.map((row, idx) => (
                      <tr key={idx} className="border-b hover:bg-slate-50">
                        <td className="px-3 py-2">{row.nro}</td>
                        <td className="px-3 py-2 font-medium">{row.subject}</td>
                        <td className="px-3 py-2 text-center">{row.totalClasses}</td>
                        <td className="px-3 py-2 text-center text-green-600">{row.totalAttended}</td>
                        <td className="px-3 py-2 text-center text-red-600">{row.totalAbsent}</td>
                        <td className="px-3 py-2 text-center font-medium">{row.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="text-center py-12 text-slate-500">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
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
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Reportes de Asistencia</h1>
              <p className="text-sm text-slate-500">Control y seguimiento de asistencia</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <button
              key={report.id}
              onClick={() => handleSelectReport(report.id)}
              className="p-4 bg-white rounded-xl border border-slate-200 hover:border-amber-300 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <report.icon className="w-5 h-5 text-amber-600" />
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
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              {currentReportData && <currentReportData.icon className="w-5 h-5 text-amber-600" />}
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
