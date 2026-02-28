import { Loader2, Search } from 'lucide-react'
import { WModal, WButton } from '../ui'

interface AssignRoleModalProps {
  open: boolean
  roleName: string | null
  onClose: () => void
  searchQuery: string
  onSearchChange: (q: string) => void
  results: { itemId: string; studentRecordId: string; fullName: string }[]
  addingStudent: string | null
  onAssign: (itemId: string, role: string) => void
}

export default function AssignRoleModal({
  open,
  roleName,
  onClose,
  searchQuery,
  onSearchChange,
  results,
  addingStudent,
  onAssign,
}: AssignRoleModalProps) {
  return (
    <WModal
      open={open}
      onClose={onClose}
      title={`Asignar: ${roleName || ''}`}
      subtitle="Busca un estudiante del grupo"
      size="sm"
      footer={<WButton variant="ghost" onClick={onClose}>Cancelar</WButton>}
    >
      <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 min-h-input">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Nombre del estudiante..."
          autoFocus
          className="flex-1 text-body-sm border-none outline-none bg-transparent py-2"
        />
      </div>
      <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
        {results.map((s) => (
          <div key={s.itemId} className="flex items-center justify-between py-2.5 px-1">
            <span className="text-body-sm text-slate-700">{s.fullName}</span>
            <button
              onClick={() => roleName && onAssign(s.itemId, roleName)}
              disabled={addingStudent === s.itemId}
              className="px-3 py-1.5 text-badge bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50 font-medium min-h-[36px]"
            >
              {addingStudent === s.itemId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Seleccionar'}
            </button>
          </div>
        ))}
        {searchQuery && results.length === 0 && (
          <p className="text-body-sm text-slate-400 text-center py-4">No se encontraron estudiantes sin rol asignado</p>
        )}
        {!searchQuery && results.length === 0 && (
          <p className="text-body-sm text-slate-400 text-center py-4">Escribe para buscar...</p>
        )}
      </div>
    </WModal>
  )
}
