import { useEffect, useMemo, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, X, Loader2, Trash2, Check, Bell, Users, Flag, Star } from 'lucide-react'
import { teacherWorkspaceApi } from '../../../lib/api'

// Identidad por tipo de evento (clases Tailwind literales para el purge)
const EVENT_TYPE: Record<string, { label: string; icon: any; bar: string; text: string; soft: string }> = {
  REMINDER: { label: 'Recordatorio', icon: Bell, bar: 'bg-violet-500', text: 'text-violet-600', soft: 'bg-violet-50' },
  MEETING:  { label: 'Reunión', icon: Users, bar: 'bg-blue-500', text: 'text-blue-600', soft: 'bg-blue-50' },
  DEADLINE: { label: 'Entrega', icon: Flag, bar: 'bg-red-500', text: 'text-red-600', soft: 'bg-red-50' },
  ACTIVITY: { label: 'Actividad', icon: Star, bar: 'bg-emerald-500', text: 'text-emerald-600', soft: 'bg-emerald-50' },
  OTHER:    { label: 'Evento', icon: Bell, bar: 'bg-slate-400', text: 'text-slate-500', soft: 'bg-slate-50' },
}
const evType = (t?: string) => EVENT_TYPE[(t || 'REMINDER').toUpperCase()] ?? EVENT_TYPE.OTHER

interface WEvent {
  id: string
  title: string
  date: string
  type: string
  done: boolean
  board?: { id: string; title: string; emoji?: string | null } | null
}
interface OfficialDate { date: string; label: string; kind: string }

const DOW = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// Fecha local YYYY-MM-DD (NO UTC) — evita que en la noche se marque el día siguiente.
function ymd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function sameDay(a: string, b: string) { return a.split('T')[0] === b.split('T')[0] }

export function MiniCalendar() {
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [events, setEvents] = useState<WEvent[]>([])
  const [official, setOfficial] = useState<OfficialDate[]>([])
  const [selected, setSelected] = useState<string>(ymd(today))
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const monthStart = cursor
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)

  const load = useCallback(() => {
    setLoading(true)
    const from = ymd(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
    const to = ymd(new Date(cursor.getFullYear(), cursor.getMonth() + 2, 0))
    teacherWorkspaceApi.listEvents({ from, to })
      .then((res) => {
        setEvents(res.data?.events ?? [])
        setOfficial(res.data?.officialDates ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [cursor])

  useEffect(() => { load() }, [load])

  // Construir matriz del mes (lunes primero)
  const cells = useMemo(() => {
    const firstDow = (monthStart.getDay() + 6) % 7 // 0 = lunes
    const days: (Date | null)[] = []
    for (let i = 0; i < firstDow; i++) days.push(null)
    for (let d = 1; d <= monthEnd.getDate(); d++) days.push(new Date(cursor.getFullYear(), cursor.getMonth(), d))
    return days
  }, [cursor, monthStart, monthEnd])

  const eventsByDay = useMemo(() => {
    const m = new Map<string, WEvent[]>()
    for (const e of events) {
      const k = e.date.split('T')[0]
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(e)
    }
    return m
  }, [events])

  const officialByDay = useMemo(() => {
    const s = new Set<string>()
    official.forEach((o) => s.add(o.date.split('T')[0]))
    return s
  }, [official])

  const selectedEvents = eventsByDay.get(selected) ?? []
  const selectedOfficial = official.filter((o) => sameDay(o.date, selected))

  const handleAdd = async () => {
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      await teacherWorkspaceApi.createEvent({ title: newTitle.trim(), date: selected, type: 'REMINDER' })
      setNewTitle('')
      setAdding(false)
      load()
    } catch { /* noop */ } finally { setSaving(false) }
  }

  const toggleDone = async (e: WEvent) => {
    await teacherWorkspaceApi.updateEvent(e.id, { done: !e.done })
    load()
  }
  const remove = async (e: WEvent) => {
    await teacherWorkspaceApi.deleteEvent(e.id)
    load()
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      {/* Header mes */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-slate-800">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</h3>
        <div className="flex items-center gap-1">
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300 mr-1" />}
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="p-1 rounded hover:bg-slate-100"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
          <button onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))} className="text-[10px] px-1.5 py-1 rounded hover:bg-slate-100 text-slate-500">Hoy</button>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="p-1 rounded hover:bg-slate-100"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-0.5 text-center">
        {DOW.map((d) => <div key={d} className="text-[10px] font-semibold text-slate-400 py-1">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />
          const key = ymd(d)
          const isToday = key === ymd(today)
          const isSelected = key === selected
          const hasEvents = (eventsByDay.get(key)?.length ?? 0) > 0
          const hasOfficial = officialByDay.has(key)
          return (
            <button
              key={key}
              onClick={() => setSelected(key)}
              className={`relative aspect-square rounded-lg text-xs flex items-center justify-center transition
                ${isSelected ? 'bg-violet-600 text-white font-bold' : isToday ? 'bg-violet-50 text-violet-700 font-semibold' : 'hover:bg-slate-100 text-slate-700'}`}
            >
              {d.getDate()}
              <span className="absolute bottom-1 flex items-center gap-0.5">
                {hasEvents && <span className={`h-1 w-3 rounded-full ${isSelected ? 'bg-white' : 'bg-violet-500'} shadow-sm`} />}
                {hasOfficial && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-amber-200' : 'bg-amber-400'}`} />}
              </span>
            </button>
          )
        })}
      </div>

      {/* Día seleccionado */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-600">
            {new Date(selected + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <button onClick={() => setAdding((v) => !v)} className="text-violet-600 hover:text-violet-800" aria-label="Agregar evento">
            {adding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>

        {adding && (
          <div className="flex items-center gap-2 mb-2">
            <input
              autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd() }}
              placeholder="Nuevo evento…"
              className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-violet-400 focus:ring-1 focus:ring-violet-400 focus:outline-none"
            />
            <button onClick={handleAdd} disabled={saving || !newTitle.trim()} className="px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold disabled:opacity-40">
              {saving ? '…' : 'Agregar'}
            </button>
          </div>
        )}

        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          {/* Fechas oficiales del período (solo lectura) */}
          {selectedOfficial.map((o, idx) => (
            <div key={`o${idx}`} className="flex items-stretch gap-2 rounded-xl bg-amber-50 border border-amber-100 overflow-hidden">
              <span className="w-1 bg-amber-400 flex-shrink-0" />
              <div className="flex items-center gap-2 flex-1 py-2 pr-2">
                <Flag className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span className="text-xs font-medium text-amber-800 truncate flex-1">{o.label}</span>
                <span className="text-[9px] text-amber-500 uppercase tracking-wide font-semibold">oficial</span>
              </div>
            </div>
          ))}

          {/* Eventos del docente — tarjeta con barra de color por tipo */}
          {selectedEvents.map((e) => {
            const t = evType(e.type)
            const Icon = t.icon
            return (
              <motion.div key={e.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                className={`group flex items-stretch gap-2 rounded-xl border border-slate-200 overflow-hidden ${e.done ? 'opacity-60' : ''}`}>
                <span className={`w-1 flex-shrink-0 ${e.done ? 'bg-slate-300' : t.bar}`} />
                <div className="flex items-center gap-2 flex-1 min-w-0 py-2 pr-2">
                  <button onClick={() => toggleDone(e)} className="flex-shrink-0" title={e.done ? 'Reabrir' : 'Marcar hecho'}>
                    {e.done
                      ? <Check className="w-4 h-4 text-emerald-500" />
                      : <span className={`w-4 h-4 rounded-md ${t.soft} ${t.text} inline-flex items-center justify-center`}><Icon className="w-2.5 h-2.5" /></span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${e.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{e.title}</p>
                    <p className="text-[10px] text-slate-400 truncate">
                      <span className={t.text}>{t.label}</span>
                      {e.board && <> · {e.board.emoji} {e.board.title}</>}
                    </p>
                  </div>
                  <button onClick={() => remove(e)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </motion.div>
            )
          })}

          {selectedEvents.length === 0 && selectedOfficial.length === 0 && !adding && (
            <p className="text-[11px] text-slate-400 px-1.5 py-3 text-center">Nada programado este día.</p>
          )}
        </div>
      </div>
    </div>
  )
}
