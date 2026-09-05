/**
 * Los destinos del aula. Un solo lugar los define, para que el riel de escritorio, la barra
 * inferior de móvil y las migas de pan no puedan discrepar.
 *
 * Decisión D1 del plan: "Anuncios" deja de ser pestaña (pasa a ser el muro dentro de Hoy) y
 * "Expedición ABP" se conserva como destino propio.
 */

import {
  BarChart3,
  BookOpen,
  ClipboardList,
  Compass,
  House,
  MessagesSquare,
  Rocket,
  Users,
  type LucideIcon,
} from 'lucide-react'

export type Vista = 'hoy' | 'unidades' | 'actividades' | 'rutas' | 'expedicion' | 'foro' | 'notas' | 'estudiantes'

export interface Destino {
  id: Vista
  label: string
  /** Lo que este destino responde. Se usa en el tooltip del riel colapsado. */
  hint: string
  icon: LucideIcon
  soloDocente?: boolean
  /** Va en la barra inferior de móvil (máximo 4, al alcance del pulgar). */
  principal?: boolean
}

export const DESTINOS: Destino[] = [
  { id: 'hoy', label: 'Hoy', hint: '¿Qué me toca ahora?', icon: House, principal: true },
  { id: 'actividades', label: 'Actividades', hint: 'Todo lo que hay, con búsqueda', icon: ClipboardList, principal: true },
  { id: 'unidades', label: 'Unidades', hint: 'El curso ordenado por temas', icon: BookOpen, principal: true },
  { id: 'notas', label: 'Notas', hint: 'Cómo vamos', icon: BarChart3, principal: true },
  { id: 'rutas', label: 'Rutas', hint: 'Aprendizaje por competencias', icon: Compass },
  { id: 'expedicion', label: 'Expedición', hint: 'Proyectos por equipos', icon: Rocket },
  { id: 'foro', label: 'Foro', hint: 'Preguntas y conversación', icon: MessagesSquare },
  { id: 'estudiantes', label: 'Estudiantes', hint: 'Quiénes están y cómo van', icon: Users, soloDocente: true },
]

export function destinosDe(role: 'docente' | 'estudiante'): Destino[] {
  return DESTINOS.filter((d) => !d.soloDocente || role === 'docente')
}

export function destinoDe(vista: Vista): Destino {
  return DESTINOS.find((d) => d.id === vista) ?? DESTINOS[0]
}

/** Etiqueta del destino, para migas de pan y título de página. */
export function vistaLabel(vista: Vista): string {
  return destinoDe(vista).label
}
