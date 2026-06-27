import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, ArrowRight } from 'lucide-react'
import { teacherWorkspaceApi } from '../../../lib/api'

// Tipos visibles para el docente. Internamente mapean al `WorkspaceBoardType` antiguo.
type SpacePresetKey = 'log' | 'observations' | 'collection' | 'roles' | 'project' | 'list' | 'kanban' | 'personal'

interface Preset {
  key: SpacePresetKey
  emoji: string
  label: string
  description: string
  boardType: string
  gradientClass: string
  defaultScope: 'GROUP' | 'NONE'
}

const PRESETS: Preset[] = [
  { key: 'log',          emoji: '📖', label: 'Bitácora',      description: 'Notas de cada clase, diario del curso.',                     boardType: 'CLASS_LOG',       gradientClass: 'from-blue-400 to-indigo-500',     defaultScope: 'GROUP' },
  { key: 'observations', emoji: '👤', label: 'Observaciones', description: 'Apuntes personales sobre estudiantes.',                       boardType: 'STUDENT_NOTES',   gradientClass: 'from-amber-400 to-orange-500',    defaultScope: 'GROUP' },
  { key: 'collection',   emoji: '💰', label: 'Recaudo',       description: 'Cobros pendientes con tus estudiantes.',                     boardType: 'MICRO_COLLECT',   gradientClass: 'from-yellow-400 to-amber-500',    defaultScope: 'GROUP' },
  { key: 'roles',        emoji: '🎭', label: 'Roles del salón', description: 'Organiza monitores, líderes y comisiones.',                boardType: 'CLASSROOM_ROLES', gradientClass: 'from-rose-400 to-pink-500',       defaultScope: 'GROUP' },
  { key: 'project',      emoji: '🚀', label: 'Proyecto',      description: 'Una iniciativa con tareas y avances.',                       boardType: 'PROJECT',         gradientClass: 'from-fuchsia-400 to-pink-500',    defaultScope: 'NONE' },
  { key: 'list',         emoji: '✅', label: 'Lista',         description: 'Una lista de pendientes simple.',                            boardType: 'CHECKLIST',       gradientClass: 'from-emerald-400 to-teal-500',    defaultScope: 'NONE' },
  { key: 'kanban',       emoji: '📋', label: 'Tablero libre', description: 'Un Kanban en blanco para organizarte como quieras.',         boardType: 'KANBAN',          gradientClass: 'from-violet-400 to-purple-500',   defaultScope: 'NONE' },
  { key: 'personal',     emoji: '✨', label: 'Espacio personal', description: 'Notas, ideas y pendientes que no son de un grupo.',       boardType: 'KANBAN',          gradientClass: 'from-slate-400 to-slate-500',     defaultScope: 'NONE' },
]

interface GroupOption {
  id: string
  name: string
}

interface CreateSpaceModalProps {
  open: boolean
  onClose: () => void
  onCreated: (boardId: string) => void
}

export function CreateSpaceModal({ open, onClose, onCreated }: CreateSpaceModalProps) {
  const [step, setStep] = useState<'pick' | 'configure'>('pick')
  const [preset, setPreset] = useState<Preset | null>(null)
  const [title, setTitle] = useState('')
  const [groupId, setGroupId] = useState<string>('')
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset cada vez que se abre/cierra
  useEffect(() => {
    if (!open) {
      setStep('pick')
      setPreset(null)
      setTitle('')
      setGroupId('')
      setError(null)
    }
  }, [open])

  // Cargar grupos disponibles al abrir
  useEffect(() => {
    if (!open) return
    setLoadingGroups(true)
    teacherWorkspaceApi
      .getScopeOptions()
      .then((res) => {
        const list: GroupOption[] = (res.data?.groups ?? res.data ?? []).map((g: any) => ({
          id: g.id,
          name: g.name || g.code || '(sin nombre)',
        }))
        setGroups(list)
      })
      .catch(() => setGroups([]))
      .finally(() => setLoadingGroups(false))
  }, [open])

  const pickPreset = (p: Preset) => {
    setPreset(p)
    // Sugerencia de título por defecto
    if (p.key === 'personal') setTitle('Mi espacio personal')
    setStep('configure')
  }

  const handleSubmit = async () => {
    if (!preset) return
    const finalTitle = title.trim()
    if (!finalTitle) {
      setError('Ponle un nombre al espacio')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload: any = {
        type: preset.boardType,
        title: finalTitle,
      }
      if (preset.defaultScope === 'GROUP' && groupId) {
        payload.scopeType = 'GROUP'
        payload.groupId = groupId
      }
      if (preset.key === 'personal') {
        payload.metadata = { isPersonal: true }
      }
      const res = await teacherWorkspaceApi.createBoard(payload)
      const newId = res.data?.id
      onCreated(newId)
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'No se pudo crear el espacio. Intenta de nuevo.'
      setError(typeof msg === 'string' ? msg : 'No se pudo crear el espacio.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden pointer-events-auto flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                <div>
                  <h2
                    className="text-xl font-bold text-slate-900"
                    style={{ fontFamily: 'Georgia, "Iowan Old Style", "Times New Roman", serif' }}
                  >
                    {step === 'pick' ? 'Nuevo espacio' : preset?.label}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {step === 'pick' ? '¿Qué quieres organizar?' : 'Cuéntanos un par de detalles'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Step 1: pick preset */}
              {step === 'pick' && (
                <div className="overflow-y-auto p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {PRESETS.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => pickPreset(p)}
                        className="group relative rounded-2xl border border-slate-200 hover:border-slate-300 bg-white p-4 text-left transition hover:shadow-md"
                      >
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.gradientClass} flex items-center justify-center text-xl shadow-sm mb-2`}>
                          {p.emoji}
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{p.label}</p>
                        <p className="text-[11px] text-slate-500 leading-snug mt-1 line-clamp-2">{p.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: configure */}
              {step === 'configure' && preset && (
                <div className="overflow-y-auto p-6">
                  {/* Preview */}
                  <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-slate-50">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${preset.gradientClass} flex items-center justify-center text-2xl shadow-sm`}>
                      {preset.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-500">{preset.description}</p>
                    </div>
                  </div>

                  {/* Nombre */}
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Nombre</span>
                    <input
                      autoFocus
                      type="text"
                      value={title}
                      onChange={(e) => { setTitle(e.target.value); setError(null) }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !submitting) handleSubmit() }}
                      placeholder={preset.key === 'collection' ? 'Ej: Salida pedagógica, Fotocopias…' : 'Ej: 9B Matemáticas'}
                      className="mt-1.5 w-full px-4 py-3 border border-slate-200 rounded-xl focus:border-violet-400 focus:ring-1 focus:ring-violet-400 focus:outline-none text-sm"
                      maxLength={80}
                    />
                  </label>

                  {/* Grupo (si aplica) */}
                  {preset.defaultScope === 'GROUP' && (
                    <label className="block mt-4">
                      <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Grupo</span>
                      <select
                        value={groupId}
                        onChange={(e) => setGroupId(e.target.value)}
                        disabled={loadingGroups || groups.length === 0}
                        className="mt-1.5 w-full px-4 py-3 border border-slate-200 rounded-xl bg-white focus:border-violet-400 focus:ring-1 focus:ring-violet-400 focus:outline-none text-sm disabled:opacity-50"
                      >
                        <option value="">{loadingGroups ? 'Cargando…' : 'Sin grupo específico'}</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400 mt-1.5">
                        {preset.key === 'collection' && 'Al elegir un grupo, los estudiantes se agregan automáticamente.'}
                        {preset.key === 'observations' && 'Te ayuda a anotar observaciones por estudiante con un click.'}
                        {preset.key === 'roles' && 'Los estudiantes del grupo aparecen listos para asignar roles.'}
                        {preset.key === 'log' && 'Las entradas quedan vinculadas a este grupo.'}
                      </p>
                    </label>
                  )}

                  {error && (
                    <p className="mt-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}
                </div>
              )}

              {/* Footer */}
              {step === 'configure' && (
                <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60">
                  <button
                    type="button"
                    onClick={() => setStep('pick')}
                    disabled={submitting}
                    className="text-sm text-slate-500 hover:text-slate-700 font-medium transition"
                  >
                    ← Cambiar tipo
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || !title.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold shadow-md shadow-violet-500/30 hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Creando…</>
                    ) : (
                      <>Crear espacio <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
