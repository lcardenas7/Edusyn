/**
 * Selector de aula destino — pieza compartida (antes estaba triplicado casi literal
 * en Classroom.tsx y ya había divergido: unos hacían hover violeta, otros azul).
 *
 * Corrige el hallazgo §H2 de docs/AUDITORIA_VISUAL_AULA.md: dos aulas suelen llamarse
 * IGUAL (mismo curso, distinto grupo). Lo único que las distingue es grupo+asignatura,
 * que era justo la línea que se truncaba → el docente tenía que adivinar.
 * Aquí el título puede ocupar 2 líneas y grupo+asignatura NUNCA se trunca.
 */
import { Loader2 } from 'lucide-react'

export interface PickableClassroom {
  id: string
  title?: string
  color?: string
  groupName?: string
  subjectName?: string
}

interface ClassroomPickerProps {
  classrooms: PickableClassroom[]
  loading?: boolean
  /** Marca el aula en curso (deshabilita e indica por qué). */
  busyId?: string | null
  onPick: (classroom: PickableClassroom) => void
  emptyMessage?: string
  trailing?: (c: PickableClassroom) => React.ReactNode
}

export function ClassroomPicker({
  classrooms, loading, busyId, onPick,
  emptyMessage = 'No hay otras aulas disponibles',
  trailing,
}: ClassroomPickerProps) {
  if (loading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>
  }
  if (classrooms.length === 0) {
    return <p className="text-sm text-ink-muted text-center py-8">{emptyMessage}</p>
  }
  return (
    <div className="space-y-2 max-h-72 overflow-y-auto">
      {classrooms.map(c => {
        const identity = [c.groupName, c.subjectName].filter(Boolean).join(' • ')
        return (
          <button
            key={c.id}
            onClick={() => onPick(c)}
            disabled={!!busyId}
            title={[c.title, identity].filter(Boolean).join(' — ')}
            className="w-full flex items-start gap-3 p-3 rounded-lg border border-hairline hover:border-violet-300 hover:bg-violet-50 transition-colors text-left disabled:opacity-50"
          >
            <div className="w-10 h-10 shrink-0 rounded-lg flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: c.color || '#6366f1' }}>
              {c.title?.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              {/* 2 líneas: los nombres de curso reales no caben en una. */}
              <p className="font-medium text-ink-primary line-clamp-2 leading-snug">{c.title}</p>
              {/* Lo que de verdad desambigua: nunca truncar. */}
              {identity && <p className="text-xs text-ink-muted mt-0.5">{identity}</p>}
            </div>
            {busyId === c.id
              ? <Loader2 className="w-4 h-4 animate-spin text-violet-600 shrink-0 mt-1" />
              : trailing?.(c)}
          </button>
        )
      })}
    </div>
  )
}
