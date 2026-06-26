import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { teacherWorkspaceApi } from '../../lib/api'
import { Greeting } from './components/Greeting'
import { SpacesGrid } from './components/SpacesGrid'
import type { SpaceCardBoard } from './components/SpaceCard'

/**
 * WorkspaceV2 — Nueva pantalla principal de Mi Espacio Docente.
 *
 * Acceso: ruta /my-workspace-v2, gateada por flag de URL.
 *   - Si VITE_WORKSPACE_V2=true → siempre disponible (dev/staging).
 *   - En prod, solo entra quien conoce la URL hasta que el rollout abra.
 *
 * Reutiliza el endpoint /teacher-workspace/boards existente.
 * No reemplaza /my-workspace todavía.
 */
export default function WorkspaceV2Page() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [boards, setBoards] = useState<SpaceCardBoard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    teacherWorkspaceApi
      .listBoards({ isArchived: 'false' })
      .then((res) => {
        if (!mounted) return
        const raw: any[] = Array.isArray(res.data) ? res.data : res.data?.boards ?? []
        const mapped: SpaceCardBoard[] = raw.map((b) => ({
          id: b.id,
          title: b.title,
          description: b.description ?? null,
          type: b.type,
          emoji: b.emoji ?? null,
          color: b.color ?? null,
          coverImage: b.coverImage ?? null,
          isPinned: Boolean(b.isPinned),
          isPersonal: Boolean(b.isPersonal),
          isArchived: Boolean(b.isArchived),
          itemsCount: b._count?.items ?? b.items?.length ?? undefined,
          updatedAt: b.updatedAt,
        }))
        setBoards(mapped)
      })
      .catch((e: any) => {
        if (!mounted) return
        const msg = e?.response?.data?.message || e?.message || 'No se pudieron cargar tus espacios.'
        setError(msg)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  const teacherFirstName = (user as any)?.firstName || (user as any)?.fullName?.split(' ')?.[0] || null

  return (
    <div
      className="min-h-screen px-4 sm:px-8 py-8"
      style={{
        background: 'linear-gradient(180deg, #FAF8F3 0%, #F5F1E8 100%)',
      }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Volver a la versión clásica */}
        <button
          type="button"
          onClick={() => navigate('/my-workspace')}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a la versión clásica
        </button>

        {/* Header */}
        <Greeting name={teacherFirstName} spacesCount={boards.length} />

        {/* Contenido */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-sm">Cargando tus espacios…</span>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          <SpacesGrid
            boards={boards}
            onOpenBoard={(id) => {
              // Por ahora redirige a la UI vieja del board específico.
              // Sprint 3 implementará la vista nueva de espacio de curso.
              navigate(`/my-workspace?board=${id}`)
            }}
            onCreateBoard={() => {
              // Por ahora redirige a la UI vieja que ya sabe crear.
              navigate('/my-workspace?create=true')
            }}
          />
        )}

        {/* Sello de versión */}
        <div className="mt-12 text-center text-[10px] text-slate-300 tracking-widest uppercase">
          Mi Espacio Docente · vista previa v2
        </div>
      </div>
    </div>
  )
}
