import { useMemo } from 'react'
import { Lock, Plus, X } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════
// PREREQUISITES EDITOR (Fase 5) — sección opcional "Prerrequisitos" del docente.
// El docente elige qué actividades deben completarse antes de que ESTA se abra.
// Previene ciclos en el cliente (grey-out) por UX; el backend es la autoridad.
// ═══════════════════════════════════════════════════════════════════════════

export interface PrereqRule {
  prerequisiteId: string
  condition: string // SUBMITTED | GRADED | MIN_SCORE | COMPLETED
  minScore?: number | null
}

interface ActivityOption {
  id: string
  title: string
  type: string
  prerequisites?: { prerequisiteId: string }[]
}

const isLessonType = (type: string) => type === 'LESSON' || type === 'GAME'

// Tipos que sí podemos evaluar como prerrequisito en V1 (tienen entrega o progreso de
// lección). Se excluyen Foro/Live Quiz/autoeval-coeval (sin señal de completitud clara).
const ELIGIBLE_PREREQ_TYPES = new Set(['LESSON', 'GAME', 'TASK', 'QUIZ', 'EXAM', 'HOME_QUIZ', 'ICFES_SIMULATOR'])

// Condiciones disponibles según el tipo del prerrequisito.
function conditionsFor(type: string): { value: string; label: string }[] {
  if (isLessonType(type)) {
    return [
      { value: 'COMPLETED', label: 'Completada' },
      { value: 'MIN_SCORE', label: 'Nota mínima' },
    ]
  }
  return [
    { value: 'SUBMITTED', label: 'Entregada' },
    { value: 'GRADED', label: 'Calificada' },
    { value: 'MIN_SCORE', label: 'Nota mínima' },
  ]
}

// ¿Se llega de `start` a `target` siguiendo aristas requiere (activityId → prerequisiteId)?
function isReachable(edges: { activityId: string; prerequisiteId: string }[], start: string, target: string): boolean {
  if (start === target) return true
  const adj = new Map<string, string[]>()
  for (const e of edges) {
    const l = adj.get(e.activityId)
    if (l) l.push(e.prerequisiteId)
    else adj.set(e.activityId, [e.prerequisiteId])
  }
  const stack = [...(adj.get(start) || [])]
  const seen = new Set<string>([start])
  while (stack.length) {
    const n = stack.pop()!
    if (n === target) return true
    if (seen.has(n)) continue
    seen.add(n)
    const next = adj.get(n)
    if (next) stack.push(...next)
  }
  return false
}

const TYPE_LABEL: Record<string, string> = {
  TASK: 'Tarea', QUIZ: 'Quiz', EXAM: 'Examen', LESSON: 'Lección', GAME: 'Juego',
  LIVE_QUIZ: 'Live Quiz', HOME_QUIZ: 'Quiz en Casa', ICFES_SIMULATOR: 'ICFES', FORUM: 'Foro',
}

export function PrerequisitesEditor({
  selfId,
  activities,
  value,
  onChange,
}: {
  selfId?: string
  activities: ActivityOption[]
  value: PrereqRule[]
  onChange: (rules: PrereqRule[]) => void
}) {
  const byId = useMemo(() => new Map(activities.map(a => [a.id, a])), [activities])

  // Grafo actual: las aristas de las demás actividades + la selección pendiente de ESTA.
  const edges = useMemo(() => {
    const e: { activityId: string; prerequisiteId: string }[] = []
    for (const a of activities) {
      if (a.id === selfId) continue // las de esta actividad las reemplaza `value`
      for (const p of a.prerequisites || []) e.push({ activityId: a.id, prerequisiteId: p.prerequisiteId })
    }
    if (selfId) for (const r of value) e.push({ activityId: selfId, prerequisiteId: r.prerequisiteId })
    return e
  }, [activities, selfId, value])

  const selectedIds = new Set(value.map(r => r.prerequisiteId))

  // Elegibles para agregar: no es la propia, no está ya elegida, y no crearía ciclo
  // (que el prerrequisito pueda alcanzar a esta actividad).
  const options = activities.filter(a => {
    if (a.id === selfId) return false
    if (selectedIds.has(a.id)) return false
    if (!ELIGIBLE_PREREQ_TYPES.has(a.type)) return false // sin señal de completitud evaluable
    if (selfId && isReachable(edges, a.id, selfId)) return false // crearía ciclo
    return true
  })

  const addPrereq = (prerequisiteId: string) => {
    const act = byId.get(prerequisiteId)
    if (!act) return
    const condition = isLessonType(act.type) ? 'COMPLETED' : 'SUBMITTED'
    onChange([...value, { prerequisiteId, condition, minScore: null }])
  }
  const updateRule = (prerequisiteId: string, patch: Partial<PrereqRule>) =>
    onChange(value.map(r => (r.prerequisiteId === prerequisiteId ? { ...r, ...patch } : r)))
  const removeRule = (prerequisiteId: string) =>
    onChange(value.filter(r => r.prerequisiteId !== prerequisiteId))

  return (
    <div className="rounded-xl border border-slate-200 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-semibold text-slate-700">Prerrequisitos</span>
        <span className="text-xs text-slate-400">(opcional)</span>
      </div>

      {value.length === 0 ? (
        <p className="text-xs text-slate-400">Sin prerrequisitos: la actividad estará disponible de inmediato.</p>
      ) : (
        <>
          <p className="text-xs text-slate-500">Esta actividad se desbloquea cuando el estudiante cumpla <b>todas</b>:</p>
          <div className="space-y-2">
            {value.map(rule => {
              const act = byId.get(rule.prerequisiteId)
              return (
                <div key={rule.prerequisiteId} className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-sm text-slate-700 font-medium flex-1 min-w-0 truncate">
                    {act?.title || 'Actividad'}
                    {act && <span className="ml-1.5 text-[10px] uppercase text-slate-400">{TYPE_LABEL[act.type] || act.type}</span>}
                  </span>
                  <select
                    value={rule.condition}
                    onChange={e => updateRule(rule.prerequisiteId, { condition: e.target.value, minScore: e.target.value === 'MIN_SCORE' ? (rule.minScore ?? 3) : null })}
                    className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white"
                  >
                    {conditionsFor(act?.type || 'TASK').map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                  {rule.condition === 'MIN_SCORE' && (
                    <input
                      type="number" step="0.1" min="0"
                      value={rule.minScore ?? ''}
                      onChange={e => updateRule(rule.prerequisiteId, { minScore: e.target.value === '' ? null : parseFloat(e.target.value) })}
                      placeholder="≥ nota"
                      className="w-20 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                    />
                  )}
                  <button type="button" onClick={() => removeRule(rule.prerequisiteId)} className="text-slate-300 hover:text-rose-500" title="Quitar">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}

      {options.length > 0 ? (
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-violet-500 shrink-0" />
          <select
            value=""
            onChange={e => { if (e.target.value) addPrereq(e.target.value) }}
            className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white text-slate-600"
          >
            <option value="">Agregar prerrequisito…</option>
            {options.map(a => (
              <option key={a.id} value={a.id}>{a.title}{TYPE_LABEL[a.type] ? ` · ${TYPE_LABEL[a.type]}` : ''}</option>
            ))}
          </select>
        </div>
      ) : (
        activities.length > (selfId ? 1 : 0) && value.length > 0 && (
          <p className="text-[11px] text-slate-400">No hay más actividades disponibles (se ocultan las que crearían un ciclo).</p>
        )
      )}
    </div>
  )
}
