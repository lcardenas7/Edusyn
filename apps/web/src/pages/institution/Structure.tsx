import { useState, useEffect } from 'react'
import { 
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  ChevronRight,
  ChevronDown,
  UsersRound,
  Eye,
  ArrowLeft,
  X,
  Building2
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions, PERMISSIONS } from '../../hooks/usePermissions'

// Etapas del MEN (clasificación oficial del sistema educativo colombiano)
// Esto es INSTITUCIONAL, no académico - existe aunque no haya estudiantes
type GradeStage = 'PREESCOLAR' | 'PRIMARIA' | 'SECUNDARIA' | 'MEDIA'

interface Group {
  id: string
  name: string
  shift: 'MAÑANA' | 'TARDE' | 'NOCHE' | 'ÚNICA'
  capacity: number
  director?: string
}

interface Grade {
  id: string
  name: string
  stage: GradeStage  // Etapa MEN, no nivel académico
  order: number
  groups: Group[]
}

// Etapas MEN con sus colores (esto es fijo, definido por el MEN)
const MEN_STAGES: { code: GradeStage; name: string; color: string }[] = [
  { code: 'PREESCOLAR', name: 'Preescolar', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { code: 'PRIMARIA', name: 'Básica Primaria', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { code: 'SECUNDARIA', name: 'Básica Secundaria', color: 'bg-green-100 text-green-700 border-green-200' },
  { code: 'MEDIA', name: 'Media', color: 'bg-purple-100 text-purple-700 border-purple-200' },
]

function getStageColor(stageCode: GradeStage): string {
  const stage = MEN_STAGES.find(s => s.code === stageCode)
  return stage?.color || 'bg-slate-100 text-slate-700 border-slate-200'
}

export default function Structure() {
  const { institution: authInstitution } = useAuth()
  const { can } = usePermissions()
  
  const canEditGrades = can(PERMISSIONS.CONFIG_GRADES_EDIT)
  
  // Estados para grados y grupos
  const [grades, setGrades] = useState<Grade[]>(() => {
    const institutionId = authInstitution?.id || 'default'
    const saved = localStorage.getItem(`edusyn_institutional_grades_${institutionId}`)
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
    return []
  })
  
  const [expandedGrades, setExpandedGrades] = useState<string[]>([])
  const [showGradeModal, setShowGradeModal] = useState(false)
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null)
  const [gradeForm, setGradeForm] = useState({ name: '', stage: 'PRIMARIA' as GradeStage, order: 0 })
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<{ gradeId: string; group: Group | null } | null>(null)
  const [groupForm, setGroupForm] = useState({ name: '', shift: 'MAÑANA' as Group['shift'], capacity: 35, director: '' })

  // Guardar grados en localStorage y sincronizar con BD
  useEffect(() => {
    if (authInstitution?.id) {
      localStorage.setItem(`edusyn_institutional_grades_${authInstitution.id}`, JSON.stringify(grades))
      
      // Sincronizar con la BD (debounced para evitar muchas llamadas)
      const syncTimeout = setTimeout(async () => {
        if (grades.length > 0) {
          try {
            const { academicGradesApi } = await import('../../lib/api')
            await academicGradesApi.sync(grades)
            console.log('[Structure] Grados sincronizados con BD')
          } catch (err) {
            console.error('[Structure] Error sincronizando grados:', err)
          }
        }
      }, 2000)
      
      return () => clearTimeout(syncTimeout)
    }
  }, [grades, authInstitution?.id])

  const toggleGradeExpand = (gradeId: string) => {
    setExpandedGrades(prev => 
      prev.includes(gradeId) ? prev.filter(id => id !== gradeId) : [...prev, gradeId]
    )
  }

  const openGradeModal = (grade?: Grade) => {
    if (grade) {
      setEditingGrade(grade)
      setGradeForm({ name: grade.name, stage: grade.stage, order: grade.order })
    } else {
      setEditingGrade(null)
      setGradeForm({ name: '', stage: 'PRIMARIA', order: grades.length })
    }
    setShowGradeModal(true)
  }

  const saveGrade = () => {
    if (!gradeForm.name.trim() || !gradeForm.stage) return
    
    if (editingGrade) {
      setGrades(grades.map(g => 
        g.id === editingGrade.id 
          ? { ...g, name: gradeForm.name, stage: gradeForm.stage, order: gradeForm.order }
          : g
      ))
    } else {
      const newGrade: Grade = {
        id: `grade-${Date.now()}`,
        name: gradeForm.name,
        stage: gradeForm.stage,
        order: gradeForm.order,
        groups: []
      }
      setGrades([...grades, newGrade])
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
      setGroupForm({ name: '', shift: 'MAÑANA', capacity: 35, director: '' })
    }
    setShowGroupModal(true)
  }

  const saveGroup = () => {
    if (!editingGroup || !groupForm.name.trim()) return
    
    const { gradeId, group } = editingGroup
    
    if (group) {
      setGrades(grades.map(g => 
        g.id === gradeId 
          ? { ...g, groups: g.groups.map(gr => gr.id === group.id ? { ...gr, ...groupForm } : gr) }
          : g
      ))
    } else {
      const newGroup: Group = {
        id: `group-${Date.now()}`,
        name: groupForm.name,
        shift: groupForm.shift,
        capacity: groupForm.capacity,
        director: groupForm.director || undefined
      }
      setGrades(grades.map(g => 
        g.id === gradeId ? { ...g, groups: [...g.groups, newGroup] } : g
      ))
    }
    setShowGroupModal(false)
  }

  const deleteGroup = (gradeId: string, groupId: string) => {
    setGrades(grades.map(g => 
      g.id === gradeId ? { ...g, groups: g.groups.filter(gr => gr.id !== groupId) } : g
    ))
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link 
            to="/institution" 
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Estructura Organizacional</h1>
              <p className="text-sm text-slate-500">Grados y grupos de la institución</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!canEditGrades && (
            <span className="flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
              <Eye className="w-3 h-3" /> Solo lectura
            </span>
          )}
          {canEditGrades && (
            <button
              onClick={() => openGradeModal()}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Agregar Grado
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6">
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
              <p className="text-2xl font-bold text-slate-900">{MEN_STAGES.length}</p>
              <p className="text-xs text-slate-500">Etapas MEN</p>
            </div>
          </div>

          {/* Lista por etapa MEN */}
          <div className="space-y-6">
            {MEN_STAGES.map((stage) => {
              const stageGrades = grades.filter(g => g.stage === stage.code)
              const colorClass = stage.color
              return (
                <div key={stage.code} className={`border rounded-lg overflow-hidden ${colorClass.split(' ')[2] || 'border-slate-200'}`}>
                  <div className={`px-4 py-3 ${colorClass} flex items-center justify-between`}>
                    <h3 className="font-semibold">{stage.name}</h3>
                    <span className="text-sm">{stageGrades.length} grado(s)</span>
                  </div>
                  <div className="bg-white divide-y divide-slate-100">
                    {stageGrades.length === 0 ? (
                      <p className="px-4 py-6 text-center text-slate-400 text-sm">No hay grados en esta etapa</p>
                    ) : (
                      stageGrades.sort((a, b) => a.order - b.order).map((grade) => (
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
                            {canEditGrades && (
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
                            )}
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
                                    {canEditGrades && (
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
                                    )}
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
              )
            })}

            {grades.length === 0 && (
              <div className="text-center py-12 text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
                <Building2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="mb-2">No hay grados configurados</p>
                <p className="text-sm mb-4">Agrega los grados de tu institución para organizar los grupos.</p>
                {canEditGrades && (
                  <button
                    onClick={() => openGradeModal()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Agregar Primer Grado
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

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
                  placeholder="Ej: Primero, Segundo, Transición"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Etapa MEN</label>
                <select
                  value={gradeForm.stage}
                  onChange={(e) => setGradeForm({ ...gradeForm, stage: e.target.value as GradeStage })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                >
                  {MEN_STAGES.map(stage => (
                    <option key={stage.code} value={stage.code}>{stage.name}</option>
                  ))}
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
                disabled={!gradeForm.name.trim() || !gradeForm.stage}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50"
              >
                {editingGrade ? 'Guardar Cambios' : 'Crear Grado'}
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
                  placeholder="Ej: A, B, 01, 02"
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
                  <option value="NOCHE">Noche</option>
                  <option value="ÚNICA">Jornada Única</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Capacidad</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={groupForm.capacity}
                  onChange={(e) => setGroupForm({ ...groupForm, capacity: parseInt(e.target.value) || 35 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Director de grupo (opcional)</label>
                <input
                  type="text"
                  value={groupForm.director}
                  onChange={(e) => setGroupForm({ ...groupForm, director: e.target.value })}
                  placeholder="Nombre del docente"
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
                {editingGroup?.group ? 'Guardar Cambios' : 'Crear Grupo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
