export interface WorkspaceItem {
  id: string
  boardId: string
  columnId: string | null
  studentId: string | null
  title: string
  content: string | null
  metadata: any
  status: string
  dueDate: string | null
  eventDate: string | null
  sortOrder: number
  isArchived: boolean
  createdAt: string
  student?: { id: string; firstName: string; lastName: string } | null
}

export interface WorkspaceColumn {
  id: string
  boardId: string
  title: string
  sortOrder: number
  color: string | null
  items: WorkspaceItem[]
}

export interface WorkspaceBoard {
  id: string
  type: string
  title: string
  description: string | null
  color: string | null
  groupId: string | null
  metadata: any
  isArchived: boolean
  group?: { id: string; name: string; grade?: { name: string } } | null
  columns?: WorkspaceColumn[]
  items?: WorkspaceItem[]
  _count?: { items: number }
}

export const BOARD_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  KANBAN: { label: 'Tablero Kanban', icon: '📋', color: '#3b82f6' },
  CLASS_LOG: { label: 'Bitácora de Clase', icon: '📖', color: '#8b5cf6' },
  STUDENT_NOTES: { label: 'Seguimiento Individual', icon: '👤', color: '#10b981' },
  CHECKLIST: { label: 'Lista de Verificación', icon: '✅', color: '#f59e0b' },
  MICRO_COLLECT: { label: 'Micro-recaudo', icon: '💰', color: '#ef4444' },
  CLASSROOM_ROLES: { label: 'Roles del Aula', icon: '🎭', color: '#ec4899' },
  PROJECT: { label: 'Proyecto Especial', icon: '🚀', color: '#6366f1' },
}

export const BOARD_TYPE_COLORS: Record<string, string> = {
  KANBAN: 'bg-slate-500',
  CLASS_LOG: 'bg-blue-500',
  STUDENT_NOTES: 'bg-purple-500',
  CHECKLIST: 'bg-emerald-500',
  MICRO_COLLECT: 'bg-amber-500',
  CLASSROOM_ROLES: 'bg-rose-500',
  PROJECT: 'bg-indigo-500',
}

export const BOARD_TYPE_LABELS: Record<string, string> = {
  KANBAN: 'Kanban',
  CLASS_LOG: 'Bitácora',
  STUDENT_NOTES: 'Seguimiento',
  CHECKLIST: 'Verificación',
  MICRO_COLLECT: 'Recaudo',
  CLASSROOM_ROLES: 'Roles',
  PROJECT: 'Proyecto',
}
