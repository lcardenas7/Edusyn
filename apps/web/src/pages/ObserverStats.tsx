import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  BarChart3, Users, AlertTriangle, TrendingUp, Filter,
  ClipboardList, PieChart, Shield, Handshake, Phone,
  Send, BookOpen, CheckCircle, Clock, XCircle, FileText,
  ThumbsUp, ThumbsDown, Percent, Activity, ChevronDown, ChevronUp,
} from 'lucide-react'
import { observerApi, academicYearsApi } from '../lib/api'

const TYPE_LABELS: Record<string, string> = {
  POSITIVE: 'Positiva', PEDAGOGICAL: 'Pedagógica', BEHAVIORAL_MILD: 'Comportamental Leve',
  ACTA_TYPE_I: 'Acta Tipo I', ACTA_TYPE_II: 'Acta Tipo II', ACTA_TYPE_III: 'Acta Tipo III',
  PARENT_CITATION: 'Citación Acudiente', COMMITMENT: 'Compromiso', COUNSELING_FOLLOWUP: 'Seguimiento Orientación',
  REFERRAL: 'Remisión', COMMITTEE_DECISION: 'Decisión Comité', PEDAGOGICAL_FOLLOWUP: 'Seguimiento Pedagógico',
}
const CATEGORY_LABELS: Record<string, string> = { ACADEMIC: 'Académica', BEHAVIORAL: 'Comportamental', ATTENDANCE: 'Asistencia', UNIFORM: 'Uniforme', OTHER: 'Otra' }
const CATEGORY_COLORS: Record<string, string> = { ACADEMIC: '#3b82f6', BEHAVIORAL: '#ef4444', ATTENDANCE: '#f59e0b', UNIFORM: '#a855f7', OTHER: '#94a3b8' }
const CATEGORY_BG: Record<string, string> = { ACADEMIC: 'bg-blue-500', BEHAVIORAL: 'bg-red-500', ATTENDANCE: 'bg-amber-500', UNIFORM: 'bg-purple-500', OTHER: 'bg-slate-400' }
const MONTH_NAMES: Record<string, string> = { '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr', '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic' }

// CSS Donut Chart component
function DonutChart({ segments, size = 120, strokeWidth = 16 }: { segments: { label: string; value: number; color: string }[]; size?: number; strokeWidth?: number }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0)
  if (total === 0) return <div className="flex items-center justify-center" style={{ width: size, height: size }}><span className="text-slate-300 text-xs">Sin datos</span></div>
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  let offset = 0
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.filter(s => s.value > 0).map((seg, i) => {
          const pct = seg.value / total
          const dash = pct * circumference
          const currentOffset = offset
          offset += dash
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={seg.color} strokeWidth={strokeWidth}
              strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-currentOffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`} className="transition-all duration-500" />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-slate-900">{total}</span>
      </div>
    </div>
  )
}

// Rate gauge
function RateGauge({ label, value, color = 'blue' }: { label: string; value: number; color?: string }) {
  const colorMap: Record<string, { bg: string; text: string; track: string }> = {
    blue: { bg: 'bg-blue-500', text: 'text-blue-700', track: 'bg-blue-100' },
    green: { bg: 'bg-green-500', text: 'text-green-700', track: 'bg-green-100' },
    amber: { bg: 'bg-amber-500', text: 'text-amber-700', track: 'bg-amber-100' },
    red: { bg: 'bg-red-500', text: 'text-red-700', track: 'bg-red-100' },
    purple: { bg: 'bg-purple-500', text: 'text-purple-700', track: 'bg-purple-100' },
  }
  const c = colorMap[color] || colorMap.blue
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-xs text-slate-600">{label}</span>
        <span className={`text-sm font-bold ${c.text}`}>{value}%</span>
      </div>
      <div className={`h-2.5 ${c.track} rounded-full overflow-hidden`}>
        <div className={`h-full ${c.bg} rounded-full transition-all duration-700`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  )
}

interface ConvivencialStats {
  total: number; totalEnrollments: number; uniqueStudents: number; positiveCount: number; negativeCount: number
  byType: Record<string, number>; byCategory: Record<string, number>; bySubcategory: Record<string, number>; byStatus: Record<string, number>
  byGroup: Array<{ groupId: string; name: string; count: number; positive: number; negative: number; uniqueStudents: number }>
  byGrade: Array<{ gradeId: string; name: string; count: number; positive: number; negative: number }>
  topStudents: Array<{ enrollmentId: string; name: string; group: string; count: number; positive: number; negative: number; types: Record<string, number> }>
  monthlyTrend: Array<{ month: string; total: number; positive: number; negative: number }>
  rates: { observationsPerStudent: number; studentsWithObservations: number; positiveRate: number; negativeRate: number; resolutionRate: number; parentNotificationRate: number; followUpRate: number }
  actasSummary: { typeI: number; typeII: number; typeIII: number; total: number }
  processIndicators: {
    commitments: { total: number; open: number; inProgress: number; closed: number; resolutionRate: number }
    citations: { total: number; attended: number; notAttended: number; pending: number; attendanceRate: number }
    referrals: { total: number; open: number; closed: number; byRole: Record<string, number> }
    measures: { total: number; open: number; inProgress: number; completed: number; byType: Record<string, number> }
  }
}

type TabType = 'overview' | 'distribution' | 'groups' | 'processes' | 'students'

export default function ObserverStats() {
  const { user } = useAuth()
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [selectedYearId, setSelectedYearId] = useState('')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<ConvivencialStats | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

  useEffect(() => { loadYears() }, [])
  useEffect(() => { if (selectedYearId) loadStats() }, [selectedYearId])

  const loadYears = async () => {
    try {
      const res = await academicYearsApi.getAll()
      const years = res.data || []
      setAcademicYears(years)
      const current = years.find((y: any) => y.isCurrent) || years.find((y: any) => y.status === 'ACTIVE') || years.sort((a: any, b: any) => b.year - a.year)[0]
      if (current) setSelectedYearId(current.id)
    } catch (err) { console.error('Error loading years:', err) }
    finally { setLoading(false) }
  }

  const loadStats = async () => {
    if (!selectedYearId) return
    setLoading(true)
    try {
      const filters: any = {}
      if (startDate) filters.startDate = startDate
      if (endDate) filters.endDate = endDate
      const res = await observerApi.getConvivencialStats(selectedYearId, filters)
      setStats(res.data)
    } catch (err) { console.error('Error loading stats:', err) }
    finally { setLoading(false) }
  }

  const maxMonthly = useMemo(() => {
    if (!stats || stats.monthlyTrend.length === 0) return 1
    return Math.max(...stats.monthlyTrend.map(m => m.total), 1)
  }, [stats])

  if (loading && !stats) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
  }

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'overview', label: 'Resumen General', icon: BarChart3 },
    { key: 'distribution', label: 'Distribuciones', icon: PieChart },
    { key: 'groups', label: 'Por Grupo/Grado', icon: Users },
    { key: 'processes', label: 'Procesos', icon: Activity },
    { key: 'students', label: 'Estudiantes', icon: ClipboardList },
  ]

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Informe Convivencial</h1>
          <p className="text-sm text-slate-500 mt-1">Reportes y estadísticas para el comité de convivencia escolar</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Año Académico</label>
            <select value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
              <option value="">Seleccionar...</option>
              {academicYears.map((y: any) => <option key={y.id} value={y.id}>{y.year}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Inicio</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Fecha Fin</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <button onClick={loadStats} className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            <Filter className="w-4 h-4" /> Filtrar
          </button>
        </div>
      </div>

      {!stats ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Selecciona un año académico para ver las estadísticas</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ═══ KPI Cards ═══ */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Observaciones', value: stats.total, icon: ClipboardList, color: 'blue' },
              { label: 'Estudiantes', value: `${stats.uniqueStudents} / ${stats.totalEnrollments}`, icon: Users, color: 'purple' },
              { label: 'Positivas', value: stats.positiveCount, icon: ThumbsUp, color: 'green' },
              { label: 'Negativas', value: stats.negativeCount, icon: ThumbsDown, color: 'red' },
              { label: 'Casos Abiertos', value: stats.byStatus['OPEN'] || 0, icon: Clock, color: 'amber' },
              { label: 'Actas Formales', value: stats.actasSummary.total, icon: Shield, color: 'rose' },
            ].map((kpi, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <kpi.icon className={`w-4 h-4 text-${kpi.color}-600`} />
                  <span className="text-[10px] uppercase font-medium text-slate-500 truncate">{kpi.label}</span>
                </div>
                <p className={`text-xl font-bold text-${kpi.color}-700`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* ═══ Tabs ═══ */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1 overflow-x-auto">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${activeTab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <t.icon className="w-4 h-4" />{t.label}
              </button>
            ))}
          </div>

          {/* ═══ TAB: OVERVIEW ═══ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Rates */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><Percent className="w-4 h-4" /> Indicadores Porcentuales</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <RateGauge label="Tasa de resolución" value={stats.rates.resolutionRate} color="green" />
                  <RateGauge label="% Positivas" value={stats.rates.positiveRate} color="green" />
                  <RateGauge label="% Negativas" value={stats.rates.negativeRate} color="red" />
                  <RateGauge label="Estudiantes con obs." value={stats.rates.studentsWithObservations} color="purple" />
                  <RateGauge label="Notificación padres" value={stats.rates.parentNotificationRate} color="blue" />
                  <RateGauge label="Requieren seguimiento" value={stats.rates.followUpRate} color="amber" />
                  <div>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs text-slate-600">Obs. por estudiante</span>
                      <span className="text-sm font-bold text-slate-700">{stats.rates.observationsPerStudent}</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-400 rounded-full" style={{ width: `${Math.min(stats.rates.observationsPerStudent * 20, 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Donut + Actas side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Donut */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-4">Distribución por Categoría</h3>
                  <div className="flex items-center gap-6">
                    <DonutChart segments={Object.entries(stats.byCategory).map(([cat, count]) => ({ label: CATEGORY_LABELS[cat] || cat, value: count, color: CATEGORY_COLORS[cat] || '#94a3b8' }))} />
                    <div className="flex-1 space-y-2">
                      {Object.entries(stats.byCategory).sort(([,a],[,b]) => b - a).map(([cat, count]) => (
                        <div key={cat} className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${CATEGORY_BG[cat] || 'bg-slate-400'}`} />
                          <span className="text-xs text-slate-600 flex-1">{CATEGORY_LABELS[cat] || cat}</span>
                          <span className="text-xs font-bold text-slate-900">{count}</span>
                          <span className="text-[10px] text-slate-400">{stats.total > 0 ? Math.round((count / stats.total) * 100) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actas Ley 1620 */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2"><Shield className="w-4 h-4 text-red-600" /> Actas por Tipo — Ley 1620</h3>
                  <p className="text-[10px] text-slate-400 mb-4">Clasificación según el manual de convivencia escolar</p>
                  <div className="space-y-3">
                    {[
                      { label: 'Tipo I (Leve)', desc: 'Conflictos manejados inadecuadamente', count: stats.actasSummary.typeI, color: 'amber' },
                      { label: 'Tipo II (Grave)', desc: 'Agresión escolar, acoso, ciberacoso', count: stats.actasSummary.typeII, color: 'orange' },
                      { label: 'Tipo III (Gravísima)', desc: 'Presunto delito', count: stats.actasSummary.typeIII, color: 'red' },
                    ].map((acta, i) => (
                      <div key={i} className={`flex items-center gap-3 p-3 bg-${acta.color}-50 border border-${acta.color}-200 rounded-lg`}>
                        <div className={`w-10 h-10 rounded-full bg-${acta.color}-100 flex items-center justify-center`}>
                          <span className={`text-lg font-bold text-${acta.color}-700`}>{acta.count}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium text-${acta.color}-800`}>{acta.label}</p>
                          <p className={`text-[10px] text-${acta.color}-600 truncate`}>{acta.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Monthly Trend — stacked bars */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Tendencia Mensual</h3>
                <div className="flex items-center gap-4 mb-3 text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded" />Total</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded" />Positivas</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded" />Negativas</span>
                </div>
                <div className="flex items-end gap-1 h-48">
                  {stats.monthlyTrend.map((m) => (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute -top-8 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {m.total} total · {m.positive} pos · {m.negative} neg
                      </div>
                      <span className="text-[10px] font-medium text-slate-600">{m.total}</span>
                      <div className="w-full flex flex-col gap-px" style={{ height: `${(m.total / maxMonthly) * 100}%`, minHeight: 4 }}>
                        {m.positive > 0 && <div className="bg-green-500 rounded-t" style={{ flex: m.positive }} />}
                        {m.negative > 0 && <div className="bg-red-400" style={{ flex: m.negative }} />}
                        {(m.total - m.positive - m.negative) > 0 && <div className="bg-blue-400 rounded-b" style={{ flex: m.total - m.positive - m.negative }} />}
                      </div>
                      <span className="text-[10px] text-slate-500">{MONTH_NAMES[m.month.slice(5)] || m.month.slice(5)}</span>
                    </div>
                  ))}
                  {stats.monthlyTrend.length === 0 && <p className="text-sm text-slate-400 text-center w-full py-8">Sin datos de tendencia</p>}
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB: DISTRIBUTION ═══ */}
          {activeTab === 'distribution' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Status Donut */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-4">Estado de Casos</h3>
                  <div className="flex items-center gap-6">
                    <DonutChart segments={[
                      { label: 'Abierto', value: stats.byStatus['OPEN'] || 0, color: '#3b82f6' },
                      { label: 'En seguimiento', value: stats.byStatus['IN_PROGRESS'] || 0, color: '#f59e0b' },
                      { label: 'Cerrado', value: stats.byStatus['CLOSED'] || 0, color: '#22c55e' },
                    ]} />
                    <div className="flex-1 space-y-3">
                      {[
                        { label: 'Abierto', count: stats.byStatus['OPEN'] || 0, color: 'blue', icon: Clock },
                        { label: 'En seguimiento', count: stats.byStatus['IN_PROGRESS'] || 0, color: 'amber', icon: Activity },
                        { label: 'Cerrado', count: stats.byStatus['CLOSED'] || 0, color: 'green', icon: CheckCircle },
                      ].map(s => (
                        <div key={s.label} className="flex items-center gap-2">
                          <s.icon className={`w-4 h-4 text-${s.color}-600`} />
                          <span className="text-xs text-slate-600 flex-1">{s.label}</span>
                          <span className="text-sm font-bold text-slate-900">{s.count}</span>
                          <span className="text-[10px] text-slate-400">{stats.total > 0 ? Math.round((s.count / stats.total) * 100) : 0}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Positive vs Negative Donut */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-4">Positivas vs Negativas</h3>
                  <div className="flex items-center gap-6">
                    <DonutChart segments={[
                      { label: 'Positivas', value: stats.positiveCount, color: '#22c55e' },
                      { label: 'Negativas', value: stats.negativeCount, color: '#ef4444' },
                      { label: 'Otras', value: stats.total - stats.positiveCount - stats.negativeCount, color: '#94a3b8' },
                    ]} />
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2"><ThumbsUp className="w-4 h-4 text-green-600" /><span className="text-xs flex-1">Positivas</span><span className="text-sm font-bold text-green-700">{stats.positiveCount}</span></div>
                      <div className="flex items-center gap-2"><ThumbsDown className="w-4 h-4 text-red-600" /><span className="text-xs flex-1">Negativas</span><span className="text-sm font-bold text-red-700">{stats.negativeCount}</span></div>
                      <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /><span className="text-xs flex-1">Otras</span><span className="text-sm font-bold text-slate-600">{stats.total - stats.positiveCount - stats.negativeCount}</span></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* By Type — full width */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Distribución por Tipo de Observación</h3>
                <div className="space-y-2">
                  {Object.entries(stats.byType).sort(([,a],[,b]) => b - a).map(([type, count]) => {
                    const maxType = Math.max(...Object.values(stats.byType), 1)
                    const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
                    return (
                      <div key={type} className="flex items-center gap-3">
                        <span className="text-xs text-slate-600 w-44 truncate">{TYPE_LABELS[type] || type}</span>
                        <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden relative">
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${(count / maxType) * 100}%` }} />
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-slate-700">{count} ({pct}%)</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* By Subcategory */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Distribución por Subcategoría</h3>
                {Object.keys(stats.bySubcategory).length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">No hay subcategorías registradas aún. Al crear observaciones, seleccione una subcategoría.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.entries(stats.bySubcategory).sort(([,a],[,b]) => b - a).map(([sub, count]) => {
                      const maxSub = Math.max(...Object.values(stats.bySubcategory), 1)
                      return (
                        <div key={sub} className="flex items-center gap-2">
                          <span className="text-xs text-slate-600 w-36 truncate capitalize">{sub.toLowerCase().replace(/_/g, ' ')}</span>
                          <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(count / maxSub) * 100}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-700 w-8 text-right">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══ TAB: GROUPS ═══ */}
          {activeTab === 'groups' && (
            <div className="space-y-6">
              {/* By Grade — Comparative */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Comparativo por Grado</h3>
                <div className="space-y-3">
                  {stats.byGrade.map(g => {
                    const maxG = Math.max(...stats.byGrade.map(x => x.count), 1)
                    return (
                      <div key={g.gradeId}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-medium text-slate-700">{g.name}</span>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-green-600">{g.positive} pos</span>
                            <span className="text-red-600">{g.negative} neg</span>
                            <span className="font-bold text-slate-900">{g.count} total</span>
                          </div>
                        </div>
                        <div className="h-5 bg-slate-100 rounded-full overflow-hidden flex">
                          {g.positive > 0 && <div className="h-full bg-green-500" style={{ width: `${(g.positive / maxG) * 100}%` }} />}
                          {g.negative > 0 && <div className="h-full bg-red-400" style={{ width: `${(g.negative / maxG) * 100}%` }} />}
                          {(g.count - g.positive - g.negative) > 0 && <div className="h-full bg-blue-400" style={{ width: `${((g.count - g.positive - g.negative) / maxG) * 100}%` }} />}
                        </div>
                      </div>
                    )
                  })}
                  {stats.byGrade.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Sin datos</p>}
                </div>
              </div>

              {/* By Group — Expandable */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-900">Detalle por Grupo</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {stats.byGroup.map(g => (
                    <div key={g.groupId}>
                      <button onClick={() => setExpandedGroup(expandedGroup === g.groupId ? null : g.groupId)}
                        className="w-full flex items-center gap-3 px-6 py-3 hover:bg-slate-50 transition-colors">
                        {expandedGroup === g.groupId ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        <span className="text-sm font-medium text-slate-800 flex-1 text-left">{g.name}</span>
                        <span className="text-xs text-purple-600">{g.uniqueStudents} est.</span>
                        <span className="text-xs text-green-600">{g.positive} pos</span>
                        <span className="text-xs text-red-600">{g.negative} neg</span>
                        <span className="text-sm font-bold text-slate-900 w-12 text-right">{g.count}</span>
                      </button>
                      {expandedGroup === g.groupId && (
                        <div className="px-6 pb-4 pt-1 bg-slate-50">
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-white rounded-lg p-3 border border-slate-200">
                              <p className="text-lg font-bold text-purple-700">{g.uniqueStudents}</p>
                              <p className="text-[10px] text-slate-500">Estudiantes involucrados</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-slate-200">
                              <p className="text-lg font-bold text-green-700">{g.count > 0 ? Math.round((g.positive / g.count) * 100) : 0}%</p>
                              <p className="text-[10px] text-slate-500">% Positivas</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-slate-200">
                              <p className="text-lg font-bold text-red-700">{g.count > 0 ? Math.round((g.negative / g.count) * 100) : 0}%</p>
                              <p className="text-[10px] text-slate-500">% Negativas</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {stats.byGroup.length === 0 && <div className="p-8 text-center text-slate-400">Sin datos</div>}
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB: PROCESSES ═══ */}
          {activeTab === 'processes' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Commitments */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Handshake className="w-5 h-5 text-amber-600" />
                    <h4 className="text-sm font-semibold text-slate-900">Compromisos</h4>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 mb-2">{stats.processIndicators.commitments.total}</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Abiertos</span><span className="font-medium text-blue-600">{stats.processIndicators.commitments.open}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">En progreso</span><span className="font-medium text-amber-600">{stats.processIndicators.commitments.inProgress}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Cerrados</span><span className="font-medium text-green-600">{stats.processIndicators.commitments.closed}</span></div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <RateGauge label="Tasa de cumplimiento" value={stats.processIndicators.commitments.resolutionRate} color="green" />
                  </div>
                </div>

                {/* Citations */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Phone className="w-5 h-5 text-purple-600" />
                    <h4 className="text-sm font-semibold text-slate-900">Citaciones</h4>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 mb-2">{stats.processIndicators.citations.total}</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Atendidas</span><span className="font-medium text-green-600">{stats.processIndicators.citations.attended}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">No atendidas</span><span className="font-medium text-red-600">{stats.processIndicators.citations.notAttended}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Pendientes</span><span className="font-medium text-amber-600">{stats.processIndicators.citations.pending}</span></div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <RateGauge label="Tasa de asistencia" value={stats.processIndicators.citations.attendanceRate} color="purple" />
                  </div>
                </div>

                {/* Referrals */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Send className="w-5 h-5 text-indigo-600" />
                    <h4 className="text-sm font-semibold text-slate-900">Remisiones</h4>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 mb-2">{stats.processIndicators.referrals.total}</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Abiertas</span><span className="font-medium text-blue-600">{stats.processIndicators.referrals.open}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Cerradas</span><span className="font-medium text-green-600">{stats.processIndicators.referrals.closed}</span></div>
                  </div>
                  {Object.keys(stats.processIndicators.referrals.byRole).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                      <p className="text-[10px] uppercase font-medium text-slate-400 mb-1">Por Rol</p>
                      {Object.entries(stats.processIndicators.referrals.byRole).map(([role, count]) => (
                        <div key={role} className="flex justify-between text-xs">
                          <span className="text-slate-500 capitalize">{role.toLowerCase().replace(/_/g, ' ')}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Measures */}
                <div className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-5 h-5 text-teal-600" />
                    <h4 className="text-sm font-semibold text-slate-900">Medidas Pedagógicas</h4>
                  </div>
                  <p className="text-3xl font-bold text-slate-900 mb-2">{stats.processIndicators.measures.total}</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">Abiertas</span><span className="font-medium text-blue-600">{stats.processIndicators.measures.open}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">En progreso</span><span className="font-medium text-amber-600">{stats.processIndicators.measures.inProgress}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Completadas</span><span className="font-medium text-green-600">{stats.processIndicators.measures.completed}</span></div>
                  </div>
                  {Object.keys(stats.processIndicators.measures.byType).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                      <p className="text-[10px] uppercase font-medium text-slate-400 mb-1">Por Tipo</p>
                      {Object.entries(stats.processIndicators.measures.byType).map(([mType, count]) => (
                        <div key={mType} className="flex justify-between text-xs">
                          <span className="text-slate-500 capitalize">{mType.toLowerCase().replace(/_/g, ' ')}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Process Summary */}
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Resumen de Procesos Convivenciales</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Proceso</th>
                        <th className="text-center px-4 py-2 text-xs font-medium text-slate-500">Total</th>
                        <th className="text-center px-4 py-2 text-xs font-medium text-slate-500">Abiertos</th>
                        <th className="text-center px-4 py-2 text-xs font-medium text-slate-500">Cerrados</th>
                        <th className="text-center px-4 py-2 text-xs font-medium text-slate-500">Tasa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr><td className="px-4 py-2 font-medium">Compromisos</td><td className="text-center px-4 py-2">{stats.processIndicators.commitments.total}</td><td className="text-center px-4 py-2 text-blue-600">{stats.processIndicators.commitments.open + stats.processIndicators.commitments.inProgress}</td><td className="text-center px-4 py-2 text-green-600">{stats.processIndicators.commitments.closed}</td><td className="text-center px-4 py-2 font-bold">{stats.processIndicators.commitments.resolutionRate}%</td></tr>
                      <tr><td className="px-4 py-2 font-medium">Citaciones</td><td className="text-center px-4 py-2">{stats.processIndicators.citations.total}</td><td className="text-center px-4 py-2 text-amber-600">{stats.processIndicators.citations.pending}</td><td className="text-center px-4 py-2 text-green-600">{stats.processIndicators.citations.attended}</td><td className="text-center px-4 py-2 font-bold">{stats.processIndicators.citations.attendanceRate}%</td></tr>
                      <tr><td className="px-4 py-2 font-medium">Remisiones</td><td className="text-center px-4 py-2">{stats.processIndicators.referrals.total}</td><td className="text-center px-4 py-2 text-blue-600">{stats.processIndicators.referrals.open}</td><td className="text-center px-4 py-2 text-green-600">{stats.processIndicators.referrals.closed}</td><td className="text-center px-4 py-2 font-bold">{stats.processIndicators.referrals.total > 0 ? Math.round((stats.processIndicators.referrals.closed / stats.processIndicators.referrals.total) * 100) : 0}%</td></tr>
                      <tr><td className="px-4 py-2 font-medium">Medidas</td><td className="text-center px-4 py-2">{stats.processIndicators.measures.total}</td><td className="text-center px-4 py-2 text-blue-600">{stats.processIndicators.measures.open + stats.processIndicators.measures.inProgress}</td><td className="text-center px-4 py-2 text-green-600">{stats.processIndicators.measures.completed}</td><td className="text-center px-4 py-2 font-bold">{stats.processIndicators.measures.total > 0 ? Math.round((stats.processIndicators.measures.completed / stats.processIndicators.measures.total) * 100) : 0}%</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB: STUDENTS ═══ */}
          {activeTab === 'students' && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-900">Top 15 Estudiantes — Seguimiento Especial</h3>
                <p className="text-[10px] text-slate-400 mt-1">Estudiantes con mayor cantidad de observaciones registradas</p>
              </div>
              {stats.topStudents.length === 0 ? (
                <div className="p-8 text-center text-slate-400">Sin datos</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-center px-3 py-3 text-xs font-medium text-slate-500 w-10">#</th>
                        <th className="text-left px-3 py-3 text-xs font-medium text-slate-500">Estudiante</th>
                        <th className="text-left px-3 py-3 text-xs font-medium text-slate-500">Grupo</th>
                        <th className="text-center px-3 py-3 text-xs font-medium text-slate-500">Total</th>
                        <th className="text-center px-3 py-3 text-xs font-medium text-slate-500">Positivas</th>
                        <th className="text-center px-3 py-3 text-xs font-medium text-slate-500">Negativas</th>
                        <th className="px-3 py-3 text-xs font-medium text-slate-500 text-left">Proporción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {stats.topStudents.map((s, idx) => (
                        <tr key={s.enrollmentId} className="hover:bg-slate-50">
                          <td className="px-3 py-3 text-center text-sm font-medium text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-3 text-sm font-medium text-slate-900">{s.name}</td>
                          <td className="px-3 py-3 text-sm text-slate-600">{s.group}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${s.count >= 5 ? 'bg-red-100 text-red-700' : s.count >= 3 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}`}>{s.count}</span>
                          </td>
                          <td className="px-3 py-3 text-center text-sm text-green-600 font-medium">{s.positive}</td>
                          <td className="px-3 py-3 text-center text-sm text-red-600 font-medium">{s.negative}</td>
                          <td className="px-3 py-3">
                            <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 w-32">
                              {s.positive > 0 && <div className="bg-green-500" style={{ width: `${(s.positive / s.count) * 100}%` }} />}
                              {s.negative > 0 && <div className="bg-red-400" style={{ width: `${(s.negative / s.count) * 100}%` }} />}
                              {(s.count - s.positive - s.negative) > 0 && <div className="bg-blue-300" style={{ width: `${((s.count - s.positive - s.negative) / s.count) * 100}%` }} />}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
