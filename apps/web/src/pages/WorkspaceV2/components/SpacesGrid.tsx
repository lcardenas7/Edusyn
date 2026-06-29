import { motion } from 'framer-motion'
import { Plus, Sparkles } from 'lucide-react'
import { SpaceCard, type SpaceCardBoard } from './SpaceCard'

interface SpacesGridProps {
  boards: SpaceCardBoard[]
  onOpenBoard: (id: string) => void
  onCreateBoard: () => void
}

export function SpacesGrid({ boards, onOpenBoard, onCreateBoard }: SpacesGridProps) {
  if (boards.length === 0) {
    return <EmptyState onCreateBoard={onCreateBoard} />
  }

  // Pinned primero, después por updatedAt desc
  const sorted = [...boards].sort((a, b) => {
    if ((a.isPinned ? 1 : 0) !== (b.isPinned ? 1 : 0)) return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)
    const aDate = a.updatedAt ? new Date(a.updatedAt).getTime() : 0
    const bDate = b.updatedAt ? new Date(b.updatedAt).getTime() : 0
    return bDate - aDate
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
          Mis espacios
        </h2>
        <button
          type="button"
          onClick={onCreateBoard}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-800 transition"
        >
          <Plus className="w-4 h-4" /> Nuevo espacio
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sorted.map((board, idx) => (
          <SpaceCard
            key={board.id}
            board={board}
            index={idx}
            onClick={() => onOpenBoard(board.id)}
          />
        ))}
      </div>
    </div>
  )
}

function EmptyState({ onCreateBoard }: { onCreateBoard: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 px-6 py-16 text-center"
    >
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-100 mb-4">
        <Sparkles className="w-8 h-8 text-violet-600" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-1">Aún no tienes espacios</h3>
      <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">
        Un espacio es un lugar donde organizas todo lo de un curso o un proyecto:
        bitácoras, observaciones, listas, ideas. Empecemos por el primero.
      </p>
      <button
        type="button"
        onClick={onCreateBoard}
        className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-semibold rounded-xl shadow-md shadow-violet-500/30 hover:shadow-lg transition"
      >
        <Plus className="w-4 h-4" /> Crear mi primer espacio
      </button>
    </motion.div>
  )
}
