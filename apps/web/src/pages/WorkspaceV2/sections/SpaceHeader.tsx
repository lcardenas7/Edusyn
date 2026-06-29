import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Pin, Palette, Check, Users as UsersIcon } from 'lucide-react'
import { resolveIdentity } from '../utils/defaultIdentity'
import { HEADER_THEMES, getHeaderTheme } from '../utils/headerThemes'

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
  metadata?: any
  group?: { name?: string | null; grade?: { name?: string | null } | null } | null
  itemsCount?: number
}

interface SpaceHeaderProps {
  board: SpaceHeaderBoard
  onBack: () => void
  onChangeTheme?: (themeKey: string) => void
}

const GROUPS = ['Gradientes', 'Patrones', 'Sólidos'] as const

export function SpaceHeader({ board, onBack, onChangeTheme }: SpaceHeaderProps) {
  const identity = resolveIdentity(board)
  const [pickerOpen, setPickerOpen] = useState(false)

  const themeKey = board.metadata?.headerTheme as string | undefined
  const theme = getHeaderTheme(themeKey)

  const subtitle: string[] = []
  const courseName = [board.group?.grade?.name, board.group?.name].filter(Boolean).join(' ')
  if (courseName) subtitle.push(courseName)
  if (typeof board.itemsCount === 'number') subtitle.push(`${board.itemsCount} ${board.itemsCount === 1 ? 'elemento' : 'elementos'}`)

  // Fondo del banner: cover image > tema elegido > gradiente por defecto del tipo
  const bannerStyle = board.coverImage
    ? { backgroundImage: `url(${board.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : theme?.style
  const useDefaultGradient = !board.coverImage && !theme

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: 'easeOut' }} className="mb-6">
      {/* Breadcrumb */}
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition mb-3">
        <ArrowLeft className="w-3.5 h-3.5" /> Mi Espacio
      </button>

      {/* Banner con el ícono flotando POR ENCIMA (z-10), nada lo tapa */}
      <div className="relative">
        <div
          className={`relative rounded-3xl overflow-hidden h-20 sm:h-24 ${useDefaultGradient ? 'bg-gradient-to-br ' + identity.bannerGradient : ''}`}
          style={bannerStyle}
        >
          {board.coverImage && <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-2">
            {board.isPinned && (
              <span className="bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-sm" aria-label="Espacio fijado">
                <Pin className="w-3.5 h-3.5 text-slate-700" fill="currentColor" />
              </span>
            )}
            {onChangeTheme && (
              <button type="button" onClick={() => setPickerOpen((v) => !v)} title="Cambiar diseño del encabezado"
                className="bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-sm hover:bg-white transition">
                <Palette className="w-4 h-4 text-slate-700" />
              </button>
            )}
          </div>
        </div>
        {/* Ícono flotante — por encima del banner, esquina inferior izquierda */}
        <div className="absolute -bottom-5 left-4 z-10 w-14 h-14 rounded-2xl bg-white shadow-md ring-1 ring-slate-100 flex items-center justify-center text-3xl">
          {identity.emoji}
        </div>
      </div>

      {/* Título debajo, con sangría para dejar libre el ícono */}
      <div className="mt-7 pl-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight" style={{ fontFamily: 'Georgia, "Iowan Old Style", "Times New Roman", serif' }}>
          {board.title}
        </h1>
        {subtitle.length > 0 && (
          <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
            {board.group?.name && <UsersIcon className="w-3.5 h-3.5" />}
            <span>{subtitle.join(' · ')}</span>
          </div>
        )}
        {board.description && <p className="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">{board.description}</p>}
      </div>

      {/* Selector de diseños */}
      <AnimatePresence>
        {pickerOpen && onChangeTheme && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setPickerOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }}
              className="relative z-40 mt-3 rounded-2xl bg-white border border-slate-200 shadow-xl p-4"
            >
              <p className="text-sm font-bold text-slate-800 mb-3">Diseño del encabezado</p>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {GROUPS.map((g) => (
                  <div key={g}>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5">{g}</p>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {HEADER_THEMES.filter((t) => t.group === g).map((t) => {
                        const active = themeKey === t.key
                        return (
                          <button key={t.key} type="button" title={t.label}
                            onClick={() => { onChangeTheme(t.key); setPickerOpen(false) }}
                            className={`relative h-12 rounded-xl overflow-hidden ring-2 transition ${active ? 'ring-violet-500' : 'ring-transparent hover:ring-slate-200'}`}
                            style={t.style}>
                            {active && (
                              <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                                <Check className="w-4 h-4 text-white drop-shadow" strokeWidth={3} />
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
