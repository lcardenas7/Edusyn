import { useEffect, useMemo, useState } from 'react'
import { Clock, Plus, Pencil, Trash2, X, MapPin, Loader2, CalendarDays } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  teacherScheduleApi,
  teacherAssignmentsApi,
  type TeacherScheduleBlock,
  type TeacherScheduleBlockInput,
  type TeacherScheduleBlockType,
} from '../lib/api'

const DAYS: { key: TeacherScheduleBlock['dayOfWeek']; label: string }[] = [
  { key: 'MONDAY', label: 'Lunes' },
  { key: 'TUESDAY', label: 'Martes' },
  { key: 'WEDNESDAY', label: 'Miércoles' },
  { key: 'THURSDAY', label: 'Jueves' },
  { key: 'FRIDAY', label: 'Viernes' },
  { key: 'SATURDAY', label: 'Sábado' },
]

// Tipos de bloque. Cada uno con su color por defecto.
const TYPES: { value: TeacherScheduleBlockType; label: string; color: string }[] = [
  { value: 'CLASE', label: 'Clase', color: '#3B82F6' },
  { value: 'TUTORIA', label: 'Tutoría', color: '#6366F1' },
  { value: 'ATENCION_PADRES', label: 'Atención a padres', color: '#F59E0B' },
  { value: 'REUNION_AREA', label: 'Reunión de área', color: '#10B981' },
  { value: 'OTRO', label: 'Otro', color: '#64748B' },
]

const typeMeta = (t: TeacherScheduleBlockType) => TYPES.find(x => x.value === t) ?? TYPES[4]

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899', '#06B6D4', '#64748B']

interface Assignment {
  id: string
  subject?: { id: string; name: string }
  group?: { id: string; name: string; grade?: { name: string } }
}

const asgLabel = (a: Assignment): string => {
  const grp = a.group ? `${a.group.grade?.name ?? ''} ${a.group.name ?? ''}`.trim() : ''
  return `${a.subject?.name ?? ''}${grp ? ' — ' + grp : ''}`.trim()
}

const emptyForm: TeacherScheduleBlockInput = {
  dayOfWeek: 'MONDAY',
  startTime: '07:00',
  endTime: '08:00',
  type: 'CLASE',
  title: '',
  location: '',
  color: '#3B82F6',
  notes: '',
}

/** Widget del Dashboard (solo DOCENTE): agenda semanal propia, manual, solo visual. */
export default function TeacherScheduleWidget() {
  const { user } = useAuth()
  const [blocks, setBlocks] = useState<TeacherScheduleBlock[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TeacherScheduleBlockInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    teacherScheduleApi
      .getAll()
      .then(res => setBlocks(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  // Solo la carga académica del docente logueado (no todas las de la institución)
  useEffect(() => {
    if (!user?.id) return
    teacherAssignmentsApi
      .getAll({ activeOnly: true, teacherId: user.id })
      .then(res => setAssignments(res.data || []))
      .catch(() => {})
  }, [user?.id])

  // Opciones únicas de asignatura (carga académica) para el desplegable de "Clase"
  const subjectOptions = useMemo(() => {
    const seen = new Set<string>()
    const opts: string[] = []
    for (const a of assignments) {
      const l = asgLabel(a)
      if (l && !seen.has(l)) { seen.add(l); opts.push(l) }
    }
    return opts.sort((x, y) => x.localeCompare(y))
  }, [assignments])

  // Agrupar bloques por día
  const byDay = useMemo(() => {
    const map = new Map<string, TeacherScheduleBlock[]>()
    for (const d of DAYS) map.set(d.key, [])
    for (const b of blocks) map.get(b.dayOfWeek)?.push(b)
    for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime))
    return map
  }, [blocks])

  const openNew = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setModalOpen(true)
  }

  const openEdit = (b: TeacherScheduleBlock) => {
    setEditingId(b.id)
    setForm({
      dayOfWeek: b.dayOfWeek,
      startTime: b.startTime,
      endTime: b.endTime,
      type: b.type ?? 'OTRO',
      title: b.title,
      location: b.location ?? '',
      color: b.color ?? typeMeta(b.type ?? 'OTRO').color,
      notes: b.notes ?? '',
    })
    setError(null)
    setModalOpen(true)
  }

  // Cambiar el tipo ajusta título por defecto y color
  const changeType = (type: TeacherScheduleBlockType) => {
    const meta = typeMeta(type)
    setForm(f => {
      let title = f.title
      if (type === 'CLASE') title = subjectOptions.includes(f.title) ? f.title : ''
      else if (type === 'OTRO') title = subjectOptions.includes(f.title) ? '' : f.title
      else title = meta.label // Tutoría / Atención a padres / Reunión de área
      return { ...f, type, title, color: meta.color }
    })
  }

  const save = async () => {
    if (form.type === 'CLASE' && !form.title.trim()) { setError('Selecciona una asignatura de tu carga académica'); return }
    if (form.type === 'OTRO' && !form.title.trim()) { setError('Escribe un título'); return }
    if (form.startTime >= form.endTime) { setError('La hora de inicio debe ser anterior a la de fin'); return }
    setSaving(true)
    setError(null)
    try {
      // Para tipos con título fijo, asegurar el label correcto
      const payload: TeacherScheduleBlockInput = { ...form, title: form.title.trim() || typeMeta(form.type).label }
      if (editingId) await teacherScheduleApi.update(editingId, payload)
      else await teacherScheduleApi.create(payload)
      setModalOpen(false)
      load()
    } catch (e: any) {
      setError(e?.response?.data?.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este bloque de tu horario?')) return
    try {
      await teacherScheduleApi.remove(id)
      setBlocks(prev => prev.filter(b => b.id !== id))
    } catch { /* noop */ }
  }

  const hasTitleField = form.type === 'CLASE' || form.type === 'OTRO'

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600" />
          Mi Horario
        </h2>
        <button
          onClick={openNew}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Añadir
        </button>
      </div>

      {loading ? (
        <div className="p-6 flex items-center justify-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Cargando horario...</span>
        </div>
      ) : blocks.length === 0 ? (
        <div className="px-5 py-8 text-center text-slate-400">
          <CalendarDays className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm">Aún no has creado tu horario</p>
          <button onClick={openNew} className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700">
            Añade tu primer bloque
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
          {DAYS.map(day => {
            const list = byDay.get(day.key) || []
            if (list.length === 0) return null
            return (
              <div key={day.key} className="px-5 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{day.label}</p>
                <div className="space-y-1.5">
                  {list.map(b => (
                    <div key={b.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                      <div className="w-1 h-9 rounded-full shrink-0" style={{ backgroundColor: b.color || typeMeta(b.type).color }} />
                      <div className="w-24 shrink-0 text-xs text-slate-500 tabular-nums">
                        {b.startTime}–{b.endTime}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{b.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {b.type !== 'OTRO' && (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{typeMeta(b.type).label}</span>
                          )}
                          {b.location && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {b.location}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(b)} title="Editar" className="p-1.5 rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => remove(b.id)} title="Eliminar" className="p-1.5 rounded-md text-slate-400 hover:bg-red-100 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !saving && setModalOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h3 className="text-base font-semibold text-slate-900">
                {editingId ? 'Editar bloque' : 'Nuevo bloque'}
              </h3>
              <button onClick={() => !saving && setModalOpen(false)} className="p-1 rounded-md text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
                <select
                  value={form.type}
                  onChange={e => changeType(e.target.value as TeacherScheduleBlockType)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {form.type === 'CLASE' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Asignatura <span className="text-slate-400">(de tu carga académica)</span></label>
                  {subjectOptions.length === 0 ? (
                    <p className="text-xs text-amber-600 rounded-lg bg-amber-50 px-3 py-2">
                      No tienes asignaturas asignadas este año. Usa el tipo "Otro" para escribir el título.
                    </p>
                  ) : (
                    <select
                      value={subjectOptions.includes(form.title) ? form.title : ''}
                      onChange={e => setForm({ ...form, title: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    >
                      <option value="" disabled>Selecciona una asignatura…</option>
                      {subjectOptions.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )}
                </div>
              )}

              {form.type === 'OTRO' && (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Título</label>
                  <input
                    autoFocus
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="Ej: Coordinación, Descanso, etc."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Día</label>
                <select
                  value={form.dayOfWeek}
                  onChange={e => setForm({ ...form, dayOfWeek: e.target.value as TeacherScheduleBlock['dayOfWeek'] })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  {DAYS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Inicio</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm({ ...form, startTime: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Fin</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm({ ...form, endTime: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Salón / lugar <span className="text-slate-400">(opcional)</span></label>
                <input
                  value={form.location ?? ''}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="Ej: Aula 201"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Color</label>
                <div className="flex items-center gap-2">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-6 h-6 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nota <span className="text-slate-400">(opcional)</span></label>
                <textarea
                  value={form.notes ?? ''}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {!hasTitleField && (
                <p className="text-xs text-slate-400">Este bloque se guardará como "{typeMeta(form.type).label}".</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button
                onClick={() => !saving && setModalOpen(false)}
                className="px-3 py-2 text-sm rounded-lg text-slate-600 hover:bg-slate-100 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 font-medium disabled:opacity-60"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editingId ? 'Guardar' : 'Añadir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
