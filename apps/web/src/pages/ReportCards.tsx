import React, { useState, useEffect } from 'react'
import {
  FileText,
  Download,
  Printer,
  Eye,
  Search,
  Users,
  CheckCircle,
  AlertTriangle,
  GraduationCap,
  Settings,
  RefreshCw,
  Mail,
  X,
  Loader2,
  Save
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { reportsApi, groupsApi, academicYearsApi, academicTermsApi, capabilitiesApi, institutionConfigApi, storageApi, toPublicFileUrl } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

interface StudentRow {
  enrollmentId: string
  studentId: string
  studentName: string
  documentNumber: string
  groupName: string
  average: number | null
  approvedSubjects: number
  failedSubjects: number
  totalSubjects: number
  rank: number | null
  totalStudents: number
  attendance: any
}

interface SignatureEntry {
  role: string
  label: string
  name: string
  enabled: boolean
  signatureImageUrl?: string
}

interface ReportConfig {
  showLogo: boolean
  showShield: boolean
  logoUrl: string
  headerResolution: string
  headerMunicipality: string
  headerDepartment: string
  primaryColor: string
  evaluationType: string
  showNumericGrade: boolean
  showPerformanceLevel: boolean
  showAchievements: boolean
  showRecommendations: boolean
  showMotivationalMsg: boolean
  motivationalMsgType: string
  customMotivationalTpl: string
  showAttendance: boolean
  showRanking: boolean
  showObservations: boolean
  showAreaAverages: boolean
  showGeneralAverage: boolean
  showScale: boolean
  showRecoveryGrades: boolean
  showComponents: boolean
  signatureConfig: SignatureEntry[]
}

const defaultConfig: ReportConfig = {
  showLogo: true,
  showShield: false,
  logoUrl: '',
  headerResolution: '',
  headerMunicipality: '',
  headerDepartment: '',
  primaryColor: '#1E3A8A',
  evaluationType: 'NUMERIC',
  showNumericGrade: true,
  showPerformanceLevel: true,
  showAchievements: true,
  showRecommendations: true,
  showMotivationalMsg: true,
  motivationalMsgType: 'AUTO',
  customMotivationalTpl: '',
  showAttendance: true,
  showRanking: true,
  showObservations: true,
  showAreaAverages: true,
  showGeneralAverage: true,
  showScale: true,
  showRecoveryGrades: true,
  showComponents: false,
  signatureConfig: [
    { role: 'RECTOR', label: 'Rector(a)', name: '', enabled: true, signatureImageUrl: '' },
    { role: 'COORDINATOR', label: 'Coordinador(a)', name: '', enabled: true, signatureImageUrl: '' },
    { role: 'TEACHER', label: 'Director(a) de Grupo', name: '', enabled: true, signatureImageUrl: '' },
  ],
}

type PerfEntry = { label: string; color: string; bgColor: string; min: number; max: number }

const DEFAULT_PERF_CONFIG: Record<string, PerfEntry> = {
  SUPERIOR: { label: 'Superior', color: 'text-green-700', bgColor: 'bg-green-100', min: 4.6, max: 5.0 },
  ALTO: { label: 'Alto', color: 'text-blue-700', bgColor: 'bg-blue-100', min: 4.0, max: 4.5 },
  BASICO: { label: 'Basico', color: 'text-amber-700', bgColor: 'bg-amber-100', min: 3.0, max: 3.9 },
  BAJO: { label: 'Bajo', color: 'text-red-700', bgColor: 'bg-red-100', min: 1.0, max: 2.9 },
}

function buildPerformanceConfig(levels: any[], minGrade: number, maxGrade: number): Record<string, PerfEntry> {
  if (!levels || levels.length === 0) return DEFAULT_PERF_CONFIG
  const sorted = [...levels].sort((a, b) => a.order - b.order)
  const result: Record<string, { label: string; color: string; bgColor: string; min: number; max: number }> = {}
  const colors = [
    { color: 'text-red-700', bgColor: 'bg-red-100' },
    { color: 'text-amber-700', bgColor: 'bg-amber-100' },
    { color: 'text-blue-700', bgColor: 'bg-blue-100' },
    { color: 'text-green-700', bgColor: 'bg-green-100' },
  ]
  sorted.forEach((l, i) => {
    const c = colors[Math.min(i, colors.length - 1)]
    result[l.code || l.name?.toUpperCase() || `LEVEL_${i}`] = {
      label: l.name, color: l.color ? `text-[${l.color}]` : c.color,
      bgColor: l.color ? `bg-[${l.color}]/10` : c.bgColor,
      min: l.minScore, max: l.maxScore,
    }
  })
  return result
}

export default function ReportCards() {
  const { user, institution } = useAuth()
  const isManager = user?.roles?.some((r: any) => {
    const roleName = r.role?.name || r.name || ''
    return roleName.includes('ADMIN') || roleName.includes('COORDINADOR') || roleName.includes('SUPERADMIN') || roleName.includes('RECTOR')
  }) ?? false

  // Datos de API
  const [groups, setGroups] = useState<Array<{ id: string; name: string; grade?: any }>>([])
  const [academicYears, setAcademicYears] = useState<Array<{ id: string; year: number; name: string }>>([])
  const [terms, setTerms] = useState<Array<{ id: string; name: string; type: string; order: number; bulletinsReleasedForTeachers?: boolean }>>([])
  const [students, setStudents] = useState<StudentRow[]>([])
  const [config, setConfig] = useState<ReportConfig>(defaultConfig)
  const [configDraft, setConfigDraft] = useState<ReportConfig>(defaultConfig)

  // Selección
  const [selectedYearId, setSelectedYearId] = useState('')
  const [selectedTermId, setSelectedTermId] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCards, setSelectedCards] = useState<string[]>([])

  // UI
  const [loading, setLoading] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<any>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [showBulkDownloadModal, setShowBulkDownloadModal] = useState(false)
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false)

  const [uploadingSignature, setUploadingSignature] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [dataMeta, setDataMeta] = useState<{ source?: string; termStatus?: string; wasReopened?: boolean; snapshotVersion?: number | null } | null>(null)
  const [togglingBulletins, setTogglingBulletins] = useState(false)

  // Reglas institucionales
  const [rulesCtx, setRulesCtx] = useState<{ minGradeValue: number; maxGradeValue: number; minPassingGrade: number; performanceLevels: any[] }>(
    { minGradeValue: 1, maxGradeValue: 5, minPassingGrade: 3.0, performanceLevels: [] }
  )
  const performanceConfig = React.useMemo(
    () => buildPerformanceConfig(rulesCtx.performanceLevels, rulesCtx.minGradeValue, rulesCtx.maxGradeValue),
    [rulesCtx]
  )

  // Cargar datos iniciales
  useEffect(() => {
    if (!institution?.id) return
    setLoading(true)
    Promise.all([
      groupsApi.getAll({ institutionId: institution.id }).catch(() => ({ data: [] })),
      academicYearsApi.getAll(institution.id).catch(() => ({ data: [] })),
      reportsApi.getReportCardConfig().catch(() => ({ data: null })),
      capabilitiesApi.getMyCapabilities().catch(() => ({ data: null })),
      institutionConfigApi.getRulesContext().catch(() => ({ data: null })),
    ]).then(([grpRes, yearRes, cfgRes, capsRes, rulesRes]) => {
      // Reglas institucionales
      if (rulesRes.data) {
        setRulesCtx(rulesRes.data)
      }
      let grps = (grpRes.data || []).map((g: any) => ({
        id: g.id,
        name: g.grade ? `${g.grade.name} - ${g.name}` : g.name,
        grade: g.grade,
      }))

      // Filtrar grupos para DOCENTE: solo grupos donde es tutor (director de grupo)
      if (!isManager && capsRes.data) {
        const caps = capsRes.data
        const tutorIds = new Set<string>(caps.tutorGroupIds || [])
        if (tutorIds.size > 0) {
          grps = grps.filter((g: any) => tutorIds.has(g.id))
        } else {
          grps = []
        }
      }

      setGroups(grps)
      if (grps.length > 0) setSelectedGroupId(grps[0].id)

      const years = (yearRes.data || []).map((y: any) => ({ id: y.id, year: y.year, name: y.name }))
      setAcademicYears(years)
      if (years.length > 0) setSelectedYearId(years[0].id)

      if (cfgRes.data) {
        const c = cfgRes.data
        const parsed: ReportConfig = {
          ...defaultConfig,
          ...c,
          signatureConfig: Array.isArray(c.signatureConfig) ? c.signatureConfig : defaultConfig.signatureConfig,
        }
        setConfig(parsed)
        setConfigDraft(parsed)
        // Pre-cache the logo as base64 so it's available in print windows
        if (parsed.showLogo && parsed.logoUrl) {
          imageUrlToBase64(toPublicFileUrl(parsed.logoUrl)).then(b64 => {
            if (b64) setLogoCachedBase64(b64)
          }).catch(() => {})
        }
      }
    }).catch(console.error).finally(() => setLoading(false))
  }, [institution?.id])

  // Cargar períodos cuando cambia año
  useEffect(() => {
    if (!selectedYearId) return
    academicTermsApi.getByAcademicYear(selectedYearId).then(res => {
      const t = (res.data || []).map((t: any) => ({ id: t.id, name: t.name, type: t.type, order: t.order, bulletinsReleasedForTeachers: t.bulletinsReleasedForTeachers ?? false }))
      setTerms(t)
      if (t.length > 0) setSelectedTermId(t[0].id)
    }).catch(console.error)
  }, [selectedYearId])

  const [bulletinsBlocked, setBulletinsBlocked] = useState(false)

  // Cargar lista de estudiantes cuando cambia grupo o período
  useEffect(() => {
    if (!selectedGroupId || !selectedTermId || !selectedYearId) return
    setLoadingStudents(true)
    setBulletinsBlocked(false)
    reportsApi.getGroupReportCardList(selectedGroupId, selectedTermId, selectedYearId)
      .then(res => {
        const body = res.data
        // Support both new shape { meta, data: [...] } and legacy flat array
        if (Array.isArray(body)) {
          setStudents(body)
          setDataMeta(null)
        } else {
          setStudents(body?.data || [])
          setDataMeta(body?.meta || null)
        }
      })
      .catch((err: any) => {
        setStudents([]); setDataMeta(null)
        if (err?.response?.status === 403) {
          setBulletinsBlocked(true)
        }
      })
      .finally(() => setLoadingStudents(false))
  }, [selectedGroupId, selectedTermId, selectedYearId])

  const filteredStudents = students.filter(s =>
    s.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.documentNumber.includes(searchTerm)
  )

  const stats = {
    total: filteredStudents.length,
    withGrades: filteredStudents.filter(s => s.average !== null).length,
    avgGrade: filteredStudents.filter(s => s.average !== null).length > 0
      ? (filteredStudents.filter(s => s.average !== null).reduce((sum, s) => sum + (s.average ?? 0), 0) / filteredStudents.filter(s => s.average !== null).length).toFixed(2)
      : '0.00',
    atRisk: filteredStudents.filter(s => s.failedSubjects > 0).length,
  }

  const getPerformanceLevel = (grade: number): string => {
    // Buscar en niveles configurados
    const entries = Object.entries(performanceConfig)
    const sorted = entries.sort((a, b) => b[1].min - a[1].min)
    for (const [key, cfg] of sorted) {
      if (grade >= cfg.min && grade <= cfg.max) return key
    }
    // Fallback porcentual
    const range = rulesCtx.maxGradeValue - rulesCtx.minGradeValue
    const pct = range > 0 ? ((grade - rulesCtx.minGradeValue) / range) * 100 : 0
    if (pct >= 85) return sorted[0]?.[0] || 'SUPERIOR'
    if (pct >= 70) return sorted[1]?.[0] || 'ALTO'
    if (pct >= 50) return sorted[2]?.[0] || 'BASICO'
    return sorted[sorted.length - 1]?.[0] || 'BAJO'
  }

  const getMotivationalMessage = (avg: number | null, failedSubjects: number) => {
    if (!config.showMotivationalMsg) return null
    if (config.motivationalMsgType === 'NONE') return null
    if (config.motivationalMsgType === 'CUSTOM' && config.customMotivationalTpl) {
      return config.customMotivationalTpl
    }
    // AUTO - usar escala dinámica
    if (avg === null) return null
    const range = rulesCtx.maxGradeValue - rulesCtx.minGradeValue
    const pct = range > 0 ? ((avg - rulesCtx.minGradeValue) / range) * 100 : 0
    if (pct >= 85) return 'Excelente desempeno academico. Continua asi, eres un ejemplo para tus companeros.'
    if (pct >= 70) return 'Muy buen rendimiento. Sigue esforzandote para alcanzar la excelencia.'
    if (avg >= rulesCtx.minPassingGrade && failedSubjects === 0) return 'Buen trabajo. Te animamos a seguir mejorando en todas las areas.'
    if (avg >= rulesCtx.minPassingGrade) return 'Debes reforzar las areas con dificultades. Con dedicacion puedes superar los retos pendientes.'
    return 'Es necesario un mayor compromiso academico. Busca apoyo de tus docentes y dedica mas tiempo al estudio.'
  }

  // Descargar Excel de sábana académica
  const [exportingExcel, setExportingExcel] = useState(false)
  const handleExportConsolidated = async () => {
    if (!selectedYearId || !selectedGroupId) return
    setExportingExcel(true)
    try {
      const res = await reportsApi.exportConsolidated(selectedYearId, selectedGroupId, selectedTermId || undefined)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'sabana-academica.xlsx'
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Error al exportar Excel')
    } finally {
      setExportingExcel(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PDF GENERATION — renders same HTML as preview via html2pdf.js
  // ═══════════════════════════════════════════════════════════════════════════

  // Convierte una URL de imagen a base64 data URI para que funcione en ventanas de impresión
  const imageUrlToBase64 = async (url: string): Promise<string> => {
    if (!url) return ''
    try {
      const resolved = url.includes('/storage/public?path=') || url.startsWith('http') ? url : toPublicFileUrl(url)
      if (!resolved) return ''
      const response = await fetch(resolved)
      if (!response.ok) return ''
      const blob = await response.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string || '')
        reader.onerror = () => resolve('')
        reader.readAsDataURL(blob)
      })
    } catch {
      return ''
    }
  }

  const buildReportCardHtml = async (data: any, student: StudentRow) => {
    const dc = data.displayConfig || {}
    const isQualitative = dc.mode === 'QUALITATIVE'
    const isFlat = dc.mode === 'QUANTITATIVE_FLAT'
    const showNumeric = (dc.showNumericGrades !== false) && config.showNumericGrade
    const showPerf = config.showPerformanceLevel
    const showAchiev = config.showAchievements
    const showAreaAvg = (dc.showAreaAverages !== false) && config.showAreaAverages
    const showGenAvg = (dc.showAverages !== false) && config.showGeneralAverage
    const showRank = (dc.showRanking !== false) && config.showRanking
    const showRecoveryGrades = config.showRecoveryGrades
    const showAttend = config.showAttendance
    const showAreaRows = dc.showAreaAverages !== false

    // Pre-load images as base64 data URIs so they work in print windows
    // Priority: already-cached base64 > fresh logoPreviewUrl > proxy URL fetch
    let logoBase64 = ''
    if (config.showLogo) {
      if (logoCachedBase64) {
        logoBase64 = logoCachedBase64
      } else {
        const logoSrc = logoPreviewUrl || (config.logoUrl ? toPublicFileUrl(config.logoUrl) : '')
        logoBase64 = logoSrc ? await imageUrlToBase64(logoSrc) : ''
        if (logoBase64) setLogoCachedBase64(logoBase64)
      }
    }
    const pc = config.primaryColor || '#1E3A8A'

    const perfBadge = (level: string | null) => {
      if (!level) return '-'
      const cfg = performanceConfig[level as keyof typeof performanceConfig]
      if (!cfg) return level
      return `<span style="padding:1px 4px;border-radius:3px;font-size:9px;font-weight:600;">${cfg.label}</span>`
    }

    // Grades table rows
    // Map subjectGrades by subject name to enrich areaGrades subjects with recovery metadata
    const subjectRecoveryMap = new Map<string, { hasRecovery: boolean; originalGrade: number | null; recoveryGrade: number | null; grade: number | null }>()
    for (const sg of (data.subjectGrades || [])) {
      subjectRecoveryMap.set(sg.subject, {
        hasRecovery: !!sg.hasRecovery,
        originalGrade: sg.originalGrade ?? null,
        recoveryGrade: sg.recoveryGrade ?? null,
        grade: sg.grade ?? null,
      })
    }

    let gradesRows = ''
    for (const area of (data.areaGrades || [])) {
      if (showAreaRows) {
        gradesRows += `<tr style="background:#e2e8f0;">
          <td colspan="5" style="padding:4px 6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:700;text-transform:uppercase;font-size:10px;color:#1e293b;">${area.area}</span>
              ${showAreaAvg && area.areaAverage !== null ? `<span style="font-size:9px;color:#475569;">Promedio: <strong style="color:${area.areaAverage >= rulesCtx.minPassingGrade ? '#15803d' : '#dc2626'}">${area.areaAverage?.toFixed(1)}</strong></span>` : ''}
            </div>
          </td>
        </tr>`
      }
      for (let idx = 0; idx < (area.subjects || []).length; idx++) {
        const sg = area.subjects[idx]
        const bg = idx % 2 === 0 ? '#fff' : '#f8fafc'
        // Enrich with recovery metadata from subjectGrades map (areaGrades may lack these fields)
        const recMeta = subjectRecoveryMap.get(sg.subject)
        const recHasRecovery = recMeta?.hasRecovery ?? sg.hasRecovery ?? false
        const recOriginalGrade = recMeta?.originalGrade ?? sg.originalGrade ?? null
        const recRecoveryGrade = recMeta?.recoveryGrade ?? sg.recoveryGrade ?? null
        const recFinalGrade = recMeta?.grade ?? sg.grade ?? null
        const recovered = !!showRecoveryGrades
          && !!recHasRecovery
          && recOriginalGrade !== null
          && recFinalGrade !== null
          && recFinalGrade > recOriginalGrade
        const recoveryHtml = '' // indicator moved to numCell below
        let achievCell = ''
        if (showAchiev) {
          let content = '-'
          if (isQualitative) {
            content = sg.qualitativeObservation || sg.achievement || '-'
          } else {
            content = sg.achievement || '-'
          }
          let extra = ''
          if (sg.achievementObservation) extra += `<p style="color:#64748b;margin-top:2px;font-size:9px;">${sg.achievementObservation}</p>`
          if (sg.judgment) extra += `<p style="color:#b45309;font-style:italic;margin-top:2px;font-size:9px;">${sg.judgment}</p>`
          if (config.showRecommendations && sg.recommendation) extra += `<p style="color:#dc2626;font-style:italic;margin-top:2px;font-size:9px;">* ${sg.recommendation}</p>`
          achievCell = `<td style="padding:4px 6px;color:#334155;font-size:10px;">${content}${extra}</td>`
        }
        let numCell = ''
        if (showNumeric) {
          // When recovered: show original grade (the one that was failed) with its real color
          // and below a subtle violet badge showing the recovery final grade
          const displayGrade = recovered ? recOriginalGrade : sg.grade
          const color = displayGrade !== null && displayGrade < rulesCtx.minPassingGrade ? '#dc2626' : '#15803d'
          const recBadge = recovered
            ? `<div style="font-size:8px;font-style:italic;color:#7c3aed;line-height:1.4;margin-top:1px;">rec.&#160;${recFinalGrade!.toFixed(1)}</div>`
            : ''
          numCell = `<td style="padding:4px 2px;text-align:center;font-weight:700;font-size:11px;color:${color};vertical-align:top;">${displayGrade !== null ? displayGrade.toFixed(1) : (sg.grade !== null ? sg.grade.toFixed(1) : '-')}${recBadge}</td>`
        }
        let perfCell = ''
        if (showPerf) perfCell = `<td style="padding:4px 2px;text-align:center;font-size:10px;">${perfBadge(sg.performanceLevel)}</td>`
        let attendCell = ''
        if (showAttend) attendCell = `<td style="padding:4px 2px;text-align:center;font-size:10px;">${sg.absences !== undefined ? sg.absences : '-'}</td>`

        gradesRows += `<tr style="background:${bg};">
          <td style="padding:4px 6px;padding-left:12px;font-weight:500;color:#0f172a;font-size:10px;border-left:2px solid #93c5fd;">${sg.subject}</td>
          ${achievCell}${numCell}${perfCell}${attendCell}
        </tr>`
      }
    }

    // General average footer
    let avgFooter = ''
    if (showGenAvg) {
      const grades = (data.subjectGrades || []).filter((s: any) => s.grade !== null)
      const avg = grades.length > 0 ? (grades.reduce((sum: number, s: any) => sum + s.grade, 0) / grades.length).toFixed(1) : '-'
      avgFooter = `<tfoot style="background:${pc}20;">
        <tr>
          <td style="padding:6px;font-weight:700;" colspan="${showAchiev ? 2 : 1}">PROMEDIO GENERAL</td>
          ${showNumeric ? `<td style="padding:6px;text-align:center;font-weight:700;font-size:13px;color:${pc}">${avg}</td>` : ''}
          ${showPerf ? '<td style="padding:6px;text-align:center;">-</td>' : ''}
          ${showAttend ? '<td style="padding:6px;text-align:center;">-</td>' : ''}
        </tr>
      </tfoot>`
    }

    // Motivational message
    let motivationalHtml = ''
    if (config.showMotivationalMsg) {
      const grades = (data.subjectGrades || []).filter((s: any) => s.grade !== null)
      const generalAvg = grades.length > 0 ? grades.reduce((sum: number, s: any) => sum + s.grade, 0) / grades.length : null
      const failed = (data.subjectGrades || []).filter((s: any) => s.grade !== null && s.grade < rulesCtx.minPassingGrade).length
      const msg = getMotivationalMessage(generalAvg, failed)
      if (msg) {
        motivationalHtml = `<div style="padding:8px 10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;margin-bottom:12px;font-size:10px;color:#1e40af;font-style:italic;">
          <strong>Nota:</strong> ${msg}
        </div>`
      }
    }

    // Scale
    let scaleHtml = ''
    if (config.showScale) {
      const items = Object.entries(performanceConfig).map(([, cfg]) =>
        `<span style="margin-right:10px;"><strong>${cfg.label}</strong> ${cfg.min.toFixed(1)} - ${cfg.max.toFixed(1)}</span>`
      ).join('')
      // Recovery clarification note (only if there are recovered subjects)
      const hasAnyRecovered = showRecoveryGrades && (data.subjectGrades || []).some((s: any) =>
        s.hasRecovery && s.originalGrade !== null && s.grade !== null && s.grade > s.originalGrade
      )
      const recNoteHtml = hasAnyRecovered
        ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #e2e8f0;font-size:9px;color:#78716c;font-style:italic;">
            <strong style="font-style:normal;color:#7c3aed;">rec. X.X</strong> indica que la asignatura fue recuperada: se muestra la nota original obtenida durante el periodo y, debajo, la nota final definitiva lograda en el proceso de recuperacion.
          </div>`
        : ''
      scaleHtml = `<div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;margin-bottom:12px;font-size:10px;">
        <h4 style="font-weight:700;color:#0f172a;margin:0 0 6px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">ESCALA DE VALORACION</h4>
        <div>${items}</div>
        ${recNoteHtml}
      </div>`
    }

    // Observations
    let obsHtml = ''
    if (config.showObservations && data.observations?.length > 0) {
      const items = data.observations.map((obs: any) => {
        const d = obs.date ? new Date(obs.date).toLocaleDateString('es-CO') : ''
        return `<p style="font-size:10px;color:#334155;margin:2px 0;"><strong>${d}</strong> - ${obs.description}${obs.author ? ` <span style="color:#94a3b8;">(${obs.author})</span>` : ''}</p>`
      }).join('')
      obsHtml = `<div style="border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;margin-bottom:12px;">
        <h4 style="font-weight:700;color:#0f172a;margin:0 0 6px;font-size:10px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">OBSERVACIONES</h4>
        ${items}
      </div>`
    }

    // Signatures — dynamic director info
    const director = data.group?.director
    const directorShortName = director ? `${director.firstName.split(' ')[0]} ${director.lastName.split(' ')[0]}`.toUpperCase() : ''
    const enabledSigs = config.signatureConfig.filter(s => s.enabled).map(sig => {
      if (sig.role === 'TEACHER' && director) {
        return { ...sig, name: directorShortName, signatureImageUrl: director.signatureImageUrl || sig.signatureImageUrl }
      }
      return sig
    })
    // Pre-load signature images as base64
    const sigsWithBase64 = await Promise.all(enabledSigs.map(async (sig) => ({
      ...sig,
      sigBase64: sig.signatureImageUrl ? await imageUrlToBase64(toPublicFileUrl(sig.signatureImageUrl)) : '',
    })))
    const sigWidth = sigsWithBase64.length > 0 ? Math.floor(100 / sigsWithBase64.length) : 33

    return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:720px;margin:0 auto;padding:20px;color:#0f172a;">
      <!-- Header -->
      <table style="width:100%;border-bottom:2px solid #cbd5e1;padding-bottom:10px;margin-bottom:10px;border-collapse:collapse;">
        <tr>
          ${logoBase64 ? `<td style="width:80px;padding-right:12px;vertical-align:middle;"><img src="${logoBase64}" style="width:80px;height:80px;object-fit:contain;" /></td>` : ''}
          <td style="text-align:center;line-height:1.3;vertical-align:middle;">
            <h2 style="font-size:15px;font-weight:700;text-transform:uppercase;margin:0;color:#0f172a;">${data.institution?.name || institution?.name || ''}</h2>
            ${config.headerResolution ? `<p style="font-size:10px;color:#475569;margin:1px 0;">${config.headerResolution}</p>` : ''}
            <p style="font-size:10px;color:#475569;margin:1px 0;">NIT: ${data.institution?.nit || ''}${institution?.daneCode ? ` - DANE: ${institution.daneCode}` : ''}</p>
            ${config.headerMunicipality ? `<p style="font-size:10px;color:#475569;margin:1px 0;">${config.headerMunicipality}${config.headerDepartment ? `, ${config.headerDepartment}` : ''}</p>` : ''}
          </td>
        </tr>
      </table>

      <!-- Title bar -->
      <div style="text-align:center;color:#fff;padding:5px 0;border-radius:4px;margin-bottom:8px;background:${pc};">
        <h3 style="font-size:13px;font-weight:700;margin:0;">INFORME ACADEMICO - ${selectedTermName}</h3>
        <p style="font-size:10px;margin:0;">Ano Lectivo ${selectedYearName}</p>
      </div>

      <!-- Student info -->
      <table style="width:100%;border:1px solid #cbd5e1;border-radius:6px;border-collapse:collapse;margin-bottom:12px;background:#f8fafc;font-size:11px;">
        <tr>
          <td style="padding:8px 10px;width:50%;vertical-align:top;">
            <p style="margin:2px 0;"><strong>Estudiante:</strong> ${[data.student?.lastName, data.student?.secondLastName, data.student?.firstName, data.student?.secondName].filter(Boolean).join(' ')}</p>
            <p style="margin:2px 0;"><strong>Documento:</strong> ${data.student?.documentNumber}</p>
          </td>
          <td style="padding:8px 10px;width:50%;vertical-align:top;">
            <p style="margin:2px 0;"><strong>Grado:</strong> ${data.group?.gradeLevel} - ${data.group?.name}</p>
            ${showRank && student.rank ? `<p style="margin:2px 0;"><strong>Puesto:</strong> ${student.rank} de ${student.totalStudents}</p>` : ''}
          </td>
        </tr>
      </table>

      <!-- Grades table -->
      <div style="border:1px solid #cbd5e1;border-radius:6px;overflow:hidden;margin-bottom:12px;">
        <table style="width:100%;border-collapse:collapse;font-size:10px;">
          <thead>
            <tr style="background:${pc};color:#fff;">
              <th style="padding:6px;text-align:left;font-weight:500;width:120px;">${isQualitative ? 'Dimension' : isFlat ? 'Asignatura' : 'Area / Asignatura'}</th>
              ${showAchiev ? `<th style="padding:6px;text-align:left;font-weight:500;">${isQualitative ? 'Observacion' : 'Logro'}</th>` : ''}
              ${showNumeric ? '<th style="padding:6px 2px;text-align:center;font-weight:500;width:40px;">Nota</th>' : ''}
              ${showPerf ? '<th style="padding:6px 2px;text-align:center;font-weight:500;width:60px;">Desempeno</th>' : ''}
              ${showAttend ? '<th style="padding:6px 2px;text-align:center;font-weight:500;width:40px;">Fallas</th>' : ''}
            </tr>
          </thead>
          <tbody>${gradesRows}</tbody>
          ${avgFooter}
        </table>
      </div>

      ${motivationalHtml}
      ${scaleHtml}
      ${obsHtml}

      <!-- Signatures -->
      <table style="width:100%;margin-top:30px;border-collapse:collapse;">
        <tr>${sigsWithBase64.map(sig => `
          <td style="width:${sigWidth}%;text-align:center;padding:0 8px;vertical-align:bottom;">
            <div style="height:50px;border-bottom:2px solid #94a3b8;margin-bottom:4px;text-align:center;">
              ${sig.sigBase64 ? `<img src="${sig.sigBase64}" style="height:45px;object-fit:contain;" />` : '<span style="color:#cbd5e1;font-size:9px;">Firma</span>'}
            </div>
            <p style="font-weight:700;font-size:10px;margin:2px 0;">${sig.name || '_______________'}</p>
            <p style="color:#64748b;font-size:9px;margin:0;">${sig.label}</p>
          </td>
        `).join('')}</tr>
      </table>

      <!-- Footer -->
      <div style="margin-top:20px;padding-top:8px;border-top:1px solid #cbd5e1;text-align:center;font-size:9px;color:#94a3b8;">
        <p style="margin:1px 0;">Documento generado el ${new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        <p style="margin:1px 0;">${data.institution?.name || institution?.name || ''}</p>
      </div>
    </div>`
  }

  const generatePdfFromHtml = async (html: string, filename: string) => {
    // Usar ventana emergente + print nativo del navegador (el más confiable, funciona siempre)
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes para descargar el boletín como PDF')
      return
    }
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${filename.replace('.pdf', '')}</title>
  <style>
    @page { size: letter; margin: 8mm; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #fff; }
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>${html}</body>
</html>`)
    printWindow.document.close()
    // Esperar a que carguen imágenes y fuentes, luego abrir diálogo de impresión
    const triggerPrint = () => {
      printWindow.focus()
      printWindow.print()
    }
    // Intentar con onload; fallback con timeout
    if (printWindow.document.readyState === 'complete') {
      setTimeout(triggerPrint, 300)
    } else {
      printWindow.onload = () => setTimeout(triggerPrint, 300)
      // Fallback por si onload no dispara
      setTimeout(triggerPrint, 2000)
    }
  }

  // Descargar PDF individual de un estudiante
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null)
  const handleDownloadPdf = async (student: StudentRow) => {
    if (!selectedTermId) return
    setDownloadingPdf(student.enrollmentId)
    try {
      const res = await reportsApi.getReportCard(student.enrollmentId, selectedTermId)
      const data = res.data
      const html = await buildReportCardHtml({ ...data, rank: student.rank, totalStudents: student.totalStudents }, student)
      await generatePdfFromHtml(html, `boletin-${student.studentName.replace(/\s+/g, '-')}.pdf`)
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Error al descargar el boletin PDF')
    } finally {
      setDownloadingPdf(null)
    }
  }

  // Descargar PDFs en lote (seleccionados o todos)
  const handleBulkDownload = async (enrollmentIds?: string[]) => {
    if (!selectedTermId || !selectedGroupId || !selectedYearId) return
    const ids = enrollmentIds || selectedCards
    if (ids.length === 0) {
      alert('Seleccione al menos un estudiante')
      return
    }
    setIsGeneratingBulk(true)
    try {
      let downloadCount = 0
      for (const enrollmentId of ids) {
        try {
          const student = students.find(s => s.enrollmentId === enrollmentId)
          if (!student) continue
          const res = await reportsApi.getReportCard(enrollmentId, selectedTermId)
          const data = res.data
          const html = await buildReportCardHtml({ ...data, rank: student.rank, totalStudents: student.totalStudents }, student)
          await generatePdfFromHtml(html, `boletin-${student.studentName.replace(/\s+/g, '-')}.pdf`)
          downloadCount++
          await new Promise(r => setTimeout(r, 500))
        } catch (err) {
          console.error(`Error descargando boletin de ${enrollmentId}:`, err)
        }
      }
      if (downloadCount > 0) {
        alert(`Se descargaron ${downloadCount} de ${ids.length} boletines`)
      } else {
        alert('No se pudo descargar ningun boletin. Verifique que existan notas registradas.')
      }
    } catch (err: any) {
      alert('Error al generar los boletines')
    } finally {
      setIsGeneratingBulk(false)
    }
  }

  // Estado para URL firmada temporal (para mostrar inmediatamente después de subir)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string>('')
  // Cache de logo en base64 para que funcione en ventanas de impresión sin depender de URLs firmadas
  const [logoCachedBase64, setLogoCachedBase64] = useState<string>('')

  const handleLogoUpload = async (file: File) => {
    if (!institution?.id) return
    setUploadingLogo(true)
    try {
      const res = await storageApi.uploadGalleryImage(file, institution.id, 'report-card-logo')
      const data = res.data?.data
      // path = key para guardar en DB, url = URL firmada para mostrar
      const pathToSave = data?.path || data?.url || ''
      const urlToShow = data?.url || data?.path || ''
      if (pathToSave) {
        setConfigDraft({ ...configDraft, logoUrl: pathToSave })
        setLogoPreviewUrl(urlToShow) // URL firmada para mostrar inmediatamente
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Error al subir el escudo. Verifique que sea PNG/JPG.')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleSignatureUpload = async (idx: number, file: File) => {
    const sig = configDraft.signatureConfig[idx]
    if (!sig) return
    setUploadingSignature(sig.role)
    try {
      const res = await storageApi.uploadSignature(file, sig.role)
      const url = res.data?.data?.url || res.data?.data?.path || ''
      const updated = [...configDraft.signatureConfig]
      updated[idx] = { ...updated[idx], signatureImageUrl: url }
      setConfigDraft({ ...configDraft, signatureConfig: updated })
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Error al subir la firma. Verifique que sea PNG/JPG y menor a 200KB.')
    } finally {
      setUploadingSignature(null)
    }
  }

  const handlePreview = async (student: StudentRow) => {
    setLoadingPreview(true)
    setShowPreview(true)
    try {
      const res = await reportsApi.getReportCard(student.enrollmentId, selectedTermId)
      setPreviewData({ ...res.data, rank: student.rank, totalStudents: student.totalStudents })
    } catch (err) {
      console.error('Error loading preview:', err)
      setPreviewData(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  const toggleSelectCard = (id: string) => {
    setSelectedCards(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    if (selectedCards.length === filteredStudents.length) {
      setSelectedCards([])
    } else {
      setSelectedCards(filteredStudents.map(s => s.enrollmentId))
    }
  }

  const handleSaveConfig = async () => {
    setSavingConfig(true)
    try {
      const res = await reportsApi.updateReportCardConfig(configDraft)
      setConfig(configDraft)
      setShowConfigModal(false)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al guardar configuracion')
    } finally {
      setSavingConfig(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto" />
          <p className="mt-4 text-slate-600">Cargando datos...</p>
        </div>
      </div>
    )
  }

  const selectedTerm = terms.find(t => t.id === selectedTermId)
  const selectedTermName = selectedTerm?.name || ''
  const selectedYearName = academicYears.find(y => y.id === selectedYearId)?.name || ''

  const handleToggleBulletins = async () => {
    if (!selectedTermId) return
    const current = selectedTerm?.bulletinsReleasedForTeachers ?? false
    setTogglingBulletins(true)
    try {
      await academicTermsApi.toggleBulletinsRelease(selectedTermId, !current)
      setTerms(prev => prev.map(t => t.id === selectedTermId ? { ...t, bulletinsReleasedForTeachers: !current } : t))
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Error al cambiar visibilidad de boletines')
    } finally {
      setTogglingBulletins(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Boletines Academicos</h1>
          <p className="text-slate-500">Generacion y gestion de boletines de calificaciones</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportConsolidated}
            disabled={!selectedGroupId || !selectedYearId || exportingExcel}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            {exportingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Sabana Excel
          </button>
          {selectedCards.length > 0 && (
            <button
              onClick={() => handleBulkDownload()}
              disabled={isGeneratingBulk}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
            >
              {isGeneratingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              PDF Seleccionados ({selectedCards.length})
            </button>
          )}
          {isManager && filteredStudents.length > 0 && (
            <button
              onClick={() => handleBulkDownload(filteredStudents.map(s => s.enrollmentId))}
              disabled={isGeneratingBulk}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
            >
              {isGeneratingBulk ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              PDF Todos
            </button>
          )}
          <button
            onClick={() => { setConfigDraft({...config}); setShowConfigModal(true) }}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm"
          >
            <Settings className="w-4 h-4" />
            Configurar
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Ano</label>
            <select value={selectedYearId} onChange={(e) => setSelectedYearId(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              {academicYears.map(y => (<option key={y.id} value={y.id}>{y.name || y.year}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Periodo</label>
            <select value={selectedTermId} onChange={(e) => setSelectedTermId(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              {terms.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Grupo</label>
            <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
              {groups.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Buscar</label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Nombre o documento..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Banners de estado del periodo */}
      {dataMeta?.wasReopened && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800">Este periodo fue reabierto. Los datos pueden diferir del boletin impreso anterior.</p>
        </div>
      )}
      {dataMeta?.source === 'snapshot' && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
          <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <p className="text-sm text-blue-800">Periodo finalizado — mostrando datos congelados (snapshot v{dataMeta.snapshotVersion}).</p>
        </div>
      )}

      {/* Blocked banner for teachers */}
      {bulletinsBlocked && !isManager && (
        <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
          <AlertTriangle className="w-6 h-6 text-orange-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-orange-800">Boletines no disponibles</p>
            <p className="text-xs text-orange-600">Los boletines de este período aún no han sido liberados por el coordinador. Comuníquese con coordinación si necesita acceso.</p>
          </div>
        </div>
      )}

      {/* Bulletin release toggle for managers */}
      {isManager && selectedTermId && (
        <div className={`flex items-center justify-between gap-3 rounded-xl p-3 mb-4 border ${selectedTerm?.bulletinsReleasedForTeachers ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <Mail className={`w-5 h-5 flex-shrink-0 ${selectedTerm?.bulletinsReleasedForTeachers ? 'text-green-600' : 'text-slate-400'}`} />
            <div>
              <p className={`text-sm font-medium ${selectedTerm?.bulletinsReleasedForTeachers ? 'text-green-800' : 'text-slate-700'}`}>
                {selectedTerm?.bulletinsReleasedForTeachers ? 'Boletines liberados para docentes' : 'Boletines no visibles para docentes'}
              </p>
              <p className="text-xs text-slate-500">
                {selectedTerm?.bulletinsReleasedForTeachers
                  ? 'Los docentes pueden ver y descargar los boletines de este período.'
                  : 'Active esta opción cuando desee que los docentes puedan ver los boletines de este período.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleBulletins}
            disabled={togglingBulletins}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedTerm?.bulletinsReleasedForTeachers
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-green-600 text-white hover:bg-green-700'
            } disabled:opacity-50`}
          >
            {togglingBulletins ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {selectedTerm?.bulletinsReleasedForTeachers ? 'Ocultar' : 'Liberar'}
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center"><Users className="w-5 h-5 text-slate-600" /></div>
            <div><p className="text-2xl font-bold text-slate-900">{stats.total}</p><p className="text-xs text-slate-500">Estudiantes</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center"><FileText className="w-5 h-5 text-blue-600" /></div>
            <div><p className="text-2xl font-bold text-blue-600">{stats.withGrades}</p><p className="text-xs text-slate-500">Con notas</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><GraduationCap className="w-5 h-5 text-amber-600" /></div>
            <div><p className="text-2xl font-bold text-amber-600">{stats.avgGrade}</p><p className="text-xs text-slate-500">Promedio</p></div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
            <div><p className="text-2xl font-bold text-red-600">{stats.atRisk}</p><p className="text-xs text-slate-500">En riesgo</p></div>
          </div>
        </div>
      </div>

      {/* Tabla de estudiantes */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loadingStudents ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No se encontraron estudiantes para este grupo y periodo</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox" checked={selectedCards.length === filteredStudents.length && filteredStudents.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded" />
                  </th>
                  <th className="text-center px-2 py-3 text-sm font-medium text-slate-600 w-10">N°</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Estudiante</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-600">Documento</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Promedio</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Desempeno</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Aprobadas</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Reprobadas</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Puesto</th>
                  <th className="text-center px-4 py-3 text-sm font-medium text-slate-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((s, idx) => {
                  const perf = s.average !== null ? getPerformanceLevel(s.average) : null
                  return (
                    <tr key={s.enrollmentId} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedCards.includes(s.enrollmentId)} onChange={() => toggleSelectCard(s.enrollmentId)} className="w-4 h-4 rounded" />
                      </td>
                      <td className="px-2 py-3 text-center text-sm font-medium text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3"><p className="text-sm font-medium text-slate-900">{s.studentName}</p></td>
                      <td className="px-4 py-3 text-sm text-slate-600">{s.documentNumber}</td>
                      <td className="px-4 py-3 text-center">
                        {s.average !== null ? (
                          <span className={`text-lg font-bold ${s.average >= rulesCtx.minPassingGrade ? 'text-green-600' : 'text-red-600'}`}>
                            {s.average.toFixed(1)}
                          </span>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {perf ? (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${performanceConfig[perf].bgColor} ${performanceConfig[perf].color}`}>
                            {performanceConfig[perf].label}
                          </span>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center"><span className="text-green-600 font-medium">{s.approvedSubjects}</span></td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-medium ${s.failedSubjects > 0 ? 'text-red-600' : 'text-slate-400'}`}>{s.failedSubjects}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s.rank !== null ? (
                          <span className="text-sm"><span className="font-bold">{s.rank}</span><span className="text-slate-400">/{s.totalStudents}</span></span>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handlePreview(s)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600" title="Vista previa">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadPdf(s)}
                            disabled={downloadingPdf === s.enrollmentId}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-green-600 disabled:opacity-50"
                            title="Descargar PDF"
                          >
                            {downloadingPdf === s.enrollmentId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Vista Previa del Boletin</h3>
                <p className="text-sm text-slate-500">{selectedTermName} - {selectedYearName}</p>
              </div>
              <button onClick={() => { setShowPreview(false); setPreviewData(null) }} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
              {loadingPreview ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="w-10 h-10 text-blue-600 animate-spin" /></div>
              ) : previewData ? (() => {
                // Merge: backend displayConfig (capabilities por estructura) + user config (preferencias)
                const dc = previewData.displayConfig || {}
                const isQualitative = dc.mode === 'QUALITATIVE'
                const isFlat = dc.mode === 'QUANTITATIVE_FLAT'
                const showNumeric = (dc.showNumericGrades !== false) && config.showNumericGrade
                const showPerf = config.showPerformanceLevel
                const showAchiev = config.showAchievements
                const showAreaAvg = (dc.showAreaAverages !== false) && config.showAreaAverages
                const showGenAvg = (dc.showAverages !== false) && config.showGeneralAverage
                const showRank = (dc.showRanking !== false) && config.showRanking
                const showAttend = config.showAttendance
                const showAreaRows = dc.showAreaAverages !== false // false for SUBJECTS_ONLY

                return (
                <div className="bg-white border-2 border-slate-400 rounded-lg p-6 max-w-4xl mx-auto shadow-lg">
                  {/* Encabezado Institucional */}
                  <div className="flex items-center justify-center border-b-2 border-slate-300 pb-3 mb-3 gap-4">
                    {config.showLogo && (
                      <div className="flex-shrink-0">
                        {config.logoUrl ? (
                          <img src={logoPreviewUrl || toPublicFileUrl(config.logoUrl)} alt="Escudo" className="w-24 h-24 object-contain" />
                        ) : (
                          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center">
                            <GraduationCap className="w-12 h-12 text-slate-400" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="text-center leading-tight">
                      <h2 className="text-lg font-bold text-slate-900 uppercase">{previewData.institution?.name || institution?.name || ''}</h2>
                      {config.headerResolution && <p className="text-[11px] text-slate-600 leading-snug">{config.headerResolution}</p>}
                      <p className="text-[11px] text-slate-600 leading-snug">
                        NIT: {previewData.institution?.nit || ''} {institution?.daneCode ? `- DANE: ${institution.daneCode}` : ''}
                      </p>
                      {config.headerMunicipality && <p className="text-[11px] text-slate-600 leading-snug">{config.headerMunicipality}{config.headerDepartment ? `, ${config.headerDepartment}` : ''}</p>}
                    </div>
                  </div>

                  {/* Titulo */}
                  <div className="text-center text-white py-1 rounded mb-2" style={{ backgroundColor: config.primaryColor || '#1E3A8A' }}>
                    <h3 className="text-base font-bold leading-tight">INFORME ACADEMICO - {selectedTermName}</h3>
                    <p className="text-xs leading-tight">Ano Lectivo {selectedYearName}</p>
                  </div>

                  {/* Datos del Estudiante */}
                  <div className="grid grid-cols-2 gap-4 text-sm border border-slate-300 rounded p-3 mb-4 bg-slate-50">
                    <div>
                      <p><span className="font-semibold">Estudiante:</span> {[previewData.student?.lastName, previewData.student?.secondLastName, previewData.student?.firstName, previewData.student?.secondName].filter(Boolean).join(' ')}</p>
                      <p><span className="font-semibold">Documento:</span> {previewData.student?.documentNumber}</p>
                    </div>
                    <div>
                      <p><span className="font-semibold">Grado:</span> {previewData.group?.gradeLevel} - {previewData.group?.name}</p>
                      {showRank && previewData.rank && (
                        <p><span className="font-semibold">Puesto:</span> {previewData.rank} de {previewData.totalStudents}</p>
                      )}
                    </div>
                  </div>

                  {/* Tabla de Calificaciones por Area */}
                  <div className="border border-slate-300 rounded overflow-hidden mb-4">
                    <table className="w-full text-xs">
                      <thead className="text-white" style={{ backgroundColor: config.primaryColor || '#1E3A8A' }}>
                        <tr>
                          <th className="px-2 py-2 text-left font-medium w-28">{isQualitative ? 'Dimension' : isFlat ? 'Asignatura' : 'Area / Asignatura'}</th>
                          {showAchiev && <th className="px-2 py-2 text-left font-medium">{isQualitative ? 'Observacion' : 'Logro'}</th>}
                          {showNumeric && <th className="px-1 py-2 text-center font-medium w-10">Nota</th>}
                          {showPerf && <th className="px-1 py-2 text-center font-medium w-16">Desempeno</th>}
                          {showAttend && <th className="px-1 py-2 text-center font-medium w-10">Fallas</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {(previewData.areaGrades || []).map((area: any) => (
                          <React.Fragment key={area.area}>
                            {showAreaRows && (
                            <tr className="bg-slate-200">
                              <td colSpan={5} className="px-2 py-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-800 uppercase text-[11px]">{area.area}</span>
                                  {showAreaAvg && area.areaAverage !== null && (
                                    <span className="text-[10px] text-slate-600">
                                      Promedio: <span className={`font-bold ${area.areaAverage >= rulesCtx.minPassingGrade ? 'text-green-700' : 'text-red-600'}`}>{area.areaAverage?.toFixed(1)}</span>
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                            )}
                            {(area.subjects || []).map((sg: any, idx: number) => {
                              // Enrich with recovery metadata from subjectGrades (areaGrades subjects lack these fields)
                              const previewRecMeta = (previewData.subjectGrades || []).find((s: any) => s.subject === sg.subject)
                              const previewHasRecovery = previewRecMeta?.hasRecovery ?? sg.hasRecovery ?? false
                              const previewOriginalGrade = previewRecMeta?.originalGrade ?? sg.originalGrade ?? null
                              const previewRecoveryFinalGrade = previewRecMeta?.grade ?? sg.grade ?? null
                              const previewShowRecovery = !!config.showRecoveryGrades
                                && !!previewHasRecovery
                                && previewOriginalGrade !== null
                                && previewRecoveryFinalGrade !== null
                                && previewRecoveryFinalGrade > previewOriginalGrade
                              const previewDisplayGrade = previewShowRecovery ? previewOriginalGrade : sg.grade
                              return (
                              <tr key={`${area.area}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="px-2 py-1.5 pl-4 font-medium text-slate-900 border-l-2 border-blue-300">{sg.subject}</td>
                                {showAchiev && (
                                  <td className="px-2 py-1.5 text-slate-700">
                                    {isQualitative ? (
                                      <>
                                        {sg.qualitativeObservation ? (
                                          <p className="leading-tight">{sg.qualitativeObservation}</p>
                                        ) : sg.achievement ? (
                                          <p className="leading-tight">{sg.achievement}</p>
                                        ) : (
                                          <p className="leading-tight text-slate-400">-</p>
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        {sg.achievement ? (
                                          <p className="leading-tight">{sg.achievement}</p>
                                        ) : (
                                          <p className="leading-tight text-slate-400">-</p>
                                        )}
                                      </>
                                    )}
                                    {sg.achievementObservation && (
                                      <p className="text-slate-500 mt-0.5 text-[10px]">{sg.achievementObservation}</p>
                                    )}
                                    {sg.judgment && (
                                      <p className="text-amber-700 italic mt-0.5 text-[10px]">{sg.judgment}</p>
                                    )}
                                    {config.showRecommendations && sg.recommendation && (
                                      <p className="text-red-600 italic mt-0.5 text-[10px]">* {sg.recommendation}</p>
                                    )}
                                  </td>
                                )}
                                {showNumeric && (
                                  <td className={`px-1 py-1.5 text-center font-bold text-sm align-top ${previewDisplayGrade !== null && previewDisplayGrade < rulesCtx.minPassingGrade ? 'text-red-600' : 'text-green-700'}`}>
                                    {previewDisplayGrade !== null ? previewDisplayGrade.toFixed(1) : '-'}
                                    {previewShowRecovery && (
                                      <div className="text-[9px] font-normal italic text-violet-700 leading-tight mt-0.5">rec.&#160;{previewRecoveryFinalGrade!.toFixed(1)}</div>
                                    )}
                                  </td>
                                )}
                                {showPerf && (
                                  <td className="px-1 py-1.5 text-center">
                                    {sg.performanceLevel ? (
                                      <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${performanceConfig[sg.performanceLevel as keyof typeof performanceConfig]?.bgColor || 'bg-slate-100'} ${performanceConfig[sg.performanceLevel as keyof typeof performanceConfig]?.color || 'text-slate-600'}`}>
                                        {performanceConfig[sg.performanceLevel as keyof typeof performanceConfig]?.label || sg.performanceLevel}
                                      </span>
                                    ) : '-'}
                                  </td>
                                )}
                                {showAttend && <td className="px-1 py-1.5 text-center">{sg.absences !== undefined ? sg.absences : '-'}</td>}
                              </tr>
                              )
                            })}
                          </React.Fragment>
                        ))}
                      </tbody>
                      {showGenAvg && (
                        <tfoot style={{ backgroundColor: `${config.primaryColor || '#1E3A8A'}20` }}>
                          <tr>
                            <td className="px-2 py-2 font-bold" colSpan={showAchiev ? 2 : 1}>PROMEDIO GENERAL</td>
                            {showNumeric && (
                              <td className="px-1 py-2 text-center font-bold text-lg" style={{ color: config.primaryColor || '#1E3A8A' }}>
                                {previewData.subjectGrades?.filter((s: any) => s.grade !== null).length > 0
                                  ? (previewData.subjectGrades.filter((s: any) => s.grade !== null).reduce((sum: number, s: any) => sum + s.grade, 0) / previewData.subjectGrades.filter((s: any) => s.grade !== null).length).toFixed(1)
                                  : '-'}
                              </td>
                            )}
                            {showPerf && <td className="px-1 py-2 text-center">-</td>}
                            {showAttend && <td className="px-1 py-2 text-center">-</td>}
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {/* Mensaje Motivacional */}
                  {config.showMotivationalMsg && (() => {
                    const avg = previewData.subjectGrades?.filter((s: any) => s.grade !== null)
                    const generalAvg = avg?.length > 0 ? avg.reduce((sum: number, s: any) => sum + s.grade, 0) / avg.length : null
                    const failed = previewData.subjectGrades?.filter((s: any) => s.grade !== null && s.grade < rulesCtx.minPassingGrade).length || 0
                    const msg = getMotivationalMessage(generalAvg, failed)
                    return msg ? (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4 text-xs text-blue-800 italic">
                        <strong>Nota:</strong> {msg}
                      </div>
                    ) : null
                  })()}

                  {/* Escala de Valoracion */}
                  {config.showScale && (
                    <div className="border border-slate-300 rounded p-3 mb-4 text-xs">
                      <h4 className="font-bold text-slate-900 mb-2 border-b pb-1">ESCALA DE VALORACION</h4>
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(performanceConfig).map(([key, cfg]) => (
                          <div key={key} className="flex items-center gap-1">
                            <span className={`px-1.5 py-0.5 rounded ${cfg.bgColor} ${cfg.color}`}>{cfg.label}</span>
                            <span className="text-slate-600">{cfg.min.toFixed(1)} - {cfg.max.toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Observaciones */}
                  {config.showObservations && previewData.observations?.length > 0 && (
                    <div className="border border-slate-300 rounded p-3 mb-4">
                      <h4 className="font-bold text-slate-900 mb-2 text-xs border-b pb-1">OBSERVACIONES</h4>
                      {previewData.observations.map((obs: any, i: number) => (
                        <p key={i} className="text-xs text-slate-700 mb-1">
                          <span className="font-medium">{obs.date ? new Date(obs.date).toLocaleDateString('es-CO') : ''}</span> - {obs.description}
                          {obs.author && <span className="text-slate-400 ml-1">({obs.author})</span>}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Firmas Configurables */}
                  {(() => {
                    const pvDirector = previewData?.group?.director
                    const pvDirName = pvDirector ? `${pvDirector.firstName.split(' ')[0]} ${pvDirector.lastName.split(' ')[0]}`.toUpperCase() : ''
                    const pvSigs = config.signatureConfig.filter(s => s.enabled).map(sig => {
                      if (sig.role === 'TEACHER' && pvDirector) {
                        return { ...sig, name: pvDirName, signatureImageUrl: pvDirector.signatureImageUrl || sig.signatureImageUrl }
                      }
                      return sig
                    })
                    return (
                    <div className={`grid grid-cols-${pvSigs.length || 3} gap-4 text-center text-xs mt-8`}>
                      {pvSigs.map((sig) => (
                        <div key={sig.role}>
                          <div className="h-16 border-b-2 border-slate-400 mb-1 flex items-end justify-center">
                            {sig.signatureImageUrl ? (
                              <img src={toPublicFileUrl(sig.signatureImageUrl)} alt={`Firma ${sig.label}`} className="h-14 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; const span = document.createElement('span'); span.className = 'text-slate-300 text-[10px]'; span.textContent = 'Firma'; e.currentTarget.parentElement?.appendChild(span) }} />
                            ) : (
                              <span className="text-slate-300 text-[10px] mb-1">Firma</span>
                            )}
                          </div>
                          <p className="font-bold">{sig.name || '_______________'}</p>
                          <p className="text-slate-500">{sig.label}</p>
                        </div>
                      ))}
                    </div>
                    )
                  })()}

                  {/* Pie de pagina */}
                  <div className="mt-6 pt-3 border-t border-slate-300 text-center text-[10px] text-slate-500">
                    <p>Documento generado el {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    <p>{previewData.institution?.name || institution?.name || ''}</p>
                  </div>
                </div>
                )
              })() : (
                <div className="text-center py-20 text-slate-500">No se pudieron cargar los datos del boletin</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Configuracion de Boletines</h3>
              <button onClick={() => setShowConfigModal(false)} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-500" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Encabezado */}
              <div>
                <h4 className="font-medium text-slate-900 mb-3 flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Encabezado</h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={configDraft.showLogo} onChange={(e) => setConfigDraft({...configDraft, showLogo: e.target.checked})} className="w-4 h-4 rounded" />
                      Mostrar logo/escudo
                    </label>
                  </div>
                  
                  {/* Logo Upload + Color */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Escudo / Logo Institucional</label>
                      {configDraft.logoUrl ? (
                        <div className="flex items-center gap-3 mb-2">
                          <img src={logoPreviewUrl || toPublicFileUrl(config.logoUrl) || toPublicFileUrl(configDraft.logoUrl)} alt="Escudo" className="w-14 h-14 object-contain rounded border border-slate-200" />
                          <button type="button" onClick={() => { setConfigDraft({...configDraft, logoUrl: ''}); setLogoPreviewUrl(''); }} className="text-xs text-red-500 hover:text-red-700">Eliminar</button>
                        </div>
                      ) : null}
                      <label className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 transition-colors ${uploadingLogo ? 'opacity-50 pointer-events-none' : ''}`}>
                        {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        {configDraft.logoUrl ? 'Cambiar escudo' : 'Subir escudo'}
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleLogoUpload(file)
                          e.target.value = ''
                        }} />
                      </label>
                      <p className="text-xs text-slate-400 mt-1">PNG o JPG. Aparece en el encabezado del boletin</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Color Principal</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={configDraft.primaryColor || '#1E3A8A'} onChange={(e) => setConfigDraft({...configDraft, primaryColor: e.target.value})} className="w-10 h-10 rounded border border-slate-300 cursor-pointer" />
                        <input type="text" value={configDraft.primaryColor || '#1E3A8A'} onChange={(e) => setConfigDraft({...configDraft, primaryColor: e.target.value})} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="#1E3A8A" />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Color de encabezados y barras del boletin</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Resolucion de aprobacion</label>
                      <input type="text" value={configDraft.headerResolution} onChange={(e) => setConfigDraft({...configDraft, headerResolution: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Resolucion No. 1234..." />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Municipio</label>
                      <input type="text" value={configDraft.headerMunicipality} onChange={(e) => setConfigDraft({...configDraft, headerMunicipality: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Departamento</label>
                      <input type="text" value={configDraft.headerDepartment} onChange={(e) => setConfigDraft({...configDraft, headerDepartment: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tipo de evaluacion — auto-detectado */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-1">Tipo de Evaluacion</h4>
                <p className="text-sm text-blue-700">
                  El tipo de boletin se determina automaticamente segun la <strong>estructura academica</strong> configurada en cada grado (Dimensiones, Asignaturas, o Areas con Asignaturas).
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Configura la estructura en <strong>Gestion Institucional → Catalogo Academico → Grados</strong>.
                </p>
              </div>

              {/* Contenido */}
              <div>
                <h4 className="font-medium text-slate-900 mb-3">Contenido del Boletin</h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'showNumericGrade', label: 'Nota numerica' },
                    { key: 'showPerformanceLevel', label: 'Nivel de desempeno' },
                    { key: 'showAchievements', label: 'Logros por asignatura' },
                    { key: 'showRecommendations', label: 'Recomendaciones' },
                    { key: 'showAttendance', label: 'Asistencia / Fallas' },
                    { key: 'showRanking', label: 'Puesto en el grupo' },
                    { key: 'showObservations', label: 'Observaciones del director' },
                    { key: 'showAreaAverages', label: 'Promedios por area' },
                    { key: 'showGeneralAverage', label: 'Promedio general' },
                    { key: 'showScale', label: 'Escala de valoracion' },
                    { key: 'showRecoveryGrades', label: 'Notas de recuperacion' },
                    { key: 'showComponents', label: 'Desglose por componentes' },
                  ].map(item => (
                    <label key={item.key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={(configDraft as any)[item.key]} onChange={(e) => setConfigDraft({...configDraft, [item.key]: e.target.checked})} className="w-4 h-4 rounded" />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Mensaje Motivacional */}
              <div>
                <h4 className="font-medium text-slate-900 mb-3">Mensaje Motivacional</h4>
                <div className="space-y-2">
                  <div className="flex gap-4">
                    {[
                      { value: 'AUTO', label: 'Automatico segun desempeno' },
                      { value: 'CUSTOM', label: 'Plantilla personalizada' },
                      { value: 'NONE', label: 'No mostrar' },
                    ].map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 text-sm">
                        <input type="radio" name="motivMsg" checked={configDraft.motivationalMsgType === opt.value} onChange={() => setConfigDraft({...configDraft, motivationalMsgType: opt.value, showMotivationalMsg: opt.value !== 'NONE'})} className="w-4 h-4" />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  {configDraft.motivationalMsgType === 'CUSTOM' && (
                    <textarea value={configDraft.customMotivationalTpl} onChange={(e) => setConfigDraft({...configDraft, customMotivationalTpl: e.target.value})} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Escribe la plantilla del mensaje motivacional..." />
                  )}
                  {configDraft.motivationalMsgType === 'AUTO' && (
                    <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                      <p className="font-medium mb-1">Ejemplos de mensajes automaticos:</p>
                      <p>- Superior: "Excelente desempeno academico..."</p>
                      <p>- Alto: "Muy buen rendimiento..."</p>
                      <p>- Basico: "Buen trabajo, te animamos a mejorar..."</p>
                      <p>- Bajo: "Es necesario un mayor compromiso..."</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Firmas */}
              <div>
                <h4 className="font-medium text-slate-900 mb-3">Firmas del Boletin</h4>
                <p className="text-xs text-slate-500 mb-3">Seleccione quienes firman el boletin y escriba sus nombres</p>
                <div className="space-y-3">
                  {configDraft.signatureConfig.map((sig, idx) => (
                    <div key={sig.role} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg">
                      <input
                        type="checkbox"
                        checked={sig.enabled}
                        onChange={(e) => {
                          const updated = [...configDraft.signatureConfig]
                          updated[idx] = { ...updated[idx], enabled: e.target.checked }
                          setConfigDraft({...configDraft, signatureConfig: updated})
                        }}
                        className="w-4 h-4 rounded"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-slate-500 mb-0.5">Cargo</label>
                            <input type="text" value={sig.label} onChange={(e) => {
                              const updated = [...configDraft.signatureConfig]
                              updated[idx] = { ...updated[idx], label: e.target.value }
                              setConfigDraft({...configDraft, signatureConfig: updated})
                            }} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-0.5">Nombre completo</label>
                            <input type="text" value={sig.name} onChange={(e) => {
                              const updated = [...configDraft.signatureConfig]
                              updated[idx] = { ...updated[idx], name: e.target.value }
                              setConfigDraft({...configDraft, signatureConfig: updated})
                            }} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm" placeholder="Nombre del firmante" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-500 mb-0.5">Imagen de firma (PNG/JPG, max 200KB)</label>
                          <div className="flex items-center gap-2">
                            <label className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded text-sm hover:bg-slate-50 transition-colors ${uploadingSignature === sig.role ? 'opacity-50 pointer-events-none' : ''}`}>
                              {uploadingSignature === sig.role ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                              {sig.signatureImageUrl ? 'Cambiar firma' : 'Subir firma'}
                              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleSignatureUpload(idx, file)
                                e.target.value = ''
                              }} />
                            </label>
                            {sig.signatureImageUrl && (
                              <button onClick={() => {
                                const updated = [...configDraft.signatureConfig]
                                updated[idx] = { ...updated[idx], signatureImageUrl: '' }
                                setConfigDraft({...configDraft, signatureConfig: updated})
                              }} className="text-xs text-red-500 hover:underline">Eliminar</button>
                            )}
                          </div>
                          {sig.signatureImageUrl && (
                            <div className="mt-1.5 flex items-center gap-2 p-1.5 bg-slate-50 rounded border">
                              <img src={toPublicFileUrl(sig.signatureImageUrl)} alt="Firma" className="h-10 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                              <span className="text-xs text-green-600">Firma cargada</span>
                            </div>
                          )}
                        </div>
                        {sig.role === 'TEACHER' && (
                          <p className="text-xs text-blue-600 italic">El nombre y firma del director de grupo se asignan automaticamente desde Asistencia → Tutoria. Cada tutor sube su firma y aparece en los boletines de su grupo.</p>
                        )}
                        {sig.role === 'COORDINATOR' && (
                          <p className="text-xs text-purple-600 italic">Configure el nombre del coordinador que firma los boletines. Si necesita diferentes coordinadores por grado o nivel, agregue firmantes personalizados con "+ Agregar firmante".</p>
                        )}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setConfigDraft({
                      ...configDraft,
                      signatureConfig: [...configDraft.signatureConfig, { role: `CUSTOM_${Date.now()}`, label: 'Nuevo cargo', name: '', enabled: true, signatureImageUrl: '' }]
                    })}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    + Agregar firmante
                  </button>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button onClick={() => setShowConfigModal(false)} className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button onClick={handleSaveConfig} disabled={savingConfig} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar Configuracion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
