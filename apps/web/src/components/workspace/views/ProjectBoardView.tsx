import { Clock, Pencil, Plus, Trash2 } from 'lucide-react'
import { WorkspaceBoard, WorkspaceItem } from '../types'
import { WBadge } from '../ui'
import KanbanColumn from '../KanbanColumn'

const COL_GRADIENTS: Record<string, string> = {
  'Ideas': 'bg-gradient-to-b from-purple-50 to-purple-100/50',
  'En progreso': 'bg-gradient-to-b from-amber-50 to-amber-100/50',
  'Finalizado': 'bg-gradient-to-b from-green-50 to-green-100/50',
  'Por hacer': 'bg-gradient-to-b from-blue-50 to-blue-100/50',
  'En proceso': 'bg-gradient-to-b from-amber-50 to-amber-100/50',
  'Hecho': 'bg-gradient-to-b from-green-50 to-green-100/50',
}

const PRI_BORDER: Record<string, string> = { HIGH: 'border-l-red-500', MEDIUM: 'border-l-amber-400', LOW: 'border-l-green-400' }
const PRI_LABELS: Record<string, string> = { HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' }
const PRI_VARIANT: Record<string, 'danger' | 'warning' | 'success'> = { HIGH: 'danger', MEDIUM: 'warning', LOW: 'success' }

interface ProjectBoardViewProps {
  board: WorkspaceBoard
  dragItem: WorkspaceItem | null
  onDragStart: (e: React.DragEvent, item: WorkspaceItem) => void
  onDragOver: (e: React.DragEvent, columnId: string) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, columnId: string) => void
  dragOverColumn: string | null
  onAddTask: (columnId: string) => void
  onEditTask: (columnId: string, item: WorkspaceItem) => void
  onDeleteColumn: (columnId: string) => void
  onDeleteItem: (itemId: string) => void
  onAddColumn: () => void
}

export default function ProjectBoardView({
  board,
  dragItem,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  dragOverColumn,
  onAddTask,
  onEditTask,
  onDeleteColumn,
  onDeleteItem,
  onAddColumn,
}: ProjectBoardViewProps) {
  // Project progress bar
  const allItems = board.columns?.flatMap(c => c.items) || []
  const total = allItems.length
  const doneCol = board.columns?.find(c =>
    c.title.toLowerCase().includes('finaliz') || c.title.toLowerCase().includes('hecho') || c.title.toLowerCase().includes('done')
  )
  const doneCount = doneCol?.items.length || 0
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0
  const overdue = allItems.filter(i => i.dueDate && new Date(i.dueDate) < new Date() && i.status !== 'DONE').length
  const highPri = allItems.filter(i => ((i.metadata as any)?.priority === 'HIGH')).length

  return (
    <div className="flex-1 flex flex-col">
      {/* Project progress bar */}
      {total > 0 && (
        <div className="px-5 pt-4 pb-1">
          <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4 text-body-sm">
                <span className="text-slate-500"><span className="font-bold text-slate-700">{total}</span> tareas</span>
                <span className="text-green-600"><span className="font-bold">{doneCount}</span> completadas</span>
                {overdue > 0 && <span className="text-red-500"><span className="font-bold">{overdue}</span> vencidas</span>}
                {highPri > 0 && <span className="text-orange-500"><span className="font-bold">{highPri}</span> alta prioridad</span>}
              </div>
              <span className="text-body-sm font-bold text-blue-600">{pct}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Kanban columns */}
      <div className="flex-1 flex gap-5 p-5 overflow-x-auto">
        {board.columns?.map(column => {
          const bg = COL_GRADIENTS[column.title] || 'bg-gradient-to-b from-slate-50 to-slate-100/50'
          return (
            <KanbanColumn
              key={column.id}
              title={column.title}
              itemCount={column.items.length}
              bgClass={bg}
              countBgClass="bg-white"
              onAddItem={() => onAddTask(column.id)}
              onDelete={() => onDeleteColumn(column.id)}
              addLabel="Nueva tarea"
              isDragOver={dragOverColumn === column.id}
              onDragOver={(e) => onDragOver(e, column.id)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, column.id)}
            >
              {column.items.map((item: WorkspaceItem) => {
                const meta = (item.metadata || {}) as any
                const pri = meta.priority || 'MEDIUM'
                const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status !== 'DONE'
                const checklist: { text: string; done: boolean }[] = meta.checklist || []
                const checkDone = checklist.filter(c => c.done).length
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, item)}
                    className={`bg-white rounded-lg border-l-4 ${PRI_BORDER[pri]} border border-slate-200/60 p-3.5 min-h-card cursor-grab active:cursor-grabbing hover:shadow-md hover:border-slate-300/60 transition-all duration-150 group ${
                      dragItem?.id === item.id ? 'opacity-40' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <p
                        className="text-body-sm font-medium text-slate-800 leading-tight flex-1 cursor-pointer"
                        onDoubleClick={() => onEditTask(item.columnId || '', item)}
                      >
                        {item.title}
                      </p>
                      <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 flex-shrink-0 ml-1">
                        <button
                          onClick={() => onEditTask(item.columnId || '', item)}
                          className="p-1 rounded hover:bg-slate-100"
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-400" />
                        </button>
                        <button onClick={() => onDeleteItem(item.id)} className="p-1 rounded hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </div>
                    {item.content && <p className="text-body-sm text-slate-500 mt-1 line-clamp-2">{item.content}</p>}
                    <div className="flex items-center flex-wrap gap-1.5 mt-2">
                      <WBadge variant={PRI_VARIANT[pri]}>{PRI_LABELS[pri]}</WBadge>
                      {item.dueDate && (
                        <WBadge
                          variant={isOverdue ? 'danger' : 'default'}
                          icon={<Clock className="w-3 h-3" />}
                        >
                          {new Date(item.dueDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                        </WBadge>
                      )}
                      {checklist.length > 0 && (
                        <WBadge variant={checkDone === checklist.length ? 'success' : 'default'}>
                          ✓ {checkDone}/{checklist.length}
                        </WBadge>
                      )}
                    </div>
                  </div>
                )
              })}
              {column.items.length === 0 && (
                <div className="text-center py-8 text-slate-300">
                  <p className="text-body-sm">Sin tareas</p>
                </div>
              )}
            </KanbanColumn>
          )
        })}

        {/* Add phase */}
        <div className="flex-shrink-0 w-80">
          <button
            onClick={onAddColumn}
            className="w-full flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-300 hover:text-slate-500 hover:border-slate-300 transition-all duration-150 min-h-btn"
          >
            <Plus className="w-5 h-5" /><span className="text-body-sm">Nueva fase</span>
          </button>
        </div>
      </div>
    </div>
  )
}
