import React, { useMemo, useState } from 'react'
import { HeartHandshake, Users, Check, Wand2 } from 'lucide-react'
import { DiagnosisBadge } from '../StudentBadges'

export interface ConvivenciaItem {
  text: string
  levelCode: string
}

interface StudentRow {
  id: string
  name: string
  enrollmentId: string
  hasDiagnosis?: boolean
  diagnosisType?: string
}

interface Props {
  students: StudentRow[]
  loadingStudents: boolean
  currentPeriodOpen: boolean
  subjectName: string
  /** Desempeños de convivencia por estudiante (clave = student.id). */
  valueByStudent: Record<string, ConvivenciaItem[]>
  qualitativeLevels: Array<{ code: string; name: string; order?: number; color?: string }>
  onChange: (studentId: string, items: ConvivenciaItem[]) => void
}

/**
 * Panel de Convivencia: el docente registra desempeños libres y asigna una
 * valoración cualitativa a cada uno. Soporta carga masiva y es responsive.
 */
export default function ConvivenciaPanel({
  students,
  loadingStudents,
  currentPeriodOpen,
  subjectName,
  valueByStudent,
  qualitativeLevels,
  onChange,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkText, setBulkText] = useState('')

  const filled = students.filter((s) => (valueByStudent[s.id] || []).some(item => item.text.trim())).length
  const allSelected = students.length > 0 && selected.size === students.length

  // Escala ordenada (L / EP / I…), igual que en las demás dimensiones.
  const sortedLevels = useMemo(
    () => [...qualitativeLevels].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [qualitativeLevels],
  )

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(students.map((s) => s.id)))
  }

  const applyBulk = () => {
    const items = bulkText.split('\n').map(text => ({ text: text.trim(), levelCode: '' })).filter(item => item.text)
    if (!items.length || selected.size === 0) return
    selected.forEach((id) => onChange(id, items))
    setSelected(new Set())
    setBulkText('')
  }

  const selectedCount = selected.size

  return (
    <div className="space-y-3">
      {/* Encabezado */}
      <div className="bg-white rounded-xl border border-rose-200 shadow-sm px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <HeartHandshake className="w-4 h-4 text-rose-600" />
          {subjectName || 'Convivencia'}
        </span>
        <span className="flex-1 min-w-[180px] text-xs text-slate-500">
          Registra cada desempeño y su valoración. En el boletín cada uno aparece en su propia fila.
        </span>
        <span className="text-[11px] text-slate-500 whitespace-nowrap">
          {filled}/{students.length} con registro
        </span>
      </div>

      {!currentPeriodOpen && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          El período está cerrado para calificaciones. Un administrador debe habilitarlo en
          «Ventanas de Calificación» para poder registrar convivencia.
        </p>
      )}

      {/* Carga masiva: escribe un texto y aplícalo a los estudiantes seleccionados */}
      {currentPeriodOpen && students.length > 0 && (
        <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-800">
            <Wand2 className="w-3.5 h-3.5" />
            Registro rápido (varios estudiantes)
          </div>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="Un desempeño por línea para aplicarlo a los estudiantes que marques abajo…"
            rows={2}
            className="w-full px-2 py-1.5 text-sm border border-rose-300 rounded-lg bg-white outline-none resize-y focus:ring-2 focus:ring-rose-400 focus:border-rose-400"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleAll}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-white"
            >
              <Check className="w-3.5 h-3.5" />
              {allSelected ? 'Quitar selección' : 'Seleccionar todos'}
            </button>
            <span className="text-[11px] text-slate-500">{selectedCount} seleccionado{selectedCount === 1 ? '' : 's'}</span>
            <button
              type="button"
              onClick={applyBulk}
              disabled={!bulkText.trim() || selectedCount === 0}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Users className="w-3.5 h-3.5" />
              Aplicar a {selectedCount || 0}
            </button>
          </div>
          <p className="text-[11px] text-rose-700/80">
            Sobrescribe los desempeños de los estudiantes marcados. Luego puedes ajustar texto y valoración abajo.
          </p>
        </div>
      )}

      {/* Lista de estudiantes — una tarjeta por estudiante (responsive) */}
      {loadingStudents ? (
        <div className="px-6 py-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-rose-600" />
            Cargando estudiantes...
          </div>
        </div>
      ) : students.length === 0 ? (
        <div className="px-6 py-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
          No hay estudiantes matriculados en este grupo
        </div>
      ) : (
        <div className="space-y-2">
          {students.map((student, idx) => {
            const isSel = selected.has(student.id)
            const items = valueByStudent[student.id] || []
            const hasText = items.some(item => item.text.trim())
            // Siempre mostramos al menos una fila lista para calificar (sin "Agregar" previo).
            const rows = items.length ? items : [{ text: '', levelCode: '' }]
            const updateItem = (itemIndex: number, patch: Partial<ConvivenciaItem>) => {
              const next = rows.map((item, index) => index === itemIndex ? { ...item, ...patch } : item)
              onChange(student.id, next)
            }
            return (
              <div
                key={student.id}
                className={`bg-white rounded-xl border shadow-sm p-3 transition-colors ${isSel ? 'border-rose-400 ring-1 ring-rose-200' : 'border-slate-200'}`}
              >
                <div className="flex items-start gap-2.5">
                  <label className="flex items-center pt-0.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggle(student.id)}
                      disabled={!currentPeriodOpen}
                      className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-400 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </label>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-medium text-slate-400 w-5 shrink-0">{idx + 1}</span>
                      <span className="font-medium text-slate-900 text-sm truncate">
                        {student.name}
                        <DiagnosisBadge student={student} />
                      </span>
                      {hasText && <span className="ml-auto shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5"><Check className="w-3 h-3" />Registrado</span>}
                    </div>
                    <div className="space-y-2">
                      {rows.map((item, itemIndex) => {
                        const canDelete = currentPeriodOpen && items.length > 0
                        return (
                          <div key={itemIndex} className="space-y-1">
                            <div className="flex gap-1.5">
                              <input
                                value={item.text}
                                onChange={(e) => currentPeriodOpen && updateItem(itemIndex, { text: e.target.value })}
                                disabled={!currentPeriodOpen}
                                placeholder="Describe un desempeño de convivencia…"
                                className={`min-w-0 flex-1 px-2 py-1.5 text-sm border rounded-lg outline-none ${currentPeriodOpen ? 'border-slate-300 bg-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500' : 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'}`}
                              />
                              {canDelete && (
                                <button type="button" onClick={() => onChange(student.id, items.filter((_, index) => index !== itemIndex))} className="px-2 text-slate-400 hover:text-rose-600" aria-label="Eliminar desempeño">×</button>
                              )}
                            </div>
                            {/* Valoración directa: un clic sobre el nivel, igual que las demás dimensiones. */}
                            <div className="flex flex-wrap items-center gap-1 pl-0.5">
                              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 mr-0.5">Valoración</span>
                              {sortedLevels.length === 0 ? (
                                <span className="text-[11px] text-amber-600">Escala no configurada</span>
                              ) : sortedLevels.map(level => {
                                const active = item.levelCode === level.code
                                return (
                                  <button
                                    key={level.code}
                                    type="button"
                                    disabled={!currentPeriodOpen}
                                    onClick={() => currentPeriodOpen && updateItem(itemIndex, { levelCode: active ? '' : level.code })}
                                    title={level.name}
                                    className={`min-w-[2.25rem] h-8 px-2 rounded-lg text-xs font-bold border transition-all disabled:cursor-not-allowed ${
                                      active
                                        ? 'text-white shadow-sm border-transparent'
                                        : currentPeriodOpen
                                          ? 'bg-white text-slate-500 border-slate-200 hover:border-rose-300 hover:text-rose-700'
                                          : 'bg-slate-100 text-slate-300 border-slate-200'
                                    }`}
                                    style={active ? { backgroundColor: level.color || '#e11d48' } : undefined}
                                  >
                                    {level.code}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                      {currentPeriodOpen && (
                        <button type="button" onClick={() => onChange(student.id, [...items, { text: '', levelCode: '' }])} className="text-xs font-medium text-rose-700 hover:text-rose-800">
                          + Agregar otro desempeño
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
