import { useState } from 'react'
import { Plus, Edit2, Trash2, X, ChevronDown, ChevronRight, BookOpen, Settings } from 'lucide-react'

interface Subject {
  id: string
  name: string
  weeklyHours: number
  weight: number
  order: number
}

interface Area {
  id: string
  name: string
  isMandatory: boolean
  calculationType: 'SINGLE_SUBJECT' | 'AVERAGE' | 'WEIGHTED_AVERAGE' | 'CUSTOM_FORMULA'
  customFormula?: string
  order: number
  subjects: Subject[]
}

const calculationTypeLabels = {
  SINGLE_SUBJECT: 'Asignatura única',
  AVERAGE: 'Promedio simple',
  WEIGHTED_AVERAGE: 'Promedio ponderado',
  CUSTOM_FORMULA: 'Fórmula personalizada',
}

const mockAreas: Area[] = [
  {
    id: '1',
    name: 'Matemáticas',
    isMandatory: true,
    calculationType: 'SINGLE_SUBJECT',
    order: 1,
    subjects: [
      { id: 's1', name: 'Matemáticas', weeklyHours: 5, weight: 1, order: 1 },
    ],
  },
  {
    id: '2',
    name: 'Humanidades',
    isMandatory: true,
    calculationType: 'AVERAGE',
    order: 2,
    subjects: [
      { id: 's2', name: 'Lengua Castellana', weeklyHours: 4, weight: 1, order: 1 },
      { id: 's3', name: 'Inglés', weeklyHours: 3, weight: 1, order: 2 },
    ],
  },
  {
    id: '3',
    name: 'Ciencias Naturales',
    isMandatory: true,
    calculationType: 'WEIGHTED_AVERAGE',
    order: 3,
    subjects: [
      { id: 's4', name: 'Biología', weeklyHours: 3, weight: 1.5, order: 1 },
      { id: 's5', name: 'Química', weeklyHours: 3, weight: 1.5, order: 2 },
      { id: 's6', name: 'Física', weeklyHours: 2, weight: 1, order: 3 },
    ],
  },
]

export default function AreasAdmin() {
  const [areas, setAreas] = useState<Area[]>(mockAreas)
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set(['1', '2', '3']))
  const [showAreaModal, setShowAreaModal] = useState(false)
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [editingArea, setEditingArea] = useState<Area | null>(null)
  const [editingSubject, setEditingSubject] = useState<{ areaId: string; subject: Subject | null }>({ areaId: '', subject: null })
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'area' | 'subject'; id: string; name: string } | null>(null)

  const [areaForm, setAreaForm] = useState({
    name: '',
    isMandatory: true,
    calculationType: 'AVERAGE' as Area['calculationType'],
    customFormula: '',
  })

  const [subjectForm, setSubjectForm] = useState({
    name: '',
    weeklyHours: 0,
    weight: 1,
  })

  const toggleExpand = (areaId: string) => {
    const newExpanded = new Set(expandedAreas)
    if (newExpanded.has(areaId)) {
      newExpanded.delete(areaId)
    } else {
      newExpanded.add(areaId)
    }
    setExpandedAreas(newExpanded)
  }

  const openAreaModal = (area?: Area) => {
    if (area) {
      setEditingArea(area)
      setAreaForm({
        name: area.name,
        isMandatory: area.isMandatory,
        calculationType: area.calculationType,
        customFormula: area.customFormula || '',
      })
    } else {
      setEditingArea(null)
      setAreaForm({ name: '', isMandatory: true, calculationType: 'AVERAGE', customFormula: '' })
    }
    setShowAreaModal(true)
  }

  const openSubjectModal = (areaId: string, subject?: Subject) => {
    setEditingSubject({ areaId, subject: subject || null })
    if (subject) {
      setSubjectForm({ name: subject.name, weeklyHours: subject.weeklyHours, weight: subject.weight })
    } else {
      setSubjectForm({ name: '', weeklyHours: 0, weight: 1 })
    }
    setShowSubjectModal(true)
  }

  const saveArea = () => {
    if (!areaForm.name.trim()) return

    if (editingArea) {
      setAreas(areas.map(a => 
        a.id === editingArea.id 
          ? { ...a, ...areaForm }
          : a
      ))
    } else {
      const newArea: Area = {
        id: `area-${Date.now()}`,
        name: areaForm.name,
        isMandatory: areaForm.isMandatory,
        calculationType: areaForm.calculationType,
        customFormula: areaForm.customFormula,
        order: areas.length + 1,
        subjects: [],
      }
      setAreas([...areas, newArea])
    }
    setShowAreaModal(false)
  }

  const saveSubject = () => {
    if (!subjectForm.name.trim()) return

    setAreas(areas.map(area => {
      if (area.id !== editingSubject.areaId) return area

      if (editingSubject.subject) {
        return {
          ...area,
          subjects: area.subjects.map(s =>
            s.id === editingSubject.subject!.id
              ? { ...s, ...subjectForm }
              : s
          ),
        }
      } else {
        const newSubject: Subject = {
          id: `subj-${Date.now()}`,
          name: subjectForm.name,
          weeklyHours: subjectForm.weeklyHours,
          weight: subjectForm.weight,
          order: area.subjects.length + 1,
        }
        return { ...area, subjects: [...area.subjects, newSubject] }
      }
    }))
    setShowSubjectModal(false)
  }

  const confirmDelete = () => {
    if (!deleteConfirm) return

    if (deleteConfirm.type === 'area') {
      setAreas(areas.filter(a => a.id !== deleteConfirm.id))
    } else {
      setAreas(areas.map(area => ({
        ...area,
        subjects: area.subjects.filter(s => s.id !== deleteConfirm.id),
      })))
    }
    setDeleteConfirm(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Áreas y Asignaturas</h1>
          <p className="text-slate-500 mt-1">Configuración de áreas académicas y sus asignaturas</p>
        </div>
        <button
          onClick={() => openAreaModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Área
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-slate-900">Estructura Académica</h2>
              <p className="text-sm text-slate-500">Las notas se registran por asignatura, pero la promoción se determina por área</p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {areas.map((area) => (
            <div key={area.id}>
              <div 
                className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                onClick={() => toggleExpand(area.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedAreas.has(area.id) ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{area.name}</span>
                      {area.isMandatory && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded">
                          Obligatoria
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span>{area.subjects.length} asignatura{area.subjects.length !== 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span>{calculationTypeLabels[area.calculationType]}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openAreaModal(area)}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600"
                    title="Editar área"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ type: 'area', id: area.id, name: area.name })}
                    className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-600"
                    title="Eliminar área"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expandedAreas.has(area.id) && (
                <div className="bg-slate-50 px-6 py-3 border-t border-slate-100">
                  <div className="ml-8 space-y-2">
                    {area.subjects.map((subject) => (
                      <div
                        key={subject.id}
                        className="flex items-center justify-between bg-white px-4 py-3 rounded-lg border border-slate-200"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          <div>
                            <span className="font-medium text-slate-800">{subject.name}</span>
                            <div className="text-xs text-slate-500">
                              {subject.weeklyHours}h/semana
                              {area.calculationType === 'WEIGHTED_AVERAGE' && (
                                <span className="ml-2">• Peso: {subject.weight}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openSubjectModal(area.id, subject)}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ type: 'subject', id: subject.id, name: subject.name })}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => openSubjectModal(area.id)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors w-full"
                    >
                      <Plus className="w-4 h-4" />
                      Agregar asignatura
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {areas.length === 0 && (
            <div className="px-6 py-12 text-center text-slate-500">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No hay áreas configuradas</p>
              <button
                onClick={() => openAreaModal()}
                className="mt-3 text-blue-600 hover:underline"
              >
                Crear primera área
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Área */}
      {showAreaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingArea ? 'Editar Área' : 'Nueva Área'}
              </h3>
              <button onClick={() => setShowAreaModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del área</label>
                <input
                  type="text"
                  value={areaForm.name}
                  onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
                  placeholder="Ej: Matemáticas, Ciencias Naturales..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isMandatory"
                  checked={areaForm.isMandatory}
                  onChange={(e) => setAreaForm({ ...areaForm, isMandatory: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <label htmlFor="isMandatory" className="text-sm text-slate-700">
                  Área obligatoria para promoción
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de cálculo</label>
                <select
                  value={areaForm.calculationType}
                  onChange={(e) => setAreaForm({ ...areaForm, calculationType: e.target.value as Area['calculationType'] })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value="SINGLE_SUBJECT">Asignatura única (el área tiene solo una asignatura)</option>
                  <option value="AVERAGE">Promedio simple (todas las asignaturas pesan igual)</option>
                  <option value="WEIGHTED_AVERAGE">Promedio ponderado (cada asignatura tiene un peso)</option>
                  <option value="CUSTOM_FORMULA">Fórmula personalizada</option>
                </select>
              </div>

              {areaForm.calculationType === 'CUSTOM_FORMULA' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Fórmula</label>
                  <input
                    type="text"
                    value={areaForm.customFormula}
                    onChange={(e) => setAreaForm({ ...areaForm, customFormula: e.target.value })}
                    placeholder="Ej: (A1*0.6 + A2*0.4)"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                  <p className="text-xs text-slate-500 mt-1">Use A1, A2, A3... para referirse a las asignaturas en orden</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAreaModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveArea}
                disabled={!areaForm.name.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {editingArea ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Asignatura */}
      {showSubjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingSubject.subject ? 'Editar Asignatura' : 'Nueva Asignatura'}
              </h3>
              <button onClick={() => setShowSubjectModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la asignatura</label>
                <input
                  type="text"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  placeholder="Ej: Álgebra, Biología..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Horas semanales</label>
                <input
                  type="number"
                  min="0"
                  value={subjectForm.weeklyHours}
                  onChange={(e) => setSubjectForm({ ...subjectForm, weeklyHours: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Peso (para promedio ponderado)</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={subjectForm.weight}
                  onChange={(e) => setSubjectForm({ ...subjectForm, weight: parseFloat(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">Solo aplica si el área usa promedio ponderado</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSubjectModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={saveSubject}
                disabled={!subjectForm.name.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {editingSubject.subject ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmación Eliminar */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 text-center mb-2">
              ¿Eliminar {deleteConfirm.type === 'area' ? 'área' : 'asignatura'}?
            </h3>
            <p className="text-sm text-slate-500 text-center mb-4">
              Estás a punto de eliminar <strong>"{deleteConfirm.name}"</strong>.
              {deleteConfirm.type === 'area' && (
                <span className="text-red-600 font-medium"> Todas las asignaturas asociadas también se eliminarán.</span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
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
