import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Plus, X, Trash2, GripVertical } from 'lucide-react'
import { teacherWorkspaceApi } from '../../../lib/api'

interface Card { id: string; title: string; columnId?: string | null; metadata?: any }
interface Column { id: string; title: string; items: Card[] }

const DEFAULT_COLUMNS = ['Ideas', 'Pendientes', 'En proceso', 'Finalizado']
const CARD_COLORS = ['', 'bg-amber-50 border-amber-200', 'bg-blue-50 border-blue-200', 'bg-emerald-50 border-emerald-200', 'bg-rose-50 border-rose-200', 'bg-violet-50 border-violet-200']

export function TableroModule({ boardId }: { boardId: string }) {
  const [columns, setColumns] = useState<Column[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [cardText, setCardText] = useState('')
  const [addingColumn, setAddingColumn] = useState(false)
  const [columnName, setColumnName] = useState('')
  const [dragCard, setDragCard] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await teacherWorkspaceApi.getBoard(boardId)
      const cols: Column[] = (res.data?.columns ?? []).map((c: any) => ({
        id: c.id, title: c.title,
        items: (c.items ?? []).filter((i: any) => i.metadata?.kanban).sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
      }))
      setColumns(cols)
    } catch { /* noop */ } finally { setLoading(false) }
  }, [boardId])
  useEffect(() => { load() }, [load])

  const seedColumns = async () => {
    setSeeding(true)
    try {
      for (const name of DEFAULT_COLUMNS) await teacherWorkspaceApi.createColumn({ boardId, title: name })
      await load()
    } finally { setSeeding(false) }
  }

  const addCard = async (columnId: string) => {
    if (!cardText.trim()) return
    await teacherWorkspaceApi.createItem({ boardId, columnId, title: cardText.trim(), metadata: { kanban: true } })
    setCardText(''); setAddingTo(null); load()
  }
  const delCard = async (id: string) => { await teacherWorkspaceApi.deleteItem(id); load() }
  const addColumn = async () => { if (!columnName.trim()) return; await teacherWorkspaceApi.createColumn({ boardId, title: columnName.trim() }); setColumnName(''); setAddingColumn(false); load() }
  const delColumn = async (id: string) => { await teacherWorkspaceApi.deleteColumn(id); load() }
  const setColor = async (card: Card, color: string) => {
    await teacherWorkspaceApi.updateItem(card.id, { metadata: { ...(card.metadata || {}), kanban: true, color } })
    setColumns((prev) => prev.map((c) => ({ ...c, items: c.items.map((it) => it.id === card.id ? { ...it, metadata: { ...it.metadata, color } } : it) })))
  }

  const onDrop = async (columnId: string) => {
    const cardId = dragCard
    setDragCard(null); setDragOver(null)
    if (!cardId) return
    const from = columns.find((c) => c.items.some((i) => i.id === cardId))
    if (from?.id === columnId) return
    // optimista
    setColumns((prev) => {
      const card = prev.flatMap((c) => c.items).find((i) => i.id === cardId)
      if (!card) return prev
      return prev.map((c) => c.id === columnId
        ? { ...c, items: [...c.items, card] }
        : { ...c, items: c.items.filter((i) => i.id !== cardId) })
    })
    try {
      const target = columns.find((c) => c.id === columnId)
      await teacherWorkspaceApi.moveItem(cardId, { columnId, sortOrder: (target?.items.length ?? 0) * 100 + 100 })
    } catch { load() }
  }

  if (loading) return <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300 mx-auto" /></div>

  if (columns.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/40 py-12 text-center">
        <p className="text-sm text-slate-500 mb-3">Tablero vacío. Crea las columnas para empezar.</p>
        <button onClick={seedColumns} disabled={seeding} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-50">
          {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Crear tablero (Ideas · Pendientes · En proceso · Finalizado)
        </button>
      </div>
    )
  }

  return (
    <div className="pb-10 overflow-x-auto">
      <div className="flex gap-3 min-w-max">
        {columns.map((col) => (
          <div key={col.id}
            onDragOver={(e) => { e.preventDefault(); setDragOver(col.id) }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => onDrop(col.id)}
            className={`w-64 flex-shrink-0 rounded-2xl p-3 transition ${dragOver === col.id ? 'bg-violet-50 ring-2 ring-violet-200' : 'bg-slate-50/70'}`}>
            <div className="group flex items-center justify-between mb-2 px-1">
              <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wide">{col.title}</h3>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400">{col.items.length}</span>
                <button onClick={() => delColumn(col.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>

            <div className="space-y-2 min-h-[8px]">
              <AnimatePresence initial={false}>
                {col.items.map((card) => (
                  <motion.div key={card.id} layout initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    draggable onDragStart={() => setDragCard(card.id)} onDragEnd={() => { setDragCard(null); setDragOver(null) }}
                    className={`group rounded-xl border p-2.5 cursor-grab active:cursor-grabbing transition ${card.metadata?.color || 'bg-white border-slate-200'} ${dragCard === card.id ? 'opacity-50' : ''}`}>
                    <div className="flex items-start gap-1.5">
                      <GripVertical className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-700 flex-1">{card.title}</p>
                      <button onClick={() => delCard(card.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                    </div>
                    {/* Colores */}
                    <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition pl-5">
                      {CARD_COLORS.map((c, i) => (
                        <button key={i} onClick={() => setColor(card, c)} className={`w-3.5 h-3.5 rounded-full border ${c || 'bg-white border-slate-300'}`} />
                      ))}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Agregar card */}
            {addingTo === col.id ? (
              <div className="mt-2">
                <textarea autoFocus value={cardText} onChange={(e) => setCardText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addCard(col.id) } }}
                  rows={2} placeholder="Texto de la tarjeta…" className="w-full text-sm border border-slate-200 rounded-lg p-2 resize-none focus:outline-none focus:border-violet-400" />
                <div className="flex gap-1.5 mt-1">
                  <button onClick={() => addCard(col.id)} disabled={!cardText.trim()} className="px-2.5 py-1 rounded-lg bg-violet-600 text-white text-xs font-semibold disabled:opacity-40">Agregar</button>
                  <button onClick={() => { setAddingTo(null); setCardText('') }} className="px-2 py-1 text-xs text-slate-400">Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setAddingTo(col.id); setCardText('') }} className="w-full mt-2 text-left text-xs text-slate-400 hover:text-slate-600 px-1 py-1.5 rounded-lg hover:bg-white/60 transition inline-flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Agregar tarjeta
              </button>
            )}
          </div>
        ))}

        {/* Agregar columna */}
        <div className="w-56 flex-shrink-0">
          {addingColumn ? (
            <div className="rounded-2xl bg-slate-50/70 p-3">
              <input autoFocus value={columnName} onChange={(e) => setColumnName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addColumn() }} placeholder="Nombre de columna" className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-violet-400" />
              <div className="flex gap-1.5 mt-1.5"><button onClick={addColumn} disabled={!columnName.trim()} className="px-2.5 py-1 rounded-lg bg-violet-600 text-white text-xs font-semibold disabled:opacity-40">Crear</button><button onClick={() => setAddingColumn(false)} className="px-2 py-1 text-xs text-slate-400">Cancelar</button></div>
            </div>
          ) : (
            <button onClick={() => setAddingColumn(true)} className="w-full rounded-2xl border-2 border-dashed border-slate-200 py-3 text-xs text-slate-400 hover:border-violet-300 hover:text-violet-500 transition inline-flex items-center justify-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Columna
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
