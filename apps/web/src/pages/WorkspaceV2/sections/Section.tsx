import { motion, AnimatePresence } from 'framer-motion'
import { Inbox, CheckCircle2, Circle, Coins, Calendar } from 'lucide-react'
import type { SectionKey } from './SectionTabs'

export interface SectionItem {
  id: string
  title: string
  content?: string | null
  status?: string | null
  kind?: string | null
  dueDate?: string | null
  eventDate?: string | null
  completedAt?: string | null
  amount?: string | number | null
  amountCollected?: string | number | null
  student?: { id: string; firstName?: string | null; lastName?: string | null } | null
  metadata?: any
  createdAt?: string
  updatedAt?: string
}

interface SectionProps {
  sectionKey: SectionKey
  items: SectionItem[]
  loading?: boolean
}

// Filtra los items relevantes para la pestaña activa.
// Si el item tiene `kind` definido, se usa. Si no, se infiere por status/metadata o
// se considera "genérico" (visible solo en Bitácora si no encaja en otra parte).
function filterForSection(items: SectionItem[], key: SectionKey): SectionItem[] {
  return items.filter((item) => {
    const kind = item.kind?.toUpperCase()
    switch (key) {
      case 'log':
        // Bitácora: LOG, NOTE, eventos sin kind específico
        return kind === 'LOG' || kind === 'NOTE' || (!kind && !item.amount && !item.student)
      case 'observations':
        return kind === 'OBSERVATION' || (!kind && !!item.student && !item.amount)
      case 'collection':
        return kind === 'COLLECTION' || (!kind && (item.amount != null || item.amountCollected != null))
      case 'roles':
        return kind === 'TASK' && !!item.metadata?.role
      case 'resources':
        return kind === 'FILE' || kind === 'LIST' || (!!item.metadata?.url || !!item.metadata?.fileUrl)
      default:
        return false
    }
  })
}

export function Section({ sectionKey, items, loading }: SectionProps) {
  const filtered = filterForSection(items, sectionKey)

  if (loading) {
    return (
      <div className="py-10 text-center text-sm text-slate-400 animate-pulse">
        Cargando…
      </div>
    )
  }

  if (filtered.length === 0) {
    return <SectionEmpty sectionKey={sectionKey} />
  }

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {filtered.map((item, idx) => (
          <SectionRow key={item.id} item={item} index={idx} sectionKey={sectionKey} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function SectionRow({ item, index, sectionKey }: { item: SectionItem; index: number; sectionKey: SectionKey }) {
  const isDone = item.status === 'DONE' || !!item.completedAt
  const studentName = item.student ? `${item.student.firstName ?? ''} ${item.student.lastName ?? ''}`.trim() : null

  const date = item.eventDate || item.dueDate || item.createdAt
  const dateLabel = date ? new Date(date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index * 0.025, 0.3), duration: 0.2 }}
      className="group rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition p-4"
    >
      <div className="flex items-start gap-3">
        {/* Icono de estado */}
        <div className="pt-0.5 flex-shrink-0">
          {sectionKey === 'collection' ? (
            <Coins className="w-4 h-4 text-amber-500" />
          ) : isDone ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" fill="currentColor" />
          ) : (
            <Circle className="w-4 h-4 text-slate-300" />
          )}
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${isDone ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
            {item.title}
          </p>
          {item.content && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2 whitespace-pre-wrap">
              {item.content}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
            {studentName && (
              <span className="font-medium text-slate-500">{studentName}</span>
            )}
            {dateLabel && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {dateLabel}
              </span>
            )}
            {sectionKey === 'collection' && item.amount != null && (
              <span className="text-amber-600 font-medium">
                {formatMoney(item.amountCollected)} / {formatMoney(item.amount)}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function formatMoney(n: string | number | null | undefined): string {
  if (n == null) return '$0'
  const num = typeof n === 'number' ? n : parseFloat(String(n))
  if (isNaN(num)) return '$0'
  return '$' + num.toLocaleString('es-CO', { maximumFractionDigits: 0 })
}

function SectionEmpty({ sectionKey }: { sectionKey: SectionKey }) {
  const messages: Record<SectionKey, { title: string; hint: string }> = {
    log:          { title: 'Aún no hay bitácora',         hint: 'Empieza escribiendo cómo te fue en la última clase.' },
    observations: { title: 'Sin observaciones aún',       hint: 'Anota algo que viste en un estudiante hoy.' },
    collection:   { title: 'No hay recaudos abiertos',    hint: 'Registra un cobro pendiente para llevarle el control.' },
    roles:        { title: 'Sin roles asignados',         hint: 'Asigna roles del salón para organizar a tu grupo.' },
    resources:    { title: 'No hay recursos guardados',   hint: 'Guarda links, archivos o materiales que uses con este grupo.' },
  }
  const msg = messages[sectionKey]
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/40 py-10 px-6 text-center"
    >
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 mb-3">
        <Inbox className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-sm font-semibold text-slate-700">{msg.title}</p>
      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">{msg.hint}</p>
    </motion.div>
  )
}
