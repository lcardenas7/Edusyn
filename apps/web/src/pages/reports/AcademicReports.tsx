import React, { useState } from 'react'
import {
  BookOpen, Users, GraduationCap, ClipboardList, BarChart3, Download,
  ArrowLeft, ChevronLeft, Calculator, TrendingUp, FileText, AlertTriangle,
  History, UserCheck, FileSpreadsheet, Building, CheckCircle, Eye, ChevronDown, ChevronUp, RefreshCw
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts'
import { useReportsData } from '../../hooks/useReportsData'
import { useAuth } from '../../contexts/AuthContext'
import { teacherAssignmentsApi, periodFinalGradesApi, reportsApi } from '../../lib/api'
import { useSortable, SortableHeader } from '../../components/reports/SortableTable'

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
      { id: 'cons-areas', name: 'Consolidado por áreas', description: 'Promedio por área de cada estudiante en vista matricial', icon: FileSpreadsheet },
      { id: 'avg-subject', name: 'Promedio por asignatura', description: '¿Qué asignatura tiene mejor o peor rendimiento?', icon: BookOpen },
      { id: 'avg-area', name: 'Promedio por áreas', description: '¿Qué área tiene mejor o peor rendimiento?', icon: FileSpreadsheet },
      { id: 'ranking-students', name: 'Ranking de estudiantes', description: '¿Quiénes son los mejores y peores del grupo?', icon: TrendingUp },
      { id: 'ranking-institutional', name: 'Ranking institucional', description: 'Ranking de toda la institución, por grado o nivel educativo', icon: Users },
      { id: 'honor-roll', name: 'Top 5 por grado', description: 'Ranking de los 5 mejores estudiantes de cada grado', icon: TrendingUp },
      { id: 'grade-distribution', name: 'Estudiantes por nivel', description: 'Cuántos estudiantes hay en cada nivel de desempeño por curso o grado', icon: BarChart3 },
      { id: 'subject-level-dist', name: 'Niveles por asignatura', description: 'Cantidad y % de estudiantes en Bajo/Básico/Alto/Superior para cada asignatura', icon: BarChart3 },
    ],
  },
  {
    id: 'riesgo', title: 'Riesgo Académico',
    description: 'Alertas, reprobaciones y proyecciones de riesgo', color: 'amber', icon: AlertTriangle,
    reports: [
      { id: 'min-grade', name: 'Nota mínima requerida', description: 'Nota necesaria en períodos restantes para aprobar', icon: Calculator },
      { id: 'min-grade-consolidated', name: 'Consolidado nota mínima', description: 'Matriz de todas las asignaturas por estudiante con notas necesarias', icon: ClipboardList },
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
  {
    id: 'institucional', title: 'Institucional',
    description: 'Estadísticas globales y comparativos anuales', color: 'blue', icon: Building,
    reports: [
      { id: 'institutional-stats', name: 'Consolidado institucional', description: 'Estadísticas de todos los grupos por nivel educativo', icon: BarChart3 },
      { id: 'annual-comparison', name: 'Comparativo anual', description: 'Evolución de métricas entre años académicos', icon: TrendingUp },
    ],
  },
  {
    id: 'gestion', title: 'Gestión y Seguimiento',
    description: 'Estado de completitud, faltantes de notas y logros', color: 'purple', icon: CheckCircle,
    reports: [
      { id: 'completeness-status', name: 'Estado de Completitud', description: 'Identifica qué grupos/asignaturas faltan por notas y logros', icon: Eye },
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
  const [filterGradeId, setFilterGradeId] = useState('all')
  const [honorRollTopN, setHonorRollTopN] = useState(5)
  const [honorRollMode, setHonorRollMode] = useState<'both' | 'separate' | 'integral'>('both')
  const [gradeDistMode, setGradeDistMode] = useState<'both' | 'separate' | 'integral'>('both')
  const [showOnlyFailed, setShowOnlyFailed] = useState(false)
  const [showGrades, setShowGrades] = useState(true)
  const [showPerformance, setShowPerformance] = useState(false)
  const [decimalPlaces, setDecimalPlaces] = useState('1')

  // Datos genéricos del reporte activo + legacy states
  const [reportData, setReportData] = useState<any>(null)
  const [studentsGradesData, setStudentsGradesData] = useState<any[]>([])
  const [minimumGradeData, setMinimumGradeData] = useState<any>(null)
  const [minimumGradeGroupData, setMinimumGradeGroupData] = useState<any[]>([])
  const [comparisonYearIds, setComparisonYearIds] = useState<string[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set())
  const [reSnapshotLoading, setReSnapshotLoading] = useState(false)

  // Ordenamiento dinámico compartido (se resetea al cambiar de reporte)
  const { sortData, sortState, handleSort } = useSortable<any>()
  React.useEffect(() => {
    // reset sort al cambiar reporte
    if (sortState.sortColumn) handleSort(sortState.sortColumn) // toggle to reset
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReport])

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
                  name: student ? [student.lastName, student.secondLastName, student.firstName, student.secondName].filter(Boolean).join(' ').toUpperCase() : 'Estudiante',
                  group: g.studentEnrollment?.group ? `${g.studentEnrollment.group.grade?.name || ''} ${g.studentEnrollment.group.name}`.trim() : '',
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
        case 'cons-areas': {
          if (filterGrade === 'all') break
          const res = await reportsApi.getAreaConsolidated(filterYear, filterGrade, filterPeriod || undefined)
          setReportData(res.data)
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
        case 'avg-area': {
          const res = await reportsApi.getAreaAverages(filterYear, {
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
        case 'ranking-institutional': {
          const params: any = {}
          if (filterPeriod) params.termId = filterPeriod
          if (filterGrade !== 'all') params.groupId = filterGrade
          else if (filterGradeId !== 'all') params.gradeId = filterGradeId
          else if (filterLevel !== 'all') params.stage = filterLevel
          const res = await reportsApi.getInstitutionalRanking(filterYear, params)
          setReportData(res.data)
          break
        }
        case 'honor-roll': {
          const params: any = {}
          if (filterPeriod) params.termId = filterPeriod
          if (filterGrade !== 'all') params.groupId = filterGrade
          else if (filterGradeId !== 'all') params.gradeId = filterGradeId
          else if (filterLevel !== 'all') params.stage = filterLevel
          const res = await reportsApi.getInstitutionalRanking(filterYear, params)
          const results = res.data?.results || []
          const topN = honorRollTopN
          let honorRoll: any[]
          let gradeIntegral: any[] | null = null
          if (filterGrade !== 'all') {
            const g = groups.find((g: any) => g.id === filterGrade)
            const label = g ? `${g.grade?.name || ''} ${g.name}`.trim() : 'Curso'
            honorRoll = [{ gradeName: label, students: [...results].sort((a: any, b: any) => (b.average || 0) - (a.average || 0)).slice(0, topN) }]
          } else if (filterGradeId !== 'all') {
            const byGroup = new Map<string, any[]>()
            results.forEach((r: any) => {
              const key = r.group || 'Sin curso'
              if (!byGroup.has(key)) byGroup.set(key, [])
              byGroup.get(key)!.push(r)
            })
            honorRoll = Array.from(byGroup.entries())
              .sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true }))
              .map(([groupName, students]) => ({
                gradeName: groupName,
                students: [...students].sort((a: any, b: any) => (b.average || 0) - (a.average || 0)).slice(0, topN),
              }))
            gradeIntegral = [...results].sort((a: any, b: any) => (b.average || 0) - (a.average || 0)).slice(0, topN)
          } else {
            const byGrade = new Map<string, any[]>()
            results.forEach((r: any) => {
              const gradeKey = r.grade || r.group?.split(' ')[0] || 'Sin grado'
              if (!byGrade.has(gradeKey)) byGrade.set(gradeKey, [])
              byGrade.get(gradeKey)!.push(r)
            })
            honorRoll = Array.from(byGrade.entries()).map(([gradeName, students]) => ({
              gradeName,
              students: [...students].sort((a: any, b: any) => (b.average || 0) - (a.average || 0)).slice(0, topN),
            }))
          }
          setReportData({ ...res.data, honorRoll, gradeIntegral })
          break
        }
        case 'grade-distribution': {
          if (filterGrade !== 'all') {
            const res = await reportsApi.getGradeDistribution(filterYear, filterGrade, {
              subjectId: filterSubject !== 'all' ? filterSubject : undefined,
              termId: filterPeriod || undefined,
            })
            setReportData(res.data)
          } else if (filterGradeId !== 'all') {
            const gradeGroups = groups.filter((g: any) => g.grade?.id === filterGradeId)
              .sort((a: any, b: any) => (`${a.grade?.name} ${a.name}`).localeCompare(`${b.grade?.name} ${b.name}`, 'es', { numeric: true }))
            if (gradeGroups.length === 0) break
            const groupResults = await Promise.all(
              gradeGroups.map(async (g: any) => {
                const res = await reportsApi.getGradeDistribution(filterYear, g.id, {
                  subjectId: filterSubject !== 'all' ? filterSubject : undefined,
                  termId: filterPeriod || undefined,
                })
                return { groupId: g.id, groupName: `${g.grade?.name || ''} ${g.name}`.trim(), ...res.data }
              })
            )
            const allDists = groupResults.filter((r: any) => r.distribution)
            const ranges: string[] = allDists[0]?.distribution?.map((d: any) => d.range) || []
            const totalStudents = allDists.reduce((s: number, r: any) => s + (r.summary?.total || 0), 0)
            const gradeIntegral = {
              distribution: ranges.map((range: string) => {
                const count = allDists.reduce((s: number, r: any) => s + (r.distribution?.find((d: any) => d.range === range)?.count || 0), 0)
                return { range, count, percentage: totalStudents > 0 ? (count / totalStudents) * 100 : 0 }
              }),
              summary: {
                total: totalStudents,
                average: allDists.length > 0 ? allDists.reduce((s: number, r: any) => s + (r.summary?.average || 0), 0) / allDists.length : 0,
                median: null, stdDev: null,
              },
            }
            setReportData({ byGroup: groupResults, gradeIntegral })
          }
          break
        }
        case 'subject-level-dist': {
          const sldParams: any = {}
          if (filterGrade !== 'all') sldParams.groupId = filterGrade
          else if (filterGradeId !== 'all') sldParams.gradeId = filterGradeId
          else if (filterLevel !== 'all') sldParams.stage = filterLevel
          if (filterPeriod) sldParams.termId = filterPeriod
          const res = await reportsApi.getSubjectLevelDistribution(filterYear, sldParams)
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
        case 'min-grade-consolidated': {
          if (!filterGrade || filterGrade === 'all') break
          const res = await reportsApi.getMinGradeConsolidated(filterYear, filterGrade)
          setReportData(res.data)
          break
        }
        case 'completeness-status': {
          const res = await reportsApi.getCompletenessStatus(filterYear, filterPeriod || undefined)
          setReportData(res.data)
          setExpandedGroups(new Set())
          setExpandedSubjects(new Set())
          break
        }
        case 'institutional-stats': {
          const res = await reportsApi.getInstitutionalStatistics(filterYear, filterPeriod || undefined)
          setReportData(res.data)
          break
        }
        case 'annual-comparison': {
          if (comparisonYearIds.length < 1) break
          const res = await reportsApi.getAnnualComparison(comparisonYearIds)
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
    } else if (selectedReport === 'ranking-students' && reportData?.results) {
      csvContent = 'Posición,Estudiante,Grupo,Promedio,Asignaturas,Desempeño\n'
      reportData.results.forEach((r: any) => {
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
    } else if (selectedReport === 'min-grade-consolidated' && reportData?.students) {
      const rTerms = reportData.terms || []
      const rSubjects = reportData.subjectColumns || []
      const rStudents = reportData.students || []
      // Header: Nro, Estudiante, then for each subject: Period1..PeriodN, Necesita
      const subHeaders = rSubjects.flatMap((s: any) => [
        ...rTerms.map((t: any) => `"${s.subjectName} - ${t.name}"`),
        `"${s.subjectName} - Necesita"`,
      ])
      csvContent = `Nro,Estudiante,${subHeaders.join(',')},Promedio,Reprobadas\n`
      rStudents.forEach((st: any, idx: number) => {
        const cells = (st.subjects || []).flatMap((subj: any) => [
          ...(subj.termGrades || []).map((tg: any) => tg.grade !== null ? tg.grade.toFixed(1) : '-'),
          subj.status === 'approved' ? '—' : subj.minimumRequired !== null ? subj.minimumRequired.toFixed(1) : '-',
        ])
        csvContent += `${idx + 1},"${st.studentName}",${cells.join(',')},${st.generalAverage?.toFixed(1) ?? '-'},${st.totalFailed}\n`
      })
    } else if (selectedReport === 'cons-areas' && reportData?.students) {
      const caCols = reportData.areaCols || []
      const caStudents = reportData.students || []
      csvContent = `Nro,Estudiante,${caCols.map((c: any) => `"${c.areaName}"`).join(',')},Promedio,Áreas Reprobadas\n`
      caStudents.forEach((st: any, idx: number) => {
        const grades = (st.areaGrades || []).map((ag: any) => ag.average !== null ? ag.average.toFixed(1) : '-').join(',')
        csvContent += `${idx + 1},"${st.studentName}",${grades},${st.generalAverage?.toFixed(1) ?? '-'},${st.failedAreas}\n`
      })
    } else if (selectedReport === 'avg-area' && reportData?.results) {
      csvContent = 'Área,Promedio,Aprobación %,Reprobación %,Asignaturas\n'
      reportData.results.forEach((r: any) => {
        csvContent += `"${r.areaName}",${r.average?.toFixed(1) ?? '-'},${r.approvalRate?.toFixed(1) ?? '-'},${r.failRate?.toFixed(1) ?? '-'},${r.subjectCount}\n`
      })
    } else if (selectedReport === 'ranking-institutional' && reportData?.results) {
      csvContent = 'Posición,Estudiante,Grupo,Promedio,Asignaturas,Desempeño\n'
      reportData.results.forEach((r: any) => {
        csvContent += `${r.position},"${r.studentName}","${r.group}",${r.average?.toFixed(2) ?? '-'},${r.subjectCount},"${r.performance}"\n`
      })
    } else if (selectedReport === 'comparative' && reportData?.results) {
      const termNames = reportData.termNames || []
      csvContent = `Estudiante,Grupo,${termNames.map((t: string) => `"${t}"`).join(',')},Tendencia\n`
      reportData.results.forEach((r: any) => {
        const avgs = (r.termAverages || []).map((a: any) => a?.toFixed(1) ?? '-').join(',')
        csvContent += `"${r.studentName}","${r.group}",${avgs},"${r.trend === 'up' ? 'Sube' : r.trend === 'down' ? 'Baja' : 'Estable'}"\n`
      })
    } else if (selectedReport === 'student-history' && reportData?.years) {
      csvContent = `Historial Académico: ${reportData.studentName}\n\n`
      reportData.years.forEach((year: any) => {
        const termHeaders = (year.terms || []).map((t: any) => `"${t.termName}"`).join(',')
        csvContent += `"${year.yearName} - ${year.groupName}"\nAsignatura,${termHeaders},Final\n`
        ;(year.subjects || []).forEach((s: any) => {
          const tGrades = (s.termGrades || []).map((g: any) => g?.toFixed(1) ?? '-').join(',')
          csvContent += `"${s.subjectName}",${tGrades},${s.finalGrade?.toFixed(1) ?? '-'}\n`
        })
        csvContent += '\n'
      })
    } else if (selectedReport === 'subject-analysis' && reportData?.students) {
      csvContent = `Análisis: ${reportData.subjectName} (${reportData.areaName})\n\nEstudiante,Promedio,Desempeño\n`
      reportData.students.forEach((s: any) => {
        csvContent += `"${s.studentName}",${s.average?.toFixed(1) ?? '-'},"${s.performance}"\n`
      })
    } else if (selectedReport === 'institutional-stats' && reportData?.institutional) {
      const inst = reportData.institutional
      csvContent = `Promedio Institucional,${inst.average}\nAprobación %,${inst.approvalRate}\nEstudiantes,${inst.totalStudents}\nGrupos,${inst.totalGroups}\n\n`
      csvContent += 'Nivel Educativo,Promedio,Aprobación %,Estudiantes,Grupos\n'
      ;(reportData.stages || []).forEach((s: any) => {
        csvContent += `"${s.stageLabel}",${s.average},${s.approvalRate},${s.totalStudents},${s.totalGroups}\n`
        if (s.groupRanking) {
          s.groupRanking.forEach((g: any, i: number) => {
            csvContent += `"  ${i + 1}. ${g.groupName}",${g.average},${g.approvalRate}%,${g.totalStudents},\n`
          })
        }
      })
    } else if (selectedReport === 'annual-comparison' && reportData?.results) {
      csvContent = 'Año,Promedio,Δ Prom.,Aprobación %,Δ Aprob.,Estudiantes,Δ Est.,Grupos\n'
      reportData.results.forEach((yr: any) => {
        csvContent += `"${yr.yearName}",${yr.average},${yr.avgVariation ?? '-'},${yr.approvalRate}%,${yr.approvalVariation !== null ? yr.approvalVariation + '%' : '-'},${yr.totalStudents},${yr.studentVariation ?? '-'},${yr.totalGroups}\n`
      })
    } else if (selectedReport === 'completeness-status' && reportData?.groups) {
      csvContent = 'Grupo,Asignatura,Docente,Notas %,Logros %\n'
      ;(reportData.groups || []).forEach((g: any) => {
        ;(g.subjects || []).forEach((s: any) => {
          csvContent += `"${g.groupName}","${s.subjectName}","${s.teacherName}",${s.gradeCompleteness}%,${s.achievementCompleteness}%\n`
        })
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

  const exportToPDF = () => {
    if (!selectedReport) return

    const pdfReports = new Set([
      'min-grade',
      'min-grade-consolidated',
      'failed-subjects',
      'recovery-list',
      'promotion-projection',
      'cons-subjects',
      'cons-areas',
      'avg-subject',
      'avg-area',
      'ranking-students',
      'ranking-institutional',
      'teacher-performance',
      'institutional-stats',
      'annual-comparison',
      'completeness-status',
    ])

    if (!pdfReports.has(selectedReport)) {
      window.print()
      return
    }

    const hasData = (() => {
      switch (selectedReport) {
        case 'min-grade':
          return Boolean(minimumGradeData?.subjects?.length || minimumGradeGroupData.length)
        case 'min-grade-consolidated':
          return Boolean(reportData?.students?.length)
        case 'failed-subjects':
        case 'recovery-list':
        case 'promotion-projection':
        case 'avg-subject':
        case 'avg-area':
        case 'ranking-students':
        case 'ranking-institutional':
        case 'teacher-performance':
        case 'annual-comparison':
          return Boolean(reportData?.results?.length)
        case 'cons-subjects':
          return Boolean(studentsGradesData.length)
        case 'cons-areas':
          return Boolean(reportData?.students?.length)
        case 'institutional-stats':
          return Boolean(reportData?.institutional)
        case 'completeness-status':
          return Boolean(reportData?.groups?.length)
        default:
          return false
      }
    })()

    if (!hasData) {
      alert('No hay datos para exportar en PDF')
      return
    }

    const wideReports = new Set([
      'min-grade-consolidated',
      'cons-subjects',
      'cons-areas',
      'avg-subject',
      'avg-area',
      'ranking-students',
      'ranking-institutional',
      'teacher-performance',
      'institutional-stats',
      'annual-comparison',
      'completeness-status',
    ])

    const doc = new jsPDF({ orientation: wideReports.has(selectedReport) ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 12

    const addTitle = (title: string, subtitle: string[] = []) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(16)
      doc.text(title, margin, 16)
      if (subtitle.length > 0) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        subtitle.forEach((line, index) => {
          doc.text(line, margin, 22 + index * 4)
        })
        return 24 + subtitle.length * 4
      }
      return 24
    }

    const addTable = (head: string[][], body: (string | number)[][], startY: number) => {
      autoTable(doc, {
        head,
        body,
        startY,
        margin: { left: margin, right: margin },
        styles: { fontSize: 7, cellPadding: 1.3, overflow: 'linebreak', valign: 'middle' },
        headStyles: { fillColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        didDrawPage: () => {
          doc.setFontSize(8)
          doc.setTextColor(100)
          doc.text(`${institution?.name || 'Edusyn'} • Página ${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 8, { align: 'right' })
          doc.setTextColor(0)
        },
      })
      return (doc as any).lastAutoTable?.finalY || startY
    }

    const subtitle = [
      `Reporte: ${currentMeta?.name || selectedReport}`,
      `Generado: ${new Date().toLocaleString('es-CO')}`,
      filterYear !== 'all' ? `Año: ${academicYears.find(y => y.id === filterYear)?.year || filterYear}` : null,
      filterPeriod !== 'all' ? `Período: ${terms.find(t => t.id === filterPeriod)?.name || filterPeriod}` : null,
      filterGrade !== 'all' ? `Grupo: ${groups.find(g => g.id === filterGrade)?.name || filterGrade}` : null,
      filterSubject !== 'all' ? `Asignatura: ${subjects.find(s => s.id === filterSubject)?.name || filterSubject}` : null,
      filterTeacher !== 'all' ? `Docente: ${(() => {
        const t = teachers.find(x => x.id === filterTeacher)
        return t ? `${t.firstName || ''} ${t.lastName || ''}`.trim() : filterTeacher
      })()}` : null,
    ].filter((v): v is string => Boolean(v))

    let startY = addTitle(currentMeta?.name || 'Reporte académico', subtitle)

    if (selectedReport === 'min-grade') {
      if (minimumGradeData?.subjects?.length > 0) {
        const body = minimumGradeData.subjects.map((subj: any) => [
          subj.subjectName,
          subj.areaName,
          subj.currentAnnualGrade != null ? subj.currentAnnualGrade.toFixed(1) : '-',
          subj.minimumRequired != null ? subj.minimumRequired.toFixed(1) : '-',
          subj.status,
          subj.message,
        ])
        addTable([['Asignatura', 'Área', 'Promedio actual', 'Nota mínima requerida', 'Estado', 'Detalle']], body, startY)
      } else if (minimumGradeGroupData.length > 0) {
        const body = minimumGradeGroupData.map((row: any, index: number) => [
          String(index + 1),
          row.studentName,
          row.subjectName,
          row.minimumRequired != null ? row.minimumRequired.toFixed(1) : '-',
          row.status,
        ])
        addTable([['Nro', 'Estudiante', 'Asignatura crítica', 'Nota mínima requerida', 'Estado']], body, startY)
      }
    } else if (selectedReport === 'min-grade-consolidated' && reportData?.students) {
      const rTerms = reportData.terms || []
      const rSubjects = reportData.subjectColumns || []
      const head = ['Nro', 'Estudiante']
      rSubjects.forEach((s: any) => {
        rTerms.forEach((t: any) => head.push(`${s.subjectName} - ${t.name}`))
        head.push(`${s.subjectName} - Necesita`)
      })
      head.push('Promedio', 'Reprobadas')
      const body = reportData.students.map((st: any, index: number) => {
        const cells = (st.subjects || []).flatMap((subj: any) => [
          ...(subj.termGrades || []).map((tg: any) => tg.grade != null ? tg.grade.toFixed(1) : '-'),
          subj.status === 'approved' ? '—' : subj.minimumRequired != null ? subj.minimumRequired.toFixed(1) : '-',
        ])
        return [String(index + 1), st.studentName, ...cells, st.generalAverage != null ? st.generalAverage.toFixed(1) : '-', String(st.totalFailed ?? 0)]
      })
      addTable([head], body, startY)
    } else if (selectedReport === 'failed-subjects' && reportData?.results) {
      const body = reportData.results.map((r: any) => [
        r.studentName,
        r.subjectName,
        r.areaName,
        r.grade != null ? Number(r.grade).toFixed(1) : '-',
        r.termName,
        r.deficit != null ? Number(r.deficit).toFixed(1) : '-',
        r.recoverable ? 'Sí' : 'No',
      ])
      addTable([['Estudiante', 'Asignatura', 'Área', 'Nota', 'Período', 'Déficit', 'Recuperable']], body, startY)
    } else if (selectedReport === 'recovery-list' && reportData?.results) {
      const body = reportData.results.map((r: any) => [
        r.studentName,
        r.subjectName,
        r.grade != null ? Number(r.grade).toFixed(1) : '-',
        r.termName,
        r.deficit != null ? Number(r.deficit).toFixed(1) : '-',
      ])
      addTable([['Estudiante', 'Asignatura', 'Nota', 'Período', 'Déficit']], body, startY)
    } else if (selectedReport === 'promotion-projection' && reportData?.results) {
      const body = reportData.results.map((r: any) => [
        r.studentName,
        r.group,
        String(r.totalSubjects ?? 0),
        String(r.projectedApproved ?? 0),
        String(r.atRisk ?? 0),
        String(r.projectedFailed ?? 0),
        r.overallProjection,
      ])
      addTable([['Estudiante', 'Grupo', 'Total Asig.', 'Promueve', 'En Riesgo', 'No Promueve', 'Proyección']], body, startY)
    } else if (selectedReport === 'teacher-performance' && reportData?.results) {
      const body = reportData.results.map((r: any) => [
        r.teacherName,
        r.subjectName,
        r.groupName,
        r.average != null ? Number(r.average).toFixed(1) : '-',
        r.approvalRate != null ? Number(r.approvalRate).toFixed(1) : '-',
        String(r.totalStudents ?? 0),
      ])
      addTable([['Docente', 'Asignatura', 'Grupo', 'Promedio', 'Aprobación %', 'Estudiantes']], body, startY)
    } else if (selectedReport === 'avg-subject' && reportData?.results) {
      const body = reportData.results.map((r: any) => [
        r.subjectName,
        r.areaName,
        r.average != null ? Number(r.average).toFixed(1) : '-',
        r.approvalRate != null ? Number(r.approvalRate).toFixed(1) : '-',
        r.failRate != null ? Number(r.failRate).toFixed(1) : '-',
        r.bestGrade != null ? Number(r.bestGrade).toFixed(1) : '-',
        r.worstGrade != null ? Number(r.worstGrade).toFixed(1) : '-',
        String(r.totalStudents ?? 0),
      ])
      addTable([['Asignatura', 'Área', 'Promedio', 'Aprobación %', 'Reprobación %', 'Mejor', 'Peor', 'Estudiantes']], body, startY)
    } else if (selectedReport === 'avg-area' && reportData?.results) {
      const body = reportData.results.map((r: any) => [
        r.areaName,
        r.average != null ? Number(r.average).toFixed(1) : '-',
        r.approvalRate != null ? Number(r.approvalRate).toFixed(1) : '-',
        r.failRate != null ? Number(r.failRate).toFixed(1) : '-',
        String(r.subjectCount ?? 0),
      ])
      addTable([['Área', 'Promedio', 'Aprobación %', 'Reprobación %', 'Asignaturas']], body, startY)
    } else if (selectedReport === 'ranking-students' && reportData?.results) {
      const body = reportData.results.map((r: any) => [
        String(r.position ?? ''),
        r.studentName,
        r.group,
        r.average != null ? Number(r.average).toFixed(2) : '-',
        String(r.subjectCount ?? 0),
        r.performance,
      ])
      addTable([['Posición', 'Estudiante', 'Grupo', 'Promedio', 'Asignaturas', 'Desempeño']], body, startY)
    } else if (selectedReport === 'ranking-institutional' && reportData?.results) {
      const body = reportData.results.map((r: any) => [
        String(r.position ?? ''),
        r.studentName,
        r.group,
        r.average != null ? Number(r.average).toFixed(2) : '-',
        String(r.subjectCount ?? 0),
        r.performance,
      ])
      addTable([['Posición', 'Estudiante', 'Grupo', 'Promedio', 'Asignaturas', 'Desempeño']], body, startY)
    } else if (selectedReport === 'cons-subjects' && studentsGradesData.length > 0) {
      const allSubjects = new Set<string>()
      studentsGradesData.forEach(s => Object.keys(s.grades).forEach(subj => allSubjects.add(subj)))
      const subjectList = Array.from(allSubjects)
      const head = ['Nro', 'Estudiante', 'Grupo', ...subjectList, 'Promedio', 'Reprobadas', 'Desempeño']
      const body = studentsGradesData.map((row, index) => [
        String(index + 1),
        row.name,
        row.group,
        ...subjectList.map(subj => row.grades[subj] != null ? row.grades[subj].toFixed(parseInt(decimalPlaces)) : '-'),
        row.average != null ? row.average.toFixed(parseInt(decimalPlaces)) : '-',
        String(row.failedCount ?? 0),
        row.performance,
      ])
      addTable([head], body, startY)
    } else if (selectedReport === 'cons-areas' && reportData?.students) {
      const areaCols = reportData.areaCols || []
      const head = ['Nro', 'Estudiante', ...areaCols.map((c: any) => c.areaName), 'Promedio', 'Áreas reprobadas']
      const body = reportData.students.map((st: any, index: number) => [
        String(index + 1),
        st.studentName,
        ...(st.areaGrades || []).map((ag: any) => ag.average != null ? ag.average.toFixed(1) : '-'),
        st.generalAverage != null ? st.generalAverage.toFixed(1) : '-',
        String(st.failedAreas ?? 0),
      ])
      addTable([head], body, startY)
    } else if (selectedReport === 'institutional-stats' && reportData?.institutional) {
      const inst = reportData.institutional
      const summaryBody = [
        ['Promedio institucional', inst.average != null ? Number(inst.average).toFixed(1) : '-'],
        ['Aprobación %', inst.approvalRate != null ? Number(inst.approvalRate).toFixed(1) : '-'],
        ['Estudiantes', String(inst.totalStudents ?? 0)],
        ['Grupos', String(inst.totalGroups ?? 0)],
      ]
      const firstY = addTable([['Métrica', 'Valor']], summaryBody, startY)
      const stages = reportData.stages || []
      if (stages.length > 0) {
        let stageY = firstY + 8
        stages.forEach((stage: any) => {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(11)
          doc.text(stage.stageLabel, margin, stageY)
          stageY += 2
          const stageBody = [
            ['Promedio', stage.average != null ? Number(stage.average).toFixed(1) : '-'],
            ['Aprobación %', stage.approvalRate != null ? Number(stage.approvalRate).toFixed(1) : '-'],
            ['Estudiantes', String(stage.totalStudents ?? 0)],
            ['Grupos', String(stage.totalGroups ?? 0)],
          ]
          stageY = addTable([['Métrica', 'Valor']], stageBody, stageY) + 8
        })
      }
    } else if (selectedReport === 'annual-comparison' && reportData?.results) {
      const body = reportData.results.map((yr: any) => [
        yr.yearName,
        yr.average != null ? Number(yr.average).toFixed(1) : '-',
        yr.avgVariation != null ? String(yr.avgVariation) : '-',
        yr.approvalRate != null ? `${Number(yr.approvalRate).toFixed(1)}%` : '-',
        yr.approvalVariation != null ? `${yr.approvalVariation}%` : '-',
        String(yr.totalStudents ?? 0),
        yr.studentVariation != null ? String(yr.studentVariation) : '-',
        String(yr.totalGroups ?? 0),
      ])
      addTable([['Año', 'Promedio', 'Δ Prom.', 'Aprobación %', 'Δ Aprob.', 'Estudiantes', 'Δ Est.', 'Grupos']], body, startY)
    } else if (selectedReport === 'completeness-status' && reportData?.groups) {
      const body = (reportData.groups || []).flatMap((g: any) =>
        (g.subjects || []).map((s: any) => [
          g.groupName,
          s.subjectName,
          s.teacherName,
          `${s.gradeCompleteness}%`,
          `${s.achievementCompleteness}%`,
        ]),
      )
      addTable([['Grupo', 'Asignatura', 'Docente', 'Notas %', 'Logros %']], body, startY)
    }

    const instSlug = (institution?.name || 'edusyn').replace(/\s+/g, '_').substring(0, 20)
    const filename = `${instSlug}_${selectedReport}_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(filename)
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
        {students.map(s => <option key={s.enrollmentId || s.id} value={s.enrollmentId || s.id}>{[s.lastName, s.secondLastName, s.firstName, s.secondName].filter(Boolean).join(' ')}</option>)}
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
  // Unique grades from groups
  const uniqueGrades = Array.from(new Map(groups.map((g: any) => [g.grade?.id, { id: g.grade?.id, name: g.grade?.name }])).values()).filter(g => g.id)
  const SelectGrade = () => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">Grado</label>
      <select value={filterGradeId} onChange={(e) => setFilterGradeId(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
        <option value="all">Todos</option>
        {uniqueGrades.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
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

      case 'cons-areas':
        return wrap(<><SelectYear /><SelectGroup required /><SelectTerm /><BtnSearch /></>, 4)

      case 'avg-subject':
      case 'avg-area':
        return wrap(<><SelectYear /><SelectGroup /><SelectTerm /><SelectStage /><BtnSearch /></>, 5)

      case 'ranking-students':
        return wrap(<><SelectYear /><SelectGroup required /><SelectTerm /><BtnSearch /></>, 4)

      case 'honor-roll': {
        const hrGradeGroups = filterGradeId !== 'all' ? groups.filter((g: any) => g.grade?.id === filterGradeId) : groups
        return wrap(<><SelectYear /><SelectGrade /><div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Curso (opcional)</label>
            <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="all">Todo el grado</option>
              {hrGradeGroups.map((g: any) => <option key={g.id} value={g.id}>{g.grade?.name} {g.name}</option>)}
            </select>
          </div><SelectTerm /><div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Top N</label>
          <select value={honorRollTopN} onChange={(e) => setHonorRollTopN(Number(e.target.value))} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
            {[1, 3, 5, 10].map(n => <option key={n} value={n}>Top {n}</option>)}
          </select>
        </div><div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Mostrar</label>
          <select value={honorRollMode} onChange={(e) => setHonorRollMode(e.target.value as any)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
            <option value="both">Separado + Integral</option>
            <option value="separate">Solo por curso</option>
            <option value="integral">Solo integral del grado</option>
          </select>
        </div><BtnSearch label={`Generar Top ${honorRollTopN}`} /></>, 4,
          <div className={`${style.bg} rounded-lg p-3 text-sm ${style.text}`}>
            <strong>🏆</strong> Selecciona un grado para ver los {honorRollTopN} mejores por curso. Usa "Mostrar" para elegir si ver separado por curso, solo el integral del grado, o ambos.
          </div>)
      }

      case 'ranking-institutional':
        return wrap(<><SelectYear /><SelectGroup /><SelectGrade /><SelectStage /><SelectTerm /><BtnSearch /></>, 6,
          <div className={`${style.bg} rounded-lg p-3 text-sm ${style.text}`}>
            <strong>💡</strong> Deja todos los filtros vacíos para ver el ranking de toda la institución. Puedes filtrar por grupo, grado o nivel educativo.
          </div>)

      case 'grade-distribution': {
        const gdGroups = filterGradeId !== 'all' ? groups.filter((g: any) => g.grade?.id === filterGradeId) : groups
        return wrap(<><SelectYear /><SelectGrade /><div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Curso (opcional)</label>
            <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="all">Todo el grado</option>
              {gdGroups.map((g: any) => <option key={g.id} value={g.id}>{g.grade?.name} {g.name}</option>)}
            </select>
          </div><SelectSubject /><SelectTerm /><div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Mostrar</label>
          <select value={gradeDistMode} onChange={(e) => setGradeDistMode(e.target.value as any)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" disabled={filterGrade !== 'all'}>
            <option value="both">Separado + Integral</option>
            <option value="separate">Solo por curso</option>
            <option value="integral">Solo integral del grado</option>
          </select>
        </div><BtnSearch /></>, 4,
          <div className={`${style.bg} rounded-lg p-3 text-sm ${style.text}`}>
            <strong>📊</strong> Selecciona un grado para ver todos los cursos. Usa "Mostrar" para elegir separado, integral o ambos.
          </div>)
      }

      case 'subject-level-dist':
        return wrap(<><SelectYear /><SelectGrade /><SelectGroup /><SelectTerm /><BtnSearch /></>, 5,
          <div className={`${style.bg} rounded-lg p-3 text-sm ${style.text}`}>
            <strong>📊</strong> Muestra cuántos estudiantes (y %) están en cada nivel de desempeño para cada asignatura. Filtra por grado, curso o período.
          </div>)

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

      case 'min-grade-consolidated':
        return wrap(<><SelectYear /><SelectGroup required /><BtnSearch /></>, 3)

      case 'completeness-status':
        return wrap(<><SelectYear /><SelectTerm /><BtnSearch label="Consultar" /></>, 3)

      case 'institutional-stats':
        return wrap(<><SelectYear /><SelectTerm /><BtnSearch /></>, 3)

      case 'annual-comparison':
        return wrap(
          <div className="col-span-full space-y-3">
            <label className="block text-xs font-medium text-slate-600">Seleccione los años a comparar</label>
            <div className="flex flex-wrap gap-2">
              {academicYears.map(y => {
                const selected = comparisonYearIds.includes(y.id)
                return (
                  <button key={y.id} onClick={() => setComparisonYearIds(prev => selected ? prev.filter(id => id !== y.id) : [...prev, y.id])}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${selected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'}`}>
                    {y.year}{y.status === 'ACTIVE' ? ' ✓' : ''}
                  </button>
                )
              })}
            </div>
            {comparisonYearIds.length > 0 && <p className="text-xs text-slate-500">{comparisonYearIds.length} año(s) seleccionado(s)</p>}
            <BtnSearch label="Comparar" />
          </div>, 1)

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
                <SortableHeader column="name" label="Estudiante" sort={sortState} className="px-3 py-2 sticky left-10 bg-slate-100" />
                <SortableHeader column="group" label="Grupo" sort={sortState} className="px-3 py-2" />
                {showGrades && subjectList.map(subj => <th key={subj} className="px-3 py-2 text-center whitespace-nowrap">{subj}</th>)}
                <SortableHeader column="average" label="Promedio" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="failedCount" label="Reprobadas" align="center" sort={sortState} className="px-3 py-2" />
                {showPerformance && <SortableHeader column="performance" label="Desempeño" align="center" sort={sortState} className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {sortData(studentsGradesData).map((row, idx) => (
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
      // Color según nivel de desempeño: Superior (verde), Alto (azul), Básico (amarillo), Bajo (rojo)
      const getBarColor = (avg: number) => {
        if (avg >= 4.6) return '#22c55e' // Superior - verde
        if (avg >= 4.0) return '#3b82f6' // Alto - azul
        if (avg >= minPassingGrade) return '#f59e0b' // Básico - amarillo/naranja
        return '#ef4444' // Bajo - rojo
      }
      const chartData = avgResults.map((r: any) => ({ name: r.subjectName?.length > 12 ? r.subjectName.substring(0, 12) + '…' : r.subjectName, Promedio: r.average, 'Aprobación %': r.approvalRate, fill: getBarColor(r.average || 0) }))
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
                  <Bar dataKey="Promedio" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                  {/* Reference line for passing grade */}
                  <CartesianGrid horizontal={false} vertical={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100"><tr>
              <SortableHeader column="subjectName" label="Asignatura" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="areaName" label="Área" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="average" label="Promedio" align="center" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="approvalRate" label="Aprobación %" align="center" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="failRate" label="Reprobación %" align="center" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="bestGrade" label="Mejor" align="center" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="worstGrade" label="Peor" align="center" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="totalStudents" label="Estudiantes" align="center" sort={sortState} className="px-3 py-2" />
            </tr></thead>
            <tbody>
              {sortData(reportData.results).map((r: any, i: number) => (
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

    // ── Promedio por áreas ──
    if (selectedReport === 'avg-area' && reportData?.results) {
      const areaResults = reportData.results as any[]
      const totalAreas = areaResults.length
      const generalAvg = totalAreas > 0 ? (areaResults.reduce((s: number, r: any) => s + (r.average || 0), 0) / totalAreas) : 0
      const bestArea = areaResults.reduce((best: any, r: any) => (!best || (r.average || 0) > (best.average || 0)) ? r : best, null)
      const worstArea = areaResults.reduce((worst: any, r: any) => (!worst || (r.average || 0) < (worst.average || 0)) ? r : worst, null)
      // Color según nivel de desempeño
      const getBarColor = (avg: number) => {
        if (avg >= 4.6) return '#22c55e' // Superior - verde
        if (avg >= 4.0) return '#3b82f6' // Alto - azul
        if (avg >= minPassingGrade) return '#f59e0b' // Básico - amarillo
        return '#ef4444' // Bajo - rojo
      }
      const chartData = areaResults.map((r: any) => ({ name: r.areaName?.length > 15 ? r.areaName.substring(0, 15) + '…' : r.areaName, Promedio: r.average, 'Aprobación %': r.approvalRate, fill: getBarColor(r.average || 0) }))
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><p className="text-xs text-blue-500 uppercase font-medium">Áreas</p><p className="text-2xl font-bold text-blue-700">{totalAreas}</p></div>
            <div className={`${generalAvg >= minPassingGrade ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-xl p-3 text-center`}><p className="text-xs text-slate-500 uppercase font-medium">Promedio General</p><p className={`text-2xl font-bold ${generalAvg >= minPassingGrade ? 'text-green-700' : 'text-red-700'}`}>{generalAvg.toFixed(1)}</p></div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center"><p className="text-xs text-green-500 uppercase font-medium">Mejor Área</p><p className="text-sm font-bold text-green-700 truncate">{bestArea?.areaName || '-'}</p><p className="text-xs text-green-600">{bestArea?.average?.toFixed(1)}</p></div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center"><p className="text-xs text-red-500 uppercase font-medium">Menor Rendimiento</p><p className="text-sm font-bold text-red-700 truncate">{worstArea?.areaName || '-'}</p><p className="text-xs text-red-600">{worstArea?.average?.toFixed(1)}</p></div>
          </div>
          {chartData.length > 1 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-sm font-medium text-slate-700 mb-3">Promedio por Área</h4>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" interval={0} />
                  <YAxis domain={[0, scaleMax]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="Promedio" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-area-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* Tabla de áreas con detalle de asignaturas */}
          <div className="space-y-3">
            {areaResults.map((area: any) => (
              <div key={area.areaId} className="border border-slate-200 rounded-xl overflow-hidden">
                <div className={`px-4 py-2 flex items-center justify-between ${area.average >= minPassingGrade ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div>
                    <span className="font-semibold text-sm">{area.areaName}</span>
                    <span className="text-xs text-slate-500 ml-2">({area.subjectCount} asignatura{area.subjectCount !== 1 ? 's' : ''})</span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span>Prom: <strong className={area.average >= minPassingGrade ? 'text-green-700' : 'text-red-700'}>{area.average?.toFixed(1)}</strong></span>
                    <span>Aprob: <strong className="text-green-600">{area.approvalRate?.toFixed(1)}%</strong></span>
                    <span>Reprob: <strong className="text-red-600">{area.failRate?.toFixed(1)}%</strong></span>
                  </div>
                </div>
                {area.subjects && area.subjects.length > 0 && (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50"><tr>
                      <th className="px-3 py-1.5 text-left">Asignatura</th>
                      <th className="px-3 py-1.5 text-center">Promedio</th>
                      <th className="px-3 py-1.5 text-center">Aprobación %</th>
                      <th className="px-3 py-1.5 text-center">Estudiantes</th>
                    </tr></thead>
                    <tbody>
                      {area.subjects.map((s: any) => (
                        <tr key={s.subjectId} className="border-t border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-1.5 font-medium">{s.subjectName}</td>
                          <td className={`px-3 py-1.5 text-center font-medium ${s.average >= minPassingGrade ? '' : 'text-red-600'}`}>{s.average?.toFixed(1)}</td>
                          <td className="px-3 py-1.5 text-center text-green-600">{s.approvalRate?.toFixed(1)}%</td>
                          <td className="px-3 py-1.5 text-center">{s.totalStudents}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        </div>
      )
    }

    // ── Consolidado por áreas (vista matricial) ──
    if (selectedReport === 'cons-areas' && reportData?.students) {
      const { passingGrade: caPassing, areaCols: caCols, areaSummary: caSummary, students: caStudents, summary: caSumm } = reportData
      const passing = caPassing ?? minPassingGrade
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><p className="text-xs text-blue-500 uppercase font-medium">Estudiantes</p><p className="text-2xl font-bold text-blue-700">{caSumm?.totalStudents ?? 0}</p></div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center"><p className="text-xs text-amber-500 uppercase font-medium">Con áreas reprobadas</p><p className="text-2xl font-bold text-amber-700">{caSumm?.studentsWithFailedAreas ?? 0}</p></div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center"><p className="text-xs text-green-500 uppercase font-medium">Sin áreas reprobadas</p><p className="text-2xl font-bold text-green-700">{(caSumm?.totalStudents ?? 0) - (caSumm?.studentsWithFailedAreas ?? 0)}</p></div>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-200">
                  <th className="px-2 py-1.5 text-left sticky left-0 bg-slate-200 z-10 min-w-[40px]">Nro</th>
                  <th className="px-2 py-1.5 text-left sticky left-[40px] bg-slate-200 z-10 min-w-[160px]">Estudiante</th>
                  {(caCols || []).map((col: any) => (
                    <th key={col.areaId} className="px-3 py-1.5 text-center border-l border-slate-300 min-w-[90px]">
                      <div className="text-[10px] font-semibold leading-tight">{col.areaName}</div>
                    </th>
                  ))}
                  <th className="px-3 py-1.5 text-center border-l border-slate-300 min-w-[65px] bg-slate-300 font-bold">Prom.</th>
                  <th className="px-3 py-1.5 text-center border-l border-slate-300 min-w-[50px] bg-slate-300 font-bold">Rep.</th>
                </tr>
              </thead>
              <tbody>
                {(caStudents || []).map((st: any, idx: number) => (
                  <tr key={st.enrollmentId} className={`border-t ${st.failedAreas > 0 ? 'bg-red-50/40' : 'hover:bg-slate-50'}`}>
                    <td className="px-2 py-1.5 text-center sticky left-0 bg-white z-10 border-r border-slate-100 font-medium">{idx + 1}</td>
                    <td className="px-2 py-1.5 sticky left-[40px] bg-white z-10 border-r border-slate-100 font-medium truncate max-w-[180px]">{st.studentName}</td>
                    {(st.areaGrades || []).map((ag: any, ai: number) => (
                      <td key={ai} className={`px-3 py-1.5 text-center border-l border-slate-100 font-medium ${ag.average === null ? 'text-slate-300' : ag.average < passing ? 'text-red-600 bg-red-50' : 'text-slate-800'}`}>
                        {ag.average !== null ? ag.average.toFixed(1) : '—'}
                      </td>
                    ))}
                    <td className={`px-3 py-1.5 text-center border-l border-slate-300 font-bold ${st.generalAverage !== null && st.generalAverage < passing ? 'text-red-600' : 'text-slate-800'}`}>
                      {st.generalAverage?.toFixed(1) ?? '—'}
                    </td>
                    <td className={`px-3 py-1.5 text-center border-l border-slate-300 font-bold ${st.failedAreas > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {st.failedAreas}
                    </td>
                  </tr>
                ))}
                {/* Fila resumen de promedios por área */}
                {caSummary && caSummary.length > 0 && (
                  <tr className="border-t-2 border-slate-400 bg-slate-100 font-bold">
                    <td colSpan={2} className="px-2 py-1.5 text-right sticky left-0 bg-slate-100 z-10 text-xs uppercase text-slate-600">Promedio del grupo</td>
                    {caSummary.map((as: any, ai: number) => (
                      <td key={ai} className={`px-3 py-1.5 text-center border-l border-slate-300 ${as.average !== null && as.average < passing ? 'text-red-600' : 'text-slate-800'}`}>
                        {as.average?.toFixed(1) ?? '—'}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-center border-l border-slate-300">—</td>
                    <td className="px-3 py-1.5 text-center border-l border-slate-300">—</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    // ── Ranking de estudiantes ──
    if (selectedReport === 'ranking-students' && reportData?.results?.length > 0) {
      const rkData = reportData.results as any[]
      const rkTotal = rkData.length
      const rkAvg = rkTotal > 0 ? (rkData.reduce((s: number, r: any) => s + (r.average || 0), 0) / rkTotal) : 0
      const rkTop = rkData[0]
      const rkAbovePass = rkData.filter((r: any) => (r.average || 0) >= minPassingGrade).length
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
              <SortableHeader column="position" label="Pos." align="center" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="studentName" label="Estudiante" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="group" label="Grupo" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="average" label="Promedio" align="center" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="subjectCount" label="Asignaturas" align="center" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="performance" label="Desempeño" align="center" sort={sortState} className="px-3 py-2" />
            </tr></thead>
            <tbody>
              {sortData(rkData).map((r: any, i: number) => (
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

    // ── Ranking institucional ──
    if (selectedReport === 'ranking-institutional' && reportData?.results) {
      const rkData = reportData.results as any[]
      const rkTotal = rkData.length
      const rkAvg = rkTotal > 0 ? (rkData.reduce((s: number, r: any) => s + (r.average || 0), 0) / rkTotal) : 0
      const rkTop = rkData[0]
      const rkAbovePass = rkData.filter((r: any) => (r.average || 0) >= minPassingGrade).length
      const scopeLabel = reportData.meta?.scope === 'institution' ? 'Toda la institución' : reportData.meta?.scope === 'grade' ? 'Por grado' : reportData.meta?.scope === 'stage' ? 'Por nivel' : 'Por grupo'
      // Color bars by performance
      const getBarColor = (avg: number) => {
        if (avg >= 4.6) return '#22c55e'
        if (avg >= 4.0) return '#3b82f6'
        if (avg >= minPassingGrade) return '#f59e0b'
        return '#ef4444'
      }
      const top20 = rkData.slice(0, 20).map(r => ({ name: r.studentName?.split(' ').slice(0, 2).join(' '), Promedio: r.average, fill: getBarColor(r.average) }))
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center"><p className="text-xs text-slate-500 uppercase font-medium">Alcance</p><p className="text-sm font-bold text-slate-700">{scopeLabel}</p></div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><p className="text-xs text-blue-500 uppercase font-medium">Total Estudiantes</p><p className="text-2xl font-bold text-blue-700">{rkTotal}</p></div>
            <div className={`${rkAvg >= minPassingGrade ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-xl p-3 text-center`}><p className="text-xs text-slate-500 uppercase font-medium">Promedio General</p><p className={`text-2xl font-bold ${rkAvg >= minPassingGrade ? 'text-green-700' : 'text-red-700'}`}>{rkAvg.toFixed(2)}</p></div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center"><p className="text-xs text-amber-500 uppercase font-medium">Mejor Estudiante</p><p className="text-sm font-bold text-amber-700 truncate">{rkTop?.studentName || '-'}</p><p className="text-xs text-amber-600">{rkTop?.average?.toFixed(2)}</p></div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center"><p className="text-xs text-green-500 uppercase font-medium">Aprobados</p><p className="text-2xl font-bold text-green-700">{rkAbovePass}</p><p className="text-xs text-slate-400">{((rkAbovePass / rkTotal) * 100).toFixed(0)}%</p></div>
          </div>
          {top20.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-sm font-medium text-slate-700 mb-3">Top 20 Estudiantes</h4>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={top20} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis domain={[0, scaleMax]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="Promedio" radius={[4, 4, 0, 0]}>
                    {top20.map((entry, index) => (
                      <Cell key={`cell-inst-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100"><tr>
              <SortableHeader column="position" label="Pos." align="center" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="studentName" label="Estudiante" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="group" label="Grupo" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="average" label="Promedio" align="center" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="subjectCount" label="Asignaturas" align="center" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="performance" label="Desempeño" align="center" sort={sortState} className="px-3 py-2" />
            </tr></thead>
            <tbody>
              {sortData(rkData).map((r: any, i: number) => (
                <tr key={i} className={`border-b hover:bg-slate-50 ${i < 3 ? 'bg-green-50' : i >= rkTotal - 3 ? 'bg-red-50' : ''}`}>
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

    // ── Cuadro de Honor ──
    if (selectedReport === 'honor-roll' && reportData?.honorRoll) {
      const hrData: Array<{ gradeName: string; students: any[] }> = reportData.honorRoll
      const gradeIntegral: any[] | null = reportData.gradeIntegral || null
      if (hrData.length === 0) return (
        <div className="text-center py-12"><TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">Sin datos para el cuadro de honor</p></div>
      )
      const allStudents = hrData.flatMap(g => g.students)
      const totalHonorees = allStudents.length
      const bestAvg = allStudents.reduce((max, s) => (s.average > max ? s.average : max), 0)
      const renderHonorTable = (students: any[], label: string, isIntegral = false) => (
        <div key={label} className={`border ${isIntegral ? 'border-green-300' : 'border-amber-200'} rounded-xl overflow-hidden`}>
          <div className={`bg-gradient-to-r ${isIntegral ? 'from-green-100 to-green-50' : 'from-amber-100 to-amber-50'} px-4 py-2 font-semibold ${isIntegral ? 'text-green-800' : 'text-amber-800'} flex items-center gap-2`}>
            <TrendingUp className="w-4 h-4" /> {label}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>
              <th className="px-3 py-2 text-center w-16">Puesto</th>
              <th className="px-3 py-2 text-left">Estudiante</th>
              <th className="px-3 py-2 text-left">Grupo</th>
              <th className="px-3 py-2 text-center">Promedio</th>
              <th className="px-3 py-2 text-center">Desempeño</th>
            </tr></thead>
            <tbody>
              {students.map((s: any, i: number) => (
                <tr key={i} className={`border-t ${i === 0 ? 'bg-amber-50/60' : i === 1 ? 'bg-slate-50' : i === 2 ? 'bg-orange-50/40' : ''}`}>
                  <td className="px-3 py-2 text-center font-bold text-lg">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </td>
                  <td className="px-3 py-2 font-medium">{s.studentName}</td>
                  <td className="px-3 py-2 text-slate-600">{s.group}</td>
                  <td className="px-3 py-2 text-center font-bold">{s.average?.toFixed(2)}</td>
                  <td className="px-3 py-2 text-center">{perfBadge(s.performance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center"><p className="text-xs uppercase text-amber-600">{gradeIntegral ? 'Cursos' : 'Grados'}</p><p className="text-2xl font-bold text-amber-700">{hrData.length}</p></div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><p className="text-xs uppercase text-blue-600">Estudiantes</p><p className="text-2xl font-bold text-blue-700">{totalHonorees}</p></div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center"><p className="text-xs uppercase text-green-600">Mejor promedio</p><p className="text-2xl font-bold text-green-700">{bestAvg.toFixed(2)}</p></div>
          </div>
          <div className="space-y-3">
            {honorRollMode !== 'integral' && hrData.map(({ gradeName, students }) => renderHonorTable(students, gradeName))}
            {honorRollMode !== 'separate' && gradeIntegral && gradeIntegral.length > 0 && renderHonorTable(gradeIntegral, 'Integral del Grado', true)}
            {honorRollMode === 'integral' && !gradeIntegral && hrData.map(({ gradeName, students }) => renderHonorTable(students, gradeName))}
          </div>
        </div>
      )
    }

    // ── Distribución de notas ──
    const renderDistPanel = (dist: any, label?: string, isIntegral = false) => {
      if (!dist?.distribution) return null
      const max = Math.max(...dist.distribution.map((d: any) => d.count), 1)
      const pieData = dist.distribution.filter((d: any) => d.count > 0).map((d: any) => ({ name: d.range, value: d.count }))
      return (
        <div className={`border ${isIntegral ? 'border-green-300' : 'border-slate-200'} rounded-xl overflow-hidden`}>
          {label && (
            <div className={`px-4 py-2 font-semibold text-sm ${isIntegral ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'} flex items-center gap-2`}>
              <BarChart3 className="w-4 h-4" /> {label}
            </div>
          )}
          <div className="p-4 space-y-3">
            {dist.summary && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="bg-slate-50 rounded-lg p-2 text-center"><p className="text-xs text-slate-500">Total</p><p className="text-lg font-bold">{dist.summary.total}</p></div>
                <div className="bg-slate-50 rounded-lg p-2 text-center"><p className="text-xs text-slate-500">Promedio</p><p className="text-lg font-bold">{dist.summary.average?.toFixed(2)}</p></div>
                {dist.summary.median != null && <div className="bg-slate-50 rounded-lg p-2 text-center"><p className="text-xs text-slate-500">Mediana</p><p className="text-lg font-bold">{dist.summary.median?.toFixed(2)}</p></div>}
                {dist.summary.stdDev != null && <div className="bg-slate-50 rounded-lg p-2 text-center"><p className="text-xs text-slate-500">Desv. Est.</p><p className="text-lg font-bold">{dist.summary.stdDev?.toFixed(2)}</p></div>}
              </div>
            )}
            {pieData.length > 0 && (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value" label={({ name, percent }: any) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}>
                    {pieData.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="space-y-2">
              {dist.distribution.map((d: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-right font-medium">{d.range}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                    <div className={`h-full rounded-full ${getDistBarColor(d.range)}`} style={{ width: `${(d.count / max) * 100}%` }}></div>
                  </div>
                  <span className="w-8 text-sm text-right">{d.count}</span>
                  <span className="w-14 text-xs text-slate-500 text-right">{d.percentage?.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    if (selectedReport === 'grade-distribution' && reportData?.byGroup) {
      const byGroup: any[] = reportData.byGroup
      const gradeIntegral: any = reportData.gradeIntegral
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center"><p className="text-xs uppercase text-amber-600">Cursos</p><p className="text-2xl font-bold text-amber-700">{byGroup.length}</p></div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><p className="text-xs uppercase text-blue-600">Total estudiantes</p><p className="text-2xl font-bold text-blue-700">{gradeIntegral?.summary?.total ?? 0}</p></div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center"><p className="text-xs uppercase text-green-600">Promedio grado</p><p className="text-2xl font-bold text-green-700">{gradeIntegral?.summary?.average?.toFixed(2) ?? '-'}</p></div>
          </div>
          <div className="space-y-4">
            {gradeDistMode !== 'separate' && renderDistPanel(gradeIntegral, 'Integral del Grado', true)}
            {gradeDistMode !== 'integral' && byGroup.map((g: any) => renderDistPanel(g, g.groupName))}
          </div>
        </div>
      )
    }

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

    // ── Niveles de desempeño por asignatura ──
    if (selectedReport === 'subject-level-dist' && reportData?.results) {
      const sldResults: any[] = reportData.results
      const levelLabels: string[] = reportData.performanceLevelLabels || ['Bajo', 'Básico', 'Alto', 'Superior']
      if (sldResults.length === 0) return (
        <div className="text-center py-12"><BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" /><p className="text-slate-500">Sin datos de desempeño por asignatura</p></div>
      )
      const defaultLevelColors = ['#f87171', '#fbbf24', '#60a5fa', '#4ade80']
      const levelHexColors: Record<string, string> = {}
      levelLabels.forEach((l, i) => {
        const institutionalLevel = gradingScale.performanceLevels.find((pl: any) => pl.name === l)
        levelHexColors[l] = institutionalLevel?.color || defaultLevelColors[i] || '#94a3b8'
      })
      const totalSubjects = sldResults.length
      const totalStudentsTotal = sldResults.reduce((s: number, r: any) => s + r.totalStudents, 0)
      const overallAvg = sldResults.length > 0 ? sldResults.reduce((s: number, r: any) => s + r.average, 0) / sldResults.length : 0
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><p className="text-xs text-blue-500 uppercase">Asignaturas</p><p className="text-2xl font-bold text-blue-700">{totalSubjects}</p></div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center"><p className="text-xs text-slate-500 uppercase">Total registros</p><p className="text-2xl font-bold text-slate-700">{totalStudentsTotal}</p></div>
            <div className={`${overallAvg >= minPassingGrade ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border rounded-xl p-3 text-center`}><p className="text-xs text-slate-500 uppercase">Promedio general</p><p className={`text-2xl font-bold ${overallAvg >= minPassingGrade ? 'text-green-700' : 'text-red-700'}`}>{overallAvg.toFixed(1)}</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left">Asignatura</th>
                  <th className="px-3 py-2 text-left text-slate-500 text-xs">Área</th>
                  <th className="px-3 py-2 text-center">Total</th>
                  <th className="px-3 py-2 text-center">Promedio</th>
                  <th className="px-3 py-2 text-center">Aprobación</th>
                  {levelLabels.map(l => <th key={l} className="px-3 py-2 text-center">{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {sldResults.map((r: any) => (
                  <tr key={r.subjectId} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{r.subjectName}</td>
                    <td className="px-3 py-2 text-slate-400 text-xs">{r.areaName}</td>
                    <td className="px-3 py-2 text-center">{r.totalStudents}</td>
                    <td className="px-3 py-2 text-center font-medium">{r.average?.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.approvalRate >= 80 ? 'bg-green-100 text-green-700' : r.approvalRate >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{r.approvalRate?.toFixed(1)}%</span>
                    </td>
                    {(r.levels || []).map((lv: any) => (
                      <td key={lv.label} className="px-3 py-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-medium">{lv.count}</span>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 min-w-[40px]">
                            <div className="h-1.5 rounded-full" style={{ width: `${lv.percentage}%`, backgroundColor: levelHexColors[lv.label] || '#94a3b8' }}></div>
                          </div>
                          <span className="text-xs text-slate-400">{lv.percentage?.toFixed(1)}%</span>
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    // ── Nota mínima requerida — individual ──
    if (selectedReport === 'min-grade' && minimumGradeData) {
      return (
        <div className="space-y-4">
          <div className="bg-purple-50 rounded-lg p-4">
            <h4 className="font-medium text-purple-800 mb-2">Estudiante: {[minimumGradeData.student?.lastName, minimumGradeData.student?.secondLastName, minimumGradeData.student?.firstName, minimumGradeData.student?.secondName].filter(Boolean).join(' ')}</h4>
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
                <SortableHeader column="subjectName" label="Asignatura" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="areaName" label="Área" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="currentAnnualGrade" label="Promedio Actual" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="minimumRequired" label="Nota Mínima Requerida" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="status" label="Estado" align="center" sort={sortState} className="px-3 py-2" />
                <th className="px-3 py-2 text-left">Detalle</th>
              </tr></thead>
              <tbody>
                {sortData(minimumGradeData.subjects || []).map((subj: any, idx: number) => (
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
              <th className="px-3 py-2 text-left">Nro</th>
              <SortableHeader column="studentName" label="Estudiante" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="subjectName" label="Asignatura Crítica" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="minimumRequired" label="Nota Mínima Requerida" align="center" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="status" label="Estado" align="center" sort={sortState} className="px-3 py-2" />
            </tr></thead>
            <tbody>
              {sortData(minimumGradeGroupData).map((row, idx) => (
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

    // ── Asignaturas reprobadas (vista matricial) ──
    if (selectedReport === 'failed-subjects' && reportData?.results) {
      // Agrupar por estudiante → asignaturas como columnas
      const failResults = reportData.results as any[]
      const failStudentMap = new Map<string, { name: string; subjects: Map<string, { grade: number; deficit: number; termName: string; recoverable: boolean; areaName: string }> }>()
      const failAllSubjects = new Set<string>()
      for (const r of failResults) {
        if (!failStudentMap.has(r.studentName)) failStudentMap.set(r.studentName, { name: r.studentName, subjects: new Map() })
        failStudentMap.get(r.studentName)!.subjects.set(r.subjectName, { grade: r.grade, deficit: r.deficit, termName: r.termName, recoverable: r.recoverable, areaName: r.areaName })
        failAllSubjects.add(r.subjectName)
      }
      const failSubjectCols = Array.from(failAllSubjects).sort()
      const failStudentRows = Array.from(failStudentMap.values()).sort((a, b) => b.subjects.size - a.subjects.size || a.name.localeCompare(b.name))

      return (
        <div className="space-y-4">
          {reportData.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center"><p className="text-xs text-red-500 uppercase font-medium">Total reprobadas</p><p className="text-2xl font-bold text-red-700">{reportData.summary.totalFailed}</p></div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center"><p className="text-xs text-amber-500 uppercase font-medium">Estudiantes afectados</p><p className="text-2xl font-bold text-amber-700">{reportData.summary.studentsAffected}</p></div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center"><p className="text-xs text-slate-500 uppercase font-medium">Tasa reprobación</p><p className="text-2xl font-bold text-slate-700">{reportData.summary.failRate?.toFixed(1)}%</p></div>
            </div>
          )}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-200">
                  <th className="px-2 py-1.5 text-left sticky left-0 bg-slate-200 z-10 min-w-[40px]">Nro</th>
                  <th className="px-2 py-1.5 text-left sticky left-[40px] bg-slate-200 z-10 min-w-[160px]">Estudiante</th>
                  {failSubjectCols.map(s => (
                    <th key={s} className="px-2 py-1.5 text-center border-l border-slate-300 min-w-[80px]">
                      <div className="text-[10px] font-medium leading-tight">{s}</div>
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-center border-l border-slate-300 min-w-[50px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {failStudentRows.map((st, idx) => (
                  <tr key={st.name} className="border-t hover:bg-slate-50">
                    <td className="px-2 py-1.5 text-center sticky left-0 bg-white z-10 border-r border-slate-100 font-medium">{idx + 1}</td>
                    <td className="px-2 py-1.5 sticky left-[40px] bg-white z-10 border-r border-slate-100 font-medium truncate max-w-[180px]">{st.name}</td>
                    {failSubjectCols.map(s => {
                      const cell = st.subjects.get(s)
                      if (!cell) return <td key={s} className="px-2 py-1.5 text-center border-l border-slate-100 text-slate-300">—</td>
                      return (
                        <td key={s} className="px-2 py-1.5 text-center border-l border-slate-100">
                          <span className="text-red-600 font-semibold">{cell.grade?.toFixed(1)}</span>
                          <span className="text-[9px] text-slate-500 block">-{cell.deficit?.toFixed(1)}</span>
                          {cell.recoverable && <span className="text-[8px] text-green-600 block">Recup.</span>}
                        </td>
                      )
                    })}
                    <td className="px-2 py-1.5 text-center border-l border-slate-300 font-bold text-red-600">{st.subjects.size}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    // ── Listado de recuperación (vista matricial) ──
    if (selectedReport === 'recovery-list' && reportData?.results) {
      const recResults = reportData.results as any[]
      const recTotal = recResults.length
      const recStudents = new Set(recResults.map((r: any) => r.studentName)).size
      const recAvgDeficit = recTotal > 0 ? (recResults.reduce((s: number, r: any) => s + (r.deficit || 0), 0) / recTotal) : 0

      // Agrupar por estudiante
      const studentMap = new Map<string, { name: string; subjects: Map<string, { grade: number; deficit: number; termName: string }> }>()
      const allSubjects = new Set<string>()
      for (const r of recResults) {
        if (!studentMap.has(r.studentName)) studentMap.set(r.studentName, { name: r.studentName, subjects: new Map() })
        const key = `${r.subjectName}`
        studentMap.get(r.studentName)!.subjects.set(key, { grade: r.grade, deficit: r.deficit, termName: r.termName })
        allSubjects.add(key)
      }
      const subjectCols = Array.from(allSubjects).sort()
      const studentRows = Array.from(studentMap.values()).sort((a, b) => a.name.localeCompare(b.name))

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center"><p className="text-xs text-amber-500 uppercase font-medium">Asignaturas a Recuperar</p><p className="text-2xl font-bold text-amber-700">{recTotal}</p></div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><p className="text-xs text-blue-500 uppercase font-medium">Estudiantes</p><p className="text-2xl font-bold text-blue-700">{recStudents}</p></div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center"><p className="text-xs text-red-500 uppercase font-medium">Deficit Promedio</p><p className="text-2xl font-bold text-red-700">{recAvgDeficit.toFixed(1)}</p></div>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-200">
                  <th className="px-2 py-1.5 text-left sticky left-0 bg-slate-200 z-10 min-w-[40px]">Nro</th>
                  <th className="px-2 py-1.5 text-left sticky left-[40px] bg-slate-200 z-10 min-w-[160px]">Estudiante</th>
                  {subjectCols.map(s => (
                    <th key={s} className="px-2 py-1.5 text-center border-l border-slate-300 min-w-[80px]">
                      <div className="text-[10px] font-medium leading-tight">{s}</div>
                    </th>
                  ))}
                  <th className="px-2 py-1.5 text-center border-l border-slate-300 min-w-[50px]">Total</th>
                </tr>
              </thead>
              <tbody>
                {studentRows.map((st, idx) => (
                  <tr key={st.name} className="border-t hover:bg-slate-50">
                    <td className="px-2 py-1.5 text-center sticky left-0 bg-white z-10 border-r border-slate-100 font-medium">{idx + 1}</td>
                    <td className="px-2 py-1.5 sticky left-[40px] bg-white z-10 border-r border-slate-100 font-medium truncate max-w-[180px]">{st.name}</td>
                    {subjectCols.map(s => {
                      const cell = st.subjects.get(s)
                      if (!cell) return <td key={s} className="px-2 py-1.5 text-center border-l border-slate-100 text-slate-300">—</td>
                      return (
                        <td key={s} className="px-2 py-1.5 text-center border-l border-slate-100">
                          <span className="text-amber-700 font-semibold">{cell.grade?.toFixed(1)}</span>
                          <span className="text-[9px] text-red-500 block">-{cell.deficit?.toFixed(1)}</span>
                        </td>
                      )
                    })}
                    <td className="px-2 py-1.5 text-center border-l border-slate-300 font-bold text-red-600">{st.subjects.size}</td>
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
                <SortableHeader column="studentName" label="Estudiante" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="group" label="Grupo" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="totalSubjects" label="Total Asig." align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="projectedApproved" label="Promueve" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="atRisk" label="En Riesgo" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="projectedFailed" label="No Promueve" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="overallProjection" label="Proyección" align="center" sort={sortState} className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {sortData(reportData.results).map((r: any, i: number) => (
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
                  <SortableHeader column="studentName" label="Estudiante" sort={sortState} className="px-3 py-2" />
                  <SortableHeader column="average" label="Promedio" align="center" sort={sortState} className="px-3 py-2" />
                  <SortableHeader column="performance" label="Desempeño" align="center" sort={sortState} className="px-3 py-2" />
                </tr></thead>
                <tbody>
                  {sortData(reportData.students).map((s: any, i: number) => (
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
              <SortableHeader column="teacherName" label="Docente" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="subjectName" label="Asignatura" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="groupName" label="Grupo" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="average" label="Promedio" align="center" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="approvalRate" label="Aprobación %" align="center" sort={sortState} className="px-3 py-2" />
              <SortableHeader column="totalStudents" label="Estudiantes" align="center" sort={sortState} className="px-3 py-2" />
            </tr></thead>
            <tbody>
              {sortData(reportData.results).map((r: any, i: number) => (
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

    // ── Consolidado nota mínima (matriz) ──
    if (selectedReport === 'min-grade-consolidated' && reportData?.students) {
      const { scale, terms: rTerms, areaGroups: rAreas, subjectColumns: rSubjects, students: rStudents, summary } = reportData
      const { minGrade: sMin, maxGrade: sMax, passingGrade: sPassing } = scale || { minGrade: 0, maxGrade: 5, passingGrade: 3 }
      // Color de nota existente
      const gradeColor = (g: number | null) => {
        if (g === null) return ''
        return g < sPassing ? 'text-red-600 font-semibold' : ''
      }
      // Color de "Necesita"
      const needColor = (min: number | null, status: string) => {
        if (status === 'approved' || min === null) return 'text-green-600'
        if (status === 'impossible') return 'bg-red-100 text-red-700 font-bold'
        // at_risk: gradiente según qué tan alta es la nota requerida
        const midpoint = sPassing + (sMax - sPassing) * 0.6
        if (min > midpoint) return 'bg-amber-100 text-amber-800 font-semibold'
        return 'text-amber-600'
      }
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center"><p className="text-xs text-slate-500 uppercase font-medium">Estudiantes</p><p className="text-2xl font-bold text-slate-700">{summary.totalStudents}</p></div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center"><p className="text-xs text-amber-500 uppercase font-medium">En riesgo</p><p className="text-2xl font-bold text-amber-700">{summary.studentsAtRisk}</p></div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center"><p className="text-xs text-green-500 uppercase font-medium">Sin riesgo</p><p className="text-2xl font-bold text-green-700">{summary.studentsClean}</p></div>
          </div>
          <div className="text-xs text-slate-500 flex flex-wrap gap-4">
            <span>Escala: <strong>{sMin} - {sMax}</strong></span>
            <span>Aprobatorio: <strong>≥ {sPassing}</strong></span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" /> Imposible</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" /> Riesgo alto</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded text-amber-600 inline-block">⚠</span> Riesgo</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded text-green-600 inline-block">✓</span> Aprobado</span>
          </div>
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="text-xs whitespace-nowrap">
              {/* Header nivel 1: Áreas */}
              <thead>
                <tr className="bg-slate-200">
                  <th rowSpan={3} className="px-2 py-1 text-left sticky left-0 bg-slate-200 z-10 min-w-[40px]">Nro</th>
                  <th rowSpan={3} className="px-2 py-1 text-left sticky left-[40px] bg-slate-200 z-10 min-w-[140px]">Estudiante</th>
                  {(rAreas || []).map((a: any) => (
                    <th key={a.areaId} colSpan={a.subjectCount * (rTerms.length + 1)} className="px-2 py-1 text-center border-l border-slate-300 bg-blue-100 text-blue-800">{a.areaName}</th>
                  ))}
                  <th rowSpan={3} className="px-2 py-1 text-center border-l border-slate-300 min-w-[60px]">Prom.</th>
                  <th rowSpan={3} className="px-2 py-1 text-center border-l border-slate-300 min-w-[50px]">Rep.</th>
                </tr>
                {/* Header nivel 2: Asignaturas */}
                <tr className="bg-slate-100">
                  {(rSubjects || []).map((s: any) => (
                    <th key={s.subjectId} colSpan={rTerms.length + 1} className="px-1 py-1 text-center border-l border-slate-300 text-[10px] font-medium">{s.subjectName}</th>
                  ))}
                </tr>
                {/* Header nivel 3: Períodos + Necesita */}
                <tr className="bg-slate-50">
                  {(rSubjects || []).map((s: any) => (
                    <React.Fragment key={`h3-${s.subjectId}`}>
                      {rTerms.map((t: any) => (
                        <th key={`${s.subjectId}-${t.id}`} className="px-1 py-0.5 text-center border-l border-slate-200 text-[9px] text-slate-500 min-w-[38px]">{t.name}</th>
                      ))}
                      <th className="px-1 py-0.5 text-center border-l border-slate-300 text-[9px] text-amber-700 font-bold min-w-[45px]">Necesita</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(rStudents || []).map((st: any, idx: number) => (
                  <tr key={st.enrollmentId} className={`border-t ${st.totalFailed > 0 ? 'bg-red-50/40' : 'hover:bg-slate-50'}`}>
                    <td className="px-2 py-1 text-center sticky left-0 bg-white z-10 border-r border-slate-100 font-medium">{idx + 1}</td>
                    <td className="px-2 py-1 sticky left-[40px] bg-white z-10 border-r border-slate-100 font-medium truncate max-w-[160px]">{st.studentName}</td>
                    {(st.subjects || []).map((subj: any, si: number) => (
                      <React.Fragment key={`${st.enrollmentId}-${si}`}>
                        {subj.termGrades.map((tg: any, ti: number) => (
                          <td key={`${st.enrollmentId}-${si}-${ti}`} className={`px-1 py-1 text-center border-l border-slate-100 ${gradeColor(tg.grade)}`}>
                            {tg.grade !== null ? tg.grade.toFixed(1) : '-'}
                          </td>
                        ))}
                        <td className={`px-1 py-1 text-center border-l border-slate-200 ${needColor(subj.minimumRequired, subj.status)}`}>
                          {subj.status === 'approved' ? '—' : subj.status === 'impossible' ? (subj.minimumRequired?.toFixed(1) ?? 'X') : subj.minimumRequired?.toFixed(1) ?? '-'}
                        </td>
                      </React.Fragment>
                    ))}
                    <td className={`px-2 py-1 text-center border-l border-slate-300 font-bold ${st.generalAverage !== null && st.generalAverage < sPassing ? 'text-red-600' : 'text-slate-800'}`}>
                      {st.generalAverage?.toFixed(1) ?? '-'}
                    </td>
                    <td className={`px-2 py-1 text-center border-l border-slate-300 font-bold ${st.totalFailed > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {st.totalFailed}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    // ── Consolidado institucional ──
    if (selectedReport === 'institutional-stats' && reportData?.institutional) {
      const inst = reportData.institutional
      const stageChartData = (reportData.stages || []).map((s: any) => ({ name: s.stageLabel, Promedio: s.average, 'Aprobación %': s.approvalRate }))
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><p className="text-xs text-blue-500 uppercase font-medium">Promedio Institucional</p><p className="text-2xl font-bold text-blue-700">{inst.average}</p></div>
            <div className={`${inst.approvalRate >= 70 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'} border rounded-xl p-3 text-center`}><p className="text-xs text-slate-500 uppercase font-medium">Aprobación</p><p className={`text-2xl font-bold ${inst.approvalRate >= 70 ? 'text-green-700' : 'text-amber-700'}`}>{inst.approvalRate}%</p></div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center"><p className="text-xs text-slate-500 uppercase font-medium">Estudiantes</p><p className="text-2xl font-bold text-slate-700">{inst.totalStudents}</p></div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center"><p className="text-xs text-slate-500 uppercase font-medium">Grupos</p><p className="text-2xl font-bold text-slate-700">{inst.totalGroups}</p></div>
          </div>
          {stageChartData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-sm font-medium text-slate-700 mb-3">Promedio por Nivel Educativo</h4>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stageChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, scaleMax]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Promedio" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Aprobación %" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {(reportData.stages || []).map((stage: any) => (
            <div key={stage.stage} className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 flex items-center justify-between">
                <span className="font-medium text-slate-800">{stage.stageLabel}</span>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>Prom: <strong className="text-slate-700">{stage.average}</strong></span>
                  <span>Aprob: <strong className="text-green-700">{stage.approvalRate}%</strong></span>
                  <span>{stage.totalStudents} est. · {stage.totalGroups} grupos</span>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50">
                  <th className="px-3 py-1.5 text-left text-xs">Pos.</th>
                  <th className="px-3 py-1.5 text-left text-xs">Grupo</th>
                  <th className="px-3 py-1.5 text-center text-xs">Promedio</th>
                  <th className="px-3 py-1.5 text-center text-xs">Aprobación %</th>
                  <th className="px-3 py-1.5 text-center text-xs">Estudiantes</th>
                </tr></thead>
                <tbody>
                  {(stage.groupRanking || []).map((g: any, i: number) => (
                    <tr key={g.groupId} className={`border-t ${i === 0 ? 'bg-green-50' : ''}`}>
                      <td className="px-3 py-1.5 font-bold text-xs">{i + 1}</td>
                      <td className="px-3 py-1.5 font-medium">{g.groupName}</td>
                      <td className="px-3 py-1.5 text-center">{g.average}</td>
                      <td className="px-3 py-1.5 text-center">{g.approvalRate}%</td>
                      <td className="px-3 py-1.5 text-center">{g.totalStudents}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )
    }

    // ── Comparativo anual ──
    if (selectedReport === 'annual-comparison' && reportData?.results?.length > 0) {
      const lineData = reportData.results.map((yr: any) => ({ name: yr.yearName, Promedio: yr.average, 'Aprobación %': yr.approvalRate }))
      return (
        <div className="space-y-4">
          {lineData.length > 1 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h4 className="text-sm font-medium text-slate-700 mb-3">Evolución Institucional</h4>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={lineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, scaleMax]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Promedio" stroke="#3b82f6" strokeWidth={2} dot={{ r: 5 }} />
                  <Line type="monotone" dataKey="Aprobación %" stroke="#22c55e" strokeWidth={2} dot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100"><tr>
                <SortableHeader column="yearName" label="Año" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="average" label="Promedio" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="avgVariation" label="Δ Prom." align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="approvalRate" label="Aprobación %" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="approvalVariation" label="Δ Aprob." align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="totalStudents" label="Estudiantes" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="studentVariation" label="Δ Est." align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="totalGroups" label="Grupos" align="center" sort={sortState} className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {sortData(reportData.results).map((yr: any, i: number) => (
                  <tr key={yr.academicYearId} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium">{yr.yearName}</td>
                    <td className="px-3 py-2 text-center font-medium">{yr.average}</td>
                    <td className="px-3 py-2 text-center">{yr.avgVariation !== null ? <span className={yr.avgVariation > 0 ? 'text-green-600' : yr.avgVariation < 0 ? 'text-red-600' : 'text-slate-500'}>{yr.avgVariation > 0 ? '+' : ''}{yr.avgVariation}</span> : '-'}</td>
                    <td className="px-3 py-2 text-center">{yr.approvalRate}%</td>
                    <td className="px-3 py-2 text-center">{yr.approvalVariation !== null ? <span className={yr.approvalVariation > 0 ? 'text-green-600' : yr.approvalVariation < 0 ? 'text-red-600' : 'text-slate-500'}>{yr.approvalVariation > 0 ? '+' : ''}{yr.approvalVariation}%</span> : '-'}</td>
                    <td className="px-3 py-2 text-center">{yr.totalStudents}</td>
                    <td className="px-3 py-2 text-center">{yr.studentVariation !== null ? <span className={yr.studentVariation > 0 ? 'text-green-600' : yr.studentVariation < 0 ? 'text-red-600' : 'text-slate-500'}>{yr.studentVariation > 0 ? '+' : ''}{yr.studentVariation}</span> : '-'}</td>
                    <td className="px-3 py-2 text-center">{yr.totalGroups}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {reportData.results.map((yr: any) => yr.stageBreakdown?.length > 0 && (
            <div key={yr.academicYearId} className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-4 py-2 font-medium text-slate-800">{yr.yearName} — Desglose por nivel</div>
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50">
                  <th className="px-3 py-1.5 text-left text-xs">Nivel</th>
                  <th className="px-3 py-1.5 text-center text-xs">Promedio</th>
                  <th className="px-3 py-1.5 text-center text-xs">Aprobación %</th>
                  <th className="px-3 py-1.5 text-center text-xs">Estudiantes</th>
                </tr></thead>
                <tbody>
                  {yr.stageBreakdown.map((s: any) => (
                    <tr key={s.stage} className="border-t">
                      <td className="px-3 py-1.5 font-medium">{s.stageLabel}</td>
                      <td className="px-3 py-1.5 text-center">{s.average}</td>
                      <td className="px-3 py-1.5 text-center">{s.approvalRate}%</td>
                      <td className="px-3 py-1.5 text-center">{s.totalStudents}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )
    }

    // ── Estado de Completitud Académica ──
    if (selectedReport === 'completeness-status' && reportData?.groups) {
      const { summary: cSummary, groups: cGroups, terms: cTerms } = reportData
      const toggleGroup = (gid: string) => setExpandedGroups(prev => {
        const n = new Set(prev); n.has(gid) ? n.delete(gid) : n.add(gid); return n
      })
      const toggleSubject = (key: string) => setExpandedSubjects(prev => {
        const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n
      })
      const cColor = (pct: number) => pct >= 100 ? 'text-green-700 bg-green-100' : pct >= 75 ? 'text-amber-700 bg-amber-100' : pct >= 50 ? 'text-orange-700 bg-orange-100' : 'text-red-700 bg-red-100'
      const cBar = (pct: number) => pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-amber-500' : pct >= 50 ? 'bg-orange-500' : 'bg-red-500'

      const handleReSnapshot = async (termId: string) => {
        if (!confirm('¿Regenerar snapshots para este período? Se creará una nueva versión con datos actualizados.')) return
        setReSnapshotLoading(true)
        try {
          const res = await reportsApi.reSnapshotTerm(termId)
          alert(`Snapshots regenerados: ${res.data.totalSnapshots} estudiantes en ${res.data.totalGroups} grupos (v${res.data.version})`)
        } catch (err: any) {
          alert('Error: ' + (err.response?.data?.message || err.message))
        } finally { setReSnapshotLoading(false) }
      }

      return (
        <div className="space-y-5">
          {/* Resumen ejecutivo */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><p className="text-xs text-blue-500 uppercase font-medium">Grupos</p><p className="text-2xl font-bold text-blue-700">{cSummary.totalGroups}</p></div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center"><p className="text-xs text-slate-500 uppercase font-medium">Estudiantes</p><p className="text-2xl font-bold text-slate-700">{cSummary.totalStudents}</p></div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center"><p className="text-xs text-slate-500 uppercase font-medium">Asignaciones</p><p className="text-2xl font-bold text-slate-700">{cSummary.totalSubjects}</p></div>
            <div className={`border rounded-xl p-3 text-center ${cSummary.overallGradeCompleteness >= 100 ? 'bg-green-50 border-green-200' : cSummary.overallGradeCompleteness >= 75 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs text-slate-500 uppercase font-medium">Notas</p>
              <p className={`text-2xl font-bold ${cSummary.overallGradeCompleteness >= 100 ? 'text-green-700' : cSummary.overallGradeCompleteness >= 75 ? 'text-amber-700' : 'text-red-700'}`}>{cSummary.overallGradeCompleteness}%</p>
            </div>
            <div className={`border rounded-xl p-3 text-center ${cSummary.overallAchievementCompleteness >= 100 ? 'bg-green-50 border-green-200' : cSummary.overallAchievementCompleteness >= 75 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
              <p className="text-xs text-slate-500 uppercase font-medium">Logros</p>
              <p className={`text-2xl font-bold ${cSummary.overallAchievementCompleteness >= 100 ? 'text-green-700' : cSummary.overallAchievementCompleteness >= 75 ? 'text-amber-700' : 'text-red-700'}`}>{cSummary.overallAchievementCompleteness}%</p>
            </div>
          </div>

          {/* Re-snapshot por período finalizado */}
          {cTerms && cTerms.some((t: any) => t.status === 'FINALIZED') && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="w-4 h-4 text-purple-600" />
                <span className="text-sm font-medium text-purple-700">Regenerar Snapshots (períodos finalizados)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {cTerms.filter((t: any) => t.status === 'FINALIZED').map((t: any) => (
                  <button key={t.id} onClick={() => handleReSnapshot(t.id)} disabled={reSnapshotLoading}
                    className="px-3 py-1.5 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1">
                    <RefreshCw className={`w-3 h-3 ${reSnapshotLoading ? 'animate-spin' : ''}`} /> {t.name}
                  </button>
                ))}
              </div>
              <p className="text-xs text-purple-500 mt-2">Crea una nueva versión de snapshots con datos corregidos sin cambiar el estado del período.</p>
            </div>
          )}

          {/* Tabla por grupo con drill-down */}
          <div className="space-y-3">
            {cGroups.map((g: any) => {
              const isGExpanded = expandedGroups.has(g.groupId)
              return (
                <div key={g.groupId} className="border border-slate-200 rounded-xl overflow-hidden">
                  {/* Cabecera del grupo */}
                  <div className="px-4 py-3 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => toggleGroup(g.groupId)}>
                    <div className="flex items-center gap-3">
                      {isGExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      <span className="font-semibold text-sm text-slate-800">{g.groupName}</span>
                      <span className="text-xs text-slate-500">{g.studentCount} est. · {g.subjectCount} asig.</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500">Notas:</span>
                        <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden"><div className={`h-full rounded-full ${cBar(g.gradeCompleteness)}`} style={{ width: `${Math.min(g.gradeCompleteness, 100)}%` }} /></div>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cColor(g.gradeCompleteness)}`}>{g.gradeCompleteness}%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-500">Logros:</span>
                        <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden"><div className={`h-full rounded-full ${cBar(g.achievementCompleteness)}`} style={{ width: `${Math.min(g.achievementCompleteness, 100)}%` }} /></div>
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cColor(g.achievementCompleteness)}`}>{g.achievementCompleteness}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Detalle de asignaturas del grupo */}
                  {isGExpanded && g.subjects && (
                    <div className="divide-y divide-slate-100">
                      {g.subjects.map((subj: any) => {
                        const sKey = `${g.groupId}-${subj.subjectId}`
                        const isSExpanded = expandedSubjects.has(sKey)
                        const hasIssues = subj.gradeCompleteness < 100 || subj.achievementCompleteness < 100
                        return (
                          <div key={sKey}>
                            <div className={`px-6 py-2 flex items-center justify-between ${hasIssues ? 'cursor-pointer hover:bg-red-50/50' : ''}`}
                              onClick={() => hasIssues && toggleSubject(sKey)}>
                              <div className="flex items-center gap-2">
                                {hasIssues && (isSExpanded ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />)}
                                {!hasIssues && <CheckCircle className="w-3 h-3 text-green-500" />}
                                <span className="text-sm text-slate-700">{subj.subjectName}</span>
                                {subj.teacherName && <span className="text-xs text-slate-400">({subj.teacherName})</span>}
                              </div>
                              <div className="flex items-center gap-4 text-xs">
                                <span>Notas: <strong className={subj.gradeCompleteness < 100 ? 'text-red-600' : 'text-green-600'}>{subj.gradesRegistered}/{subj.gradesExpected}</strong></span>
                                <span>Logros: <strong className={subj.achievementCompleteness < 100 ? 'text-red-600' : 'text-green-600'}>{subj.achievementsRegistered}/{subj.achievementsExpected}</strong></span>
                              </div>
                            </div>

                            {/* Lista de estudiantes faltantes */}
                            {isSExpanded && hasIssues && (
                              <div className="bg-red-50/30 px-8 py-2 space-y-2">
                                {subj.missingGrades && subj.missingGrades.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-red-700 mb-1">Sin nota ({subj.missingGrades.length}):</p>
                                    <div className="flex flex-wrap gap-1">
                                      {subj.missingGrades.map((st: any) => (
                                        <span key={st.studentId || st.enrollmentId} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">{st.studentName}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {subj.missingAchievements && subj.missingAchievements.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-amber-700 mb-1">Sin logros ({subj.missingAchievements.length}):</p>
                                    <div className="flex flex-wrap gap-1">
                                      {subj.missingAchievements.map((st: any) => (
                                        <span key={st.studentId || st.enrollmentId} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{st.studentName}</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
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
          <button onClick={exportToPDF} className="flex items-center gap-2 px-3 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 text-sm">
            <Download className="w-4 h-4" /> Exportar PDF
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
