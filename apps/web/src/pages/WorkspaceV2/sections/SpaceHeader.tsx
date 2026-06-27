import { motion } from 'framer-motion'
import { ArrowLeft, Pin, MoreHorizontal, Users as UsersIcon } from 'lucide-react'
import { resolveIdentity } from '../utils/defaultIdentity'

interface SpaceHeaderBoard {
  id: string
  title: string
  description?: string | null
  type: string
  emoji?: string | null
  color?: string | null
  coverImage?: string | null
  isPinned?: boolean
  isPersonal?: boolean
  group?: { name?: string | null; grade?: { name?: string | null } | null } | null
  itemsCount?: number
}

interface SpaceHeaderProps {
  board: SpaceHeaderBoard
  onBack: () => void
}

export function SpaceHeader({ board, onBack }: SpaceHeaderProps) {
  const identity = resolveIdentity(board)

  const subtitle: string[] = []
  if (board.group?.name) subtitle.push(board.group.name)
  if (board.group?.grade?.name && board.group.grade.name !== board.group?.name) subtitle.push(board.group.grade.name)
  if (typeof board.itemsCount === 'number') subtitle.push(`${board.itemsCount} ${board.itemsCount === 1 ? 'elemento' : 'elementos'}`)

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="mb-6"
    >
      {/* Breadcrumb */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition mb-4"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Mi Espacio
      </button>

      {/* Banner */}
      <div
        className={`relative rounded-3xl overflow-hidden h-32 sm:h-40 mb-4 ${board.coverImage ? '' : 'bg-gradient-to-br ' + identity.bannerGradient}`}
        style={board.coverImage ? {
          backgroundImage: `url(${board.coverImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      >
        {board.coverImage && <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />}
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {board.isPinned && (
            <span className="bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-sm" aria-label="Espacio fijado">
              <Pin className="w-3.5 h-3.5 text-slate-700" fill="currentColor" />
            </span>
          )}
          <button
            type="button"
            className="bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-sm hover:bg-white transition"
            aria-label="Opciones del espacio"
            title="Próximamente: personalizar este espacio"
          >
            <MoreHorizontal className="w-4 h-4 text-slate-700" />
          </button>
        </div>
      </div>

      {/* Title + emoji */}
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 flex items-center justify-center text-3xl flex-shrink-0 -mt-12 sm:-mt-14 ml-2">
          {identity.emoji}
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <h1
            className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight"
            style={{ fontFamily: 'Georgia, "Iowan Old Style", "Times New Roman", serif' }}
          >
            {board.title}
          </h1>
          {subtitle.length > 0 && (
            <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
              {board.group?.name && <UsersIcon className="w-3.5 h-3.5" />}
              <span>{subtitle.join(' · ')}</span>
            </div>
          )}
          {board.description && (
            <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
              {board.description}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
