import type { CSSProperties } from 'react'

// Diseños de encabezado para personalizar cada espacio.
// Cada tema es un fondo CSS (gradiente o patrón). El docente elige uno.
export interface HeaderTheme {
  key: string
  label: string
  group: 'Gradientes' | 'Patrones' | 'Sólidos'
  style: CSSProperties
}

// Patrón de puntos sobre un gradiente
const dots = (c1: string, c2: string, dot: string): CSSProperties => ({
  backgroundColor: c1,
  backgroundImage: `radial-gradient(${dot} 1.5px, transparent 1.5px), linear-gradient(135deg, ${c1}, ${c2})`,
  backgroundSize: '16px 16px, 100% 100%',
})
// Rayas diagonales suaves
const diagonal = (c1: string, c2: string): CSSProperties => ({
  backgroundImage: `repeating-linear-gradient(45deg, ${c1}, ${c1} 12px, ${c2} 12px, ${c2} 24px)`,
})
// Mezcla tipo "mesh" con varios focos de luz
const mesh = (a: string, b: string, c: string): CSSProperties => ({
  backgroundColor: a,
  backgroundImage: `radial-gradient(at 20% 20%, ${b} 0px, transparent 50%), radial-gradient(at 80% 30%, ${c} 0px, transparent 50%), radial-gradient(at 50% 90%, ${b} 0px, transparent 50%)`,
})

export const HEADER_THEMES: HeaderTheme[] = [
  // Gradientes
  { key: 'grape',  label: 'Uva',      group: 'Gradientes', style: { backgroundImage: 'linear-gradient(135deg, #7c3aed, #c026d3)' } },
  { key: 'ocean',  label: 'Océano',   group: 'Gradientes', style: { backgroundImage: 'linear-gradient(135deg, #2563eb, #4338ca)' } },
  { key: 'forest', label: 'Bosque',   group: 'Gradientes', style: { backgroundImage: 'linear-gradient(135deg, #059669, #0d9488)' } },
  { key: 'sunset', label: 'Atardecer',group: 'Gradientes', style: { backgroundImage: 'linear-gradient(135deg, #f97316, #db2777)' } },
  { key: 'rose',   label: 'Rosa',     group: 'Gradientes', style: { backgroundImage: 'linear-gradient(135deg, #f43f5e, #ec4899)' } },
  { key: 'amber',  label: 'Ámbar',    group: 'Gradientes', style: { backgroundImage: 'linear-gradient(135deg, #f59e0b, #d97706)' } },
  { key: 'sky',    label: 'Cielo',    group: 'Gradientes', style: { backgroundImage: 'linear-gradient(135deg, #0ea5e9, #6366f1)' } },
  { key: 'night',  label: 'Pizarra',  group: 'Gradientes', style: { backgroundImage: 'linear-gradient(135deg, #1e293b, #475569)' } },

  // Patrones
  { key: 'dots-violet', label: 'Puntos',    group: 'Patrones', style: dots('#7c3aed', '#9333ea', 'rgba(255,255,255,0.25)') },
  { key: 'dots-teal',   label: 'Puntos · Teal', group: 'Patrones', style: dots('#0d9488', '#059669', 'rgba(255,255,255,0.25)') },
  { key: 'diag-blue',   label: 'Rayas',     group: 'Patrones', style: diagonal('#2563eb', '#3b82f6') },
  { key: 'diag-rose',   label: 'Rayas · Rosa', group: 'Patrones', style: diagonal('#e11d48', '#f43f5e') },
  { key: 'mesh-warm',   label: 'Mesh cálido', group: 'Patrones', style: mesh('#7c2d12', '#f97316', '#fbbf24') },
  { key: 'mesh-cool',   label: 'Mesh frío',   group: 'Patrones', style: mesh('#1e3a8a', '#3b82f6', '#22d3ee') },

  // Sólidos
  { key: 'solid-violet', label: 'Violeta', group: 'Sólidos', style: { backgroundColor: '#7c3aed' } },
  { key: 'solid-emerald',label: 'Esmeralda',group: 'Sólidos', style: { backgroundColor: '#059669' } },
  { key: 'solid-blue',   label: 'Azul',    group: 'Sólidos', style: { backgroundColor: '#2563eb' } },
  { key: 'solid-rose',   label: 'Rosa',    group: 'Sólidos', style: { backgroundColor: '#e11d48' } },
  { key: 'solid-amber',  label: 'Ámbar',   group: 'Sólidos', style: { backgroundColor: '#d97706' } },
  { key: 'solid-slate',  label: 'Gris',    group: 'Sólidos', style: { backgroundColor: '#475569' } },
]

export const getHeaderTheme = (key?: string | null) =>
  HEADER_THEMES.find((t) => t.key === key) ?? null
