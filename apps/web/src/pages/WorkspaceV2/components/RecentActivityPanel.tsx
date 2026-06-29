import { motion } from 'framer-motion'
import { History, BookOpen, Eye, Coins, ListChecks, FileText, StickyNote } from 'lucide-react'

export interface RecentActivityItem {
  id: string
  title: string
  kind?: string | null
  updatedAt: string
  boardId: string
  boardTitle?: string
  boardEmoji?: string | null
}

const KIND_META: Record<string, { label: string; icon: any; color: string }> = {
  LOG:         { label: 'Bitácora', icon: BookOpen, color: 'text-blue-500' },
  OBSERVATION: { label: 'Observación', icon: Eye, color: 'text-amber-500' },
  COLLECTION:  { label: 'Recaudo', icon: Coins, color: 'text-yellow-600' },
  TASK:        { label: 'Pendiente', icon: ListChecks, color: 'text-teal-500' },
  LIST:        { label: 'Lista', icon: ListChecks, color: 'text-teal-500' },
  FILE:        { label: 'Recurso', icon: FileText, color: 'text-emerald-500' },
  NOTE:        { label: 'Nota', icon: StickyNote, color: 'text-violet-500' },
  IDEA:        { label: 'Idea', icon: StickyNote, color: 'text-violet-500' },
}
const kindMeta = (k?: string | null) => KIND_META[(k || '').toUpperCase()] ?? { label: 'Elemento', icon: StickyNote, color: 'text-slate-400' }

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ayer'
  if (d < 30) return `hace ${d} días`
  return new Date(dateStr).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

export function RecentActivityPanel({ items, onOpenSpace }: { items: RecentActivityItem[]; onOpenSpace: (id: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.05 }}
      className="rounded-2xl bg-white border border-slate-200 p-5"
    >
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-slate-400" />
        <h3 className="text-sm font-bold text-slate-800">Actividad reciente</h3>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-400 py-3">Aún no hay actividad. Lo que registres aparecerá aquí.</p>
      ) : (
        <div className="space-y-0.5">
          {items.map((it) => {
            const m = kindMeta(it.kind)
            const Icon = m.icon
            return (
              <button
                key={it.id}
                onClick={() => onOpenSpace(it.boardId)}
                className="w-full text-left flex items-center gap-3 rounded-lg hover:bg-slate-50 px-2 py-2 transition"
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${m.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate">{it.title}</p>
                  <p className="text-[11px] text-slate-400">
                    {m.label} · {it.boardEmoji} {it.boardTitle}
                  </p>
                </div>
                <span className="text-[10px] text-slate-300 flex-shrink-0">{timeAgo(it.updatedAt)}</span>
              </button>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}
