// ═══════════════════════════════════════════════════════════════════════════
// ANIMAL AVATARS - Cute cartoon animals for Live Quiz
// ═══════════════════════════════════════════════════════════════════════════

import { motion } from 'framer-motion'

// Avatar definitions with SVG paths
export const ANIMAL_AVATARS = [
  { id: 'wolf', name: 'Lobo', emoji: '🐺', color: '#64748b' },
  { id: 'giraffe', name: 'Jirafa', emoji: '🦒', color: '#f59e0b' },
  { id: 'bear', name: 'Oso', emoji: '🐻', color: '#92400e' },
  { id: 'fox', name: 'Zorro', emoji: '🦊', color: '#ea580c' },
  { id: 'owl', name: 'Búho', emoji: '🦉', color: '#78716c' },
  { id: 'lion', name: 'León', emoji: '🦁', color: '#d97706' },
  { id: 'panda', name: 'Panda', emoji: '🐼', color: '#1f2937' },
  { id: 'cat', name: 'Gato', emoji: '🐱', color: '#f97316' },
  { id: 'dog', name: 'Perro', emoji: '🐶', color: '#a16207' },
  { id: 'rabbit', name: 'Conejo', emoji: '🐰', color: '#fbbf24' },
  { id: 'koala', name: 'Koala', emoji: '🐨', color: '#6b7280' },
  { id: 'tiger', name: 'Tigre', emoji: '🐯', color: '#ea580c' },
  { id: 'penguin', name: 'Pingüino', emoji: '🐧', color: '#1e293b' },
  { id: 'monkey', name: 'Mono', emoji: '🐵', color: '#a16207' },
  { id: 'elephant', name: 'Elefante', emoji: '🐘', color: '#64748b' },
  { id: 'unicorn', name: 'Unicornio', emoji: '🦄', color: '#c026d3' },
  { id: 'dragon', name: 'Dragón', emoji: '🐲', color: '#16a34a' },
  { id: 'shark', name: 'Tiburón', emoji: '🦈', color: '#475569' },
  { id: 'octopus', name: 'Pulpo', emoji: '🐙', color: '#db2777' },
  { id: 'butterfly', name: 'Mariposa', emoji: '🦋', color: '#0ea5e9' },
]

export type AvatarId = typeof ANIMAL_AVATARS[number]['id']

// Get avatar by ID
export function getAvatar(id: string) {
  return ANIMAL_AVATARS.find(a => a.id === id) || ANIMAL_AVATARS[0]
}

// Get random avatar
export function getRandomAvatar() {
  return ANIMAL_AVATARS[Math.floor(Math.random() * ANIMAL_AVATARS.length)]
}

// Get avatar from name hash (consistent per user)
export function getAvatarFromName(name: string): typeof ANIMAL_AVATARS[0] {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return ANIMAL_AVATARS[Math.abs(hash) % ANIMAL_AVATARS.length]
}

// ═══════════════════════════════════════════════════════════════════════════
// AVATAR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface AvatarProps {
  avatarId?: string
  name?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  showName?: boolean
  animate?: boolean
  mood?: 'happy' | 'sad' | 'neutral'
  className?: string
}

const sizeClasses = {
  sm: 'w-8 h-8 text-lg',
  md: 'w-12 h-12 text-2xl',
  lg: 'w-16 h-16 text-3xl',
  xl: 'w-20 h-20 text-4xl',
  '2xl': 'w-28 h-28 text-5xl',
}

export function AnimalAvatar({ 
  avatarId, 
  name = '', 
  size = 'md', 
  showName = false,
  animate = false,
  mood = 'neutral',
  className = ''
}: AvatarProps) {
  const avatar = avatarId ? getAvatar(avatarId) : getAvatarFromName(name)
  
  const moodAnimation = {
    happy: { y: [0, -5, 0], transition: { repeat: 2, duration: 0.3 } },
    sad: { rotate: [0, -5, 5, -5, 0], transition: { duration: 0.5 } },
    neutral: {}
  }

  return (
    <div className={`flex flex-col items-center gap-1 ${className}`}>
      <motion.div
        className={`${sizeClasses[size]} rounded-2xl flex items-center justify-center shadow-lg`}
        style={{ 
          backgroundColor: avatar.color,
          boxShadow: `0 4px 14px ${avatar.color}40`
        }}
        animate={animate ? moodAnimation[mood] : {}}
        whileHover={animate ? { scale: 1.1, rotate: [0, -5, 5, 0] } : {}}
      >
        <span className="drop-shadow-md">{avatar.emoji}</span>
      </motion.div>
      {showName && (
        <span className="text-white font-bold text-sm truncate max-w-[100px]">{name}</span>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// AVATAR SELECTOR
// ═══════════════════════════════════════════════════════════════════════════

interface AvatarSelectorProps {
  selected: string
  onSelect: (id: string) => void
}

export function AvatarSelector({ selected, onSelect }: AvatarSelectorProps) {
  return (
    <div className="grid grid-cols-5 gap-3 p-4 bg-white/5 rounded-2xl max-h-[300px] overflow-y-auto">
      {ANIMAL_AVATARS.map(avatar => (
        <motion.button
          key={avatar.id}
          type="button"
          onClick={() => onSelect(avatar.id)}
          className={`p-2 rounded-xl transition-all ${
            selected === avatar.id 
              ? 'ring-2 ring-cyan-400 bg-cyan-500/20 scale-110' 
              : 'hover:bg-white/10'
          }`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mx-auto"
            style={{ backgroundColor: avatar.color }}
          >
            {avatar.emoji}
          </div>
          <p className="text-white/60 text-xs mt-1 truncate">{avatar.name}</p>
        </motion.button>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PODIUM COMPONENT (for final results) - Blooket style with dramatic reveal
// ═══════════════════════════════════════════════════════════════════════════

interface PodiumEntry {
  name: string
  avatarId?: string
  score: number
  rank: number
}

interface PodiumProps {
  entries: PodiumEntry[]
}

export function Podium({ entries }: PodiumProps) {
  // Dramatic reveal order: 3rd → 2nd → 1st
  // Display order: 2nd (left), 1st (center), 3rd (right)
  const podiumOrder = entries.length === 1
    ? [entries[0]].filter(Boolean)
    : [
        entries[1], // 2nd place (left)
        entries[0], // 1st place (center, tallest)
        entries[2], // 3rd place (right)
      ].filter(Boolean)

  // Reveal delays based on how many participants we have
  // With 3: 3rd (0s) → 2nd (1.5s) → 1st (3s)
  // With 2: 2nd (0s) → 1st (1.5s)
  // With 1: 1st (0s)
  const getRevealDelay = (displayIdx: number): number => {
    const count = entries.length
    if (count === 1) return 0 // Only 1st place, show immediately
    if (count === 2) {
      // 2nd appears first, then 1st
      return displayIdx === 0 ? 0 : 1.5 // [2nd=0s, 1st=1.5s]
    }
    // Full 3 participants: 3rd → 2nd → 1st
    return [1.5, 3, 0][displayIdx] // [2nd=1.5s, 1st=3s, 3rd=0s]
  }
  
  // Podium colors matching Blooket style
  const podiumColors = { 1: '#f97316', 2: '#9333ea', 3: '#22c55e' } // 1st, 2nd, 3rd
  const ribbonColors = { 1: '#3b82f6', 2: '#ec4899', 3: '#22c55e' } // 1st, 2nd, 3rd
  const podiumHeights = { 1: 160, 2: 112, 3: 80 } // 1st, 2nd, 3rd in pixels

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6 py-6 min-h-[280px]">
      {podiumOrder.map((entry, displayIdx) => {
        if (!entry) return null
        const actualRank = entry.rank
        const avatar = entry.avatarId ? getAvatar(entry.avatarId) : getAvatarFromName(entry.name)
        const delay = getRevealDelay(displayIdx)
        
        return (
          <motion.div
            key={entry.name}
            className="flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.5, y: 100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ 
              delay, 
              duration: 0.8, 
              type: 'spring', 
              bounce: 0.5 
            }}
          >
            {/* Avatar on pedestal */}
            <motion.div
              className="relative"
              initial={{ y: -50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: delay + 0.3, duration: 0.5, type: 'spring' }}
            >
              {/* Crown for 1st place */}
              {actualRank === 1 && (
                <motion.div 
                  className="absolute -top-8 left-1/2 -translate-x-1/2 text-4xl z-10"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: delay + 0.6, duration: 0.5, type: 'spring', bounce: 0.6 }}
                >
                  👑
                </motion.div>
              )}
              
              {/* Avatar */}
              <motion.div 
                className={`${actualRank === 1 ? 'w-24 h-24 text-5xl' : 'w-16 h-16 text-3xl'} rounded-2xl flex items-center justify-center shadow-2xl border-4 border-white/30`}
                style={{ 
                  backgroundColor: avatar.color,
                  boxShadow: `0 8px 32px ${avatar.color}60`
                }}
                animate={actualRank === 1 ? { y: [0, -6, 0] } : {}}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut', delay: delay + 1 }}
              >
                {avatar.emoji}
              </motion.div>
            </motion.div>

            {/* Name ribbon - Blooket style */}
            <motion.div 
              className="relative mt-2 z-10"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: delay + 0.4, duration: 0.3 }}
            >
              <div 
                className="w-[110px] sm:w-[150px] px-3 py-2 rounded-lg shadow-lg relative"
                title={entry.name}
                style={{ backgroundColor: ribbonColors[actualRank as 1 | 2 | 3] }}
              >
                {/* Ribbon tails */}
                <div 
                  className="absolute -left-3 top-1/2 -translate-y-1/2 w-0 h-0"
                  style={{
                    borderTop: '10px solid transparent',
                    borderRight: `12px solid ${ribbonColors[actualRank as 1 | 2 | 3]}`,
                    borderBottom: '10px solid transparent',
                  }}
                />
                <div 
                  className="absolute -right-3 top-1/2 -translate-y-1/2 w-0 h-0"
                  style={{
                    borderTop: '10px solid transparent',
                    borderLeft: `12px solid ${ribbonColors[actualRank as 1 | 2 | 3]}`,
                    borderBottom: '10px solid transparent',
                  }}
                />
                <p className="text-white font-black text-sm sm:text-base leading-tight text-center whitespace-normal break-all">
                  {entry.name}
                </p>
              </div>
            </motion.div>

            {/* Score */}
            <motion.p 
              className="text-white/90 text-sm font-bold mt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + 0.5 }}
            >
              Score: {entry.score.toLocaleString()}
            </motion.p>

            {/* Podium block - Blooket style */}
            <motion.div
              className="w-24 sm:w-28 mt-2 rounded-t-2xl flex items-end justify-center shadow-2xl relative overflow-hidden"
              style={{ 
                backgroundColor: podiumColors[actualRank as 1 | 2 | 3],
                height: podiumHeights[actualRank as 1 | 2 | 3]
              }}
              initial={{ height: 0 }}
              animate={{ height: podiumHeights[actualRank as 1 | 2 | 3] }}
              transition={{ delay: delay + 0.1, duration: 0.6, type: 'spring', bounce: 0.3 }}
            >
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0" />
              
              {/* Rank number */}
              <motion.span 
                className="text-white font-black text-4xl sm:text-5xl drop-shadow-lg pb-3"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: delay + 0.5, type: 'spring', bounce: 0.5 }}
              >
                {actualRank}<sup className="text-xl">{actualRank === 1 ? 'st' : actualRank === 2 ? 'nd' : 'rd'}</sup>
              </motion.span>
            </motion.div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// CIRCULAR TIMER
// ═══════════════════════════════════════════════════════════════════════════

interface CircularTimerProps {
  timeLeft: number
  totalTime: number
  size?: number
}

export function CircularTimer({ timeLeft, totalTime, size = 80 }: CircularTimerProps) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const progress = timeLeft / totalTime
  const strokeDashoffset = circumference * (1 - progress)
  
  const isUrgent = timeLeft <= 5
  const color = isUrgent ? '#ef4444' : timeLeft <= 10 ? '#f59e0b' : '#22c55e'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Background circle */}
      <svg className="absolute inset-0 -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="6"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          animate={isUrgent ? { scale: [1, 1.05, 1] } : {}}
          transition={isUrgent ? { repeat: Infinity, duration: 0.5 } : {}}
        />
      </svg>
      
      {/* Time text */}
      <motion.div 
        className="absolute inset-0 flex items-center justify-center"
        animate={isUrgent ? { scale: [1, 1.1, 1] } : {}}
        transition={isUrgent ? { repeat: Infinity, duration: 0.5 } : {}}
      >
        <span 
          className="font-black text-2xl"
          style={{ color }}
        >
          {timeLeft}
        </span>
      </motion.div>
    </div>
  )
}

export default AnimalAvatar
