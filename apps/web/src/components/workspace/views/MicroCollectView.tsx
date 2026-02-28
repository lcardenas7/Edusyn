import { DollarSign, Loader2, Percent, Plus, Search, Target, UserPlus, Users, X } from 'lucide-react'
import { WorkspaceBoard, WorkspaceItem } from '../types'
import { WSummaryCard } from '../ui'
import { WBadge } from '../ui'

interface MicroCollectViewProps {
  board: WorkspaceBoard
  boardSummary: any
  // Add student
  showAddStudent: boolean
  studentSearch: string
  studentResults: any[]
  addingStudent: string | null
  onToggleAddStudent: (show: boolean) => void
  onStudentSearchChange: (q: string) => void
  onAddStudent: (studentRecordId: string) => void
  // Pay
  onPayClick: (item: WorkspaceItem, meta: any, amountPaid: number) => void
  onUndoPay: (item: WorkspaceItem, meta: any) => void
}

export default function MicroCollectView({
  board,
  boardSummary,
  showAddStudent,
  studentSearch,
  studentResults,
  addingStudent,
  onToggleAddStudent,
  onStudentSearchChange,
  onAddStudent,
  onPayClick,
  onUndoPay,
}: MicroCollectViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Summary bar */}
      {boardSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <WSummaryCard
            label="Meta"
            value={`$${(boardSummary.goalAmount || 0).toLocaleString()}`}
            icon={<Target className="w-4 h-4 text-slate-400" />}
          />
          <WSummaryCard
            label="Recaudado"
            value={`$${(boardSummary.totalCollected || 0).toLocaleString()}`}
            icon={<DollarSign className="w-4 h-4 text-green-500" />}
            valueColor="text-green-600"
          />
          <div className="bg-white rounded-card border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="w-4 h-4 text-blue-500" />
              <span className="text-badge font-medium text-slate-400 uppercase tracking-wide">Progreso</span>
            </div>
            <p className="text-metrics-xl font-bold text-blue-600">{boardSummary.percentage || 0}%</p>
            <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(boardSummary.percentage || 0, 100)}%` }} />
            </div>
          </div>
          <div className="bg-white rounded-card border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-badge font-medium text-slate-400 uppercase tracking-wide">Estado</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-body-sm text-green-600 font-semibold">{boardSummary.paidCount || 0} ✓</span>
              <span className="text-body-sm text-amber-500 font-semibold">{boardSummary.partialCount || 0} ~</span>
              <span className="text-body-sm text-red-500 font-semibold">{boardSummary.pendingCount || 0} ✗</span>
            </div>
          </div>
        </div>
      )}

      {/* Student payment table */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100">
              <th className="text-left px-5 min-h-row py-3 font-semibold text-slate-500 text-badge uppercase tracking-wide">#</th>
              <th className="text-left px-5 min-h-row py-3 font-semibold text-slate-500 text-badge uppercase tracking-wide">Estudiante</th>
              <th className="text-right px-5 min-h-row py-3 font-semibold text-slate-500 text-badge uppercase tracking-wide">Pagado</th>
              <th className="text-left px-5 min-h-row py-3 font-semibold text-slate-500 text-badge uppercase tracking-wide">Estado</th>
              <th className="text-right px-5 min-h-row py-3 font-semibold text-slate-500 text-badge uppercase tracking-wide">Acción</th>
            </tr>
          </thead>
          <tbody>
            {(board.columns?.[0]?.items || board.items || []).map((item: WorkspaceItem, idx: number) => {
              const meta = (item.metadata || {}) as any
              const payStatus = meta.status || 'PENDING'
              const amountPaid = Number(meta.amountPaid) || 0
              return (
                <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors min-h-row">
                  <td className="px-5 py-3.5 text-slate-300">{idx + 1}</td>
                  <td className="px-5 py-3.5 font-medium text-slate-800">{item.title}</td>
                  <td className="px-5 py-3.5 text-right font-mono text-slate-700">${amountPaid.toLocaleString()}</td>
                  <td className="px-5 py-3.5">
                    <WBadge variant={payStatus === 'PAID' ? 'success' : payStatus === 'PARTIAL' ? 'warning' : 'danger'}>
                      {payStatus === 'PAID' ? 'Pagado' : payStatus === 'PARTIAL' ? 'Parcial' : 'Pendiente'}
                    </WBadge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {payStatus !== 'PAID' ? (
                      <button
                        onClick={() => onPayClick(item, meta, amountPaid)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-badge bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium min-h-[36px]"
                      >
                        <DollarSign className="w-3.5 h-3.5" /> Registrar pago
                      </button>
                    ) : (
                      <button
                        onClick={() => onUndoPay(item, meta)}
                        className="px-3 py-1.5 text-badge text-slate-400 hover:text-red-500 rounded hover:bg-red-50 min-h-[36px]"
                      >
                        ↩ Deshacer
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add student search */}
      {showAddStudent ? (
        <div className="bg-white rounded-card border border-blue-200 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              value={studentSearch}
              onChange={(e) => onStudentSearchChange(e.target.value)}
              placeholder="Buscar estudiante por nombre..."
              autoFocus
              className="flex-1 text-body-sm border-none outline-none bg-transparent"
            />
            <button onClick={() => onToggleAddStudent(false)} className="p-1 rounded hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          {studentResults.length > 0 && (
            <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
              {studentResults.map((s: any) => (
                <div key={s.studentRecordId} className="flex items-center justify-between py-2 px-1">
                  <span className="text-body-sm text-slate-700">{s.fullName}</span>
                  <button
                    onClick={() => onAddStudent(s.studentRecordId)}
                    disabled={addingStudent === s.studentRecordId}
                    className="px-3 py-1.5 text-badge bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50 flex items-center gap-1 min-h-[36px]"
                  >
                    {addingStudent === s.studentRecordId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Agregar
                  </button>
                </div>
              ))}
            </div>
          )}
          {studentSearch && studentResults.length === 0 && (
            <p className="text-body-sm text-slate-400 text-center py-2">No se encontraron estudiantes disponibles</p>
          )}
        </div>
      ) : (
        <button
          onClick={() => onToggleAddStudent(true)}
          className="flex items-center gap-2 px-3 min-h-btn text-body-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <UserPlus className="w-4 h-4" /> Agregar estudiante
        </button>
      )}
    </div>
  )
}
