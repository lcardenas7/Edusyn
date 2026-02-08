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
import { reportsApi, groupsApi, academicYearsApi, academicTermsApi } from '../lib/api'
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
}

interface ReportConfig {
  showLogo: boolean
  showShield: boolean
  headerResolution: string
  headerMunicipality: string
  headerDepartment: string
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
  headerResolution: '',
  headerMunicipality: '',
  headerDepartment: '',
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
    { role: 'RECTOR', label: 'Rector(a)', name: '', enabled: true },
    { role: 'COORDINATOR', label: 'Coordinador(a)', name: '', enabled: true },
    { role: 'TEACHER', label: 'Director(a) de Grupo', name: '', enabled: true },
  ],
}

const performanceConfig = {
  SUPERIOR: { label: 'Superior', color: 'text-green-700', bgColor: 'bg-green-100', min: 4.6, max: 5.0 },
  ALTO: { label: 'Alto', color: 'text-blue-700', bgColor: 'bg-blue-100', min: 4.0, max: 4.5 },
  BASICO: { label: 'Basico', color: 'text-amber-700', bgColor: 'bg-amber-100', min: 3.0, max: 3.9 },
  BAJO: { label: 'Bajo', color: 'text-red-700', bgColor: 'bg-red-100', min: 1.0, max: 2.9 },
}

export default function ReportCards() {
  const { institution } = useAuth()

  // Datos de API
  const [groups, setGroups] = useState<Array<{ id: string; name: string; grade?: any }>>([])
  const [academicYears, setAcademicYears] = useState<Array<{ id: string; year: number; name: string }>>([])
  const [terms, setTerms] = useState<Array<{ id: string; name: string; type: string; order: number }>>([])
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

  // Cargar datos iniciales
  useEffect(() => {
    if (!institution?.id) return
    setLoading(true)
    Promise.all([
      groupsApi.getAll({ institutionId: institution.id }),
      academicYearsApi.getAll(institution.id),
      reportsApi.getReportCardConfig(),
    ]).then(([grpRes, yearRes, cfgRes]) => {
      const grps = (grpRes.data || []).map((g: any) => ({
        id: g.id,
        name: g.grade ? `${g.grade.name} - ${g.name}` : g.name,
        grade: g.grade,
      }))
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
      }
    }).catch(console.error).finally(() => setLoading(false))
  }, [institution?.id])

  // Cargar períodos cuando cambia año
  useEffect(() => {
    if (!selectedYearId) return
    academicTermsApi.getByAcademicYear(selectedYearId).then(res => {
      const t = (res.data || []).map((t: any) => ({ id: t.id, name: t.name, type: t.type, order: t.order }))
      setTerms(t)
      if (t.length > 0) setSelectedTermId(t[0].id)
    }).catch(console.error)
  }, [selectedYearId])

  // Cargar lista de estudiantes cuando cambia grupo o período
  useEffect(() => {
    if (!selectedGroupId || !selectedTermId || !selectedYearId) return
    setLoadingStudents(true)
    reportsApi.getGroupReportCardList(selectedGroupId, selectedTermId, selectedYearId)
      .then(res => setStudents(res.data || []))
      .catch(() => setStudents([]))
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

  const getPerformanceLevel = (grade: number): 'SUPERIOR' | 'ALTO' | 'BASICO' | 'BAJO' => {
    if (grade >= 4.6) return 'SUPERIOR'
    if (grade >= 4.0) return 'ALTO'
    if (grade >= 3.0) return 'BASICO'
    return 'BAJO'
  }

  const getMotivationalMessage = (avg: number | null, failedSubjects: number) => {
    if (!config.showMotivationalMsg) return null
    if (config.motivationalMsgType === 'NONE') return null
    if (config.motivationalMsgType === 'CUSTOM' && config.customMotivationalTpl) {
      return config.customMotivationalTpl
    }
    // AUTO
    if (avg === null) return null
    if (avg >= 4.6) return 'Excelente desempeno academico. Continua asi, eres un ejemplo para tus companeros.'
    if (avg >= 4.0) return 'Muy buen rendimiento. Sigue esforzandote para alcanzar la excelencia.'
    if (avg >= 3.0 && failedSubjects === 0) return 'Buen trabajo. Te animamos a seguir mejorando en todas las areas.'
    if (avg >= 3.0) return 'Debes reforzar las areas con dificultades. Con dedicacion puedes superar los retos pendientes.'
    return 'Es necesario un mayor compromiso academico. Busca apoyo de tus docentes y dedica mas tiempo al estudio.'
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

  const selectedTermName = terms.find(t => t.id === selectedTermId)?.name || ''
  const selectedYearName = academicYears.find(y => y.id === selectedYearId)?.name || ''

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
                {filteredStudents.map((s) => {
                  const perf = s.average !== null ? getPerformanceLevel(s.average) : null
                  return (
                    <tr key={s.enrollmentId} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedCards.includes(s.enrollmentId)} onChange={() => toggleSelectCard(s.enrollmentId)} className="w-4 h-4 rounded" />
                      </td>
                      <td className="px-4 py-3"><p className="text-sm font-medium text-slate-900">{s.studentName}</p></td>
                      <td className="px-4 py-3 text-sm text-slate-600">{s.documentNumber}</td>
                      <td className="px-4 py-3 text-center">
                        {s.average !== null ? (
                          <span className={`text-lg font-bold ${s.average >= 4.0 ? 'text-green-600' : s.average >= 3.0 ? 'text-amber-600' : 'text-red-600'}`}>
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
              ) : previewData ? (
                <div className="bg-white border-2 border-slate-400 rounded-lg p-8 max-w-4xl mx-auto shadow-lg">
                  {/* Encabezado Institucional */}
                  <div className="text-center border-b-2 border-slate-300 pb-4 mb-4">
                    {config.showLogo && institution?.name && (
                      <div className="flex items-center justify-center gap-4 mb-2">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                          <GraduationCap className="w-8 h-8 text-slate-400" />
                        </div>
                      </div>
                    )}
                    <h2 className="text-xl font-bold text-slate-900 uppercase">{previewData.institution?.name || institution?.name || ''}</h2>
                    {config.headerResolution && <p className="text-xs text-slate-600">{config.headerResolution}</p>}
                    <p className="text-xs text-slate-600">
                      NIT: {previewData.institution?.nit || ''} {institution?.daneCode ? `- DANE: ${institution.daneCode}` : ''}
                    </p>
                    {config.headerMunicipality && <p className="text-xs text-slate-600">{config.headerMunicipality}{config.headerDepartment ? `, ${config.headerDepartment}` : ''}</p>}
                  </div>

                  {/* Titulo */}
                  <div className="text-center bg-blue-800 text-white py-2 rounded mb-4">
                    <h3 className="text-lg font-bold">INFORME ACADEMICO - {selectedTermName}</h3>
                    <p className="text-sm">Ano Lectivo {selectedYearName}</p>
                  </div>

                  {/* Datos del Estudiante */}
                  <div className="grid grid-cols-2 gap-4 text-sm border border-slate-300 rounded p-3 mb-4 bg-slate-50">
                    <div>
                      <p><span className="font-semibold">Estudiante:</span> {previewData.student?.firstName} {previewData.student?.lastName}</p>
                      <p><span className="font-semibold">Documento:</span> {previewData.student?.documentNumber}</p>
                    </div>
                    <div>
                      <p><span className="font-semibold">Grado:</span> {previewData.group?.gradeLevel} - {previewData.group?.name}</p>
                      {config.showRanking && previewData.rank && (
                        <p><span className="font-semibold">Puesto:</span> {previewData.rank} de {previewData.totalStudents}</p>
                      )}
                    </div>
                  </div>

                  {/* Tabla de Calificaciones por Area */}
                  <div className="border border-slate-300 rounded overflow-hidden mb-4">
                    <table className="w-full text-xs">
                      <thead className="bg-blue-800 text-white">
                        <tr>
                          <th className="px-2 py-2 text-left font-medium w-28">Area / Asignatura</th>
                          {config.showAchievements && <th className="px-2 py-2 text-left font-medium">Logro</th>}
                          {config.showNumericGrade && <th className="px-1 py-2 text-center font-medium w-10">Nota</th>}
                          {config.showPerformanceLevel && <th className="px-1 py-2 text-center font-medium w-16">Desempeno</th>}
                          {config.showAttendance && <th className="px-1 py-2 text-center font-medium w-10">Fallas</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {(previewData.areaGrades || []).map((area: any) => (
                          <React.Fragment key={area.area}>
                            <tr className="bg-slate-200">
                              <td colSpan={5} className="px-2 py-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-800 uppercase text-[11px]">{area.area}</span>
                                  {config.showAreaAverages && area.areaAverage !== null && (
                                    <span className="text-[10px] text-slate-600">
                                      Promedio: <span className={`font-bold ${area.areaAverage >= 3 ? 'text-green-700' : 'text-red-600'}`}>{area.areaAverage?.toFixed(1)}</span>
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                            {(area.subjects || []).map((sg: any, idx: number) => (
                              <tr key={`${area.area}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="px-2 py-1.5 pl-4 font-medium text-slate-900 border-l-2 border-blue-300">{sg.subject}</td>
                                {config.showAchievements && (
                                  <td className="px-2 py-1.5 text-slate-700">
                                    {config.evaluationType === 'QUALITATIVE' && sg.performanceLevel ? (
                                      <p className="leading-tight font-medium">{sg.performanceLevel}</p>
                                    ) : (
                                      <p className="leading-tight">{sg.achievement || '-'}</p>
                                    )}
                                    {config.showRecommendations && sg.recommendation && (
                                      <p className="text-red-600 italic mt-0.5 text-[10px]">* {sg.recommendation}</p>
                                    )}
                                  </td>
                                )}
                                {config.showNumericGrade && (
                                  <td className={`px-1 py-1.5 text-center font-bold text-sm ${sg.grade !== null && sg.grade < 3 ? 'text-red-600' : 'text-green-700'}`}>
                                    {sg.grade !== null ? sg.grade.toFixed(1) : '-'}
                                  </td>
                                )}
                                {config.showPerformanceLevel && (
                                  <td className="px-1 py-1.5 text-center">
                                    {sg.performanceLevel ? (
                                      <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${performanceConfig[sg.performanceLevel as keyof typeof performanceConfig]?.bgColor || 'bg-slate-100'} ${performanceConfig[sg.performanceLevel as keyof typeof performanceConfig]?.color || 'text-slate-600'}`}>
                                        {performanceConfig[sg.performanceLevel as keyof typeof performanceConfig]?.label || sg.performanceLevel}
                                      </span>
                                    ) : '-'}
                                  </td>
                                )}
                                {config.showAttendance && <td className="px-1 py-1.5 text-center">-</td>}
                              </tr>
                            ))}
                          </React.Fragment>
                        ))}
                      </tbody>
                      {config.showGeneralAverage && (
                        <tfoot className="bg-blue-100">
                          <tr>
                            <td className="px-2 py-2 font-bold" colSpan={config.showAchievements ? 2 : 1}>PROMEDIO GENERAL</td>
                            {config.showNumericGrade && (
                              <td className="px-1 py-2 text-center font-bold text-lg text-blue-800">
                                {previewData.subjectGrades?.filter((s: any) => s.grade !== null).length > 0
                                  ? (previewData.subjectGrades.filter((s: any) => s.grade !== null).reduce((sum: number, s: any) => sum + s.grade, 0) / previewData.subjectGrades.filter((s: any) => s.grade !== null).length).toFixed(1)
                                  : '-'}
                              </td>
                            )}
                            {config.showPerformanceLevel && <td className="px-1 py-2 text-center">-</td>}
                            {config.showAttendance && <td className="px-1 py-2 text-center">-</td>}
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {/* Mensaje Motivacional */}
                  {config.showMotivationalMsg && (() => {
                    const avg = previewData.subjectGrades?.filter((s: any) => s.grade !== null)
                    const generalAvg = avg?.length > 0 ? avg.reduce((sum: number, s: any) => sum + s.grade, 0) / avg.length : null
                    const failed = previewData.subjectGrades?.filter((s: any) => s.grade !== null && s.grade < 3.0).length || 0
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
                  <div className={`grid grid-cols-${config.signatureConfig.filter(s => s.enabled).length || 3} gap-4 text-center text-xs mt-8`}>
                    {config.signatureConfig.filter(s => s.enabled).map((sig) => (
                      <div key={sig.role}>
                        <div className="h-16 border-b-2 border-slate-400 mb-1 flex items-end justify-center">
                          <span className="text-slate-300 text-[10px] mb-1">Firma</span>
                        </div>
                        <p className="font-bold">{sig.name || '_______________'}</p>
                        <p className="text-slate-500">{sig.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Pie de pagina */}
                  <div className="mt-6 pt-3 border-t border-slate-300 text-center text-[10px] text-slate-500">
                    <p>Documento generado el {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    <p>{previewData.institution?.name || institution?.name || ''}</p>
                  </div>
                </div>
              ) : (
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
                      Mostrar logo institucional
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={configDraft.showShield} onChange={(e) => setConfigDraft({...configDraft, showShield: e.target.checked})} className="w-4 h-4 rounded" />
                      Mostrar escudo
                    </label>
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

              {/* Tipo de evaluacion */}
              <div>
                <h4 className="font-medium text-slate-900 mb-3">Tipo de Evaluacion</h4>
                <div className="flex gap-4">
                  {[
                    { value: 'NUMERIC', label: 'Numerica (1.0 - 5.0)' },
                    { value: 'QUALITATIVE', label: 'Cualitativa (descriptores)' },
                    { value: 'MIXED', label: 'Mixta (ambos)' },
                  ].map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 text-sm">
                      <input type="radio" name="evalType" checked={configDraft.evaluationType === opt.value} onChange={() => setConfigDraft({...configDraft, evaluationType: opt.value})} className="w-4 h-4" />
                      {opt.label}
                    </label>
                  ))}
                </div>
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
                      <div className="flex-1 grid grid-cols-2 gap-2">
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
                    </div>
                  ))}
                  <button
                    onClick={() => setConfigDraft({
                      ...configDraft,
                      signatureConfig: [...configDraft.signatureConfig, { role: `CUSTOM_${Date.now()}`, label: 'Nuevo cargo', name: '', enabled: true }]
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
