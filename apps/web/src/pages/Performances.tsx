import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useAcademic } from '../contexts/AcademicContext'
import {
  FileText,
  Settings,
  Save,
  CheckCircle,
  AlertTriangle,
  BookOpen,
  Brain,
  Wrench,
  Heart,
  RefreshCw
} from 'lucide-react'
import {
  academicYearsApi,
  groupsApi,
  teacherAssignmentsApi,
  performanceConfigApi,
  subjectPerformanceApi,
} from '../lib/api'

type TabType = 'register' | 'config'

interface PerformanceConfig {
  isEnabled: boolean
  showByDimension: boolean
  allowManualEdit: boolean
}

interface LevelComplement {
  id?: string
  level: 'SUPERIOR' | 'ALTO' | 'BASICO' | 'BAJO'
  complement: string
  isActive: boolean
  displayMode: 'CONCATENATE' | 'SEPARATE_LINE'
}

interface SubjectPerformance {
  dimension: 'COGNITIVO' | 'PROCEDIMENTAL' | 'ACTITUDINAL'
  baseDescription: string
}

const DIMENSION_LABELS = {
  COGNITIVO: 'Cognitivo',
  PROCEDIMENTAL: 'Procedimental',
  ACTITUDINAL: 'Actitudinal',
}

const DIMENSION_ICONS = {
  COGNITIVO: Brain,
  PROCEDIMENTAL: Wrench,
  ACTITUDINAL: Heart,
}

const LEVEL_LABELS = {
  SUPERIOR: 'Superior',
  ALTO: 'Alto',
  BASICO: 'Básico',
  BAJO: 'Bajo',
}

const DEFAULT_COMPLEMENTS: LevelComplement[] = [
  { level: 'BAJO', complement: 'presentando dificultades significativas en el desarrollo de las competencias.', isActive: true, displayMode: 'CONCATENATE' },
  { level: 'BASICO', complement: 'desarrollando las competencias con apoyo y acompañamiento del docente.', isActive: true, displayMode: 'CONCATENATE' },
  { level: 'ALTO', complement: 'demostrando un adecuado dominio y aplicación de las competencias.', isActive: true, displayMode: 'CONCATENATE' },
  { level: 'SUPERIOR', complement: 'evidenciando un desempeño autónomo, crítico y sobresaliente.', isActive: true, displayMode: 'CONCATENATE' },
]

export default function Performances() {
  const { user, institution: authInstitution } = useAuth()
  // institutionId viene de Auth (dato institucional), no de Academic
  const institutionId = authInstitution?.id
  const [activeTab, setActiveTab] = useState<TabType>('register')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [selectedYearId, setSelectedYearId] = useState('')
  const [terms, setTerms] = useState<any[]>([])
  const [selectedTermId, setSelectedTermId] = useState('')
  const [groups, setGroups] = useState<any[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [teacherAssignments, setTeacherAssignments] = useState<any[]>([])
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('')

  const [config, setConfig] = useState<PerformanceConfig>({
    isEnabled: true,
    showByDimension: true,
    allowManualEdit: false,
  })
  const [complements, setComplements] = useState<LevelComplement[]>(DEFAULT_COMPLEMENTS)

  const [performances, setPerformances] = useState<SubjectPerformance[]>([
    { dimension: 'COGNITIVO', baseDescription: '' },
    { dimension: 'PROCEDIMENTAL', baseDescription: '' },
    { dimension: 'ACTITUDINAL', baseDescription: '' },
  ])

  const isAdmin = user?.roles?.some((r: any) =>
    ['SUPERADMIN', 'ADMIN_INSTITUTIONAL', 'COORDINADOR'].includes(r.role?.name || r.name)
  )

  useEffect(() => {
    loadAcademicYears()
  }, [])

  useEffect(() => {
    if (selectedYearId) {
      const year = academicYears.find(y => y.id === selectedYearId)
      setTerms(year?.terms || [])
      loadGroups()
      if (institutionId) {
        loadConfig()
        loadComplements()
      }
    }
  }, [selectedYearId, institutionId])

  useEffect(() => {
    if (selectedGroupId && selectedYearId) {
      loadTeacherAssignments()
    }
  }, [selectedGroupId, selectedYearId])

  useEffect(() => {
    if (selectedAssignmentId && selectedTermId) {
      loadPerformances()
    }
  }, [selectedAssignmentId, selectedTermId])

  const loadAcademicYears = async () => {
    try {
      const response = await academicYearsApi.getAll()
      setAcademicYears(response.data)
      const current = response.data.find((y: any) => y.isCurrent)
      if (current) {
        setSelectedYearId(current.id)
      }
    } catch (err) {
      console.error('Error loading academic years:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadGroups = async () => {
    try {
      const response = await groupsApi.getAll()
      setGroups(response.data)
    } catch (err) {
      console.error('Error loading groups:', err)
    }
  }

  const loadTeacherAssignments = async () => {
    try {
      const response = await teacherAssignmentsApi.getAll({ groupId: selectedGroupId, academicYearId: selectedYearId })
      setTeacherAssignments(response.data)
    } catch (err) {
      console.error('Error loading teacher assignments:', err)
    }
  }

  const loadConfig = async () => {
    if (!institutionId) return
    try {
      const response = await performanceConfigApi.get(institutionId)
      if (response.data) {
        setConfig(response.data)
      }
    } catch (err) {
      console.error('Error loading config:', err)
    }
  }

  const loadComplements = async () => {
    if (!institutionId) return
    try {
      const response = await performanceConfigApi.getComplements(institutionId)
      if (response.data && response.data.length > 0) {
        setComplements(response.data)
      }
    } catch (err) {
      console.error('Error loading complements:', err)
    }
  }

  const loadPerformances = async () => {
    if (!selectedAssignmentId || !selectedTermId) return
    try {
      const response = await subjectPerformanceApi.getByTeacherAssignment(
        selectedAssignmentId,
        selectedTermId
      )
      if (response.data && response.data.length > 0) {
        const loaded = response.data.map((p: any) => ({
          dimension: p.dimension,
          baseDescription: p.baseDescription,
        }))
        // Merge with defaults to ensure all dimensions are present
        const merged = ['COGNITIVO', 'PROCEDIMENTAL', 'ACTITUDINAL'].map(dim => {
          const existing = loaded.find((p: SubjectPerformance) => p.dimension === dim)
          return existing || { dimension: dim as any, baseDescription: '' }
        })
        setPerformances(merged)
      } else {
        setPerformances([
          { dimension: 'COGNITIVO', baseDescription: '' },
          { dimension: 'PROCEDIMENTAL', baseDescription: '' },
          { dimension: 'ACTITUDINAL', baseDescription: '' },
        ])
      }
    } catch (err) {
      console.error('Error loading performances:', err)
    }
  }

  const handleSaveConfig = async () => {
    if (!institutionId) return
    setSaving(true)
    try {
      await performanceConfigApi.upsert({
        institutionId: institutionId,
        ...config,
      })
      setMessage({ type: 'success', text: 'Configuración guardada correctamente' })
    } catch (err) {
      console.error('Error saving config:', err)
      setMessage({ type: 'error', text: 'Error al guardar la configuración' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleSaveComplements = async () => {
    if (!institutionId) return
    setSaving(true)
    try {
      await performanceConfigApi.bulkUpsertComplements({
        institutionId: institutionId,
        complements,
      })
      setMessage({ type: 'success', text: 'Complementos guardados correctamente' })
    } catch (err) {
      console.error('Error saving complements:', err)
      setMessage({ type: 'error', text: 'Error al guardar los complementos' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleCreateDefaultComplements = async () => {
    if (!institutionId) return
    setSaving(true)
    try {
      await performanceConfigApi.createDefaultComplements(institutionId)
      await loadComplements()
      setMessage({ type: 'success', text: 'Complementos por defecto creados' })
    } catch (err) {
      console.error('Error creating default complements:', err)
      setMessage({ type: 'error', text: 'Error al crear complementos por defecto' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const handleSavePerformances = async () => {
    if (!selectedAssignmentId || !selectedTermId) return
    setSaving(true)
    try {
      await subjectPerformanceApi.bulkUpsert({
        teacherAssignmentId: selectedAssignmentId,
        academicTermId: selectedTermId,
        performances: performances.filter(p => p.baseDescription.trim() !== ''),
      })
      setMessage({ type: 'success', text: 'Desempeños guardados correctamente' })
    } catch (err) {
      console.error('Error saving performances:', err)
      setMessage({ type: 'error', text: 'Error al guardar los desempeños' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const updatePerformance = (dimension: string, value: string) => {
    setPerformances(prev =>
      prev.map(p =>
        p.dimension === dimension ? { ...p, baseDescription: value } : p
      )
    )
  }

  const updateComplement = (level: string, field: string, value: any) => {
    setComplements(prev =>
      prev.map(c =>
        c.level === level ? { ...c, [field]: value } : c
      )
    )
  }

  const selectedAssignment = teacherAssignments.find(a => a.id === selectedAssignmentId)

  const tabs = [
    { id: 'register' as TabType, label: 'Registrar Desempeños', icon: FileText },
    ...(isAdmin ? [{ id: 'config' as TabType, label: 'Configuración', icon: Settings }] : []),
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Desempeños Académicos</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Registro de desempeños base por dimensión</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 mb-6">
        <nav className="flex gap-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Mensaje */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
          message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Tab: Registrar Desempeños */}
      {activeTab === 'register' && (
        <div className="space-y-6">
          {/* Filtros */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Año Académico</label>
                <select
                  value={selectedYearId}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar...</option>
                  {academicYears.map(year => (
                    <option key={year.id} value={year.id}>{year.year}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Período</label>
                <select
                  value={selectedTermId}
                  onChange={(e) => setSelectedTermId(e.target.value)}
                  disabled={!selectedYearId}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                >
                  <option value="">Seleccionar...</option>
                  {terms.map(term => (
                    <option key={term.id} value={term.id}>{term.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Grupo</label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  disabled={!selectedYearId}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                >
                  <option value="">Seleccionar...</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.grade?.name} - {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Asignatura</label>
                <select
                  value={selectedAssignmentId}
                  onChange={(e) => setSelectedAssignmentId(e.target.value)}
                  disabled={!selectedGroupId}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100"
                >
                  <option value="">Seleccionar...</option>
                  {teacherAssignments.map(ta => (
                    <option key={ta.id} value={ta.id}>
                      {ta.subject?.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Formulario de desempeños */}
          {selectedAssignmentId && selectedTermId && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Desempeños Base - {selectedAssignment?.subject?.name}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Registre los desempeños base para cada dimensión. El sistema determinará automáticamente el nivel según la nota del estudiante.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {performances.map((perf) => {
                  const Icon = DIMENSION_ICONS[perf.dimension]
                  return (
                    <div key={perf.dimension} className="border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg ${
                          perf.dimension === 'COGNITIVO' ? 'bg-blue-100 text-blue-600' :
                          perf.dimension === 'PROCEDIMENTAL' ? 'bg-amber-100 text-amber-600' :
                          'bg-pink-100 text-pink-600'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-medium text-slate-900">
                            Desempeño {DIMENSION_LABELS[perf.dimension]}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {perf.dimension === 'COGNITIVO' && 'Saber - Conocimientos y comprensión'}
                            {perf.dimension === 'PROCEDIMENTAL' && 'Hacer - Habilidades y procedimientos'}
                            {perf.dimension === 'ACTITUDINAL' && 'Ser - Actitudes y valores'}
                          </p>
                        </div>
                      </div>
                      <textarea
                        value={perf.baseDescription}
                        onChange={(e) => updatePerformance(perf.dimension, e.target.value)}
                        placeholder={`Describa el desempeño ${DIMENSION_LABELS[perf.dimension].toLowerCase()} esperado...`}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200 flex justify-end">
                <button
                  onClick={handleSavePerformances}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Guardando...' : 'Guardar Desempeños'}
                </button>
              </div>
            </div>
          )}

          {!selectedAssignmentId && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
              <BookOpen className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500">Seleccione año, período, grupo y asignatura para registrar desempeños</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Configuración */}
      {activeTab === 'config' && isAdmin && (
        <div className="space-y-6">
          {/* Configuración General */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Configuración General
            </h2>

            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.isEnabled}
                  onChange={(e) => setConfig({ ...config, isEnabled: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Habilitar módulo de desempeños automáticos</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.showByDimension}
                  onChange={(e) => setConfig({ ...config, showByDimension: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Mostrar desempeños por dimensión en boletín (vs. consolidado)</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={config.allowManualEdit}
                  onChange={(e) => setConfig({ ...config, allowManualEdit: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Permitir edición manual excepcional (con auditoría)</span>
              </label>

              <div className="pt-4">
                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Guardando...' : 'Guardar Configuración'}
                </button>
              </div>
            </div>
          </div>

          {/* Complementos por Nivel */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Complementos por Nivel de Desempeño
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Estos textos se concatenan automáticamente al desempeño base según el nivel alcanzado
                </p>
              </div>
              <button
                onClick={handleCreateDefaultComplements}
                disabled={saving}
                className="flex items-center gap-2 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <RefreshCw className="w-4 h-4" />
                Restaurar Predeterminados
              </button>
            </div>

            <div className="space-y-4">
              {['SUPERIOR', 'ALTO', 'BASICO', 'BAJO'].map((level) => {
                const comp = complements.find(c => c.level === level) || {
                  level,
                  complement: '',
                  isActive: true,
                  displayMode: 'CONCATENATE' as const,
                }
                return (
                  <div key={level} className={`border rounded-lg p-4 ${
                    level === 'SUPERIOR' ? 'border-green-200 bg-green-50' :
                    level === 'ALTO' ? 'border-blue-200 bg-blue-50' :
                    level === 'BASICO' ? 'border-amber-200 bg-amber-50' :
                    'border-red-200 bg-red-50'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          level === 'SUPERIOR' ? 'bg-green-200 text-green-800' :
                          level === 'ALTO' ? 'bg-blue-200 text-blue-800' :
                          level === 'BASICO' ? 'bg-amber-200 text-amber-800' :
                          'bg-red-200 text-red-800'
                        }`}>
                          {LEVEL_LABELS[level as keyof typeof LEVEL_LABELS]}
                        </span>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={comp.isActive}
                            onChange={(e) => updateComplement(level, 'isActive', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <span className="text-xs text-slate-600">Activo</span>
                        </label>
                      </div>
                      <select
                        value={comp.displayMode}
                        onChange={(e) => updateComplement(level, 'displayMode', e.target.value)}
                        className="text-xs px-2 py-1 border border-slate-300 rounded"
                      >
                        <option value="CONCATENATE">Concatenar</option>
                        <option value="SEPARATE_LINE">Línea separada</option>
                      </select>
                    </div>
                    <textarea
                      value={comp.complement}
                      onChange={(e) => updateComplement(level, 'complement', e.target.value)}
                      placeholder="Texto complementario para este nivel..."
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                    />
                  </div>
                )
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200">
              <button
                onClick={handleSaveComplements}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Guardando...' : 'Guardar Complementos'}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Vista Previa en Boletín</h2>
            <div className="bg-slate-50 rounded-lg p-4 space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700">Desempeño Cognitivo (Básico):</p>
                <p className="text-sm text-slate-600 mt-1">
                  Analiza y comprende conceptos fundamentales, {complements.find(c => c.level === 'BASICO')?.complement || '...'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Desempeño Procedimental (Alto):</p>
                <p className="text-sm text-slate-600 mt-1">
                  Aplica procedimientos y resuelve situaciones problema, {complements.find(c => c.level === 'ALTO')?.complement || '...'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Desempeño Actitudinal (Superior):</p>
                <p className="text-sm text-slate-600 mt-1">
                  Demuestra responsabilidad y participación constante, {complements.find(c => c.level === 'SUPERIOR')?.complement || '...'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
