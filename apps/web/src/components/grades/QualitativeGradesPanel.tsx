import React, { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { DiagnosisBadge } from '../StudentBadges'
import type { QualitativeLevel } from '../../contexts/AcademicContext'

interface StudentRow {
  id: string
  name: string
  enrollmentId: string
  hasDiagnosis?: boolean
  diagnosisType?: string
}

interface AchievementRow {
  id: string
  code: string
  orderNumber: number
  baseDescription: string
  achievementType?: string
  levelDescriptors?: Array<{ levelCode: string; text: string }>
  studentAchievements?: Array<{
    id: string
    studentEnrollmentId: string
    performanceLevel: string
    suggestedText?: string
    approvedText?: string
    isTextApproved: boolean
    observation?: string
  }>
}

interface QualitativeGradeValue {
  levelCode: string
  observation: string
}

type DescriptorInput = Array<{ levelCode: string; text: string }>

interface Props {
  students: StudentRow[]
  loadingStudents: boolean
  currentPeriodOpen: boolean
  achievements: AchievementRow[]
  descriptorMode?: 'FREE' | 'DESCRIPTOR_PER_LEVEL'
  catalogLocked?: boolean
  /** Etiqueta del "indicador" (p. ej. "Imprescindible" en modo por-evidencia). Default: "indicador". */
  indicatorLabel?: string
  selectedAchievementId: string | null
  onSelectAchievement: (achievementId: string) => void
  qualitativeLevels: QualitativeLevel[]
  gradesByAchievement: Record<string, Record<string, QualitativeGradeValue>>
  onUpdateGrade: (achievementId: string, studentId: string, patch: Partial<QualitativeGradeValue>) => void
  onCreateAchievement: (description: string, levelDescriptors?: DescriptorInput) => Promise<void>
  onEditAchievement: (achievementId: string, description: string, levelDescriptors?: DescriptorInput) => Promise<void>
  onDeleteAchievement: (achievementId: string) => Promise<void>
}

const MIN_NAME_LENGTH = 5

export default function QualitativeGradesPanel({
  students,
  loadingStudents,
  currentPeriodOpen,
  achievements,
  descriptorMode = 'FREE',
  catalogLocked = false,
  indicatorLabel = 'indicador',
  selectedAchievementId,
  onSelectAchievement,
  qualitativeLevels,
  gradesByAchievement,
  onUpdateGrade,
  onCreateAchievement,
  onEditAchievement,
  onDeleteAchievement,
}: Props) {
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)

  // Modal de creación/edición de indicador
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAchievement, setEditingAchievement] = useState<AchievementRow | null>(null)
  const [modalName, setModalName] = useState('')
  const [modalDescriptors, setModalDescriptors] = useState<Record<string, string>>({})
  const [modalSaving, setModalSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  // Confirmación de borrado (dos pasos, inline en la tarjeta)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const perLevel = descriptorMode === 'DESCRIPTOR_PER_LEVEL'

  const sortedLevels = useMemo(
    () => [...qualitativeLevels].sort((a, b) => a.order - b.order),
    [qualitativeLevels],
  )

  const activeAchievement = useMemo(
    () => achievements.find(a => a.id === selectedAchievementId) || null,
    [achievements, selectedAchievementId],
  )

  const activeGrades = selectedAchievementId ? (gradesByAchievement[selectedAchievementId] || {}) : {}

  const descriptorByLevel = useMemo(() => {
    const map = new Map<string, string>()
    ;(activeAchievement?.levelDescriptors || []).forEach((d) => {
      if (d.text?.trim()) map.set(d.levelCode, d.text.trim())
    })
    return map
  }, [activeAchievement])

  // Un indicador está "listo para calificar" cuando (en modo descriptor) tiene
  // descriptor redactado para TODOS los niveles de la escala.
  const descriptorsComplete = (achievement: AchievementRow | null): boolean => {
    if (!perLevel || !achievement) return true
    const map = new Map<string, string>()
    ;(achievement.levelDescriptors || []).forEach((d) => {
      if (d.text?.trim()) map.set(d.levelCode, d.text.trim())
    })
    return sortedLevels.length > 0 && sortedLevels.every((lvl) => !!map.get(lvl.code))
  }

  const gradingBlocked = perLevel && !!activeAchievement && !descriptorsComplete(activeAchievement)
  // Las celdas de nivel se deshabilitan cuando: período cerrado, no hay indicador
  // activo, o el indicador activo no tiene descriptores completos. La lista de
  // estudiantes SIEMPRE se muestra para que el docente vea el grupo.
  const cellsDisabled = !currentPeriodOpen || !selectedAchievementId || gradingBlocked

  const levelIndexByCode = useMemo(() => {
    const map = new Map<string, number>()
    sortedLevels.forEach((level, index) => map.set(level.code, index))
    return map
  }, [sortedLevels])

  const selectedLevelCount = useMemo(() => {
    return students.filter((student) => !!activeGrades[student.id]?.levelCode).length
  }, [activeGrades, students])

  const consolidatedByStudent = useMemo(() => {
    const result: Record<string, QualitativeLevel | null> = {}

    students.forEach((student) => {
      const indices: number[] = []
      achievements.forEach((achievement) => {
        const entry = gradesByAchievement[achievement.id]?.[student.id]
        if (!entry?.levelCode) return
        const index = levelIndexByCode.get(entry.levelCode)
        if (typeof index === 'number') {
          indices.push(index)
        }
      })

      if (indices.length === 0 || sortedLevels.length === 0) {
        result[student.id] = null
        return
      }

      const averageIndex = Math.round(indices.reduce((acc, value) => acc + value, 0) / indices.length)
      result[student.id] = sortedLevels[Math.min(sortedLevels.length - 1, Math.max(0, averageIndex))] || null
    })

    return result
  }, [achievements, gradesByAchievement, levelIndexByCode, sortedLevels, students])

  const overallCompletion = useMemo(() => {
    if (achievements.length === 0 || students.length === 0) return 0
    const totalSlots = achievements.length * students.length
    const filledSlots = students.reduce((acc, student) => {
      return acc + achievements.filter((achievement) => !!gradesByAchievement[achievement.id]?.[student.id]?.levelCode).length
    }, 0)
    return Math.round((filledSlots / totalSlots) * 100)
  }, [achievements, gradesByAchievement, students])

  const gridTemplateColumns = `48px minmax(200px, 1fr) repeat(${sortedLevels.length}, minmax(84px, 110px)) 48px`

  const openCreateModal = () => {
    setEditingAchievement(null)
    setModalName('')
    setModalDescriptors({})
    setModalError('')
    setModalOpen(true)
  }

  const openEditModal = (achievement: AchievementRow) => {
    setEditingAchievement(achievement)
    setModalName(achievement.baseDescription)
    const draft: Record<string, string> = {}
    ;(achievement.levelDescriptors || []).forEach((d) => {
      draft[d.levelCode] = d.text
    })
    setModalDescriptors(draft)
    setModalError('')
    setModalOpen(true)
  }

  const handleModalSave = async () => {
    const description = modalName.trim()
    if (description.length < MIN_NAME_LENGTH) {
      setModalError(`El nombre del indicador debe tener al menos ${MIN_NAME_LENGTH} caracteres.`)
      return
    }
    let descriptors: DescriptorInput | undefined
    if (perLevel) {
      const missing = sortedLevels.filter((lvl) => !(modalDescriptors[lvl.code] || '').trim())
      if (missing.length > 0) {
        setModalError(`Faltan descriptores para: ${missing.map((l) => l.name).join(', ')}. Son obligatorios para poder calificar.`)
        return
      }
      descriptors = sortedLevels.map((lvl) => ({ levelCode: lvl.code, text: modalDescriptors[lvl.code].trim() }))
    }
    setModalSaving(true)
    setModalError('')
    try {
      if (editingAchievement) {
        await onEditAchievement(editingAchievement.id, description, descriptors)
      } else {
        await onCreateAchievement(description, descriptors)
      }
      setModalOpen(false)
    } catch {
      setModalError('No se pudo guardar el indicador. Intenta de nuevo.')
    } finally {
      setModalSaving(false)
    }
  }

  const handleDelete = async (achievement: AchievementRow) => {
    setDeletingId(achievement.id)
    try {
      await onDeleteAchievement(achievement.id)
      setDeleteConfirmId(null)
    } finally {
      setDeletingId(null)
    }
  }

  const getGradeRow = (studentId: string) => {
    if (!selectedAchievementId) return { levelCode: '', observation: '' }
    return activeGrades[studentId] || { levelCode: '', observation: '' }
  }

  return (
    <div className="space-y-3">
      {/* Barra compacta: título + indicadores + acción principal.
          La protagonista es la grilla de estudiantes, no la configuración. */}
      <div className="bg-white rounded-xl border border-amber-200 shadow-sm px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <Sparkles className="w-4 h-4 text-amber-600" />
          {indicatorLabel === 'indicador' ? 'Indicadores' : `${indicatorLabel}s`}
        </span>

        <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-[200px]">
          {achievements.length === 0 ? (
            <span className="text-xs text-slate-500">
              Ninguno creado todavía{perLevel ? ' — cada indicador lleva sus descriptores por nivel' : ''}.
            </span>
          ) : (
            achievements.map((achievement) => {
              const active = achievement.id === selectedAchievementId
              const completed = students.filter((student) => !!gradesByAchievement[achievement.id]?.[student.id]?.levelCode).length
              const incomplete = perLevel && !descriptorsComplete(achievement)
              const confirmingDelete = deleteConfirmId === achievement.id
              return (
                <div
                  key={achievement.id}
                  className={`inline-flex items-center gap-1 rounded-lg border pl-2.5 pr-1 py-1 transition-all ${
                    active ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-slate-200 bg-white hover:border-amber-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectAchievement(achievement.id)}
                    className="text-left min-w-0"
                    title={achievement.baseDescription}
                  >
                    <span className="block text-[9px] font-mono text-amber-700 leading-none">{achievement.code}</span>
                    <span className="block text-xs font-medium text-slate-900 leading-tight max-w-[220px] truncate">
                      {achievement.baseDescription}
                    </span>
                  </button>
                  {incomplete && (
                    <span title="Faltan descriptores por nivel">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    </span>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${active ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    {completed}/{students.length}
                  </span>
                  {confirmingDelete ? (
                    <span className="inline-flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleDelete(achievement)}
                        disabled={deletingId === achievement.id}
                        className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        title={completed > 0 ? `Se eliminarán ${completed} valoraciones` : 'Confirmar eliminación'}
                      >
                        {deletingId === achievement.id ? '…' : `Sí, borrar${completed > 0 ? ` (${completed} valoraciones)` : ''}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="text-[10px] px-1.5 py-0.5 rounded border border-slate-300 text-slate-600 hover:bg-slate-100"
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <span className="inline-flex items-center flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(achievement)}
                        disabled={!currentPeriodOpen || catalogLocked}
                        className="p-1 rounded text-slate-400 hover:text-amber-700 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Editar nombre y descriptores"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(achievement.id)}
                        disabled={!currentPeriodOpen || catalogLocked}
                        className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Eliminar indicador"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>

        <span className="text-[11px] text-slate-500 whitespace-nowrap">
          {selectedLevelCount}/{students.length} valorados · cobertura {overallCompletion}%
        </span>
        <button
          type="button"
          onClick={openCreateModal}
          disabled={!currentPeriodOpen || catalogLocked}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Nuevo indicador
        </button>
      </div>

      {!currentPeriodOpen && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          El período está cerrado para calificaciones. Un administrador debe habilitarlo en
          «Ventanas de Calificación» para poder crear indicadores y valorar estudiantes.
        </p>
      )}
      {catalogLocked && (
        <p className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-2 py-1.5">
          El catálogo de Transición está fijado por administración. Aquí solo se registran valoraciones.
        </p>
      )}

      <div id="qualitative-grid" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          className="grid items-stretch bg-amber-50 border-b border-amber-100 text-xs font-semibold uppercase text-slate-500"
          style={{ gridTemplateColumns }}
        >
          <div className="px-2 py-3 text-center self-center">N°</div>
          <div className="px-4 py-3 self-center">Estudiante</div>
          {sortedLevels.map((level) => (
            <div key={level.id} className="px-2 py-2 text-center border-b-4 self-center" style={{ borderColor: level.color }}>
              <span className="block text-sm font-bold" style={{ color: level.color }}>{level.code}</span>
              <span className="block text-[10px] normal-case font-medium text-slate-500 leading-tight">{level.name}</span>
            </div>
          ))}
          <div className="px-2 py-3 text-center self-center">Obs</div>
        </div>

        {/* Aviso de configuración pendiente: la lista sigue visible, las celdas deshabilitadas */}
        {currentPeriodOpen && !loadingStudents && students.length > 0 && (!selectedAchievementId || gradingBlocked) && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-amber-800 inline-flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              {!selectedAchievementId
                ? 'La valoración está deshabilitada: crea un indicador con «Nuevo indicador» (con sus descriptores) o selecciona uno existente.'
                : 'La valoración está deshabilitada: este indicador no tiene sus descriptores por nivel completos.'}
            </span>
            {gradingBlocked && activeAchievement && (
              <button
                type="button"
                onClick={() => openEditModal(activeAchievement)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded bg-amber-600 text-white hover:bg-amber-700"
              >
                <Pencil className="w-3 h-3" />
                Completar descriptores
              </button>
            )}
          </div>
        )}

        {loadingStudents ? (
          <div className="px-6 py-8 text-center text-slate-500">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-600" />
              Cargando estudiantes...
            </div>
          </div>
        ) : students.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-500">
            No hay estudiantes matriculados en este grupo
          </div>
        ) : (
          students.map((student, idx) => {
            const row = getGradeRow(student.id)
            const consolidatedLevel = consolidatedByStudent[student.id]
            const expanded = expandedStudentId === student.id
            const activeDescriptor = perLevel && row.levelCode ? descriptorByLevel.get(row.levelCode) : undefined

            return (
              <div key={student.id} className="border-b border-slate-100 last:border-b-0">
                <div className="grid items-stretch hover:bg-slate-50 transition-colors" style={{ gridTemplateColumns }}>
                  <div className="px-2 py-2 text-center text-sm font-medium text-slate-500 self-center">{idx + 1}</div>
                  <div className="px-4 py-2 self-center min-w-0">
                    <div className="font-medium text-slate-900 text-sm truncate">{student.name}<DiagnosisBadge student={student} /></div>
                    <div className="text-[11px] text-slate-500">
                      Consolidado: {consolidatedLevel ? consolidatedLevel.name : 'Sin valor'}
                    </div>
                  </div>
                  {sortedLevels.map((level) => {
                    const active = !!selectedAchievementId && row.levelCode === level.code
                    return (
                      <div key={level.id} className="p-1 self-center">
                        <button
                          type="button"
                          disabled={cellsDisabled}
                          onClick={() => {
                            if (cellsDisabled || !selectedAchievementId) return
                            if (active) {
                              // Clic de nuevo sobre el nivel activo: quita la valoración
                              onUpdateGrade(selectedAchievementId, student.id, { levelCode: '' })
                              return
                            }
                            onUpdateGrade(selectedAchievementId, student.id, { levelCode: level.code })
                          }}
                          title={
                            cellsDisabled
                              ? 'Configura el indicador (con sus descriptores) para habilitar la valoración'
                              : active
                                ? `${level.name} · clic para quitar`
                                : (level.description || level.name)
                          }
                          className={`w-full h-9 rounded-md text-xs font-bold transition-all disabled:cursor-not-allowed ${
                            active
                              ? 'text-white shadow-sm'
                              : cellsDisabled
                                ? 'border border-slate-100 bg-slate-50 text-slate-300'
                                : 'border border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:border-slate-300'
                          }`}
                          style={active ? { backgroundColor: level.color } : undefined}
                        >
                          {level.code}
                        </button>
                      </div>
                    )
                  })}
                  <div className="p-1 self-center text-center">
                    <button
                      type="button"
                      onClick={() => selectedAchievementId && setExpandedStudentId(expanded ? null : student.id)}
                      disabled={!selectedAchievementId}
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        expanded || row.observation?.trim()
                          ? 'border-amber-300 text-amber-700 bg-amber-50'
                          : 'border-slate-200 text-slate-400 hover:text-slate-600'
                      }`}
                      title="Observación del docente"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>
                {expanded && selectedAchievementId && (
                  <div className="px-4 pb-3 pt-2 bg-slate-50 border-t border-slate-100 space-y-2">
                    {activeDescriptor && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1.5 leading-tight">
                        <span className="font-semibold uppercase tracking-wide text-[10px] text-amber-600 block mb-0.5">
                          Texto del boletín para este nivel (descriptor)
                        </span>
                        {activeDescriptor}
                      </div>
                    )}
                    <textarea
                      value={row.observation}
                      onChange={(e) => currentPeriodOpen && onUpdateGrade(selectedAchievementId, student.id, { observation: e.target.value })}
                      disabled={!currentPeriodOpen}
                      placeholder="Observación opcional del docente (nota aparte, no reemplaza el descriptor)…"
                      rows={2}
                      className={`w-full px-2 py-1.5 text-sm border rounded-lg outline-none resize-none ${
                        currentPeriodOpen ? 'border-slate-300 bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500' : 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                      }`}
                    />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">
                {editingAchievement ? 'Editar indicador' : 'Nuevo indicador'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nombre del indicador <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={modalName}
                  onChange={(e) => setModalName(e.target.value)}
                  placeholder="Ej: «Reconoce y expresa sus emociones en diferentes contextos»"
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>

              {perLevel && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold">Descriptores por nivel (obligatorios):</span> redacta qué significa
                    cada nivel para este indicador. Este texto es el que saldrá en el boletín al valorar.
                  </p>
                  {sortedLevels.map((lvl) => (
                    <div key={lvl.id} className="space-y-1">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: lvl.color }} />
                        {lvl.code} · {lvl.name} <span className="text-red-500">*</span>
                      </span>
                      <textarea
                        value={modalDescriptors[lvl.code] || ''}
                        onChange={(e) => setModalDescriptors((prev) => ({ ...prev, [lvl.code]: e.target.value }))}
                        placeholder={`Qué significa "${lvl.name}" para este indicador…`}
                        rows={2}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white outline-none text-sm resize-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      />
                    </div>
                  ))}
                </div>
              )}

              {modalError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                  {modalError}
                </p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleModalSave}
                disabled={modalSaving}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {modalSaving ? 'Guardando…' : editingAchievement ? 'Guardar cambios' : 'Crear indicador'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
