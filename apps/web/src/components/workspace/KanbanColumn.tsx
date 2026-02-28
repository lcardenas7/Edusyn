import { ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'

interface KanbanColumnProps {
  title: string
  itemCount: number
  onAddItem?: () => void
  onDelete?: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: () => void
  onDrop?: (e: React.DragEvent) => void
  isDragOver?: boolean
  bgClass?: string
  countBgClass?: string
  addLabel?: string
  children: ReactNode
  footer?: ReactNode
  maxHeight?: string
}

export default function KanbanColumn({
  title,
  itemCount,
  onAddItem,
  onDelete,
  onDragOver,
  onDragLeave,
  onDrop,
  isDragOver,
  bgClass = 'bg-white',
  countBgClass = 'bg-slate-100',
  addLabel = 'Agregar item',
  children,
  footer,
  maxHeight = 'max-h-[calc(100vh-260px)]',
}: KanbanColumnProps) {
  return (
    <div
      className={`flex-shrink-0 w-80 flex flex-col rounded-card shadow-sm border transition-colors ${
        isDragOver ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200'
      } ${bgClass}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h3 className="text-body-sm font-semibold text-slate-700">{title}</h3>
          <span className={`text-badge text-slate-400 ${countBgClass} px-2 py-0.5 rounded-full`}>
            {itemCount}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onAddItem && (
            <button onClick={onAddItem} className="p-1.5 rounded hover:bg-white/80" title={addLabel}>
              <Plus className="w-4 h-4 text-slate-400" />
            </button>
          )}
          {onDelete && (
            <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-50" title="Eliminar columna">
              <Trash2 className="w-3.5 h-3.5 text-slate-300 hover:text-red-400" />
            </button>
          )}
        </div>
      </div>

      {/* Items */}
      <div className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px] ${maxHeight}`}>
        {children}
      </div>

      {/* Footer (inline add, etc.) */}
      {footer}
    </div>
  )
}
