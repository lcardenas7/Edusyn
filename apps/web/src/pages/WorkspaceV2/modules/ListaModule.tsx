import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Check, Circle, Trash2, Flag, Calendar, ChevronDown } from 'lucide-react'

export interface ListaItem {
  id: string
  title: string
  status?: string | null
  completedAt?: string | null
  dueDate?: string | null
  metadata?: any
}

export interface ListaCreate { title: string; priority: string; dueDate?: string; responsable?: string }

interface Props {
  items: ListaItem[]
  onCreate: (data: ListaCreate) => Promise<void>
  onToggle: (item: ListaItem) => Promise<void>
  onDelete: (item: ListaItem) => Promise<void>
}

const PRIORITY: Record<string, { label: string; cls: string; dot: string }> = {
  HIGH:   { label: 'Alta', cls: 'text-red-600', dot: 'bg-red-500' },
  MEDIUM: { label: 'Media', cls: 'text-amber-600', dot: 'bg-amber-500' },
  LOW:    { label: 'Baja', cls: 'text-slate-400', dot: 'bg-slate-300' },
}
const prio = (p?: string) => PRIORITY[(p || 'MEDIUM').toUpperCase()] ?? PRIORITY.MEDIUM

export function ListaModule({ items, onCreate, onToggle, onDelete }: Props) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [dueDate, setDueDate] = useState('')
  const [responsable, setResponsable] = useState('')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all')

  const filtered = useMemo(() => {
    return items
      .filter((i) => {
        const done = i.status === 'DONE' || !!i.completedAt
        if (filter === 'pending' && done) return false
        if (filter === 'done' && !done) return false
        return true
      })
      .sort((a, b) => {
        const order = { HIGH: 0, MEDIUM: 1, LOW: 2 } as any
        const pa = order[(a.metadata?.priority || 'MEDIUM').toUpperCase()] ?? 1
        const pb = order[(b.metadata?.priority || 'MEDIUM').toUpperCase()] ?? 1
        return pa - pb
      })
  }, [items, filter])

  const submit = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await onCreate({ title: title.trim(), priority, dueDate: dueDate || undefined, responsable: responsable.trim() || undefined })
      setTitle(''); setDueDate(''); setResponsable(''); setPriority('MEDIUM')
    } catch { /* parent */ } finally { setSaving(false) }
  }

  const pendingCount = items.filter((i) => i.status !== 'DONE' && !i.completedAt).length

  return (
    <div className="pb-10">
      {/* Composer */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-4">
        <div className="flex items-center gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            placeholder="Nuevo pendiente…" className="flex-1 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none" />
          <button onClick={submit} disabled={!title.trim() || saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold disabled:opacity-40">
            {saving ? '…' : 'Agregar'} <Send className="w-3 h-3" />
          </button>
        </div>
        <div className="flex items-center flex-wrap gap-3 mt-3 pt-3 border-t border-slate-100 text-xs">
          <div className="inline-flex items-center gap-1.5">
            <Flag className="w-3.5 h-3.5 text-slate-400" />
            <div className="relative inline-flex items-center">
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className="appearance-none pr-5 pl-1 py-0.5 bg-transparent text-slate-600 focus:outline-none">
                <option value="HIGH">Alta</option><option value="MEDIUM">Media</option><option value="LOW">Baja</option>
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-0 pointer-events-none" />
            </div>
          </div>
          <label className="inline-flex items-center gap-1.5 text-slate-500">
            <Calendar className="w-3.5 h-3.5" />
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="bg-transparent focus:outline-none text-slate-600" />
          </label>
          <input value={responsable} onChange={(e) => setResponsable(e.target.value)} placeholder="responsable (opcional)" className="flex-1 min-w-[120px] bg-transparent text-slate-600 placeholder:text-slate-300 focus:outline-none" />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2 mb-3 text-xs">
        {(['all', 'pending', 'done'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-2.5 py-1 rounded-lg transition ${filter === f ? 'bg-violet-100 text-violet-700 font-medium' : 'text-slate-500 hover:bg-slate-100'}`}>
            {f === 'all' ? 'Todas' : f === 'pending' ? `Pendientes (${pendingCount})` : 'Hechas'}
          </button>
        ))}
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/40 py-10 text-center">
          <p className="text-sm text-slate-500">{items.length === 0 ? 'Sin pendientes. Agrega el primero arriba.' : 'Nada en este filtro.'}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {filtered.map((it) => {
              const done = it.status === 'DONE' || !!it.completedAt
              const p = prio(it.metadata?.priority)
              const resp = it.metadata?.responsable
              return (
                <motion.div key={it.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                  className="group flex items-center gap-3 rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition px-4 py-3">
                  <button onClick={() => onToggle(it)} className="flex-shrink-0">
                    {done ? <Check className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-slate-300" />}
                  </button>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.dot}`} />
                  <span className={`text-sm flex-1 ${done ? 'line-through text-slate-400' : 'text-slate-800'}`}>{it.title}</span>
                  {resp && <span className="text-[11px] text-slate-400">{resp}</span>}
                  {it.dueDate && <span className="text-[11px] text-slate-400 inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(it.dueDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>}
                  <button onClick={() => onDelete(it)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
