import { Loader2, Search, X } from 'lucide-react'
import { WModal, WButton, WInput } from '../ui'

interface ObservationModalProps {
  open: boolean
  onClose: () => void
  columnTitle: string
  // Student search
  selectedStudent: { studentRecordId: string; fullName: string } | null
  studentSearch: string
  studentResults: any[]
  onStudentSearchChange: (q: string) => void
  onSelectStudent: (student: { studentRecordId: string; fullName: string }) => void
  onClearStudent: () => void
  // Observation fields
  category: string
  onCategoryChange: (cat: string) => void
  date: string
  onDateChange: (date: string) => void
  text: string
  onTextChange: (text: string) => void
  // Save
  saving: boolean
  onSave: () => void
}

const CATEGORIES = [
  { key: 'GENERAL', label: 'General', color: 'bg-slate-100 text-slate-600 border-slate-200' },
  { key: 'ACADEMIC', label: 'Académico', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'BEHAVIORAL', label: 'Convivencia', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'POSITIVE', label: 'Positivo', color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'ALERT', label: 'Alerta', color: 'bg-red-100 text-red-700 border-red-200' },
]

export default function ObservationModal({
  open,
  onClose,
  columnTitle,
  selectedStudent,
  studentSearch,
  studentResults,
  onStudentSearchChange,
  onSelectStudent,
  onClearStudent,
  category,
  onCategoryChange,
  date,
  onDateChange,
  text,
  onTextChange,
  saving,
  onSave,
}: ObservationModalProps) {
  return (
    <WModal
      open={open}
      onClose={onClose}
      title="Nueva observación"
      subtitle={columnTitle}
      footer={
        <>
          <WButton variant="ghost" onClick={onClose}>Cancelar</WButton>
          <WButton
            onClick={onSave}
            disabled={saving || !selectedStudent || !text.trim()}
            loading={saving}
          >
            Guardar
          </WButton>
        </>
      }
    >
      {/* Student search */}
      {!selectedStudent ? (
        <div>
          <label className="block text-body-sm font-medium text-slate-700 mb-1">Estudiante</label>
          <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 min-h-input">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              value={studentSearch}
              onChange={(e) => onStudentSearchChange(e.target.value)}
              placeholder="Buscar estudiante por nombre..."
              autoFocus
              className="flex-1 text-body-sm border-none outline-none bg-transparent py-2"
            />
          </div>
          <div className="max-h-36 overflow-y-auto mt-1 divide-y divide-slate-100">
            {studentResults.map((s: any) => (
              <button
                key={s.studentRecordId}
                onClick={() => onSelectStudent({ studentRecordId: s.studentRecordId, fullName: s.fullName })}
                className="w-full text-left px-2 py-2 text-body-sm text-slate-700 hover:bg-blue-50 rounded"
              >
                {s.fullName}
              </button>
            ))}
            {studentSearch && studentResults.length === 0 && (
              <p className="text-body-sm text-slate-400 text-center py-3">No se encontraron estudiantes</p>
            )}
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-body-sm font-medium text-slate-700 mb-1">Estudiante</label>
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 min-h-input">
            <span className="text-body-sm font-medium text-blue-800">{selectedStudent.fullName}</span>
            <button onClick={onClearStudent} className="text-blue-400 hover:text-blue-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Category */}
      <div>
        <label className="block text-body-sm font-medium text-slate-700 mb-1">Tipo</label>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => onCategoryChange(c.key)}
              className={`px-3 py-1.5 text-badge rounded-full border font-medium transition-all min-h-[32px] ${
                category === c.key ? c.color + ' ring-1 ring-offset-1' : 'bg-white text-slate-400 border-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <WInput
        label="Fecha"
        type="date"
        value={date}
        onChange={(e) => onDateChange(e.target.value)}
      />

      {/* Observation text */}
      <div>
        <label className="block text-body-sm font-medium text-slate-700 mb-1">Observación</label>
        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Describe la observación del estudiante..."
          rows={3}
          className="w-full min-h-input px-3 py-2 border border-slate-300 rounded-lg text-body-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
        />
      </div>
    </WModal>
  )
}
