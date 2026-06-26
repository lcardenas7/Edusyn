import { motion } from 'framer-motion'
import { Pin, Archive } from 'lucide-react'
import { resolveIdentity } from '../utils/defaultIdentity'

export interface SpaceCardBoard {
  id: string
  title: string
  description?: string | null
  type: string
  emoji?: string | null
  color?: string | null
  coverImage?: string | null
  isPinned?: boolean
  isPersonal?: boolean
  isArchived?: boolean
  itemsCount?: number
  updatedAt?: string
}

interface SpaceCardProps {
  board: SpaceCardBoard
  index: number
  onClick: () => void
}

export function SpaceCard({ board, index, onClick }: SpaceCardProps) {
  const identity = resolveIdentity(board)

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: 'easeOut' }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.98 }}
      className="group text-left relative overflow-hidden rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-shadow"
      aria-label={`Abrir espacio ${board.title}`}
    >
      {/* Banner superior (cover image o gradiente) */}
      <div
        className={`h-20 relative ${board.coverImage ? '' : 'bg-gradient-to-br ' + identity.bannerGradient}`}
        style={board.coverImage ? {
          backgroundImage: `url(${board.coverImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      >
        {/* Overlay sutil para legibilidad */}
        {board.coverImage && <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />}

        {/* Pin si está fijado */}
        {board.isPinned && (
          <span className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full p-1 shadow-sm">
            <Pin className="w-3 h-3 text-slate-700" fill="currentColor" />
          </span>
        )}

        {/* Emoji grande flotando */}
        <div className="absolute -bottom-5 left-4">
          <div
            className="w-12 h-12 rounded-2xl bg-white shadow-md flex items-center justify-center text-2xl ring-1 ring-slate-100"
          >
            {identity.emoji}
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="pt-8 pb-4 px-4">
        <h3 className="font-bold text-slate-900 text-base leading-tight line-clamp-1">
          {board.title}
        </h3>
        {board.description && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-snug">
            {board.description}
          </p>
        )}

        {/* Footer con stats */}
        <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
          {typeof board.itemsCount === 'number' && (
            <span>{board.itemsCount} {board.itemsCount === 1 ? 'elemento' : 'elementos'}</span>
          )}
          {board.isPersonal && (
            <span className="text-violet-600 font-medium">Personal</span>
          )}
          {board.isArchived && (
            <span className="flex items-center gap-1 text-slate-400">
              <Archive className="w-3 h-3" /> archivado
            </span>
          )}
        </div>
      </div>
    </motion.button>
  )
}
