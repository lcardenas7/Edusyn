import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Star, Search, Check, Circle, Trash2, BookOpen, Users2, Lightbulb, Phone, AlertTriangle, Tag as TagIcon,
} from 'lucide-react'

export interface BitacoraItem {
  id: string
  title: string
  content?: string | null
  entryType?: string | null
  isImportant?: boolean
  status?: string | null
  completedAt?: string | null
  tags?: string[]
  createdAt?: string
}

interface BitacoraModuleProps {
  items: BitacoraItem[]
  onCreate: (data: { title: string; entryType: string; isImportant: boolean; tags: string[] }) => Promise<void>
  onToggleImportant: (item: BitacoraItem) => Promise<void>
  onToggleResolved: (item: BitacoraItem) => Promise<void>
  onDelete: (item: BitacoraItem) => Promise<void>
}

const ENTRY_TYPES = [
  { key: 'clase', label: 'Clase', icon: BookOpen, color: 'text-blue-600 bg-blue-50' },
  { key: 'reunion', label: 'Reunión', icon: Users2, color: 'text-violet-600 bg-violet-50' },
  { key: 'idea', label: 'Idea', icon: Lightbulb, color: 'text-amber-600 bg-amber-50' },
  { key: 'llamada', label: 'Llamada', icon: Phone, color: 'text-emerald-600 bg-emerald-50' },
  { key: 'incidente', label: 'Incidente', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
  { key: 'otro', label: 'Otro', icon: Circle, color: 'text-slate-600 bg-slate-100' },
]
const typeDef = (k?: string | null) => ENTRY_TYPES.find((t) => t.key === k) ?? ENTRY_TYPES[5]

type StateFilter = 'all' | 'important' | 'pending' | 'resolved'

export function BitacoraModule({ items, onCreate, onToggleImportant, onToggleResolved, onDelete }: BitacoraModuleProps) {
  const [text, setText] = useState('')
  const [entryType, setEntryType] = useState('clase')
  const [important, setImportant] = useState(false)
  const [tagsRaw, setTagsRaw] = useState('')
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [stateFilter, setStateFilter] = useState<StateFilter>('all')
  const [sortDesc, setSortDesc] = useState(true)

  const allTags = useMemo(() => {
    const s = new Set<string>()
    items.forEach((i) => (i.tags ?? []).forEach((t) => s.add(t)))
    return Array.from(s)
  }, [items])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let out = items.filter((i) => {
      if (typeFilter !== 'all' && (i.entryType ?? 'otro') !== typeFilter) return false
      const isResolved = i.status === 'DONE' || !!i.completedAt
      if (stateFilter === 'important' && !i.isImportant) return false
      if (stateFilter === 'pending' && isResolved) return false
      if (stateFilter === 'resolved' && !isResolved) return false
      if (q) {
        const hay = `${i.title} ${i.content ?? ''} ${(i.tags ?? []).join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
    out = out.sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return sortDesc ? db - da : da - db
    })
    return out
  }, [items, search, typeFilter, stateFilter, sortDesc])

  const submit = async () => {
    if (!text.trim() || saving) return
    setSaving(true)
    try {
      const tags = tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
      await onCreate({ title: text.trim(), entryType, isImportant: important, tags })
      setText(''); setImportant(false); setTagsRaw('')
    } catch { /* parent handles */ } finally { setSaving(false) }
  }

  return (
    <div className="pb-28">
      {/* Composer */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-5">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {ENTRY_TYPES.map((t) => {
            const Icon = t.icon
            const on = entryType === t.key
            return (
              <button key={t.key} type="button" onClick={() => setEntryType(t.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition ${on ? t.color : 'text-slate-500 hover:bg-slate-100'}`}>
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            )
          })}
        </div>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() } }}
          placeholder="Escribe la entrada del diario…"
          rows={2}
          className="w-full resize-none text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TagIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="etiquetas, separadas, por comas"
              className="flex-1 min-w-0 text-xs text-slate-600 placeholder:text-slate-300 focus:outline-none bg-transparent" />
          </div>
          <button type="button" onClick={() => setImportant((v) => !v)} title="Importante"
            className={`p-1.5 rounded-lg transition ${important ? 'text-amber-500 bg-amber-50' : 'text-slate-400 hover:bg-slate-100'}`}>
            <Star className="w-4 h-4" fill={important ? 'currentColor' : 'none'} />
          </button>
          <button type="button" onClick={submit} disabled={!text.trim() || saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition disabled:opacity-40">
            {saving ? 'Guardando…' : 'Guardar'} {!saving && <Send className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:border-violet-400 focus:outline-none" />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-white">
          <option value="all">Todo tipo</option>
          {ENTRY_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value as StateFilter)}
          className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-white">
          <option value="all">Todo estado</option>
          <option value="important">Importantes</option>
          <option value="pending">Pendientes</option>
          <option value="resolved">Resueltas</option>
        </select>
        <button onClick={() => setSortDesc((v) => !v)} className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-slate-600">
          {sortDesc ? 'Recientes' : 'Antiguas'}
        </button>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/40 py-10 text-center">
          <p className="text-sm text-slate-500">
            {items.length === 0 ? 'Tu diario está en blanco. Escribe la primera entrada arriba.' : 'Nada coincide con el filtro.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {filtered.map((it, idx) => {
              const td = typeDef(it.entryType)
              const Icon = td.icon
              const resolved = it.status === 'DONE' || !!it.completedAt
              return (
                <motion.div key={it.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                  className={`group rounded-2xl border p-4 transition ${resolved ? 'bg-emerald-50/30 border-emerald-100' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${td.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2">
                        <p className={`text-sm font-medium flex-1 ${resolved ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{it.title}</p>
                        {it.isImportant && <Star className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" fill="currentColor" />}
                      </div>
                      {it.content && <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap line-clamp-3">{it.content}</p>}
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-400">
                        <span>{td.label}</span>
                        {it.createdAt && <span>{new Date(it.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>}
                        {(it.tags ?? []).map((t) => <span key={t} className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">#{t}</span>)}
                      </div>
                    </div>
                    {/* Acciones */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                      <button onClick={() => onToggleImportant(it)} title="Importante" className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-amber-500">
                        <Star className="w-3.5 h-3.5" fill={it.isImportant ? 'currentColor' : 'none'} />
                      </button>
                      <button onClick={() => onToggleResolved(it)} title={resolved ? 'Reabrir' : 'Resolver'} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-emerald-500">
                        {resolved ? <Circle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => onDelete(it)} title="Eliminar" className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
