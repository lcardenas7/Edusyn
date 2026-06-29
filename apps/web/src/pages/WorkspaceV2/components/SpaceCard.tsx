import { motion } from 'framer-motion'
import { Pin, Archive, Trash2 } from 'lucide-react'
import { resolveIdentity } from '../utils/defaultIdentity'
import { activeModules, MODULES } from '../modules/moduleRegistry'

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
  isCourseSpace?: boolean
  enabledModules?: string[]
  itemsCount?: number
  updatedAt?: string
}

interface SpaceCardProps {
  board: SpaceCardBoard
  index: number
  onClick: () => void
  onDelete?: (board: SpaceCardBoard) => void
}

export function SpaceCard({ board, index, onClick, onDelete }: SpaceCardProps) {
  const identity = resolveIdentity(board)

  // Módulos integrados en este espacio (no solo el del tipo del contenedor).
  // Así una tarjeta de curso muestra todo lo que tiene adentro: 💰 🎭 📖…
  const moduleKeys = activeModules(
    { type: board.type, enabledModules: board.enabledModules },
    [],
  )
  const modules = moduleKeys.map((k) => MODULES[k])

  const open = () => onClick()

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open() } }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: 'easeOut' }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.98 }}
      className="group text-left relative overflow-hidden rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-shadow cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-400"
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

        {/* Acciones (arriba derecha) */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {board.isPinned && (
            <span className="bg-white/90 backdrop-blur-sm rounded-full p-1 shadow-sm">
              <Pin className="w-3 h-3 text-slate-700" fill="currentColor" />
            </span>
          )}
          {onDelete && !board.isPersonal && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(board) }}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-sm text-slate-500 hover:text-red-600 transition"
              aria-label={`Eliminar espacio ${board.title}`}
              title="Eliminar espacio"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Emoji grande flotando */}
        <div className="absolute -bottom-5 left-4">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-md flex items-center justify-center text-2xl ring-1 ring-slate-100">
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

        {/* Módulos integrados — chips con el emoji de cada uno */}
        {modules.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {modules.map((m) => (
              <span
                key={m.key}
                className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-500"
                title={m.label}
              >
                <span className="text-xs leading-none">{m.emoji}</span>
                {m.label}
              </span>
            ))}
          </div>
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
    </motion.div>
  )
}
