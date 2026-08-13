import React from 'react'
import { HeartHandshake } from 'lucide-react'
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
 * El texto sale como una fila especial en el boletín de Transición.
 */
export default function ConvivenciaPanel({
  students,
  loadingStudents,
  currentPeriodOpen,
  subjectName,
  valueByStudent,
  onChange,
}: Props) {
  const filled = students.filter((s) => (valueByStudent[s.id] || '').trim()).length

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-rose-200 shadow-sm px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <HeartHandshake className="w-4 h-4 text-rose-600" />
          {subjectName || 'Convivencia'}
        </span>
        <span className="flex-1 min-w-[200px] text-xs text-slate-500">
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

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[48px_minmax(180px,1fr)_minmax(280px,2fr)] items-stretch bg-rose-50 border-b border-rose-100 text-xs font-semibold uppercase text-slate-500">
          <div className="px-2 py-3 text-center self-center">N°</div>
          <div className="px-4 py-3 self-center">Estudiante</div>
          <div className="px-4 py-3 self-center">Registro de convivencia</div>
        </div>

        {loadingStudents ? (
          <div className="px-6 py-8 text-center text-slate-500">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-rose-600" />
              Cargando estudiantes...
            </div>
          </div>
        ) : students.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-500">
            No hay estudiantes matriculados en este grupo
          </div>
        ) : (
          students.map((student, idx) => (
            <div
              key={student.id}
              className="grid grid-cols-[48px_minmax(180px,1fr)_minmax(280px,2fr)] items-stretch border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
            >
              <div className="px-2 py-2 text-center text-sm font-medium text-slate-500 self-center">{idx + 1}</div>
              <div className="px-4 py-2 self-center min-w-0">
                <div className="font-medium text-slate-900 text-sm truncate">
                  {student.name}
                  <DiagnosisBadge student={student} />
                </div>
              </div>
              <div className="p-2 self-center">
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
          ))
        )}
      </div>
    </div>
  )
}
