import { useState } from 'react'
import { Plus, Edit2, Trash2, X, GraduationCap, Calendar, ChevronDown, ChevronRight, BookOpen } from 'lucide-react'
import { useInstitution, AcademicLevel, GradingScaleType, QualitativeLevel } from '../contexts/InstitutionContext'
import { useAuth } from '../contexts/AuthContext'

const gradingScaleLabels: Record<GradingScaleType, string> = {
  NUMERIC_1_5: 'Numérico 1.0 - 5.0',
  NUMERIC_1_10: 'Numérico 1 - 10',
  NUMERIC_0_100: 'Numérico 0 - 100',
  QUALITATIVE: 'Cualitativo (letras)',
  QUALITATIVE_DESC: 'Cualitativo descriptivo',
}

const defaultQualitativeLevels: QualitativeLevel[] = [
  { id: 'q1', code: 'S', name: 'Superior', description: 'Supera los logros propuestos', color: '#22c55e', order: 0, isApproved: true },
  { id: 'q2', code: 'A', name: 'Alto', description: 'Alcanza satisfactoriamente los logros', color: '#3b82f6', order: 1, isApproved: true },
  { id: 'q3', code: 'B', name: 'Básico', description: 'Alcanza los logros mínimos', color: '#f59e0b', order: 2, isApproved: true },
  { id: 'q4', code: 'J', name: 'Bajo', description: 'No alcanza los logros mínimos', color: '#ef4444', order: 3, isApproved: false },
]

export default function AcademicLevelsAdmin() {
  const { institution, setInstitution } = useInstitution()
  const { user } = useAuth()
  
  const canEdit = user?.roles?.some(r => {
    const roleName = (r.role?.name || '').toLowerCase()
    return roleName.includes('admin') || roleName.includes('rector')
  }) ?? true

  const [showLevelModal, setShowLevelModal] = useState(false)
  const [editingLevel, setEditingLevel] = useState<AcademicLevel | null>(null)
  const [expandedLevels, setExpandedLevels] = useState<Set<string>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)

  const [levelForm, setLevelForm] = useState<{
    name: string
    code: string
    gradingScaleType: GradingScaleType
    minGrade: number
    maxGrade: number
    minPassingGrade: number
    grades: string
    qualitativeLevels: QualitativeLevel[]
  }>({
    name: '',
    code: '',
    gradingScaleType: 'NUMERIC_1_5',
    minGrade: 1.0,
    maxGrade: 5.0,
    minPassingGrade: 3.0,
    grades: '',
    qualitativeLevels: defaultQualitativeLevels,
  })

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedLevels)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedLevels(newExpanded)
  }

  const openLevelModal = (level?: AcademicLevel) => {
    if (level) {
      setEditingLevel(level)
      setLevelForm({
        name: level.name,
        code: level.code,
        gradingScaleType: level.gradingScaleType,
        minGrade: level.minGrade || 1.0,
        maxGrade: level.maxGrade || 5.0,
        minPassingGrade: level.minPassingGrade || 3.0,
        grades: level.grades.join(', '),
        qualitativeLevels: level.qualitativeLevels || defaultQualitativeLevels,
      })
    } else {
      setEditingLevel(null)
      setLevelForm({
        name: '',
        code: '',
        gradingScaleType: 'NUMERIC_1_5',
        minGrade: 1.0,
        maxGrade: 5.0,
        minPassingGrade: 3.0,
        grades: '',
        qualitativeLevels: defaultQualitativeLevels,
      })
    }
    setShowLevelModal(true)
  }

  const saveLevel = () => {
    if (!levelForm.name.trim() || !levelForm.code.trim()) return

    const gradesArray = levelForm.grades.split(',').map(g => g.trim()).filter(g => g)
    
    const newLevel: AcademicLevel = {
      id: editingLevel?.id || `lvl-${Date.now()}`,
      name: levelForm.name,
      code: levelForm.code.toUpperCase(),
      order: editingLevel?.order ?? institution.academicLevels.length,
      gradingScaleType: levelForm.gradingScaleType,
      grades: gradesArray,
      ...(levelForm.gradingScaleType.startsWith('NUMERIC') ? {
        minGrade: levelForm.minGrade,
        maxGrade: levelForm.maxGrade,
        minPassingGrade: levelForm.minPassingGrade,
      } : {
        qualitativeLevels: levelForm.qualitativeLevels,
      }),
    }

    if (editingLevel) {
      setInstitution({
        ...institution,
        academicLevels: institution.academicLevels.map(l =>
          l.id === editingLevel.id ? newLevel : l
        ),
      })
    } else {
      setInstitution({
        ...institution,
        academicLevels: [...institution.academicLevels, newLevel],
      })
    }
    setShowLevelModal(false)
  }

  const deleteLevel = (id: string) => {
    setInstitution({
      ...institution,
      academicLevels: institution.academicLevels.filter(l => l.id !== id),
    })
    setDeleteConfirm(null)
  }

  const updateQualitativeLevel = (index: number, field: keyof QualitativeLevel, value: string | boolean) => {
    const updated = [...levelForm.qualitativeLevels]
    updated[index] = { ...updated[index], [field]: value }
    setLevelForm({ ...levelForm, qualitativeLevels: updated })
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Niveles Académicos</h1>
          <p className="text-slate-500 mt-1">Configura los niveles y su sistema de calificación</p>
        </div>
      </div>

      {/* Calendario Académico */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-blue-600" />
          <h2 className="font-semibold text-slate-900">Calendario Académico</h2>
        </div>
        <div className="flex gap-4">
          <label className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
            institution.academicCalendar === 'A' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
          } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}>
            <input
              type="radio"
              name="calendar"
              disabled={!canEdit}
              checked={institution.academicCalendar === 'A'}
              onChange={() => canEdit && setInstitution({ ...institution, academicCalendar: 'A' })}
            />
            <div>
              <div className="font-medium text-slate-900">Calendario A</div>
              <div className="text-sm text-slate-500">Febrero - Noviembre</div>
            </div>
          </label>
          <label className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
            institution.academicCalendar === 'B' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
          } ${!canEdit ? 'opacity-60 cursor-not-allowed' : ''}`}>
            <input
              type="radio"
              name="calendar"
              disabled={!canEdit}
              checked={institution.academicCalendar === 'B'}
              onChange={() => canEdit && setInstitution({ ...institution, academicCalendar: 'B' })}
            />
            <div>
              <div className="font-medium text-slate-900">Calendario B</div>
              <div className="text-sm text-slate-500">Septiembre - Junio</div>
            </div>
          </label>
        </div>
      </div>

      {/* Lista de Niveles Académicos */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-5 h-5 text-purple-600" />
            <div>
              <h2 className="font-semibold text-slate-900">Niveles Académicos</h2>
              <p className="text-sm text-slate-500">Cada nivel puede tener su propio sistema de calificación</p>
            </div>
          </div>
          {canEdit && (
            <button
              onClick={() => openLevelModal()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nuevo Nivel
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {institution.academicLevels.map((level) => (
            <div key={level.id}>
              <div 
                className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                onClick={() => toggleExpand(level.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedLevels.has(level.id) ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    level.gradingScaleType.startsWith('QUALITATIVE') ? 'bg-amber-100' : 'bg-purple-100'
                  }`}>
                    <BookOpen className={`w-5 h-5 ${
                      level.gradingScaleType.startsWith('QUALITATIVE') ? 'text-amber-600' : 'text-purple-600'
                    }`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{level.name}</span>
                      <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded">{level.code}</span>
                    </div>
                    <div className="text-sm text-slate-500">
                      {gradingScaleLabels[level.gradingScaleType]} • {level.grades.length} grado(s)
                    </div>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openLevelModal(level)}
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ id: level.id, name: level.name })}
                      className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {expandedLevels.has(level.id) && (
                <div className="px-6 pb-4 bg-slate-50">
                  <div className="ml-12 p-4 bg-white rounded-lg border border-slate-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs font-medium text-slate-500 mb-1">Grados incluidos</div>
                        <div className="flex flex-wrap gap-1">
                          {level.grades.map((grade, i) => (
                            <span key={i} className="px-2 py-1 text-sm bg-blue-100 text-blue-700 rounded">
                              {grade}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-500 mb-1">Sistema de calificación</div>
                        {level.gradingScaleType.startsWith('NUMERIC') ? (
                          <div className="text-sm text-slate-700">
                            Escala: {level.minGrade} - {level.maxGrade} | Aprueba: ≥ {level.minPassingGrade}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {level.qualitativeLevels?.map((ql) => (
                              <span 
                                key={ql.id} 
                                className="px-2 py-1 text-xs rounded text-white"
                                style={{ backgroundColor: ql.color }}
                              >
                                {ql.code} - {ql.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {institution.academicLevels.length === 0 && (
            <div className="px-6 py-10 text-center text-slate-500">
              <p className="mb-4">No hay niveles académicos configurados.</p>
              {canEdit && (
                <button
                  onClick={() => openLevelModal()}
                  className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Crear primer nivel
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal de Nivel Académico */}
      {showLevelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingLevel ? 'Editar Nivel Académico' : 'Nuevo Nivel Académico'}
              </h3>
              <button onClick={() => setShowLevelModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del nivel</label>
                  <input
                    type="text"
                    value={levelForm.name}
                    onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })}
                    placeholder="Ej: Preescolar, Básica Primaria..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
                  <input
                    type="text"
                    value={levelForm.code}
                    onChange={(e) => setLevelForm({ ...levelForm, code: e.target.value.toUpperCase() })}
                    placeholder="Ej: PREESCOLAR"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Grados (separados por coma)</label>
                <input
                  type="text"
                  value={levelForm.grades}
                  onChange={(e) => setLevelForm({ ...levelForm, grades: e.target.value })}
                  placeholder="Ej: Transición, 1°, 2°, 3°"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de calificación</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(gradingScaleLabels) as GradingScaleType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLevelForm({ ...levelForm, gradingScaleType: type })}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        levelForm.gradingScaleType === type
                          ? type.startsWith('QUALITATIVE') ? 'border-amber-500 bg-amber-50' : 'border-purple-500 bg-purple-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className={`text-sm font-medium ${
                        levelForm.gradingScaleType === type
                          ? type.startsWith('QUALITATIVE') ? 'text-amber-700' : 'text-purple-700'
                          : 'text-slate-600'
                      }`}>
                        {gradingScaleLabels[type]}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {levelForm.gradingScaleType.startsWith('NUMERIC') && (
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h4 className="text-sm font-medium text-purple-800 mb-3">Configuración de escala numérica</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-purple-600 mb-1">Nota mínima</label>
                      <input
                        type="number"
                        step="0.1"
                        value={levelForm.minGrade}
                        onChange={(e) => setLevelForm({ ...levelForm, minGrade: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-purple-600 mb-1">Nota máxima</label>
                      <input
                        type="number"
                        step="0.1"
                        value={levelForm.maxGrade}
                        onChange={(e) => setLevelForm({ ...levelForm, maxGrade: parseFloat(e.target.value) || 5 })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-purple-600 mb-1">Nota para aprobar</label>
                      <input
                        type="number"
                        step="0.1"
                        value={levelForm.minPassingGrade}
                        onChange={(e) => setLevelForm({ ...levelForm, minPassingGrade: parseFloat(e.target.value) || 3 })}
                        className="w-full px-3 py-2 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {levelForm.gradingScaleType.startsWith('QUALITATIVE') && (
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <h4 className="text-sm font-medium text-amber-800 mb-3">Escala cualitativa</h4>
                  <div className="space-y-2">
                    {levelForm.qualitativeLevels.map((ql, index) => (
                      <div key={ql.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-amber-200">
                        <input
                          type="text"
                          value={ql.code}
                          onChange={(e) => updateQualitativeLevel(index, 'code', e.target.value)}
                          className="w-12 px-2 py-1 text-center border border-slate-300 rounded"
                          placeholder="Código"
                        />
                        <input
                          type="text"
                          value={ql.name}
                          onChange={(e) => updateQualitativeLevel(index, 'name', e.target.value)}
                          className="flex-1 px-2 py-1 border border-slate-300 rounded"
                          placeholder="Nombre"
                        />
                        <input
                          type="color"
                          value={ql.color}
                          onChange={(e) => updateQualitativeLevel(index, 'color', e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer"
                        />
                        <label className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={ql.isApproved}
                            onChange={(e) => updateQualitativeLevel(index, 'isApproved', e.target.checked)}
                          />
                          Aprueba
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button
                onClick={() => setShowLevelModal(false)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveLevel}
                disabled={!levelForm.name.trim() || !levelForm.code.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingLevel ? 'Guardar cambios' : 'Crear nivel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Eliminar nivel académico</h3>
            <p className="text-slate-600 mb-4">
              ¿Estás seguro de eliminar el nivel <strong>{deleteConfirm.name}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteLevel(deleteConfirm.id)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
