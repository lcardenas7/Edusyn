import { useState } from 'react'
import { 
  Building2, 
  BookOpen, 
  Calendar, 
  Users, 
  Settings, 
  ChevronRight,
  ChevronDown,
  Percent,
  Layers,
  GraduationCap,
  Clock,
  Save,
  Plus,
  Edit2,
  Trash2,
  X,
  UsersRound
} from 'lucide-react'
import { useInstitution, Period } from '../contexts/InstitutionContext'

type TabType = 'general' | 'grading' | 'periods' | 'grades' | 'areas' | 'teachers'

interface Grade {
  id: string
  name: string
  level: 'PREESCOLAR' | 'PRIMARIA' | 'SECUNDARIA' | 'MEDIA'
  order: number
  groups: Group[]
}

interface Group {
  id: string
  name: string
  shift: 'MAÑANA' | 'TARDE' | 'UNICA'
  capacity: number
  director?: string
}

const defaultGrades: Grade[] = [
  { id: 'g1', name: 'Transición', level: 'PREESCOLAR', order: 0, groups: [{ id: 'gr1', name: 'A', shift: 'MAÑANA', capacity: 30 }] },
  { id: 'g2', name: 'Primero', level: 'PRIMARIA', order: 1, groups: [{ id: 'gr2', name: 'A', shift: 'MAÑANA', capacity: 35 }, { id: 'gr3', name: 'B', shift: 'MAÑANA', capacity: 35 }] },
  { id: 'g3', name: 'Segundo', level: 'PRIMARIA', order: 2, groups: [{ id: 'gr4', name: 'A', shift: 'MAÑANA', capacity: 35 }] },
  { id: 'g4', name: 'Tercero', level: 'PRIMARIA', order: 3, groups: [{ id: 'gr5', name: 'A', shift: 'MAÑANA', capacity: 35 }] },
  { id: 'g5', name: 'Cuarto', level: 'PRIMARIA', order: 4, groups: [{ id: 'gr6', name: 'A', shift: 'MAÑANA', capacity: 35 }] },
  { id: 'g6', name: 'Quinto', level: 'PRIMARIA', order: 5, groups: [{ id: 'gr7', name: 'A', shift: 'MAÑANA', capacity: 35 }] },
  { id: 'g7', name: 'Sexto', level: 'SECUNDARIA', order: 6, groups: [{ id: 'gr8', name: 'A', shift: 'MAÑANA', capacity: 40 }, { id: 'gr9', name: 'B', shift: 'MAÑANA', capacity: 40 }] },
  { id: 'g8', name: 'Séptimo', level: 'SECUNDARIA', order: 7, groups: [{ id: 'gr10', name: 'A', shift: 'MAÑANA', capacity: 40 }] },
  { id: 'g9', name: 'Octavo', level: 'SECUNDARIA', order: 8, groups: [{ id: 'gr11', name: 'A', shift: 'MAÑANA', capacity: 40 }] },
  { id: 'g10', name: 'Noveno', level: 'SECUNDARIA', order: 9, groups: [{ id: 'gr12', name: 'A', shift: 'MAÑANA', capacity: 40 }] },
  { id: 'g11', name: 'Décimo', level: 'MEDIA', order: 10, groups: [{ id: 'gr13', name: 'A', shift: 'MAÑANA', capacity: 40 }] },
  { id: 'g12', name: 'Undécimo', level: 'MEDIA', order: 11, groups: [{ id: 'gr14', name: 'A', shift: 'MAÑANA', capacity: 40 }] },
]

const levelLabels = {
  PREESCOLAR: 'Preescolar',
  PRIMARIA: 'Primaria',
  SECUNDARIA: 'Secundaria',
  MEDIA: 'Media',
}

const levelColors = {
  PREESCOLAR: 'bg-pink-100 text-pink-700 border-pink-200',
  PRIMARIA: 'bg-blue-100 text-blue-700 border-blue-200',
  SECUNDARIA: 'bg-green-100 text-green-700 border-green-200',
  MEDIA: 'bg-purple-100 text-purple-700 border-purple-200',
}

export default function Institution() {
  const { institution, gradingConfig, setGradingConfig, periods, setPeriods } = useInstitution()
  const [activeTab, setActiveTab] = useState<TabType>('general')

  const [showPeriodModal, setShowPeriodModal] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null)
  const [periodForm, setPeriodForm] = useState({ name: '', weight: 25, startDate: '', endDate: '' })

  const [grades, setGrades] = useState<Grade[]>(defaultGrades)
  const [showGradeModal, setShowGradeModal] = useState(false)
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null)
  const [gradeForm, setGradeForm] = useState({ name: '', level: 'PRIMARIA' as Grade['level'], order: 0 })
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<{ gradeId: string; group: Group | null }>(null!)
  const [groupForm, setGroupForm] = useState({ name: '', shift: 'MAÑANA' as Group['shift'], capacity: 35, director: '' })
  const [expandedGrades, setExpandedGrades] = useState<string[]>([])

  const tabs = [
    { id: 'general' as TabType, name: 'Información General', icon: Building2 },
    { id: 'grading' as TabType, name: 'Sistema de Calificación', icon: Percent },
    { id: 'periods' as TabType, name: 'Períodos Académicos', icon: Calendar },
    { id: 'grades' as TabType, name: 'Grados y Grupos', icon: GraduationCap },
    { id: 'areas' as TabType, name: 'Áreas y Asignaturas', icon: Layers },
    { id: 'teachers' as TabType, name: 'Carga Académica', icon: Users },
  ]

  const openPeriodModal = (period?: Period) => {
    if (period) {
      setEditingPeriod(period)
      setPeriodForm({ name: period.name, weight: period.weight, startDate: period.startDate, endDate: period.endDate })
    } else {
      setEditingPeriod(null)
      setPeriodForm({ name: `Período ${periods.length + 1}`, weight: 25, startDate: '', endDate: '' })
    }
    setShowPeriodModal(true)
  }

  const savePeriod = () => {
    if (!periodForm.name.trim()) return
    
    if (editingPeriod) {
      setPeriods(periods.map(p => p.id === editingPeriod.id ? { ...p, ...periodForm } : p))
    } else {
      setPeriods([...periods, { id: `period-${Date.now()}`, ...periodForm }])
    }
    setShowPeriodModal(false)
  }

  const deletePeriod = (id: string) => {
    if (periods.length <= 1) return
    setPeriods(periods.filter(p => p.id !== id))
  }

  const toggleGradeExpand = (gradeId: string) => {
    setExpandedGrades(prev => 
      prev.includes(gradeId) ? prev.filter(id => id !== gradeId) : [...prev, gradeId]
    )
  }

  const openGradeModal = (grade?: Grade) => {
    if (grade) {
      setEditingGrade(grade)
      setGradeForm({ name: grade.name, level: grade.level, order: grade.order })
    } else {
      setEditingGrade(null)
      setGradeForm({ name: '', level: 'PRIMARIA', order: grades.length })
    }
    setShowGradeModal(true)
  }

  const saveGrade = () => {
    if (!gradeForm.name.trim()) return
    if (editingGrade) {
      setGrades(grades.map(g => g.id === editingGrade.id ? { ...g, ...gradeForm } : g))
    } else {
      setGrades([...grades, { id: `grade-${Date.now()}`, ...gradeForm, groups: [] }])
    }
    setShowGradeModal(false)
  }

  const deleteGrade = (id: string) => {
    setGrades(grades.filter(g => g.id !== id))
  }

  const openGroupModal = (gradeId: string, group?: Group) => {
    if (group) {
      setEditingGroup({ gradeId, group })
      setGroupForm({ name: group.name, shift: group.shift, capacity: group.capacity, director: group.director || '' })
    } else {
      setEditingGroup({ gradeId, group: null })
      const grade = grades.find(g => g.id === gradeId)
      const nextLetter = String.fromCharCode(65 + (grade?.groups.length || 0))
      setGroupForm({ name: nextLetter, shift: 'MAÑANA', capacity: 35, director: '' })
    }
    setShowGroupModal(true)
  }

  const saveGroup = () => {
    if (!groupForm.name.trim() || !editingGroup) return
    const newGroup: Group = {
      id: editingGroup.group?.id || `group-${Date.now()}`,
      ...groupForm
    }
    setGrades(grades.map(g => {
      if (g.id !== editingGroup.gradeId) return g
      if (editingGroup.group) {
        return { ...g, groups: g.groups.map(gr => gr.id === editingGroup.group!.id ? newGroup : gr) }
      } else {
        return { ...g, groups: [...g.groups, newGroup] }
      }
    }))
    setShowGroupModal(false)
  }

  const deleteGroup = (gradeId: string, groupId: string) => {
    setGrades(grades.map(g => 
      g.id === gradeId ? { ...g, groups: g.groups.filter(gr => gr.id !== groupId) } : g
    ))
  }

  const gradesByLevel = {
    PREESCOLAR: grades.filter(g => g.level === 'PREESCOLAR'),
    PRIMARIA: grades.filter(g => g.level === 'PRIMARIA'),
    SECUNDARIA: grades.filter(g => g.level === 'SECUNDARIA'),
    MEDIA: grades.filter(g => g.level === 'MEDIA'),
  }

  const totalComponentWeight = gradingConfig.cognitivo + gradingConfig.procedimental + gradingConfig.actitudinal
  const totalAttitudinalWeight = Object.values(gradingConfig.attitudinalBreakdown).reduce((a, b) => a + b, 0)
  const totalPeriodWeight = periods.reduce((sum, p) => sum + p.weight, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuración Institucional</h1>
          <p className="text-slate-500 mt-1">Administra la configuración académica de tu institución</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <Save className="w-4 h-4" />
          Guardar Cambios
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar de tabs */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Configuración</span>
              </div>
            </div>
            <nav className="p-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.name}
                  <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${activeTab === tab.id ? 'rotate-90' : ''}`} />
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Contenido principal */}
        <div className="flex-1">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            {/* Tab: Información General */}
            {activeTab === 'general' && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Información General</h2>
                    <p className="text-sm text-slate-500">Datos básicos de la institución</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la Institución</label>
                    <input
                      type="text"
                      value={institution.name}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">NIT</label>
                    <input
                      type="text"
                      value={institution.nit}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Código DANE</label>
                    <input
                      type="text"
                      value={institution.dane}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Rector(a)</label>
                    <input
                      type="text"
                      value={institution.rector}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                    <input
                      type="text"
                      value={institution.address}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ciudad</label>
                    <input
                      type="text"
                      value={institution.city}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                    <input
                      type="text"
                      value={institution.phone}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
                    <input
                      type="email"
                      value={institution.email}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Año Académico Actual</label>
                    <input
                      type="number"
                      value={institution.academicYear}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      readOnly
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Sistema de Calificación */}
            {activeTab === 'grading' && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Percent className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Sistema de Calificación</h2>
                    <p className="text-sm text-slate-500">Configura los componentes evaluativos y la escala de valoración</p>
                  </div>
                </div>

                {/* Componentes Evaluativos */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Componentes Evaluativos
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
                      <label className="block text-sm font-medium text-blue-700 mb-2">Cognitivo</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={gradingConfig.cognitivo}
                          onChange={(e) => setGradingConfig({ ...gradingConfig, cognitivo: parseInt(e.target.value) || 0 })}
                          className="w-20 px-3 py-2 border border-blue-300 rounded-lg text-center font-semibold"
                        />
                        <span className="text-blue-600 font-medium">%</span>
                      </div>
                    </div>
                    <div className="p-4 border border-green-200 rounded-lg bg-green-50">
                      <label className="block text-sm font-medium text-green-700 mb-2">Procedimental</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={gradingConfig.procedimental}
                          onChange={(e) => setGradingConfig({ ...gradingConfig, procedimental: parseInt(e.target.value) || 0 })}
                          className="w-20 px-3 py-2 border border-green-300 rounded-lg text-center font-semibold"
                        />
                        <span className="text-green-600 font-medium">%</span>
                      </div>
                    </div>
                    <div className="p-4 border border-amber-200 rounded-lg bg-amber-50">
                      <label className="block text-sm font-medium text-amber-700 mb-2">Actitudinal</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={gradingConfig.actitudinal}
                          onChange={(e) => setGradingConfig({ ...gradingConfig, actitudinal: parseInt(e.target.value) || 0 })}
                          className="w-20 px-3 py-2 border border-amber-300 rounded-lg text-center font-semibold"
                        />
                        <span className="text-amber-600 font-medium">%</span>
                      </div>
                    </div>
                  </div>
                  <div className={`mt-3 p-2 rounded-lg text-sm ${totalComponentWeight === 100 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    Total: <strong>{totalComponentWeight}%</strong> {totalComponentWeight !== 100 && '(debe sumar 100%)'}
                  </div>
                </div>

                {/* Distribución Actitudinal */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-slate-800 mb-4">Distribución del Componente Actitudinal</h3>
                  <div className="grid grid-cols-4 gap-4">
                    {Object.entries(gradingConfig.attitudinalBreakdown).map(([key, value]) => (
                      <div key={key} className="p-3 border border-slate-200 rounded-lg">
                        <label className="block text-xs font-medium text-slate-600 mb-1 capitalize">
                          {key === 'autoevaluacion' ? 'Autoevaluación' : key === 'coevaluacion' ? 'Coevaluación' : key.charAt(0).toUpperCase() + key.slice(1)}
                        </label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={value}
                            onChange={(e) => setGradingConfig({
                              ...gradingConfig,
                              attitudinalBreakdown: {
                                ...gradingConfig.attitudinalBreakdown,
                                [key]: parseInt(e.target.value) || 0
                              }
                            })}
                            className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-sm"
                          />
                          <span className="text-slate-500 text-sm">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={`mt-3 p-2 rounded-lg text-sm ${totalAttitudinalWeight === gradingConfig.actitudinal ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    Total Actitudinal: <strong>{totalAttitudinalWeight}%</strong> {totalAttitudinalWeight !== gradingConfig.actitudinal && `(debe sumar ${gradingConfig.actitudinal}%)`}
                  </div>
                </div>

                {/* Escala de Valoración */}
                <div className="mb-8">
                  <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" />
                    Escala de Valoración
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <span className="w-24 font-medium text-green-700">Superior</span>
                      <div className="flex items-center gap-2">
                        <input type="number" step="0.1" value={gradingConfig.scale.superior.min} className="w-16 px-2 py-1 border border-green-300 rounded text-center text-sm" readOnly />
                        <span className="text-slate-500">-</span>
                        <input type="number" step="0.1" value={gradingConfig.scale.superior.max} className="w-16 px-2 py-1 border border-green-300 rounded text-center text-sm" readOnly />
                      </div>
                      <span className="text-sm text-green-600">90% - 100%</span>
                    </div>
                    <div className="flex items-center gap-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <span className="w-24 font-medium text-blue-700">Alto</span>
                      <div className="flex items-center gap-2">
                        <input type="number" step="0.1" value={gradingConfig.scale.alto.min} className="w-16 px-2 py-1 border border-blue-300 rounded text-center text-sm" readOnly />
                        <span className="text-slate-500">-</span>
                        <input type="number" step="0.1" value={gradingConfig.scale.alto.max} className="w-16 px-2 py-1 border border-blue-300 rounded text-center text-sm" readOnly />
                      </div>
                      <span className="text-sm text-blue-600">80% - 89%</span>
                    </div>
                    <div className="flex items-center gap-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <span className="w-24 font-medium text-amber-700">Básico</span>
                      <div className="flex items-center gap-2">
                        <input type="number" step="0.1" value={gradingConfig.scale.basico.min} className="w-16 px-2 py-1 border border-amber-300 rounded text-center text-sm" readOnly />
                        <span className="text-slate-500">-</span>
                        <input type="number" step="0.1" value={gradingConfig.scale.basico.max} className="w-16 px-2 py-1 border border-amber-300 rounded text-center text-sm" readOnly />
                      </div>
                      <span className="text-sm text-amber-600">60% - 79%</span>
                    </div>
                    <div className="flex items-center gap-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <span className="w-24 font-medium text-red-700">Bajo</span>
                      <div className="flex items-center gap-2">
                        <input type="number" step="0.1" value={gradingConfig.scale.bajo.min} className="w-16 px-2 py-1 border border-red-300 rounded text-center text-sm" readOnly />
                        <span className="text-slate-500">-</span>
                        <input type="number" step="0.1" value={gradingConfig.scale.bajo.max} className="w-16 px-2 py-1 border border-red-300 rounded text-center text-sm" readOnly />
                      </div>
                      <span className="text-sm text-red-600">20% - 59%</span>
                    </div>
                  </div>
                </div>

                {/* Nota mínima aprobatoria */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-3">Nota Mínima Aprobatoria</h3>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      value={gradingConfig.minPassingGrade}
                      onChange={(e) => setGradingConfig({ ...gradingConfig, minPassingGrade: parseFloat(e.target.value) || 3.0 })}
                      className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-center font-semibold text-lg"
                    />
                    <span className="text-slate-500">sobre 5.0</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Períodos Académicos */}
            {activeTab === 'periods' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Calendar className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Períodos Académicos</h2>
                      <p className="text-sm text-slate-500">Configura los períodos del año escolar y su peso en la nota final</p>
                    </div>
                  </div>
                  <button
                    onClick={() => openPeriodModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar Período
                  </button>
                </div>

                <div className="space-y-3">
                  {periods.map((period, index) => (
                    <div key={period.id} className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                        <span className="font-bold text-purple-600">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900">{period.name}</h4>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {period.startDate} - {period.endDate}
                          </span>
                        </div>
                      </div>
                      <div className="text-center">
                        <span className="text-2xl font-bold text-purple-600">{period.weight}%</span>
                        <p className="text-xs text-slate-500">Peso</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openPeriodModal(period)}
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deletePeriod(period.id)}
                          disabled={periods.length <= 1}
                          className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-600 disabled:opacity-30"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`mt-4 p-3 rounded-lg text-sm ${totalPeriodWeight === 100 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  Peso total de períodos: <strong>{totalPeriodWeight}%</strong> {totalPeriodWeight !== 100 && '(debe sumar 100%)'}
                </div>
              </div>
            )}

            {/* Tab: Grados y Grupos */}
            {activeTab === 'grades' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                      <GraduationCap className="w-6 h-6 text-teal-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Grados y Grupos</h2>
                      <p className="text-sm text-slate-500">Configura los grados académicos y sus grupos</p>
                    </div>
                  </div>
                  <button
                    onClick={() => openGradeModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar Grado
                  </button>
                </div>

                {/* Resumen */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900">{grades.length}</p>
                    <p className="text-xs text-slate-500">Grados</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900">{grades.reduce((sum, g) => sum + g.groups.length, 0)}</p>
                    <p className="text-xs text-slate-500">Grupos</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900">{grades.reduce((sum, g) => sum + g.groups.reduce((s, gr) => s + gr.capacity, 0), 0)}</p>
                    <p className="text-xs text-slate-500">Capacidad Total</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900">4</p>
                    <p className="text-xs text-slate-500">Niveles</p>
                  </div>
                </div>

                {/* Lista por nivel */}
                <div className="space-y-6">
                  {(['PREESCOLAR', 'PRIMARIA', 'SECUNDARIA', 'MEDIA'] as const).map((level) => (
                    <div key={level} className={`border rounded-lg overflow-hidden ${levelColors[level].replace('text-', 'border-').split(' ')[2]}`}>
                      <div className={`px-4 py-3 ${levelColors[level]} flex items-center justify-between`}>
                        <h3 className="font-semibold">{levelLabels[level]}</h3>
                        <span className="text-sm">{gradesByLevel[level].length} grado(s)</span>
                      </div>
                      <div className="bg-white divide-y divide-slate-100">
                        {gradesByLevel[level].length === 0 ? (
                          <p className="px-4 py-6 text-center text-slate-400 text-sm">No hay grados en este nivel</p>
                        ) : (
                          gradesByLevel[level].sort((a, b) => a.order - b.order).map((grade) => (
                            <div key={grade.id}>
                              <div 
                                className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 cursor-pointer"
                                onClick={() => toggleGradeExpand(grade.id)}
                              >
                                <button className="p-1">
                                  {expandedGrades.includes(grade.id) ? (
                                    <ChevronDown className="w-4 h-4 text-slate-400" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                  )}
                                </button>
                                <div className="flex-1">
                                  <span className="font-medium text-slate-900">{grade.name}</span>
                                  <span className="ml-2 text-sm text-slate-500">({grade.groups.length} grupo{grade.groups.length !== 1 ? 's' : ''})</span>
                                </div>
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => openGroupModal(grade.id)}
                                    className="p-1.5 hover:bg-teal-100 rounded text-teal-600"
                                    title="Agregar grupo"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => openGradeModal(grade)}
                                    className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteGrade(grade.id)}
                                    className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                              {expandedGrades.includes(grade.id) && grade.groups.length > 0 && (
                                <div className="bg-slate-50 px-4 py-2 ml-8 border-l-2 border-slate-200">
                                  <div className="grid grid-cols-1 gap-2">
                                    {grade.groups.map((group) => (
                                      <div key={group.id} className="flex items-center gap-3 bg-white px-3 py-2 rounded-lg border border-slate-200">
                                        <UsersRound className="w-4 h-4 text-slate-400" />
                                        <span className="font-medium text-slate-700">{grade.name} {group.name}</span>
                                        <span className="text-xs px-2 py-0.5 bg-slate-100 rounded text-slate-500">{group.shift}</span>
                                        <span className="text-xs text-slate-500">Cap: {group.capacity}</span>
                                        {group.director && <span className="text-xs text-slate-500">Dir: {group.director}</span>}
                                        <div className="ml-auto flex items-center gap-1">
                                          <button
                                            onClick={() => openGroupModal(grade.id, group)}
                                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600"
                                          >
                                            <Edit2 className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={() => deleteGroup(grade.id, group.id)}
                                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab: Áreas y Asignaturas */}
            {activeTab === 'areas' && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Layers className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Áreas y Asignaturas</h2>
                    <p className="text-sm text-slate-500">Las notas se registran por asignatura, pero la promoción se determina por área</p>
                  </div>
                </div>

                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-indigo-700">
                    <strong>Nota:</strong> Para configurar las áreas y asignaturas, ve a la sección 
                    <a href="/admin/areas" className="underline ml-1 font-medium">Áreas</a> en el menú lateral.
                  </p>
                </div>

                <div className="text-center py-8">
                  <Layers className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                  <p className="text-slate-500 mb-4">Administra la estructura de áreas y asignaturas</p>
                  <a
                    href="/admin/areas"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Ir a Configuración de Áreas
                  </a>
                </div>
              </div>
            )}

            {/* Tab: Carga Académica */}
            {activeTab === 'teachers' && (
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-orange-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Carga Académica de Docentes</h2>
                    <p className="text-sm text-slate-500">Asigna grupos y asignaturas a cada docente</p>
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-orange-700">
                    <strong>Próximamente:</strong> Aquí podrás asignar a cada docente las asignaturas y grupos que le corresponden.
                  </p>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Docente</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Asignaturas</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase">Grupos</th>
                        <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Horas/Semana</th>
                        <th className="text-center px-4 py-3 text-xs font-medium text-slate-500 uppercase">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">Prof. García</td>
                        <td className="px-4 py-3 text-slate-600">Matemáticas, Física</td>
                        <td className="px-4 py-3 text-slate-600">8°A, 8°B, 9°A</td>
                        <td className="px-4 py-3 text-center text-slate-600">24</td>
                        <td className="px-4 py-3 text-center">
                          <button className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">Prof. López</td>
                        <td className="px-4 py-3 text-slate-600">Lengua Castellana</td>
                        <td className="px-4 py-3 text-slate-600">8°A, 8°B, 9°A, 9°B</td>
                        <td className="px-4 py-3 text-center text-slate-600">20</td>
                        <td className="px-4 py-3 text-center">
                          <button className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">Prof. Martínez</td>
                        <td className="px-4 py-3 text-slate-600">Ciencias Naturales, Química</td>
                        <td className="px-4 py-3 text-slate-600">9°A, 9°B, 10°A</td>
                        <td className="px-4 py-3 text-center text-slate-600">22</td>
                        <td className="px-4 py-3 text-center">
                          <button className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600">
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Período */}
      {showPeriodModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingPeriod ? 'Editar Período' : 'Nuevo Período'}
              </h3>
              <button onClick={() => setShowPeriodModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del período</label>
                <input
                  type="text"
                  value={periodForm.name}
                  onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Peso en la nota final (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={periodForm.weight}
                  onChange={(e) => setPeriodForm({ ...periodForm, weight: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha inicio</label>
                  <input
                    type="date"
                    value={periodForm.startDate}
                    onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fecha fin</label>
                  <input
                    type="date"
                    value={periodForm.endDate}
                    onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowPeriodModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={savePeriod}
                disabled={!periodForm.name.trim()}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {editingPeriod ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Grado */}
      {showGradeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingGrade ? 'Editar Grado' : 'Nuevo Grado'}
              </h3>
              <button onClick={() => setShowGradeModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del grado</label>
                <input
                  type="text"
                  value={gradeForm.name}
                  onChange={(e) => setGradeForm({ ...gradeForm, name: e.target.value })}
                  placeholder="Ej: Sexto, Séptimo, Octavo..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nivel educativo</label>
                <select
                  value={gradeForm.level}
                  onChange={(e) => setGradeForm({ ...gradeForm, level: e.target.value as Grade['level'] })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                >
                  <option value="PREESCOLAR">Preescolar</option>
                  <option value="PRIMARIA">Primaria</option>
                  <option value="SECUNDARIA">Secundaria</option>
                  <option value="MEDIA">Media</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Orden</label>
                <input
                  type="number"
                  min="0"
                  value={gradeForm.order}
                  onChange={(e) => setGradeForm({ ...gradeForm, order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">Define el orden de aparición del grado</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGradeModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveGrade}
                disabled={!gradeForm.name.trim()}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {editingGrade ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Grupo */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingGroup?.group ? 'Editar Grupo' : 'Nuevo Grupo'}
              </h3>
              <button onClick={() => setShowGroupModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del grupo</label>
                <input
                  type="text"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  placeholder="Ej: A, B, C..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Jornada</label>
                <select
                  value={groupForm.shift}
                  onChange={(e) => setGroupForm({ ...groupForm, shift: e.target.value as Group['shift'] })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                >
                  <option value="MAÑANA">Mañana</option>
                  <option value="TARDE">Tarde</option>
                  <option value="UNICA">Única</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Capacidad</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={groupForm.capacity}
                  onChange={(e) => setGroupForm({ ...groupForm, capacity: parseInt(e.target.value) || 30 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Director de grupo (opcional)</label>
                <input
                  type="text"
                  value={groupForm.director}
                  onChange={(e) => setGroupForm({ ...groupForm, director: e.target.value })}
                  placeholder="Nombre del docente director"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowGroupModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveGroup}
                disabled={!groupForm.name.trim()}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {editingGroup?.group ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
