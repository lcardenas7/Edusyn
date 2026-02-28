import { Pencil, UserPlus, X } from 'lucide-react'
import { WorkspaceBoard, WorkspaceItem } from '../types'
import { teacherWorkspaceApi } from '../../../lib/api'

interface ClassroomRolesViewProps {
  board: WorkspaceBoard
  editingRoles: boolean
  onToggleEditRoles: () => void
  onAssignRole: (role: string) => void
  onReloadBoard: () => void
  onReloadSummary: () => void
}

export default function ClassroomRolesView({
  board,
  editingRoles,
  onToggleEditRoles,
  onAssignRole,
  onReloadBoard,
  onReloadSummary,
}: ClassroomRolesViewProps) {
  const boardMeta = (board.metadata as any) || {}
  const availableRoles: string[] = boardMeta.roles || []
  const allItems = board.columns?.[0]?.items || board.items || []

  // Build role → assigned student map
  const roleAssignments: Record<string, { item: WorkspaceItem; meta: any }> = {}
  for (const item of allItems) {
    const meta = (item.metadata || {}) as any
    if (meta.role) roleAssignments[meta.role] = { item, meta }
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header with edit roles button */}
      <div className="flex items-center justify-between">
        <p className="text-body-sm text-slate-500">{availableRoles.length} roles · {Object.keys(roleAssignments).length} asignados</p>
        <button
          onClick={onToggleEditRoles}
          className="text-body-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          <Pencil className="w-3.5 h-3.5" /> {editingRoles ? 'Listo' : 'Editar roles'}
        </button>
      </div>

      {/* Edit roles inline */}
      {editingRoles && (
        <div className="bg-white rounded-card border border-blue-200 p-4 space-y-2">
          {availableRoles.map((role, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={role}
                onChange={(e) => {
                  const newRoles = [...availableRoles]
                  newRoles[idx] = e.target.value
                  teacherWorkspaceApi.updateBoard(board.id, { metadata: { ...boardMeta, roles: newRoles } })
                    .then(() => onReloadBoard())
                }}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-body-sm min-h-input focus:ring-1 focus:ring-blue-400 outline-none"
              />
              <button
                onClick={() => {
                  const newRoles = availableRoles.filter((_, i) => i !== idx)
                  teacherWorkspaceApi.updateBoard(board.id, { metadata: { ...boardMeta, roles: newRoles } })
                    .then(() => onReloadBoard())
                }}
                className="p-1.5 text-red-400 hover:text-red-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              const newRoles = [...availableRoles, '']
              teacherWorkspaceApi.updateBoard(board.id, { metadata: { ...boardMeta, roles: newRoles } })
                .then(() => onReloadBoard())
            }}
            className="text-body-sm text-blue-600 hover:underline"
          >
            + Agregar rol
          </button>
        </div>
      )}

      {/* Roles cards */}
      <div className="grid gap-3">
        {availableRoles.map((role) => {
          const assignment = roleAssignments[role]
          return (
            <div
              key={role}
              className={`bg-white rounded-xl border p-5 flex items-center justify-between min-h-card shadow-sm hover:shadow-md transition-all duration-150 ${
                assignment ? 'border-green-100' : 'border-slate-100'
              }`}
            >
              <div>
                <h4 className="text-body-base font-bold text-slate-800">{role}</h4>
                {assignment ? (
                  <p className="text-body-sm text-green-600 font-medium mt-1">{assignment.item.title}</p>
                ) : (
                  <p className="text-body-sm text-slate-300 mt-1">Sin asignar</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {assignment ? (
                  <button
                    onClick={async () => {
                      await teacherWorkspaceApi.updateItem(assignment.item.id, { metadata: { ...assignment.meta, role: '' } })
                      onReloadBoard()
                      onReloadSummary()
                    }}
                    className="px-3 py-1.5 text-badge text-red-500 hover:bg-red-50 rounded-lg min-h-[36px]"
                  >
                    Remover
                  </button>
                ) : (
                  <button
                    onClick={() => onAssignRole(role)}
                    className="px-3 py-1.5 text-badge bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium flex items-center gap-1.5 min-h-[36px]"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Asignar
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
