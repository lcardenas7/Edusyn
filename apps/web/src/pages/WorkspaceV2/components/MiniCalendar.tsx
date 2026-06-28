import { useEffect, useMemo, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Plus, X, Loader2, Trash2, Check } from 'lucide-react'
import { teacherWorkspaceApi } from '../../../lib/api'

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

function ymd(d: Date) { return d.toISOString().split('T')[0] }
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
              <span className="absolute bottom-1 flex gap-0.5">
                {hasEvents && <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-violet-500'}`} />}
                {hasOfficial && <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-amber-200' : 'bg-amber-400'}`} />}
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

        <div className="space-y-1 max-h-40 overflow-y-auto">
          {selectedOfficial.map((o, idx) => (
            <div key={`o${idx}`} className="flex items-center gap-2 text-xs px-1.5 py-1 text-amber-700">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              <span className="truncate">{o.label}</span>
              <span className="text-[9px] text-amber-400 ml-auto">oficial</span>
            </div>
          ))}
          {selectedEvents.map((e) => (
            <motion.div key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="group flex items-center gap-2 text-xs px-1.5 py-1 rounded hover:bg-slate-50">
              <button onClick={() => toggleDone(e)} className="flex-shrink-0">
                {e.done ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <span className="w-3 h-3 rounded-full border border-slate-300 inline-block" />}
              </button>
              <span className={`truncate flex-1 ${e.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{e.title}</span>
              {e.board && <span className="text-[9px] text-slate-400">{e.board.emoji}</span>}
              <button onClick={() => remove(e)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition"><Trash2 className="w-3 h-3" /></button>
            </motion.div>
          ))}
          {selectedEvents.length === 0 && selectedOfficial.length === 0 && !adding && (
            <p className="text-[11px] text-slate-400 px-1.5 py-2">Nada programado este día.</p>
          )}
        </div>
      </div>
    </div>
  )
}
