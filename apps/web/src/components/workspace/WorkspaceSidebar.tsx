import { Archive, LayoutGrid, Trash2 } from 'lucide-react'
import { WorkspaceBoard, BOARD_TYPES } from './types'

interface WorkspaceSidebarProps {
  boards: WorkspaceBoard[]
  activeBoardId?: string
  collapsed: boolean
  onToggleCollapse: () => void
  onSelectBoard: (boardId: string) => void
  onCreateBoard: () => void
  onArchiveBoard: (boardId: string) => void
  onDeleteBoard: (boardId: string) => void
}

export default function WorkspaceSidebar({
  boards,
  activeBoardId,
  collapsed,
  onToggleCollapse,
  onSelectBoard,
  onCreateBoard,
  onArchiveBoard,
  onDeleteBoard,
}: WorkspaceSidebarProps) {
  return (
    <div
      className={`flex-shrink-0 border-r border-slate-100 bg-white overflow-y-auto transition-all duration-200 ${
        collapsed ? 'w-0 overflow-hidden border-r-0' : 'w-60'
      }`}
    >
      <div className="p-3 space-y-1.5">
        {boards.length === 0 ? (
          <div className="text-center py-16">
            <LayoutGrid className="w-10 h-10 mx-auto text-slate-200 mb-3" />
            <p className="text-body-sm text-slate-400">Sin tableros aún</p>
            <button
              onClick={onCreateBoard}
              className="mt-3 text-body-sm text-blue-600 hover:underline font-medium"
            >
              Crear primer tablero
            </button>
          </div>
        ) : (
          boards.map(board => {
            const bt = BOARD_TYPES[board.type] || BOARD_TYPES.KANBAN
            const isActive = activeBoardId === board.id
            const isSeatingBoard = board.type === 'KANBAN' && ((board.metadata || {}) as any)?.template === 'CLASSROOM_SEATING'
            return (
              <div
                key={board.id}
                onClick={() => onSelectBoard(board.id)}
                className={`group relative p-3 rounded-lg cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-50/80 border-l-[3px] border-l-blue-500 border border-blue-100'
                    : 'hover:bg-slate-50 border-l-[3px] border-l-transparent border border-transparent'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-lg flex-shrink-0 leading-none mt-0.5">{bt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-body-sm font-medium truncate ${isActive ? 'text-blue-900' : 'text-slate-700'}`}>
                      {board.title}
                    </p>
                    <p className="text-badge text-slate-400 mt-0.5">
                      {isSeatingBoard ? 'Organizador de salón' : bt.label}
                      {board.group && ` · ${board.group.grade?.name || ''} ${board.group.name}`}
                    </p>
                    <p className="text-badge text-slate-300 mt-0.5">
                      {isSeatingBoard
                        ? `${Number(((board.metadata || {}) as any)?.seating?.rows || 0) * Number(((board.metadata || {}) as any)?.seating?.columns || 0)} puestos`
                        : `${board._count?.items ?? 0} items`}
                    </p>
                  </div>
                  {/* Actions */}
                  <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 flex-shrink-0 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); onArchiveBoard(board.id) }}
                      className="p-1 rounded hover:bg-slate-100" title="Archivar"
                    >
                      <Archive className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteBoard(board.id) }}
                      className="p-1 rounded hover:bg-red-50" title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-slate-300 hover:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
