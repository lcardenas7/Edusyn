import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ArrowLeft, Archive } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { teacherWorkspaceApi } from '../../lib/api'
import { Greeting } from './components/Greeting'
import { SpacesGrid } from './components/SpacesGrid'
import type { SpaceCardBoard } from './components/SpaceCard'
import { CreateSpaceModal } from './components/CreateSpaceModal'
import { DeleteSpaceModal } from './components/DeleteSpaceModal'
import { ArchivedSpacesModal } from './components/ArchivedSpacesModal'
import { toast } from '../../lib/toast'
import { TodayPanel, type TodayData } from './components/TodayPanel'
import { MiniCalendar } from './components/MiniCalendar'
import { FollowUpsPanel } from './components/FollowUpsPanel'
import { RecentActivityPanel } from './components/RecentActivityPanel'
import { QuickSearch } from './components/QuickSearch'

/**
 * WorkspaceV2 — Dashboard "Centro del día" de Mi Espacio Docente.
 * Usa el endpoint agregado /teacher-workspace/today (una sola tanda de queries).
 */
export default function WorkspaceV2Page() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [boards, setBoards] = useState<SpaceCardBoard[]>([])
  const [today, setToday] = useState<TodayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [deletingBoard, setDeletingBoard] = useState<SpaceCardBoard | null>(null)
  const [archivedOpen, setArchivedOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    return teacherWorkspaceApi
      .getToday()
      .then((res) => {
        const data = res.data
        const spaces: any[] = data?.spaces ?? []
        // El espacio personal se muestra como card aparte, no en el grid de cursos.
        setBoards(spaces.filter((b) => !b.isPersonal).map((b) => ({
          id: b.id,
          title: b.title,
          description: null,
          type: b.type,
          emoji: b.emoji ?? null,
          color: b.color ?? null,
          coverImage: null,
          isPinned: Boolean(b.isPinned),
          isPersonal: Boolean(b.isPersonal),
          isArchived: false,
          isCourseSpace: Boolean(b.isCourseSpace),
          enabledModules: b.enabledModules ?? [],
          itemsCount: b.itemsCount,
          updatedAt: b.updatedAt,
        })))
        setToday(data as TodayData)
      })
      .catch((e: any) => {
        setError(e?.response?.data?.message || e?.message || 'No se pudo cargar tu espacio.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleDeleteBoard = async (board: SpaceCardBoard) => {
    try {
      const res = await teacherWorkspaceApi.deleteBoard(board.id)
      const archived = res.data?.archived
      // Quitar la tarjeta de inmediato (en ambos casos desaparece del grid)
      setBoards((prev) => prev.filter((b) => b.id !== board.id))
      setDeletingBoard(null)
      if (archived) {
        toast.success('Espacio archivado', `“${board.title}” se archivó. Sus datos están a salvo.`)
      } else {
        toast.success('Espacio eliminado', `“${board.title}” estaba vacío y se eliminó.`)
      }
    } catch (e: any) {
      toast.error(e)
    }
  }

  const teacherFirstName = (user as any)?.firstName || (user as any)?.fullName?.split(' ')?.[0] || null

  return (
    <div className="min-h-screen px-4 sm:px-8 py-8" style={{ background: 'linear-gradient(180deg, #FAF8F3 0%, #F5F1E8 100%)' }}>
      <div className="max-w-6xl mx-auto">
        <button
          type="button"
          onClick={() => navigate('/my-workspace')}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a la versión clásica
        </button>

        <Greeting name={teacherFirstName} spacesCount={boards.length} />

        {loading && (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-sm">Preparando tu día…</span>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start mb-6">
              <div className="lg:col-span-2 space-y-5">
                {today && <TodayPanel data={today} onOpenSpace={(id) => navigate(`/my-workspace-v2/${id}`)} />}
                {today && <RecentActivityPanel items={today.recentActivity ?? []} onOpenSpace={(id) => navigate(`/my-workspace-v2/${id}`)} />}
              </div>
              <div className="lg:col-span-1 space-y-5">
                <MiniCalendar />
                <FollowUpsPanel onOpenSpace={(id) => navigate(`/my-workspace-v2/${id}`)} />
              </div>
            </div>
            <SpacesGrid
              boards={boards}
              onOpenBoard={(id) => navigate(`/my-workspace-v2/${id}`)}
              onCreateBoard={() => setCreateOpen(true)}
              onDeleteBoard={(board) => setDeletingBoard(board)}
            />

            {/* Espacio personal — sin curso, siempre disponible */}
            <button
              type="button"
              onClick={async () => {
                try { const r = await teacherWorkspaceApi.getPersonalSpace(); navigate(`/my-workspace-v2/${r.data.id}`) } catch { /* noop */ }
              }}
              className="mt-4 w-full sm:w-auto inline-flex items-center gap-3 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-200 hover:border-violet-300 hover:shadow-sm transition px-4 py-3 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl">⭐</div>
              <div>
                <p className="text-sm font-bold text-slate-800">Mi espacio personal</p>
                <p className="text-xs text-slate-500">Notas, ideas, pendientes y archivos sin curso</p>
              </div>
            </button>

            {/* Acceso a espacios archivados */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setArchivedOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition"
              >
                <Archive className="w-3.5 h-3.5" /> Espacios archivados
              </button>
            </div>
          </>
        )}

        <div className="mt-12 text-center text-[10px] text-slate-300 tracking-widest uppercase">
          Mi Espacio Docente · vista previa v2
        </div>
      </div>

      <QuickSearch />

      <CreateSpaceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async (boardId) => {
          setCreateOpen(false)
          load()
          if (boardId) navigate(`/my-workspace-v2/${boardId}`)
        }}
      />

      <DeleteSpaceModal
        board={deletingBoard}
        onClose={() => setDeletingBoard(null)}
        onConfirm={handleDeleteBoard}
      />

      <ArchivedSpacesModal
        open={archivedOpen}
        onClose={() => setArchivedOpen(false)}
        onChanged={load}
      />
    </div>
  )
}
