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
// PODIUM COMPONENT (for final results)
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
  // Reorder for podium display: 2nd, 1st, 3rd
  const podiumOrder = [
    entries[1], // 2nd place (left)
    entries[0], // 1st place (center, tallest)
    entries[2], // 3rd place (right)
  ].filter(Boolean)

  const podiumHeights = ['h-28', 'h-40', 'h-20']
  const podiumColors = [
    'from-slate-400 to-slate-500', // Silver
    'from-yellow-400 to-amber-500', // Gold
    'from-amber-600 to-amber-700', // Bronze
  ]
  const ribbonColors = ['bg-rose-500', 'bg-cyan-500', 'bg-emerald-500']
  const delays = [0.3, 0, 0.5]

  return (
    <div className="flex items-end justify-center gap-2 sm:gap-4 py-8">
      {podiumOrder.map((entry, displayIdx) => {
        if (!entry) return null
        const actualRank = displayIdx === 0 ? 2 : displayIdx === 1 ? 1 : 3
        const avatar = entry.avatarId ? getAvatar(entry.avatarId) : getAvatarFromName(entry.name)
        
        return (
          <motion.div
            key={entry.name}
            className="flex flex-col items-center"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: delays[displayIdx], type: 'spring', bounce: 0.4 }}
          >
            {/* Avatar */}
            <motion.div
              className="relative mb-2"
              animate={actualRank === 1 ? { y: [0, -8, 0] } : {}}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            >
              <div 
                className={`${actualRank === 1 ? 'w-20 h-20 text-4xl' : 'w-14 h-14 text-2xl'} rounded-2xl flex items-center justify-center shadow-xl`}
                style={{ 
                  backgroundColor: avatar.color,
                  boxShadow: `0 8px 24px ${avatar.color}50`
                }}
              >
                {avatar.emoji}
              </div>
              {actualRank === 1 && (
                <motion.div 
                  className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl"
                  animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  👑
                </motion.div>
              )}
            </motion.div>

            {/* Name ribbon */}
            <div className={`${ribbonColors[displayIdx]} px-4 py-1.5 rounded-lg shadow-lg relative`}>
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-r-[8px] border-r-current border-b-[8px] border-b-transparent" style={{ color: ribbonColors[displayIdx].replace('bg-', '').includes('rose') ? '#f43f5e' : ribbonColors[displayIdx].includes('cyan') ? '#06b6d4' : '#10b981' }} />
              <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-l-[8px] border-l-current border-b-[8px] border-b-transparent" style={{ color: ribbonColors[displayIdx].replace('bg-', '').includes('rose') ? '#f43f5e' : ribbonColors[displayIdx].includes('cyan') ? '#06b6d4' : '#10b981' }} />
              <p className="text-white font-bold text-sm truncate max-w-[80px] sm:max-w-[100px]">{entry.name}</p>
            </div>

            {/* Score */}
            <p className="text-white/80 text-sm font-semibold mt-1">
              {entry.score.toLocaleString()} pts
            </p>

            {/* Podium block */}
            <motion.div
              className={`${podiumHeights[displayIdx]} w-20 sm:w-24 mt-2 rounded-t-xl bg-gradient-to-b ${podiumColors[displayIdx]} flex items-center justify-center shadow-xl`}
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              transition={{ delay: delays[displayIdx] + 0.2, duration: 0.5, type: 'spring' }}
            >
              <span className="text-white font-black text-3xl sm:text-4xl drop-shadow-lg">
                {actualRank}<sup className="text-lg">{actualRank === 1 ? 'st' : actualRank === 2 ? 'nd' : 'rd'}</sup>
              </span>
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
