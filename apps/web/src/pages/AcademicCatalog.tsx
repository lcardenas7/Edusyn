import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, X, ChevronDown, ChevronRight, BookOpen, Layers, Save, Loader2, AlertTriangle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { areasApi } from '../lib/api'

interface Subject {
  id: string
  name: string
  code: string | null
  description: string | null
  subjectType: string
  order: number
  isActive: boolean
}

interface Area {
  id: string
  name: string
  code: string | null
  description: string | null
  order: number
  isActive: boolean
  subjects: Subject[]
  _count?: { subjects: number; templateAreas: number }
}

const subjectTypeLabels: Record<string, { label: string; color: string }> = {
  MANDATORY: { label: 'Obligatoria', color: 'blue' },
  ELECTIVE: { label: 'Electiva', color: 'green' },
  OPTIONAL: { label: 'Opcional', color: 'yellow' },
  TECHNICAL: { label: 'Técnica', color: 'purple' },
}

export default function AcademicCatalog() {
  const { institution } = useAuth()
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set())
  
  // Modales
  const [showAreaModal, setShowAreaModal] = useState(false)
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [editingArea, setEditingArea] = useState<Area | null>(null)
  const [editingSubject, setEditingSubject] = useState<{ areaId: string; subject: Subject | null } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'area' | 'subject'; id: string; name: string } | null>(null)

  // Formularios
  const [areaForm, setAreaForm] = useState({ name: '', code: '', description: '' })
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', description: '', subjectType: 'MANDATORY' })

  const loadAreas = useCallback(async () => {
    if (!institution?.id) return
    setLoading(true)
    try {
      const response = await areasApi.getAll(institution.id)
      setAreas(response.data || [])
    } catch (error) {
      console.error('Error loading areas:', error)
    } finally {
      setLoading(false)
    }
  }, [institution?.id])

  useEffect(() => {
    loadAreas()
  }, [loadAreas])

  const toggleExpand = (areaId: string) => {
    const newExpanded = new Set(expandedAreas)
    if (newExpanded.has(areaId)) {
      newExpanded.delete(areaId)
    } else {
      newExpanded.add(areaId)
    }
    setExpandedAreas(newExpanded)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ÁREAS
  // ═══════════════════════════════════════════════════════════════════════════

  const openAreaModal = (area?: Area) => {
    if (area) {
      setEditingArea(area)
      setAreaForm({ name: area.name, code: area.code || '', description: area.description || '' })
    } else {
      setEditingArea(null)
      setAreaForm({ name: '', code: '', description: '' })
    }
    setShowAreaModal(true)
  }

  const saveArea = async () => {
    if (!institution?.id || !areaForm.name.trim()) return
    setSaving(true)
    try {
      if (editingArea) {
        await areasApi.update(editingArea.id, {
          name: areaForm.name,
          code: areaForm.code || undefined,
          description: areaForm.description || undefined,
        })
      } else {
        await areasApi.create({
          institutionId: institution.id,
          name: areaForm.name,
          code: areaForm.code || undefined,
          description: areaForm.description || undefined,
        })
      }
      await loadAreas()
      setShowAreaModal(false)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al guardar área')
    } finally {
      setSaving(false)
    }
  }

  const deleteArea = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'area') return
    setSaving(true)
    try {
      await areasApi.delete(deleteConfirm.id)
      await loadAreas()
      setDeleteConfirm(null)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al eliminar área')
    } finally {
      setSaving(false)
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ASIGNATURAS
  // ═══════════════════════════════════════════════════════════════════════════

  const openSubjectModal = (areaId: string, subject?: Subject) => {
    if (subject) {
      setEditingSubject({ areaId, subject })
      setSubjectForm({
        name: subject.name,
        code: subject.code || '',
        description: subject.description || '',
        subjectType: subject.subjectType,
      })
    } else {
      setEditingSubject({ areaId, subject: null })
      setSubjectForm({ name: '', code: '', description: '', subjectType: 'MANDATORY' })
    }
    setShowSubjectModal(true)
  }

  const saveSubject = async () => {
    if (!editingSubject || !subjectForm.name.trim()) return
    setSaving(true)
    try {
      if (editingSubject.subject) {
        await areasApi.updateSubject(editingSubject.subject.id, {
          name: subjectForm.name,
          code: subjectForm.code || undefined,
          description: subjectForm.description || undefined,
          subjectType: subjectForm.subjectType,
        })
      } else {
        await areasApi.addSubject(editingSubject.areaId, {
          name: subjectForm.name,
          code: subjectForm.code || undefined,
          description: subjectForm.description || undefined,
          subjectType: subjectForm.subjectType,
        })
      }
      await loadAreas()
      setShowSubjectModal(false)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al guardar asignatura')
    } finally {
      setSaving(false)
    }
  }

  const deleteSubject = async () => {
    if (!deleteConfirm || deleteConfirm.type !== 'subject') return
    setSaving(true)
    try {
      await areasApi.deleteSubject(deleteConfirm.id)
      await loadAreas()
      setDeleteConfirm(null)
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al eliminar asignatura')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo Académico</h1>
          <p className="text-gray-600 mt-1">
            Define las áreas y asignaturas disponibles en tu institución
          </p>
        </div>
        <button
          onClick={() => openAreaModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Área
        </button>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <BookOpen className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900">¿Cómo funciona?</h3>
            <p className="text-sm text-blue-700 mt-1">
              El catálogo académico es la base de tu estructura. Aquí defines <strong>qué áreas y asignaturas existen</strong> en tu institución.
              Luego, en las <strong>Plantillas Académicas</strong>, decides cuáles aplican a cada nivel o grado.
            </p>
          </div>
        </div>
      </div>

      {/* Lista de Áreas */}
      <div className="space-y-3">
        {areas.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Layers className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No hay áreas creadas</h3>
            <p className="text-gray-500 mt-1">Comienza creando tu primera área académica</p>
            <button
              onClick={() => openAreaModal()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Crear primera área
            </button>
          </div>
        ) : (
          areas.map((area) => (
            <div key={area.id} className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              {/* Cabecera del Área */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                onClick={() => toggleExpand(area.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedAreas.has(area.id) ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{area.name}</h3>
                      {area.code && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          {area.code}
                        </span>
                      )}
                      {!area.isActive && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                          Inactiva
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {area.subjects.length} asignatura{area.subjects.length !== 1 ? 's' : ''}
                      {area._count?.templateAreas ? ` • En ${area._count.templateAreas} plantilla${area._count.templateAreas !== 1 ? 's' : ''}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => openSubjectModal(area.id)}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                    title="Agregar asignatura"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openAreaModal(area)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    title="Editar área"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ type: 'area', id: area.id, name: area.name })}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Eliminar área"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Lista de Asignaturas */}
              {expandedAreas.has(area.id) && (
                <div className="border-t border-gray-100 bg-gray-50">
                  {area.subjects.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      <p>No hay asignaturas en esta área</p>
                      <button
                        onClick={() => openSubjectModal(area.id)}
                        className="mt-2 text-blue-600 hover:underline text-sm"
                      >
                        + Agregar asignatura
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {area.subjects.map((subject) => (
                        <div
                          key={subject.id}
                          className="flex items-center justify-between px-4 py-3 pl-12 hover:bg-gray-100"
                        >
                          <div className="flex items-center gap-3">
                            <BookOpen className="w-4 h-4 text-gray-400" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-800">{subject.name}</span>
                                {subject.code && (
                                  <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                                    {subject.code}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-xs px-2 py-0.5 rounded bg-${subjectTypeLabels[subject.subjectType]?.color || 'gray'}-100 text-${subjectTypeLabels[subject.subjectType]?.color || 'gray'}-700`}>
                                  {subjectTypeLabels[subject.subjectType]?.label || subject.subjectType}
                                </span>
                                {!subject.isActive && (
                                  <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                                    Inactiva
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openSubjectModal(area.id, subject)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ type: 'subject', id: subject.id, name: subject.name })}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal de Área */}
      {showAreaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingArea ? 'Editar Área' : 'Nueva Área'}
              </h2>
              <button onClick={() => setShowAreaModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Área *
                </label>
                <input
                  type="text"
                  value={areaForm.name}
                  onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: Matemáticas"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código (opcional)
                </label>
                <input
                  type="text"
                  value={areaForm.code}
                  onChange={(e) => setAreaForm({ ...areaForm, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: MAT"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  value={areaForm.description}
                  onChange={(e) => setAreaForm({ ...areaForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Descripción breve del área"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowAreaModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={saveArea}
                disabled={saving || !areaForm.name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Asignatura */}
      {showSubjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingSubject?.subject ? 'Editar Asignatura' : 'Nueva Asignatura'}
              </h2>
              <button onClick={() => setShowSubjectModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la Asignatura *
                </label>
                <input
                  type="text"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: Geometría"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código (opcional)
                </label>
                <input
                  type="text"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Ej: GEO"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Asignatura
                </label>
                <select
                  value={subjectForm.subjectType}
                  onChange={(e) => setSubjectForm({ ...subjectForm, subjectType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="MANDATORY">Obligatoria</option>
                  <option value="ELECTIVE">Electiva</option>
                  <option value="OPTIONAL">Opcional</option>
                  <option value="TECHNICAL">Técnica</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción (opcional)
                </label>
                <textarea
                  value={subjectForm.description}
                  onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Descripción breve"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
              <button
                onClick={() => setShowSubjectModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={saveSubject}
                disabled={saving || !subjectForm.name.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                ¿Eliminar {deleteConfirm.type === 'area' ? 'área' : 'asignatura'}?
              </h3>
              <p className="text-gray-600 mb-6">
                Estás por eliminar <strong>"{deleteConfirm.name}"</strong>. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={deleteConfirm.type === 'area' ? deleteArea : deleteSubject}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
