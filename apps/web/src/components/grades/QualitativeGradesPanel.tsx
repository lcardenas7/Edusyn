import React, { useMemo, useState } from 'react'
import { BookOpen, ChevronDown, Plus, Sparkles } from 'lucide-react'
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

interface Props {
  students: StudentRow[]
  loadingStudents: boolean
  currentPeriodOpen: boolean
  achievements: AchievementRow[]
  descriptorMode?: 'FREE' | 'DESCRIPTOR_PER_LEVEL'
  selectedAchievementId: string | null
  onSelectAchievement: (achievementId: string) => void
  qualitativeLevels: QualitativeLevel[]
  gradesByAchievement: Record<string, Record<string, QualitativeGradeValue>>
  onUpdateGrade: (achievementId: string, studentId: string, patch: Partial<QualitativeGradeValue>) => void
  onCreateAchievement: (description: string, levelDescriptors?: Array<{ levelCode: string; text: string }>) => Promise<void>
}

export default function QualitativeGradesPanel({
  students,
  loadingStudents,
  currentPeriodOpen,
  achievements,
  descriptorMode = 'FREE',
  selectedAchievementId,
  onSelectAchievement,
  qualitativeLevels,
  gradesByAchievement,
  onUpdateGrade,
  onCreateAchievement,
}: Props) {
  const [newIndicator, setNewIndicator] = useState('')
  const [creating, setCreating] = useState(false)
  const [descriptorDraft, setDescriptorDraft] = useState<Record<string, string>>({})
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null)

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

  const handleCreate = async () => {
    const description = newIndicator.trim()
    if (!description || !currentPeriodOpen) return
    setCreating(true)
    try {
      const descriptors = perLevel
        ? sortedLevels
            .map((lvl) => ({ levelCode: lvl.code, text: (descriptorDraft[lvl.code] || '').trim() }))
            .filter((d) => d.text)
        : undefined
      await onCreateAchievement(description, descriptors)
      setNewIndicator('')
      setDescriptorDraft({})
    } finally {
      setCreating(false)
    }
  }

  const getGradeRow = (studentId: string) => {
    if (!selectedAchievementId) return { levelCode: '', observation: '' }
    return activeGrades[studentId] || { levelCode: '', observation: '' }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-amber-100 bg-amber-50 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-slate-900">Evaluación cualitativa</h3>
            </div>
            <p className="text-sm text-slate-600 mt-1">
              Crea los indicadores una sola vez y luego asigna niveles con un clic por estudiante.
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>{achievements.length} indicador(es)</div>
            <div>{selectedLevelCount}/{students.length} estudiantes valorados en el indicador activo</div>
          </div>
        </div>

        <div className="p-4 border-b border-slate-100 bg-slate-50 space-y-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              type="text"
              value={newIndicator}
              onChange={(e) => setNewIndicator(e.target.value)}
              disabled={!currentPeriodOpen}
              placeholder="Nombre del indicador (obligatorio) — ej: «Reconoce y expresa sus emociones»"
              className={`w-full px-3 py-2 rounded-lg border outline-none text-sm ${
                currentPeriodOpen ? 'border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500' : 'border-slate-200 bg-slate-100 text-slate-400'
              }`}
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={!currentPeriodOpen || !newIndicator.trim() || creating}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Agregar indicador
            </button>
          </div>

          {!currentPeriodOpen ? (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              El período está cerrado para calificaciones. Un administrador debe habilitarlo en
              «Ventanas de Calificación» para poder crear indicadores y valorar estudiantes.
            </p>
          ) : !newIndicator.trim() ? (
            <p className="text-xs text-slate-500">
              Escribe el nombre del indicador arriba y presiona «Agregar indicador». Los descriptores por escala son opcionales.
            </p>
          ) : null}

          {perLevel && (
            <div className="rounded-lg border border-amber-200 bg-white p-3 space-y-2">
              <p className="text-xs text-slate-500">
                Descriptor por escala (opcional): redacta qué significa cada nivel para este indicador.
                Al calificar, el nivel elegido autocompleta el boletín.
              </p>
              {sortedLevels.map((lvl) => (
                <div key={lvl.id} className="grid gap-1 sm:grid-cols-[120px_1fr] sm:items-center">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: lvl.color }} />
                    {lvl.code} · {lvl.name}
                  </span>
                  <input
                    type="text"
                    value={descriptorDraft[lvl.code] || ''}
                    onChange={(e) => setDescriptorDraft((prev) => ({ ...prev, [lvl.code]: e.target.value }))}
                    disabled={!currentPeriodOpen}
                    placeholder={`Descriptor para "${lvl.name}"…`}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 outline-none text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:bg-slate-100"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {achievements.length === 0 ? (
              <div className="text-sm text-slate-500 bg-white border border-dashed border-slate-300 rounded-lg px-3 py-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                Todavía no hay indicadores creados para esta dimensión.
              </div>
            ) : (
              achievements.map((achievement) => {
                const active = achievement.id === selectedAchievementId
                const completed = students.filter((student) => !!gradesByAchievement[achievement.id]?.[student.id]?.levelCode).length
                return (
                  <button
                    key={achievement.id}
                    type="button"
                    onClick={() => onSelectAchievement(achievement.id)}
                    className={`min-w-[240px] max-w-full text-left rounded-xl border px-3 py-2 transition-all ${
                      active ? 'border-amber-500 bg-amber-50 shadow-sm' : 'border-slate-200 bg-white hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono text-amber-700">{achievement.code}</div>
                        <div className="text-sm font-medium text-slate-900 line-clamp-2">{achievement.baseDescription}</div>
                      </div>
                      <div className={`text-xs px-2 py-0.5 rounded-full ${active ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        {completed}/{students.length}
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 uppercase">Indicador activo</div>
          <div className="mt-1 font-semibold text-slate-900">
            {activeAchievement ? `Logro ${activeAchievement.orderNumber}` : 'Sin indicador seleccionado'}
          </div>
          <p className="text-sm text-slate-600 mt-2 line-clamp-2">
            {activeAchievement?.baseDescription || 'Selecciona un indicador para empezar a valorar.'}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 uppercase">Cobertura total</div>
          <div className="mt-1 font-semibold text-slate-900">{overallCompletion}%</div>
          <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-amber-500" style={{ width: `${overallCompletion}%` }} />
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500 uppercase">Consolidado general</div>
          <div className="mt-1 font-semibold text-slate-900">Promedio cualitativo por estudiante</div>
          <p className="text-sm text-slate-600 mt-2">
            Se calcula en pantalla a partir de todos los indicadores que ya tengan nivel asignado.
          </p>
        </div>
      </div>

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
        ) : !selectedAchievementId ? (
          <div className="px-6 py-8 text-center text-slate-500">
            Selecciona o crea un indicador para comenzar la evaluación.
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
                    const active = row.levelCode === level.code
                    return (
                      <div key={level.id} className="p-1 self-center">
                        <button
                          type="button"
                          disabled={!currentPeriodOpen}
                          onClick={() => {
                            if (!currentPeriodOpen) return
                            if (active) {
                              // Clic de nuevo sobre el nivel activo: quita la valoración
                              onUpdateGrade(selectedAchievementId, student.id, { levelCode: '' })
                              return
                            }
                            const patch: Partial<QualitativeGradeValue> = { levelCode: level.code }
                            // Con descriptor por nivel: autollenar la observación con el
                            // descriptor si el docente aún no escribió nada propio.
                            const desc = perLevel ? descriptorByLevel.get(level.code) : undefined
                            if (desc && !row.observation?.trim()) patch.observation = desc
                            onUpdateGrade(selectedAchievementId, student.id, patch)
                          }}
                          title={active ? `${level.name} · clic para quitar` : (level.description || level.name)}
                          className={`w-full h-9 rounded-md text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                            active ? 'text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:border-slate-300'
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
                      onClick={() => setExpandedStudentId(expanded ? null : student.id)}
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-md border transition-colors ${
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
                {expanded && (
                  <div className="px-4 pb-3 pt-2 bg-slate-50 border-t border-slate-100">
                    {activeDescriptor && (
                      <p className="text-[11px] mb-2 text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1 leading-tight">
                        Descriptor del nivel: {activeDescriptor}
                      </p>
                    )}
                    <textarea
                      value={row.observation}
                      onChange={(e) => currentPeriodOpen && onUpdateGrade(selectedAchievementId, student.id, { observation: e.target.value })}
                      disabled={!currentPeriodOpen}
                      placeholder="Observación del docente (se autocompleta con el descriptor del nivel si está definido)…"
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
    </div>
  )
}
