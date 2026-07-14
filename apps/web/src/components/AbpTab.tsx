import { useCallback, useEffect, useRef, useState } from 'react'
import { Rocket, Plus, Trash2, Check, Clock, Lock, Loader2, Users, Send, ChevronLeft, Paperclip, Link2 } from 'lucide-react'
import { abpApi, classroomApi } from '../lib/api'
import AbpReview from './AbpReview'

// Metadatos de las 6 fases (nombre + icono). El motor real vive en el backend.
const PHASES = [
  { n: 1, name: 'El Reto', icon: '🧭' },
  { n: 2, name: 'Tormenta de Ideas', icon: '⚡' },
  { n: 3, name: 'Objetivos', icon: '🎯' },
  { n: 4, name: 'Plan de Acción', icon: '🛠️' },
  { n: 5, name: 'Prototipo', icon: '🚀' },
  { n: 6, name: 'Socialización', icon: '🏆' },
]
const phaseName = (n: number) => PHASES.find(p => p.n === n)?.name || `Fase ${n}`
const stateOf = (team: any, n: number) => (team?.phaseStates || []).find((s: any) => s.phase === n)?.status || 'LOCKED'
const phaseData = (team: any, n: number) => (team?.phaseStates || []).find((s: any) => s.phase === n)?.data || {}

// Fase 1 — Canvas del Problema (4 tarjetas colaborativas).
const CANVAS_CARDS = [
  { q: '¿Qué está pasando?', icon: '🔍' },
  { q: '¿A quiénes afecta?', icon: '👥' },
  { q: '¿Por qué es importante?', icon: '⭐' },
  { q: '¿Qué pasa si nadie lo resuelve?', icon: '⚠️' },
]

function CanvasPhase({ team, onSaved }: { team: any; onSaved: () => void }) {
  const data = phaseData(team, 1)
  const canvas: any[] = data.canvas || []
  const editable = stateOf(team, 1) === 'IN_PROGRESS'
  const [local, setLocal] = useState<string[]>(() => CANVAS_CARDS.map((_, i) => canvas[i]?.value || ''))

  const save = async (i: number) => {
    if (local[i] === (canvas[i]?.value || '')) return
    try { await abpApi.saveCanvas(team.id, i, local[i]); onSaved() } catch {}
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {CANVAS_CARDS.map((c, i) => {
        const filled = !!local[i].trim()
        return (
          <div key={i} className={`rounded-xl border-2 p-3 ${filled ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200'}`}>
            <h5 className="font-bold text-sm text-slate-700 flex items-center gap-1.5 mb-2">{c.icon} {c.q}</h5>
            <textarea
              value={local[i]}
              disabled={!editable}
              onChange={e => setLocal(v => { const n = [...v]; n[i] = e.target.value; return n })}
              onBlur={() => editable && save(i)}
              rows={3}
              placeholder="Escribe aquí…"
              className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-sm resize-none disabled:opacity-70"
            />
            <p className="text-xs text-slate-400 mt-1">{filled ? `✍️ ${canvas[i]?.byName || 'Aportó'}` : 'Tarjeta pendiente'}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Sendero de 6 fases (nodos hecho / actual / bloqueado) ────────────────────
function Trail({ team, mini = false }: { team: any; mini?: boolean }) {
  if (mini) {
    return (
      <div className="flex gap-1">
        {PHASES.map(p => {
          const st = stateOf(team, p.n)
          const cls = st === 'VALIDATED' ? 'bg-emerald-500' : st === 'IN_PROGRESS' || st === 'AWAITING' ? 'bg-amber-400' : 'bg-slate-200'
          return <div key={p.n} className={`flex-1 h-2 rounded-full ${cls}`} title={`Fase ${p.n}: ${p.name}`} />
        })}
      </div>
    )
  }
  return (
    <div className="flex items-start justify-between gap-1 py-2">
      {PHASES.map((p, i) => {
        const st = stateOf(team, p.n)
        const done = st === 'VALIDATED'
        const current = st === 'IN_PROGRESS' || st === 'AWAITING'
        return (
          <div key={p.n} className="flex flex-col items-center gap-1.5 flex-1 min-w-0 relative">
            {i < PHASES.length - 1 && <div className={`absolute top-6 left-1/2 w-full h-0.5 ${done ? 'bg-emerald-300' : 'bg-slate-200'}`} />}
            <div className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center text-xl border-2 ${
              done ? 'bg-emerald-50 border-emerald-400' : current ? 'bg-amber-50 border-amber-400 ring-4 ring-amber-100' : 'bg-slate-50 border-slate-200'
            }`}>
              {done ? <Check className="w-6 h-6 text-emerald-600" /> : st === 'LOCKED' ? <Lock className="w-4 h-4 text-slate-300" /> : p.icon}
            </div>
            <span className={`text-[11px] text-center leading-tight font-medium ${current ? 'text-amber-700' : done ? 'text-emerald-700' : 'text-slate-400'}`}>
              Fase {p.n}<br />{p.name}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// Fase 2 — Tormenta de Ideas (muro de notas + votación).
const STICKY_COLORS = ['#FEF3C7', '#D1FAE5', '#FCE7F3', '#DBEAFE', '#EDE9FE']
function IdeasPhase({ team, onSaved }: { team: any; onSaved: () => void }) {
  const ideas: any[] = phaseData(team, 2).ideas || []
  const editable = stateOf(team, 2) === 'IN_PROGRESS'
  const votesPerStudent = team.config?.votesPerStudent ?? 3
  const votesLeft = Math.max(0, votesPerStudent - (team.myVotesUsed ?? 0))
  const myEnrollment = team.myEnrollmentId
  const votedIds = new Set<string>(team.myVotedIds || [])
  const maxVotes = ideas.reduce((m: number, i: any) => Math.max(m, i.votes || 0), 0)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const add = async () => {
    if (!text.trim() || busy) return
    setBusy(true)
    try { await abpApi.addIdea(team.id, text.trim()); setText(''); onSaved() } finally { setBusy(false) }
  }
  const vote = async (id: string) => {
    setBusy(true)
    try { await abpApi.voteIdea(team.id, id); onSaved() } catch (e: any) { alert(e?.response?.data?.message || 'No se pudo votar') } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} disabled={!editable}
          placeholder="Escribe tu idea y presiona Enter…" className="flex-1 min-w-[200px] border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm" />
        <span className="flex items-center gap-1.5 font-bold text-violet-700 bg-amber-50 rounded-xl px-4 text-sm">🗳️ {votesLeft} votos</span>
      </div>
      {ideas.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">Aún no hay ideas. ¡Sé el primero!</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ideas.map((i: any, ix: number) => {
            const mine = i.by === myEnrollment
            const voted = votedIds.has(i.id)
            const top = (i.votes || 0) === maxVotes && maxVotes > 0
            return (
              <div key={i.id} className={`rounded-lg p-3 shadow-sm relative flex flex-col gap-2 min-h-[100px] ${top ? 'ring-2 ring-amber-400' : ''}`} style={{ background: STICKY_COLORS[ix % STICKY_COLORS.length] }}>
                {top && <span className="absolute -top-2 right-2 bg-amber-400 text-white text-[10px] font-bold rounded-full px-2 py-0.5">⭐ favorita</span>}
                <div className="text-sm text-slate-800">{i.text}</div>
                <div className="mt-auto flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>— {i.byName}</span>
                  <button onClick={() => vote(i.id)} disabled={mine || voted || votesLeft <= 0 || !editable || !myEnrollment || busy}
                    className="bg-white/70 rounded-full px-3 py-1 font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed">
                    👍 {i.votes || 0}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Fase 3 — Objetivo SMART (objetivo + 5 criterios).
const SMART_CRITERIA = [
  { k: 'S', t: 'Específico: dice exactamente qué harán' },
  { k: 'M', t: 'Medible: se puede verificar con datos' },
  { k: 'A', t: 'Alcanzable: es posible con sus recursos' },
  { k: 'R', t: 'Relevante: responde a la problemática' },
  { k: 'T', t: 'con Tiempo: tiene un plazo definido' },
]
function SmartPhase({ team, onSaved }: { team: any; onSaved: () => void }) {
  const smart = phaseData(team, 3).smart || {}
  const editable = stateOf(team, 3) === 'IN_PROGRESS'
  const [text, setText] = useState<string>(smart.text || '')
  const [checks, setChecks] = useState<boolean[]>(() => SMART_CRITERIA.map((_, i) => !!smart.checks?.[i]))
  const [busy, setBusy] = useState(false)

  const save = async (nt: string, nc: boolean[]) => {
    setBusy(true)
    try { await abpApi.saveSmart(team.id, nt, nc); onSaved() } finally { setBusy(false) }
  }
  const toggle = (i: number) => { const nc = [...checks]; nc[i] = !nc[i]; setChecks(nc); if (editable) save(text, nc) }

  return (
    <div>
      <textarea value={text} onChange={e => setText(e.target.value)} onBlur={() => editable && text !== (smart.text || '') && save(text, checks)}
        disabled={!editable} rows={3} placeholder="Nuestro objetivo es… (específico, medible, con plazo)"
        className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm mb-3 disabled:opacity-70" />
      <div className="grid sm:grid-cols-2 gap-2">
        {SMART_CRITERIA.map((c, i) => (
          <label key={c.k} className={`flex items-start gap-2.5 border-2 rounded-xl p-3 text-sm cursor-pointer ${checks[i] ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200'} ${busy ? 'opacity-70' : ''}`}>
            <input type="checkbox" checked={checks[i]} onChange={() => toggle(i)} disabled={!editable} className="mt-0.5 accent-emerald-600" />
            <span><b>{c.k}</b> · {c.t}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// Fase 4 — Plan de Acción (Kanban).
const KANBAN_COLS = ['📋 Por hacer', '⚙️ En proceso', '✅ Hecho']
function teamMembers(team: any): { id: string; name: string }[] {
  return (team.members || []).map((m: any) => ({
    id: m.studentEnrollmentId,
    name: `${m.studentEnrollment?.student?.user?.firstName ?? ''} ${m.studentEnrollment?.student?.user?.lastName ?? ''}`.trim() || 'Integrante',
  }))
}
function KanbanPhase({ team, onSaved }: { team: any; onSaved: () => void }) {
  const tasks: any[] = phaseData(team, 4).tasks || []
  const editable = stateOf(team, 4) === 'IN_PROGRESS'
  const members = teamMembers(team)
  const [text, setText] = useState('')
  const [owner, setOwner] = useState(members[0]?.id || '')
  const [busy, setBusy] = useState(false)

  const add = async () => {
    if (!text.trim() || !owner || busy) return
    setBusy(true)
    try { await abpApi.addTask(team.id, text.trim(), owner); setText(''); onSaved() } catch (e: any) { alert(e?.response?.data?.message || 'Error') } finally { setBusy(false) }
  }
  const act = async (fn: Promise<any>) => { setBusy(true); try { await fn; onSaved() } finally { setBusy(false) } }

  return (
    <div>
      {editable && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} placeholder="Nueva tarea…" className="flex-1 min-w-[160px] border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm" />
          <select value={owner} onChange={e => setOwner(e.target.value)} className="border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm">
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button onClick={add} disabled={!text.trim() || !owner || busy} className="px-4 bg-violet-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50">Agregar</button>
        </div>
      )}
      <div className="grid sm:grid-cols-3 gap-3">
        {KANBAN_COLS.map((c, ci) => {
          const list = tasks.filter(t => t.col === ci)
          return (
            <div key={ci} className="bg-slate-50 rounded-xl p-3">
              <h5 className="font-bold text-sm text-slate-700 flex justify-between mb-2">{c}<span className="text-slate-400">{list.length}</span></h5>
              <div className="space-y-2">
                {list.map(t => (
                  <div key={t.id} className="bg-white rounded-lg p-2.5 text-sm shadow-sm">
                    <div className={ci === 2 ? 'line-through text-slate-400' : 'text-slate-700'}>{t.text}</div>
                    <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                      <span>👤 {t.ownerName}</span>
                      {editable && <button onClick={() => act(abpApi.removeTask(team.id, t.id))} className="text-slate-300 hover:text-rose-500">✕</button>}
                    </div>
                    {editable && ci < 2 && <button onClick={() => act(abpApi.moveTask(team.id, t.id))} className="mt-1.5 text-xs bg-violet-600 text-white rounded px-2 py-1 font-medium">{ci === 0 ? 'Iniciar →' : 'Terminar ✔'}</button>}
                  </div>
                ))}
                {list.length === 0 && <p className="text-xs text-slate-300 text-center py-2">Vacío</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Fase 5 — Prototipo y Evidencias (enlaces + archivos subidos a storage).
function EvidencePhase({ team, onSaved }: { team: any; onSaved: () => void }) {
  const evidences: any[] = phaseData(team, 5).evidences || []
  const editable = stateOf(team, 5) === 'IN_PROGRESS'
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const addLink = async () => {
    const u = link.trim()
    if (!u || busy) return
    setBusy(true)
    try { await abpApi.addEvidence(team.id, 'LINK', u); setLink('') ; onSaved() } catch (e: any) { alert(e?.response?.data?.message || 'Error') } finally { setBusy(false) }
  }
  const upload = async (file: File) => {
    setBusy(true)
    try {
      const { data } = await classroomApi.uploadMaterial(file)
      const url = data?.data?.path || data?.data?.url
      if (url) { await abpApi.addEvidence(team.id, 'FILE', url, file.name); onSaved() }
    } catch { alert('No se pudo subir el archivo') } finally { setBusy(false) }
  }
  const remove = async (id: string) => { setBusy(true); try { await abpApi.removeEvidence(team.id, id); onSaved() } finally { setBusy(false) } }

  return (
    <div>
      {editable && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <input value={link} onChange={e => setLink(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addLink() }} placeholder="Pega un enlace (Canva, MakeCode, video…)" className="flex-1 min-w-[200px] border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm" />
          <button onClick={addLink} disabled={!link.trim() || busy} className="px-4 bg-violet-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"><Link2 className="w-4 h-4" /> Enlace</button>
          <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = '' }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="px-4 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"><Paperclip className="w-4 h-4" /> Archivo</button>
        </div>
      )}
      {evidences.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">Aún no hay evidencias. Sube fotos, videos o enlaces del prototipo.</p>
      ) : (
        <div className="space-y-2">
          {evidences.map((e: any) => (
            <div key={e.id} className="flex items-center gap-3 border border-slate-200 rounded-xl p-3">
              <span>{e.kind === 'FILE' ? '📎' : '🔗'}</span>
              <a href={e.url} target="_blank" rel="noreferrer" className="flex-1 text-sm text-violet-600 hover:underline truncate">{e.label}</a>
              <span className="text-xs text-slate-400">{e.byName}</span>
              {editable && <button onClick={() => remove(e.id)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Fase 6 — Socialización y Coevaluación (cada equipo evalúa a los demás, 1–4).
const COEVAL_CRITERIA = ['Claridad de la presentación', 'Creatividad de la solución', 'Trabajo en equipo', 'Impacto en la comunidad']
function CoevalCard({ team, sibling, existing, editable, onSaved }: { team: any; sibling: any; existing: any; editable: boolean; onSaved: () => void }) {
  const [scores, setScores] = useState<number[]>(() => COEVAL_CRITERIA.map((_, i) => existing?.scores?.[i] || 0))
  const [busy, setBusy] = useState(false)
  const done = !!existing
  const complete = scores.every(s => s >= 1)
  const submit = async () => {
    if (!complete || busy) return
    setBusy(true)
    try { await abpApi.coeval(team.id, sibling.id, scores); onSaved() } catch (e: any) { alert(e?.response?.data?.message || 'Error') } finally { setBusy(false) }
  }
  return (
    <div className={`border-2 rounded-xl p-4 ${done ? 'border-emerald-300 bg-emerald-50/40' : 'border-slate-200'}`}>
      <div className="flex justify-between items-center mb-2">
        <h5 className="font-bold text-slate-800">{sibling.emoji} {sibling.name}</h5>
        {done && <span className="text-xs text-emerald-600 font-semibold">✓ Evaluado</span>}
      </div>
      <div className="space-y-2">
        {COEVAL_CRITERIA.map((c, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <span className="text-sm text-slate-600">{c}</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(n => (
                <button key={n} onClick={() => editable && setScores(s => { const x = [...s]; x[i] = n; return x })} disabled={!editable}
                  className={`w-8 h-8 rounded-lg text-sm font-bold ${scores[i] === n ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{n}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {editable && <button onClick={submit} disabled={!complete || busy} className="mt-3 w-full py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">{done ? 'Actualizar' : 'Enviar evaluación'}</button>}
    </div>
  )
}
function CoevalPhase({ team, onSaved }: { team: any; onSaved: () => void }) {
  const siblings = team.siblings || []
  const coevals = phaseData(team, 6).coevals || {}
  const editable = stateOf(team, 6) === 'IN_PROGRESS'
  if (siblings.length === 0) return <p className="text-sm text-slate-400 text-center py-6">Son el único equipo del proyecto: no hay coevaluación. Presenten su solución y soliciten la validación para cerrar la expedición.</p>
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {siblings.map((s: any) => <CoevalCard key={s.id} team={team} sibling={s} existing={coevals[s.id]} editable={editable} onSaved={onSaved} />)}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// VISTA ESTUDIANTE — su expedición
// ═══════════════════════════════════════════════════════════════════════════
function StudentExpedition({ projects }: { projects: any[] }) {
  const [projectId, setProjectId] = useState<string>(projects[0]?.id || '')
  const [team, setTeam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    if (!projectId) { setLoading(false); return }
    setLoading(true)
    abpApi.myTeam(projectId).then(({ data }) => setTeam(data)).catch(() => setTeam(null)).finally(() => setLoading(false))
  }, [projectId])
  useEffect(() => { load() }, [load])

  const requestValidation = async () => {
    if (!team) return
    setBusy(true)
    try { await abpApi.requestValidation(team.id); load() } finally { setBusy(false) }
  }

  if (projects.length === 0) return <Empty msg="Tu docente aún no ha creado una Expedición ABP en esta aula." />
  if (loading) return <Loading />
  if (!team) return (
    <div className="space-y-4">
      <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />
      <Empty msg="Aún no estás en un equipo de este proyecto. Tu docente te asignará a uno." />
    </div>
  )

  const cur = team.currentPhase
  const curState = stateOf(team, cur)
  const curPs = (team.phaseStates || []).find((s: any) => s.phase === cur)
  // Criterios automáticos para habilitar "Solicitar validación".
  const members = team.members?.length || 1
  const canvasFilled = ((curPs?.data?.canvas) || []).filter((c: any) => c && String(c.value || '').trim()).length
  const ideas: any[] = (curPs?.data?.ideas) || []
  const totalVotes = ideas.reduce((s: number, i: any) => s + (i.votes || 0), 0)
  const minIdeas = (team.config?.minIdeasPerMember ?? 2) * members
  const smart = (curPs?.data?.smart) || {}
  const smartChecked = Array.isArray(smart.checks) ? smart.checks.filter(Boolean).length : 0
  const tasks4: any[] = (curPs?.data?.tasks) || []
  const memberIds = (team.members || []).map((m: any) => m.studentEnrollmentId)
  const owners = new Set(tasks4.map((t: any) => t.owner))
  const tasksDone = tasks4.filter((t: any) => t.col === 2).length
  const kanbanOk = tasks4.length > 0 && tasksDone === tasks4.length && memberIds.length > 0 && memberIds.every((id: string) => owners.has(id))
  const evidences5: any[] = (curPs?.data?.evidences) || []
  const minEv = team.config?.minEvidences ?? 3
  const siblings6 = team.siblings || []
  const coevalsDone = Object.keys((curPs?.data?.coevals) || {}).length
  const canRequest = cur === 1 ? canvasFilled >= 4
    : cur === 2 ? (ideas.length >= minIdeas && totalVotes >= members)
    : cur === 3 ? (smartChecked >= 5 && String(smart.text || '').trim().length >= 20)
    : cur === 4 ? kanbanOk
    : cur === 5 ? evidences5.length >= minEv
    : cur === 6 ? (siblings6.length === 0 || coevalsDone >= siblings6.length)
    : true

  return (
    <div className="space-y-4">
      {projects.length > 1 && <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />}

      {/* Cabecera del equipo */}
      <div className="bg-white rounded-2xl border-2 border-violet-200 p-5" style={{ borderTopColor: team.color, borderTopWidth: 6 }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-xl font-bold text-slate-800">{team.emoji} {team.name}</h3>
            {team.problem && <p className="text-sm text-slate-500 mt-0.5">Reto: {team.problem}</p>}
            {team.badges?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {team.badges.map((b: string) => <span key={b} className="text-xs font-medium bg-amber-50 text-amber-700 rounded-full px-2.5 py-0.5">{b}</span>)}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-violet-600">⭐ {team.xp}</div>
            <div className="text-xs text-slate-400 font-semibold">XP de expedición</div>
          </div>
        </div>
      </div>

      {/* Sendero */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <Trail team={team} />
      </div>

      {/* Panel de la fase actual */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="text-xs font-bold uppercase tracking-wide text-violet-600 mb-1">Fase {cur} de 6</div>
        <h3 className="text-lg font-bold text-slate-800 mb-3">{PHASES.find(p => p.n === cur)?.icon} {phaseName(cur)}</h3>

        {curPs?.feedback && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border-l-4 border-rose-400 text-sm text-rose-800">
            🧑‍🏫 <b>Retroalimentación del docente:</b> {curPs.feedback}
          </div>
        )}

        {curState === 'AWAITING' ? (
          <div className="p-4 rounded-xl bg-amber-50 text-amber-800 font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5" /> Esperando validación del docente…
          </div>
        ) : cur === 6 && curState === 'VALIDATED' ? (
          <div className="text-center py-6">🏆<p className="font-bold text-slate-800 mt-2">¡Llegaron a la cima de la expedición!</p></div>
        ) : (
          <>
            {cur === 1 ? (
              <CanvasPhase team={team} onSaved={load} />
            ) : cur === 2 ? (
              <IdeasPhase team={team} onSaved={load} />
            ) : cur === 3 ? (
              <SmartPhase team={team} onSaved={load} />
            ) : cur === 4 ? (
              <KanbanPhase team={team} onSaved={load} />
            ) : cur === 5 ? (
              <EvidencePhase team={team} onSaved={load} />
            ) : cur === 6 ? (
              <CoevalPhase team={team} onSaved={load} />
            ) : (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm">
                🛠️ La herramienta de esta fase ({phaseName(cur)}) se habilita en el siguiente ticket.
                <br />Por ahora puedes solicitar la validación al docente.
              </div>
            )}
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              {cur === 1 && <span className="text-sm text-slate-500">Tarjetas completas: <b className="text-slate-700">{canvasFilled}/4</b></span>}
              {cur === 2 && <span className="text-sm text-slate-500">Ideas: <b className="text-slate-700">{ideas.length}/{minIdeas}</b> · Votos: <b className="text-slate-700">{totalVotes}</b></span>}
              {cur === 3 && <span className="text-sm text-slate-500">Criterios SMART: <b className="text-slate-700">{smartChecked}/5</b></span>}
              {cur === 4 && <span className="text-sm text-slate-500">Tareas hechas: <b className="text-slate-700">{tasksDone}/{tasks4.length}</b>{!owners.size || memberIds.some((id: string) => !owners.has(id)) ? ' · falta asignar a todos' : ''}</span>}
              {cur === 5 && <span className="text-sm text-slate-500">Evidencias: <b className="text-slate-700">{evidences5.length}/{minEv}</b></span>}
              {cur === 6 && siblings6.length > 0 && <span className="text-sm text-slate-500">Equipos evaluados: <b className="text-slate-700">{coevalsDone}/{siblings6.length}</b></span>}
              <button onClick={requestValidation} disabled={busy || !canRequest}
                className="ml-auto py-3 px-6 bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} {canRequest ? 'Solicitar validación' : 'Completa los criterios'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// VISTA DOCENTE — proyectos, equipos, cola de validaciones
// ═══════════════════════════════════════════════════════════════════════════
function TeacherView({ classroomId, projects, reload }: { classroomId: string; projects: any[]; reload: () => void }) {
  const [selected, setSelected] = useState<string | null>(null)

  if (selected) {
    const p = projects.find(x => x.id === selected)
    return <TeacherProjectDetail classroomId={classroomId} projectId={selected} projectTitle={p?.title || ''} onBack={() => { setSelected(null); reload() }} />
  }

  return (
    <div className="space-y-4">
      <CreateProject classroomId={classroomId} onCreated={reload} />
      {projects.length === 0 ? (
        <Empty msg="Aún no has creado ninguna Expedición ABP." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {projects.map(p => (
            <button key={p.id} onClick={() => setSelected(p.id)} className="text-left bg-white rounded-2xl border-2 border-slate-200 hover:border-violet-300 p-4 transition-colors">
              <h3 className="font-bold text-slate-800">🧭 {p.title}</h3>
              {p.challenge && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{p.challenge}</p>}
              <div className="mt-3 flex items-center gap-1.5 text-sm text-violet-600 font-medium"><Users className="w-4 h-4" /> {p._count?.teams ?? 0} equipo(s)</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CreateProject({ classroomId, onCreated }: { classroomId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [challenge, setChallenge] = useState('')
  const [busy, setBusy] = useState(false)
  const create = async () => {
    if (!title.trim()) return
    setBusy(true)
    try { await abpApi.createProject({ classroomId, title: title.trim(), challenge: challenge.trim() || undefined }); setTitle(''); setChallenge(''); setOpen(false); onCreated() }
    finally { setBusy(false) }
  }
  if (!open) return <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700"><Plus className="w-5 h-5" /> Nueva Expedición ABP</button>
  return (
    <div className="bg-white rounded-2xl border-2 border-violet-200 p-5 space-y-3">
      <h3 className="font-bold text-slate-800">Nueva Expedición ABP</h3>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título del proyecto" className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm" autoFocus />
      <textarea value={challenge} onChange={e => setChallenge(e.target.value)} placeholder="Reto general (opcional)" rows={2} className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm resize-none" />
      <div className="flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Cancelar</button>
        <button onClick={create} disabled={!title.trim() || busy} className="px-5 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Crear</button>
      </div>
    </div>
  )
}

function TeacherProjectDetail({ classroomId, projectId, projectTitle, onBack }: { classroomId: string; projectId: string; projectTitle: string; onBack: () => void }) {
  const [project, setProject] = useState<any>(null)
  const [queue, setQueue] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([abpApi.getProject(projectId), abpApi.queue(classroomId)])
      .then(([p, q]) => { setProject(p.data); setQueue((q.data || []).filter((x: any) => x.team?.projectId === projectId)) })
      .finally(() => setLoading(false))
  }, [projectId, classroomId])
  useEffect(() => { load() }, [load])

  if (reviewingId) return <AbpReview validationId={reviewingId} onClose={(changed) => { setReviewingId(null); if (changed) load() }} />
  if (loading) return <Loading />

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ChevronLeft className="w-4 h-4" /> Todas las expediciones</button>
      <h3 className="text-xl font-bold text-slate-800">🧭 {project?.title || projectTitle}</h3>

      {/* Cola de validaciones */}
      {queue.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h4 className="font-bold text-slate-800 mb-3">🔔 Validaciones pendientes ({queue.length})</h4>
          <div className="space-y-3">{queue.map(q => <QueueItem key={q.id} q={q} onReview={setReviewingId} />)}</div>
        </div>
      )}

      {/* Equipos */}
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-slate-700">Equipos ({project?.teams?.length ?? 0})</h4>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {(project?.teams || []).map((t: any) => (
          <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-4" style={{ borderTopColor: t.color, borderTopWidth: 4 }}>
            <div className="flex items-start justify-between">
              <h5 className="font-bold text-slate-800">{t.emoji} {t.name}</h5>
              <button onClick={async () => { if (confirm('¿Eliminar equipo?')) { await abpApi.deleteTeam(t.id); load() } }} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Fase {t.currentPhase}: {phaseName(t.currentPhase)} · ⭐ {t.xp} XP</p>
            <div className="my-2"><Trail team={t} mini /></div>
            <div className="text-xs text-slate-500">{(t.members || []).map((m: any) => `${m.studentEnrollment?.student?.user?.firstName ?? ''}`).filter(Boolean).join(', ')}</div>
          </div>
        ))}
      </div>

      <CreateTeam classroomId={classroomId} projectId={projectId} onCreated={load} />
    </div>
  )
}

function QueueItem({ q, onReview }: { q: any; onReview: (id: string) => void }) {
  return (
    <div className="border-2 border-slate-200 rounded-xl p-4 flex items-center gap-3 flex-wrap">
      <div className="flex-1 min-w-[200px]">
        <p className="text-sm text-slate-700"><b>{q.team?.emoji} {q.team?.name}</b> solicita validar la <b>Fase {q.phase}: {phaseName(q.phase)}</b></p>
      </div>
      <button onClick={() => onReview(q.id)} className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700">Revisar y decidir →</button>
    </div>
  )
}

function CreateTeam({ classroomId, projectId, onCreated }: { classroomId: string; projectId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [roster, setRoster] = useState<{ enrollmentId: string; name: string }[]>([])
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🚀')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open && roster.length === 0) abpApi.roster(classroomId).then(({ data }) => setRoster(data)) }, [open, classroomId, roster.length])

  const create = async () => {
    if (!name.trim() || sel.size === 0) return
    setBusy(true)
    try { await abpApi.createTeam({ projectId, name: name.trim(), emoji, memberEnrollmentIds: [...sel] }); setName(''); setSel(new Set()); setOpen(false); onCreated() }
    catch (e: any) { alert(e?.response?.data?.message || 'No se pudo crear el equipo') }
    finally { setBusy(false) }
  }

  if (!open) return <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200"><Plus className="w-5 h-5" /> Armar equipo</button>
  return (
    <div className="bg-white rounded-2xl border-2 border-violet-200 p-5 space-y-3">
      <h4 className="font-bold text-slate-800">Nuevo equipo</h4>
      <div className="flex gap-2">
        <input value={emoji} onChange={e => setEmoji(e.target.value)} className="w-14 border border-slate-300 rounded-xl px-2 py-2.5 text-center text-lg" maxLength={2} />
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Nombre del equipo" className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm" autoFocus />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1.5">Integrantes ({sel.size})</p>
        <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl p-2 grid sm:grid-cols-2 gap-1">
          {roster.map(r => (
            <label key={r.enrollmentId} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm cursor-pointer ${sel.has(r.enrollmentId) ? 'bg-violet-50 text-violet-700' : 'hover:bg-slate-50 text-slate-600'}`}>
              <input type="checkbox" checked={sel.has(r.enrollmentId)} onChange={() => setSel(s => { const n = new Set(s); n.has(r.enrollmentId) ? n.delete(r.enrollmentId) : n.add(r.enrollmentId); return n })} className="accent-violet-600" />
              {r.name}
            </label>
          ))}
          {roster.length === 0 && <p className="text-xs text-slate-400 p-2">Cargando matriculados…</p>}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Cancelar</button>
        <button onClick={create} disabled={!name.trim() || sel.size === 0 || busy} className="px-5 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Crear equipo</button>
      </div>
    </div>
  )
}

// ─── helpers UI ──────────────────────────────────────────────────────────────
function Empty({ msg }: { msg: string }) {
  return <div className="text-center py-16 bg-white rounded-2xl border border-slate-200"><Rocket className="w-12 h-12 mx-auto text-slate-300 mb-3" /><p className="text-slate-500">{msg}</p></div>
}
function Loading() { return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-violet-500" /></div> }
function ProjectPicker({ projects, value, onChange }: { projects: any[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {projects.map(p => (
        <button key={p.id} onClick={() => onChange(p.id)} className={`px-3 py-2 rounded-xl text-sm font-medium border-2 ${value === p.id ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-500'}`}>{p.title}</button>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
export default function AbpTab({ classroomId, isTeacher }: { classroomId: string; isTeacher: boolean }) {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    abpApi.listByClassroom(classroomId).then(({ data }) => setProjects(data || [])).catch(() => setProjects([])).finally(() => setLoading(false))
  }, [classroomId])
  useEffect(() => { load() }, [load])

  if (loading) return <Loading />
  return isTeacher
    ? <TeacherView classroomId={classroomId} projects={projects} reload={load} />
    : <StudentExpedition projects={projects} />
}
