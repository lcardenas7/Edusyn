import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, BarChart3, CheckCircle, ClipboardList, Download,
  FileDown, FileText, RefreshCw, Shield, Users,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useReportsData } from '../../hooks/useReportsData'
import api, { observerApi, reportsApi, institutionConfigApi, teacherAssignmentsApi, toPublicFileUrl } from '../../lib/api'

interface ActaConfig {
  actaNumber: string
  date: string
  time: string
  place: string
  topN: number
  rankingMode: RankingMode
  agenda: string[]
  assistants: Array<{ name: string; role: string; courses: string }>
  includeSections: {
    academicLevels: boolean
    subjectLevels: boolean
    top5: boolean
    convivencia: boolean
    psico: boolean
    analysis: boolean
    commitments: boolean
  }
  actaTypes: string[]
  analysisText: string
  convivenciaSuggestion: string
  commitments: string[]
  signatories: Array<{ role: string; name: string }>
}

interface LoadedData {
  gradeName: string
  yearLabel: string
  termLabel: string
  coursesLabel: string
  dane: string
  municipality: string
  gradeRankingResults: any[]
  groupRankings: Array<{ groupId: string; groupName: string; results: any[] }>
  performanceBuckets: Array<{ label: string; count: number }>
  convivencia: any
  academicSummary: { totalStudents: number; generalAverage: number; approvedCount: number; riskCount: number }
  subjectLevelData: { performanceLevelLabels: string[]; results: any[] } | null
}

type RankingMode = 'separate' | 'integral' | 'both'

const DEFAULT_AGENDA = [
  'Verificaci\u00f3n de qu\u00f3rum y apertura de la sesi\u00f3n.',
  'Lectura y aprobaci\u00f3n del acta anterior.',
  'An\u00e1lisis del desempe\u00f1o acad\u00e9mico por niveles.',
  'Reconocimiento de los mejores promedios por curso y grado.',
  'Revisi\u00f3n de situaciones convivenciales y casos remitidos a psicoorientaci\u00f3n.',
  'An\u00e1lisis general del grado: aspectos acad\u00e9micos y convivenciales.',
  'Compromisos, propuestas de mejora y cierre.',
]

const DEFAULT_COMMITMENTS = [
  'Implementar estrategias de nivelaci\u00f3n para estudiantes en bajo desempe\u00f1o.',
  'Realizar seguimiento semanal a estudiantes remitidos a psicoorientaci\u00f3n.',
  'Citar a acudientes de estudiantes con m\u00e1s de tres asignaturas en bajo desempe\u00f1o.',
]

const DEFAULT_SIGNATORIES = [
  { role: 'Rector(a)', name: '' },
  { role: 'Coordinador(a)', name: '' },
  { role: 'Director(a) de grupo', name: '' },
  { role: 'Psicoorientador(a)', name: '' },
]

function buildActaHtml(
  cfg: ActaConfig,
  d: LoadedData,
  actaObs: any[],
  referrals: any[],
  institutionName: string,
  logoBase64: string,
): string {
  const pc = '#185FA5'
  const pcLight = '#E6F1FB'
  const psicoRef = referrals.filter((r: any) => String(r.referredToRole || '').toUpperCase().includes('PSICO'))
  const convByGroup: any[] = d.convivencia?.byGroup || []
  const topN = Math.max(1, Number(cfg.topN || 5))
  const rankingMode = cfg.rankingMode || 'both'

  const escudoImg = logoBase64
    ? `<img src="${logoBase64}" alt="Escudo" style="width:72px;height:72px;object-fit:contain;" />`
    : `<svg viewBox="0 0 60 60" width="60" height="60" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="30" r="28" stroke="${pc}" stroke-width="2" fill="${pcLight}"/>
        <path d="M30 10 L35 22 L48 24 L39 33 L41 46 L30 40 L19 46 L21 33 L12 24 L25 22 Z" fill="${pc}" opacity="0.7"/>
        <circle cx="30" cy="30" r="7" fill="${pc}"/>
      </svg>`

  const secTitle = (num: string, title: string) =>
    `<div style="font-size:12px;font-weight:600;color:${pc};text-transform:uppercase;letter-spacing:0.5px;border-left:3px solid ${pc};padding-left:8px;margin:16px 0 8px;">${num ? num + '. ' : ''}${title}</div>`

  const th = (cols: string[]) =>
    `<tr>${cols.map(c => `<th style="background:${pcLight};color:#0C447C;font-weight:600;padding:6px 9px;text-align:left;border:0.5px solid #B5D4F4;font-size:10px;text-transform:uppercase;">${c}</th>`).join('')}</tr>`

  const tr = (cells: (string | number)[], even: boolean) =>
    `<tr>${cells.map(c => `<td style="padding:6px 9px;border:0.5px solid #e2e8f0;font-size:11px;color:#1e293b;${even ? 'background:#f8fafc;' : ''}">${c ?? '-'}</td>`).join('')}</tr>`

  let body = ''

  // 1. Orden del dia
  body += secTitle('1', 'Orden del d\u00eda')
  body += `<ol style="margin:0 0 0 18px;padding:0;">${cfg.agenda.map(item =>
    `<li style="font-size:12px;color:#334155;padding:5px 0;border-bottom:0.5px solid #f1f5f9;">${item}</li>`
  ).join('')}</ol>`
  body += `<hr style="border:none;border-top:0.5px solid #e2e8f0;margin:14px 0;">`

  // 2. Asistentes
  body += secTitle('2', 'Asistentes')
  body += `<table style="width:100%;border-collapse:collapse;"><thead>${th(['Nombre completo', 'Cargo / Asignatura', 'Curso(s)', 'Firma'])}</thead><tbody>${
    cfg.assistants.map((a, i) => tr([a.name || '', a.role, a.courses || '', ''], i % 2 === 1)).join('')
  }</tbody></table>`
  body += `<hr style="border:none;border-top:0.5px solid #e2e8f0;margin:14px 0;">`

  // 3. Desempeno academico
  if (cfg.includeSections.academicLevels) {
    body += secTitle('3', 'Desempe\u00f1o acad\u00e9mico por niveles')
    const tot = d.academicSummary.totalStudents || 1
    const barColors: Record<string, string> = { 'Bajo': '#E24B4A', 'B\u00e1sico': '#EF9F27', 'Alto': '#639922', 'Superior': '#378ADD' }
    body += `<div style="background:#f8fafc;border-radius:6px;padding:12px;margin-bottom:8px;">
      <div style="font-size:10px;color:#64748b;margin-bottom:8px;">Total estudiantes: <strong>${tot}</strong> &nbsp;|&nbsp; Promedio general: <strong>${d.academicSummary.generalAverage.toFixed(2)}</strong></div>
      ${d.performanceBuckets.map(b => {
        const pct = Math.round((b.count / tot) * 100)
        const col = barColors[b.label] || pc
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <div style="font-size:11px;width:65px;color:#475569;">${b.label}</div>
          <div style="flex:1;height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:${col};border-radius:5px;"></div></div>
          <div style="font-size:11px;font-weight:600;color:#1e293b;min-width:40px;text-align:right;">${b.count} (${pct}%)</div>
        </div>`
      }).join('')}
    </div>`
    body += `<hr style="border:none;border-top:0.5px solid #e2e8f0;margin:14px 0;">`
  }

  // 3b. Niveles por asignatura
  if (cfg.includeSections.subjectLevels && d.subjectLevelData?.results?.length) {
    const { performanceLevelLabels: lvls, results: sldRows } = d.subjectLevelData
    const barColors: Record<string, string> = { 'Bajo': '#E24B4A', 'B\u00e1sico': '#EF9F27', 'Alto': '#639922', 'Superior': '#378ADD' }
    const defaults = ['#E24B4A', '#EF9F27', '#639922', '#378ADD']
    body += secTitle('3b', 'Desempe\u00f1o por asignatura y nivel')
    body += `<table style="width:100%;border-collapse:collapse;"><thead>${th(['Asignatura', 'Total', 'Prom.', ...lvls.map(l => `${l} (n / %)`)]) }</thead><tbody>${
      sldRows.map((r: any, i: number) => tr([
        r.subjectName,
        r.totalStudents,
        r.average?.toFixed(1),
        ...r.levels.map((lv: any, li: number) => {
          const col = barColors[lv.label] || defaults[li] || pc
          return `<span style="color:${col};font-weight:600;">${lv.count}</span> <span style="color:#64748b;">(${lv.percentage?.toFixed(1)}%)</span>`
        }),
      ], i % 2 === 1)).join('')
    }</tbody></table>`
    body += `<hr style="border:none;border-top:0.5px solid #e2e8f0;margin:14px 0;">`
  }

  // 4. Top N
  if (cfg.includeSections.top5) {
    const appendGroupTables = () => {
      for (const group of d.groupRankings) {
        body += secTitle('4', `Top ${topN} estudiantes \u2014 ${group.groupName}`)
        body += `<table style="width:100%;border-collapse:collapse;"><thead>${th(['#', 'Estudiante', 'Promedio', 'Nivel'])}</thead><tbody>${
          (group.results || []).slice(0, topN).map((s: any, i: number) => tr([i + 1, s.studentName, Number(s.average).toFixed(2), s.performance || '-'], i % 2 === 1)).join('')
        }</tbody></table><div style="margin-bottom:10px;"></div>`
      }
    }

    const appendIntegralTable = () => {
      const ordered = [...d.gradeRankingResults].sort((a: any, b: any) => (b.average || 0) - (a.average || 0)).slice(0, topN)
      body += secTitle('4', `Top ${topN} integral del grado ${d.gradeName}`)
      body += `<table style="width:100%;border-collapse:collapse;"><thead>${th(['#', 'Estudiante', 'Curso', 'Promedio', 'Nivel'])}</thead><tbody>${
        ordered.map((s: any, i: number) => tr([i + 1, s.studentName, s.group || s.groupName || '-', Number(s.average).toFixed(2), s.performance || '-'], i % 2 === 1)).join('')
      }</tbody></table><div style="margin-bottom:10px;"></div>`
    }

    if (rankingMode === 'separate') appendGroupTables()
    else if (rankingMode === 'integral') appendIntegralTable()
    else {
      appendIntegralTable()
      appendGroupTables()
    }
    body += `<hr style="border:none;border-top:0.5px solid #e2e8f0;margin:14px 0;">`
  }

  // 5. Actas convivenciales
  if (cfg.includeSections.convivencia && actaObs.length > 0) {
    body += secTitle('5', 'Situaciones convivenciales \u2014 actas formales')
    body += `<table style="width:100%;border-collapse:collapse;"><thead>${th(['Estudiante', 'Curso', 'Tipo', 'Categor\u00eda', 'Manejo dado', 'Estado'])}</thead><tbody>${
      actaObs.map((a: any, i: number) => tr([a.studentName, a.groupName, a.typeLabel || '-', a.category || '-', a.handling || '-', a.status || '-'], i % 2 === 1)).join('')
    }</tbody></table>`
    body += `<hr style="border:none;border-top:0.5px solid #e2e8f0;margin:14px 0;">`
  }

  // 6. Remisiones psicoorientacion
  if (cfg.includeSections.psico && psicoRef.length > 0) {
    body += secTitle('6', 'Remisiones a psicoorientaci\u00f3n')
    body += `<table style="width:100%;border-collapse:collapse;"><thead>${th(['Estudiante', 'Curso', 'Estado', 'Fecha'])}</thead><tbody>${
      psicoRef.map((r: any, i: number) => tr([r.studentName, r.groupName, r.status || '-', r.date ? new Date(r.date).toLocaleDateString('es-CO') : '-'], i % 2 === 1)).join('')
    }</tbody></table>`
    body += `<hr style="border:none;border-top:0.5px solid #e2e8f0;margin:14px 0;">`
  }

  // Resumen convivencial por curso
  if (convByGroup.length > 0) {
    body += secTitle('', 'Resumen convivencial por curso')
    body += `<table style="width:100%;border-collapse:collapse;"><thead>${th(['Curso', 'Total', 'Positivas', 'Negativas', 'Est. \u00fanicos'])}</thead><tbody>${
      convByGroup.map((g: any, i: number) => tr([g.name, g.count, g.positive, g.negative, g.uniqueStudents], i % 2 === 1)).join('')
    }</tbody></table>`
    if (cfg.convivenciaSuggestion)
      body += `<div style="background:#fffbeb;border-left:3px solid #f59e0b;padding:8px 12px;margin-top:10px;border-radius:0 4px 4px 0;font-size:11px;color:#78350f;"><strong>Plan de mejora:</strong> ${cfg.convivenciaSuggestion}</div>`
    body += `<hr style="border:none;border-top:0.5px solid #e2e8f0;margin:14px 0;">`
  }

  // 7. Analisis general
  if (cfg.includeSections.analysis && cfg.analysisText) {
    body += secTitle('7', 'An\u00e1lisis general del grado')
    body += `<div style="background:#f8fafc;border-radius:6px;padding:12px;">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">
        <div style="text-align:center;padding:8px;background:#fff;border-radius:4px;border:0.5px solid #e2e8f0;"><div style="font-size:10px;color:#64748b;">Promedio grado</div><div style="font-size:20px;font-weight:700;color:${pc};">${d.academicSummary.generalAverage.toFixed(2)}</div></div>
        <div style="text-align:center;padding:8px;background:#fff;border-radius:4px;border:0.5px solid #e2e8f0;"><div style="font-size:10px;color:#64748b;">Total estudiantes</div><div style="font-size:20px;font-weight:700;color:${pc};">${d.academicSummary.totalStudents}</div></div>
        <div style="text-align:center;padding:8px;background:#fff;border-radius:4px;border:0.5px solid #e2e8f0;"><div style="font-size:10px;color:#64748b;">En riesgo (bajo)</div><div style="font-size:20px;font-weight:700;color:#E24B4A;">${d.academicSummary.riskCount}</div></div>
      </div>
      <p style="font-size:12px;color:#334155;line-height:1.6;margin:0;">${cfg.analysisText}</p>
    </div>`
    body += `<hr style="border:none;border-top:0.5px solid #e2e8f0;margin:14px 0;">`
  }

  // 8. Compromisos
  if (cfg.includeSections.commitments && cfg.commitments.length > 0) {
    body += secTitle('8', 'Compromisos y acuerdos')
    body += `<ol style="margin:0 0 0 18px;padding:0;">${cfg.commitments.map(c =>
      `<li style="font-size:12px;color:#334155;padding:5px 0;border-bottom:0.5px solid #f1f5f9;">${c}</li>`
    ).join('')}</ol>`
    body += `<hr style="border:none;border-top:0.5px solid #e2e8f0;margin:14px 0;">`
  }

  // Firmas
  body += `<div style="margin-top:28px;font-size:12px;font-weight:600;color:${pc};text-transform:uppercase;letter-spacing:0.5px;border-left:3px solid ${pc};padding-left:8px;margin-bottom:16px;">Firmas</div>`
  body += `<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;">
    ${cfg.signatories.map(s => `
      <div style="flex:1;min-width:150px;text-align:center;">
        <div style="border-bottom:1px solid #94a3b8;margin-bottom:6px;height:36px;"></div>
        <div style="font-size:12px;font-weight:600;color:#1e293b;">${s.name || '_'.repeat(20)}</div>
        <div style="font-size:11px;color:#64748b;">${s.role}</div>
      </div>`).join('')}
  </div>`

  const today = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Acta de Comision - ${d.gradeName}</title>
<style>
  @page { size: letter; margin: 18mm 16mm 20mm 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #1e293b; font-size: 12px; }
  @media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
</style>
</head>
<body>
<div style="max-width:720px;margin:0 auto;">

  <div style="display:flex;align-items:center;gap:16px;border-bottom:2.5px solid ${pc};padding-bottom:12px;margin-bottom:16px;">
    <div style="width:76px;height:76px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border-radius:50%;background:${pcLight};border:2px solid ${pc};">
      ${escudoImg}
    </div>
    <div style="flex:1;text-align:center;">
      <div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">REP\u00daBLICA DE COLOMBIA</div>
      <div style="font-size:15px;font-weight:700;color:#1e293b;margin:2px 0;">${institutionName}</div>
      ${d.dane ? `<div style="font-size:10px;color:#64748b;">DANE: ${d.dane}${d.municipality ? ' &nbsp;|&nbsp; ' + d.municipality : ''}</div>` : ''}
      <div style="font-size:14px;font-weight:700;color:${pc};margin-top:5px;text-transform:uppercase;letter-spacing:0.8px;">Acta de Comisi\u00f3n de Evaluaci\u00f3n y Promoci\u00f3n</div>
      <div style="font-size:11px;color:#64748b;margin-top:2px;">Grado ${d.gradeName} &nbsp;|&nbsp; ${d.termLabel} &nbsp;|&nbsp; A\u00f1o lectivo ${d.yearLabel}</div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px;">
    ${[
      ['Fecha', cfg.date],
      ['Hora', cfg.time],
      ['Lugar', cfg.place],
      ['Grado / Cursos', d.coursesLabel],
      ['Per\u00edodo evaluado', d.termLabel],
      ['N.\u00b0 de acta', cfg.actaNumber],
    ].map(([l, v]) => `
      <div style="background:#f8fafc;border-radius:6px;padding:9px 11px;border:0.5px solid #e2e8f0;">
        <div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.4px;">${l}</div>
        <div style="font-size:12px;font-weight:600;color:#1e293b;margin-top:2px;">${v || '-'}</div>
      </div>`).join('')}
  </div>

  ${body}

  <div style="margin-top:20px;padding-top:8px;border-top:0.5px solid #e2e8f0;text-align:center;font-size:9px;color:#94a3b8;">
    <p>Documento generado el ${today} &nbsp;|&nbsp; ${institutionName}</p>
    <p style="margin-top:1px;">Sistema de Gesti\u00f3n Acad\u00e9mica Edusyn</p>
  </div>

</div>
</body>
</html>`
}

export default function CommissionReports() {
  const { institution } = useAuth()
  const { academicYears, terms, groups, gradingScale, filterYear, setFilterYear, filterPeriod, setFilterPeriod } = useReportsData()

  const [selectedGradeId, setSelectedGradeId] = useState('')
  const [loadingData, setLoadingData] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [loadedData, setLoadedData] = useState<LoadedData | null>(null)
  const [actaObs, setActaObs] = useState<any[]>([])
  const [referrals, setReferrals] = useState<any[]>([])
  const [logoBase64, setLogoBase64] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actaSubjectFilter, setActaSubjectFilter] = useState<string[]>([]) // IDs; vacío = todas
  const [gradeGroupTeachers, setGradeGroupTeachers] = useState<Array<{groupId: string; groupName: string; teachers: Array<{id: string; name: string}>}>>([])

  const gradeOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    groups.forEach(g => { if (g.grade?.id && !map.has(g.grade.id)) map.set(g.grade.id, { id: g.grade.id, name: g.grade.name || '' }) })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [groups])

  const selectedGradeGroups = useMemo(() => groups.filter(g => g.grade?.id === selectedGradeId), [groups, selectedGradeId])
  const selectedGradeName = useMemo(() => gradeOptions.find(g => g.id === selectedGradeId)?.name || '', [gradeOptions, selectedGradeId])
  const selectedYearLabel = useMemo(() => academicYears.find(y => y.id === filterYear)?.year?.toString() || '', [academicYears, filterYear])
  const selectedTermLabel = useMemo(() => terms.find(t => t.id === filterPeriod)?.name || 'Todos los per\u00edodos', [terms, filterPeriod])

  const [actaConfig, setActaConfig] = useState<ActaConfig>({
    actaNumber: '',
    date: new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }),
    time: '8:00 a.m. \u2013 10:30 a.m.',
    place: 'Sala de profesores',
    topN: 5,
    rankingMode: 'both',
    agenda: [...DEFAULT_AGENDA],
    assistants: [
      { name: '', role: 'Coordinador(a)', courses: '' },
      { name: '', role: 'Director(a) de grupo', courses: '' },
      { name: '', role: 'Psicoorientador(a)', courses: '\u2014' },
    ],
    includeSections: { academicLevels: true, subjectLevels: false, top5: true, convivencia: true, psico: true, analysis: true, commitments: true },
    actaTypes: ['ACTA_TYPE_I', 'ACTA_TYPE_II', 'ACTA_TYPE_III'],
    analysisText: '', convivenciaSuggestion: '',
    commitments: [...DEFAULT_COMMITMENTS],
    signatories: [...DEFAULT_SIGNATORIES],
  })

  const updateConfig = <K extends keyof ActaConfig>(key: K, value: ActaConfig[K]) =>
    setActaConfig(prev => ({ ...prev, [key]: value }))

  // Cargar logo institucional
  useEffect(() => {
    institutionConfigApi.getFullConfig().then((res: any) => {
      const logoUrl: string = res.data?.logoUrl || ''
      if (!logoUrl) return
      fetch(toPublicFileUrl(logoUrl))
        .then(r => r.blob())
        .then(blob => new Promise<string>(resolve => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string || '')
          reader.readAsDataURL(blob)
        }))
        .then(b64 => setLogoBase64(b64))
        .catch(() => {})
    }).catch(() => {})
  }, [])

  useEffect(() => { if (!selectedGradeId && gradeOptions.length > 0) setSelectedGradeId(gradeOptions[0].id) }, [gradeOptions, selectedGradeId])
  useEffect(() => { setLoadedData(null); setActaObs([]); setReferrals([]); setLoadError(null) }, [filterYear, filterPeriod, selectedGradeId])
  useEffect(() => {
    if (selectedGradeName && selectedYearLabel && !actaConfig.actaNumber)
      updateConfig('actaNumber', `CEP-${selectedGradeName.replace(/\s+/g, '')}-${selectedYearLabel}-001`)
  }, [selectedGradeName, selectedYearLabel, actaConfig.actaNumber])

  const lsKey = useMemo(
    () => selectedGradeId && filterYear ? `edusyn_acta_${selectedGradeId}_${filterYear}_${filterPeriod}` : null,
    [selectedGradeId, filterYear, filterPeriod]
  )
  useEffect(() => {
    if (!lsKey) return
    const stored = localStorage.getItem(lsKey)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setActaConfig(prev => ({
          ...prev,
          ...parsed,
          topN: Number(parsed.topN) > 0 ? Number(parsed.topN) : prev.topN,
          rankingMode: parsed.rankingMode === 'separate' || parsed.rankingMode === 'integral' || parsed.rankingMode === 'both'
            ? parsed.rankingMode
            : prev.rankingMode,
          includeSections: { ...prev.includeSections, ...(parsed.includeSections || {}) },
          assistants: parsed.assistants || prev.assistants,
          agenda: parsed.agenda || prev.agenda,
          commitments: parsed.commitments || prev.commitments,
          signatories: parsed.signatories || prev.signatories,
          actaTypes: parsed.actaTypes || prev.actaTypes,
        }))
      } catch {}
    }
  }, [lsKey])
  useEffect(() => { if (lsKey) localStorage.setItem(lsKey, JSON.stringify(actaConfig)) }, [lsKey, actaConfig])

  // Limpiar datos cargados al cambiar grado o año
  useEffect(() => {
    setLoadedData(null)
    setActaSubjectFilter([])
    setGradeGroupTeachers([])
  }, [selectedGradeId, filterYear])

  // ── Generadores de texto inteligente ──────────────────────────────────
  const buildAnalysisText = (d: LoadedData, pass: number) => {
    const { totalStudents, generalAverage: avg, approvedCount, riskCount } = d.academicSummary
    const approvedPct = totalStudents > 0 ? ((approvedCount / totalStudents) * 100).toFixed(1) : '0'
    const riskPct = totalStudents > 0 ? ((riskCount / totalStudents) * 100).toFixed(1) : '0'
    const convTotal = d.convivencia?.total || 0
    const convNeg = d.convivencia?.negative || 0
    const perfLines = d.performanceBuckets.filter(b => b.count > 0)
      .map(b => `${b.label}: ${b.count} (${totalStudents > 0 ? ((b.count / totalStudents) * 100).toFixed(1) : 0}%)`).join(', ')
    const lowSubjects = d.subjectLevelData?.results
      ?.filter((r: any) => r.approvalRate < 70)
      .sort((a: any, b: any) => a.approvalRate - b.approvalRate)
      .slice(0, 3)
      .map((r: any) => `${r.subjectName} (${r.approvalRate.toFixed(1)}%)`) || []
    const parts: string[] = [
      `El grado ${d.gradeName} presenta un promedio general de ${avg.toFixed(2)} en el per\u00edodo ${d.termLabel}.`,
      `De ${totalStudents} estudiantes evaluados, ${approvedCount} (${approvedPct}%) alcanzaron la nota m\u00ednima aprobatoria y ${riskCount} (${riskPct}%) presentan desempe\u00f1o por debajo del m\u00ednimo institucional (${pass.toFixed(1)}).`,
    ]
    if (perfLines) parts.push(`Distribuci\u00f3n por niveles: ${perfLines}.`)
    if (lowSubjects.length > 0) parts.push(`Las asignaturas con mayor porcentaje de bajo desempe\u00f1o son: ${lowSubjects.join(', ')}.`)
    if (convTotal > 0) parts.push(`En el \u00e1rea convivencial se registraron ${convTotal} situaciones${convNeg > 0 ? `, de las cuales ${convNeg} son de car\u00e1cter negativo y requieren seguimiento` : ''}.`)
    else parts.push('No se registraron situaciones convivenciales relevantes durante el per\u00edodo.')
    return parts.join(' ')
  }

  const buildImprovementPlan = (d: LoadedData, pass: number) => {
    const { riskCount, totalStudents } = d.academicSummary
    const riskPct = totalStudents > 0 ? ((riskCount / totalStudents) * 100).toFixed(1) : '0'
    const convNeg = d.convivencia?.negative || 0
    const lowSubjects = d.subjectLevelData?.results
      ?.filter((r: any) => r.approvalRate < 70)
      .sort((a: any, b: any) => a.approvalRate - b.approvalRate)
      .slice(0, 4)
      .map((r: any) => r.subjectName) || []
    const lines: string[] = [
      `Dise\u00f1ar e implementar estrategias pedag\u00f3gicas de nivelaci\u00f3n para los ${riskCount} estudiantes (${riskPct}%) con desempe\u00f1o por debajo de la nota m\u00ednima.`,
    ]
    if (lowSubjects.length > 0)
      lines.push(`Priorizar planes de apoyo acad\u00e9mico en las asignaturas con mayor bajo desempe\u00f1o: ${lowSubjects.join(', ')}.`)
    if (convNeg > 0)
      lines.push(`Fortalecer los procesos de mediaci\u00f3n escolar y acompa\u00f1amiento para los ${convNeg} casos convivenciales de car\u00e1cter negativo identificados.`)
    lines.push('Establecer comunicaci\u00f3n peri\u00f3dica y citaci\u00f3n a acudientes de estudiantes con bajo rendimiento acad\u00e9mico para acuerdos de mejora.')
    lines.push('Realizar seguimiento quincenal al progreso de los estudiantes en riesgo con reporte al coordinador del grado.')
    return lines.join(' ')
  }

  const buildCommitments = (d: LoadedData, pass: number): string[] => {
    const { riskCount } = d.academicSummary
    const convNeg = d.convivencia?.negative || 0
    const lowSubjects = d.subjectLevelData?.results
      ?.filter((r: any) => r.approvalRate < 70)
      .slice(0, 2)
      .map((r: any) => r.subjectName) || []
    const items: string[] = [
      `Implementar planes de nivelaci\u00f3n para los ${riskCount} estudiantes con desempe\u00f1o por debajo de la nota m\u00ednima aprobatoria.`,
    ]
    if (lowSubjects.length > 0)
      items.push(`Dise\u00f1ar estrategias de apoyo espec\u00edficas en ${lowSubjects.join(' y ')}.`)
    if (convNeg > 0)
      items.push(`Citar a acudientes de estudiantes con situaciones convivenciales pendientes de resoluci\u00f3n.`)
    items.push(`Realizar seguimiento semanal a los estudiantes en riesgo y reportar avances a coordinaci\u00f3n.`)
    items.push(`Registrar la informaci\u00f3n de seguimiento en el sistema Edusyn antes de la pr\u00f3xima comisi\u00f3n.`)
    return items
  }

  const loadData = useCallback(async () => {
    if (!filterYear || !selectedGradeId || selectedGradeGroups.length === 0) return
    setLoadingData(true)
    try {
      setLoadError(null)
      const [gradeRankingRes, convivenciaRes, groupRankings, obsResult, assignmentsRes] = await Promise.all([
        reportsApi.getInstitutionalRanking(filterYear, { gradeId: selectedGradeId, termId: filterPeriod || undefined }),
        observerApi.getConvivencialStats(filterYear, { gradeId: selectedGradeId }).catch(() => ({ data: null })),
        Promise.all(selectedGradeGroups.map(async (group: any) => {
          const res = await reportsApi.getStudentRanking(filterYear, group.id, filterPeriod || undefined)
          return { groupId: group.id, groupName: `${group.grade?.name || ''} ${group.name}`.trim(), results: res.data?.results || [] }
        })),
        api.get('/observer/commission-data', { params: { academicYearId: filterYear, gradeId: selectedGradeId, actaTypes: actaConfig.actaTypes.join(',') } })
          .catch((err: any) => {
            const status = err?.response?.status
            if (status === 403 || status === 404) return { data: { actas: [], referrals: [] } }
            throw err
          }),
        teacherAssignmentsApi.getAll({ academicYearId: filterYear }).catch(() => ({ data: [] })),
      ])
      const obsRes = obsResult
      const rankingResults: any[] = gradeRankingRes.data?.results || []
      const pass = gradingScale.minPassingGrade
      const avg = rankingResults.length > 0
        ? rankingResults.reduce((s: number, r: any) => s + Number(r.average), 0) / rankingResults.length : 0
      const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
      const perfOrder: string[] = gradingScale.performanceLevels.length > 0
        ? [...gradingScale.performanceLevels].sort((a, b) => a.order - b.order).map(l => l.name)
        : ['Bajo', 'B\u00e1sico', 'Alto', 'Superior']
      const buckets = perfOrder.map(label => ({
        label, count: rankingResults.filter((r: any) => norm(String(r.performance)) === norm(label)).length,
      }))
      const institutionRaw: any = gradeRankingRes.data?.institution || {}

      // ── Detectar docentes por grupo del grado ──────────────────────────
      const allAssignments: any[] = assignmentsRes?.data || []
      const gradeGroupIds = new Set(selectedGradeGroups.map((g: any) => g.id))
      const groupTeacherMap = new Map<string, Map<string, string>>()
      for (const a of allAssignments) {
        if (!gradeGroupIds.has(a.groupId) || !a.teacher) continue
        if (!groupTeacherMap.has(a.groupId)) groupTeacherMap.set(a.groupId, new Map())
        const tName = `${a.teacher.firstName || ''} ${a.teacher.lastName || ''}`.trim()
        if (tName) groupTeacherMap.get(a.groupId)!.set(a.teacherId, tName)
      }
      const ggt = selectedGradeGroups.map((g: any) => ({
        groupId: g.id,
        groupName: `${g.grade?.name || ''} ${g.name}`.trim(),
        teachers: Array.from(groupTeacherMap.get(g.id) || new Map(), ([id, name]) => ({ id, name })),
      }))
      setGradeGroupTeachers(ggt)

      const data: LoadedData = {
        gradeName: selectedGradeName, yearLabel: selectedYearLabel, termLabel: selectedTermLabel,
        coursesLabel: selectedGradeGroups.map((g: any) => `${g.grade?.name || ''} ${g.name}`.trim()).join(' \u00b7 '),
        dane: institutionRaw.dane || '', municipality: institutionRaw.municipality || '',
        gradeRankingResults: rankingResults,
        groupRankings, performanceBuckets: buckets, convivencia: convivenciaRes.data,
        academicSummary: {
          totalStudents: rankingResults.length, generalAverage: avg,
          approvedCount: rankingResults.filter((r: any) => Number(r.average) >= pass).length,
          riskCount: rankingResults.filter((r: any) => Number(r.average) < pass).length,
        },
        subjectLevelData: null,
      }

      // Niveles por asignatura
      try {
        const sldRes = await reportsApi.getSubjectLevelDistribution(filterYear, { gradeId: selectedGradeId, termId: filterPeriod || undefined })
        data.subjectLevelData = sldRes.data || null
      } catch {}

      setLoadedData(data)
      setActaObs(obsRes.data?.actas || [])
      setReferrals(obsRes.data?.referrals || [])

      // ── Auto-poblar asistentes y firmantes con directores de grupo (siempre sobrescribe) ──
      const directorRows = ggt
        .filter(gt => gt.teachers.length > 0)
        .map(gt => ({ name: gt.teachers[0].name, role: `Director(a) de grupo \u2013 ${gt.groupName}`, courses: gt.groupName }))
      const newDirectorSigs = ggt
        .filter(gt => gt.teachers.length > 0)
        .map(gt => ({ role: `Director(a) ${gt.groupName}`, name: gt.teachers[0].name }))
      // Un solo setActaConfig funcional: directores + textos generados (sin closures stale)
      setActaConfig(prev => {
        const analysisText = !prev.analysisText ? buildAnalysisText(data, pass) : prev.analysisText
        const convivenciaSuggestion = !prev.convivenciaSuggestion ? buildImprovementPlan(data, pass) : prev.convivenciaSuggestion
        const isDefaultCommitments = prev.commitments.join('') === DEFAULT_COMMITMENTS.join('') ||
          prev.commitments.every(c => DEFAULT_COMMITMENTS.includes(c))
        return {
          ...prev,
          assistants: [
            ...prev.assistants.filter(a => !a.role?.startsWith('Director(a) de grupo')),
            ...directorRows,
          ],
          signatories: [
            ...prev.signatories.filter(s => !s.role?.startsWith('Director(a)')),
            ...newDirectorSigs,
          ],
          analysisText,
          convivenciaSuggestion,
          commitments: isDefaultCommitments ? buildCommitments(data, pass) : prev.commitments,
        }
      })
    } catch (err) {
      console.error('Error loading commission data:', err)
      setLoadError('No fue posible cargar algunos datos. Verifica la conexi\u00f3n y vuelve a intentarlo.')
    } finally {
      setLoadingData(false)
    }
  }, [filterYear, filterPeriod, selectedGradeId, selectedGradeGroups, selectedGradeName, selectedYearLabel, selectedTermLabel, gradingScale, actaConfig.actaTypes])

  const filteredSubjectData = (): LoadedData['subjectLevelData'] => {
    if (!loadedData?.subjectLevelData) return null
    if (actaSubjectFilter.length === 0) return loadedData.subjectLevelData
    return {
      ...loadedData.subjectLevelData,
      results: loadedData.subjectLevelData.results.filter((r: any) => actaSubjectFilter.includes(r.subjectId)),
    }
  }

  const downloadPdf = () => {
    if (!loadedData) return
    setDownloading(true)
    const dataForDownload = { ...loadedData, subjectLevelData: filteredSubjectData() }
    const html = buildActaHtml(actaConfig, dataForDownload, actaObs, referrals, institution?.name || '', logoBase64)
    const win = window.open('', '_blank')
    if (!win) { alert('Permite las ventanas emergentes para descargar el PDF'); setDownloading(false); return }
    win.document.write(html)
    win.document.close()
    const trigger = () => { win.focus(); win.print(); setDownloading(false) }
    if (win.document.readyState === 'complete') setTimeout(trigger, 400)
    else { win.onload = () => setTimeout(trigger, 400); setTimeout(trigger, 2500) }
  }

  const downloadWord = () => {
    if (!loadedData) return
    setDownloading(true)
    try {
      const dataForDownload = { ...loadedData, subjectLevelData: filteredSubjectData() }
      const inner = buildActaHtml(actaConfig, dataForDownload, actaObs, referrals, institution?.name || '', logoBase64)
      const bodyMatch = inner.match(/<body[^>]*>([\s\S]*)<\/body>/i)
      const bodyContent = bodyMatch ? bodyMatch[1] : inner
      const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>@page{size:21.59cm 27.94cm;margin:2cm 1.8cm;} body{font-family:Arial,sans-serif;font-size:12px;} table{border-collapse:collapse;width:100%;}</style>
</head><body>${bodyContent}</body></html>`
      const blob = new Blob([wordHtml], { type: 'application/msword' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `acta_comision_${loadedData.gradeName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.doc`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  const canLoad = !!(filterYear && selectedGradeId && selectedGradeGroups.length > 0)
  const ACTA_TYPE_LABELS: Record<string, string> = { ACTA_TYPE_I: 'Tipo I', ACTA_TYPE_II: 'Tipo II', ACTA_TYPE_III: 'Tipo III' }
  const toggleActaType = (t: string) =>
    updateConfig('actaTypes', actaConfig.actaTypes.includes(t)
      ? actaConfig.actaTypes.filter(x => x !== t)
      : [...actaConfig.actaTypes, t])

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/reports" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Acta de Comisi\u00f3n de Evaluaci\u00f3n y Promoci\u00f3n</h1>
            <p className="text-sm text-slate-500">Configure y descargue el acta formal del grado en PDF o Word</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">A\u00f1o acad\u00e9mico</label>
            <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Seleccionar...</option>
              {academicYears.map(year => <option key={year.id} value={year.id}>{year.year}{year.status === 'ACTIVE' ? ' \u00b7 Activo' : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Per\u00edodo</label>
            <select value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Todos los per\u00edodos</option>
              {terms.map(term => <option key={term.id} value={term.id}>{term.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Grado</label>
            <select value={selectedGradeId} onChange={e => setSelectedGradeId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="">Seleccionar...</option>
              {gradeOptions.map(grade => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
            </select>
          </div>
        </div>
        {loadError && (
          <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
            <span className="font-medium">⚠️</span> {loadError}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {loadedData ? `Datos cargados: ${loadedData.gradeName} · ${loadedData.termLabel}` : canLoad ? 'Listo para cargar' : 'Selecciona año y grado para continuar'}
          </p>
          <button onClick={() => void loadData()} disabled={!canLoad || loadingData}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm disabled:opacity-50">
            {loadingData ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Cargando...</> : <><RefreshCw className="w-4 h-4" />Cargar datos</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              <FileText className="w-4 h-4 text-teal-600" />
              <h2 className="font-semibold text-slate-900 text-sm">Datos del acta</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {([['N.\u00b0 de acta', 'actaNumber'], ['Fecha', 'date'], ['Hora', 'time'], ['Lugar', 'place']] as [string, keyof ActaConfig][]).map(([label, key]) => (
                <div key={key}>
                  <label className="block text-xs text-slate-500 mb-1">{label}</label>
                  <input value={actaConfig[key] as string} onChange={e => updateConfig(key, e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded-md text-sm" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              <ClipboardList className="w-4 h-4 text-blue-600" />
              <h2 className="font-semibold text-slate-900 text-sm">Orden del d\u00eda</h2>
            </div>
            <div className="p-4 space-y-2">
              {actaConfig.agenda.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-xs text-slate-400 mt-2 w-5">{i + 1}.</span>
                  <input value={item} onChange={e => { const a = [...actaConfig.agenda]; a[i] = e.target.value; updateConfig('agenda', a) }} className="flex-1 px-2 py-1.5 border border-slate-300 rounded-md text-sm" />
                  <button onClick={() => updateConfig('agenda', actaConfig.agenda.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 px-1">\u00d7</button>
                </div>
              ))}
              <button onClick={() => updateConfig('agenda', [...actaConfig.agenda, ''])} className="text-xs text-teal-600 hover:underline mt-1">+ Agregar punto</button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              <Users className="w-4 h-4 text-purple-600" />
              <h2 className="font-semibold text-slate-900 text-sm">Asistentes</h2>
            </div>
            <div className="p-4 space-y-2 max-h-56 overflow-y-auto">
              {actaConfig.assistants.map((a, i) => (
                <div key={i} className="grid grid-cols-3 gap-2">
                  <input placeholder="Nombre" value={a.name || ''} onChange={e => { const arr = [...actaConfig.assistants]; arr[i] = { ...arr[i], name: e.target.value }; updateConfig('assistants', arr) }} className="px-2 py-1.5 border border-slate-300 rounded-md text-xs" />
                  <input placeholder="Cargo" value={a.role} onChange={e => { const arr = [...actaConfig.assistants]; arr[i] = { ...arr[i], role: e.target.value }; updateConfig('assistants', arr) }} className="px-2 py-1.5 border border-slate-300 rounded-md text-xs" />
                  <div className="flex gap-1">
                    <input placeholder="Curso(s)" value={a.courses || ''} onChange={e => { const arr = [...actaConfig.assistants]; arr[i] = { ...arr[i], courses: e.target.value }; updateConfig('assistants', arr) }} className="flex-1 px-2 py-1.5 border border-slate-300 rounded-md text-xs" />
                    <button onClick={() => updateConfig('assistants', actaConfig.assistants.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 px-1">\u00d7</button>
                  </div>
                </div>
              ))}
              <button onClick={() => updateConfig('assistants', [...actaConfig.assistants, { name: '', role: '', courses: '' }])} className="text-xs text-teal-600 hover:underline mt-1">+ Agregar asistente</button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              <BarChart3 className="w-4 h-4 text-green-600" />
              <h2 className="font-semibold text-slate-900 text-sm">Secciones del acta</h2>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Top N estudiantes</label>
                  <select
                    value={actaConfig.topN}
                    onChange={e => updateConfig('topN', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {[1, 3, 5, 10].map(n => <option key={n} value={n}>Top {n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Modo de ranking</label>
                  <select
                    value={actaConfig.rankingMode}
                    onChange={e => updateConfig('rankingMode', e.target.value as RankingMode)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="both">Integral y separado</option>
                    <option value="integral">Solo integral por grado</option>
                    <option value="separate">Solo separado por curso</option>
                  </select>
                </div>
              </div>
              {([
                ['academicLevels', 'Desempeño académico por niveles (global)'],
                ['subjectLevels', 'Niveles por asignatura (tabla detallada)'],
                ['top5', 'Top N por curso / grado'],
                ['convivencia', 'Situaciones convivenciales (actas formales)'],
                ['psico', 'Remisiones a psicoorientación'],
                ['analysis', 'Análisis general del grado'],
                ['commitments', 'Compromisos y acuerdos'],
              ] as [keyof ActaConfig['includeSections'], string][]).map(([key, label]) => (
                <div key={key}>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={actaConfig.includeSections[key]}
                      onChange={e => updateConfig('includeSections', { ...actaConfig.includeSections, [key]: e.target.checked })} className="rounded" />
                    <span className="text-sm text-slate-700">{label}</span>
                  </label>
                  {/* Selector de asignaturas */}
                  {key === 'subjectLevels' && actaConfig.includeSections.subjectLevels && (
                    <div className="ml-6 mt-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                      {!loadedData ? (
                        <p className="text-xs text-slate-400 italic">Carga los datos del grado para seleccionar asignaturas.</p>
                      ) : !loadedData.subjectLevelData?.results?.length ? (
                        <p className="text-xs text-amber-600">No hay datos de niveles por asignatura para este grado/per\u00edodo.</p>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-slate-600">Asignaturas a incluir <span className="text-slate-400 font-normal">(ninguna = todas)</span></p>
                            {actaSubjectFilter.length > 0 && (
                              <button onClick={() => setActaSubjectFilter([])} className="text-xs text-slate-400 hover:text-red-500">× Limpiar</button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {loadedData.subjectLevelData.results.map((r: any) => {
                              const sel = actaSubjectFilter.includes(r.subjectId)
                              return (
                                <button key={r.subjectId} type="button"
                                  onClick={() => setActaSubjectFilter(prev => prev.includes(r.subjectId) ? prev.filter(x => x !== r.subjectId) : [...prev, r.subjectId])}
                                  className={`px-2 py-0.5 rounded text-xs border transition-colors ${sel ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'}`}>
                                  {r.subjectName}
                                </button>
                              )
                            })}
                          </div>
                          {actaSubjectFilter.length > 0 && (
                            <p className="text-xs text-teal-600 mt-1.5">{actaSubjectFilter.length} asignatura{actaSubjectFilter.length > 1 ? 's' : ''} seleccionada{actaSubjectFilter.length > 1 ? 's' : ''}</p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {actaConfig.includeSections.convivencia && (
                <div className="ml-6 flex gap-2 flex-wrap mt-1">
                  {Object.keys(ACTA_TYPE_LABELS).map(t => (
                    <button key={t} onClick={() => toggleActaType(t)}
                      className={`px-2 py-0.5 rounded text-xs border ${actaConfig.actaTypes.includes(t) ? 'bg-teal-600 text-white border-teal-600' : 'text-slate-600 border-slate-300'}`}>
                      {ACTA_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {actaConfig.includeSections.analysis && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-3"><FileText className="w-4 h-4 text-orange-600" /><h2 className="font-semibold text-slate-900 text-sm">An\u00e1lisis general</h2></div>
                {loadedData && (
                  <button onClick={() => updateConfig('analysisText', buildAnalysisText(loadedData, gradingScale.minPassingGrade))}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200 transition-colors">
                    \u2728 Generar sugerencia
                  </button>
                )}
              </div>
              <div className="p-4">
                <textarea value={actaConfig.analysisText} onChange={e => updateConfig('analysisText', e.target.value)}
                  rows={5} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none"
                  placeholder="Texto de an\u00e1lisis general del grado..." />
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-3"><Shield className="w-4 h-4 text-amber-600" /><h2 className="font-semibold text-slate-900 text-sm">Plan de mejora</h2></div>
              {loadedData && (
                <button onClick={() => updateConfig('convivenciaSuggestion', buildImprovementPlan(loadedData, gradingScale.minPassingGrade))}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200 transition-colors">
                  \u2728 Generar sugerencia
                </button>
              )}
            </div>
            <div className="p-4">
              <textarea value={actaConfig.convivenciaSuggestion} onChange={e => updateConfig('convivenciaSuggestion', e.target.value)}
                rows={4} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none"
                placeholder="Plan de mejora acad\u00e9mico y convivencial..." />
            </div>
          </div>

          {actaConfig.includeSections.commitments && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-3"><CheckCircle className="w-4 h-4 text-emerald-600" /><h2 className="font-semibold text-slate-900 text-sm">Compromisos y acuerdos</h2></div>
                {loadedData && (
                  <button onClick={() => updateConfig('commitments', buildCommitments(loadedData, gradingScale.minPassingGrade))}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 transition-colors">
                    \u2728 Generar sugerencia
                  </button>
                )}
              </div>
              <div className="p-4 space-y-2">
                {actaConfig.commitments.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-xs text-slate-400 mt-2 w-5">{i + 1}.</span>
                    <input value={c} onChange={e => { const arr = [...actaConfig.commitments]; arr[i] = e.target.value; updateConfig('commitments', arr) }} className="flex-1 px-2 py-1.5 border border-slate-300 rounded-md text-sm" />
                    <button onClick={() => updateConfig('commitments', actaConfig.commitments.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 px-1">\u00d7</button>
                  </div>
                ))}
                <button onClick={() => updateConfig('commitments', [...actaConfig.commitments, ''])} className="text-xs text-teal-600 hover:underline mt-1">+ Agregar compromiso</button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
              <Users className="w-4 h-4 text-slate-600" />
              <h2 className="font-semibold text-slate-900 text-sm">Firmantes</h2>
            </div>
            <div className="p-4 space-y-2">
              {actaConfig.signatories.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input placeholder="Nombre" value={s.name || ''} onChange={e => { const arr = [...actaConfig.signatories]; arr[i] = { ...arr[i], name: e.target.value }; updateConfig('signatories', arr) }} className="flex-1 px-2 py-1.5 border border-slate-300 rounded-md text-sm" />
                  <input placeholder="Cargo" value={s.role} onChange={e => { const arr = [...actaConfig.signatories]; arr[i] = { ...arr[i], role: e.target.value }; updateConfig('signatories', arr) }} className="flex-1 px-2 py-1.5 border border-slate-300 rounded-md text-sm" />
                  <button onClick={() => updateConfig('signatories', actaConfig.signatories.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 px-1">\u00d7</button>
                </div>
              ))}
              <button onClick={() => updateConfig('signatories', [...actaConfig.signatories, { name: '', role: '' }])} className="text-xs text-teal-600 hover:underline mt-1">+ Agregar firmante</button>
            </div>
          </div>
        </div>

        <div className="lg:sticky lg:top-4 self-start space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Descargar acta</p>
            <div className="flex gap-3">
              <button onClick={downloadPdf} disabled={!loadedData || downloading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 text-sm font-medium disabled:opacity-50 transition-colors">
                {downloading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Download className="w-4 h-4" />}
                PDF (Imprimir)
              </button>
              <button onClick={downloadWord} disabled={!loadedData || downloading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition-colors">
                {downloading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FileDown className="w-4 h-4" />}
                Word (.doc)
              </button>
            </div>
            {!loadedData && <p className="text-xs text-slate-400 mt-2 text-center">Carga los datos primero para habilitar la descarga</p>}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
              <FileText className="w-4 h-4 text-teal-600" />
              <h2 className="font-semibold text-slate-900 text-sm">Vista previa del acta</h2>
            </div>
            <div className="p-4 text-xs text-slate-600 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="text-center border-b pb-3">
                {logoBase64 && <img src={logoBase64} alt="Escudo" className="w-14 h-14 object-contain mx-auto mb-2 rounded-full border border-slate-200" />}
                <p className="font-bold text-sm text-slate-800">ACTA DE COMISI\u00d3N DE EVALUACI\u00d3N Y PROMOCI\u00d3N</p>
                <p className="text-slate-500">{institution?.name || '\u2014'}</p>
                {loadedData && <p className="text-slate-500">Grado {loadedData.gradeName} \u00b7 {loadedData.termLabel} \u00b7 {loadedData.yearLabel}</p>}
              </div>
              <div className="grid grid-cols-3 gap-1">
                {([
                  ['Acta N.\u00b0', actaConfig.actaNumber], ['Fecha', actaConfig.date], ['Hora', actaConfig.time],
                  ['Lugar', actaConfig.place], ['Grado', loadedData?.coursesLabel ?? '\u2014'], ['Per\u00edodo', loadedData?.termLabel ?? '\u2014'],
                ] as [string, string][]).map(([l, v]) => (
                  <div key={l} className="bg-slate-50 rounded p-1.5">
                    <div className="text-[9px] text-slate-400 uppercase">{l}</div>
                    <div className="text-[10px] font-medium truncate">{v || '\u2014'}</div>
                  </div>
                ))}
              </div>
              <div>
                <p className="font-semibold text-slate-700 mb-1">1. Orden del d\u00eda</p>
                {actaConfig.agenda.map((item, i) => <p key={i} className="text-slate-600">{i + 1}. {item || '...'}</p>)}
              </div>
              <div>
                <p className="font-semibold text-slate-700 mb-1">2. Asistentes ({actaConfig.assistants.length})</p>
                {actaConfig.assistants.slice(0, 4).map((a, i) => <p key={i} className="text-slate-600">{a.name || '\u2014'} \u00b7 {a.role}</p>)}
                {actaConfig.assistants.length > 4 && <p className="text-slate-400">...y {actaConfig.assistants.length - 4} m\u00e1s</p>}
              </div>
              {loadedData && actaConfig.includeSections.academicLevels && (
                <div>
                  <p className="font-semibold text-slate-700 mb-1">3. Desempe\u00f1o acad\u00e9mico</p>
                  {loadedData.performanceBuckets.map(b => <p key={b.label} className="text-slate-600">{b.label}: {b.count}</p>)}
                </div>
              )}
              {loadedData && actaConfig.includeSections.top5 && (
                <div>
                  <p className="font-semibold text-slate-700 mb-1">4. Top {actaConfig.topN} — {loadedData.groupRankings.length} curso(s)</p>
                  <p className="text-slate-600">Modo: {actaConfig.rankingMode === 'both' ? 'integral y separado' : actaConfig.rankingMode === 'integral' ? 'solo integral por grado' : 'solo separado por curso'}</p>
                </div>
              )}
              {actaConfig.includeSections.convivencia && (
                <div>
                  <p className="font-semibold text-slate-700 mb-1">5. Actas convivenciales</p>
                  <p className="text-slate-600">{actaObs.length} acta(s) ({actaConfig.actaTypes.map(t => ACTA_TYPE_LABELS[t]).join(', ')})</p>
                </div>
              )}
              {actaConfig.includeSections.analysis && actaConfig.analysisText && (
                <div>
                  <p className="font-semibold text-slate-700 mb-1">7. An\u00e1lisis general</p>
                  <p className="text-slate-600 line-clamp-3">{actaConfig.analysisText}</p>
                </div>
              )}
              {actaConfig.includeSections.commitments && actaConfig.commitments.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-700 mb-1">8. Compromisos ({actaConfig.commitments.length})</p>
                  {actaConfig.commitments.slice(0, 3).map((c, i) => <p key={i} className="text-slate-600">{i + 1}. {c || '...'}</p>)}
                </div>
              )}
              <div>
                <p className="font-semibold text-slate-700 mb-1">Firmantes ({actaConfig.signatories.length})</p>
                {actaConfig.signatories.map((s, i) => <p key={i} className="text-slate-600">{s.name || '\u2014'} \u00b7 {s.role}</p>)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}