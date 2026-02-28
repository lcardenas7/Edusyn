import { useRef, ReactNode } from 'react'
import { Calendar, Check, Clock, Loader2, Pencil, Plus, Trash2, X, Archive } from 'lucide-react'
import { WorkspaceBoard, WorkspaceItem } from '../types'
import KanbanColumn from '../KanbanColumn'
import KanbanCard from '../KanbanCard'

const STATUS_ICONS: Record<string, ReactNode> = {
  TODO: <Clock className="w-3.5 h-3.5 text-slate-400" />,
  IN_PROGRESS: <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />,
  DONE: <Check className="w-3.5 h-3.5 text-green-500" />,
  ARCHIVED: <Archive className="w-3.5 h-3.5 text-slate-300" />,
}

interface GenericKanbanViewProps {
  board: WorkspaceBoard
  dragItem: WorkspaceItem | null
  dragOverColumn: string | null
  onDragStart: (e: React.DragEvent, item: WorkspaceItem) => void
  onDragOver: (e: React.DragEvent, columnId: string) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, columnId: string) => void
  // Inline editing
  editingItemId: string | null
  editingItemTitle: string
  onStartEditTitle: (itemId: string, title: string) => void
  onEditTitleChange: (value: string) => void
  onSaveTitle: (itemId: string) => void
  onCancelEdit: () => void
  // Date editing
  onStartEditDate: (itemId: string) => void
  onDateChange: (itemId: string, value: string) => void
  onClearDate: (itemId: string) => void
  // Item CRUD
  onToggleStatus: (item: WorkspaceItem) => void
  onDeleteItem: (itemId: string) => void
  onDeleteColumn: (columnId: string) => void
  onAddColumn: () => void
  // Add item inline
  addingToColumn: string | null
  newItemTitle: string
  newItemDate: string
  newItemRef: React.RefObject<HTMLInputElement | null>
  onStartAddItem: (columnId: string) => void
  onNewItemTitleChange: (value: string) => void
  onNewItemDateChange: (value: string) => void
  onConfirmAddItem: (columnId: string) => void
  onCancelAddItem: () => void
}

export default function GenericKanbanView({
  board,
  dragItem,
  dragOverColumn,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  editingItemId,
  editingItemTitle,
  onStartEditTitle,
  onEditTitleChange,
  onSaveTitle,
  onCancelEdit,
  onStartEditDate,
  onDateChange,
  onClearDate,
  onToggleStatus,
  onDeleteItem,
  onDeleteColumn,
  onAddColumn,
  addingToColumn,
  newItemTitle,
  newItemDate,
  newItemRef,
  onStartAddItem,
  onNewItemTitleChange,
  onNewItemDateChange,
  onConfirmAddItem,
  onCancelAddItem,
}: GenericKanbanViewProps) {
  return (
    <div className="flex-1 flex gap-4 p-4 overflow-x-auto">
      {board.columns?.map(column => (
        <KanbanColumn
          key={column.id}
          title={column.title}
          itemCount={column.items.length}
          onAddItem={() => onStartAddItem(column.id)}
          onDelete={() => onDeleteColumn(column.id)}
          isDragOver={dragOverColumn === column.id}
          onDragOver={(e) => onDragOver(e, column.id)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, column.id)}
          footer={
            <>
              {/* Add item inline */}
              {addingToColumn === column.id && (
                <div className="border-t border-slate-100 p-2">
                  <div className="border border-blue-200 rounded-lg p-2.5 bg-blue-50/30">
                    <input
                      ref={newItemRef}
                      value={newItemTitle}
                      onChange={(e) => onNewItemTitleChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onConfirmAddItem(column.id)
                        if (e.key === 'Escape') onCancelAddItem()
                      }}
                      placeholder="Título del item..."
                      className="w-full text-body-sm border border-slate-300 rounded px-3 py-2 min-h-input focus:ring-1 focus:ring-blue-400 outline-none"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1 flex-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <input
                          type="date"
                          value={newItemDate}
                          onChange={(e) => onNewItemDateChange(e.target.value)}
                          className="text-body-sm border border-slate-200 rounded px-2 py-1 text-slate-500 focus:ring-1 focus:ring-blue-400 outline-none"
                          title={board.type === 'CLASS_LOG' ? 'Fecha del evento (opcional)' : 'Fecha límite (opcional)'}
                        />
                        {newItemDate && (
                          <button onClick={() => onNewItemDateChange('')} className="text-slate-300 hover:text-red-400">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={onCancelAddItem}
                          className="px-3 py-1.5 text-body-sm text-slate-500 hover:bg-slate-100 rounded min-h-[36px]"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => onConfirmAddItem(column.id)}
                          className="px-3 py-1.5 text-body-sm bg-blue-600 text-white rounded hover:bg-blue-700 min-h-[36px]"
                        >
                          Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Add item button at bottom */}
              {addingToColumn !== column.id && (
                <div className="px-2 pb-2">
                  <button
                    onClick={() => onStartAddItem(column.id)}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-body-sm text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Agregar item
                  </button>
                </div>
              )}
            </>
          }
        >
          {column.items.map(item => (
            <KanbanCard
              key={item.id}
              item={item}
              isDragging={dragItem?.id === item.id}
              onDragStart={(e) => onDragStart(e, item)}
              statusIcon={STATUS_ICONS[item.status] || STATUS_ICONS.TODO}
              onToggleStatus={() => onToggleStatus(item)}
              onDoubleClickTitle={() => onStartEditTitle(item.id, item.title)}
              editingInline={editingItemId === item.id}
              editingTitle={editingItemTitle}
              onEditTitleChange={onEditTitleChange}
              onEditTitleBlur={() => onSaveTitle(item.id)}
              onEditTitleKeyDown={(e) => {
                if (e.key === 'Enter') onSaveTitle(item.id)
                if (e.key === 'Escape') onCancelEdit()
              }}
              editingDate={editingItemId === `date-${item.id}`}
              onDateClick={() => onStartEditDate(item.id)}
              onDateChange={(val) => onDateChange(item.id, val)}
              onDateClear={() => onClearDate(item.id)}
              onDateBlur={onCancelEdit}
              dateFieldType={board.type === 'CLASS_LOG' ? 'eventDate' : 'dueDate'}
              onEdit={() => onStartEditTitle(item.id, item.title)}
              onDelete={() => onDeleteItem(item.id)}
            />
          ))}
        </KanbanColumn>
      ))}

      {/* Add column button */}
      <div className="flex-shrink-0 w-80">
        <button
          onClick={onAddColumn}
          className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-300 rounded-card text-slate-400 hover:text-slate-600 hover:border-slate-400 transition-colors min-h-btn"
        >
          <Plus className="w-5 h-5" />
          <span className="text-body-sm">Nueva columna</span>
        </button>
      </div>
    </div>
  )
}
