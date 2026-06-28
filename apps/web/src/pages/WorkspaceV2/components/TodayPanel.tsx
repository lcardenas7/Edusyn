import { motion } from 'framer-motion'
import { Sun, CalendarClock, Pin, Coins, AlertTriangle, CheckCircle2 } from 'lucide-react'

export interface TodayData {
  pendingItems: Array<{ id: string; title: string; dueDate?: string | null; boardId: string; boardTitle?: string; boardEmoji?: string }>
  events: Array<{ id: string; title: string; date: string; type: string }>
  followUps: Array<{ id: string; title: string; dueDate?: string | null; board?: { id: string; title: string } | null }>
  recaudo: { pendingCount: number; pendingAmount: number }
  insights: { staleSpaces: Array<{ id: string; title: string; emoji?: string | null; lastActivity?: string }>; tooManyFollowUps: boolean }
  counts: { spaces: number; pendingItems: number; events: number; followUps: number }
}

function money(n: number) {
  return '$' + (n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })
}

function summaryLine(d: TodayData): string {
  const parts: string[] = []
  if (d.counts.followUps) parts.push(`${d.counts.followUps} ${d.counts.followUps === 1 ? 'seguimiento' : 'seguimientos'}`)
  if (d.counts.events) parts.push(`${d.counts.events} ${d.counts.events === 1 ? 'evento' : 'eventos'}`)
  if (d.recaudo.pendingCount) parts.push(`${d.recaudo.pendingCount} recaudo${d.recaudo.pendingCount === 1 ? '' : 's'} por cobrar`)
  if (d.counts.pendingItems) parts.push(`${d.counts.pendingItems} pendiente${d.counts.pendingItems === 1 ? '' : 's'}`)
  if (parts.length === 0) return 'Sin pendientes para hoy. Día despejado. ☀️'
  return 'Hoy tienes ' + parts.join(' · ') + '.'
}

interface TodayPanelProps {
  data: TodayData
  onOpenSpace: (id: string) => void
}

export function TodayPanel({ data, onOpenSpace }: TodayPanelProps) {
  const empty =
    data.counts.followUps === 0 && data.counts.events === 0 &&
    data.recaudo.pendingCount === 0 && data.counts.pendingItems === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className="rounded-2xl bg-white border border-slate-200 p-5 mb-6"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center flex-shrink-0">
          <Sun className="w-5 h-5 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">{summaryLine(data)}</p>

          {!empty && (
            <div className="mt-3 space-y-1.5">
              {/* Seguimientos */}
              {data.followUps.slice(0, 3).map((f) => (
                <Row key={f.id} icon={<Pin className="w-3.5 h-3.5 text-violet-500" />} text={f.title}
                     meta={f.board?.title} onClick={f.board ? () => onOpenSpace(f.board!.id) : undefined} />
              ))}
              {/* Eventos */}
              {data.events.slice(0, 3).map((e) => (
                <Row key={e.id} icon={<CalendarClock className="w-3.5 h-3.5 text-blue-500" />} text={e.title}
                     meta={new Date(e.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} />
              ))}
              {/* Recaudo */}
              {data.recaudo.pendingCount > 0 && (
                <Row icon={<Coins className="w-3.5 h-3.5 text-amber-500" />}
                     text={`${data.recaudo.pendingCount} recaudo(s) por cobrar`} meta={money(data.recaudo.pendingAmount)} />
              )}
              {/* Pendientes con fecha */}
              {data.pendingItems.slice(0, 3).map((i) => (
                <Row key={i.id} icon={<CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />} text={i.title}
                     meta={i.boardTitle} onClick={() => onOpenSpace(i.boardId)} />
              ))}
            </div>
          )}

          {/* Inteligencia funcional */}
          {(data.insights.staleSpaces.length > 0 || data.insights.tooManyFollowUps) && (
            <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
              {data.insights.tooManyFollowUps && (
                <Row icon={<AlertTriangle className="w-3.5 h-3.5 text-orange-500" />}
                     text="Tienes muchos seguimientos abiertos. Quizá conviene cerrar algunos." />
              )}
              {data.insights.staleSpaces.map((s) => (
                <Row key={s.id} icon={<AlertTriangle className="w-3.5 h-3.5 text-orange-400" />}
                     text={`${s.emoji ?? '📌'} ${s.title}: sin actividad hace tiempo`}
                     onClick={() => onOpenSpace(s.id)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function Row({ icon, text, meta, onClick }: { icon: React.ReactNode; text: string; meta?: string; onClick?: () => void }) {
  const inner = (
    <div className="flex items-center gap-2 text-sm">
      <span className="flex-shrink-0">{icon}</span>
      <span className="text-slate-700 truncate flex-1">{text}</span>
      {meta && <span className="text-[11px] text-slate-400 flex-shrink-0">{meta}</span>}
    </div>
  )
  if (onClick) {
    return <button type="button" onClick={onClick} className="w-full text-left hover:bg-slate-50 rounded-lg px-1.5 py-1 -mx-1.5 transition">{inner}</button>
  }
  return <div className="px-1.5 py-1">{inner}</div>
}
