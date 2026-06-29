import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Loader2, Search, UserPlus, History, Trash2, Crown } from 'lucide-react'
import { teacherWorkspaceApi } from '../../../lib/api'

interface Assignment { id: string; studentId: string; studentName: string; studentPhoto?: string | null; assignedAt: string }
interface HistoryEntry { id: string; studentName: string; assignedAt: string; removedAt: string }
interface Role { id: string; name: string; isCustom: boolean; current: Assignment[]; history: HistoryEntry[] }
interface RosterStudent { id: string; name: string; photo?: string | null }

const PRESETS = ['Monitor', 'Representante', 'Secretario', 'Líder ambiental', 'Líder tecnológico', 'Líder de convivencia', 'Tesorero', 'Vigía de aseo']

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

function Avatar({ name, photo, size = 32 }: { name: string; photo?: string | null; size?: number }) {
  const style = { width: size, height: size }
  if (photo) return <img src={photo} alt={name} style={style} className="rounded-full object-cover flex-shrink-0" />
  return <span style={style} className="rounded-full bg-rose-100 text-rose-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{initials(name)}</span>
}

export function RolesModule({ boardId }: { boardId: string }) {
  const [roles, setRoles] = useState<Role[]>([])
  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [loading, setLoading] = useState(true)
  const [addingRole, setAddingRole] = useState(false)
  const [customName, setCustomName] = useState('')
  const [assignFor, setAssignFor] = useState<string | null>(null)
  const [historyFor, setHistoryFor] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([teacherWorkspaceApi.listRoles(boardId), teacherWorkspaceApi.getRoster(boardId)])
      .then(([r, rs]) => { setRoles(r.data ?? []); setRoster(rs.data ?? []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [boardId])
  useEffect(() => { load() }, [load])

  const createRole = async (name: string) => {
    await teacherWorkspaceApi.createRole({ boardId, name, isCustom: !PRESETS.includes(name) })
    setAddingRole(false); setCustomName(''); load()
  }
  const assign = async (roleId: string, studentId: string) => {
    const res = await teacherWorkspaceApi.assignRole(roleId, studentId)
    setRoles(res.data); setAssignFor(null)
  }
  const unassign = async (assignmentId: string) => {
    const res = await teacherWorkspaceApi.unassignRole(assignmentId)
    setRoles(res.data)
  }
  const removeRole = async (roleId: string) => {
    await teacherWorkspaceApi.deleteRole(roleId); load()
  }

  if (loading) return <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300 mx-auto" /></div>

  const usedNames = new Set(roles.map((r) => r.name))
  const availablePresets = PRESETS.filter((p) => !usedNames.has(p))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-500">{roles.length} rol(es) · {roster.length} estudiantes</p>
        <button onClick={() => setAddingRole((v) => !v)} className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-800">
          {addingRole ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {addingRole ? 'Cerrar' : 'Agregar rol'}
        </button>
      </div>

      {/* Agregar rol: presets + custom */}
      {addingRole && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-4">
          <p className="text-xs font-semibold text-slate-500 mb-2">Roles sugeridos</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {availablePresets.map((p) => (
              <button key={p} onClick={() => createRole(p)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 text-xs font-medium hover:bg-rose-100 transition">
                <Plus className="w-3 h-3" /> {p}
              </button>
            ))}
            {availablePresets.length === 0 && <span className="text-xs text-slate-400">Ya usaste todos los sugeridos.</span>}
          </div>
          <div className="flex items-center gap-2">
            <input value={customName} onChange={(e) => setCustomName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && customName.trim()) createRole(customName.trim()) }}
              placeholder="O crea un rol personalizado…" className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:border-violet-400 focus:outline-none" />
            <button onClick={() => customName.trim() && createRole(customName.trim())} disabled={!customName.trim()} className="px-3 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold disabled:opacity-40">Crear</button>
          </div>
        </div>
      )}

      {roles.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/40 py-10 text-center">
          <Crown className="w-8 h-8 text-rose-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aún no hay roles. Agrega el primero (Monitor, Representante…).</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {roles.map((role) => (
            <div key={role.id} className="rounded-2xl bg-white border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center"><Crown className="w-4 h-4 text-rose-500" /></div>
                  <h3 className="text-sm font-bold text-slate-800">{role.name}</h3>
                </div>
                <div className="flex items-center gap-1">
                  {role.history.length > 0 && (
                    <button onClick={() => setHistoryFor(historyFor === role.id ? null : role.id)} className="p-1 rounded text-slate-400 hover:text-slate-600" title="Historial">
                      <History className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => removeRole(role.id)} className="p-1 rounded text-slate-300 hover:text-red-500" title="Eliminar rol"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {/* Asignados actuales */}
              <div className="space-y-1.5">
                {role.current.map((a) => (
                  <div key={a.id} className="group flex items-center gap-2">
                    <Avatar name={a.studentName} photo={a.studentPhoto} />
                    <span className="text-xs text-slate-700 truncate flex-1">{a.studentName}</span>
                    <button onClick={() => unassign(a.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition" title="Quitar"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                {role.current.length === 0 && <p className="text-[11px] text-slate-400">Sin asignar.</p>}
              </div>

              {/* Historial */}
              <AnimatePresence>
                {historyFor === role.id && role.history.length > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-2 pt-2 border-t border-slate-100">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold mb-1">Historial</p>
                    {role.history.map((h) => (
                      <p key={h.id} className="text-[11px] text-slate-400">
                        {h.studentName} · {new Date(h.assignedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}–{new Date(h.removedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                      </p>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={() => setAssignFor(role.id)} className="mt-3 inline-flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium">
                <UserPlus className="w-3.5 h-3.5" /> Asignar estudiante
              </button>
            </div>
          ))}
        </div>
      )}

      {assignFor && (
        <StudentPickerModal
          students={roster}
          onClose={() => setAssignFor(null)}
          onPick={(sid) => assign(assignFor, sid)}
        />
      )}
    </div>
  )
}

function StudentPickerModal({ students, onClose, onPick }: { students: RosterStudent[]; onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const filtered = students.filter((s) => s.name.toLowerCase().includes(q.toLowerCase().trim()))
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] pointer-events-auto overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">Asignar estudiante</h2>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar estudiante…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-violet-400 focus:outline-none" />
            </div>
          </div>
          <div className="overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">{students.length === 0 ? 'No hay estudiantes en el grupo.' : 'Sin coincidencias.'}</p>
            ) : filtered.map((s) => (
              <button key={s.id} onClick={() => onPick(s.id)} className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 transition text-left">
                <Avatar name={s.name} photo={s.photo} size={36} />
                <span className="text-sm text-slate-700">{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
