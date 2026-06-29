// Registro central de módulos del Espacio Docente.
// Fuente única de verdad: qué módulos existen, cómo se ven, y cómo se decide
// que un módulo está "activo" en un espacio (aparece solo cuando se usa).
//
// Un módulo está ACTIVO en un espacio si:
//   1) el tipo del tablero lo implica (módulo primario), O
//   2) hay items cuyo `kind` mapea a ese módulo, O
//   3) está en board.enabledModules (activado manualmente).

import type { SectionKey } from '../sections/SectionTabs'

export type ModuleKey =
  | 'estudio'
  | 'bitacora'
  | 'observaciones'
  | 'recaudo'
  | 'roles'
  | 'recursos'
  | 'lista'
  | 'notas'
  | 'tablero'
  | 'proyecto'

export interface ModuleDef {
  key: ModuleKey
  label: string
  emoji: string
  iconBg: string                // clase Tailwind LITERAL (el purge no acepta interpolación)
  description: string
  sectionKey?: SectionKey       // si reusa el render de Section (módulos "ready")
  kinds: string[]               // kinds de WorkspaceItem que pertenecen a este módulo
  boardTypes: string[]          // tipos de tablero que activan este módulo como primario
  status: 'ready' | 'soon'      // 'soon' = se construye en su fase
}

export const MODULES: Record<ModuleKey, ModuleDef> = {
  estudio: {
    key: 'estudio', label: 'Estudio', emoji: '✨', iconBg: 'bg-fuchsia-50',
    description: 'Diseña clases y guías con Valeria.',
    kinds: [], boardTypes: [], status: 'ready',
  },
  bitacora: {
    key: 'bitacora', label: 'Bitácora', emoji: '📖', iconBg: 'bg-blue-50',
    description: 'Diario de clase, reuniones, incidentes.',
    sectionKey: 'log', kinds: ['LOG'], boardTypes: ['CLASS_LOG'], status: 'ready',
  },
  observaciones: {
    key: 'observaciones', label: 'Observaciones', emoji: '👤', iconBg: 'bg-amber-50',
    description: 'Apuntes sobre estudiantes (privados).',
    sectionKey: 'observations', kinds: ['OBSERVATION'], boardTypes: ['STUDENT_NOTES'], status: 'ready',
  },
  recaudo: {
    key: 'recaudo', label: 'Recaudo', emoji: '💰', iconBg: 'bg-yellow-50',
    description: 'Cobros con tus estudiantes.',
    sectionKey: 'collection', kinds: ['COLLECTION'], boardTypes: ['MICRO_COLLECT'], status: 'ready',
  },
  roles: {
    key: 'roles', label: 'Roles', emoji: '🎭', iconBg: 'bg-rose-50',
    description: 'Monitores, líderes y comisiones.',
    sectionKey: 'roles', kinds: [], boardTypes: ['CLASSROOM_ROLES'], status: 'ready',
  },
  recursos: {
    key: 'recursos', label: 'Recursos', emoji: '📁', iconBg: 'bg-emerald-50',
    description: 'Archivos y enlaces del curso.',
    sectionKey: 'resources', kinds: ['FILE'], boardTypes: [], status: 'ready',
  },
  lista: {
    key: 'lista', label: 'Lista', emoji: '✅', iconBg: 'bg-teal-50',
    description: 'Pendientes con prioridad y fecha.',
    sectionKey: 'log', kinds: ['LIST', 'TASK'], boardTypes: ['CHECKLIST'], status: 'ready',
  },
  notas: {
    key: 'notas', label: 'Notas', emoji: '📝', iconBg: 'bg-violet-50',
    description: 'Notas e ideas sueltas.',
    sectionKey: 'log', kinds: ['NOTE', 'IDEA'], boardTypes: ['KANBAN'], status: 'ready',
  },
  tablero: {
    key: 'tablero', label: 'Tablero libre', emoji: '📋', iconBg: 'bg-indigo-50',
    description: 'Kanban: ideas, pendientes, en proceso.',
    kinds: [], boardTypes: [], status: 'soon',
  },
  proyecto: {
    key: 'proyecto', label: 'Proyecto', emoji: '🚀', iconBg: 'bg-fuchsia-50',
    description: 'Proyectos con objetivo, avance e integrantes.',
    kinds: [], boardTypes: ['PROJECT'], status: 'ready',
  },
}

export const MODULE_ORDER: ModuleKey[] = [
  'estudio', 'bitacora', 'observaciones', 'recaudo', 'roles', 'recursos', 'lista', 'notas', 'tablero', 'proyecto',
]

export interface BoardLike {
  type?: string
  enabledModules?: string[]
}
export interface ItemLike {
  kind?: string | null
  metadata?: any
}

// Decide qué módulos están activos en un espacio.
export function activeModules(board: BoardLike, items: ItemLike[]): ModuleKey[] {
  const active = new Set<ModuleKey>()

  // 1) Módulo primario por tipo de tablero
  for (const key of MODULE_ORDER) {
    if (board.type && MODULES[key].boardTypes.includes(board.type)) active.add(key)
  }

  // 2) Por kinds presentes en items (columna o metadata.kind)
  const kindsPresent = new Set<string>()
  for (const it of items) {
    const k = (it.kind || it.metadata?.kind || '').toString().toUpperCase()
    if (k) kindsPresent.add(k)
  }
  for (const key of MODULE_ORDER) {
    if (MODULES[key].kinds.some((k) => kindsPresent.has(k))) active.add(key)
  }

  // 3) Activados manualmente
  for (const k of board.enabledModules || []) {
    if ((MODULE_ORDER as string[]).includes(k)) active.add(k as ModuleKey)
  }

  return MODULE_ORDER.filter((k) => active.has(k))
}

// Módulos válidos en el Espacio Personal (sin curso → sin estudiantes).
export const PERSONAL_MODULES: ModuleKey[] = ['estudio', 'bitacora', 'notas', 'lista', 'tablero', 'recursos', 'proyecto']

// Módulos que el docente puede activar (los que aún no están activos).
// En el espacio personal se ofrecen solo los que no dependen de estudiantes.
export function activatableModules(activeKeys: ModuleKey[], isPersonal?: boolean): ModuleDef[] {
  let avail = MODULE_ORDER.filter((k) => !activeKeys.includes(k))
  if (isPersonal) avail = avail.filter((k) => PERSONAL_MODULES.includes(k))
  return avail.map((k) => MODULES[k])
}
