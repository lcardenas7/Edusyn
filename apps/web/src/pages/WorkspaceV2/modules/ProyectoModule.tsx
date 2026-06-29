import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Rocket, Plus, X, Loader2, ArrowLeft, Check, Circle, Trash2, Target, Users2, ChevronRight, Search, Star,
} from 'lucide-react'
import { teacherWorkspaceApi } from '../../../lib/api'

interface Task { id: string; title: string; done: boolean; dueDate?: string | null }
interface Member { id: string; studentId: string; studentName: string }
interface Project {
  id: string; name: string; objective?: string | null; competencies?: string | null
  status: string; progress: number; startDate?: string | null; endDate?: string | null
  isFavorite?: boolean; tasks: Task[]; members: Member[]; tasksDone: number; tasksTotal: number
}
interface RosterStudent { id: string; name: string; photo?: string | null }

const STATUS: Record<string, { label: string; cls: string }> = {
  PLANNING: { label: 'Planeación', cls: 'bg-slate-100 text-slate-600' },
  ACTIVE:   { label: 'En curso', cls: 'bg-blue-100 text-blue-700' },
  DONE:     { label: 'Terminado', cls: 'bg-emerald-100 text-emerald-700' },
}

export function ProyectoModule({ boardId }: { boardId: string }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newObjective, setNewObjective] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    teacherWorkspaceApi.listProjects(boardId).then((r) => setProjects(r.data ?? [])).catch(() => {}).finally(() => setLoading(false))
  }, [boardId])
  useEffect(() => { load() }, [load])

  const create = async () => {
    if (!newName.trim()) return
    const res = await teacherWorkspaceApi.createProject({ boardId, name: newName.trim(), objective: newObjective.trim() || undefined })
    setNewName(''); setNewObjective(''); setCreating(false); load(); setOpenId(res.data.id)
  }

  const open = projects.find((p) => p.id === openId)
  if (loading) return <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300 mx-auto" /></div>
  if (open) return <ProjectDetail boardId={boardId} project={open} onBack={() => setOpenId(null)} onChanged={load} />

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-500">{projects.length} proyecto(s)</p>
        <button onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-800">
          {creating ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} Nuevo proyecto
        </button>
      </div>

      {creating && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-4 space-y-2">
          <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre del proyecto" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-violet-400" />
          <input value={newObjective} onChange={(e) => setNewObjective(e.target.value)} placeholder="Objetivo (opcional)" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-violet-400" />
          <div className="flex justify-end"><button onClick={create} disabled={!newName.trim()} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-40">Crear</button></div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/40 py-10 text-center">
          <Rocket className="w-8 h-8 text-fuchsia-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aún no hay proyectos. Crea el primero.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => {
            const st = STATUS[p.status] ?? STATUS.PLANNING
            return (
              <button key={p.id} onClick={() => setOpenId(p.id)} className="w-full text-left rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-fuchsia-50 flex items-center justify-center flex-shrink-0"><Rocket className="w-5 h-5 text-fuchsia-500" /></div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-800 text-sm truncate">{p.name}</p>
                        {p.isFavorite && <Star className="w-3.5 h-3.5 text-amber-400" fill="currentColor" />}
                      </div>
                      {p.objective && <p className="text-xs text-slate-500 mt-0.5 truncate">{p.objective}</p>}
                      <span className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 mt-1" />
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-400">{p.tasksDone}/{p.tasksTotal} tareas · {p.members.length} integrantes</span>
                    <span className="text-fuchsia-600 font-medium">{p.progress}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-fuchsia-400 to-pink-500 rounded-full" style={{ width: `${p.progress}%` }} /></div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ProjectDetail({ boardId, project, onBack, onChanged }: { boardId: string; project: Project; onBack: () => void; onChanged: () => void }) {
  const [data, setData] = useState<Project>(project)
  const [taskTitle, setTaskTitle] = useState('')
  const [picker, setPicker] = useState(false)
  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [pq, setPq] = useState('')

  const refresh = async () => { const r = await teacherWorkspaceApi.getProject(data.id); setData(r.data); onChanged() }
  useEffect(() => { if (picker && roster.length === 0) teacherWorkspaceApi.getRoster(boardId).then((r) => setRoster(r.data ?? [])).catch(() => {}) }, [picker, boardId, roster.length])

  const addTask = async () => { if (!taskTitle.trim()) return; const r = await teacherWorkspaceApi.addProjectTask(data.id, { title: taskTitle.trim() }); setData(r.data); onChanged(); setTaskTitle('') }
  const toggleTask = async (id: string) => { const r = await teacherWorkspaceApi.toggleProjectTask(id); setData(r.data); onChanged() }
  const delTask = async (id: string) => { const r = await teacherWorkspaceApi.deleteProjectTask(id); setData(r.data); onChanged() }
  const addMember = async (sid: string) => { const r = await teacherWorkspaceApi.addProjectMember(data.id, sid); setData(r.data); onChanged(); setPicker(false) }
  const delMember = async (id: string) => { const r = await teacherWorkspaceApi.removeProjectMember(id); setData(r.data); onChanged() }
  const setStatus = async (s: string) => { const r = await teacherWorkspaceApi.updateProject(data.id, { status: s }); setData(r.data); onChanged() }

  return (
    <div className="pb-10">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-3"><ArrowLeft className="w-3.5 h-3.5" /> Proyectos</button>

      {/* Encabezado */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900">{data.name}</h3>
            {data.objective && <p className="text-sm text-slate-500 mt-1 inline-flex items-start gap-1.5"><Target className="w-3.5 h-3.5 mt-0.5 text-fuchsia-400 flex-shrink-0" /> {data.objective}</p>}
            {data.competencies && <p className="text-xs text-slate-400 mt-1">Competencias: {data.competencies}</p>}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold text-fuchsia-600">{data.progress}%</p>
          </div>
        </div>
        {/* Estado */}
        <div className="flex gap-1.5 mt-3">
          {Object.entries(STATUS).map(([k, v]) => (
            <button key={k} onClick={() => setStatus(k)} className={`text-[11px] px-2.5 py-1 rounded-full transition ${data.status === k ? v.cls + ' ring-1 ring-current' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>{v.label}</button>
          ))}
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-3"><div className="h-full bg-gradient-to-r from-fuchsia-400 to-pink-500 rounded-full transition-all" style={{ width: `${data.progress}%` }} /></div>
      </div>

      {/* Checklist */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tareas ({data.tasksDone}/{data.tasksTotal})</p>
        <div className="space-y-1 mb-2">
          {data.tasks.map((t) => (
            <div key={t.id} className="group flex items-center gap-2">
              <button onClick={() => toggleTask(t.id)} className="flex-shrink-0">
                {t.done ? <Check className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-slate-300" />}
              </button>
              <span className={`text-sm flex-1 ${t.done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{t.title}</span>
              <button onClick={() => delTask(t.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addTask() }} placeholder="Agregar tarea…" className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-violet-400" />
          <button onClick={addTask} disabled={!taskTitle.trim()} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold disabled:opacity-40">Agregar</button>
        </div>
      </div>

      {/* Integrantes */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide inline-flex items-center gap-1.5"><Users2 className="w-3.5 h-3.5" /> Integrantes</p>
          <button onClick={() => setPicker(true)} className="text-xs text-violet-600 hover:text-violet-800 font-medium inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Agregar</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.members.map((m) => (
            <span key={m.id} className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-xs text-slate-700">
              {m.studentName}
              <button onClick={() => delMember(m.id)} className="text-slate-300 hover:text-red-500"><X className="w-3 h-3" /></button>
            </span>
          ))}
          {data.members.length === 0 && <span className="text-xs text-slate-400">Sin integrantes.</span>}
        </div>
      </div>

      {/* Picker integrante */}
      <AnimatePresence>
        {picker && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={() => setPicker(false)} />
            <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] pointer-events-auto overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100"><h2 className="text-base font-bold text-slate-900">Agregar integrante</h2><button onClick={() => setPicker(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
                <div className="p-4 border-b border-slate-100"><div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input autoFocus value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Buscar…" className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:border-violet-400" /></div></div>
                <div className="overflow-y-auto p-2">
                  {roster.filter((s) => s.name.toLowerCase().includes(pq.toLowerCase().trim())).map((s) => (
                    <button key={s.id} onClick={() => addMember(s.id)} className="w-full flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-slate-50 text-left text-sm text-slate-700">{s.name}</button>
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
