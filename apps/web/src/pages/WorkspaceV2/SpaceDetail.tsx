import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { teacherWorkspaceApi } from '../../lib/api'
import { SpaceHeader } from './sections/SpaceHeader'
import { SectionTabs, type SectionKey, SECTION_TABS } from './sections/SectionTabs'
import { Section, filterForSection, type SectionItem } from './sections/Section'
import { CaptureBar } from './sections/CaptureBar'

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
  group?: any
  columns?: Array<{ id: string; items: SectionItem[] }>
  items?: SectionItem[]
}

// Mapeo: para los items capturados desde la barra inferior, el "kind" se infiere
// de la pestaña activa. La UI vieja sigue funcionando porque ignora kind.
const KIND_BY_SECTION: Record<SectionKey, string> = {
  log:          'LOG',
  observations: 'OBSERVATION',
  collection:   'COLLECTION',
  roles:        'TASK',
  resources:    'FILE',
}

// Para boards de tipo específico, abrir directamente en la pestaña natural.
const DEFAULT_SECTION_BY_BOARD_TYPE: Record<string, SectionKey> = {
  CLASS_LOG:       'log',
  STUDENT_NOTES:   'observations',
  MICRO_COLLECT:   'collection',
  CLASSROOM_ROLES: 'roles',
  KANBAN:          'log',
  CHECKLIST:       'log',
  PROJECT:         'log',
}

export default function SpaceDetailPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const navigate = useNavigate()

  const [board, setBoard] = useState<BoardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<SectionKey>('log')
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Cargar board
  useEffect(() => {
    if (!boardId) return
    let mounted = true
    setLoading(true)
    teacherWorkspaceApi
      .getBoard(boardId)
      .then((res) => {
        if (!mounted) return
        setBoard(res.data as BoardData)
        // Abrir en la pestaña natural según tipo del board
        const defaultSection = DEFAULT_SECTION_BY_BOARD_TYPE[res.data?.type] || 'log'
        setActiveSection(defaultSection)
      })
      .catch((e: any) => {
        if (!mounted) return
        const msg = e?.response?.data?.message || e?.message || 'No se pudo cargar el espacio.'
        setError(msg)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [boardId])

  // Flatten de items (columnas + libres)
  const allItems: SectionItem[] = useMemo(() => {
    if (!board) return []
    const fromColumns = (board.columns ?? []).flatMap((c) => c.items ?? [])
    const free = board.items ?? []
    return [...free, ...fromColumns]
  }, [board])

  // Usa la misma lógica que el render para que badges y listas coincidan siempre.
  const counts = useMemo(() => {
    const result: Partial<Record<SectionKey, number>> = {}
    for (const tab of SECTION_TABS) {
      result[tab.key] = filterForSection(allItems, tab.key, board?.type).length
    }
    return result
  }, [allItems, board?.type])

  // Actualizar un item existente (usado por la pestaña Recaudo para fijar monto y registrar pagos).
  // Después del PUT re-fetcheamos el board para reflejar el cambio en la lista.
  const handleUpdateItem = useCallback(async (
    itemId: string,
    patch: { metadata?: any; title?: string; content?: string },
  ): Promise<void> => {
    if (!board) return
    await teacherWorkspaceApi.updateItem(itemId, patch)
    const fresh = await teacherWorkspaceApi.getBoard(board.id)
    setBoard(fresh.data as BoardData)
  }, [board])

  // Crear item desde la barra de captura
  const handleCapture = useCallback(async (text: string): Promise<void> => {
    if (!board) return
    setSubmitError(null)
    try {
      await teacherWorkspaceApi.createItem({
        boardId: board.id,
        title: text.slice(0, 200),
        content: text.length > 200 ? text : undefined,
        metadata: { capturedFromV2: true, kind: KIND_BY_SECTION[activeSection] },
      })
      // Optimistic: re-fetch para reflejar el item nuevo
      const fresh = await teacherWorkspaceApi.getBoard(board.id)
      setBoard(fresh.data as BoardData)
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'No se pudo guardar. Intenta de nuevo.'
      setSubmitError(msg)
      throw e
    }
  }, [board, activeSection])

  // Loading state
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(180deg, #FAF8F3 0%, #F5F1E8 100%)' }}
      >
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando tu espacio…</span>
        </div>
      </div>
    )
  }

  if (error || !board) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'linear-gradient(180deg, #FAF8F3 0%, #F5F1E8 100%)' }}
      >
        <div className="max-w-md text-center">
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            {error || 'No encontramos este espacio.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/my-workspace-v2')}
            className="text-sm text-violet-600 hover:text-violet-800"
          >
            ← Volver a Mi Espacio
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen px-4 sm:px-8 py-8 pb-32"
      style={{ background: 'linear-gradient(180deg, #FAF8F3 0%, #F5F1E8 100%)' }}
    >
      <div className="max-w-4xl mx-auto">
        <SpaceHeader
          board={{ ...board, itemsCount: allItems.length }}
          onBack={() => navigate('/my-workspace-v2')}
        />

        <SectionTabs
          active={activeSection}
          onChange={setActiveSection}
          counts={counts}
        />

        {/* Contenido de la pestaña activa con transición */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <Section
              sectionKey={activeSection}
              items={allItems}
              boardType={board?.type}
              loading={loading}
              onUpdateItem={handleUpdateItem}
            />
          </motion.div>
        </AnimatePresence>

        {submitError && (
          <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {submitError}
          </p>
        )}

        <CaptureBar sectionKey={activeSection} onSubmit={handleCapture} />
      </div>
    </div>
  )
}
