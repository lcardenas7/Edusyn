import React, { useMemo, useState } from 'react'
import { HeartHandshake, Users, Check, Wand2 } from 'lucide-react'
import { DiagnosisBadge } from '../StudentBadges'

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
  /** Texto de convivencia por estudiante (clave = student.id). */
  valueByStudent: Record<string, string>
  onChange: (studentId: string, text: string) => void
}

/**
 * Panel de registro de Convivencia (SubjectType.CONVIVENCIA): texto libre del
 * docente por estudiante y período. Sin escala ni nivel — no lleva nota.
 * Soporta carga masiva (un texto → varios estudiantes) y es responsive.
 */
export default function ConvivenciaPanel({
  students,
  loadingStudents,
  currentPeriodOpen,
  subjectName,
  valueByStudent,
  onChange,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkText, setBulkText] = useState('')

  const filled = students.filter((s) => (valueByStudent[s.id] || '').trim()).length
  const allSelected = students.length > 0 && selected.size === students.length

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
    const text = bulkText.trim()
    if (!text || selected.size === 0) return
    selected.forEach((id) => onChange(id, text))
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
          Registro textual del docente por estudiante. No lleva nota ni escala; sale como fila especial en el boletín.
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
            placeholder="Escribe un registro para aplicarlo a los estudiantes que marques abajo…"
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
            Sobrescribe el texto de los estudiantes marcados. Luego puedes ajustar cada uno abajo.
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
            const hasText = !!(valueByStudent[student.id] || '').trim()
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
                    <textarea
                      value={valueByStudent[student.id] || ''}
                      onChange={(e) => currentPeriodOpen && onChange(student.id, e.target.value)}
                      disabled={!currentPeriodOpen}
                      placeholder="Describe cómo se relaciona, participa y convive el estudiante durante el período…"
                      rows={2}
                      className={`w-full px-2 py-1.5 text-sm border rounded-lg outline-none resize-y ${
                        currentPeriodOpen
                          ? 'border-slate-300 bg-white focus:ring-2 focus:ring-rose-500 focus:border-rose-500'
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                      }`}
                    />
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
