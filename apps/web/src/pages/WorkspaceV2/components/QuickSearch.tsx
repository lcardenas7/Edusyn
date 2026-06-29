import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Loader2, CornerDownLeft, BookOpen, Eye, Coins, UserCog, FolderOpen, Rocket, ListChecks, StickyNote, Pin } from 'lucide-react'
import { teacherWorkspaceApi } from '../../../lib/api'

interface Result {
  type: string; label: string; title: string
  boardId?: string | null; boardTitle?: string; boardEmoji?: string | null; module?: string | null
}

const ICON: Record<string, any> = {
  item: BookOpen, collection: Coins, charge: Coins, role: UserCog, resource: FolderOpen,
  followup: Pin, project: Rocket,
}
const moduleIcon = (mod?: string | null) => ({ observaciones: Eye, lista: ListChecks, notas: StickyNote, tablero: ListChecks, recaudo: Coins, roles: UserCog, recursos: FolderOpen, proyecto: Rocket, bitacora: BookOpen } as any)[mod || ''] || BookOpen

export function QuickSearch({ floating = true }: { floating?: boolean }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Atajo global ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setOpen((v) => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); else { setQ(''); setResults([]); setActive(0) } }, [open])

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current)
    if (q.trim().length < 2) { setResults([]); return }
    debounce.current = setTimeout(() => {
      setLoading(true)
      teacherWorkspaceApi.globalSearch(q.trim())
        .then((res) => { setResults(res.data?.results ?? []); setActive(0) })
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 250)
  }, [q])

  const go = useCallback((r: Result) => {
    setOpen(false)
    if (r.boardId) navigate(`/my-workspace/${r.boardId}${r.module ? `?module=${r.module}` : ''}`)
  }, [navigate])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    if (e.key === 'Enter' && results[active]) { e.preventDefault(); go(results[active]) }
  }

  return (
    <>
      {/* Botón flotante / disparador (oculto donde estorbaría, ej. barra de captura) */}
      {floating && (
        <button onClick={() => setOpen(true)} title="Buscar (Cmd/Ctrl + K)"
          className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-white border border-slate-200 shadow-lg hover:shadow-xl text-slate-500 text-sm transition">
          <Search className="w-4 h-4" />
          <span className="hidden sm:inline">Buscar</span>
          <kbd className="hidden sm:inline text-[10px] bg-slate-100 rounded px-1.5 py-0.5 text-slate-400">⌘K</kbd>
        </button>
      )}

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12 }}
              className="fixed left-1/2 -translate-x-1/2 top-[12vh] z-50 w-[92vw] max-w-xl">
              <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
                  <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
                    placeholder="Busca en todo: estudiantes, notas, recaudos, proyectos…"
                    className="flex-1 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none" />
                  {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-300" />}
                </div>
                <div className="max-h-[55vh] overflow-y-auto">
                  {q.trim().length < 2 ? (
                    <p className="text-xs text-slate-400 text-center py-8">Escribe al menos 2 letras.</p>
                  ) : results.length === 0 && !loading ? (
                    <p className="text-xs text-slate-400 text-center py-8">Sin resultados para "{q}".</p>
                  ) : (
                    <div className="p-2">
                      {results.map((r, i) => {
                        const Icon = r.module ? moduleIcon(r.module) : (ICON[r.type] || BookOpen)
                        return (
                          <button key={i} onMouseEnter={() => setActive(i)} onClick={() => go(r)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition ${active === i ? 'bg-violet-50' : 'hover:bg-slate-50'}`}>
                            <Icon className={`w-4 h-4 flex-shrink-0 ${active === i ? 'text-violet-600' : 'text-slate-400'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-slate-800 truncate">{r.title}</p>
                              <p className="text-[11px] text-slate-400">{r.label}{r.boardTitle ? ` · ${r.boardEmoji ?? ''} ${r.boardTitle}` : ''}</p>
                            </div>
                            {active === i && <CornerDownLeft className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400 flex items-center gap-3">
                  <span>↑↓ navegar</span><span>↵ abrir</span><span>esc cerrar</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
