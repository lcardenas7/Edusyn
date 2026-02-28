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
      className={`flex-shrink-0 border-r border-slate-200 bg-slate-50 overflow-y-auto transition-all duration-200 ${
        collapsed ? 'w-0 overflow-hidden border-r-0' : 'w-60 xl:w-64'
      }`}
    >
      <div className="p-3 space-y-2">
        {boards.length === 0 ? (
          <div className="text-center py-12">
            <LayoutGrid className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <p className="text-body-sm text-slate-500">Sin tableros aún</p>
            <button
              onClick={onCreateBoard}
              className="mt-3 text-body-sm text-blue-600 hover:underline"
            >
              Crear primer tablero
            </button>
          </div>
        ) : (
          boards.map(board => {
            const bt = BOARD_TYPES[board.type] || BOARD_TYPES.KANBAN
            const isActive = activeBoardId === board.id
            return (
              <div
                key={board.id}
                onClick={() => onSelectBoard(board.id)}
                className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
                  isActive
                    ? 'bg-blue-50 border border-blue-200 shadow-sm'
                    : 'bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-h3 flex-shrink-0 leading-none">{bt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-body-sm font-medium truncate ${isActive ? 'text-blue-900' : 'text-slate-800'}`}>
                      {board.title}
                    </p>
                    <p className="text-badge text-slate-500 mt-0.5">
                      {bt.label}
                      {board.group && ` · ${board.group.grade?.name || ''} ${board.group.name}`}
                    </p>
                    <p className="text-badge text-slate-400 mt-0.5">
                      {board._count?.items ?? 0} items
                    </p>
                  </div>
                  {/* Actions */}
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); onArchiveBoard(board.id) }}
                      className="p-1 rounded hover:bg-slate-100" title="Archivar"
                    >
                      <Archive className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onDeleteBoard(board.id) }}
                      className="p-1 rounded hover:bg-red-50" title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
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
