import { useState, useMemo } from 'react'
import { toast } from '../../lib/toast'
import {
  ClipboardList,
  Download,
  Printer,
  ArrowLeft,
  ChevronLeft,
  CheckCircle,
  BarChart3,
  FileText,
  Users,
  AlertCircle,
  XCircle,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useReportsData } from '../../hooks/useReportsData'
import { useAuth } from '../../contexts/AuthContext'
import { useSortable, SortableHeader } from '../../components/reports/SortableTable'

interface ReportItem {
  id: string
  name: string
  description: string
  icon: any
  feature?: string
}

const evaluationReports: ReportItem[] = [
  { id: 'eval-compliance', name: 'Cumplimiento SIEE', description: 'Verificación del sistema de evaluación institucional', icon: CheckCircle },
  { id: 'eval-criteria', name: 'Criterios de evaluación', description: 'Configuración de criterios por asignatura', icon: ClipboardList },
  { id: 'eval-weights', name: 'Pesos de períodos', description: 'Distribución de porcentajes por período', icon: BarChart3 },
  { id: 'eval-recovery', name: 'Políticas de recuperación', description: 'Configuración de actividades de recuperación', icon: FileText },
  { id: 'eval-promotion', name: 'Criterios de promoción', description: 'Reglas para promoción de estudiantes', icon: Users },
  { id: 'eval-scale', name: 'Escala de valoración', description: 'Niveles de desempeño configurados', icon: BarChart3 },
]

export default function EvaluationReports() {
  const { hasFeature, institution } = useAuth()
  const {
    academicYears, terms, gradingScale, rulesContext,
    filterYear, setFilterYear,
  } = useReportsData()

  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [showReport, setShowReport] = useState(false)
  const { sortData, sortState } = useSortable<any>()

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

  // ═══════════════════════════════════════════════════════════════════════
  // CÁLCULOS DE CUMPLIMIENTO SIEE
  // ═══════════════════════════════════════════════════════════════════════
  const complianceChecks = useMemo(() => {
    const checks: Array<{ id: string; label: string; status: 'ok' | 'warn' | 'error'; detail: string }> = []

    // 1. Escala institucional configurada
    if (gradingScale.maxGrade > gradingScale.minGrade && gradingScale.minPassingGrade > 0) {
      checks.push({ id: 'scale', label: 'Escala de valoración', status: 'ok',
        detail: `${gradingScale.minGrade} a ${gradingScale.maxGrade} (aprobatoria ≥ ${gradingScale.minPassingGrade})` })
    } else {
      checks.push({ id: 'scale', label: 'Escala de valoración', status: 'error', detail: 'No configurada' })
    }

    // 2. Niveles de desempeño
    if (gradingScale.performanceLevels.length > 0) {
      checks.push({ id: 'levels', label: 'Niveles de desempeño', status: 'ok',
        detail: `${gradingScale.performanceLevels.length} niveles definidos` })
    } else {
      checks.push({ id: 'levels', label: 'Niveles de desempeño', status: 'warn',
        detail: 'Sin niveles — se usará clasificación por porcentaje' })
    }

    // 3. Períodos del año seleccionado
    if (terms.length > 0) {
      checks.push({ id: 'terms', label: 'Períodos académicos', status: 'ok',
        detail: `${terms.length} período(s) configurado(s)` })
    } else {
      checks.push({ id: 'terms', label: 'Períodos académicos', status: 'error', detail: 'Sin períodos en el año seleccionado' })
    }

    // 4. Suma de pesos de períodos = 100%
    const sumWeights = terms.reduce((s: number, t: any) => s + (Number(t.weightPercentage) || 0), 0)
    if (terms.length > 0) {
      if (Math.abs(sumWeights - 100) < 0.01) {
        checks.push({ id: 'weights', label: 'Pesos de períodos', status: 'ok', detail: `Suma = 100%` })
      } else if (sumWeights === 0) {
        checks.push({ id: 'weights', label: 'Pesos de períodos', status: 'warn',
          detail: 'Todos los períodos tienen peso 0% (se usará peso igualitario)' })
      } else {
        checks.push({ id: 'weights', label: 'Pesos de períodos', status: 'error',
          detail: `Suma = ${sumWeights}% (debería ser 100%)` })
      }
    }

    // 5. Niveles educativos (PRE / numérico)
    if (gradingScale.academicLevels.length > 0) {
      checks.push({ id: 'academicLevels', label: 'Niveles educativos', status: 'ok',
        detail: `${gradingScale.academicLevels.length} nivel(es) configurado(s)` })
    } else {
      checks.push({ id: 'academicLevels', label: 'Niveles educativos', status: 'warn', detail: 'Sin niveles educativos' })
    }

    // 6. Reglas de promoción
    const maxFailed = rulesContext.maxFailedSubjectsForPromotion ?? null
    const minAtt = rulesContext.minAttendancePercentage ?? null
    if (maxFailed !== null || minAtt !== null) {
      checks.push({ id: 'promotion', label: 'Criterios de promoción', status: 'ok',
        detail: `Máx. áreas perdidas: ${maxFailed ?? '—'} · Asistencia mín.: ${minAtt ?? '—'}%` })
    } else {
      checks.push({ id: 'promotion', label: 'Criterios de promoción', status: 'warn', detail: 'Sin reglas de promoción configuradas' })
    }

    return checks
  }, [gradingScale, terms, rulesContext])

  const complianceScore = useMemo(() => {
    const total = complianceChecks.length || 1
    const ok = complianceChecks.filter(c => c.status === 'ok').length
    return Math.round((ok / total) * 100)
  }, [complianceChecks])

  // ═══════════════════════════════════════════════════════════════════════
  // EXPORT CSV
  // ═══════════════════════════════════════════════════════════════════════
  const exportToCSV = () => {
    const instName = institution?.name || 'Institución'
    const now = new Date().toLocaleString('es-CO')
    const header = `"Institución","${instName}"\n"Reporte","${currentReportData?.name || ''}"\n"Generado","${now}"\n\n`
    let body = ''
    let filename = 'evaluacion'

    if (selectedReport === 'eval-scale') {
      filename = 'escala_valoracion'
      body = 'Nivel,Rango mínimo,Rango máximo,Orden,Color\n'
      gradingScale.performanceLevels.sort((a, b) => a.order - b.order).forEach(l => {
        body += `"${l.name}",${l.minScore},${l.maxScore},${l.order},"${l.color || ''}"\n`
      })
    } else if (selectedReport === 'eval-weights') {
      filename = 'pesos_periodos'
      body = 'Orden,Período,Peso %,Estado\n'
      terms.forEach((t: any) => {
        body += `${t.order ?? '-'},"${t.name}",${t.weightPercentage ?? 0},"${t.status || 'N/A'}"\n`
      })
    } else if (selectedReport === 'eval-compliance') {
      filename = 'cumplimiento_siee'
      body = 'Ítem,Estado,Detalle\n'
      complianceChecks.forEach(c => {
        body += `"${c.label}","${c.status === 'ok' ? 'OK' : c.status === 'warn' ? 'Advertencia' : 'Error'}","${c.detail}"\n`
      })
    } else if (selectedReport === 'eval-promotion') {
      filename = 'criterios_promocion'
      body = 'Criterio,Valor\n'
      body += `"Nota mínima aprobatoria",${rulesContext.minPassingGrade}\n`
      body += `"Máximo áreas reprobadas",${rulesContext.maxFailedSubjectsForPromotion ?? '—'}\n`
      body += `"Asistencia mínima %",${rulesContext.minAttendancePercentage ?? '—'}\n`
      body += `"Escala mínima",${rulesContext.minGradeValue}\n`
      body += `"Escala máxima",${rulesContext.maxGradeValue}\n`
    }

    if (!body) { toast.warning('No hay datos para exportar'); return }
    const blob = new Blob(['\ufeff' + header + body], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  // ═══════════════════════════════════════════════════════════════════════
  // FILTROS
  // ═══════════════════════════════════════════════════════════════════════
  const renderFilters = () => {
    // Reportes de configuración pura no necesitan filtro de año
    const needsYear = selectedReport === 'eval-compliance' || selectedReport === 'eval-weights'
    if (!needsYear) return null
    return (
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-4">
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
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════
  // CONTENIDO DE REPORTES
  // ═══════════════════════════════════════════════════════════════════════
  const StatusIcon = ({ status }: { status: 'ok' | 'warn' | 'error' }) =>
    status === 'ok' ? <CheckCircle className="w-5 h-5 text-green-600" />
    : status === 'warn' ? <AlertCircle className="w-5 h-5 text-amber-600" />
    : <XCircle className="w-5 h-5 text-red-600" />

  const renderReportContent = () => {
    // ── Escala de valoración ──
    if (selectedReport === 'eval-scale') {
      const levels = [...gradingScale.performanceLevels].sort((a, b) => a.order - b.order)
      if (levels.length === 0) {
        return (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">No hay niveles de desempeño configurados</p>
            <p className="text-sm text-slate-500 mt-1">Configure los niveles en Ajustes → Evaluación.</p>
          </div>
        )
      }
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 text-center"><p className="text-xs text-slate-500 uppercase">Escala</p><p className="text-xl font-bold text-slate-700">{gradingScale.minGrade} – {gradingScale.maxGrade}</p></div>
            <div className="bg-amber-50 rounded-xl p-3 text-center"><p className="text-xs text-amber-600 uppercase">Nota aprobatoria</p><p className="text-xl font-bold text-amber-700">≥ {gradingScale.minPassingGrade}</p></div>
            <div className="bg-blue-50 rounded-xl p-3 text-center"><p className="text-xs text-blue-600 uppercase">Niveles</p><p className="text-xl font-bold text-blue-700">{levels.length}</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100"><tr>
                <SortableHeader column="order" label="Orden" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="name" label="Nivel" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="minScore" label="Rango mínimo" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="maxScore" label="Rango máximo" align="center" sort={sortState} className="px-3 py-2" />
                <th className="px-3 py-2 text-center">Color</th>
              </tr></thead>
              <tbody>
                {sortData(levels).map((l, i) => (
                  <tr key={i} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2 text-center font-medium">{l.order}</td>
                    <td className="px-3 py-2 font-medium">{l.name}</td>
                    <td className="px-3 py-2 text-center">{l.minScore}</td>
                    <td className="px-3 py-2 text-center">{l.maxScore}</td>
                    <td className="px-3 py-2 text-center">
                      {l.color ? <span className="inline-block w-6 h-6 rounded border border-slate-300" style={{ backgroundColor: l.color }} /> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    // ── Pesos de períodos ──
    if (selectedReport === 'eval-weights') {
      if (!filterYear) return <p className="text-center py-12 text-slate-500">Seleccione un año escolar</p>
      if (terms.length === 0) return <p className="text-center py-12 text-slate-500">No hay períodos configurados para este año</p>
      const sumWeights = terms.reduce((s: number, t: any) => s + (Number(t.weightPercentage) || 0), 0)
      const ok = Math.abs(sumWeights - 100) < 0.01
      return (
        <div className="space-y-4">
          <div className={`rounded-xl p-4 flex items-center gap-3 ${ok ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            <StatusIcon status={ok ? 'ok' : 'warn'} />
            <div>
              <p className="font-medium text-slate-800">Suma total: {sumWeights}%</p>
              <p className="text-xs text-slate-600">{ok ? 'La suma de pesos es correcta (100%)' : 'La suma debería ser 100% — verifique la configuración de períodos'}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100"><tr>
                <SortableHeader column="order" label="Orden" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="name" label="Período" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="weightPercentage" label="Peso %" align="center" sort={sortState} className="px-3 py-2" />
                <SortableHeader column="status" label="Estado" align="center" sort={sortState} className="px-3 py-2" />
              </tr></thead>
              <tbody>
                {sortData(terms).map((t: any, i: number) => (
                  <tr key={i} className="border-b hover:bg-slate-50">
                    <td className="px-3 py-2 text-center">{t.order ?? '—'}</td>
                    <td className="px-3 py-2 font-medium">{t.name}</td>
                    <td className="px-3 py-2 text-center font-bold">{t.weightPercentage ?? 0}%</td>
                    <td className="px-3 py-2 text-center">
                      <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600">{t.status || 'N/A'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }

    // ── Cumplimiento SIEE ──
    if (selectedReport === 'eval-compliance') {
      const errorCount = complianceChecks.filter(c => c.status === 'error').length
      const warnCount = complianceChecks.filter(c => c.status === 'warn').length
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className={`rounded-xl p-4 text-center ${complianceScore >= 80 ? 'bg-green-50' : complianceScore >= 50 ? 'bg-amber-50' : 'bg-red-50'}`}>
              <p className="text-xs uppercase text-slate-500">Cumplimiento</p>
              <p className={`text-3xl font-bold ${complianceScore >= 80 ? 'text-green-700' : complianceScore >= 50 ? 'text-amber-700' : 'text-red-700'}`}>{complianceScore}%</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 text-center"><p className="text-xs uppercase text-amber-600">Advertencias</p><p className="text-3xl font-bold text-amber-700">{warnCount}</p></div>
            <div className="bg-red-50 rounded-xl p-4 text-center"><p className="text-xs uppercase text-red-600">Errores</p><p className="text-3xl font-bold text-red-700">{errorCount}</p></div>
          </div>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {complianceChecks.map(c => (
              <div key={c.id} className={`px-4 py-3 flex items-center gap-3 ${c.status === 'error' ? 'bg-red-50/40' : c.status === 'warn' ? 'bg-amber-50/40' : ''}`}>
                <StatusIcon status={c.status} />
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{c.label}</p>
                  <p className="text-xs text-slate-600">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    }

    // ── Criterios de promoción ──
    if (selectedReport === 'eval-promotion') {
      const rows = [
        { criterion: 'Nota mínima aprobatoria', value: rulesContext.minPassingGrade },
        { criterion: 'Máximo de áreas reprobadas', value: rulesContext.maxFailedSubjectsForPromotion ?? '—' },
        { criterion: 'Asistencia mínima (%)', value: rulesContext.minAttendancePercentage != null ? `${rulesContext.minAttendancePercentage}%` : '—' },
        { criterion: 'Escala mínima', value: rulesContext.minGradeValue },
        { criterion: 'Escala máxima', value: rulesContext.maxGradeValue },
      ]
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100"><tr>
              <th className="px-3 py-2 text-left">Criterio</th>
              <th className="px-3 py-2 text-center">Valor configurado</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b hover:bg-slate-50">
                  <td className="px-3 py-2 font-medium">{r.criterion}</td>
                  <td className="px-3 py-2 text-center font-bold">{String(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }

    // ── Reportes pendientes de implementación ──
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <ClipboardList className="w-10 h-10 text-purple-600" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 mb-2">{currentReportData?.name}</h3>
        <p className="text-slate-500 mb-6 max-w-md mx-auto">{currentReportData?.description}</p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 max-w-lg mx-auto text-left">
          <p className="text-sm text-amber-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Este reporte estará disponible próximamente.
          </p>
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
        {renderReportContent()}
      </div>
    </div>
  )
}
