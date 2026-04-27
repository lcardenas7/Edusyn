import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ArrowLeft, BarChart3, TrendingUp, Shield, Users, CheckCircle, AlertTriangle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useReportsData } from '../../hooks/useReportsData'
import { observerApi, reportsApi } from '../../lib/api'

// ─── helpers ────────────────────────────────────────────────────────────────

const LEVEL_COLORS: Record<string, string> = {
  bajo: '#ef4444', basico: '#f97316', alto: '#3b82f6', superior: '#22c55e',
}

const TYPE_LABELS: Record<string, string> = {
  POSITIVE: 'Situación positiva', BEHAVIORAL_MILD: 'Comportamiento leve',
  ACTA_TYPE_I: 'Acta Tipo I', ACTA_TYPE_II: 'Acta Tipo II', ACTA_TYPE_III: 'Acta Tipo III',
  OBSERVATION: 'Observación', ACADEMIC: 'Académico', ATTENDANCE: 'Asistencia',
}

function getLevelColor(name: string): string {
  const k = name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  for (const [key, color] of Object.entries(LEVEL_COLORS)) {
    if (k.includes(key)) return color
  }
  const palette = ['#8b5cf6', '#06b6d4', '#f59e0b', '#84cc16']
  return palette[Object.keys(LEVEL_COLORS).length % palette.length]
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

// ─── interfaces ─────────────────────────────────────────────────────────────

interface SubjectOption { id: string; name: string; areaName: string }
interface SubjectDist {
  subjectId: string; subjectName: string; areaName: string
  totalStudents: number
  levels: Array<{ label: string; count: number; percentage: number }>
}
interface GroupRanking {
  groupId: string; groupName: string
  results: Array<{ position: number; studentName: string; average: number; subjectCount: number; performance: string }>
}

type Tab = 'academic' | 'top5' | 'convivencia'

// ─── component ──────────────────────────────────────────────────────────────

export default function GradeReportsPage() {
  const location = useLocation()
  const { institution: _inst } = useAuth()
  const { academicYears, terms, groups, gradingScale, filterYear, setFilterYear, filterPeriod, setFilterPeriod } = useReportsData()

  const initialTab = useMemo<Tab>(() => {
    const t = new URLSearchParams(location.search).get('tab')
    if (t === 'top5') return 'top5'
    if (t === 'convivencia') return 'convivencia'
    return 'academic'
  }, [location.search])

  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [selectedGradeId, setSelectedGradeId] = useState('')
  const [loading, setLoading] = useState(false)

  // academic tab
  const [availableSubjects, setAvailableSubjects] = useState<SubjectOption[]>([])
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set())
  const [subjectDists, setSubjectDists] = useState<SubjectDist[]>([])
  const [loadingDist, setLoadingDist] = useState(false)

  // top5 tab
  const [groupRankings, setGroupRankings] = useState<GroupRanking[]>([])

  // convivencia tab
  const [convData, setConvData] = useState<any>(null)

  const gradeOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    groups.forEach(g => { if (g.grade?.id && !map.has(g.grade.id)) map.set(g.grade.id, { id: g.grade.id, name: g.grade.name || '' }) })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [groups])

  const selectedGradeGroups = useMemo(() => groups.filter(g => g.grade?.id === selectedGradeId), [groups, selectedGradeId])

  useEffect(() => { if (!selectedGradeId && gradeOptions.length > 0) setSelectedGradeId(gradeOptions[0].id) }, [gradeOptions, selectedGradeId])

  // Reset data when filters change
  useEffect(() => {
    setAvailableSubjects([]); setSelectedSubjectIds(new Set()); setSubjectDists([])
    setGroupRankings([]); setConvData(null)
  }, [filterYear, filterPeriod, selectedGradeId])

  const loadData = useCallback(async () => {
    if (!filterYear || !selectedGradeId || selectedGradeGroups.length === 0) return
    setLoading(true)
    try {
      const [subjectRes, rankingRes, convRes] = await Promise.all([
        reportsApi.getSubjectAverages(filterYear, { groupId: selectedGradeGroups[0].id, termId: filterPeriod || undefined }),
        Promise.all(selectedGradeGroups.map(async g => {
          const res = await reportsApi.getStudentRanking(filterYear, g.id, filterPeriod || undefined)
          return { groupId: g.id, groupName: `${g.grade?.name || ''} ${g.name}`.trim(), results: res.data?.results || [] }
        })),
        observerApi.getConvivencialStats(filterYear, { gradeId: selectedGradeId }),
      ])
      const subjects: SubjectOption[] = (subjectRes.data?.results || []).map((s: any) => ({ id: s.subjectId, name: s.subjectName, areaName: s.areaName || '' }))
      setAvailableSubjects(subjects)
      setSelectedSubjectIds(new Set(subjects.map(s => s.id)))
      setGroupRankings(rankingRes)
      setConvData(convRes.data)
    } finally {
      setLoading(false)
    }
  }, [filterYear, filterPeriod, selectedGradeId, selectedGradeGroups])

  const loadSubjectDistributions = async () => {
    if (!filterYear || selectedSubjectIds.size === 0 || selectedGradeGroups.length === 0) return
    setLoadingDist(true)
    try {
      const results: SubjectDist[] = []
      for (const subjectId of Array.from(selectedSubjectIds)) {
        const subject = availableSubjects.find(s => s.id === subjectId)
        if (!subject) continue
        const levelCounts = new Map<string, number>()
        let totalStudents = 0
        for (const group of selectedGradeGroups) {
          const res = await reportsApi.getGradeDistribution(filterYear, group.id, { subjectId, termId: filterPeriod || undefined })
          const dist: any[] = res.data?.distribution || []
          const groupTotal: number = res.data?.totalGrades || 0
          totalStudents += groupTotal
          for (const item of dist) {
            const nameMatch = String(item.range).match(/\(([^)]+)\)$/)
            const name = nameMatch ? nameMatch[1] : String(item.range)
            levelCounts.set(name, (levelCounts.get(name) || 0) + (item.count as number))
          }
        }
        results.push({
          subjectId: subject.id, subjectName: subject.name, areaName: subject.areaName, totalStudents,
          levels: Array.from(levelCounts.entries()).map(([label, count]) => ({
            label, count, percentage: totalStudents > 0 ? Math.round((count / totalStudents) * 1000) / 10 : 0,
          })),
        })
      }
      setSubjectDists(results)
    } finally {
      setLoadingDist(false)
    }
  }

  const chartData = useMemo(() => ({
    rows: subjectDists.map(d => {
      const row: Record<string, string | number> = { subject: d.subjectName.length > 18 ? d.subjectName.slice(0, 16) + '…' : d.subjectName }
      d.levels.forEach(l => { row[l.label] = l.count })
      return row
    }),
    levels: Array.from(new Set(subjectDists.flatMap(d => d.levels.map(l => l.label)))),
  }), [subjectDists])

  const tabs: Array<{ key: Tab; label: string; icon: any }> = [
    { key: 'academic', label: 'Desempeño por asignatura', icon: BarChart3 },
    { key: 'top5', label: 'Top 5 por curso', icon: TrendingUp },
    { key: 'convivencia', label: 'Situaciones convivenciales', icon: Shield },
  ]

  const hasData = groupRankings.length > 0 || convData !== null || availableSubjects.length > 0

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/reports" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Reportes por grado</h1>
            <p className="text-sm text-slate-500">Desempeño académico, ranking y situaciones convivenciales</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Año académico</label>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Seleccionar...</option>
              {academicYears.map(y => <option key={y.id} value={y.id}>{y.year}{y.status === 'ACTIVE' ? ' · Activo' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Período</label>
            <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Todos los períodos</option>
              {terms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Grado</label>
            <select value={selectedGradeId} onChange={e => setSelectedGradeId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Seleccionar...</option>
              {gradeOptions.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        </div>
        <button onClick={loadData} disabled={!filterYear || !selectedGradeId || loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
          {loading ? <><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Cargando...</> : <><BarChart3 className="w-4 h-4" />Consultar</>}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(tab => {
          const Icon = tab.icon
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors ${activeTab === tab.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'}`}>
              <Icon className="w-4 h-4" />{tab.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-slate-500">Cargando datos del grado...</p>
        </div>
      ) : !hasData ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Selecciona los filtros y haz clic en "Consultar"</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── ACADEMIC TAB ── */}
          {activeTab === 'academic' && (
            <div className="space-y-5">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Escala mínima aprobatoria', value: gradingScale.minPassingGrade?.toFixed(1) || '-', icon: CheckCircle, color: 'emerald' },
                  { label: 'Asignaturas disponibles', value: availableSubjects.length, icon: BarChart3, color: 'blue' },
                  { label: 'Total cursos', value: selectedGradeGroups.length, icon: Users, color: 'indigo' },
                  { label: 'Niveles configurados', value: gradingScale.performanceLevels?.length || 0, icon: AlertTriangle, color: 'amber' },
                ].map(card => (
                  <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-3">
                    <p className="text-[10px] text-slate-500 uppercase font-medium">{card.label}</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{card.value}</p>
                  </div>
                ))}
              </div>

              {/* Subject selector */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-slate-900">Seleccionar asignaturas</h2>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setSelectedSubjectIds(new Set(availableSubjects.map(s => s.id)))} className="text-blue-600 hover:underline">Todas</button>
                    <span className="text-slate-300">|</span>
                    <button onClick={() => setSelectedSubjectIds(new Set())} className="text-slate-500 hover:underline">Ninguna</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
                  {availableSubjects.map(s => (
                    <label key={s.id} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer text-sm transition-colors ${selectedSubjectIds.has(s.id) ? 'bg-blue-50 border-blue-300 text-blue-800' : 'border-slate-200 hover:border-slate-300'}`}>
                      <input type="checkbox" checked={selectedSubjectIds.has(s.id)} onChange={e => {
                        const next = new Set(selectedSubjectIds)
                        if (e.target.checked) next.add(s.id); else next.delete(s.id)
                        setSelectedSubjectIds(next)
                      }} className="mt-0.5 accent-blue-600" />
                      <div>
                        <div className="font-medium leading-tight">{s.name}</div>
                        {s.areaName && <div className="text-[10px] text-slate-400">{s.areaName}</div>}
                      </div>
                    </label>
                  ))}
                </div>
                <button onClick={loadSubjectDistributions} disabled={selectedSubjectIds.size === 0 || loadingDist}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm disabled:opacity-50">
                  {loadingDist
                    ? <><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Cargando...</>
                    : <><BarChart3 className="w-4 h-4" />Ver distribución por niveles</>}
                </button>
              </div>

              {/* Charts */}
              {subjectDists.length > 0 && (
                <>
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h2 className="font-semibold text-slate-900 mb-4">Comparativo de niveles de desempeño por asignatura</h2>
                    <ResponsiveContainer width="100%" height={subjectDists.length * 50 + 60}>
                      <BarChart layout="vertical" data={chartData.rows} margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="subject" width={140} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v, name) => [`${v} estudiantes`, name]} />
                        <Legend />
                        {chartData.levels.map(level => (
                          <Bar key={level} dataKey={level} stackId="a" fill={getLevelColor(level)} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {subjectDists.map(dist => (
                      <div key={dist.subjectId} className="bg-white rounded-xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-semibold text-slate-900">{dist.subjectName}</h3>
                            {dist.areaName && <p className="text-xs text-slate-500">{dist.areaName}</p>}
                          </div>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{dist.totalStudents} est.</span>
                        </div>
                        {/* Segmented bar */}
                        <div className="flex h-5 rounded-full overflow-hidden mb-3 bg-slate-100">
                          {dist.levels.map(l => (
                            <div key={l.label} style={{ width: `${l.percentage}%`, backgroundColor: getLevelColor(l.label) }}
                              title={`${l.label}: ${l.count} (${l.percentage}%)`} />
                          ))}
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {dist.levels.map(l => (
                            <div key={l.label} className="flex items-center gap-2 text-xs">
                              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: getLevelColor(l.label) }} />
                              <span className="text-slate-700 flex-1 truncate">{l.label}</span>
                              <span className="font-bold text-slate-900">{l.count}</span>
                              <span className="text-slate-400">({l.percentage}%)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── TOP 5 TAB ── */}
          {activeTab === 'top5' && (
            <div className="space-y-4">
              {groupRankings.map(group => (
                <div key={group.groupId} className="bg-white rounded-xl border border-slate-200 p-4">
                  <h2 className="font-semibold text-slate-900 mb-1">{group.groupName}</h2>
                  <p className="text-xs text-slate-500 mb-3">Top 5 estudiantes por promedio general</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left w-16">Puesto</th>
                          <th className="px-3 py-2 text-left">Estudiante</th>
                          <th className="px-3 py-2 text-center w-28">Promedio</th>
                          <th className="px-3 py-2 text-center w-32">Asignaturas</th>
                          <th className="px-3 py-2 text-center w-32">Desempeño</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(group.results || []).slice(0, 5).map(row => (
                          <tr key={`${group.groupId}-${row.position}`} className="border-t hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2 text-center text-lg">{MEDAL[row.position] || row.position}</td>
                            <td className="px-3 py-2 font-medium text-slate-900">{row.studentName}</td>
                            <td className="px-3 py-2 text-center">
                              <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full text-xs">{row.average.toFixed(2)}</span>
                            </td>
                            <td className="px-3 py-2 text-center text-slate-600">{row.subjectCount}</td>
                            <td className="px-3 py-2 text-center">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: getLevelColor(row.performance) + '22', color: getLevelColor(row.performance) }}>
                                {row.performance}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(group.results || []).length === 0 && (
                          <tr><td className="px-3 py-4 text-center text-slate-400 text-sm" colSpan={5}>Sin datos para este curso</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── CONVIVENCIA TAB ── */}
          {activeTab === 'convivencia' && convData && (() => {
            const byGroupArr: any[] = convData.byGroup || []
            const byTypeObj: Record<string, number> = convData.byType || {}
            const maxType = Math.max(...Object.values(byTypeObj).map(Number), 1)
            return (
              <div className="space-y-5">
                {/* Summary cards */}
                <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'Total situaciones', value: convData.total || 0, color: '#64748b' },
                    { label: 'Estudiantes únicos', value: convData.uniqueStudents || 0, color: '#3b82f6' },
                    { label: 'Positivas', value: convData.positiveCount || 0, color: '#22c55e' },
                    { label: 'Negativas', value: convData.negativeCount || 0, color: '#ef4444' },
                    { label: 'Actas formales', value: convData.actasSummary?.total || 0, color: '#8b5cf6' },
                    { label: 'Remisiones', value: convData.processIndicators?.referrals?.total || 0, color: '#f97316' },
                  ].map(c => (
                    <div key={c.label} className="bg-white rounded-xl border border-slate-200 p-3 text-center shadow-sm">
                      <div className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</div>
                      <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wide leading-tight">{c.label}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* By course */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h2 className="font-semibold text-slate-900 mb-3">Situaciones por curso</h2>
                    {byGroupArr.length > 0 ? (
                      <div className="space-y-3">
                        {byGroupArr.map((g: any) => {
                          const tot = g.count || 0
                          const posW = tot > 0 ? (g.positive / tot) * 100 : 0
                          const negW = tot > 0 ? (g.negative / tot) * 100 : 0
                          return (
                            <div key={g.groupId} className="border border-slate-100 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-sm text-slate-900">{g.name}</span>
                                <div className="flex gap-3 text-xs text-slate-500">
                                  <span>{tot} situaciones</span>
                                  <span>{g.uniqueStudents} est. únicos</span>
                                </div>
                              </div>
                              <div className="flex h-4 rounded-full overflow-hidden bg-slate-100">
                                {g.positive > 0 && <div className="h-full bg-emerald-500" style={{ width: `${posW}%` }} />}
                                {g.negative > 0 && <div className="h-full bg-red-500" style={{ width: `${negW}%` }} />}
                              </div>
                              <div className="flex gap-4 mt-1 text-xs text-slate-500">
                                <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1" />Positivas: {g.positive}</span>
                                <span><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />Negativas: {g.negative}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : <p className="text-center text-sm text-slate-400 py-6">Sin situaciones registradas</p>}
                  </div>

                  {/* By type */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <h2 className="font-semibold text-slate-900 mb-3">Tipos de situaciones</h2>
                    {Object.keys(byTypeObj).length > 0 ? (
                      <div className="space-y-2">
                        {Object.entries(byTypeObj).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                          <div key={type} className="flex items-center gap-3">
                            <div className="w-28 text-xs text-slate-600 truncate">{TYPE_LABELS[type] || type}</div>
                            <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-teal-500 rounded-full" style={{ width: `${(count / maxType) * 100}%` }} />
                            </div>
                            <span className="text-xs font-semibold text-slate-700 w-5 text-right">{count}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-center text-sm text-slate-400 py-6">Sin datos</p>}
                  </div>
                </div>

                {/* Process indicators */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { title: 'Compromisos', d: convData.processIndicators?.commitments, rateKey: 'resolutionRate', rateLabel: 'Resolución', barColor: 'bg-emerald-500' },
                    { title: 'Citaciones a acudientes', d: convData.processIndicators?.citations, rateKey: 'attendanceRate', rateLabel: 'Asistencia', barColor: 'bg-amber-500' },
                    { title: 'Remisiones', d: convData.processIndicators?.referrals, rateKey: null, rateLabel: '', barColor: '' },
                    { title: 'Medidas pedagógicas', d: convData.processIndicators?.measures, rateKey: null, rateLabel: '', barColor: '' },
                  ].map(ind => (
                    <div key={ind.title} className="bg-white rounded-xl border border-slate-200 p-4">
                      <h3 className="font-semibold text-sm text-slate-700 mb-2">{ind.title}</h3>
                      <div className="text-3xl font-bold text-slate-800 mb-3">{ind.d?.total || 0}</div>
                      <div className="space-y-0.5 text-xs text-slate-600">
                        {ind.d?.open !== undefined && <div>Abiertos: <strong>{ind.d.open}</strong></div>}
                        {ind.d?.closed !== undefined && <div>Cerrados: <strong>{ind.d.closed}</strong></div>}
                        {ind.d?.inProgress !== undefined && <div>En proceso: <strong>{ind.d.inProgress}</strong></div>}
                        {ind.rateKey && ind.d?.[ind.rateKey] !== undefined && (
                          <div className="mt-2">
                            <div className="flex justify-between mb-1"><span>{ind.rateLabel}</span><span className="font-semibold">{ind.d[ind.rateKey]}%</span></div>
                            <div className="h-1.5 bg-slate-100 rounded-full">
                              <div className={`h-full rounded-full ${ind.barColor}`} style={{ width: `${ind.d[ind.rateKey]}%` }} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
