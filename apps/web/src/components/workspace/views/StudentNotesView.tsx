import { BookOpen, Plus, Users } from 'lucide-react'
import { WorkspaceBoard, WorkspaceItem } from '../types'
import { WBadge } from '../ui'
import KanbanColumn from '../KanbanColumn'
import { teacherWorkspaceApi } from '../../../lib/api'

const CAT_VARIANTS: Record<string, 'info' | 'warning' | 'success' | 'danger' | 'default'> = {
  ACADEMIC: 'info',
  BEHAVIORAL: 'warning',
  POSITIVE: 'success',
  ALERT: 'danger',
  GENERAL: 'default',
}

const CAT_LABELS: Record<string, string> = {
  ACADEMIC: 'Académico',
  BEHAVIORAL: 'Convivencia',
  POSITIVE: 'Positivo',
  ALERT: 'Alerta',
  GENERAL: 'General',
}

interface StudentNotesViewProps {
  board: WorkspaceBoard
  onAddObservation: (columnId: string, columnTitle: string) => void
  onReloadBoard: () => void
}

export default function StudentNotesView({ board, onAddObservation, onReloadBoard }: StudentNotesViewProps) {
  return (
    <div className="flex-1 flex gap-4 p-4 overflow-x-auto">
      {board.columns?.map(column => (
        <KanbanColumn
          key={column.id}
          title={column.title}
          itemCount={column.items.length}
          bgClass="bg-white"
          countBgClass="bg-white"
          onAddItem={() => onAddObservation(column.id, column.title)}
          addLabel="Nueva observación"
        >
          {column.items.map((item: WorkspaceItem) => {
            const meta = (item.metadata || {}) as any
            const cat = meta.category || 'GENERAL'
            return (
              <div key={item.id} className="bg-slate-50 rounded-lg p-3 border border-slate-100 hover:border-slate-200 transition-colors min-h-card">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-body-sm font-semibold text-slate-800">{item.title}</span>
                  <WBadge variant={CAT_VARIANTS[cat] || 'default'}>
                    {CAT_LABELS[cat] || cat}
                  </WBadge>
                </div>
                {item.content && <p className="text-body-sm text-slate-600 leading-relaxed">{item.content}</p>}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-badge text-slate-400">{meta.observationDate || item.createdAt?.slice(0, 10)}</span>
                  <button
                    onClick={async () => {
                      await teacherWorkspaceApi.deleteItem(item.id)
                      onReloadBoard()
                    }}
                    className="text-badge text-slate-300 hover:text-red-500 p-1"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
          {column.items.length === 0 && (
            <div className="text-center py-8 text-slate-300">
              <BookOpen className="w-6 h-6 mx-auto mb-1" />
              <p className="text-body-sm">Sin observaciones</p>
            </div>
          )}
        </KanbanColumn>
      ))}
    </div>
  )
}
