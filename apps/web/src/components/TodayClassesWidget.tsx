import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, AlertTriangle, Loader2, Calendar } from 'lucide-react'
import { attendanceApi } from '../lib/api'

interface Assignment {
  id: string
  subject: { id: string; name: string }
  group: { id: string; name: string; grade?: { name: string } }
  academicYear: { id: string; year: number }
}

interface Props {
  assignments: Assignment[]
  selectedId?: string
  date: string // YYYY-MM-DD
  onSelect: (assignment: Assignment) => void
}

type ClassStatus = 'saved' | 'pending' | 'loading'

/** Widget "Tus clases de hoy" — muestra todas las asignaciones del docente
 *  con un indicador visual de si ya se registró asistencia para la fecha actual. */
export default function TodayClassesWidget({ assignments, selectedId, date, onSelect }: Props) {
  const [statusMap, setStatusMap] = useState<Record<string, { status: ClassStatus; present?: number; total?: number }>>({})

  const todayStr = new Date().toISOString().split('T')[0]
  const isToday = date === todayStr

  useEffect(() => {
    if (assignments.length === 0) return

    // Inicializar como loading
    const initial: Record<string, { status: ClassStatus }> = {}
    assignments.forEach(a => { initial[a.id] = { status: 'loading' } })
    setStatusMap(initial)

    // Consultar en paralelo el estado de cada asignación para la fecha
    assignments.forEach(async a => {
      try {
        const res = await attendanceApi.getByAssignment(a.id, date)
        const records = res.data || []
        if (records.length > 0) {
          const present = records.filter((r: any) => r.status === 'PRESENT').length
          setStatusMap(prev => ({
            ...prev,
            [a.id]: { status: 'saved', present, total: records.length },
          }))
        } else {
          setStatusMap(prev => ({ ...prev, [a.id]: { status: 'pending' } }))
        }
      } catch {
        setStatusMap(prev => ({ ...prev, [a.id]: { status: 'pending' } }))
      }
    })
  }, [assignments, date])

  if (assignments.length === 0) return null

  const pendingCount = Object.values(statusMap).filter(v => v.status === 'pending').length
  const dateLabel = isToday
    ? 'Hoy'
    : new Date(date + 'T00:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6">
      <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600" />
          Tus clases · <span className="capitalize font-normal text-slate-600">{dateLabel}</span>
        </h2>
        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
            <AlertTriangle className="w-3 h-3" />
            {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
          </span>
        )}
        {pendingCount === 0 && Object.values(statusMap).every(v => v.status === 'saved') && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            Todo registrado
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-100">
        {assignments.map(a => {
          const s = statusMap[a.id] || { status: 'loading' as ClassStatus }
          const isSelected = a.id === selectedId
          const groupLabel = `${a.group.grade?.name ?? ''} ${a.group.name}`.trim()

          return (
            <button
              key={a.id}
              onClick={() => onSelect(a)}
              className={`px-4 py-3 flex items-center gap-3 text-left transition-colors bg-white ${
                isSelected ? 'ring-2 ring-blue-500 ring-inset' : 'hover:bg-slate-50'
              }`}
            >
              {/* Indicador de estado */}
              {s.status === 'loading' ? (
                <Loader2 className="w-4 h-4 text-slate-300 animate-spin shrink-0" />
              ) : s.status === 'saved' ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-amber-400 shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 text-sm truncate">{a.subject.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {groupLabel}
                  {s.status === 'saved' && s.present !== undefined && s.total !== undefined && (
                    <span className="ml-2 text-green-600 font-medium">
                      {s.present}/{s.total} presentes
                    </span>
                  )}
                  {s.status === 'pending' && (
                    <span className="ml-2 text-amber-600 font-medium">Sin registrar</span>
                  )}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
