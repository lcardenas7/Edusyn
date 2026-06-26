// Identidad visual por defecto para espacios sin personalización.
// Cuando un WorkspaceBoard tenga `emoji`/`color` definidos explícitamente,
// estos se ignoran. Sino, se asignan a partir del `type` del board.

export type DefaultIdentity = {
  emoji: string
  color: string         // tailwind base (ej: 'violet')
  hex: string           // para gradientes y backgrounds custom
  bannerGradient: string // class de gradiente
}

const IDENTITY_BY_TYPE: Record<string, DefaultIdentity> = {
  KANBAN:          { emoji: '📋', color: 'violet',  hex: '#7c3aed', bannerGradient: 'from-violet-500 to-purple-600' },
  CLASS_LOG:       { emoji: '📖', color: 'blue',    hex: '#2563eb', bannerGradient: 'from-blue-500 to-indigo-600' },
  STUDENT_NOTES:   { emoji: '👤', color: 'amber',   hex: '#d97706', bannerGradient: 'from-amber-500 to-orange-600' },
  CHECKLIST:       { emoji: '✅', color: 'emerald', hex: '#059669', bannerGradient: 'from-emerald-500 to-teal-600' },
  MICRO_COLLECT:   { emoji: '💰', color: 'yellow',  hex: '#ca8a04', bannerGradient: 'from-yellow-500 to-amber-600' },
  CLASSROOM_ROLES: { emoji: '🎭', color: 'rose',    hex: '#e11d48', bannerGradient: 'from-rose-500 to-pink-600' },
  PROJECT:         { emoji: '🚀', color: 'fuchsia', hex: '#c026d3', bannerGradient: 'from-fuchsia-500 to-pink-600' },
}

const FALLBACK: DefaultIdentity = {
  emoji: '✨',
  color: 'slate',
  hex: '#475569',
  bannerGradient: 'from-slate-500 to-slate-600',
}

export function getDefaultIdentity(type: string): DefaultIdentity {
  return IDENTITY_BY_TYPE[type] ?? FALLBACK
}

// Resuelve la identidad final: si el board tiene campos custom, los usa.
// Sino, cae al default por tipo.
export function resolveIdentity(board: { type: string; emoji?: string | null; color?: string | null }): DefaultIdentity {
  const base = getDefaultIdentity(board.type)
  return {
    ...base,
    emoji: board.emoji || base.emoji,
    hex: board.color || base.hex,
  }
}
