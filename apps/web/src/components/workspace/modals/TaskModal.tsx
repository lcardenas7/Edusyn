import { X } from 'lucide-react'
import { WModal, WButton, WInput } from '../ui'

interface TaskFormState {
  title: string
  description: string
  priority: string
  dueDate: string
  checklist: { text: string; done: boolean }[]
}

interface TaskModalProps {
  open: boolean
  onClose: () => void
  isEditing: boolean
  form: TaskFormState
  onFormChange: (updater: (prev: TaskFormState) => TaskFormState) => void
  saving: boolean
  onSave: () => void
}

const PRIORITIES = [
  { key: 'LOW', label: 'Baja', color: 'bg-green-100 text-green-700 border-green-200' },
  { key: 'MEDIUM', label: 'Media', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: 'HIGH', label: 'Alta', color: 'bg-red-100 text-red-700 border-red-200' },
]

export default function TaskModal({
  open,
  onClose,
  isEditing,
  form,
  onFormChange,
  saving,
  onSave,
}: TaskModalProps) {
  return (
    <WModal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar tarea' : 'Nueva tarea'}
      footer={
        <>
          <WButton variant="ghost" onClick={onClose}>Cancelar</WButton>
          <WButton
            onClick={onSave}
            disabled={saving || !form.title.trim()}
            loading={saving}
          >
            {isEditing ? 'Guardar cambios' : 'Crear tarea'}
          </WButton>
        </>
      }
    >
      <WInput
        label="Título"
        value={form.title}
        onChange={(e) => onFormChange(f => ({ ...f, title: e.target.value }))}
        placeholder="Nombre de la tarea..."
        autoFocus
      />

      <div>
        <label className="block text-body-sm font-medium text-slate-700 mb-1">Descripción</label>
        <textarea
          value={form.description}
          onChange={(e) => onFormChange(f => ({ ...f, description: e.target.value }))}
          placeholder="Detalles opcionales..."
          rows={2}
          className="w-full min-h-input px-3 py-2 border border-slate-300 rounded-lg text-body-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-body-sm font-medium text-slate-700 mb-1">Prioridad</label>
          <div className="flex gap-1.5">
            {PRIORITIES.map(p => (
              <button
                key={p.key}
                onClick={() => onFormChange(f => ({ ...f, priority: p.key }))}
                className={`px-3 py-1.5 text-badge rounded-full border font-medium transition-all min-h-[32px] ${
                  form.priority === p.key ? p.color + ' ring-1 ring-offset-1' : 'bg-white text-slate-400 border-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <WInput
          label="Fecha límite"
          type="date"
          value={form.dueDate}
          onChange={(e) => onFormChange(f => ({ ...f, dueDate: e.target.value }))}
        />
      </div>

      {/* Checklist */}
      <div>
        <label className="block text-body-sm font-medium text-slate-700 mb-1">Sub-tareas</label>
        <div className="space-y-2">
          {form.checklist.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => {
                  const cl = [...form.checklist]
                  cl[idx] = { ...cl[idx], done: !cl[idx].done }
                  onFormChange(f => ({ ...f, checklist: cl }))
                }}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <input
                value={item.text}
                onChange={(e) => {
                  const cl = [...form.checklist]
                  cl[idx] = { ...cl[idx], text: e.target.value }
                  onFormChange(f => ({ ...f, checklist: cl }))
                }}
                placeholder="Sub-tarea..."
                className={`flex-1 text-body-sm border-b border-slate-200 py-1 outline-none focus:border-blue-400 ${
                  item.done ? 'line-through text-slate-400' : ''
                }`}
              />
              <button
                onClick={() => onFormChange(f => ({ ...f, checklist: f.checklist.filter((_, i) => i !== idx) }))}
                className="text-slate-300 hover:text-red-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => onFormChange(f => ({ ...f, checklist: [...f.checklist, { text: '', done: false }] }))}
            className="text-body-sm text-blue-600 hover:underline"
          >
            + Agregar sub-tarea
          </button>
        </div>
      </div>
    </WModal>
  )
}
