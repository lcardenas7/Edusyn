// ═══════════════════════════════════════════════════════════════════════════
// EDUSYN PLAY — IDENTIDAD VISUAL PROPIA
// ───────────────────────────────────────────────────────────────────────────
// Sistema de iconografía y paleta de colores para diferenciarnos de Kahoot.
// Reemplaza por completo el patrón rojo/azul/amarillo/verde con triángulo
// /diamante/círculo/cuadrado.
//
// Cada tema entrega 6 "slots" de respuesta (suficientes para preguntas de
// hasta 6 opciones múltiples). Cada slot define:
//   - Clases Tailwind para fondo / hover / texto / anillo de selección.
//   - Color hex para usar en SVG, gradientes inline o canvas.
//   - Ícono Lucide (componente React) — moderno, vectorial, accesible.
//   - "shape" string (símbolo unicode) como fallback ligero cuando no se
//     quiere cargar el ícono completo.
//   - Etiqueta semántica (p. ej. "Hexágono") usable como aria-label.
// ═══════════════════════════════════════════════════════════════════════════

import type { LucideIcon } from 'lucide-react'
import {
  Hexagon,
  Atom,
  Cpu,
  Rocket,
  Sparkles,
  Zap,
  Globe2,
  Satellite,
  Star,
  Orbit,
  Moon,
  Telescope,
  Cloud,
  Bot,
  Server,
  Wifi,
  Microscope,
} from 'lucide-react'

export type PlayTheme = 'STEM' | 'SPACE' | 'TECH'

export interface PlayOptionStyle {
  /** ID estable, útil para tracking de eventos / analytics. */
  id: string
  /** Etiqueta accesible (aria-label / tooltip). */
  label: string
  /** Clase Tailwind para fondo principal. */
  bg: string
  /** Clase Tailwind hover. */
  hover: string
  /** Clase Tailwind active (touch). */
  active: string
  /** Color de texto principal. */
  text: string
  /** Anillo / borde de selección (estado "seleccionado"). */
  ring: string
  /** Hex equivalente al `bg` — para SVGs, partículas, confetti, canvas. */
  hex: string
  /** Hex de un acento más oscuro (para sombras, bordes). */
  hexDark: string
  /** Símbolo Unicode ligero (fallback cuando no se renderiza el ícono). */
  shape: string
  /** Componente Lucide listo para renderizar (usar tamaño/className al consumir). */
  Icon: LucideIcon
}

export interface PlayThemeDefinition {
  id: PlayTheme
  name: string
  description: string
  /** Gradiente principal usado para fondos del docente / overlays. */
  gradient: string
  /** Color de acento principal (CTA, focos, anillos). */
  accent: string
  /** 6 slots de respuesta — multiple choice usa los primeros N. */
  options: PlayOptionStyle[]
}

// ───────────────────────────────────────────────────────────────────────────
// Tema A — STEM
// ───────────────────────────────────────────────────────────────────────────
// Inspiración: ciencia, tecnología, ingeniería y matemáticas.
// Colores cálidos pero distintos a Kahoot. Cero rojo puro (#FF0000) y cero
// amarillo brillante. Usa indigo, cyan, naranja-coral, violeta.
const THEME_STEM: PlayThemeDefinition = {
  id: 'STEM',
  name: 'STEM',
  description: 'Ciencia, tecnología, ingeniería y matemáticas — paleta moderna y educativa.',
  gradient: 'from-indigo-700 via-violet-700 to-cyan-700',
  accent: '#6366f1',
  options: [
    {
      id: 'stem-hex',
      label: 'Hexágono',
      bg: 'bg-indigo-600',
      hover: 'hover:bg-indigo-700',
      active: 'active:bg-indigo-800',
      text: 'text-white',
      ring: 'ring-indigo-300',
      hex: '#4f46e5',
      hexDark: '#3730a3',
      shape: '⬢',
      Icon: Hexagon,
    },
    {
      id: 'stem-atom',
      label: 'Átomo',
      bg: 'bg-cyan-500',
      hover: 'hover:bg-cyan-600',
      active: 'active:bg-cyan-700',
      text: 'text-white',
      ring: 'ring-cyan-300',
      hex: '#06b6d4',
      hexDark: '#0e7490',
      shape: '⚛',
      Icon: Atom,
    },
    {
      id: 'stem-circuit',
      label: 'Circuito',
      bg: 'bg-orange-500',
      hover: 'hover:bg-orange-600',
      active: 'active:bg-orange-700',
      text: 'text-white',
      ring: 'ring-orange-300',
      hex: '#f97316',
      hexDark: '#c2410c',
      shape: '⚙',
      Icon: Cpu,
    },
    {
      id: 'stem-rocket',
      label: 'Cohete',
      bg: 'bg-violet-600',
      hover: 'hover:bg-violet-700',
      active: 'active:bg-violet-800',
      text: 'text-white',
      ring: 'ring-violet-300',
      hex: '#7c3aed',
      hexDark: '#5b21b6',
      shape: '✈',
      Icon: Rocket,
    },
    {
      id: 'stem-spark',
      label: 'Chispa',
      bg: 'bg-pink-500',
      hover: 'hover:bg-pink-600',
      active: 'active:bg-pink-700',
      text: 'text-white',
      ring: 'ring-pink-300',
      hex: '#ec4899',
      hexDark: '#be185d',
      shape: '✦',
      Icon: Sparkles,
    },
    {
      id: 'stem-microscope',
      label: 'Microscopio',
      bg: 'bg-emerald-600',
      hover: 'hover:bg-emerald-700',
      active: 'active:bg-emerald-800',
      text: 'text-white',
      ring: 'ring-emerald-300',
      hex: '#059669',
      hexDark: '#065f46',
      shape: '◔',
      Icon: Microscope,
    },
  ],
}

// ───────────────────────────────────────────────────────────────────────────
// Tema B — ESPACIO
// ───────────────────────────────────────────────────────────────────────────
const THEME_SPACE: PlayThemeDefinition = {
  id: 'SPACE',
  name: 'Exploración espacial',
  description: 'Planetas, satélites y constelaciones — paleta nocturna con acentos vibrantes.',
  gradient: 'from-slate-900 via-indigo-900 to-fuchsia-900',
  accent: '#a78bfa',
  options: [
    { id: 'sp-planet',    label: 'Planeta',    bg: 'bg-blue-600',    hover: 'hover:bg-blue-700',    active: 'active:bg-blue-800',    text: 'text-white', ring: 'ring-blue-300',    hex: '#2563eb', hexDark: '#1d4ed8', shape: '◐', Icon: Globe2 },
    { id: 'sp-satellite', label: 'Satélite',   bg: 'bg-teal-500',    hover: 'hover:bg-teal-600',    active: 'active:bg-teal-700',    text: 'text-white', ring: 'ring-teal-300',    hex: '#14b8a6', hexDark: '#0f766e', shape: '⌖', Icon: Satellite },
    { id: 'sp-star',      label: 'Estrella',   bg: 'bg-amber-500',   hover: 'hover:bg-amber-600',   active: 'active:bg-amber-700',   text: 'text-white', ring: 'ring-amber-300',   hex: '#f59e0b', hexDark: '#b45309', shape: '★', Icon: Star },
    { id: 'sp-comet',     label: 'Cometa',     bg: 'bg-fuchsia-600', hover: 'hover:bg-fuchsia-700', active: 'active:bg-fuchsia-800', text: 'text-white', ring: 'ring-fuchsia-300', hex: '#c026d3', hexDark: '#86198f', shape: '☄', Icon: Sparkles },
    { id: 'sp-orbit',     label: 'Órbita',     bg: 'bg-rose-500',    hover: 'hover:bg-rose-600',    active: 'active:bg-rose-700',    text: 'text-white', ring: 'ring-rose-300',    hex: '#f43f5e', hexDark: '#be123c', shape: '◯', Icon: Orbit },
    { id: 'sp-moon',      label: 'Luna',       bg: 'bg-slate-500',   hover: 'hover:bg-slate-600',   active: 'active:bg-slate-700',   text: 'text-white', ring: 'ring-slate-300',   hex: '#64748b', hexDark: '#334155', shape: '☾', Icon: Moon },
  ],
}

// ───────────────────────────────────────────────────────────────────────────
// Tema C — TECNOLOGÍA
// ───────────────────────────────────────────────────────────────────────────
const THEME_TECH: PlayThemeDefinition = {
  id: 'TECH',
  name: 'Tecnología',
  description: 'Chips, nubes, IA y conectividad — paleta tecnológica neón sobre oscuro.',
  gradient: 'from-zinc-900 via-emerald-900 to-cyan-900',
  accent: '#22d3ee',
  options: [
    { id: 'tc-chip',     label: 'Chip',       bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700', active: 'active:bg-emerald-800', text: 'text-white', ring: 'ring-emerald-300', hex: '#059669', hexDark: '#065f46', shape: '▤', Icon: Cpu },
    { id: 'tc-cloud',    label: 'Nube',       bg: 'bg-sky-500',     hover: 'hover:bg-sky-600',     active: 'active:bg-sky-700',     text: 'text-white', ring: 'ring-sky-300',     hex: '#0ea5e9', hexDark: '#0369a1', shape: '☁', Icon: Cloud },
    { id: 'tc-bot',      label: 'Robot',      bg: 'bg-purple-600',  hover: 'hover:bg-purple-700',  active: 'active:bg-purple-800',  text: 'text-white', ring: 'ring-purple-300',  hex: '#9333ea', hexDark: '#6b21a8', shape: '☻', Icon: Bot },
    { id: 'tc-bolt',     label: 'Rayo',       bg: 'bg-yellow-500',  hover: 'hover:bg-yellow-600',  active: 'active:bg-yellow-700',  text: 'text-yellow-950', ring: 'ring-yellow-300', hex: '#eab308', hexDark: '#a16207', shape: '⚡', Icon: Zap },
    { id: 'tc-server',   label: 'Servidor',   bg: 'bg-rose-500',    hover: 'hover:bg-rose-600',    active: 'active:bg-rose-700',    text: 'text-white', ring: 'ring-rose-300',    hex: '#f43f5e', hexDark: '#be123c', shape: '▦', Icon: Server },
    { id: 'tc-wifi',     label: 'Wi-Fi',      bg: 'bg-teal-500',    hover: 'hover:bg-teal-600',    active: 'active:bg-teal-700',    text: 'text-white', ring: 'ring-teal-300',    hex: '#14b8a6', hexDark: '#0f766e', shape: '⌒', Icon: Wifi },
  ],
}

// ───────────────────────────────────────────────────────────────────────────
// Registro global de temas + tema activo
// ───────────────────────────────────────────────────────────────────────────
export const PLAY_THEMES: Record<PlayTheme, PlayThemeDefinition> = {
  STEM: THEME_STEM,
  SPACE: THEME_SPACE,
  TECH: THEME_TECH,
}

/**
 * Tema activo por defecto. Se lee de localStorage si está disponible,
 * con fallback a 'STEM'. Mantener síncrono para evitar parpadeo en SSR/CSR.
 */
export function getActiveTheme(): PlayTheme {
  if (typeof window === 'undefined') return 'STEM'
  const stored = window.localStorage?.getItem('edusyn_play_theme') as PlayTheme | null
  if (stored && PLAY_THEMES[stored]) return stored
  return 'STEM'
}

export function setActiveTheme(theme: PlayTheme): void {
  if (typeof window === 'undefined') return
  window.localStorage?.setItem('edusyn_play_theme', theme)
}

/**
 * Acceso rápido al array de opciones del tema activo.
 * Helper para componentes que solo necesitan iterar opciones.
 */
export function getPlayOptions(theme?: PlayTheme): PlayOptionStyle[] {
  return PLAY_THEMES[theme || getActiveTheme()].options
}

export function getPlayThemeDef(theme?: PlayTheme): PlayThemeDefinition {
  return PLAY_THEMES[theme || getActiveTheme()]
}

// Re-exporta el componente Telescope por si lo queremos usar en banners/empty-states.
export { Telescope }
