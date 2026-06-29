import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pin, Plus, Check, Trash2, Loader2, X, Clock } from 'lucide-react'
import { teacherWorkspaceApi } from '../../../lib/api'

interface FollowUp {
  id: string
  title: string
  notes?: string | null
  dueDate?: string | null
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE'
  board?: { id: string; title: string; emoji?: string | null } | null
}

function dueLabel(due?: string | null): { text: string; tone: string } | null {
  if (!due) return null
  const d = new Date(due)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return { text: `vencido hace ${Math.abs(diff)}d`, tone: 'text-red-600' }
  if (diff === 0) return { text: 'vence hoy', tone: 'text-orange-600' }
  if (diff === 1) return { text: 'mañana', tone: 'text-amber-600' }
  return { text: `en ${diff}d`, tone: 'text-slate-400' }
}

export function FollowUpsPanel({ onOpenSpace }: { onOpenSpace?: (id: string) => void }) {
  const [items, setItems] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    teacherWorkspaceApi.listFollowUps()
      .then((res) => setItems(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const add = async () => {
    if (!newTitle.trim()) return
    setSaving(true)
    try {
      await teacherWorkspaceApi.createFollowUp({ title: newTitle.trim() })
      setNewTitle(''); setAdding(false); load()
    } catch { /* noop */ } finally { setSaving(false) }
  }
  const resolve = async (f: FollowUp) => {
    await teacherWorkspaceApi.updateFollowUp(f.id, { status: 'DONE' })
    setItems((prev) => prev.filter((x) => x.id !== f.id))
  }
  const remove = async (f: FollowUp) => {
    await teacherWorkspaceApi.deleteFollowUp(f.id)
    setItems((prev) => prev.filter((x) => x.id !== f.id))
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Pin className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-bold text-slate-800">Seguimientos</h3>
          {items.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 font-medium">{items.length}</span>
          )}
        </div>
        <button onClick={() => setAdding((v) => !v)} className="text-violet-600 hover:text-violet-800" aria-label="Nuevo seguimiento">
          {adding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {adding && (
        <div className="flex items-center gap-2 mb-3">
          <input
            autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add() }}
            placeholder="¿Qué necesitas hacer seguimiento?"
            className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-violet-400 focus:ring-1 focus:ring-violet-400 focus:outline-none"
          />
          <button onClick={add} disabled={saving || !newTitle.trim()} className="px-2.5 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold disabled:opacity-40">
            {saving ? '…' : 'Crear'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center"><Loader2 className="w-4 h-4 animate-spin text-slate-300 mx-auto" /></div>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">Sin seguimientos abiertos. Todo bajo control. ✨</p>
      ) : (
        <div className="space-y-1 max-h-72 overflow-y-auto">
          <AnimatePresence initial={false}>
            {items.map((f) => {
              const due = dueLabel(f.dueDate)
              return (
                <motion.div
                  key={f.id}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8, height: 0 }}
                  className="group flex items-start gap-2 rounded-lg hover:bg-slate-50 px-2 py-1.5"
                >
                  <button onClick={() => resolve(f)} className="mt-0.5 flex-shrink-0" title="Marcar como resuelto">
                    <span className="w-4 h-4 rounded-full border-2 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 inline-flex items-center justify-center transition">
                      <Check className="w-2.5 h-2.5 text-transparent group-hover:text-emerald-500" strokeWidth={3} />
                    </span>
                  </button>
                  <button
                    onClick={() => f.board && onOpenSpace?.(f.board.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <p className="text-sm text-slate-700 truncate">{f.title}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      {f.board && <span>{f.board.emoji} {f.board.title}</span>}
                      {due && <span className={`inline-flex items-center gap-0.5 ${due.tone}`}><Clock className="w-2.5 h-2.5" /> {due.text}</span>}
                    </div>
                  </button>
                  <button onClick={() => remove(f)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition mt-0.5" title="Eliminar">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
