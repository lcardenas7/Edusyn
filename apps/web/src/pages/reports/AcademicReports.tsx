import { useState, useEffect } from 'react'
import { 
  BookOpen,
  Users,
  GraduationCap,
  ClipboardList,
  BarChart3,
  Download,
  Printer,
  ArrowLeft,
  ChevronLeft,
  Calculator,
  TrendingUp,
  FileText
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useReportsData } from '../../hooks/useReportsData'
import { useAuth } from '../../contexts/AuthContext'
import { teacherAssignmentsApi, periodFinalGradesApi, reportsApi } from '../../lib/api'

interface ReportItem {
  id: string
  name: string
  description: string
  icon: any
  feature?: string
}

const academicReports: ReportItem[] = [
  { id: 'cons-subjects', name: 'Consolidado por asignaturas', description: 'Notas de todas las materias por estudiante', icon: ClipboardList, feature: 'RPT_CONS_SUBJECTS' },
  { id: 'avg-group', name: 'Promedio por grupo', description: 'Rendimiento general del grupo', icon: BarChart3, feature: 'RPT_AVG_GROUP' },
  { id: 'avg-subject', name: 'Promedio por asignatura', description: 'Rendimiento por materia en todos los grupos', icon: BookOpen, feature: 'RPT_AVG_SUBJECT' },
  { id: 'ranking-students', name: 'Ranking de estudiantes', description: 'Mejores promedios por grupo/nivel', icon: TrendingUp, feature: 'RPT_RANKING' },
  { id: 'failed-subjects', name: 'Asignaturas reprobadas', description: 'Estudiantes con materias perdidas', icon: ClipboardList, feature: 'RPT_FAILED' },
  { id: 'recovery-list', name: 'Listado de recuperación', description: 'Estudiantes que deben presentar recuperación', icon: FileText, feature: 'RPT_RECOVERY' },
  { id: 'performance-level', name: 'Desempeño por nivel', description: 'Distribución de desempeños (Superior, Alto, etc.)', icon: BarChart3, feature: 'RPT_PERFORMANCE' },
  { id: 'comparative', name: 'Comparativo de períodos', description: 'Evolución del rendimiento entre períodos', icon: TrendingUp, feature: 'RPT_COMPARATIVE' },
  { id: 'min-grade', name: 'Nota mínima requerida', description: 'Cálculo de nota necesaria para aprobar', icon: Calculator, feature: 'RPT_MIN_GRADE' },
  { id: 'subject-analysis', name: 'Análisis por asignatura', description: 'Estadísticas detalladas por materia', icon: BookOpen, feature: 'RPT_SUBJECT_ANALYSIS' },
  { id: 'student-history', name: 'Historial académico', description: 'Trayectoria académica del estudiante', icon: Users, feature: 'RPT_STUDENT_HISTORY' },
  { id: 'promotion-projection', name: 'Proyección de promoción', description: 'Estudiantes en riesgo de no promover', icon: GraduationCap, feature: 'RPT_PROMOTION' },
  { id: 'grade-distribution', name: 'Distribución de notas', description: 'Histograma de calificaciones', icon: BarChart3, feature: 'RPT_DISTRIBUTION' },
  { id: 'teacher-performance', name: 'Rendimiento por docente', description: 'Promedios de grupos por docente', icon: Users, feature: 'RPT_TEACHER_PERF' },
]

export default function AcademicReports() {
  const { hasFeature } = useAuth()
  const {
    academicYears, terms, groups, subjects, students,
    filterYear, setFilterYear,
    filterPeriod, setFilterPeriod,
    filterGrade, setFilterGrade,
    filterStudentId, setFilterStudentId,
  } = useReportsData()

  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [loadingReport, setLoadingReport] = useState(false)
  
  // Filtros adicionales
  const [filterLevel, setFilterLevel] = useState('all')
  const [filterProcess, setFilterProcess] = useState('all')
  const [showOnlyFailed, setShowOnlyFailed] = useState(false)
  const [showGrades, setShowGrades] = useState(true)
  const [showPerformance, setShowPerformance] = useState(false)
  const [decimalPlaces, setDecimalPlaces] = useState('1')
  const [showRecovery, setShowRecovery] = useState(false)

  // Datos de reportes
  const [studentsGradesData, setStudentsGradesData] = useState<any[]>([])
  const [minimumGradeData, setMinimumGradeData] = useState<any>(null)
  const [minimumGradeGroupData, setMinimumGradeGroupData] = useState<any[]>([])

  // Filtrar reportes según features
  const filteredReports = academicReports.filter(r => !r.feature || hasFeature(r.feature))

  const handleSelectReport = async (reportId: string) => {
    setSelectedReport(reportId)
    setShowReport(true)
    // No cargar automáticamente, esperar a que el usuario configure filtros
  }

  const loadReportData = async (reportId: string) => {
    if (!filterYear) return
    setLoadingReport(true)

    try {
      // Reportes académicos - notas por estudiante
      if (reportId === 'cons-subjects' || reportId === 'avg-group') {
        if (!filterPeriod) {
          setLoadingReport(false)
          return
        }
        
        const assignmentsRes = await teacherAssignmentsApi.getAll({ academicYearId: filterYear })
        const assignments = assignmentsRes.data || []
        const groupIds = [...new Set(assignments.map((a: any) => a.group?.id).filter(Boolean))]
        
        // Obtener notas de todos los grupos
        const studentGradesMap = new Map<string, any>()
        
        for (const groupId of groupIds) {
          if (filterGrade !== 'all' && groupId !== filterGrade) continue
          
          try {
            const gradesRes = await periodFinalGradesApi.getByGroup(groupId as string, filterPeriod)
            const grades = gradesRes.data || []
            
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
              const studentData = studentGradesMap.get(studentId)
              studentData.grades[g.subject?.name || 'Asignatura'] = Number(g.finalScore)
            })
          } catch (err) {
            // Ignorar errores de grupos individuales
          }
        }
        
        const studentsData = Array.from(studentGradesMap.values()).map((s, idx) => {
          const gradeValues = Object.values(s.grades) as number[]
          const avg = gradeValues.length > 0 ? gradeValues.reduce((a, b) => a + b, 0) / gradeValues.length : 0
          const failedCount = gradeValues.filter(g => g < 3.0).length
          return {
            nro: idx + 1,
            name: s.name,
            group: s.group,
            grades: s.grades,
            average: avg,
            failedCount,
            performance: avg >= 4.6 ? 'Superior' : avg >= 4.0 ? 'Alto' : avg >= 3.0 ? 'Básico' : 'Bajo'
          }
        })
        
        // Filtrar solo reprobados si está activo
        let filteredData = studentsData
        if (showOnlyFailed) {
          filteredData = studentsData.filter(s => s.failedCount > 0 || s.average < 3.0)
        }
        
        setStudentsGradesData(filteredData)
      }

      // Reporte de nota mínima requerida para aprobar
      if (reportId === 'min-grade') {
        try {
          if (filterStudentId && filterStudentId !== 'all') {
            // Reporte individual de un estudiante
            const response = await reportsApi.getMinimumGrade(filterStudentId, filterYear)
            setMinimumGradeData(response.data)
            setMinimumGradeGroupData([])
          } else if (filterGrade && filterGrade !== 'all') {
            // Reporte de todo el grupo
            const response = await reportsApi.getMinimumGradeForGroup(filterGrade, filterYear)
            setMinimumGradeGroupData(response.data || [])
            setMinimumGradeData(null)
          } else {
            setMinimumGradeData(null)
            setMinimumGradeGroupData([])
          }
        } catch (err) {
          console.error('Error loading minimum grade report:', err)
          setMinimumGradeData(null)
          setMinimumGradeGroupData([])
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
    let filename = 'reporte_academico'

    if (selectedReport === 'cons-subjects' || selectedReport === 'avg-group') {
      filename = selectedReport === 'cons-subjects' ? 'consolidado_asignaturas' : 'promedio_grupo'
      
      // Obtener todas las asignaturas únicas
      const allSubjects = new Set<string>()
      studentsGradesData.forEach(s => {
        Object.keys(s.grades).forEach(subj => allSubjects.add(subj))
      })
      const subjectList = Array.from(allSubjects)
      
      csvContent = `Nro,Estudiante,Grupo,${subjectList.join(',')},Promedio,Reprobadas,Desempeño\n`
      studentsGradesData.forEach((row, idx) => {
        const grades = subjectList.map(subj => row.grades[subj]?.toFixed(parseInt(decimalPlaces)) || '-').join(',')
        csvContent += `${idx + 1},"${row.name}","${row.group}",${grades},${row.average.toFixed(parseInt(decimalPlaces))},${row.failedCount},${row.performance}\n`
      })
    } else if (selectedReport === 'min-grade') {
      filename = 'nota_minima_requerida'
      if (minimumGradeGroupData.length > 0) {
        csvContent = 'Nro,Estudiante,Asignatura,Nota Actual,Nota Mínima Requerida,Estado\n'
        minimumGradeGroupData.forEach((row, idx) => {
          csvContent += `${idx + 1},"${row.studentName || ''}","${row.subjectName || ''}",${row.currentGrade || '-'},${row.minimumRequired || '-'},${row.status || ''}\n`
        })
      }
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

  // Renderizar filtros según el reporte
  const renderFilters = () => {
    // Filtros para nota mínima
    if (selectedReport === 'min-grade') {
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
                  <option key={s.enrollmentId || s.id} value={s.enrollmentId || s.id}>{s.lastName} {s.firstName}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => loadReportData(selectedReport!)} className="px-4 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 w-full">
                Calcular Nota Mínima
              </button>
            </div>
          </div>
          <div className="bg-purple-100 rounded-lg p-3 text-sm text-purple-800">
            <strong>💡 ¿Cómo funciona?</strong> Este reporte calcula la nota mínima que necesita cada estudiante en los períodos restantes para aprobar cada asignatura, considerando las notas ya obtenidas y los pesos de cada período.
          </div>
        </div>
      )
    }

    // Filtros académicos generales
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
            <label className="block text-xs font-medium text-slate-600 mb-1">Nivel Educativo</label>
            <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="all">Todos</option>
              <option value="preescolar">Preescolar</option>
              <option value="primaria">Educación Básica Primaria</option>
              <option value="secundaria">Educación Básica Secundaria</option>
              <option value="media">Educación Media</option>
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
            <label className="block text-xs font-medium text-slate-600 mb-1">Período</label>
            <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm">
              <option value="">Seleccionar...</option>
              {terms.map(term => (
                <option key={term.id} value={term.id}>{term.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => loadReportData(selectedReport!)} className="px-4 py-1.5 bg-green-600 text-white rounded text-sm hover:bg-green-700 w-full">Buscar</button>
          </div>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={showOnlyFailed} onChange={(e) => setShowOnlyFailed(e.target.checked)} className="w-4 h-4 rounded" />
            Ver solo reprobadas
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={showGrades} onChange={(e) => setShowGrades(e.target.checked)} className="w-4 h-4 rounded" />
            Ver Notas
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={showPerformance} onChange={(e) => setShowPerformance(e.target.checked)} className="w-4 h-4 rounded" />
            Ver Desempeños
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-slate-600">Decimales:</span>
            <select value={decimalPlaces} onChange={(e) => setDecimalPlaces(e.target.value)} className="px-2 py-1 border border-slate-300 rounded text-sm w-16">
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
            </select>
          </label>
        </div>
      </div>
    )
  }

  // Renderizar tabla de resultados
  const renderReportTable = () => {
    if (loadingReport) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      )
    }

    if ((selectedReport === 'cons-subjects' || selectedReport === 'avg-group') && studentsGradesData.length > 0) {
      // Obtener todas las asignaturas únicas
      const allSubjects = new Set<string>()
      studentsGradesData.forEach(s => {
        Object.keys(s.grades).forEach(subj => allSubjects.add(subj))
      })
      const subjectList = Array.from(allSubjects)

      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left sticky left-0 bg-slate-100">Nro</th>
                <th className="px-3 py-2 text-left sticky left-10 bg-slate-100">Estudiante</th>
                <th className="px-3 py-2 text-left">Grupo</th>
                {showGrades && subjectList.map(subj => (
                  <th key={subj} className="px-3 py-2 text-center whitespace-nowrap">{subj}</th>
                ))}
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
                    const grade = row.grades[subj]
                    const isFailed = grade !== undefined && grade < 3.0
                    return (
                      <td key={subj} className={`px-3 py-2 text-center ${isFailed ? 'text-red-600 font-medium' : ''}`}>
                        {grade !== undefined ? grade.toFixed(parseInt(decimalPlaces)) : '-'}
                      </td>
                    )
                  })}
                  <td className="px-3 py-2 text-center font-medium">{row.average.toFixed(parseInt(decimalPlaces))}</td>
                  <td className="px-3 py-2 text-center">
                    {row.failedCount > 0 ? (
                      <span className="text-red-600 font-medium">{row.failedCount}</span>
                    ) : (
                      <span className="text-green-600">0</span>
                    )}
                  </td>
                  {showPerformance && (
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        row.performance === 'Superior' ? 'bg-green-100 text-green-700' :
                        row.performance === 'Alto' ? 'bg-blue-100 text-blue-700' :
                        row.performance === 'Básico' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>{row.performance}</span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    if (selectedReport === 'min-grade') {
      if (minimumGradeData) {
        // Reporte individual
        return (
          <div className="space-y-4">
            <div className="bg-purple-50 rounded-lg p-4">
              <h4 className="font-medium text-purple-800 mb-2">Estudiante: {minimumGradeData.studentName}</h4>
              <p className="text-sm text-purple-600">Grupo: {minimumGradeData.groupName}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left">Asignatura</th>
                    <th className="px-3 py-2 text-center">Nota Actual</th>
                    <th className="px-3 py-2 text-center">Nota Mínima Requerida</th>
                    <th className="px-3 py-2 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {(minimumGradeData.subjects || []).map((subj: any, idx: number) => (
                    <tr key={idx} className="border-b hover:bg-slate-50">
                      <td className="px-3 py-2 font-medium">{subj.name}</td>
                      <td className="px-3 py-2 text-center">{subj.currentGrade?.toFixed(1) || '-'}</td>
                      <td className="px-3 py-2 text-center font-medium">{subj.minimumRequired?.toFixed(1) || '-'}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-1 rounded text-xs ${
                          subj.status === 'Aprobado' ? 'bg-green-100 text-green-700' :
                          subj.status === 'Posible' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>{subj.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      }

      if (minimumGradeGroupData.length > 0) {
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left">Nro</th>
                  <th className="px-3 py-2 text-left">Estudiante</th>
                  <th className="px-3 py-2 text-left">Asignatura</th>
                  <th className="px-3 py-2 text-center">Nota Actual</th>
                  <th className="px-3 py-2 text-center">Nota Mínima</th>
                  <th className="px-3 py-2 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {minimumGradeGroupData.map((row, idx) => (
                  <tr key={idx} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2">{idx + 1}</td>
                    <td className="px-3 py-2 font-medium">{row.studentName}</td>
                    <td className="px-3 py-2">{row.subjectName}</td>
                    <td className="px-3 py-2 text-center">{row.currentGrade?.toFixed(1) || '-'}</td>
                    <td className="px-3 py-2 text-center font-medium">{row.minimumRequired?.toFixed(1) || '-'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs ${
                        row.status === 'Aprobado' ? 'bg-green-100 text-green-700' :
                        row.status === 'Posible' ? 'bg-amber-100 text-amber-700' :
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
    }

    return (
      <div className="text-center py-12 text-slate-500">
        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
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
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Reportes Académicos</h1>
              <p className="text-sm text-slate-500">Promedios, consolidados y rendimiento estudiantil</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReports.map((report) => (
            <button
              key={report.id}
              onClick={() => handleSelectReport(report.id)}
              className="p-4 bg-white rounded-xl border border-slate-200 hover:border-green-300 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <report.icon className="w-5 h-5 text-green-600" />
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
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              {currentReportData && <currentReportData.icon className="w-5 h-5 text-green-600" />}
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
