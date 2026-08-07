import React, { useMemo, useState } from 'react'
import { BookOpen, CheckCircle2, Circle, Plus, Sparkles } from 'lucide-react'
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

  const levelByCode = useMemo(() => {
    const map = new Map<string, QualitativeLevel>()
    sortedLevels.forEach((level) => map.set(level.code, level))
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
              placeholder="Agregar indicador o logro base para esta dimensión"
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

      <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-amber-50">
              <th className="text-center px-2 py-3 text-xs font-medium text-slate-500 uppercase w-10">N°</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase min-w-[250px]">Estudiante</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-amber-700 uppercase min-w-[220px]">Nivel</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-amber-700 uppercase min-w-[300px]">Observación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loadingStudents ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-600" />
                    Cargando estudiantes...
                  </div>
                </td>
              </tr>
            ) : students.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  No hay estudiantes matriculados en este grupo
                </td>
              </tr>
            ) : selectedAchievementId ? (
              students.map((student, idx) => {
                const row = getGradeRow(student.id)
                const selectedLevel = levelByCode.get(row.levelCode) || null
                const consolidatedLevel = consolidatedByStudent[student.id]

                return (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-2 py-3 text-center text-sm font-medium text-slate-500">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 align-top">
                      <div className="flex flex-col gap-1">
                        <div>{student.name}<DiagnosisBadge student={student} /></div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5">
                            <Circle className="w-3 h-3" />
                            Consolidado: {consolidatedLevel ? consolidatedLevel.name : 'Sin valor'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-wrap gap-2 justify-center">
                        {sortedLevels.map((level) => {
                          const active = row.levelCode === level.code
                          return (
                            <button
                              key={level.id}
                              type="button"
                              onClick={() => {
                                if (!currentPeriodOpen) return
                                const patch: Partial<QualitativeGradeValue> = { levelCode: level.code }
                                // Con descriptor por nivel: autollenar la observación con el
                                // descriptor si el docente aún no escribió nada propio.
                                const desc = perLevel ? descriptorByLevel.get(level.code) : undefined
                                if (desc && !row.observation?.trim()) patch.observation = desc
                                onUpdateGrade(selectedAchievementId, student.id, patch)
                              }}
                              disabled={!currentPeriodOpen}
                              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-all disabled:cursor-not-allowed ${
                                active ? 'border-amber-600 bg-amber-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300'
                              }`}
                              style={active ? undefined : { borderLeftColor: level.color, borderLeftWidth: '4px' }}
                              title={level.description}
                            >
                              {active ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                              {level.code} · {level.name}
                            </button>
                          )
                        })}
                      </div>
                      {perLevel && row.levelCode && descriptorByLevel.get(row.levelCode) ? (
                        <p className="text-[11px] mt-2 text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1 leading-tight text-center">
                          {descriptorByLevel.get(row.levelCode)}
                        </p>
                      ) : selectedLevel && (
                        <p className="text-[10px] mt-2 text-slate-500 leading-tight text-center">
                          {selectedLevel.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <textarea
                        value={row.observation}
                        onChange={(e) => currentPeriodOpen && onUpdateGrade(selectedAchievementId, student.id, { observation: e.target.value })}
                        disabled={!currentPeriodOpen}
                        placeholder="Observación del docente..."
                        rows={2}
                        className={`w-full px-2 py-1.5 text-sm border rounded-lg outline-none resize-none ${
                          currentPeriodOpen ? 'border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500' : 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                        }`}
                      />
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  Selecciona o crea un indicador para comenzar la evaluación.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
