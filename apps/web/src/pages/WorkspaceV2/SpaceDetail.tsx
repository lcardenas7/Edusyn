import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, ArrowLeft, Clock, LayoutGrid } from 'lucide-react'
import { teacherWorkspaceApi } from '../../lib/api'
import { SpaceHeader } from './sections/SpaceHeader'
import { type SectionKey } from './sections/SectionTabs'
import { Section, filterForSection, type SectionItem } from './sections/Section'
import { CaptureBar } from './sections/CaptureBar'
import { MODULES, activeModules, type ModuleKey } from './modules/moduleRegistry'
import { ModuleGrid } from './modules/ModuleGrid'
import { ActivateModuleSheet } from './modules/ActivateModuleSheet'
import { BitacoraModule, type BitacoraItem } from './modules/BitacoraModule'
import { RecaudoModule } from './modules/RecaudoModule'
import { RolesModule } from './modules/RolesModule'

interface BoardData {
  id: string
  title: string
  description?: string | null
  type: string
  emoji?: string | null
  color?: string | null
  coverImage?: string | null
  isPinned?: boolean
  isPersonal?: boolean
  enabledModules?: string[]
  group?: any
  columns?: Array<{ id: string; items: SectionItem[] }>
  items?: SectionItem[]
  updatedAt?: string
}

const KIND_BY_SECTION: Record<SectionKey, string> = {
  log: 'LOG', observations: 'OBSERVATION', collection: 'COLLECTION', roles: 'TASK', resources: 'FILE',
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '—'
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

export default function SpaceDetailPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()

  const [board, setBoard] = useState<BoardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openModule, setOpenModule] = useState<ModuleKey | null>(null)
  const [activateOpen, setActivateOpen] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!boardId) return
    let mounted = true
    setLoading(true)
    teacherWorkspaceApi.getBoard(boardId)
      .then((res) => { if (mounted) setBoard(res.data as BoardData) })
      .catch((e: any) => { if (mounted) setError(e?.response?.data?.message || e?.message || 'No se pudo cargar el espacio.') })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [boardId])

  const allItems: SectionItem[] = useMemo(() => {
    if (!board) return []
    const fromColumns = (board.columns ?? []).flatMap((c) => c.items ?? [])
    return [...(board.items ?? []), ...fromColumns]
  }, [board])

  const moduleKeys = useMemo(
    () => (board ? activeModules(board, allItems) : []),
    [board, allItems],
  )

  // Conteo por módulo (reusa filterForSection para los módulos con sección)
  const moduleCounts = useMemo(() => {
    const result: Partial<Record<ModuleKey, number>> = {}
    for (const key of moduleKeys) {
      const sk = MODULES[key].sectionKey
      result[key] = sk ? filterForSection(allItems, sk, board?.type).length : 0
    }
    return result
  }, [moduleKeys, allItems, board?.type])

  const refresh = useCallback(async () => {
    if (!board) return
    const fresh = await teacherWorkspaceApi.getBoard(board.id)
    setBoard(fresh.data as BoardData)
  }, [board])

  const handleUpdateItem = useCallback(async (itemId: string, patch: { metadata?: any; title?: string; content?: string }) => {
    await teacherWorkspaceApi.updateItem(itemId, patch)
    await refresh()
  }, [refresh])

  const activeSection: SectionKey | null = openModule ? MODULES[openModule].sectionKey ?? null : null

  const handleCapture = useCallback(async (
    text: string,
    opts?: { eventDate?: string; followUp?: boolean; followUpDue?: string },
  ): Promise<void> => {
    if (!board || !activeSection) return
    setSubmitError(null)
    try {
      const created = await teacherWorkspaceApi.createItem({
        boardId: board.id,
        title: text.slice(0, 200),
        content: text.length > 200 ? text : undefined,
        metadata: { capturedFromV2: true, kind: KIND_BY_SECTION[activeSection] },
      })
      const itemId = created?.data?.id
      // Calendario: si el docente programó una fecha, evento ligado al registro.
      if (opts?.eventDate) {
        await teacherWorkspaceApi.createEvent({
          title: text.slice(0, 120), date: opts.eventDate,
          boardId: board.id, itemId, type: 'REMINDER',
        })
      }
      // Seguimiento: cualquier módulo puede generarlo (observación → seguimiento).
      if (opts?.followUp) {
        const sourceBySection: Record<string, string> = {
          log: 'BITACORA', observations: 'OBSERVATION', collection: 'COLLECTION', roles: 'TASK', resources: 'TASK',
        }
        await teacherWorkspaceApi.createFollowUp({
          title: text.slice(0, 120),
          boardId: board.id,
          sourceItemId: itemId,
          sourceType: sourceBySection[activeSection] || 'MANUAL',
          dueDate: opts.followUpDue,
        })
      }
      await refresh()
    } catch (e: any) {
      setSubmitError(e?.response?.data?.message || 'No se pudo guardar. Intenta de nuevo.')
      throw e
    }
  }, [board, activeSection, refresh])

  const handleActivateModule = useCallback(async (key: ModuleKey) => {
    if (!board) return
    const next = Array.from(new Set([...(board.enabledModules ?? []), key]))
    setActivateOpen(false)
    setBoard({ ...board, enabledModules: next })   // optimista
    try {
      await teacherWorkspaceApi.updateBoard(board.id, { enabledModules: next })
      setOpenModule(key)
    } catch {
      await refresh()
    }
  }, [board, refresh])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #FAF8F3 0%, #F5F1E8 100%)' }}>
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-sm">Cargando tu espacio…</span>
        </div>
      </div>
    )
  }

  if (error || !board) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(180deg, #FAF8F3 0%, #F5F1E8 100%)' }}>
        <div className="max-w-md text-center">
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">{error || 'No encontramos este espacio.'}</p>
          <button type="button" onClick={() => navigate('/my-workspace-v2')} className="text-sm text-violet-600 hover:text-violet-800">← Volver a Mi Espacio</button>
        </div>
      </div>
    )
  }

  const openModuleDef = openModule ? MODULES[openModule] : null

  return (
    <div className="min-h-screen px-4 sm:px-8 py-8 pb-32" style={{ background: 'linear-gradient(180deg, #FAF8F3 0%, #F5F1E8 100%)' }}>
      <div className="max-w-4xl mx-auto">
        <SpaceHeader board={{ ...board, itemsCount: allItems.length }} onBack={() => navigate('/my-workspace-v2')} />

        {/* Mini-dashboard del curso */}
        <div className="flex flex-wrap gap-3 mb-6 -mt-2">
          <Metric label="Registros" value={String(allItems.length)} />
          <Metric label="Módulos activos" value={String(moduleKeys.length)} icon={<LayoutGrid className="w-3.5 h-3.5" />} />
          <Metric label="Última actividad" value={timeAgo(board.updatedAt)} icon={<Clock className="w-3.5 h-3.5" />} />
        </div>

        <AnimatePresence mode="wait">
          {!openModule ? (
            // Vista de módulos del curso
            <motion.div key="grid" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              <ModuleGrid
                activeKeys={moduleKeys}
                counts={moduleCounts}
                onOpen={(k) => setOpenModule(k)}
                onActivate={() => setActivateOpen(true)}
              />
            </motion.div>
          ) : (
            // Contenido de un módulo
            <motion.div key={`mod-${openModule}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              <button type="button" onClick={() => setOpenModule(null)} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-3">
                <ArrowLeft className="w-3.5 h-3.5" /> Módulos
              </button>
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-9 h-9 rounded-xl ${openModuleDef!.iconBg} flex items-center justify-center text-lg`}>{openModuleDef!.emoji}</div>
                <h2 className="text-lg font-bold text-slate-900">{openModuleDef!.label}</h2>
              </div>

              {openModule === 'recaudo' ? (
                <RecaudoModule boardId={board.id} />
              ) : openModule === 'roles' ? (
                <RolesModule boardId={board.id} />
              ) : openModule === 'bitacora' ? (
                <BitacoraModule
                  items={filterForSection(allItems, 'log', board.type) as BitacoraItem[]}
                  onCreate={async (data) => {
                    await teacherWorkspaceApi.createItem({
                      boardId: board.id, title: data.title,
                      entryType: data.entryType, isImportant: data.isImportant, tags: data.tags,
                      metadata: { capturedFromV2: true, kind: 'LOG' },
                    })
                    await refresh()
                  }}
                  onToggleImportant={async (it) => { await teacherWorkspaceApi.updateItem(it.id, { isImportant: !it.isImportant }); await refresh() }}
                  onToggleResolved={async (it) => {
                    const resolved = it.status === 'DONE' || !!it.completedAt
                    await teacherWorkspaceApi.updateItem(it.id, { status: resolved ? 'TODO' : 'DONE' })
                    await refresh()
                  }}
                  onDelete={async (it) => { await teacherWorkspaceApi.deleteItem(it.id); await refresh() }}
                />
              ) : activeSection ? (
                <>
                  <Section sectionKey={activeSection} items={allItems} boardType={board.type} onUpdateItem={handleUpdateItem} />
                  {submitError && <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{submitError}</p>}
                  <CaptureBar sectionKey={activeSection} onSubmit={handleCapture} />
                </>
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/40 py-12 text-center">
                  <p className="text-sm text-slate-500">El módulo <span className="font-semibold">{openModuleDef!.label}</span> llega en su fase. 🚧</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ActivateModuleSheet
        open={activateOpen}
        activeKeys={moduleKeys}
        onClose={() => setActivateOpen(false)}
        onActivate={handleActivateModule}
      />
    </div>
  )
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-white/70 border border-slate-200 rounded-xl px-3 py-2 min-w-[100px]">
      <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">{icon}{label}</p>
      <p className="text-sm font-bold text-slate-800 mt-0.5">{value}</p>
    </div>
  )
}
