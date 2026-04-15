import { Loader2, X } from 'lucide-react'
import { BOARD_TYPES } from '../types'
import { WModal, WButton, WInput } from '../ui'

interface CreateFormState {
  type: string; title: string; description: string;
  scopeType: string; groupId: string; gradeId: string; groupIds: string[];
  template: string; seatingRows: string; seatingColumns: string;
  goalAmount: string; concept: string; allowPartial: boolean; roles: string[];
  autoPopulate: boolean;
}

interface CreateBoardModalProps {
  open: boolean
  onClose: () => void
  form: CreateFormState
  onFormChange: (updater: (prev: CreateFormState) => CreateFormState) => void
  scopeOptions: { groups: any[]; grades: any[] }
  creating: boolean
  onSubmit: () => void
}

export default function CreateBoardModal({
  open,
  onClose,
  form,
  onFormChange,
  scopeOptions,
  creating,
  onSubmit,
}: CreateBoardModalProps) {
  return (
    <WModal
      open={open}
      onClose={onClose}
      title="Nuevo Tablero"
      footer={
        <>
          <WButton variant="ghost" onClick={onClose}>Cancelar</WButton>
          <WButton onClick={onSubmit} disabled={creating || !form.title.trim()} loading={creating}>
            Crear Tablero
          </WButton>
        </>
      }
    >
      {/* Board type selector */}
      <div>
        <label className="block text-body-sm font-medium text-slate-700 mb-2">Tipo de tablero</label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(BOARD_TYPES).map(([key, bt]) => (
            <button
              key={key}
              onClick={() => onFormChange(f => ({ ...f, type: key }))}
              className={`flex items-center gap-2 p-3 rounded-lg border text-left text-body-sm transition-colors min-h-btn ${
                form.type === key
                  ? 'border-blue-400 bg-blue-50 text-blue-900'
                  : 'border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <span>{bt.icon}</span>
              <span className="truncate">{bt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <WInput
        label="Nombre"
        value={form.title}
        onChange={(e) => onFormChange(f => ({ ...f, title: e.target.value }))}
        placeholder="Ej: Plan semanal 7A, Bitácora Biología..."
        autoFocus
      />

      {/* Description */}
      <div>
        <label className="block text-body-sm font-medium text-slate-700 mb-1">Descripción (opcional)</label>
        <textarea
          value={form.description}
          onChange={(e) => onFormChange(f => ({ ...f, description: e.target.value }))}
          placeholder="Breve descripción del tablero..."
          rows={2}
          className="w-full min-h-input px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-body-sm resize-none"
        />
      </div>

      {/* KANBAN template selector */}
      {form.type === 'KANBAN' && (
        <div>
          <label className="block text-body-sm font-medium text-slate-700 mb-2">Plantilla del tablero</label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: 'DEFAULT', l: 'Kanban normal' },
              { v: 'CLASSROOM_SEATING', l: 'Organizador de salón' },
            ].map(o => (
              <button
                key={o.v}
                onClick={() => onFormChange(f => ({ ...f, template: o.v }))}
                className={`flex items-center justify-center p-3 rounded-lg border text-body-sm font-medium transition-colors min-h-btn ${
                  form.template === o.v
                    ? 'border-blue-400 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
          {form.template === 'CLASSROOM_SEATING' && (
            <p className="text-badge text-slate-400 mt-2">
              El pizarrón quedará siempre abajo y las sillas se numerarán desde la izquierda.
            </p>
          )}
        </div>
      )}

      {/* Scope selector for structured boards */}
      {['MICRO_COLLECT', 'CLASSROOM_ROLES'].includes(form.type) || (form.type === 'KANBAN' && form.template === 'CLASSROOM_SEATING') ? (
        <>
          <div>
            <label className="block text-body-sm font-medium text-slate-700 mb-1">Alcance</label>
            <div className="flex gap-2">
              {[{ v: 'GROUP', l: 'Grupo' }, { v: 'GRADE', l: 'Grado' }, { v: 'MULTI_GROUP', l: 'Varios grupos' }].map(o => (
                <button
                  key={o.v}
                  onClick={() => onFormChange(f => ({ ...f, scopeType: o.v, groupId: '', gradeId: '', groupIds: [] }))}
                  className={`flex-1 px-3 py-2 rounded-lg border text-body-sm font-medium transition-colors min-h-btn ${
                    form.scopeType === o.v ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {form.scopeType === 'GROUP' && (
            <div>
              <label className="block text-body-sm font-medium text-slate-700 mb-1">Grupo</label>
              <select
                value={form.groupId}
                onChange={(e) => onFormChange(f => ({ ...f, groupId: e.target.value }))}
                className="w-full min-h-input px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-body-sm"
              >
                <option value="">Seleccionar grupo...</option>
                {scopeOptions.groups.map((g: any) => (
                  <option key={g.id} value={g.id}>{g.gradeName} {g.name}</option>
                ))}
              </select>
            </div>
          )}

          {form.scopeType === 'GRADE' && (
            <div>
              <label className="block text-body-sm font-medium text-slate-700 mb-1">Grado</label>
              <select
                value={form.gradeId}
                onChange={(e) => onFormChange(f => ({ ...f, gradeId: e.target.value }))}
                className="w-full min-h-input px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-body-sm"
              >
                <option value="">Seleccionar grado...</option>
                {scopeOptions.grades.map((g: any) => (
                  <option key={g.id} value={g.id}>{g.name} ({g.groups?.length || 0} grupos)</option>
                ))}
              </select>
            </div>
          )}

          {form.scopeType === 'MULTI_GROUP' && (
            <div>
              <label className="block text-body-sm font-medium text-slate-700 mb-1">
                Grupos ({form.groupIds.length} seleccionados)
              </label>
              <div className="max-h-32 overflow-y-auto border border-slate-300 rounded-lg p-2 space-y-1">
                {scopeOptions.groups.map((g: any) => (
                  <label key={g.id} className="flex items-center gap-2 text-body-sm cursor-pointer hover:bg-slate-50 px-1 rounded">
                    <input
                      type="checkbox"
                      checked={form.groupIds.includes(g.id)}
                      onChange={(e) => onFormChange(f => ({
                        ...f,
                        groupIds: e.target.checked ? [...f.groupIds, g.id] : f.groupIds.filter(id => id !== g.id)
                      }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{g.gradeName} {g.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {form.type === 'KANBAN' && form.template === 'CLASSROOM_SEATING' && (
            <div className="grid grid-cols-2 gap-3">
              <WInput
                label="Filas"
                type="number"
                min={1}
                value={form.seatingRows}
                onChange={(e) => onFormChange(f => ({ ...f, seatingRows: e.target.value }))}
                placeholder="Ej: 6"
              />
              <WInput
                label="Columnas"
                type="number"
                min={1}
                value={form.seatingColumns}
                onChange={(e) => onFormChange(f => ({ ...f, seatingColumns: e.target.value }))}
                placeholder="Ej: 6"
              />
            </div>
          )}

          {/* MICRO_COLLECT specific fields */}
          {form.type === 'MICRO_COLLECT' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <WInput
                    label="Valor por estudiante ($)"
                    type="number"
                    value={form.goalAmount}
                    onChange={(e) => onFormChange(f => ({ ...f, goalAmount: e.target.value }))}
                    placeholder="Ej: 2000"
                    min={0}
                  />
                  <p className="text-badge text-slate-400 mt-1">La meta total se calcula automáticamente × número de estudiantes</p>
                </div>
                <WInput
                  label="Concepto"
                  value={form.concept}
                  onChange={(e) => onFormChange(f => ({ ...f, concept: e.target.value }))}
                  placeholder="Ej: Libros, Salida..."
                />
              </div>
              <label className="flex items-center gap-2 text-body-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.allowPartial}
                  onChange={(e) => onFormChange(f => ({ ...f, allowPartial: e.target.checked }))}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-slate-700">Permitir pagos parciales</span>
              </label>
            </>
          )}

          {/* CLASSROOM_ROLES specific fields */}
          {form.type === 'CLASSROOM_ROLES' && (
            <div>
              <label className="block text-body-sm font-medium text-slate-700 mb-1">Roles disponibles</label>
              <div className="space-y-2">
                {form.roles.map((role, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      value={role}
                      onChange={(e) => onFormChange(f => {
                        const roles = [...f.roles]
                        roles[idx] = e.target.value
                        return { ...f, roles }
                      })}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-body-sm min-h-input focus:ring-1 focus:ring-blue-400 outline-none"
                    />
                    <button
                      onClick={() => onFormChange(f => ({ ...f, roles: f.roles.filter((_, i) => i !== idx) }))}
                      className="p-1.5 text-red-400 hover:text-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => onFormChange(f => ({ ...f, roles: [...f.roles, ''] }))}
                  className="text-body-sm text-blue-600 hover:underline"
                >
                  + Agregar rol
                </button>
              </div>
            </div>
          )}

          {/* Auto-populate checkbox */}
          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.autoPopulate}
                onChange={(e) => onFormChange(f => ({ ...f, autoPopulate: e.target.checked }))}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-body-sm font-medium text-slate-700">Agregar todos los estudiantes del grupo</span>
                <p className="text-badge text-slate-400">Si no, podrás agregarlos manualmente después</p>
              </div>
            </label>
          </div>
        </>
      ) : (
        <div>
          <label className="block text-body-sm font-medium text-slate-700 mb-1">Grupo (opcional)</label>
          <select
            value={form.groupId}
            onChange={(e) => onFormChange(f => ({ ...f, groupId: e.target.value }))}
            className="w-full min-h-input px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-body-sm"
          >
            <option value="">Sin grupo específico</option>
            {scopeOptions.groups.map((g: any) => (
              <option key={g.id} value={g.id}>{g.gradeName} {g.name}</option>
            ))}
          </select>
        </div>
      )}
    </WModal>
  )
}
