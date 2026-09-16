import { AlertTriangle, BrainCircuit, Code2, Loader2, Lock, Plus, Smartphone, Unlock, Users2 } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { toast } from '../../lib/toast'
import { promptDialog } from '../../components/ui/confirm'
import { classroomApi } from '../../lib/api'
import {
  construyeApi,
  type ConstruyeDashboardTeam,
  type ConstruyeMemberRole,
  type ConstruyeProject,
} from '../../lib/api/construye'
import { manifestToProject } from './manifest'
import PreviewFrame from './PreviewFrame'
import TeamWorkspace from './TeamWorkspace'
import TeamReasoning, { PhaseProgress } from './TeamReasoning'

/** Marco de celular puramente visual: comunica "así se ve en un teléfono", nada de esto
 * afecta el aislamiento — adentro sigue el mismo iframe sandboxed de PreviewFrame. */
function PhoneMockup({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-[220px] rounded-[32px] border-[6px] border-slate-900 bg-slate-900 shadow-xl">
      <div className="relative h-[440px] w-full overflow-hidden rounded-[26px] bg-white">
        <div className="absolute left-1/2 top-2 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-slate-900" />
        {children}
      </div>
    </div>
  )
}

const ROLE_LABEL: Record<ConstruyeMemberRole, string> = {
  RESEARCH: 'Investigación',
  DESIGN: 'Diseño',
  DEVELOPMENT: 'Desarrollo',
  TESTING: 'Pruebas',
  COORDINATION: 'Coordinación',
}

function Loading() {
  return <div className="mt-6 flex items-center gap-2 rounded-2xl border border-hairline bg-surface-1 p-6 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>
}

function Empty({ msg }: { msg: string }) {
  return <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{msg}</div>
}

function ProjectPicker({ projects, value, onChange }: { projects: ConstruyeProject[]; value: string; onChange: (id: string) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
    {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
  </select>
}

interface ClassroomActivitySummary { id: string; title: string; type: string; dueDate: string | null }

/** Destino "Construye" del Aula Virtual: un docente crea proyectos y equipos y acompaña
 * el avance (como Expedición ABP); un estudiante trabaja en el editor de su equipo. */
export default function ConstruyeTab({ classroomId, isTeacher }: { classroomId: string; isTeacher: boolean }) {
  const [projects, setProjects] = useState<ConstruyeProject[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    construyeApi.listClassroomProjects(classroomId)
      .then(({ data }) => setProjects(data || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false))
  }, [classroomId])
  useEffect(() => { load() }, [load])

  if (loading) return <Loading />
  return isTeacher
    ? <TeacherView classroomId={classroomId} projects={projects} reload={load} />
    : <StudentView projects={projects} />
}

// ─── Estudiante ──────────────────────────────────────────────────────────────

function StudentView({ projects }: { projects: ConstruyeProject[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id || '')
  if (!projects.length) return <Empty msg="Tu docente aún no ha creado un proyecto de Edusyn Crea en esta aula." />
  return <div className="space-y-4">
    {projects.length > 1 && <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />}
    <TeamWorkspace projectId={projectId} />
  </div>
}

// ─── Docente ─────────────────────────────────────────────────────────────────

function TeacherView({ classroomId, projects, reload }: { classroomId: string; projects: ConstruyeProject[]; reload: () => void }) {
  const [projectId, setProjectId] = useState(projects[0]?.id || '')
  const [creatingProject, setCreatingProject] = useState(false)
  const [activities, setActivities] = useState<ClassroomActivitySummary[]>([])

  useEffect(() => { if (!projectId && projects.length) setProjectId(projects[0].id) }, [projects, projectId])
  useEffect(() => {
    classroomApi.listActivities(classroomId, 'teacher')
      .then(({ data }: { data: ClassroomActivitySummary[] }) => setActivities(data || []))
      .catch(() => setActivities([]))
  }, [classroomId])

  const selectedProject = projects.find((project) => project.id === projectId)
  const linkedActivity = selectedProject?.classroomActivityId
    ? activities.find((activity) => activity.id === selectedProject.classroomActivityId)
    : undefined

  return <div className="mt-6 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><Code2 className="h-5 w-5 text-cyan-700" /><div><p className="text-[11px] font-bold uppercase tracking-wider text-cyan-700">Edusyn Crea</p><h2 className="font-bold text-slate-800">Proyectos de creación digital</h2></div></div>
      <button type="button" onClick={() => setCreatingProject(true)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"><Plus className="h-3.5 w-3.5" /> Nuevo proyecto</button>
    </div>
    {creatingProject && <NewProjectForm classroomId={classroomId} activities={activities} onCreated={(project) => { reload(); setProjectId(project.id); setCreatingProject(false) }} onCancel={() => setCreatingProject(false)} />}
    {!projects.length
      ? <Empty msg="Todavía no has creado un proyecto de Edusyn Crea en esta aula." />
      : <>
        {projects.length > 1 && <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />}
        {linkedActivity && <p className="text-xs text-slate-500">Vinculado a la actividad del aula: <span className="font-semibold text-slate-700">{linkedActivity.title}</span></p>}
        {projectId && <ProjectDashboard key={projectId} classroomId={classroomId} projectId={projectId} />}
      </>}
  </div>
}

function NewProjectForm({ classroomId, activities, onCreated, onCancel }: { classroomId: string; activities: ClassroomActivitySummary[]; onCreated: (project: ConstruyeProject) => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [instructions, setInstructions] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [classroomActivityId, setClassroomActivityId] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!title.trim()) { toast.warning('Falta el título del proyecto'); return }
    setSaving(true)
    try {
      const { data } = await construyeApi.createProject({
        classroomId, title: title.trim(), instructions: instructions.trim() || undefined,
        dueDate: dueDate || undefined, classroomActivityId: classroomActivityId || undefined,
      })
      toast.success('Proyecto creado')
      onCreated(data)
    } catch (error) {
      toast.error(error)
    } finally {
      setSaving(false)
    }
  }

  return <div className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
    <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título del proyecto (ej.: App para separar residuos)" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
    <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Instrucciones para los equipos (opcional)" className="min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
    <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
    <label className="block text-xs font-medium text-slate-600">
      Vincular con una actividad ya creada en este aula (opcional)
      <select value={classroomActivityId} onChange={(event) => setClassroomActivityId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
        <option value="">Sin vincular — proyecto suelto</option>
        {activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}
      </select>
    </label>
    {classroomActivityId && <p className="text-xs text-slate-500">La entrega, la rúbrica y el plazo siguen viviendo en esa actividad; Edusyn Crea conserva su código y versiones.</p>}
    <div className="flex gap-2">
      <button type="button" disabled={saving} onClick={submit} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300">{saving ? 'Creando…' : 'Crear proyecto'}</button>
      <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white">Cancelar</button>
    </div>
  </div>
}

interface RosterStudent { enrollmentId: string; name: string }

function ProjectDashboard({ classroomId, projectId }: { classroomId: string; projectId: string }) {
  const [teams, setTeams] = useState<ConstruyeDashboardTeam[] | null>(null)
  const [roster, setRoster] = useState<RosterStudent[]>([])
  const [creatingTeam, setCreatingTeam] = useState(false)

  const load = useCallback(() => {
    construyeApi.dashboard(projectId).then(({ data }) => setTeams(data || [])).catch(() => setTeams([]))
  }, [projectId])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    classroomApi.getStudents(classroomId)
      .then(({ data }: { data: any[] }) => setRoster((data || []).map((enrollment) => ({
        enrollmentId: enrollment.id,
        name: `${enrollment.student?.user?.firstName || ''} ${enrollment.student?.user?.lastName || ''}`.trim() || 'Estudiante',
      }))))
      .catch(() => setRoster([]))
  }, [classroomId])

  if (teams === null) return <Loading />

  const takenEnrollmentIds = teams.flatMap((team) => team.members.map((member) => member.studentEnrollment.id))

  return <div className="space-y-4">
    <div className="flex justify-end">
      <button type="button" onClick={() => setCreatingTeam(true)} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"><Plus className="h-3.5 w-3.5" /> Nuevo equipo</button>
    </div>
    {creatingTeam && <NewTeamForm projectId={projectId} roster={roster} takenEnrollmentIds={takenEnrollmentIds} onCreated={() => { setCreatingTeam(false); load() }} onCancel={() => setCreatingTeam(false)} />}
    {!teams.length
      ? <Empty msg="Todavía no hay equipos en este proyecto." />
      : <div className="grid gap-3 sm:grid-cols-2">{teams.map((team) => <TeamCard key={team.id} team={team} onCommented={load} />)}</div>}
  </div>
}

function NewTeamForm({ projectId, roster, takenEnrollmentIds, onCreated, onCancel }: {
  projectId: string
  roster: RosterStudent[]
  takenEnrollmentIds: string[]
  onCreated: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Record<string, ConstruyeMemberRole>>({})
  const [saving, setSaving] = useState(false)
  const available = roster.filter((student) => !takenEnrollmentIds.includes(student.enrollmentId))

  const toggle = (enrollmentId: string) => setSelected((current) => {
    const next = { ...current }
    if (next[enrollmentId]) delete next[enrollmentId]
    else next[enrollmentId] = 'DEVELOPMENT'
    return next
  })

  const submit = async () => {
    const members = Object.entries(selected).map(([studentEnrollmentId, role]) => ({ studentEnrollmentId, role }))
    if (!name.trim()) { toast.warning('Falta el nombre del equipo'); return }
    if (!members.length) { toast.warning('Selecciona al menos un integrante'); return }
    setSaving(true)
    try {
      await construyeApi.createTeam(projectId, { name: name.trim(), members })
      toast.success('Equipo creado')
      onCreated()
    } catch (error) {
      toast.error(error)
    } finally {
      setSaving(false)
    }
  }

  return <div className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
    <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nombre del equipo" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
    {available.length === 0
      ? <p className="text-sm text-slate-600">Todos los estudiantes de esta aula ya están en un equipo de este proyecto.</p>
      : <div className="max-h-64 space-y-1 overflow-auto rounded-lg border border-slate-200 bg-white p-2">
        {available.map((student) => <div key={student.enrollmentId} className="flex items-center gap-2 py-1">
          <input type="checkbox" checked={!!selected[student.enrollmentId]} onChange={() => toggle(student.enrollmentId)} />
          <span className="flex-1 text-sm text-slate-700">{student.name}</span>
          {selected[student.enrollmentId] && <select
            value={selected[student.enrollmentId]}
            onChange={(event) => setSelected((current) => ({ ...current, [student.enrollmentId]: event.target.value as ConstruyeMemberRole }))}
            className="rounded border border-slate-200 px-2 py-1 text-xs"
          >
            {(Object.keys(ROLE_LABEL) as ConstruyeMemberRole[]).map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
          </select>}
        </div>)}
      </div>}
    <div className="flex gap-2">
      <button type="button" disabled={saving} onClick={submit} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-300">{saving ? 'Creando…' : 'Crear equipo'}</button>
      <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white">Cancelar</button>
    </div>
  </div>
}

// Semáforo del docente: verde avanza, amarillo revisar, rojo apoyar ya (calculado en la API).
const SIGNAL_STYLE = { green: 'bg-emerald-100 text-emerald-800', yellow: 'bg-amber-100 text-amber-800', red: 'bg-rose-100 text-rose-800' } as const
const SIGNAL_DOT = { green: 'bg-emerald-500', yellow: 'bg-amber-500', red: 'bg-rose-500' } as const

function TeamCard({ team, onCommented }: { team: ConstruyeDashboardTeam; onCommented: () => void }) {
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [view, setView] = useState<'none' | 'app' | 'code' | 'reasoning'>('none')
  const [unlocking, setUnlocking] = useState(false)

  const sendComment = async () => {
    if (!comment.trim()) return
    setSending(true)
    try {
      await construyeApi.addJournalEntry(team.id, { type: 'TEACHER_COMMENT', summary: comment.trim() })
      setComment('')
      toast.success('Comentario enviado')
      onCommented()
    } catch (error) {
      toast.error(error)
    } finally {
      setSending(false)
    }
  }

  const project = team.latestVersion ? manifestToProject(team.latestVersion.manifest) : null
  const gate = team.buildGate
  const waitingPlan = !!gate && !gate.hasVersions && !gate.canSaveFirstVersion

  // Excepción controlada: el equipo puede guardar su primera versión sin completar el plan.
  // Queda en la bitácora con el docente como autor.
  const unlockBuild = async () => {
    const reason = await promptDialog('El equipo podrá guardar versiones aunque no haya escrito su plan. ¿Por qué lo habilitas? (opcional)', { title: 'Permitir guardar sin plan', confirmLabel: 'Permitir' })
    if (reason === null) return
    setUnlocking(true)
    try {
      await construyeApi.unlockBuild(team.id, { reason })
      toast.success('Listo', 'El equipo ya puede guardar su primera versión.')
      onCommented()
    } catch (error) {
      toast.error(error)
    } finally {
      setUnlocking(false)
    }
  }

  return <article className="rounded-2xl border border-hairline bg-surface-1 p-4">
    <header className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2"><Users2 className="h-4 w-4 text-indigo-600" /><h3 className="font-semibold text-slate-800">{team.name}</h3></div>
      {team.signal
        ? <span title={team.signal.reason} className={`inline-flex max-w-[55%] items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-xs font-semibold ${SIGNAL_STYLE[team.signal.level]}`}><span className={`h-2 w-2 shrink-0 rounded-full ${SIGNAL_DOT[team.signal.level]}`} /> {team.signal.reason}</span>
        : team.needsAttention && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800"><AlertTriangle className="h-3 w-3" /> Necesita apoyo</span>}
    </header>
    <p className="mt-1 text-xs text-slate-500">{team.members.map((member) => `${member.studentEnrollment.student.firstName} (${ROLE_LABEL[member.role]})`).join(', ') || 'Sin integrantes'}</p>
    <PhaseProgress brief={team.brief} versionCount={team.latestVersion ? team.latestVersion.number : 0} />
    {team.brief?.problem && <div className="mt-3 rounded-xl border border-cyan-100 bg-cyan-50/70 px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-wider text-cyan-700">El problema, en sus palabras</p><p className="mt-1 text-sm leading-5 text-slate-700">{team.brief.problem}</p></div>}
    <p className="mt-2 text-sm text-slate-600">{team.latestVersion ? `Última versión: v${team.latestVersion.number}` : 'Sin versiones guardadas todavía.'}</p>
    {waitingPlan && <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-600">
      <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> Aún no puede guardar su primera versión: le falta completar su plan.</span>
      <button type="button" disabled={unlocking} onClick={unlockBuild} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"><Unlock className="h-3 w-3" /> Permitir guardar sin plan</button>
    </div>}
    {gate?.unlockedByTeacher && !gate.hasVersions && <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Unlock className="h-3.5 w-3.5" /> Habilitaste que guarde sin completar el plan.</p>}
    <div className="mt-1 flex flex-wrap gap-3">
      <button type="button" onClick={() => setView((current) => current === 'reasoning' ? 'none' : 'reasoning')} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline"><BrainCircuit className="h-3.5 w-3.5" /> {view === 'reasoning' ? 'Ocultar razonamiento' : 'Ver razonamiento'}</button>
    </div>
    {view === 'reasoning' && <TeamReasoning teamId={team.id} />}
    {team.latestVersion && <div className="mt-1 flex gap-3">
      <button type="button" onClick={() => setView((current) => current === 'app' ? 'none' : 'app')} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline"><Smartphone className="h-3.5 w-3.5" /> {view === 'app' ? 'Ocultar la app' : 'Ver la app'}</button>
      <button type="button" onClick={() => setView((current) => current === 'code' ? 'none' : 'code')} className="text-xs font-semibold text-indigo-700 hover:underline">{view === 'code' ? 'Ocultar código' : 'Ver código'}</button>
    </div>}
    {view === 'app' && project && <div className="my-3 rounded-2xl bg-slate-100 p-4">
      <PhoneMockup><PreviewFrame project={project} compact /></PhoneMockup>
      <p className="mt-2 text-center text-[11px] text-slate-500">Así la vería un estudiante en su teléfono. Ejecutándose en el origen aislado, sin sesión ni datos de Edusyn.</p>
    </div>}
    {view === 'code' && project && <div className="mt-2 space-y-2">
      {(['html', 'css', 'js'] as const).map((key) => <pre key={key} className="max-h-40 overflow-auto rounded-lg bg-slate-950 p-2 text-[11px] leading-4 text-slate-100"><code>{project[key] || '(vacío)'}</code></pre>)}
    </div>}
    {team.recentMilestones.length > 0 && <ul className="mt-3 space-y-1 border-t border-hairline pt-2 text-xs text-slate-500">
      {team.recentMilestones.slice(0, 3).map((entry) => <li key={entry.id}>• {entry.summary}</li>)}
    </ul>}
    <div className="mt-3 flex gap-2">
      <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Dejar una pista o comentario…" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs" />
      <button type="button" disabled={sending} onClick={sendComment} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900 disabled:bg-slate-300">Enviar</button>
    </div>
  </article>
}
