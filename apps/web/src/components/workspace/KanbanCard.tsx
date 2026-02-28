import { ReactNode } from 'react'
import { Pencil, Trash2, Clock } from 'lucide-react'
import { WorkspaceItem } from './types'
import { WBadge } from './ui'

interface KanbanCardProps {
  item: WorkspaceItem
  isDragging?: boolean
  onDragStart?: (e: React.DragEvent) => void
  onEdit?: () => void
  onDelete?: () => void
  onToggleStatus?: () => void
  onDoubleClickTitle?: () => void
  editingInline?: boolean
  editingTitle?: string
  onEditTitleChange?: (value: string) => void
  onEditTitleBlur?: () => void
  onEditTitleKeyDown?: (e: React.KeyboardEvent) => void
  // Date editing
  editingDate?: boolean
  onDateClick?: () => void
  onDateChange?: (value: string) => void
  onDateClear?: () => void
  onDateBlur?: () => void
  dateFieldType?: 'dueDate' | 'eventDate'
  // Status icon override
  statusIcon?: ReactNode
  // Additional content below title
  renderExtra?: () => ReactNode
}

export default function KanbanCard({
  item,
  isDragging,
  onDragStart,
  onEdit,
  onDelete,
  onToggleStatus,
  onDoubleClickTitle,
  editingInline,
  editingTitle,
  onEditTitleChange,
  onEditTitleBlur,
  onEditTitleKeyDown,
  editingDate,
  onDateClick,
  onDateChange,
  onDateClear,
  onDateBlur,
  dateFieldType = 'dueDate',
  statusIcon,
  renderExtra,
}: KanbanCardProps) {
  const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status !== 'DONE'

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      className={`group relative bg-white border border-slate-200/80 rounded-lg min-h-card p-3.5 ${
        onDragStart ? 'cursor-grab active:cursor-grabbing' : ''
      } hover:shadow-md hover:border-slate-300 transition-all duration-150 ${isDragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-start gap-2">
        {statusIcon && onToggleStatus && (
          <button onClick={onToggleStatus} className="mt-0.5 flex-shrink-0" title={item.status}>
            {statusIcon}
          </button>
        )}
        <div className="flex-1 min-w-0">
          {editingInline ? (
            <input
              value={editingTitle}
              onChange={(e) => onEditTitleChange?.(e.target.value)}
              onBlur={onEditTitleBlur}
              onKeyDown={onEditTitleKeyDown}
              autoFocus
              className="w-full text-body-sm border border-blue-300 rounded px-2 py-1 min-h-input focus:ring-1 focus:ring-blue-400 outline-none"
            />
          ) : (
            <p
              className={`text-body-sm ${item.status === 'DONE' ? 'line-through text-slate-400' : 'text-slate-800'}`}
              onDoubleClick={onDoubleClickTitle}
            >
              {item.title}
            </p>
          )}
          {item.student && (
            <p className="text-body-sm text-blue-500 mt-0.5">
              {item.student.firstName} {item.student.lastName}
            </p>
          )}
          {(item.dueDate || item.eventDate) && !editingDate && (
            <p className={`text-body-sm mt-0.5 flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
              <Clock className="w-3.5 h-3.5" />
              {new Date(item.dueDate || item.eventDate!).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
            </p>
          )}
          {editingDate && (
            <div className="flex items-center gap-1 mt-1">
              <input
                type="date"
                defaultValue={
                  (dateFieldType === 'eventDate' ? item.eventDate : item.dueDate)?.toString().slice(0, 10) || ''
                }
                onChange={(e) => onDateChange?.(e.target.value)}
                className="text-body-sm border border-blue-300 rounded px-2 py-1 min-h-input outline-none focus:ring-1 focus:ring-blue-400"
                autoFocus
                onBlur={onDateBlur}
              />
              {(item.dueDate || item.eventDate) && (
                <button onClick={onDateClear} className="text-red-300 hover:text-red-500" title="Quitar fecha">
                  <span className="text-body-sm">✕</span>
                </button>
              )}
            </div>
          )}
          {renderExtra?.()}
        </div>
        {/* Item actions */}
        <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 flex-shrink-0">
          {onDateClick && (
            <button onClick={onDateClick} className="p-1 rounded hover:bg-blue-50" title={dateFieldType === 'eventDate' ? 'Fecha evento' : 'Fecha límite'}>
              <Clock className={`w-3.5 h-3.5 ${item.dueDate || item.eventDate ? 'text-blue-500' : 'text-slate-400'}`} />
            </button>
          )}
          {onEdit && (
            <button onClick={onEdit} className="p-1 rounded hover:bg-slate-100">
              <Pencil className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="p-1 rounded hover:bg-red-50">
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
