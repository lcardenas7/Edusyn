import { useState, useMemo, useEffect } from 'react'
import {
  Calendar, Users, GraduationCap, ClipboardList, UserCheck,
  AlertTriangle, BarChart3, ArrowLeft, Search, BookOpen,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useReportsData } from '../../hooks/useReportsData'
import { useAuth } from '../../contexts/AuthContext'
import { attendanceApi, groupsApi, teacherAssignmentsApi, tutoringAttendanceApi } from '../../lib/api'
import AttendanceReportLayout, {
  KPICard, kpiColorFromPct, sortByRisk, getRowBg, getStatusBadge,
  getPctColor, EmptyState, THRESHOLDS, setAttendanceThresholds,
} from '../../components/reports/AttendanceReportLayout'

// ─── Types & constants ─────────────────────────────────────────────────
interface ReportItem { id: string; name: string; description: string; icon: any; feature?: string }

const attendanceReports: ReportItem[] = [
  { id: 'att-group', name: 'Asistencia por grupo', description: 'Estado general de asistencia de un grupo o curso', icon: GraduationCap },
  { id: 'att-student', name: 'Asistencia por estudiante', description: 'Seguimiento individual de asistencia (casos especiales)', icon: Users },
  { id: 'att-subject', name: 'Asistencia por asignatura', description: 'Analizar comportamiento por materia', icon: ClipboardList },
  { id: 'att-teacher', name: 'Asistencia por docente', description: 'Control institucional del registro de clases', icon: UserCheck },
  { id: 'att-critical', name: 'Inasistencias criticas', description: 'Detectar estudiantes en riesgo por inasistencia', icon: AlertTriangle },
  { id: 'att-consolidated', name: 'Consolidado institucional', description: 'Datos macro para informes oficiales', icon: BarChart3 },
  { id: 'att-tutoring', name: 'Asistencia de tutoría', description: 'Reporte de asistencia diaria por dirección de grupo (tutoría)', icon: Calendar },
]

// ─── Shared filter components ──────────────────────────────────────────
function FSelect({ label, value, onChange, options, required }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}{required && ' *'}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className={`w-full px-2.5 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-300 focus:border-amber-400 ${required && value === 'all' ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-white'}`}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
function FDate({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-300" />
    </div>
  )
}
function SearchBtn({ onClick, loading }: { onClick: () => void; loading?: boolean }) {
  return (
    <div className="flex items-end">
      <button onClick={onClick} disabled={loading}
        className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 shadow-sm">
        {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-4 h-4" />}
        Generar reporte
      </button>
    </div>
  )
}

// ─── CSV helpers ────────────────────────────────────────────────────────
function buildCSV(inst: string, title: string, headers: string, rows: string): string {
  const now = new Date().toLocaleString('es-CO')
  return `"Institucion","${inst}"\n"Reporte","${title}"\n"Generado","${now}"\n"Criterios","Normal >= ${THRESHOLDS.NORMAL_MIN}% | Alerta ${THRESHOLDS.ALERT_MIN}-${THRESHOLDS.NORMAL_MIN - 1}% | Riesgo < ${THRESHOLDS.ALERT_MIN}%"\n"Calculo","El porcentaje incluye asistencias, tardanzas y excusas justificadas."\n\n${headers}\n${rows}`
}
function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `asistencia_${filename}_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
}

// ═══════════════════════════════════════════════════════════════════════
export default function AttendanceReports() {
  const navigate = useNavigate()
  const { hasFeature, institution, user } = useAuth()
  const instName = institution?.name || 'Institucion'
  const userRoles = useMemo(() => {
    if (!user?.roles) return []
    return user.roles.map((r: any) => typeof r === 'string' ? r : r.role?.name || r.name).filter(Boolean)
  }, [user?.roles])
  const normalizedRoles = useMemo(() => userRoles.map((role) => String(role).toUpperCase()), [userRoles])
  const isTeacher = normalizedRoles.includes('DOCENTE')
  const canViewAllAttendanceReports = normalizedRoles.some((role) => ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR', 'RECTOR'].includes(role))
  const isTeacherOnly = isTeacher && !canViewAllAttendanceReports
  const {
    academicYears, terms, groups, subjects, teachers, students,
    rulesContext,
    filterYear, setFilterYear, filterPeriod, setFilterPeriod,
    filterGrade, setFilterGrade, filterSubject, setFilterSubject,
    filterTeacher, setFilterTeacher, filterStudentId, setFilterStudentId,
    filterDateFrom, setFilterDateFrom, filterDateTo, setFilterDateTo,
    filterStatus, setFilterStatus,
  } = useReportsData()

  // Actualizar umbrales de asistencia desde configuración institucional
  useEffect(() => {
    if (rulesContext.minAttendancePercentage) {
      setAttendanceThresholds(rulesContext.minAttendancePercentage)
    }
  }, [rulesContext.minAttendancePercentage])

  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)
  const [reportError, setReportError] = useState<string | null>(null)
  const [searchStudent, setSearchStudent] = useState('')
  const [filterMinPercent, setFilterMinPercent] = useState('80')
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([])
  const [loadingAssignments, setLoadingAssignments] = useState(false)

  const [attendanceData, setAttendanceData] = useState<any[]>([])
  const [attendanceDetailData, setAttendanceDetailData] = useState<any[]>([])
  const [attendanceBySubjectData, setAttendanceBySubjectData] = useState<any[]>([])
  const [teacherComplianceData, setTeacherComplianceData] = useState<any[]>([])
  const [criticalAbsencesData, setCriticalAbsencesData] = useState<any[]>([])
  const [consolidatedData, setConsolidatedData] = useState<{ byGrade: any[]; bySubject: any[]; byPeriod: any[] }>({ byGrade: [], bySubject: [], byPeriod: [] })
  const [tutoringData, setTutoringData] = useState<any[]>([])

  const filteredReports = attendanceReports.filter(r => !r.feature || hasFeature(r.feature))
  // Docentes pueden ver: asistencia por grupo, por asignatura, por docente (su cumplimiento), e inasistencias críticas
  // Pero NO: consolidado institucional, asistencia por estudiante individual, tutoría (esos son admin/coordinador)
  const teacherAllowedReports = ['att-group', 'att-subject', 'att-teacher', 'att-critical']
  const visibleReports = isTeacherOnly
    ? filteredReports.filter(r => teacherAllowedReports.includes(r.id))
    : filteredReports

  useEffect(() => {
    if (!isTeacherOnly || !filterYear || !user?.id) {
      setTeacherAssignments([])
      return
    }

    let cancelled = false
    setLoadingAssignments(true)

    const loadTeacherAssignments = async () => {
      try {
        const res = await teacherAssignmentsApi.getAll({ academicYearId: filterYear, teacherId: user.id, activeOnly: false })
        if (!cancelled) {
          setTeacherAssignments(res.data || [])
          console.log('Teacher assignments loaded:', res.data?.length || 0, 'assignments')
        }
      } catch (err) {
        console.error('Error loading teacher assignments for reports:', err)
        if (!cancelled) setTeacherAssignments([])
      } finally {
        if (!cancelled) setLoadingAssignments(false)
      }
    }

    loadTeacherAssignments()

    return () => {
      cancelled = true
    }
  }, [isTeacherOnly, filterYear, user?.id])

  useEffect(() => {
    if (!isTeacherOnly) return

    const validGroupIds = new Set(teacherAssignments.map((a: any) => a.groupId).filter(Boolean))
    const validSubjectIds = new Set(teacherAssignments.map((a: any) => a.subjectId).filter(Boolean))

    if (filterGrade !== 'all' && !validGroupIds.has(filterGrade)) {
      setFilterGrade('all')
    }
    if (filterSubject !== 'all' && !validSubjectIds.has(filterSubject)) {
      setFilterSubject('all')
    }
  }, [isTeacherOnly, teacherAssignments, filterGrade, filterSubject, setFilterGrade, setFilterSubject])

  // ─── Select options ──────────────────────────────────────────────────
  const yearOpts = useMemo(() => [{ value: '', label: 'Seleccionar...' }, ...academicYears.map(y => ({ value: y.id, label: `${y.year}${y.status === 'ACTIVE' ? ' - Activo' : ''}` }))], [academicYears])
  const baseGroupOpts = useMemo(() => [{ value: 'all', label: 'Todos los grupos' }, ...groups.map(g => ({ value: g.id, label: `${g.grade?.name || ''} ${g.name}` }))], [groups])
  const baseSubjOpts = useMemo(() => [{ value: 'all', label: 'Todas' }, ...subjects.map(s => ({ value: s.id, label: s.name }))], [subjects])
  const teachOpts = useMemo(() => [{ value: 'all', label: 'Todos' }, ...teachers.map(t => ({ value: t.id, label: t.name }))], [teachers])
  const teacherGroupOpts = useMemo(() => {
    const options = new Map<string, { value: string; label: string }>()
    teacherAssignments.forEach((assignment: any) => {
      const group = assignment.group
      if (!group?.id || options.has(group.id)) return
      options.set(group.id, { value: group.id, label: `${group.grade?.name || ''} ${group.name || ''}`.trim() })
    })
    return [{ value: 'all', label: 'Todos mis grupos' }, ...Array.from(options.values())]
  }, [teacherAssignments])
  const teacherSubjectOpts = useMemo(() => {
    const options = new Map<string, { value: string; label: string }>()
    teacherAssignments.forEach((assignment: any) => {
      const subject = assignment.subject
      if (!subject?.id || options.has(subject.id)) return
      options.set(subject.id, { value: subject.id, label: subject.name || '' })
    })
    return [{ value: 'all', label: 'Todas mis asignaturas' }, ...Array.from(options.values())]
  }, [teacherAssignments])
  const groupOpts = isTeacherOnly ? teacherGroupOpts : baseGroupOpts
  const subjOpts = isTeacherOnly ? teacherSubjectOpts : baseSubjOpts
  const statOpts = [{ value: 'all', label: 'Todos' }, { value: 'Normal', label: `Normal (>= ${THRESHOLDS.NORMAL_MIN}%)` }, { value: 'Alerta', label: `Alerta (${THRESHOLDS.ALERT_MIN}-${THRESHOLDS.NORMAL_MIN - 1}%)` }, { value: 'Riesgo', label: `Riesgo (< ${THRESHOLDS.ALERT_MIN}%)` }]
  const attStatOpts = [{ value: 'all', label: 'Todos' }, { value: 'PRESENT', label: 'Presente' }, { value: 'ABSENT', label: 'Ausente' }, { value: 'LATE', label: 'Tarde' }, { value: 'EXCUSED', label: 'Excusa' }]

  // ─── Data fetch helpers ──────────────────────────────────────────────
  async function fetchGroupData(params: any): Promise<any[]> {
    let raw: any[] = []
    if (filterGrade && filterGrade !== 'all') {
      // Grupo específico seleccionado
      const res = await attendanceApi.getReportByGroup(filterGrade, filterYear, params)
      raw = res.data || []
    } else if (isTeacherOnly) {
      // Docente sin grupo seleccionado: solo sus grupos asignados
      if (teacherAssignments.length === 0) {
        console.log('No teacher assignments loaded yet, waiting...')
        return raw // Retornar vacío si aún no hay asignaciones
      }
      const teacherGroupIds = [...new Set(teacherAssignments.map((a: any) => a.groupId).filter(Boolean))]
      console.log('Fetching attendance for teacher groups:', teacherGroupIds)
      const results = await Promise.allSettled(teacherGroupIds.map((gId: string) => attendanceApi.getReportByGroup(gId, filterYear, params)))
      results.forEach(r => {
        if (r.status === 'fulfilled') {
          raw.push(...(r.value.data || []))
        } else {
          console.error('Error fetching group data:', r.reason)
        }
      })
      console.log('Total records fetched:', raw.length)
    } else if (!isTeacherOnly) {
      // Admin/coordinador: todos los grupos
      const gRes = await groupsApi.getAll()
      const results = await Promise.allSettled((gRes.data || []).map((g: any) => attendanceApi.getReportByGroup(g.id, filterYear, params)))
      results.forEach(r => { if (r.status === 'fulfilled') raw.push(...(r.value.data || [])) })
    }
    return raw
  }
  function mapRow(item: any) {
    return { name: item.studentName || item.name, group: item.groupName || item.group, totalClasses: item.totalClasses || 0, attended: item.present || item.attended || 0, absent: item.absent || 0, late: item.late || 0, excused: item.excused || 0, pct: item.attendanceRate || item.pct || 0, status: item.status || 'Normal' }
  }

  // ─── Load report data ────────────────────────────────────────────────
  const handleSelectReport = async (id: string) => {
    if (!visibleReports.some(r => r.id === id)) return
    setSelectedReport(id)
    setShowReport(true)
    await loadReportData(id)
  }
  const loadReportData = async (reportId: string) => {
    if (!filterYear) return
    // Para docentes, verificar que las asignaciones estén cargadas antes de generar reportes que las necesitan
    if (isTeacherOnly && loadingAssignments && ['att-group', 'att-subject', 'att-critical'].includes(reportId)) {
      setReportError('Cargando tu carga académica, por favor espera...')
      return
    }
    if (isTeacherOnly && teacherAssignments.length === 0 && ['att-group', 'att-subject', 'att-critical'].includes(reportId)) {
      setReportError('No se encontraron asignaciones para tu usuario. Verifica que tengas carga académica asignada.')
      return
    }
    setLoadingReport(true)
    setReportError(null)
    try {
      const bp: any = { startDate: filterDateFrom || undefined, endDate: filterDateTo || undefined, subjectId: filterSubject !== 'all' ? filterSubject : undefined }

      if (reportId === 'att-group') {
        let d = (await fetchGroupData(bp)).map(mapRow)
        if (filterStatus !== 'all') d = d.filter(i => i.status === filterStatus)
        setAttendanceData(sortByRisk(d).map((item, idx) => ({ ...item, nro: idx + 1 })))
      }
      if (reportId === 'att-student') {
        const p = { academicYearId: filterYear, groupId: filterGrade !== 'all' ? filterGrade : undefined, subjectId: bp.subjectId, startDate: bp.startDate, endDate: bp.endDate, status: filterStatus !== 'all' ? filterStatus : undefined, studentEnrollmentId: filterStudentId !== 'all' ? filterStudentId : undefined }
        const res = await attendanceApi.getDetailedReport(p)
        setAttendanceDetailData((res.data || []).map((item: any, idx: number) => ({ nro: idx + 1, date: item.date ? new Date(item.date).toLocaleDateString('es-CO') : '', student: item.studentName || item.student || '', group: item.groupName || item.group || '', subject: item.subjectName || item.subject || '', teacher: item.teacherName || item.teacher || '', status: item.status || '', observations: item.observations || '' })))
      }
      if (reportId === 'att-subject') {
        let d = (await fetchGroupData(bp)).map(mapRow)
        if (filterStatus !== 'all') d = d.filter(i => i.status === filterStatus)
        setAttendanceBySubjectData(sortByRisk(d).map((item, idx) => ({ ...item, nro: idx + 1 })))
      }
      if (reportId === 'att-teacher') {
        const p = {
          academicYearId: filterYear,
          teacherId: isTeacherOnly ? user?.id : (filterTeacher !== 'all' ? filterTeacher : undefined),
          groupId: filterGrade !== 'all' ? filterGrade : undefined,
          subjectId: bp.subjectId,
          startDate: bp.startDate,
          endDate: bp.endDate,
        }
        const res = await attendanceApi.getTeacherComplianceReport(p)
        const mapped = (res.data || []).map((item: any, idx: number) => ({ nro: idx + 1, teacher: item.teacherName || item.teacher || '', classesScheduled: item.classesScheduled || 0, classesRegistered: item.classesRegistered || 0, classesNotRegistered: item.classesNotRegistered || 0, complianceRate: item.complianceRate || 0 }))
        mapped.sort((a: any, b: any) => a.complianceRate - b.complianceRate)
        setTeacherComplianceData(mapped)
      }
      if (reportId === 'att-critical') {
        let d = (await fetchGroupData(bp)).map(mapRow)
        const minPct = parseInt(filterMinPercent) || 80
        d = d.filter(i => i.pct < minPct)
        if (filterStatus !== 'all') d = d.filter(i => i.status === filterStatus)
        setCriticalAbsencesData(sortByRisk(d).map((item, idx) => ({ ...item, nro: idx + 1 })))
      }
      if (reportId === 'att-consolidated') {
        const p = { academicYearId: filterYear, startDate: bp.startDate, endDate: bp.endDate, subjectId: bp.subjectId }
        const res = await attendanceApi.getConsolidatedReport(p)
        const mr = (item: any, idx: number) => ({ nro: idx + 1, grade: item.name || item.grade || '', subject: item.name || item.subject || '', totalClasses: item.total || item.totalClasses || 0, totalAttended: item.present || item.totalAttended || 0, totalAbsent: item.absent || item.totalAbsent || 0, totalLate: item.late || 0, totalExcused: item.excused || 0, pct: item.attendanceRate || item.pct || 0 })
        setConsolidatedData({ byGrade: (res.data?.byGrade || []).map(mr), bySubject: (res.data?.bySubject || []).map(mr), byPeriod: [] })
      }
      if (reportId === 'att-tutoring') {
        if (filterGrade && filterGrade !== 'all') {
          const res = await tutoringAttendanceApi.getReportByGroup(filterGrade, filterYear, { startDate: bp.startDate, endDate: bp.endDate })
          const mapped = (res.data || []).map((item: any, idx: number) => ({ nro: idx + 1, name: item.studentName, group: item.groupName, totalClasses: item.totalDays || 0, attended: item.present || 0, absent: item.absent || 0, late: item.late || 0, excused: item.excused || 0, pct: item.attendanceRate || 0, status: item.status || 'Normal' }))
          setTutoringData(sortByRisk(mapped))
        } else {
          const gRes = await groupsApi.getAll()
          const allData: any[] = []
          const results = await Promise.allSettled((gRes.data || []).map((g: any) => tutoringAttendanceApi.getReportByGroup(g.id, filterYear, { startDate: bp.startDate, endDate: bp.endDate })))
          results.forEach(r => { if (r.status === 'fulfilled') allData.push(...(r.value.data || [])) })
          const mapped = allData.map((item: any, idx: number) => ({ nro: idx + 1, name: item.studentName, group: item.groupName, totalClasses: item.totalDays || 0, attended: item.present || 0, absent: item.absent || 0, late: item.late || 0, excused: item.excused || 0, pct: item.attendanceRate || 0, status: item.status || 'Normal' }))
          setTutoringData(sortByRisk(mapped))
        }
      }
    } catch (err) {
      console.error('Error loading report data:', err)
      setReportError('No se pudo generar el reporte. Revisa los filtros o tus permisos.')
    }
    finally { setLoadingReport(false) }
  }

  // ─── CSV export ──────────────────────────────────────────────────────
  const exportToCSV = () => {
    let csv = '', fn = 'general'
    if (selectedReport === 'att-group') { fn = 'por_grupo'; csv = buildCSV(instName, 'Asistencia por Grupo', 'Nro,Estudiante,Grupo,Total,Asist.,Fallas,Tardanzas,Excusas,%,Estado', attendanceData.map((r, i) => `${i+1},"${r.name}","${r.group}",${r.totalClasses},${r.attended},${r.absent},${r.late},${r.excused},${r.pct}%,${r.status}`).join('\n')) }
    else if (selectedReport === 'att-student') { fn = 'por_estudiante'; const sl = (s: string) => s === 'PRESENT' ? 'Presente' : s === 'ABSENT' ? 'Ausente' : s === 'LATE' ? 'Tarde' : 'Excusa'; csv = buildCSV(instName, 'Asistencia por Estudiante', 'Nro,Fecha,Estudiante,Grupo,Asignatura,Docente,Estado,Obs', attendanceDetailData.map((r, i) => `${i+1},"${r.date}","${r.student}","${r.group}","${r.subject}","${r.teacher}",${sl(r.status)},"${r.observations}"`).join('\n')) }
    else if (selectedReport === 'att-subject') { fn = 'por_asignatura'; csv = buildCSV(instName, 'Asistencia por Asignatura', 'Nro,Estudiante,Grupo,Total,Asist.,Fallas,Tardanzas,Excusas,%,Estado', attendanceBySubjectData.map((r, i) => `${i+1},"${r.name}","${r.group}",${r.totalClasses},${r.attended},${r.absent},${r.late||0},${r.excused||0},${r.pct}%,${r.status}`).join('\n')) }
    else if (selectedReport === 'att-teacher') { fn = 'por_docente'; csv = buildCSV(instName, 'Asistencia por Docente', 'Nro,Docente,Programadas,Registradas,Faltantes,% Cumplimiento', teacherComplianceData.map((r, i) => `${i+1},"${r.teacher}",${r.classesScheduled},${r.classesRegistered},${r.classesNotRegistered},${r.complianceRate}%`).join('\n')) }
    else if (selectedReport === 'att-critical') { fn = 'criticas'; csv = buildCSV(instName, 'Inasistencias Criticas', 'Nro,Estudiante,Grupo,Total,Fallas,%,Estado', criticalAbsencesData.map((r, i) => `${i+1},"${r.name}","${r.group}",${r.totalClasses},${r.absent},${r.pct}%,${r.status}`).join('\n')) }
    else if (selectedReport === 'att-consolidated') { fn = 'consolidado'; let body = 'POR GRADO\nNro,Grado,Total,Presentes,Ausentes,Tardanzas,Excusas,%\n' + consolidatedData.byGrade.map((g, i) => `${i+1},"${g.grade}",${g.totalClasses},${g.totalAttended},${g.totalAbsent},${g.totalLate},${g.totalExcused},${g.pct}%`).join('\n') + '\n\nPOR ASIGNATURA\nNro,Asignatura,Total,Presentes,Ausentes,Tardanzas,Excusas,%\n' + consolidatedData.bySubject.map((s, i) => `${i+1},"${s.subject}",${s.totalClasses},${s.totalAttended},${s.totalAbsent},${s.totalLate},${s.totalExcused},${s.pct}%`).join('\n'); csv = buildCSV(instName, 'Consolidado Institucional', '', body) }
    else if (selectedReport === 'att-tutoring') { fn = 'tutoria'; csv = buildCSV(instName, 'Asistencia de Tutoria', 'Nro,Estudiante,Grupo,Total,Asist.,Fallas,Tardanzas,Excusas,%,Estado', tutoringData.map((r, i) => `${i+1},"${r.name}","${r.group}",${r.totalClasses},${r.attended},${r.absent},${r.late},${r.excused},${r.pct}%,${r.status}`).join('\n')) }
    if (!csv) { alert('No hay datos para exportar'); return }
    downloadCSV(csv, fn)
  }

  const handleBack = () => {
    // Volver a la lista de reportes de asistencia (que para docentes solo muestra los permitidos)
    setShowReport(false)
    setSelectedReport(null)
  }
  const currentReport = visibleReports.find(r => r.id === selectedReport)

  // ═══════════════════════════════════════════════════════════════════════
  // KPI CARDS
  // ═══════════════════════════════════════════════════════════════════════
  const groupKPIs = useMemo(() => {
    if (!attendanceData.length) return null
    const avg = Math.round(attendanceData.reduce((s, r) => s + r.pct, 0) / attendanceData.length)
    const alertC = attendanceData.filter(r => r.status === 'Alerta').length
    const riskC = attendanceData.filter(r => r.status === 'Riesgo').length
    const total = attendanceData[0]?.totalClasses || 0
    return (<>
      <KPICard label="Promedio del grupo" value={`${avg}%`} color={kpiColorFromPct(avg)} sub={`${attendanceData.length} estudiantes`} />
      <KPICard label="En alerta" value={`${Math.round((alertC / attendanceData.length) * 100)}%`} color={alertC > 0 ? 'amber' : 'green'} sub={`${alertC} estudiantes`} />
      <KPICard label="En riesgo" value={`${Math.round((riskC / attendanceData.length) * 100)}%`} color={riskC > 0 ? 'red' : 'green'} sub={`${riskC} estudiantes`} />
      <KPICard label="Total sesiones" value={total} color="blue" sub="clases registradas" />
    </>)
  }, [attendanceData])

  const studentKPIs = useMemo(() => {
    if (!attendanceDetailData.length) return null
    const t = attendanceDetailData.length, ab = attendanceDetailData.filter(r => r.status === 'ABSENT').length
    const lt = attendanceDetailData.filter(r => r.status === 'LATE').length
    const pr = attendanceDetailData.filter(r => r.status === 'PRESENT').length
    const ex = attendanceDetailData.filter(r => r.status === 'EXCUSED').length
    const pct = t > 0 ? Math.round(((pr + lt + ex) / t) * 100) : 0
    return (<>
      <KPICard label="% Asistencia" value={`${pct}%`} color={kpiColorFromPct(pct)} sub={`${t} registros`} />
      <KPICard label="Total fallas" value={ab} color={ab > 5 ? 'red' : 'slate'} sub="ausencias" />
      <KPICard label="Total tardanzas" value={lt} color={lt > 5 ? 'amber' : 'slate'} sub="llegadas tarde" />
      <KPICard label="Total registros" value={t} color="blue" sub="periodo consultado" />
    </>)
  }, [attendanceDetailData])

  const subjectKPIs = useMemo(() => {
    if (!attendanceBySubjectData.length) return null
    const avg = Math.round(attendanceBySubjectData.reduce((s, r) => s + r.pct, 0) / attendanceBySubjectData.length)
    const alertC = attendanceBySubjectData.filter(r => r.status === 'Alerta').length
    const critC = attendanceBySubjectData.filter(r => r.status === 'Riesgo').length
    return (<>
      <KPICard label="Promedio materia" value={`${avg}%`} color={kpiColorFromPct(avg)} sub={`${attendanceBySubjectData.length} estudiantes`} />
      <KPICard label="En alerta" value={alertC} color={alertC > 0 ? 'amber' : 'green'} sub="estudiantes" />
      <KPICard label="Estudiantes criticos" value={critC} color={critC > 0 ? 'red' : 'green'} sub="< 70% asistencia" />
      <KPICard label="Total sesiones" value={attendanceBySubjectData[0]?.totalClasses || 0} color="blue" sub="clases" />
    </>)
  }, [attendanceBySubjectData])

  const teacherKPIs = useMemo(() => {
    if (!teacherComplianceData.length) return null
    const avg = Math.round(teacherComplianceData.reduce((s, r) => s + r.complianceRate, 0) / teacherComplianceData.length)
    const reg = teacherComplianceData.reduce((s, r) => s + r.classesRegistered, 0)
    const miss = teacherComplianceData.reduce((s, r) => s + r.classesNotRegistered, 0)
    return (<>
      <KPICard label="% Cumplimiento" value={`${avg}%`} color={kpiColorFromPct(avg)} sub={`${teacherComplianceData.length} docentes`} />
      <KPICard label="Clases registradas" value={reg} color="green" sub="total" />
      <KPICard label="Clases faltantes" value={miss} color={miss > 0 ? 'red' : 'green'} sub="sin registro" />
      <KPICard label="Programadas" value={teacherComplianceData.reduce((s, r) => s + r.classesScheduled, 0)} color="blue" sub="total" />
    </>)
  }, [teacherComplianceData])

  const criticalKPIs = useMemo(() => {
    if (!criticalAbsencesData.length) return null
    const t = criticalAbsencesData.length
    const rC = criticalAbsencesData.filter(r => r.status === 'Riesgo').length
    const gc: Record<string, number> = {}; criticalAbsencesData.forEach(r => { gc[r.group] = (gc[r.group] || 0) + 1 })
    const wg = Object.entries(gc).sort((a, b) => b[1] - a[1])[0]
    const avg = Math.round(criticalAbsencesData.reduce((s, r) => s + r.pct, 0) / t)
    return (<>
      <KPICard label="Estudiantes criticos" value={t} color="red" sub="bajo el umbral" />
      <KPICard label="En riesgo grave" value={rC} color={rC > 0 ? 'red' : 'amber'} sub={`< ${THRESHOLDS.ALERT_MIN}%`} />
      <KPICard label="Grupo mas afectado" value={wg ? wg[0] : '-'} color="amber" sub={wg ? `${wg[1]} est.` : ''} />
      <KPICard label="Promedio criticos" value={`${avg}%`} color="red" sub="promedio" />
    </>)
  }, [criticalAbsencesData])

  const tutoringKPIs = useMemo(() => {
    if (!tutoringData.length) return null
    const avg = Math.round(tutoringData.reduce((s, r) => s + r.pct, 0) / tutoringData.length)
    const alertC = tutoringData.filter(r => r.status === 'Alerta').length
    const riskC = tutoringData.filter(r => r.status === 'Riesgo').length
    const totalDays = tutoringData[0]?.totalClasses || 0
    return (<>
      <KPICard label="Promedio tutoría" value={`${avg}%`} color={kpiColorFromPct(avg)} sub={`${tutoringData.length} estudiantes`} />
      <KPICard label="En alerta" value={alertC} color={alertC > 0 ? 'amber' : 'green'} sub="estudiantes" />
      <KPICard label="En riesgo" value={riskC} color={riskC > 0 ? 'red' : 'green'} sub="estudiantes" />
      <KPICard label="Días registrados" value={totalDays} color="blue" sub="sesiones de tutoría" />
    </>)
  }, [tutoringData])

  const consolidatedKPIs = useMemo(() => {
    const g = consolidatedData.byGrade; if (!g.length) return null
    const tR = g.reduce((s, x) => s + x.totalClasses, 0), tP = g.reduce((s, x) => s + x.totalAttended, 0), tA = g.reduce((s, x) => s + x.totalAbsent, 0)
    const avg = tR > 0 ? Math.round((tP / tR) * 100) : 0
    const rG = g.filter(x => x.pct < THRESHOLDS.ALERT_MIN).length, aG = g.filter(x => x.pct >= THRESHOLDS.ALERT_MIN && x.pct < THRESHOLDS.NORMAL_MIN).length
    return (<>
      <KPICard label="Promedio general" value={`${avg}%`} color={kpiColorFromPct(avg)} sub={`${g.length} grados`} />
      <KPICard label="Grados en riesgo" value={rG} color={rG > 0 ? 'red' : 'green'} sub={`< ${THRESHOLDS.ALERT_MIN}%`} />
      <KPICard label="Grados en alerta" value={aG} color={aG > 0 ? 'amber' : 'green'} sub={`${THRESHOLDS.ALERT_MIN}-${THRESHOLDS.NORMAL_MIN - 1}%`} />
      <KPICard label="Total registros" value={tR.toLocaleString()} color="blue" sub={`${tA.toLocaleString()} ausencias`} />
    </>)
  }, [consolidatedData])

  // ═══════════════════════════════════════════════════════════════════════
  // FILTERS
  // ═══════════════════════════════════════════════════════════════════════
  const renderFilters = () => {
    const W = ({ children }: { children: React.ReactNode }) => <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">{children}</div>
    if (selectedReport === 'att-group') return <W><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><FSelect label="Ano" value={filterYear} onChange={setFilterYear} options={yearOpts} /><FSelect label="Grupo" value={filterGrade} onChange={setFilterGrade} options={groupOpts} /><FSelect label="Asignatura" value={filterSubject} onChange={setFilterSubject} options={subjOpts} /><FSelect label="Estado" value={filterStatus} onChange={setFilterStatus} options={statOpts} /></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><FDate label="Fecha desde" value={filterDateFrom} onChange={setFilterDateFrom} /><FDate label="Fecha hasta" value={filterDateTo} onChange={setFilterDateTo} /><div><label className="block text-xs font-medium text-slate-600 mb-1">Buscar estudiante</label><input type="text" value={searchStudent} onChange={e => setSearchStudent(e.target.value)} placeholder="Nombre..." className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-300" /></div><SearchBtn onClick={() => loadReportData('att-group')} loading={loadingReport} /></div></W>
    if (selectedReport === 'att-student') return <W><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><FSelect label="Ano" value={filterYear} onChange={setFilterYear} options={yearOpts} /><FSelect label="Grupo" value={filterGrade} onChange={v => { setFilterGrade(v); setFilterStudentId('all') }} options={groupOpts} /><FSelect label="Estudiante" value={filterStudentId} onChange={setFilterStudentId} options={[{ value: 'all', label: 'Todos' }, ...students.map(s => ({ value: s.enrollmentId || s.id, label: [s.lastName, s.secondLastName, s.firstName, s.secondName].filter(Boolean).join(' ') }))]} /><FSelect label="Estado" value={filterStatus} onChange={setFilterStatus} options={attStatOpts} /></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><FDate label="Fecha desde" value={filterDateFrom} onChange={setFilterDateFrom} /><FDate label="Fecha hasta" value={filterDateTo} onChange={setFilterDateTo} /><FSelect label="Asignatura" value={filterSubject} onChange={setFilterSubject} options={subjOpts} /><SearchBtn onClick={() => loadReportData('att-student')} loading={loadingReport} /></div></W>
    if (selectedReport === 'att-subject') return <W><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><FSelect label="Ano" value={filterYear} onChange={setFilterYear} options={yearOpts} /><FSelect label="Asignatura" value={filterSubject} onChange={setFilterSubject} options={[{ value: 'all', label: isTeacherOnly ? 'Selecciona una asignatura...' : 'Seleccionar asignatura...' }, ...subjOpts.filter(o => o.value !== 'all')]} required={!isTeacherOnly} /><FSelect label="Grupo" value={filterGrade} onChange={setFilterGrade} options={groupOpts} /><FSelect label="Estado" value={filterStatus} onChange={setFilterStatus} options={statOpts} /></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><FDate label="Fecha desde" value={filterDateFrom} onChange={setFilterDateFrom} /><FDate label="Fecha hasta" value={filterDateTo} onChange={setFilterDateTo} /><div><label className="block text-xs font-medium text-slate-600 mb-1">Buscar estudiante</label><input type="text" value={searchStudent} onChange={e => setSearchStudent(e.target.value)} placeholder="Nombre..." className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-300" /></div><SearchBtn onClick={() => { if (filterSubject === 'all') { alert('Debe seleccionar una asignatura'); return }; loadReportData('att-subject') }} loading={loadingReport} /></div></W>
    if (selectedReport === 'att-teacher') return <W>{isTeacherOnly && <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">Solo verás tu propia carga académica.</div>}<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><FSelect label="Ano" value={filterYear} onChange={setFilterYear} options={yearOpts} />{!isTeacherOnly ? <FSelect label="Docente" value={filterTeacher} onChange={setFilterTeacher} options={teachOpts} /> : <div className="flex items-end"><div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">Se mostrará tu propia carga académica</div></div>}<FSelect label="Grupo" value={filterGrade} onChange={setFilterGrade} options={groupOpts} /><FSelect label="Asignatura" value={filterSubject} onChange={setFilterSubject} options={subjOpts} /></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><FDate label="Fecha desde" value={filterDateFrom} onChange={setFilterDateFrom} /><FDate label="Fecha hasta" value={filterDateTo} onChange={setFilterDateTo} /><div /><SearchBtn onClick={() => loadReportData('att-teacher')} loading={loadingReport} /></div></W>
    if (selectedReport === 'att-critical') return <W><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"><FSelect label="Ano" value={filterYear} onChange={setFilterYear} options={yearOpts} /><FSelect label="Grupo" value={filterGrade} onChange={setFilterGrade} options={groupOpts} /><div><label className="block text-xs font-medium text-slate-600 mb-1">% Umbral</label><input type="number" value={filterMinPercent} onChange={e => setFilterMinPercent(e.target.value)} className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-300" /></div><FSelect label="Estado" value={filterStatus} onChange={setFilterStatus} options={[{ value: 'all', label: 'Todos' }, { value: 'Alerta', label: 'Alerta' }, { value: 'Riesgo', label: 'Riesgo' }]} /><SearchBtn onClick={() => loadReportData('att-critical')} loading={loadingReport} /></div></W>
    if (selectedReport === 'att-consolidated') return <W><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"><FSelect label="Ano" value={filterYear} onChange={setFilterYear} options={yearOpts} /><FSelect label="Asignatura" value={filterSubject} onChange={setFilterSubject} options={subjOpts} /><FDate label="Fecha desde" value={filterDateFrom} onChange={setFilterDateFrom} /><FDate label="Fecha hasta" value={filterDateTo} onChange={setFilterDateTo} /><SearchBtn onClick={() => loadReportData('att-consolidated')} loading={loadingReport} /></div></W>
    if (selectedReport === 'att-tutoring') return <W><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><FSelect label="Ano" value={filterYear} onChange={setFilterYear} options={yearOpts} /><FSelect label="Grupo" value={filterGrade} onChange={setFilterGrade} options={groupOpts} /><FDate label="Fecha desde" value={filterDateFrom} onChange={setFilterDateFrom} /><FDate label="Fecha hasta" value={filterDateTo} onChange={setFilterDateTo} /></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"><FSelect label="Estado" value={filterStatus} onChange={setFilterStatus} options={statOpts} /><div /><div /><SearchBtn onClick={() => loadReportData('att-tutoring')} loading={loadingReport} /></div></W>
    return null
  }

  // ═══════════════════════════════════════════════════════════════════════
  // TABLE RENDERING
  // ═══════════════════════════════════════════════════════════════════════
  const th = 'px-3 py-2.5 text-xs font-semibold text-slate-600 uppercase tracking-wider'
  const td = 'px-3 py-2.5 text-sm'
  const tfoot = (n: number) => <div className="px-4 py-3 bg-slate-50 border-t text-xs text-slate-500">{n} registros encontrados</div>

  // Reusable table for group-like data (group, subject, critical share same shape)
  function GroupTable({ data, showLate = true }: { data: any[]; showLate?: boolean }) {
    return (<div className="overflow-x-auto">
      <table className="w-full"><thead className="bg-slate-50 border-b border-slate-200"><tr>
        <th className={`${th} text-left w-12`}>#</th><th className={`${th} text-left`}>Estudiante</th><th className={`${th} text-left`}>Grupo</th><th className={`${th} text-center`}>Total</th><th className={`${th} text-center`}>Asist.</th><th className={`${th} text-center`}>Fallas</th>
        {showLate && <><th className={`${th} text-center`}>Tardanzas</th><th className={`${th} text-center`}>Excusas</th></>}
        <th className={`${th} text-center`}>%</th><th className={`${th} text-center`}>Estado</th>
      </tr></thead><tbody className="divide-y divide-slate-100">
        {data.map((r, i) => (<tr key={i} className={`${getRowBg(r.status)} hover:bg-slate-50/80 transition-colors`}>
          <td className={`${td} text-slate-400`}>{i + 1}</td>
          <td className={`${td} font-medium text-slate-800`}>{r.name}</td>
          <td className={td}>{r.group}</td>
          <td className={`${td} text-center font-medium`}>{r.totalClasses}</td>
          <td className={`${td} text-center text-emerald-600`}>{r.attended}</td>
          <td className={`${td} text-center text-red-600 font-medium`}>{r.absent}</td>
          {showLate && <><td className={`${td} text-center text-amber-600`}>{r.late || 0}</td><td className={`${td} text-center text-blue-600`}>{r.excused || 0}</td></>}
          <td className={`${td} text-center font-bold ${getPctColor(r.pct)}`}>{r.pct}%</td>
          <td className={`${td} text-center`}><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadge(r.status)}`}>{r.status}</span></td>
        </tr>))}
      </tbody></table>{tfoot(data.length)}
    </div>)
  }

  const renderTable = () => {
    if (loadingReport) return <div className="flex flex-col items-center justify-center py-16"><div className="w-10 h-10 border-3 border-amber-200 border-t-amber-600 rounded-full animate-spin mb-3" /><p className="text-sm text-slate-500">Generando reporte...</p></div>
    if (reportError) return <EmptyState icon={<UserCheck className="w-12 h-12" />} message={reportError} />

    if (selectedReport === 'att-group') {
      const d = searchStudent ? attendanceData.filter(r => r.name?.toLowerCase().includes(searchStudent.toLowerCase())) : attendanceData
      if (!d.length) return <EmptyState icon={<GraduationCap className="w-12 h-12" />} />
      return <GroupTable data={d} />
    }

    if (selectedReport === 'att-student') {
      if (!attendanceDetailData.length) return <EmptyState icon={<Users className="w-12 h-12" />} />
      const sl = (s: string) => s === 'PRESENT' ? 'Presente' : s === 'ABSENT' ? 'Ausente' : s === 'LATE' ? 'Tarde' : 'Excusa'
      const sc = (s: string) => ({ PRESENT: 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200', ABSENT: 'bg-red-100 text-red-700 ring-1 ring-red-200', LATE: 'bg-amber-100 text-amber-700 ring-1 ring-amber-200', EXCUSED: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200' }[s] || 'bg-slate-100 text-slate-700')
      return (<div className="overflow-x-auto"><table className="w-full"><thead className="bg-slate-50 border-b border-slate-200"><tr>
        <th className={`${th} text-left w-12`}>#</th><th className={`${th} text-left`}>Fecha</th><th className={`${th} text-left`}>Estudiante</th><th className={`${th} text-left`}>Grupo</th><th className={`${th} text-left`}>Asignatura</th><th className={`${th} text-left`}>Docente</th><th className={`${th} text-center`}>Estado</th><th className={`${th} text-left`}>Obs.</th>
      </tr></thead><tbody className="divide-y divide-slate-100">
        {attendanceDetailData.map((r, i) => (<tr key={i} className={`${r.status === 'ABSENT' ? 'bg-red-50/40' : r.status === 'LATE' ? 'bg-amber-50/40' : ''} hover:bg-slate-50/80 transition-colors`}>
          <td className={`${td} text-slate-400`}>{r.nro}</td><td className={td}>{r.date}</td><td className={`${td} font-medium text-slate-800`}>{r.student}</td><td className={td}>{r.group}</td><td className={td}>{r.subject}</td><td className={td}>{r.teacher}</td>
          <td className={`${td} text-center`}><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sc(r.status)}`}>{sl(r.status)}</span></td>
          <td className={`${td} text-slate-500 max-w-[200px] truncate`}>{r.observations}</td>
        </tr>))}
      </tbody></table>{tfoot(attendanceDetailData.length)}</div>)
    }

    if (selectedReport === 'att-subject') {
      const d = searchStudent ? attendanceBySubjectData.filter(r => r.name?.toLowerCase().includes(searchStudent.toLowerCase())) : attendanceBySubjectData
      if (!d.length) return <EmptyState icon={<ClipboardList className="w-12 h-12" />} />
      return <GroupTable data={d} />
    }

    if (selectedReport === 'att-teacher') {
      if (!teacherComplianceData.length) return <EmptyState icon={<UserCheck className="w-12 h-12" />} message="No se encontraron registros para tu carga académica." />
      return (<div className="overflow-x-auto"><table className="w-full"><thead className="bg-slate-50 border-b border-slate-200"><tr>
        <th className={`${th} text-left w-12`}>#</th><th className={`${th} text-left`}>Docente</th><th className={`${th} text-center`}>Programadas</th><th className={`${th} text-center`}>Registradas</th><th className={`${th} text-center`}>Sin registrar</th><th className={`${th} text-center`}>% Cumplimiento</th>
      </tr></thead><tbody className="divide-y divide-slate-100">
        {teacherComplianceData.map((r, i) => {
          const bg = r.complianceRate < THRESHOLDS.ALERT_MIN ? 'bg-red-50/60' : r.complianceRate < THRESHOLDS.NORMAL_MIN ? 'bg-amber-50/50' : ''
          return (<tr key={i} className={`${bg} hover:bg-slate-50/80 transition-colors`}>
            <td className={`${td} text-slate-400`}>{r.nro}</td><td className={`${td} font-medium text-slate-800`}>{r.teacher}</td>
            <td className={`${td} text-center`}>{r.classesScheduled}</td><td className={`${td} text-center text-emerald-600`}>{r.classesRegistered}</td>
            <td className={`${td} text-center text-red-600 font-medium`}>{r.classesNotRegistered}</td>
            <td className={`${td} text-center font-bold ${getPctColor(r.complianceRate)}`}>{r.complianceRate}%</td>
          </tr>)
        })}
      </tbody></table>{tfoot(teacherComplianceData.length)}</div>)
    }

    if (selectedReport === 'att-critical') {
      if (!criticalAbsencesData.length) return <EmptyState icon={<AlertTriangle className="w-12 h-12" />} message="No se encontraron estudiantes bajo el umbral indicado" />
      return <GroupTable data={criticalAbsencesData} showLate={false} />
    }

    if (selectedReport === 'att-consolidated') {
      const hasG = consolidatedData.byGrade.length > 0, hasS = consolidatedData.bySubject.length > 0
      if (!hasG && !hasS) return <EmptyState icon={<BarChart3 className="w-12 h-12" />} />
      const ConsolidatedTable = ({ data, nameKey, nameLabel }: { data: any[]; nameKey: string; nameLabel: string }) => (
        <table className="w-full"><thead className="bg-slate-50 border-b border-slate-200"><tr>
          <th className={`${th} text-left w-12`}>#</th><th className={`${th} text-left`}>{nameLabel}</th><th className={`${th} text-center`}>Total</th><th className={`${th} text-center`}>Presentes</th><th className={`${th} text-center`}>Ausentes</th><th className={`${th} text-center`}>Tardanzas</th><th className={`${th} text-center`}>Excusas</th><th className={`${th} text-center`}>%</th>
        </tr></thead><tbody className="divide-y divide-slate-100">
          {data.map((r, i) => {
            const status = r.pct >= THRESHOLDS.NORMAL_MIN ? '' : r.pct >= THRESHOLDS.ALERT_MIN ? 'bg-amber-50/50' : 'bg-red-50/60'
            return (<tr key={i} className={`${status} hover:bg-slate-50/80 transition-colors`}>
              <td className={`${td} text-slate-400`}>{r.nro}</td><td className={`${td} font-medium text-slate-800`}>{r[nameKey]}</td>
              <td className={`${td} text-center font-medium`}>{r.totalClasses}</td><td className={`${td} text-center text-emerald-600`}>{r.totalAttended}</td>
              <td className={`${td} text-center text-red-600`}>{r.totalAbsent}</td><td className={`${td} text-center text-amber-600`}>{r.totalLate}</td>
              <td className={`${td} text-center text-blue-600`}>{r.totalExcused}</td><td className={`${td} text-center font-bold ${getPctColor(r.pct)}`}>{r.pct}%</td>
            </tr>)
          })}
        </tbody></table>
      )
      return (<div className="divide-y divide-slate-200">
        {hasG && <div className="p-4"><h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Asistencia por Grado</h4><div className="overflow-x-auto"><ConsolidatedTable data={consolidatedData.byGrade} nameKey="grade" nameLabel="Grado" /></div></div>}
        {hasS && <div className="p-4"><h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">Asistencia por Asignatura</h4><div className="overflow-x-auto"><ConsolidatedTable data={consolidatedData.bySubject} nameKey="subject" nameLabel="Asignatura" /></div></div>}
      </div>)
    }

    if (selectedReport === 'att-tutoring') {
      if (!tutoringData.length) return <EmptyState icon={<Calendar className="w-12 h-12" />} message="No se encontraron registros de asistencia de tutoría" />
      return <GroupTable data={tutoringData} />
    }

    return <EmptyState icon={<Calendar className="w-12 h-12" />} />
  }

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════
  const kpiMap: Record<string, any> = {
    'att-group': groupKPIs,
    'att-student': studentKPIs,
    'att-subject': subjectKPIs,
    'att-teacher': teacherKPIs,
    'att-critical': criticalKPIs,
    'att-consolidated': consolidatedKPIs,
    'att-tutoring': tutoringKPIs,
  }
  const selectedKpis = selectedReport && selectedReport in kpiMap
    ? kpiMap[selectedReport as keyof typeof kpiMap]
    : null

  // Docentes ahora ven múltiples reportes (grupo, asignatura, docente, críticas) - no auto-seleccionar

  if (!showReport) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link to="/reports" className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ArrowLeft className="w-5 h-5 text-slate-600" /></Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shadow-sm"><Calendar className="w-6 h-6 text-amber-600" /></div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Asistencia</h1>
              <p className="text-sm text-slate-500">Selecciona el reporte que deseas consultar</p>
            </div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleReports.map(r => {
            const Icon = r.icon
            return (
              <button key={r.id} onClick={() => handleSelectReport(r.id)} className="group text-left rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-amber-300 transition-all">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="p-3 rounded-xl bg-amber-50 text-amber-700 group-hover:bg-amber-100 transition-colors"><Icon className="w-6 h-6" /></div>
                  <h3 className="font-medium text-slate-900">{r.name}</h3>
                </div>
                <p className="text-sm text-slate-500">{r.description}</p>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <AttendanceReportLayout
      title={currentReport?.name || ''}
      subtitle={currentReport?.description || ''}
      icon={currentReport ? <currentReport.icon className="w-5 h-5 text-amber-600" /> : null}
      onBack={handleBack}
      onExport={exportToCSV}
      filters={renderFilters()}
      kpis={selectedKpis}
      hasData={!loadingReport && (attendanceData.length > 0 || attendanceDetailData.length > 0 || attendanceBySubjectData.length > 0 || teacherComplianceData.length > 0 || criticalAbsencesData.length > 0 || consolidatedData.byGrade.length > 0 || tutoringData.length > 0)}
    >
      {renderTable()}
    </AttendanceReportLayout>
  )
}
