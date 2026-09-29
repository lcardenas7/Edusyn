/**
 * Piezas comunes de Arena.
 *
 * La Arena es el único lugar del aula que se presenta como un juego: fondo
 * oscuro propio, tipografía grande y acciones al alcance del pulgar. Estos
 * tokens viven aquí (y no en el sistema de diseño del aula) porque describen
 * ese mundo aparte, no la plataforma.
 */

export type Source = { id: string; title: string; questionCount: number; enabled: boolean }
export type Peer = { id: string; name: string }
export type Category = { name: string; count: number }
export type DuelSummary = {
  id: string; status: string; category: string; selectionMode: string; opponent: string
  isInvitee: boolean; myProgress: number; opponentProgress: number; createdAt: string
}
export type Dashboard = {
  classroomTitle: string; gradeName: string | null; role: 'teacher' | 'student'
  questionCount: number; categories: Category[]; minimumQuestions: number
  sources: Source[]; peers: Peer[]; duels: DuelSummary[]
}
export type Duel = {
  id: string; status: string; category: string; selectionMode: string; isInvitee: boolean
  opponent: string; opponentEnrollmentId: string
  myProgress: number; opponentProgress: number; total: number; powerAvailable: boolean
  powerCategories: string[]
  question: { ordinal: number; text: string; options: string[]; category: string; powerApplied: boolean } | null
  result: {
    myScore: number; opponentScore: number
    review: { text: string; correctAnswer: string; explanation: string | null; myCorrect: boolean }[]
  } | null
}
export type RankingScope = 'group' | 'grade' | 'general'
export type RankingRow = {
  enrollmentId: string; name: string; played: number; wins: number; draws: number; losses: number
  correct: number; answered: number; perfects: number; upsets: number
  points: number; accuracy: number; rank: number; isMe: boolean
}
export type Ranking = {
  scope: RankingScope; scopeLabel: string; scopeHint: string
  criteria: { win: number; draw: number; loss: number; perfect: number; upset: number }
  rows: RankingRow[]; myRank: number | null; participants: number; truncated: boolean
}

export type ArenaBadge = {
  code: string; name: string; description: string; emoji: string
  tier: 'BRONCE' | 'PLATA' | 'ORO'
  family: 'victorias' | 'aciertos' | 'categoria' | 'gesta'
  target: number; current: number; earned: boolean
}
export type ArenaProfile = {
  played: number; wins: number; draws: number; losses: number
  correct: number; answered: number; accuracy: number
  perfects: number; currentStreak: number; bestStreak: number; points: number
  categories: { name: string; correct: number; answered: number; duels: number; accuracy: number }[]
  badges: ArenaBadge[]; earnedCount: number
}

export const ARENA_STATUS: Record<string, { label: string; tone: string }> = {
  INVITED: { label: 'Invitación', tone: 'bg-amber-300/15 text-amber-200 border-amber-300/30' },
  ACTIVE: { label: 'En juego', tone: 'bg-teal-300/15 text-teal-200 border-teal-300/30' },
  COMPLETED: { label: 'Terminado', tone: 'bg-white/10 text-slate-200 border-white/15' },
  DECLINED: { label: 'Rechazado', tone: 'bg-rose-400/10 text-rose-200 border-rose-400/25' },
  EXPIRED: { label: 'Venció', tone: 'bg-white/5 text-slate-400 border-white/10' },
}

const AVATAR_COLORS = ['#FFC94A', '#4FE0C6', '#9B8CFF', '#FF9E7A', '#7FB2FF', '#F58FD0', '#8BD99B']

/** Color estable por nombre: el mismo rival siempre se ve igual en toda la Arena. */
export function avatarColor(name: string) {
  let hash = 0
  for (let index = 0; index < name.length; index++) hash = (hash * 31 + name.charCodeAt(index)) % 997
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

export function Avatar({ name, size = 44, ring }: { name: string; size?: number; ring?: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-black text-[#11142f]"
      style={{
        width: size, height: size, backgroundColor: avatarColor(name),
        fontSize: Math.round(size * 0.36), boxShadow: ring ? `0 0 0 3px ${ring}` : undefined,
      }}
    >
      {initials(name)}
    </span>
  )
}

/** Puntos de avance de la partida: siete casillas, una por pregunta. */
export function ProgressDots({ total, done, tone = 'bg-teal-400' }: { total: number; done: number; tone?: string }) {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {Array.from({ length: total }, (_, index) => (
        <span key={index} className={`h-1.5 flex-1 rounded-full transition-colors ${index < done ? tone : 'bg-white/15'}`} />
      ))}
    </span>
  )
}
