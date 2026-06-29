import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Archive, Loader2, RotateCcw, Trash2, X } from 'lucide-react'
import { teacherWorkspaceApi } from '../../../lib/api'
import { resolveIdentity } from '../utils/defaultIdentity'
import { toast } from '../../../lib/toast'

interface ArchivedBoard {
  id: string
  title: string
  type: string
  emoji?: string | null
  color?: string | null
  _count?: { items?: number }
}

interface ArchivedSpacesModalProps {
  open: boolean
  onClose: () => void
  /** Se llama cuando algo cambió (restaurar/eliminar) para que el home recargue. */
  onChanged: () => void
}

export function ArchivedSpacesModal({ open, onClose, onChanged }: ArchivedSpacesModalProps) {
  const [boards, setBoards] = useState<ArchivedBoard[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    teacherWorkspaceApi.listBoards({ isArchived: 'true' })
      .then((res) => setBoards(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { if (open) load() }, [open, load])

  const restore = async (b: ArchivedBoard) => {
    setBusyId(b.id)
    try {
      await teacherWorkspaceApi.updateBoard(b.id, { isArchived: false })
      setBoards((prev) => prev.filter((x) => x.id !== b.id))
      onChanged()
      toast.success('Espacio restaurado', `“${b.title}” volvió a tu lista.`)
    } catch (e: any) { toast.error(e) } finally { setBusyId(null) }
  }

  const removeForever = async (b: ArchivedBoard) => {
    setBusyId(b.id)
    try {
      await teacherWorkspaceApi.deleteBoard(b.id, true)
      setBoards((prev) => prev.filter((x) => x.id !== b.id))
      setConfirmDel(null)
      onChanged()
      toast.success('Espacio eliminado', `“${b.title}” se eliminó definitivamente.`)
    } catch (e: any) { toast.error(e) } finally { setBusyId(null) }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-slate-500" />
                <h3 className="text-lg font-bold text-slate-900">Espacios archivados</h3>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 py-4 overflow-y-auto">
              <p className="text-xs text-slate-500 mb-4">
                Cuando eliminas un espacio con contenido, llega aquí (no se pierde).
                Puedes <strong>restaurarlo</strong> o <strong>eliminarlo definitivamente</strong>.
              </p>

              {loading ? (
                <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300 mx-auto" /></div>
              ) : boards.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 py-10 text-center">
                  <Archive className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No tienes espacios archivados.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {boards.map((b) => {
                    const identity = resolveIdentity(b)
                    const items = b._count?.items ?? 0
                    return (
                      <div key={b.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-lg flex-shrink-0">{identity.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{b.title}</p>
                          <p className="text-[11px] text-slate-400">{items} {items === 1 ? 'elemento' : 'elementos'}</p>
                        </div>
                        {confirmDel === b.id ? (
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => removeForever(b)} disabled={busyId === b.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold disabled:opacity-50">
                              {busyId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Sí, eliminar
                            </button>
                            <button onClick={() => setConfirmDel(null)} className="px-2 py-1 text-xs text-slate-400">No</button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button onClick={() => restore(b)} disabled={busyId === b.id} title="Restaurar"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-medium hover:bg-violet-100 transition disabled:opacity-50">
                              <RotateCcw className="w-3.5 h-3.5" /> Restaurar
                            </button>
                            <button onClick={() => setConfirmDel(b.id)} title="Eliminar definitivamente"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
