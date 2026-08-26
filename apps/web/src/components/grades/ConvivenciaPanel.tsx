import React, { useEffect, useMemo, useState } from 'react'
import { HeartHandshake, AlertTriangle } from 'lucide-react'
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
 * Panel de Convivencia (modo docente): el docente escribe UN desempeño de
 * convivencia para todo el grupo y marca el nivel de cada estudiante con un
 * clic, igual que la grilla de Imprescindibles/dimensiones. El desempeño se
 * comparte por el grupo; la valoración es individual.
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
  // Escala ordenada (C / EP / I…), dinámica desde la config del grado.
  const sortedLevels = useMemo(
    () => [...qualitativeLevels].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [qualitativeLevels],
  )

  // Nivel actual de un estudiante (derivado del estado del padre).
  const levelOf = (studentId: string) => valueByStudent[studentId]?.[0]?.levelCode || ''

  // El desempeño es compartido por el grupo: se toma el primer texto no vacío.
  const loadedText = useMemo(() => {
    for (const s of students) {
      const t = valueByStudent[s.id]?.find((i) => i.text.trim())?.text
      if (t) return t.trim()
    }
    return ''
  }, [valueByStudent, students])

  const [sharedText, setSharedText] = useState('')
  const [touched, setTouched] = useState(false)

  // Al cambiar de grupo/asignatura, se reinicia para tomar el texto guardado.
  const datasetKey = `${subjectName}|${students.map((s) => s.id).join(',')}`
  useEffect(() => { setTouched(false) }, [datasetKey])
  useEffect(() => { if (!touched) setSharedText(loadedText) }, [loadedText, touched])

  const valorados = students.filter((s) => levelOf(s.id)).length
  const canValue = currentPeriodOpen && !!sharedText.trim()

  // Propaga el desempeño compartido a todos los estudiantes, conservando su nivel.
  const applyText = (text: string) => {
    setTouched(true)
    setSharedText(text)
    const t = text.trim()
    students.forEach((s) => {
      const level = levelOf(s.id)
      onChange(s.id, t || level ? [{ text, levelCode: level }] : [])
    })
  }

  const setLevel = (studentId: string, code: string) => {
    if (!canValue) return
    const level = levelOf(studentId) === code ? '' : code
    onChange(studentId, sharedText.trim() || level ? [{ text: sharedText, levelCode: level }] : [])
  }

  const gridTemplateColumns = `44px minmax(160px, 1fr) repeat(${sortedLevels.length}, minmax(72px, 104px))`

  return (
    <div className="space-y-3">
      {/* Encabezado */}
      <div className="bg-white rounded-xl border border-rose-200 shadow-sm px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <HeartHandshake className="w-4 h-4 text-rose-600" />
          {subjectName || 'Convivencia'}
        </span>
        <span className="flex-1 min-w-[180px] text-xs text-slate-500">
          Escribe un desempeño de convivencia para el grupo y marca el nivel de cada estudiante.
        </span>
        <span className="text-[11px] text-slate-500 whitespace-nowrap">
          {valorados}/{students.length} valorados
        </span>
      </div>

      {!currentPeriodOpen && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          El período está cerrado para calificaciones. Un administrador debe habilitarlo en
          «Ventanas de Calificación» para poder registrar convivencia.
        </p>
      )}

      {/* Desempeño compartido por el grupo (un solo texto para todos) */}
      <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3 space-y-1.5">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-rose-800">
          Desempeño de convivencia (para todo el grupo)
        </label>
        <input
          value={sharedText}
          onChange={(e) => currentPeriodOpen && applyText(e.target.value)}
          disabled={!currentPeriodOpen}
          placeholder="Ej: Comparte y respeta los acuerdos de convivencia del grupo"
          className={`w-full px-3 py-2 text-sm border rounded-lg outline-none ${currentPeriodOpen ? 'border-rose-300 bg-white focus:ring-2 focus:ring-rose-400 focus:border-rose-400' : 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'}`}
        />
        <p className="text-[11px] text-rose-700/80">
          Se aplica a todos los estudiantes. En el boletín aparece como el desempeño de convivencia con su valoración.
        </p>
      </div>

      {/* Grilla de estudiantes: un clic por nivel (igual que Imprescindibles) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div
          className="grid items-stretch bg-rose-50 border-b border-rose-100 text-xs font-semibold uppercase text-slate-500"
          style={{ gridTemplateColumns }}
        >
          <div className="px-2 py-3 text-center self-center">N°</div>
          <div className="px-4 py-3 self-center">Estudiante</div>
          {sortedLevels.map((level) => (
            <div key={level.code} className="px-2 py-2 text-center border-b-4 self-center" style={{ borderColor: level.color || '#e11d48' }}>
              <span className="block text-sm font-bold" style={{ color: level.color || '#e11d48' }}>{level.code}</span>
              <span className="block text-[10px] normal-case font-medium text-slate-500 leading-tight">{level.name}</span>
            </div>
          ))}
        </div>

        {currentPeriodOpen && !loadingStudents && students.length > 0 && !sharedText.trim() && (
          <div className="px-4 py-2 bg-rose-50 border-b border-rose-100">
            <span className="text-xs text-rose-800 inline-flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Escribe primero el desempeño de convivencia arriba para habilitar la valoración.
            </span>
          </div>
        )}

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
          students.map((student, idx) => {
            const current = levelOf(student.id)
            return (
              <div key={student.id} className="border-b border-slate-100 last:border-b-0">
                <div className="grid items-stretch hover:bg-slate-50 transition-colors" style={{ gridTemplateColumns }}>
                  <div className="px-2 py-2 text-center text-sm font-medium text-slate-500 self-center">{idx + 1}</div>
                  <div className="px-4 py-2 self-center min-w-0">
                    <div className="font-medium text-slate-900 text-sm truncate">
                      {student.name}
                      <DiagnosisBadge student={student} />
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {current ? (sortedLevels.find((l) => l.code === current)?.name || current) : 'Sin valor'}
                    </div>
                  </div>
                  {sortedLevels.map((level) => {
                    const active = current === level.code
                    return (
                      <div key={level.code} className="p-1 self-center">
                        <button
                          type="button"
                          disabled={!canValue}
                          onClick={() => setLevel(student.id, level.code)}
                          title={canValue ? (active ? `${level.name} · clic para quitar` : level.name) : 'Escribe primero el desempeño de convivencia'}
                          className={`w-full h-9 rounded-md text-xs font-bold transition-all disabled:cursor-not-allowed ${
                            active
                              ? 'text-white shadow-sm'
                              : canValue
                                ? 'border border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:border-rose-300'
                                : 'border border-slate-100 bg-slate-50 text-slate-300'
                          }`}
                          style={active ? { backgroundColor: level.color || '#e11d48' } : undefined}
                        >
                          {level.code}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
