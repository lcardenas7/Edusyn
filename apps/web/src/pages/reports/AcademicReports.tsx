import { useState } from 'react'
import {
  BookOpen, Users, GraduationCap, ClipboardList, BarChart3, Download, Printer,
  ArrowLeft, ChevronLeft, Calculator, TrendingUp, FileText, AlertTriangle,
  History, UserCheck, FileSpreadsheet
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts'
import { useReportsData } from '../../hooks/useReportsData'
import { useAuth } from '../../contexts/AuthContext'
import { teacherAssignmentsApi, periodFinalGradesApi, reportsApi } from '../../lib/api'

const CHART_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6']
const PROMOTION_COLORS = { promoted: '#22c55e', atRisk: '#f59e0b', notPromoted: '#ef4444' }

interface ReportItem { id: string; name: string; description: string; icon: any }
interface ReportBlock { id: string; title: string; description: string; color: string; icon: any; reports: ReportItem[] }

const reportBlocks: ReportBlock[] = [
  {
    id: 'rendimiento', title: 'Rendimiento Académico',
    description: 'Promedios, consolidados y análisis de desempeño', color: 'green', icon: BarChart3,
    reports: [
      { id: 'cons-subjects', name: 'Consolidado por asignaturas', description: 'Notas de todas las materias por estudiante', icon: ClipboardList },
      { id: 'avg-subject', name: 'Promedio por asignatura', description: '¿Qué asignatura tiene mejor o peor rendimiento?', icon: BookOpen },
      { id: 'ranking-students', name: 'Ranking de estudiantes', description: '¿Quiénes son los mejores y peores del grupo?', icon: TrendingUp },
      { id: 'grade-distribution', name: 'Distribución de notas', description: '¿Cómo se distribuyen las calificaciones?', icon: BarChart3 },
    ],
  },
  {
    id: 'riesgo', title: 'Riesgo Académico',
    description: 'Alertas, reprobaciones y proyecciones de riesgo', color: 'amber', icon: AlertTriangle,
    reports: [
      { id: 'min-grade', name: 'Nota mínima requerida', description: 'Nota necesaria en períodos restantes para aprobar', icon: Calculator },
      { id: 'failed-subjects', name: 'Asignaturas reprobadas', description: '¿Qué materias perdió cada estudiante?', icon: ClipboardList },
      { id: 'recovery-list', name: 'Listado de recuperación', description: '¿Quién puede recuperar y en qué asignaturas?', icon: FileText },
      { id: 'promotion-projection', name: 'Proyección de promoción', description: 'Si mantiene tendencia, ¿aprueba el año?', icon: GraduationCap },
    ],
  },
  {
    id: 'historico', title: 'Histórico',
    description: 'Tendencias, comparativos y trayectoria académica', color: 'blue', icon: History,
    reports: [
      { id: 'comparative', name: 'Comparativo de períodos', description: 'Evolución del rendimiento entre períodos', icon: TrendingUp },
      { id: 'student-history', name: 'Historial académico', description: 'Trayectoria de un estudiante a lo largo de los años', icon: Users },
      { id: 'subject-analysis', name: 'Análisis por asignatura', description: '¿Cómo se comporta una asignatura en el tiempo?', icon: BookOpen },
    ],
  },
  {
    id: 'docente', title: 'Gestión Docente',
    description: 'Rendimiento de grupos por docente', color: 'purple', icon: UserCheck,
    reports: [
      { id: 'teacher-performance', name: 'Rendimiento por docente', description: '¿Cómo rinden los grupos con cada docente?', icon: Users },
    ],
  },
]

const allReports = reportBlocks.flatMap(b => b.reports.map(r => ({ ...r, blockId: b.id, blockColor: b.color })))

const BLOCK_STYLES: Record<string, { bg: string; border: string; text: string; iconBg: string; iconText: string; btnBg: string; btnHover: string; cardHover: string }> = {
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  iconBg: 'bg-green-100',  iconText: 'text-green-600',  btnBg: 'bg-green-600',  btnHover: 'hover:bg-green-700',  cardHover: 'hover:border-green-300' },
  amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  iconBg: 'bg-amber-100',  iconText: 'text-amber-600',  btnBg: 'bg-amber-600',  btnHover: 'hover:bg-amber-700',  cardHover: 'hover:border-amber-300' },
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   iconBg: 'bg-blue-100',   iconText: 'text-blue-600',   btnBg: 'bg-blue-600',   btnHover: 'hover:bg-blue-700',   cardHover: 'hover:border-blue-300' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', iconBg: 'bg-purple-100', iconText: 'text-purple-600', btnBg: 'bg-purple-600', btnHover: 'hover:bg-purple-700', cardHover: 'hover:border-purple-300' },
}

const STAGE_OPTIONS = [
  { value: 'PREESCOLAR', label: 'Preescolar' },
  { value: 'BASICA_PRIMARIA', label: 'Básica Primaria' },
  { value: 'BASICA_SECUNDARIA', label: 'Básica Secundaria' },
  { value: 'MEDIA', label: 'Media' },
]

export default function AcademicReports() {
  const { hasFeature, institution } = useAuth()
  const {
    academicYears, terms, groups, subjects, teachers, students,
    gradingScale,
    filterYear, setFilterYear,
    filterPeriod, setFilterPeriod,
    filterGrade, setFilterGrade,
    filterSubject, setFilterSubject,
    filterTeacher, setFilterTeacher,
    filterStudentId, setFilterStudentId,
  } = useReportsData()

  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)
  const [filterLevel, setFilterLevel] = useState('all')
  const [showOnlyFailed, setShowOnlyFailed] = useState(false)
  const [showGrades, setShowGrades] = useState(true)
  const [showPerformance, setShowPerformance] = useState(false)
  const [decimalPlaces, setDecimalPlaces] = useState('1')

  // Datos genéricos del reporte activo + legacy states
  const [reportData, setReportData] = useState<any>(null)
  const [studentsGradesData, setStudentsGradesData] = useState<any[]>([])
  const [minimumGradeData, setMinimumGradeData] = useState<any>(null)
  const [minimumGradeGroupData, setMinimumGradeGroupData] = useState<any[]>([])

  const currentMeta = allReports.find(r => r.id === selectedReport)
  const style = currentMeta ? BLOCK_STYLES[currentMeta.blockColor] : BLOCK_STYLES.green

  // ─── Helpers dinámicos basados en configuración institucional ──────────
  const { minGrade: scaleMin, maxGrade: scaleMax, minPassingGrade } = gradingScale
  const scaleRange = scaleMax - scaleMin || 1

  const getPerformanceLabel = (grade: number): string => {
    if (gradingScale.performanceLevels.length > 0) {
      const sorted = [...gradingScale.performanceLevels].sort((a, b) => b.minScore - a.minScore)
      for (const level of sorted) {
        if (grade >= level.minScore && grade <= level.maxScore) return level.name
      }
      return sorted[sorted.length - 1]?.name || 'Bajo'
    }
    const pct = ((grade - scaleMin) / scaleRange) * 100
    if (pct >= 85) return 'Superior'
    if (pct >= 70) return 'Alto'
    if (pct >= 50) return 'Básico'
    return 'Bajo'
  }

  const getPerformanceBadgeColor = (label: string): string => {
    const level = gradingScale.performanceLevels.find(l => l.name === label)
    if (level?.color) {
      return `bg-[${level.color}20] text-[${level.color}]`
    }
    switch (label) {
      case 'Superior': return 'bg-green-100 text-green-700'
      case 'Alto': return 'bg-blue-100 text-blue-700'
      case 'Básico': return 'bg-amber-100 text-amber-700'
      default: return 'bg-red-100 text-red-700'
    }
  }

  const isFailed = (grade: number): boolean => grade < minPassingGrade

  // Detectar si el grupo seleccionado es DIMENSIONS (preescolar)
  const selectedGroup = groups.find((g: any) => g.id === filterGrade)
  const isDimensionsMode = selectedGroup?.grade?.academicStructure === 'DIMENSIONS' || selectedGroup?.grade?.stage === 'PREESCOLAR'
  // Niveles cualitativos para DIMENSIONS
  const qualitativeLevels = gradingScale.academicLevels
    .find((l) => l.gradingScaleType === 'QUALITATIVE' || l.code === 'PRE')
    ?.qualitativeLevels || []

  const getDistBarColor = (rangeLabel: string): string => {
    const match = rangeLabel?.match(/[\d.]+/)
    if (!match) return 'bg-slate-400'
    const start = parseFloat(match[0])
    if (start < minPassingGrade) return 'bg-red-400'
    const pct = ((start - scaleMin) / scaleRange) * 100
    if (pct >= 70) return 'bg-green-400'
    return 'bg-amber-400'
  }

  const handleSelectReport = (reportId: string) => {
    setSelectedReport(reportId)
    setShowReport(true)
    setReportData(null)
    setStudentsGradesData([])
    setMinimumGradeData(null)
    setMinimumGradeGroupData([])
  }

  const loadReportData = async (reportId: string) => {
    if (!filterYear) return
    setLoadingReport(true)
    setReportData(null)

    try {
      switch (reportId) {
        case 'cons-subjects': {
          if (!filterPeriod) break
          const assignmentsRes = await teacherAssignmentsApi.getAll({ academicYearId: filterYear })
          const assignments = assignmentsRes.data || []
          const groupIds = [...new Set(assignments.map((a: any) => a.group?.id).filter(Boolean))]
          const targetGroupIds = filterGrade !== 'all' ? groupIds.filter((id: any) => id === filterGrade) : groupIds
          const studentGradesMap = new Map<string, any>()
          const results = await Promise.allSettled(
            targetGroupIds.map((groupId: any) => periodFinalGradesApi.getByGroup(groupId as string, filterPeriod))
          )
          results.forEach((result) => {
            if (result.status !== 'fulfilled') return
            const grades = result.value.data || []
            grades.forEach((g: any) => {
              const studentId = g.studentEnrollmentId
              const student = g.studentEnrollment?.student
              if (!studentGradesMap.has(studentId)) {
                studentGradesMap.set(studentId, {
                  id: studentId,
                  name: student ? `${student.lastName} ${student.firstName}`.toUpperCase() : 'Estudiante',
                  group: g.studentEnrollment?.group?.name || '',
                  grades: {}
                })
              }
              studentGradesMap.get(studentId).grades[g.subject?.name || 'Asignatura'] = Number(g.finalScore)
            })
          })
          const studentsData = Array.from(studentGradesMap.values()).map((s, idx) => {
            const gradeValues = Object.values(s.grades) as number[]
            const avg = gradeValues.length > 0 ? gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length : 0
            const failedCount = gradeValues.filter(g => g < minPassingGrade).length
            return { nro: idx + 1, name: s.name, group: s.group, grades: s.grades, average: avg, failedCount,
              performance: getPerformanceLabel(avg) }
          })
          setStudentsGradesData(showOnlyFailed ? studentsData.filter(s => s.failedCount > 0 || s.average < minPassingGrade) : studentsData)
          break
        }
        case 'avg-subject': {
          const res = await reportsApi.getSubjectAverages(filterYear, {
            groupId: filterGrade !== 'all' ? filterGrade : undefined,
            termId: filterPeriod || undefined,
            stage: filterLevel !== 'all' ? filterLevel : undefined,
          })
          setReportData(res.data)
          break
        }
        case 'ranking-students': {
          if (filterGrade === 'all') break
          const res = await reportsApi.getStudentRanking(filterYear, filterGrade, filterPeriod || undefined)
          setReportData(res.data)
          break
        }
        case 'grade-distribution': {
          if (filterGrade === 'all') break
          const res = await reportsApi.getGradeDistribution(filterYear, filterGrade, {
            subjectId: filterSubject !== 'all' ? filterSubject : undefined,
            termId: filterPeriod || undefined,
          })
          setReportData(res.data)
          break
        }
        case 'min-grade': {
          try {
            if (filterStudentId && filterStudentId !== 'all') {
              const response = await reportsApi.getMinimumGrade(filterStudentId, filterYear)
              setMinimumGradeData(response.data)
              setMinimumGradeGroupData([])
            } else if (filterGrade && filterGrade !== 'all') {
              const response = await reportsApi.getMinimumGradeForGroup(filterGrade, filterYear)
              const rawData = response.data || []
              const flatRows: any[] = []
              rawData.forEach((student: any) => {
                if (student.criticalSubjects && student.criticalSubjects.length > 0) {
                  student.criticalSubjects.forEach((subj: any) => {
                    flatRows.push({
                      studentName: student.studentName, subjectName: subj.subjectName,
                      minimumRequired: subj.minimumRequired,
                      status: subj.status === 'at_risk' ? 'En riesgo' : subj.status === 'impossible' ? 'Imposible' : subj.status,
                      summary: student.summary,
                    })
                  })
                } else {
                  flatRows.push({
                    studentName: student.studentName, subjectName: '-', minimumRequired: null,
                    status: student.summary.approved === student.summary.totalSubjects ? 'Aprobado' : 'Sin datos',
                    summary: student.summary,
                  })
                }
              })
              setMinimumGradeGroupData(flatRows)
              setMinimumGradeData(null)
            }
          } catch (err) { console.error('Error loading minimum grade report:', err) }
          break
        }
        case 'failed-subjects': {
          if (filterGrade === 'all') break
          const res = await reportsApi.getFailedSubjects(filterYear, filterGrade, filterPeriod || undefined)
          setReportData(res.data)
          break
        }
        case 'recovery-list': {
          if (filterGrade === 'all') break
          const res = await reportsApi.getRecoveryList(filterYear, filterGrade, { termId: filterPeriod || undefined })
          setReportData(res.data)
          break
        }
        case 'promotion-projection': {
          if (filterGrade === 'all') break
          const res = await reportsApi.getPromotionProjection(filterYear, filterGrade)
          setReportData(res.data)
          break
        }
        case 'comparative': {
          const res = await reportsApi.getPeriodComparison(filterYear, {
            groupId: filterGrade !== 'all' ? filterGrade : undefined,
            studentEnrollmentId: filterStudentId !== 'all' ? filterStudentId : undefined,
          })
          setReportData(res.data)
          break
        }
        case 'student-history': {
          const student = students.find(s => (s.enrollmentId || s.id) === filterStudentId)
          if (!student) break
          const res = await reportsApi.getStudentHistory(student.id)
          setReportData(res.data)
          break
        }
        case 'subject-analysis': {
          if (filterSubject === 'all') break
          const res = await reportsApi.getSubjectAnalysis(filterYear, filterSubject, filterGrade !== 'all' ? filterGrade : undefined)
          setReportData(res.data)
          break
        }
        case 'teacher-performance': {
          const res = await reportsApi.getTeacherPerformance(filterYear, filterTeacher !== 'all' ? filterTeacher : undefined)
          setReportData(res.data)
          break
        }
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
    let filename = selectedReport || 'reporte_academico'

    if (selectedReport === 'cons-subjects' && studentsGradesData.length > 0) {
      const allSubjects = new Set<string>()
      studentsGradesData.forEach(s => Object.keys(s.grades).forEach(subj => allSubjects.add(subj)))
      const subjectList = Array.from(allSubjects)
      csvContent = `Nro,Estudiante,Grupo,${subjectList.join(',')},Promedio,Reprobadas,Desempeño\n`
      studentsGradesData.forEach((row, idx) => {
        const grades = subjectList.map(subj => row.grades[subj]?.toFixed(parseInt(decimalPlaces)) || '-').join(',')
        csvContent += `${idx + 1},"${row.name}","${row.group}",${grades},${row.average.toFixed(parseInt(decimalPlaces))},${row.failedCount},${row.performance}\n`
      })
    } else if (selectedReport === 'min-grade') {
      if (minimumGradeData?.subjects?.length > 0) {
        csvContent = 'Asignatura,Área,Promedio Actual,Nota Mínima Requerida,Estado,Detalle\n'
        minimumGradeData.subjects.forEach((subj: any) => {
          csvContent += `"${subj.subjectName}","${subj.areaName}",${subj.currentAnnualGrade?.toFixed(1) || '-'},${subj.minimumRequired?.toFixed(1) || '-'},"${subj.status}","${subj.message}"\n`
        })
      } else if (minimumGradeGroupData.length > 0) {
        csvContent = 'Nro,Estudiante,Asignatura Crítica,Nota Mínima Requerida,Estado\n'
        minimumGradeGroupData.forEach((row: any, idx: number) => {
          csvContent += `${idx + 1},"${row.studentName}","${row.subjectName}",${row.minimumRequired?.toFixed(1) || '-'},"${row.status}"\n`
        })
      }
    } else if (selectedReport === 'avg-subject' && reportData?.results) {
      csvContent = 'Asignatura,Área,Promedio,Aprobación %,Reprobación %,Mejor Nota,Peor Nota,Estudiantes\n'
      reportData.results.forEach((r: any) => {
        csvContent += `"${r.subjectName}","${r.areaName}",${r.average},${r.approvalRate},${r.failRate},${r.bestGrade},${r.worstGrade},${r.totalStudents}\n`
      })
    } else if (selectedReport === 'ranking-students' && Array.isArray(reportData)) {
      csvContent = 'Posición,Estudiante,Grupo,Promedio,Asignaturas,Desempeño\n'
      reportData.forEach((r: any) => {
        csvContent += `${r.position},"${r.studentName}","${r.group}",${r.average},${r.subjectCount},"${r.performance}"\n`
      })
    } else if (selectedReport === 'grade-distribution' && reportData?.distribution) {
      csvContent = 'Rango,Cantidad,Porcentaje %\n'
      reportData.distribution.forEach((r: any) => {
        csvContent += `"${r.range}",${r.count},${r.percentage}\n`
      })
    } else if (selectedReport === 'failed-subjects' && reportData?.results) {
      csvContent = 'Estudiante,Asignatura,Área,Nota,Período,Déficit,Recuperable\n'
      reportData.results.forEach((r: any) => {
        csvContent += `"${r.studentName}","${r.subjectName}","${r.areaName}",${r.grade},"${r.termName}",${r.deficit},${r.recoverable ? 'Sí' : 'No'}\n`
      })
    } else if (selectedReport === 'recovery-list' && reportData?.results) {
      csvContent = 'Estudiante,Asignatura,Nota,Período,Déficit\n'
      reportData.results.forEach((r: any) => {
        csvContent += `"${r.studentName}","${r.subjectName}",${r.grade},"${r.termName}",${r.deficit}\n`
      })
    } else if (selectedReport === 'promotion-projection' && reportData?.results) {
      csvContent = 'Estudiante,Grupo,Total Asig.,Promueve,En Riesgo,No Promueve,Proyección\n'
      reportData.results.forEach((r: any) => {
        csvContent += `"${r.studentName}","${r.group}",${r.totalSubjects},${r.projectedApproved},${r.atRisk},${r.projectedFailed},"${r.overallProjection}"\n`
      })
    } else if (selectedReport === 'teacher-performance' && reportData?.results) {
      csvContent = 'Docente,Asignatura,Grupo,Promedio,Aprobación %,Estudiantes\n'
      reportData.results.forEach((r: any) => {
        csvContent += `"${r.teacherName}","${r.subjectName}","${r.groupName}",${r.average ?? '-'},${r.approvalRate ?? '-'},${r.totalStudents}\n`
      })
    }

    if (!csvContent || csvContent.split('\n').length <= 1) {
      alert('No hay datos para exportar')
      return
    }

    // Metadata institucional
    const meta = [
      `"Institución","${institution?.name || ''}"`,
      `"Reporte","${currentMeta?.name || filename}"`,
      `"Fecha de generación","${new Date().toLocaleString('es-CO')}"`,
      `"Escala de calificación","${scaleMin} - ${scaleMax}"`,
      `"Nota mínima aprobatoria","${minPassingGrade}"`,
      isDimensionsMode
        ? `"Estructura académica","DIMENSIONS (Evaluación cualitativa - Preescolar)"`
        : gradingScale.performanceLevels.length > 0
          ? `"Niveles de desempeño","${gradingScale.performanceLevels.sort((a, b) => a.order - b.order).map(l => `${l.name}(${l.minScore}-${l.maxScore})`).join(' / ')}"`
          : `"Clasificación","Porcentaje relativo a escala (Superior>=85% Alto>=70% Básico>=50% Bajo<50%)"`,
      selectedGroup?.grade?.academicStructure ? `"Tipo de estructura","${selectedGroup.grade.academicStructure}"` : '',
      '',
    ].join('\n')

    const fullCsv = meta + '\n' + csvContent
    const blob = new Blob(['\ufeff' + fullCsv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    const instSlug = (institution?.name || 'edusyn').replace(/\s+/g, '_').substring(0, 20)
    link.download = `${instSlug}_${filename}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const handleBack = () => {
    setShowReport(false)
    setSelectedReport(null)
    setReportData(null)
    setStudentsGradesData([])
    setMinimumGradeData(null)
    setMinimumGradeGroupData([])
  }

  // ─── Helpers de filtros comunes ──────────────────────────────────────────
  const SelectYear = () => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">Año Escolar</label>
      <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
        <option value="">Seleccionar...</option>
        {academicYears.map(y => <option key={y.id} value={y.id}>{y.year}{y.status === 'ACTIVE' ? ' - Activo' : ''}</option>)}
      </select>
    </div>
  )
  const SelectGroup = ({ required = false }: { required?: boolean }) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">Grupo{required && ' *'}</label>
      <select value={filterGrade} onChange={(e) => { setFilterGrade(e.target.value); setFilterStudentId('all') }} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
        <option value="all">{required ? 'Seleccionar grupo...' : 'Todos'}</option>
        {groups.map(g => <option key={g.id} value={g.id}>{g.grade?.name} {g.name}</option>)}
      </select>
    </div>
  )
  const SelectTerm = () => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">Período (opcional)</label>
      <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
        <option value="">Todos los períodos</option>
        {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </div>
  )
  const SelectStudent = () => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">Estudiante</label>
      <select value={filterStudentId} onChange={(e) => setFilterStudentId(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" disabled={filterGrade === 'all'}>
        <option value="all">Todos</option>
        {students.map(s => <option key={s.enrollmentId || s.id} value={s.enrollmentId || s.id}>{s.lastName} {s.firstName}</option>)}
      </select>
    </div>
  )
  const SelectSubject = ({ required = false }: { required?: boolean }) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">Asignatura{required && ' *'}</label>
      <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
        <option value="all">{required ? 'Seleccionar...' : 'Todas'}</option>
        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </div>
  )
  const SelectTeacher = () => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">Docente (opcional)</label>
      <select value={filterTeacher} onChange={(e) => setFilterTeacher(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
        <option value="all">Todos</option>
        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    </div>
  )
  const SelectStage = () => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">Nivel Educativo</label>
      <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
        <option value="all">Todos</option>
        {STAGE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    </div>
  )
  const BtnSearch = ({ label = 'Buscar' }: { label?: string }) => (
    <div className="flex items-end">
      <button onClick={() => loadReportData(selectedReport!)} className={`px-4 py-1.5 ${style.btnBg} text-white rounded text-sm ${style.btnHover} w-full`}>{label}</button>
    </div>
  )

  // ─── renderFilters ─────────────────────────────────────────────────────
  const renderFilters = () => {
    const wrap = (children: React.ReactNode, cols = 4, extra?: React.ReactNode) => (
      <div className={`${style.bg} border ${style.border} rounded-lg p-4 space-y-4`}>
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${cols} gap-4`}>{children}</div>
        {extra}
      </div>
    )

    switch (selectedReport) {
      case 'cons-subjects':
        return wrap(<><SelectYear /><SelectGroup /><div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Período *</label>
          <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
            <option value="">Seleccionar...</option>
            {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div><BtnSearch /></>, 4,
          <div className="flex items-center gap-6 flex-wrap">
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={showOnlyFailed} onChange={(e) => setShowOnlyFailed(e.target.checked)} className="w-4 h-4 rounded" />Solo reprobadas</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={showGrades} onChange={(e) => setShowGrades(e.target.checked)} className="w-4 h-4 rounded" />Ver Notas</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={showPerformance} onChange={(e) => setShowPerformance(e.target.checked)} className="w-4 h-4 rounded" />Ver Desempeños</label>
            <label className="flex items-center gap-2 text-sm"><span className="text-slate-600">Decimales:</span>
              <select value={decimalPlaces} onChange={(e) => setDecimalPlaces(e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-sm w-16">
                <option value="0">0</option><option value="1">1</option><option value="2">2</option>
              </select>
            </label>
          </div>)

      case 'avg-subject':
        return wrap(<><SelectYear /><SelectGroup /><SelectTerm /><SelectStage /><BtnSearch /></>, 5)

      case 'ranking-students':
        return wrap(<><SelectYear /><SelectGroup required /><SelectTerm /><BtnSearch /></>, 4)

      case 'grade-distribution':
        return wrap(<><SelectYear /><SelectGroup required /><SelectSubject /><SelectTerm /><BtnSearch /></>, 5)

      case 'min-grade':
        return wrap(<><SelectYear /><SelectGroup required /><SelectStudent /><BtnSearch label="Calcular" /></>, 4,
          <div className={`${style.bg} rounded-lg p-3 text-sm ${style.text}`}>
            <strong>💡</strong> Calcula la nota mínima necesaria en los períodos restantes para aprobar cada asignatura.
          </div>)

      case 'failed-subjects':
      case 'recovery-list':
        return wrap(<><SelectYear /><SelectGroup required /><SelectTerm /><BtnSearch /></>, 4)

      case 'promotion-projection':
        return wrap(<><SelectYear /><SelectGroup required /><BtnSearch /></>, 3)

      case 'comparative':
        return wrap(<><SelectYear /><SelectGroup /><SelectStudent /><BtnSearch /></>, 4)

      case 'student-history':
        return wrap(<><SelectYear /><SelectGroup required /><SelectStudent /><BtnSearch /></>, 4,
          <div className={`${style.bg} rounded-lg p-3 text-sm ${style.text}`}>
            <strong>💡</strong> Seleccione un grupo y luego un estudiante para ver su trayectoria completa.
          </div>)

      case 'subject-analysis':
        return wrap(<><SelectYear /><SelectSubject required /><SelectGroup /><BtnSearch /></>, 4)

      case 'teacher-performance':
        return wrap(<><SelectYear /><SelectTeacher /><BtnSearch /></>, 3)

      default:
        return wrap(<><SelectYear /><SelectGroup /><SelectTerm /><BtnSearch /></>, 4)
    }
  }

  // ─── helpers de tabla ────────────────────────────────────────────────
  const statusLabel = (s: string) => s === 'approved' ? 'Aprobado' : s === 'at_risk' ? 'En riesgo' : s === 'impossible' ? 'Imposible' : 'Pendiente'
  const statusColor = (s: string) => s === 'approved' ? 'bg-green-100 text-green-700' : s === 'at_risk' ? 'bg-amber-100 text-amber-700' : s === 'impossible' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
  const perfBadge = (p: string) => {
    const c = getPerformanceBadgeColor(p)
    return <span className={`px-2 py-1 rounded text-xs ${c}`}>{p}</span>
  }

  // ─── renderReportTable ─────────────────────────────────────────────────
  const renderReportTable = () => {
    if (loadingReport) {
      return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div></div>
    }

    // ── DIMENSIONS: Reportes no aplicables a preescolar ──
    const numericOnlyReports = ['ranking-students', 'min-grade', 'min-grade-group', 'failed-subjects', 'recovery-list', 'promotion-projection']
    if (isDimensionsMode && numericOnlyReports.includes(selectedReport || '')) {
      return (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🎨</div>
          <h3 className="text-lg font-semibold text-purple-700 mb-2">Reporte no disponible para Preescolar</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Este reporte requiere calificaciones numéricas. Los grados con estructura de <strong>Dimensiones del desarrollo</strong> utilizan evaluación cualitativa.
          </p>
          <p className="text-xs text-slate-400 mt-2">Seleccione un grupo con estructura numérica o utilice el Consolidado Académico para ver la evaluación cualitativa.</p>
        </div>
      )
    }

    // ── Consolidado ──
    if (selectedReport === 'cons-subjects' && studentsGradesData.length > 0) {
      const allSubjects = new Set<string>()
      studentsGradesData.forEach(s => Object.keys(s.grades).forEach(subj => allSubjects.add(subj)))
      const subjectList = Array.from(allSubjects)
      const totalStudents = studentsGradesData.length
      const avgGrades = studentsGradesData.filter(s => s.average > 0)
      const groupAvg = avgGrades.length > 0 ? (avgGrades.reduce((sum, s) => sum + s.average, 0) / avgGrades.length) : 0
      const withFailed = studentsGradesData.filter(s => s.failedCount > 0).length
      const approvalPct = totalStudents > 0 ? Math.round(((totalStudents - withFailed) / totalStudents) * 100) : 0
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><p className="text-xs text-blue-500 uppercase font-medium">Total Estudiantes</p><p className="text-2xl font-bold text-blue-700">{totalStudents}</p></div>
            <div className={`${groupAvg >= minPassingGrade ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-xl p-3 text-center`}><p className="text-xs text-slate-500 uppercase font-medium">Promedio Grupo</p><p className={`text-2xl font-bold ${groupAvg >= minPassingGrade ? 'text-green-700' : 'text-red-700'}`}>{groupAvg.toFixed(1)}</p></div>
            <div className={`${withFailed > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} border rounded-xl p-3 text-center`}><p className="text-xs text-slate-500 uppercase font-medium">Con Reprobadas</p><p className={`text-2xl font-bold ${withFailed > 0 ? 'text-red-700' : 'text-green-700'}`}>{withFailed}</p><p className="text-xs text-slate-400">{totalStudents - withFailed} sin reprobadas</p></div>
            <div className={`${approvalPct >= 80 ? 'bg-green-50 border-green-200' : approvalPct >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'} border rounded-xl p-3 text-center`}><p className="text-xs text-slate-500 uppercase font-medium">Aprobacion</p><p className={`text-2xl font-bold ${approvalPct >= 80 ? 'text-green-700' : approvalPct >= 60 ? 'text-amber-700' : 'text-red-700'}`}>{approvalPct}%</p></div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left sticky left-0 bg-slate-100">Nro</th>
                <th className="px-3 py-2 text-left sticky left-10 bg-slate-100">Estudiante</th>
                <th className="px-3 py-2 text-left">Grupo</th>
                {showGrades && subjectList.map(subj => <th key={subj} className="px-3 py-2 text-center whitespace-nowrap">{subj}</th>)}
                <th className="px-3 py-2 text-center">Promedio</th>
                <th className="px-3 py-2 text-center">Reprobadas</th>
                {showPerformance && <th className="px-3 py-2 text-center">Desempeño</th>}
              </tr>
            </thead>
            <tbody>
              {studentsGradesData.map((row, idx) => (
                <tr key={idx} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2 sticky left-0 bg-white">{row.nro}</td>
                  <td className="px-3 py-2 font-medium sticky left-10 bg-white">{row.name}</td>
                  <td className="px-3 py-2">{row.group}</td>
                  {showGrades && subjectList.map(subj => {
                    const g = row.grades[subj]; const fail = g !== undefined && isFailed(g)
                    return <td key={subj} className={`px-3 py-2 text-center ${fail ? 'text-red-600 font-medium' : ''}`}>{g !== undefined ? g.toFixed(parseInt(decimalPlaces)) : '-'}</td>
                  })}
                  <td className="px-3 py-2 text-center font-medium">{row.average.toFixed(parseInt(decimalPlaces))}</td>
                  <td className="px-3 py-2 text-center">{row.failedCount > 0 ? <span className="text-red-600 font-medium">{row.failedCount}</span> : <span className="text-green-600">0</span>}</td>
                  {showPerformance && <td className="px-3 py-2 text-center">{perfBadge(row.performance)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )
    }

    // ── Promedio por asignatura ──
    if (selectedReport === 'avg-subject' && reportData?.results) {
      const avgResults = reportData.results as any[]
      const totalSubj = avgResults.length
      const generalAvg = totalSubj > 0 ? (avgResults.reduce((s: number, r: any) => s + (r.average || 0), 0) / totalSubj) : 0
      const bestSubj = avgResults.reduce((best: any, r: any) => (!best || (r.average || 0) > (best.average || 0)) ? r : best, null)
      const worstSubj = avgResults.reduce((worst: any, r: any) => (!worst || (r.average || 0) < (worst.average || 0)) ? r : worst, null)
      const avgApproval = totalSubj > 0 ? (avgResults.reduce((s: number, r: any) => s + (r.approvalRate || 0), 0) / totalSubj) : 0
      const chartData = avgResults.map((r: any) => ({ name: r.subjectName?.length > 12 ? r.subjectName.substring(0, 12) + '…' : r.subjectName, Promedio: r.average, 'Aprobación %': r.approvalRate }))
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><p className="text-xs text-blue-500 uppercase font-medium">Asignaturas</p><p className="text-2xl font-bold text-blue-700">{totalSubj}</p></div>
            <div className={`${generalAvg >= minPassingGrade ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-xl p-3 text-center`}><p className="text-xs text-slate-500 uppercase font-medium">Promedio General</p><p className={`text-2xl font-bold ${generalAvg >= minPassingGrade ? 'text-green-700' : 'text-red-700'}`}>{generalAvg.toFixed(1)}</p></div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center"><p className="text-xs text-green-500 uppercase font-medium">Mejor Asignatura</p><p className="text-lg font-bold text-green-700">{bestSubj?.subjectName || '-'}</p><p className="text-xs text-green-600">{bestSubj?.average?.toFixed(1)}</p></div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center"><p className="text-xs text-red-500 uppercase font-medium">Menor Rendimiento</p><p className="text-lg font-bold text-red-700">{worstSubj?.subjectName || '-'}</p><p className="text-xs text-red-600">{worstSubj?.average?.toFixed(1)}</p></div>
          </div>
          {chartData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-sm font-medium text-slate-700 mb-3">Promedio por Asignatura</h4>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis domain={[0, scaleMax]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="Promedio" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  {/* Reference line for passing grade */}
                  <CartesianGrid horizontal={false} vertical={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100"><tr>
              <th className="px-3 py-2 text-left">Asignatura</th><th className="px-3 py-2 text-left">Área</th>
              <th className="px-3 py-2 text-center">Promedio</th><th className="px-3 py-2 text-center">Aprobación %</th>
              <th className="px-3 py-2 text-center">Reprobación %</th><th className="px-3 py-2 text-center">Mejor</th>
              <th className="px-3 py-2 text-center">Peor</th><th className="px-3 py-2 text-center">Estudiantes</th>
            </tr></thead>
            <tbody>
              {reportData.results.map((r: any, i: number) => (
                <tr key={i} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{r.subjectName}</td><td className="px-3 py-2 text-slate-500 text-xs">{r.areaName}</td>
                  <td className="px-3 py-2 text-center font-medium">{r.average?.toFixed(1)}</td>
                  <td className="px-3 py-2 text-center text-green-600">{r.approvalRate?.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-center text-red-600">{r.failRate?.toFixed(1)}%</td>
                  <td className="px-3 py-2 text-center">{r.bestGrade?.toFixed(1)}</td>
                  <td className="px-3 py-2 text-center">{r.worstGrade?.toFixed(1)}</td>
                  <td className="px-3 py-2 text-center">{r.totalStudents}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )
    }

    // ── Ranking de estudiantes ──
    if (selectedReport === 'ranking-students' && Array.isArray(reportData) && reportData.length > 0) {
      const rkTotal = reportData.length
      const rkAvg = rkTotal > 0 ? (reportData.reduce((s: number, r: any) => s + (r.average || 0), 0) / rkTotal) : 0
      const rkTop = reportData[0]
      const rkAbovePass = reportData.filter((r: any) => (r.average || 0) >= minPassingGrade).length
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><p className="text-xs text-blue-500 uppercase font-medium">Total Estudiantes</p><p className="text-2xl font-bold text-blue-700">{rkTotal}</p></div>
            <div className={`${rkAvg >= minPassingGrade ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-xl p-3 text-center`}><p className="text-xs text-slate-500 uppercase font-medium">Promedio Grupo</p><p className={`text-2xl font-bold ${rkAvg >= minPassingGrade ? 'text-green-700' : 'text-red-700'}`}>{rkAvg.toFixed(1)}</p></div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center"><p className="text-xs text-amber-500 uppercase font-medium">Mejor Estudiante</p><p className="text-sm font-bold text-amber-700 truncate">{rkTop?.studentName || '-'}</p><p className="text-xs text-amber-600">{rkTop?.average?.toFixed(2)}</p></div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center"><p className="text-xs text-green-500 uppercase font-medium">Aprobados</p><p className="text-2xl font-bold text-green-700">{rkAbovePass}</p><p className="text-xs text-slate-400">{rkTotal - rkAbovePass} por debajo</p></div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100"><tr>
              <th className="px-3 py-2 text-center">Pos.</th><th className="px-3 py-2 text-left">Estudiante</th>
              <th className="px-3 py-2 text-left">Grupo</th><th className="px-3 py-2 text-center">Promedio</th>
              <th className="px-3 py-2 text-center">Asignaturas</th><th className="px-3 py-2 text-center">Desempeño</th>
            </tr></thead>
            <tbody>
              {reportData.map((r: any, i: number) => (
                <tr key={i} className={`border-b hover:bg-slate-50 ${i < 3 ? 'bg-green-50' : ''}`}>
                  <td className="px-3 py-2 text-center font-bold">{r.position}</td>
                  <td className="px-3 py-2 font-medium">{r.studentName}</td>
                  <td className="px-3 py-2">{r.group}</td>
                  <td className="px-3 py-2 text-center font-medium">{r.average?.toFixed(2)}</td>
                  <td className="px-3 py-2 text-center">{r.subjectCount}</td>
                  <td className="px-3 py-2 text-center">{perfBadge(r.performance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )
    }

    // ── Distribución de notas ──
    if (selectedReport === 'grade-distribution' && reportData?.distribution) {
      const max = Math.max(...reportData.distribution.map((d: any) => d.count), 1)
      const pieData = reportData.distribution.filter((d: any) => d.count > 0).map((d: any) => ({ name: d.range, value: d.count }))
      return (
        <div className="space-y-4">
          {reportData.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 rounded-lg p-3 text-center"><p className="text-xs text-slate-500">Promedio</p><p className="text-lg font-bold">{reportData.summary.average?.toFixed(2)}</p></div>
              <div className="bg-slate-50 rounded-lg p-3 text-center"><p className="text-xs text-slate-500">Mediana</p><p className="text-lg font-bold">{reportData.summary.median?.toFixed(2)}</p></div>
              <div className="bg-slate-50 rounded-lg p-3 text-center"><p className="text-xs text-slate-500">Total</p><p className="text-lg font-bold">{reportData.summary.total}</p></div>
              <div className="bg-slate-50 rounded-lg p-3 text-center"><p className="text-xs text-slate-500">Desv. Estándar</p><p className="text-lg font-bold">{reportData.summary.stdDev?.toFixed(2)}</p></div>
            </div>
          )}
          {pieData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-sm font-medium text-slate-700 mb-3">Distribución de Desempeño</h4>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, percent }: any) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}>
                    {pieData.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="space-y-2">
            {reportData.distribution.map((d: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-24 text-sm text-right font-medium">{d.range}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                  <div className={`h-full rounded-full ${getDistBarColor(d.range)}`} style={{ width: `${(d.count / max) * 100}%` }}></div>
                </div>
                <span className="w-12 text-sm text-right">{d.count}</span>
                <span className="w-16 text-xs text-slate-500 text-right">{d.percentage?.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    // ── Nota mínima requerida — individual ──
    if (selectedReport === 'min-grade' && minimumGradeData) {
      return (
        <div className="space-y-4">
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="font-medium text-purple-800 mb-2">Estudiante: {minimumGradeData.student?.lastName} {minimumGradeData.student?.firstName}</h4>
            <p className="text-sm text-purple-600">Grupo: {minimumGradeData.group?.gradeName} {minimumGradeData.group?.name}</p>
            <div className="flex gap-4 mt-2 text-xs">
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded">Aprobadas: {minimumGradeData.summary?.approved || 0}</span>
              <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded">En riesgo: {minimumGradeData.summary?.atRisk || 0}</span>
              <span className="bg-red-100 text-red-700 px-2 py-1 rounded">Imposible: {minimumGradeData.summary?.impossible || 0}</span>
              <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded">Pendientes: {minimumGradeData.summary?.pending || 0}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100"><tr>
                <th className="px-3 py-2 text-left">Asignatura</th><th className="px-3 py-2 text-left">Área</th>
                <th className="px-3 py-2 text-center">Promedio Actual</th><th className="px-3 py-2 text-center">Nota Mínima Requerida</th>
                <th className="px-3 py-2 text-center">Estado</th><th className="px-3 py-2 text-left">Detalle</th>
              </tr></thead>
              <tbody>
                {(minimumGradeData.subjects || []).map((subj: any, idx: number) => (
                  <tr key={idx} className={`border-b hover:bg-slate-50 ${subj.status === 'impossible' ? 'bg-red-50' : subj.status === 'at_risk' ? 'bg-amber-50' : ''}`}>
                    <td className="px-3 py-2 font-medium">{subj.subjectName}</td>
                    <td className="px-3 py-2 text-slate-500 text-xs">{subj.areaName}</td>
                    <td className="px-3 py-2 text-center">{subj.currentAnnualGrade?.toFixed(1) ?? '-'}</td>
                    <td className="px-3 py-2 text-center font-medium">{subj.minimumRequired?.toFixed(1) ?? '-'}</td>
                    <td className="px-3 py-2 text-center"><span className={`px-2 py-1 rounded text-xs ${statusColor(subj.status)}`}>{statusLabel(subj.status)}</span></td>
                    <td className="px-3 py-2 text-xs text-slate-500">{subj.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    // ── Nota mínima requerida — grupo ──
    if (selectedReport === 'min-grade' && minimumGradeGroupData.length > 0) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100"><tr>
              <th className="px-3 py-2 text-left">Nro</th><th className="px-3 py-2 text-left">Estudiante</th>
              <th className="px-3 py-2 text-left">Asignatura Crítica</th><th className="px-3 py-2 text-center">Nota Mínima Requerida</th>
              <th className="px-3 py-2 text-center">Estado</th>
            </tr></thead>
            <tbody>
              {minimumGradeGroupData.map((row, idx) => (
                <tr key={idx} className={`border-b hover:bg-slate-50 ${row.status === 'Imposible' ? 'bg-red-50' : row.status === 'En riesgo' ? 'bg-amber-50' : ''}`}>
                  <td className="px-3 py-2">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium">{row.studentName}</td>
                  <td className="px-3 py-2">{row.subjectName}</td>
                  <td className="px-3 py-2 text-center font-medium">{row.minimumRequired?.toFixed(1) ?? '-'}</td>
                  <td className="px-3 py-2 text-center"><span className={`px-2 py-1 rounded text-xs ${
                    row.status === 'Aprobado' ? 'bg-green-100 text-green-700' : row.status === 'En riesgo' ? 'bg-amber-100 text-amber-700' : row.status === 'Imposible' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                  }`}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    // ── Asignaturas reprobadas ──
    if (selectedReport === 'failed-subjects' && reportData?.results) {
      return (
        <div className="space-y-3">
          {reportData.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-red-50 rounded-lg p-3 text-center"><p className="text-xs text-red-500">Total reprobadas</p><p className="text-lg font-bold text-red-700">{reportData.summary.totalFailed}</p></div>
              <div className="bg-amber-50 rounded-lg p-3 text-center"><p className="text-xs text-amber-500">Estudiantes afectados</p><p className="text-lg font-bold text-amber-700">{reportData.summary.studentsAffected}</p></div>
              <div className="bg-slate-50 rounded-lg p-3 text-center"><p className="text-xs text-slate-500">Tasa reprobación</p><p className="text-lg font-bold">{reportData.summary.failRate?.toFixed(1)}%</p></div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100"><tr>
                <th className="px-3 py-2 text-left">Estudiante</th><th className="px-3 py-2 text-left">Asignatura</th>
                <th className="px-3 py-2 text-left">Área</th><th className="px-3 py-2 text-center">Nota</th>
                <th className="px-3 py-2 text-center">Período</th><th className="px-3 py-2 text-center">Déficit</th>
                <th className="px-3 py-2 text-center">Recuperable</th>
              </tr></thead>
              <tbody>
                {reportData.results.map((r: any, i: number) => (
                  <tr key={i} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{r.studentName}</td><td className="px-3 py-2">{r.subjectName}</td>
                    <td className="px-3 py-2 text-xs text-slate-500">{r.areaName}</td>
                    <td className="px-3 py-2 text-center text-red-600 font-medium">{r.grade?.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center">{r.termName}</td>
                    <td className="px-3 py-2 text-center">{r.deficit?.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center">{r.recoverable ? <span className="text-green-600">Sí</span> : <span className="text-red-600">No</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    // ── Listado de recuperación ──
    if (selectedReport === 'recovery-list' && reportData?.results) {
      const recResults = reportData.results as any[]
      const recTotal = recResults.length
      const recStudents = new Set(recResults.map((r: any) => r.studentName)).size
      const recAvgDeficit = recTotal > 0 ? (recResults.reduce((s: number, r: any) => s + (r.deficit || 0), 0) / recTotal) : 0
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center"><p className="text-xs text-amber-500 uppercase font-medium">Asignaturas a Recuperar</p><p className="text-2xl font-bold text-amber-700">{recTotal}</p></div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><p className="text-xs text-blue-500 uppercase font-medium">Estudiantes</p><p className="text-2xl font-bold text-blue-700">{recStudents}</p></div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center"><p className="text-xs text-red-500 uppercase font-medium">Deficit Promedio</p><p className="text-2xl font-bold text-red-700">{recAvgDeficit.toFixed(1)}</p></div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100"><tr>
              <th className="px-3 py-2 text-left">Estudiante</th><th className="px-3 py-2 text-left">Asignatura</th>
              <th className="px-3 py-2 text-center">Nota</th><th className="px-3 py-2 text-center">Período</th>
              <th className="px-3 py-2 text-center">Déficit</th>
            </tr></thead>
            <tbody>
              {reportData.results.map((r: any, i: number) => (
                <tr key={i} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{r.studentName}</td><td className="px-3 py-2">{r.subjectName}</td>
                  <td className="px-3 py-2 text-center text-amber-600 font-medium">{r.grade?.toFixed(1)}</td>
                  <td className="px-3 py-2 text-center">{r.termName}</td>
                  <td className="px-3 py-2 text-center">{r.deficit?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )
    }

    // ── Proyección de promoción ──
    if (selectedReport === 'promotion-projection' && reportData?.results) {
      const promPieData = reportData.summary ? [
        { name: 'Promueven', value: reportData.summary.promoted, color: PROMOTION_COLORS.promoted },
        { name: 'En riesgo', value: reportData.summary.atRisk, color: PROMOTION_COLORS.atRisk },
        { name: 'No promueven', value: reportData.summary.notPromoted, color: PROMOTION_COLORS.notPromoted },
      ].filter(d => d.value > 0) : []
      return (
        <div className="space-y-3">
          {reportData.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-green-50 rounded-lg p-3 text-center"><p className="text-xs text-green-500">Promueven</p><p className="text-lg font-bold text-green-700">{reportData.summary.promoted}</p></div>
              <div className="bg-amber-50 rounded-lg p-3 text-center"><p className="text-xs text-amber-500">En riesgo</p><p className="text-lg font-bold text-amber-700">{reportData.summary.atRisk}</p></div>
              <div className="bg-red-50 rounded-lg p-3 text-center"><p className="text-xs text-red-500">No promueven</p><p className="text-lg font-bold text-red-700">{reportData.summary.notPromoted}</p></div>
              <div className="bg-slate-50 rounded-lg p-3 text-center"><p className="text-xs text-slate-500">Total</p><p className="text-lg font-bold">{reportData.summary.total}</p></div>
            </div>
          )}
          {promPieData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-sm font-medium text-slate-700 mb-3">Proyección de Promoción</h4>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={promPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="value" label={({ name, percent }: any) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}>
                    {promPieData.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100"><tr>
                <th className="px-3 py-2 text-left">Estudiante</th><th className="px-3 py-2 text-left">Grupo</th>
                <th className="px-3 py-2 text-center">Total Asig.</th><th className="px-3 py-2 text-center">Promueve</th>
                <th className="px-3 py-2 text-center">En Riesgo</th><th className="px-3 py-2 text-center">No Promueve</th>
                <th className="px-3 py-2 text-center">Proyección</th>
              </tr></thead>
              <tbody>
                {reportData.results.map((r: any, i: number) => (
                  <tr key={i} className={`border-b hover:bg-slate-50 ${r.overallProjection === 'NO_PROMUEVE' ? 'bg-red-50' : r.overallProjection === 'EN_RIESGO' ? 'bg-amber-50' : ''}`}>
                    <td className="px-3 py-2 font-medium">{r.studentName}</td><td className="px-3 py-2">{r.group}</td>
                    <td className="px-3 py-2 text-center">{r.totalSubjects}</td>
                    <td className="px-3 py-2 text-center text-green-600">{r.projectedApproved}</td>
                    <td className="px-3 py-2 text-center text-amber-600">{r.atRisk}</td>
                    <td className="px-3 py-2 text-center text-red-600">{r.projectedFailed}</td>
                    <td className="px-3 py-2 text-center"><span className={`px-2 py-1 rounded text-xs ${
                      r.overallProjection === 'PROMUEVE' ? 'bg-green-100 text-green-700' : r.overallProjection === 'EN_RIESGO' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>{r.overallProjection === 'PROMUEVE' ? 'Promueve' : r.overallProjection === 'EN_RIESGO' ? 'En riesgo' : 'No promueve'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    // ── Comparativo de períodos ──
    if (selectedReport === 'comparative' && reportData?.results) {
      const termNames: string[] = reportData.termNames || []
      // Line chart: group averages per term
      const compLineData = (reportData.terms || []).map((t: any, i: number) => ({
        name: t.name,
        'Promedio Grupo': reportData.groupAverages?.[i] ?? null,
      }))
      return (
        <div className="space-y-4">
          {compLineData.length > 1 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-sm font-medium text-slate-700 mb-3">Evolución del Promedio por Período</h4>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={compLineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, scaleMax]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="Promedio Grupo" stroke="#3b82f6" strokeWidth={2} dot={{ r: 5 }} activeDot={{ r: 7 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100"><tr>
              <th className="px-3 py-2 text-left">Estudiante</th><th className="px-3 py-2 text-left">Grupo</th>
              {termNames.map(t => <th key={t} className="px-3 py-2 text-center">{t}</th>)}
              <th className="px-3 py-2 text-center">Tendencia</th>
            </tr></thead>
            <tbody>
              {reportData.results.map((r: any, i: number) => (
                <tr key={i} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{r.studentName}</td><td className="px-3 py-2">{r.group}</td>
                  {(r.termAverages || []).map((avg: any, j: number) => (
                    <td key={j} className="px-3 py-2 text-center">{avg?.toFixed(1) ?? '-'}</td>
                  ))}
                  <td className="px-3 py-2 text-center">{r.trend === 'up' ? '📈' : r.trend === 'down' ? '📉' : '➡️'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )
    }

    // ── Historial académico ──
    if (selectedReport === 'student-history' && reportData?.years) {
      return (
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-800">{reportData.studentName}</h4>
            <p className="text-sm text-blue-600">{reportData.years?.length || 0} años académicos</p>
          </div>
          {reportData.years.map((year: any, yi: number) => (
            <div key={yi} className="border rounded-lg overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 font-medium">{year.yearName} — {year.groupName}</div>
              <table className="w-full text-sm">
                <thead><tr>
                  <th className="px-3 py-1 text-left text-xs">Asignatura</th>
                  {(year.terms || []).map((t: any) => <th key={t.termId} className="px-3 py-1 text-center text-xs">{t.termName}</th>)}
                  <th className="px-3 py-1 text-center text-xs">Final</th>
                </tr></thead>
                <tbody>
                  {(year.subjects || []).map((s: any, si: number) => (
                    <tr key={si} className="border-t">
                      <td className="px-3 py-1">{s.subjectName}</td>
                      {(s.termGrades || []).map((g: any, gi: number) => (
                        <td key={gi} className={`px-3 py-1 text-center ${g != null && isFailed(g) ? 'text-red-600' : ''}`}>{g?.toFixed(1) ?? '-'}</td>
                      ))}
                      <td className="px-3 py-1 text-center font-medium">{s.finalGrade?.toFixed(1) ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )
    }

    // ── Análisis por asignatura ──
    if (selectedReport === 'subject-analysis' && reportData) {
      return (
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-medium text-blue-800">{reportData.subjectName}</h4>
            <p className="text-sm text-blue-600">{reportData.areaName}</p>
          </div>
          {reportData.terms && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {reportData.terms.map((t: any, i: number) => (
                <div key={i} className="bg-slate-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">{t.termName}</p>
                  <p className="text-lg font-bold">{t.average?.toFixed(2)}</p>
                  <p className="text-xs text-slate-400">Aprob: {t.approvalRate?.toFixed(0)}%</p>
                </div>
              ))}
            </div>
          )}
          {reportData.students && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100"><tr>
                  <th className="px-3 py-2 text-left">Estudiante</th><th className="px-3 py-2 text-center">Promedio</th><th className="px-3 py-2 text-center">Desempeño</th>
                </tr></thead>
                <tbody>
                  {reportData.students.map((s: any, i: number) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{s.studentName}</td>
                      <td className="px-3 py-2 text-center">{s.average?.toFixed(1)}</td>
                      <td className="px-3 py-2 text-center">{perfBadge(s.performance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )
    }

    // ── Rendimiento por docente ──
    if (selectedReport === 'teacher-performance' && reportData?.results) {
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100"><tr>
              <th className="px-3 py-2 text-left">Docente</th><th className="px-3 py-2 text-left">Asignatura</th>
              <th className="px-3 py-2 text-left">Grupo</th><th className="px-3 py-2 text-center">Promedio</th>
              <th className="px-3 py-2 text-center">Aprobación %</th><th className="px-3 py-2 text-center">Estudiantes</th>
            </tr></thead>
            <tbody>
              {reportData.results.map((r: any, i: number) => (
                <tr key={i} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{r.teacherName}</td><td className="px-3 py-2">{r.subjectName}</td>
                  <td className="px-3 py-2">{r.groupName}</td>
                  <td className="px-3 py-2 text-center font-medium">{r.average?.toFixed(1) ?? '-'}</td>
                  <td className="px-3 py-2 text-center">{r.approvalRate?.toFixed(1) ?? '-'}%</td>
                  <td className="px-3 py-2 text-center">{r.totalStudents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    return (
      <div className="text-center py-12 text-slate-500">
        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Seleccione los filtros y haga clic en "Buscar" para generar el reporte</p>
      </div>
    )
  }

  // ─── Vista de selección de reporte (bloques) ──────────────────────────
  if (!showReport) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/reports" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Reportes Académicos</h1>
              <p className="text-sm text-slate-500">Promedios, consolidados y rendimiento estudiantil</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {reportBlocks.map(block => {
            const bs = BLOCK_STYLES[block.color]
            const BlockIcon = block.icon
            return (
              <div key={block.id} className={`${bs.bg} border ${bs.border} rounded-xl p-5`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 ${bs.iconBg} rounded-lg flex items-center justify-center`}>
                    <BlockIcon className={`w-5 h-5 ${bs.iconText}`} />
                  </div>
                  <div>
                    <h2 className={`font-semibold ${bs.text}`}>{block.title}</h2>
                    <p className="text-xs text-slate-500">{block.description}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {block.reports.map(report => (
                    <button key={report.id} onClick={() => handleSelectReport(report.id)}
                      className={`p-3 bg-white rounded-lg border border-slate-200 ${bs.cardHover} hover:shadow-md transition-all text-left`}>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-8 h-8 ${bs.iconBg} rounded flex items-center justify-center`}>
                          <report.icon className={`w-4 h-4 ${bs.iconText}`} />
                        </div>
                        <h3 className="font-medium text-slate-900 text-sm">{report.name}</h3>
                      </div>
                      <p className="text-xs text-slate-500 ml-10">{report.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ─── Vista de reporte seleccionado ─────────────────────────────────────
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 ${style.iconBg} rounded-lg flex items-center justify-center`}>
              {currentMeta && <currentMeta.icon className={`w-5 h-5 ${style.iconText}`} />}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{currentMeta?.name}</h2>
              <p className="text-sm text-slate-500">{currentMeta?.description}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToCSV} className={`flex items-center gap-2 px-3 py-2 ${style.btnBg} text-white rounded-lg ${style.btnHover} text-sm`}>
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
        </div>
      </div>

      {renderFilters()}

      {/* Información de escala institucional */}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500 px-1">
        {isDimensionsMode ? (
          <>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
              Estructura: <strong className="text-purple-700">Dimensiones del desarrollo (Preescolar)</strong>
            </span>
            <span className="flex items-center gap-1 italic">
              Evaluación cualitativa — Sin promedios numéricos
            </span>
            {qualitativeLevels.length > 0 && (
              <span className="flex items-center gap-1">
                Niveles: {qualitativeLevels.sort((a, b) => a.order - b.order).map(l => l.name).join(' · ')}
              </span>
            )}
          </>
        ) : (
          <>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
              Escala: <strong className="text-slate-700">{scaleMin} – {scaleMax}</strong>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Nota mínima aprobatoria: <strong className="text-slate-700">{minPassingGrade}</strong>
            </span>
            {gradingScale.performanceLevels.length > 0 && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                Niveles: {gradingScale.performanceLevels.sort((a, b) => a.order - b.order).map(l => `${l.name} (${l.minScore}–${l.maxScore})`).join(' · ')}
              </span>
            )}
            {gradingScale.performanceLevels.length === 0 && (
              <span className="flex items-center gap-1 italic">
                Clasificación por porcentaje: Superior ≥85% · Alto 70–84% · Básico 50–69% · Bajo &lt;50%
              </span>
            )}
          </>
        )}
      </div>

      <div className="mt-4 bg-white rounded-xl border border-slate-200 p-4">
        {renderReportTable()}
      </div>
    </div>
  )
}
