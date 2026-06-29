import { useEffect, useMemo, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Users2, User, Send, Search, Tag as TagIcon, Pin, Trash2, X, ChevronDown } from 'lucide-react'
import { teacherWorkspaceApi } from '../../../lib/api'

export interface ObsItem {
  id: string
  title: string
  content?: string | null
  tags?: string[]
  metadata?: any
  createdAt?: string
}
interface RosterStudent { id: string; name: string; photo?: string | null }

export interface ObsCreate {
  text: string
  scope: 'GENERAL' | 'INDIVIDUAL'
  studentRecordId?: string
  studentName?: string
  tags: string[]
  followUp?: boolean
}

interface Props {
  boardId: string
  items: ObsItem[]
  onCreate: (data: ObsCreate) => Promise<void>
  onDelete: (item: ObsItem) => Promise<void>
}

function initials(name: string) {
  const p = name.trim().split(/\s+/); return ((p[0]?.[0] ?? '') + (p[p.length - 1]?.[0] ?? '')).toUpperCase()
}
function Avatar({ name, photo }: { name: string; photo?: string | null }) {
  if (photo) return <img src={photo} alt={name} style={{ width: 28, height: 28 }} className="rounded-full object-cover flex-shrink-0" />
  return <span style={{ width: 28, height: 28 }} className="rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{initials(name)}</span>
}

export function ObservacionesModule({ boardId, items, onCreate, onDelete }: Props) {
  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [text, setText] = useState('')
  const [scope, setScope] = useState<'GENERAL' | 'INDIVIDUAL'>('GENERAL')
  const [student, setStudent] = useState<RosterStudent | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQ, setPickerQ] = useState('')
  const [tagsRaw, setTagsRaw] = useState('')
  const [followUp, setFollowUp] = useState(false)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [studentFilter, setStudentFilter] = useState<string>('all')

  const load = useCallback(() => {
    teacherWorkspaceApi.getRoster(boardId).then((r) => setRoster(r.data ?? [])).catch(() => {})
  }, [boardId])
  useEffect(() => { load() }, [load])

  const studentsWithObs = useMemo(() => {
    const m = new Map<string, string>()
    items.forEach((i) => { const sid = i.metadata?.studentRecordId; if (sid) m.set(sid, i.metadata?.studentName || 'Estudiante') })
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }))
  }, [items])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return items.filter((i) => {
      if (studentFilter === 'general' && i.metadata?.scope !== 'GENERAL') return false
      if (studentFilter !== 'all' && studentFilter !== 'general' && i.metadata?.studentRecordId !== studentFilter) return false
      if (q) {
        const hay = `${i.title} ${i.content ?? ''} ${i.metadata?.studentName ?? ''} ${(i.tags ?? []).join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    }).sort((a, b) => (b.createdAt ? +new Date(b.createdAt) : 0) - (a.createdAt ? +new Date(a.createdAt) : 0))
  }, [items, search, studentFilter])

  const submit = async () => {
    if (!text.trim() || saving) return
    if (scope === 'INDIVIDUAL' && !student) { setPickerOpen(true); return }
    setSaving(true)
    try {
      await onCreate({
        text: text.trim(), scope,
        studentRecordId: scope === 'INDIVIDUAL' ? student!.id : undefined,
        studentName: scope === 'INDIVIDUAL' ? student!.name : undefined,
        tags: tagsRaw.split(',').map((t) => t.trim()).filter(Boolean),
        followUp,
      })
      setText(''); setTagsRaw(''); setFollowUp(false); setStudent(null); setScope('GENERAL')
    } catch { /* parent */ } finally { setSaving(false) }
  }

  const pickerList = roster.filter((s) => s.name.toLowerCase().includes(pickerQ.toLowerCase().trim()))

  return (
    <div className="pb-28">
      {/* Composer */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-5">
        {/* Tipo */}
        <div className="flex gap-1.5 mb-3">
          <button type="button" onClick={() => { setScope('GENERAL'); setStudent(null) }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${scope === 'GENERAL' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-100'}`}>
            <Users2 className="w-3.5 h-3.5" /> General del curso
          </button>
          <button type="button" onClick={() => setScope('INDIVIDUAL')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${scope === 'INDIVIDUAL' ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-100'}`}>
            <User className="w-3.5 h-3.5" /> Individual
          </button>
        </div>

        {/* Selector de estudiante (si individual) */}
        {scope === 'INDIVIDUAL' && (
          <button type="button" onClick={() => setPickerOpen(true)}
            className="w-full flex items-center gap-2 mb-3 px-3 py-2 rounded-xl border border-slate-200 hover:border-amber-300 transition text-left">
            {student ? <Avatar name={student.name} photo={student.photo} /> : <User className="w-5 h-5 text-slate-300" />}
            <span className={`text-sm flex-1 ${student ? 'text-slate-700' : 'text-slate-400'}`}>{student?.name ?? 'Selecciona un estudiante…'}</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
        )}

        <textarea value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() } }}
          placeholder={scope === 'GENERAL' ? 'Observación sobre el curso… (ej. "Hoy hubo mucho ruido")' : 'Observación sobre el estudiante…'}
          rows={2} className="w-full resize-none text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none" />

        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TagIcon className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="etiquetas, por comas"
              className="flex-1 min-w-0 text-xs text-slate-600 placeholder:text-slate-300 focus:outline-none bg-transparent" />
          </div>
          <button type="button" onClick={() => setFollowUp((v) => !v)} title="Crear seguimiento"
            className={`p-1.5 rounded-lg transition ${followUp ? 'bg-violet-100 text-violet-700' : 'text-slate-400 hover:bg-slate-100'}`}>
            <Pin className="w-4 h-4" />
          </button>
          <button type="button" onClick={submit} disabled={!text.trim() || saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition disabled:opacity-40">
            {saving ? 'Guardando…' : 'Anotar'} {!saving && <Send className="w-3 h-3" />}
          </button>
        </div>
        {followUp && <p className="text-[11px] text-violet-500 mt-2">Se creará un seguimiento ligado a esta observación.</p>}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:border-violet-400 focus:outline-none" />
        </div>
        <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-white max-w-[180px]">
          <option value="all">Todas</option>
          <option value="general">Solo del curso</option>
          {studentsWithObs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/40 py-10 text-center">
          <p className="text-sm text-slate-500">{items.length === 0 ? 'Sin observaciones aún. Anota la primera arriba.' : 'Nada coincide con el filtro.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {filtered.map((it, idx) => {
              const isIndividual = it.metadata?.scope === 'INDIVIDUAL' || !!it.metadata?.studentRecordId
              return (
                <motion.div key={it.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                  className="group rounded-2xl bg-white border border-slate-200 hover:border-slate-300 transition p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isIndividual ? 'bg-amber-50' : 'bg-blue-50'}`}>
                      {isIndividual ? <User className="w-4 h-4 text-amber-600" /> : <Users2 className="w-4 h-4 text-blue-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 whitespace-pre-wrap">{it.title}</p>
                      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11px] text-slate-400">
                        <span className={isIndividual ? 'text-amber-600 font-medium' : 'text-blue-500 font-medium'}>
                          {isIndividual ? (it.metadata?.studentName ?? 'Estudiante') : 'General del curso'}
                        </span>
                        {it.createdAt && <span>{new Date(it.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>}
                        {(it.tags ?? []).map((t) => <span key={t} className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">#{t}</span>)}
                      </div>
                    </div>
                    <button onClick={() => onDelete(it)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition flex-shrink-0" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Picker de estudiante */}
      <AnimatePresence>
        {pickerOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setPickerOpen(false)} />
            <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] pointer-events-auto overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h2 className="text-base font-bold text-slate-900">Elige el estudiante</h2>
                  <button onClick={() => setPickerOpen(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 border-b border-slate-100">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input autoFocus value={pickerQ} onChange={(e) => setPickerQ(e.target.value)} placeholder="Buscar…"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:border-violet-400 focus:outline-none" />
                  </div>
                </div>
                <div className="overflow-y-auto p-2">
                  {pickerList.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Sin estudiantes.</p> :
                    pickerList.map((s) => (
                      <button key={s.id} onClick={() => { setStudent(s); setPickerOpen(false); setPickerQ('') }} className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 transition text-left">
                        <Avatar name={s.name} photo={s.photo} /> <span className="text-sm text-slate-700">{s.name}</span>
                      </button>
                    ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
