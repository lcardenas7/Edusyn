import { useCallback, useEffect, useRef, useState } from 'react'
import { Rocket, Plus, Trash2, Check, Clock, Lock, Loader2, Users, Send, ChevronLeft, Paperclip, Link2 } from 'lucide-react'
import confetti from 'canvas-confetti'
import { abpApi, classroomApi, storageApi } from '../lib/api'
import AbpReview from './AbpReview'
import { StationAgenda, StationGuide, StationInstruments, TeacherInstrumentsConfig } from './TallerInstruments'
import LessonEditor from './LessonEditor'
import LessonPlayer from './LessonPlayer'

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

function CanvasPhase({ team, onSaved }: { team: any; onSaved: () => void | Promise<void> }) {
  const data = phaseData(team, 1)
  const canvas: any[] = data.canvas || []
  const editable = stateOf(team, 1) === 'IN_PROGRESS'
  const serverVals = CANVAS_CARDS.map((_, i) => canvas[i]?.value || '')
  const [local, setLocal] = useState<string[]>(() => [...serverVals])
  const [focused, setFocused] = useState<number | null>(null) // tarjeta que YO edito ahora
  const [saving, setSaving] = useState<number | null>(null)    // tarjeta en guardado (sin confirmar)

  // Capa 2: sincroniza desde el servidor las tarjetas que este usuario NO está
  // editando ni guardando, para ver en vivo lo que escriben los demás integrantes.
  useEffect(() => {
    setLocal(prev => prev.map((v, i) => (i === focused || i === saving ? v : serverVals[i])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverVals.join(''), focused, saving])

  const save = async (i: number) => {
    // No limpiar 'focused' antes de tiempo: la tarjeta debe seguir protegida
    // (focused o saving) durante TODO el guardado, o la sincronización la borra.
    if (local[i] === (canvas[i]?.value || '')) { setFocused(null); return }
    setSaving(i)
    // Mantiene el texto propio visible hasta que el servidor lo confirma (sin parpadeo).
    try { await abpApi.saveCanvas(team.id, i, local[i]); await onSaved() } catch { } finally { setSaving(null); setFocused(null) }
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {CANVAS_CARDS.map((c, i) => {
        const filled = !!local[i].trim()
        const busyCard = saving === i
        return (
          <div key={i} className="rounded-2xl p-3.5" style={{ border: `1.5px solid ${filled ? 'color-mix(in srgb, var(--t-teal) 45%, var(--t-line))' : 'var(--t-line)'}`, background: filled ? 'color-mix(in srgb, var(--t-teal) 7%, var(--t-surface))' : 'var(--t-surface)' }}>
            <h5 className="font-bold text-sm taller-soft flex items-center gap-1.5 mb-2">{c.icon} {c.q}</h5>
            <textarea
              value={local[i]}
              disabled={!editable}
              onFocus={() => setFocused(i)}
              onChange={e => setLocal(v => { const n = [...v]; n[i] = e.target.value; return n })}
              onBlur={() => editable && save(i)}
              rows={3}
              placeholder="Escribe aquí…"
              className="w-full rounded-lg px-2.5 py-2 text-sm resize-none disabled:opacity-70 taller-ink"
              style={{ border: '1px solid var(--t-line)', background: 'var(--t-raised)' }}
            />
            <p className="text-xs taller-muted mt-1">{busyCard ? '💾 Guardando…' : filled ? `✍️ ${canvas[i]?.byName || 'Aportó'}` : 'Tarjeta pendiente'}</p>
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
const STICKY_COLORS = ['#FBE7A6', '#CFE6BE', '#C4DBF3', '#F6D3CE', '#DDD2F2']
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
          placeholder="Escribe tu idea y presiona Enter…" className="flex-1 min-w-[200px] rounded-xl px-4 py-2.5 text-sm taller-ink" style={{ border: '1.5px solid var(--t-line)', background: 'var(--t-raised)' }} />
        <span className="flex items-center gap-1.5 font-bold rounded-xl px-4 text-sm" style={{ color: 'var(--t-teal)', background: 'color-mix(in srgb, var(--t-teal) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--t-teal) 28%, transparent)' }}>🗳️ {votesLeft} votos</span>
      </div>
      {ideas.length === 0 ? (
        <p className="text-sm taller-muted text-center py-6">Aún no hay ideas. ¡Sé el primero!</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ideas.map((i: any, ix: number) => {
            const mine = i.by === myEnrollment
            const voted = votedIds.has(i.id)
            const top = (i.votes || 0) === maxVotes && maxVotes > 0
            const rot = [-1.6, 1.2, -0.6, 1.5, -1][ix % 5]
            return (
              <div key={i.id} className="taller-sticky rounded-xl p-3.5 relative flex flex-col gap-2 min-h-[112px]"
                style={{ background: STICKY_COLORS[ix % STICKY_COLORS.length], color: '#2a2412', boxShadow: 'var(--t-shadow-sm)', transform: `rotate(${rot}deg)`, border: '1px solid rgba(0,0,0,.05)', ...(top ? { outline: '2px solid var(--t-marigold)', outlineOffset: '2px' } : {}) }}>
                {top && <span className="absolute -top-2.5 right-2 text-white text-[10px] font-bold rounded-full px-2 py-0.5 shadow" style={{ background: 'var(--t-marigold)', transform: 'rotate(6deg)' }}>★ favorita</span>}
                <div className="text-sm font-medium">{i.text}</div>
                <div className="mt-auto flex items-center justify-between text-xs" style={{ color: '#5b5033' }}>
                  <span>— {i.byName}</span>
                  <button onClick={() => vote(i.id)} disabled={mine || voted || votesLeft <= 0 || !editable || !myEnrollment || busy}
                    className="rounded-full px-3 py-1 font-bold font-mono disabled:opacity-40 disabled:cursor-not-allowed" style={{ background: 'rgba(0,0,0,.07)', color: '#3a3212' }}>
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
function SmartPhase({ team, onSaved }: { team: any; onSaved: () => void | Promise<void> }) {
  const smart = phaseData(team, 3).smart || {}
  const editable = stateOf(team, 3) === 'IN_PROGRESS'
  const [text, setText] = useState<string>(smart.text || '')
  const [checks, setChecks] = useState<boolean[]>(() => SMART_CRITERIA.map((_, i) => !!smart.checks?.[i]))
  const [busy, setBusy] = useState(false)
  const [tFocused, setTFocused] = useState(false)

  // Capa 2: sincroniza el objetivo (cuando no lo estoy escribiendo) y los criterios
  // (cuando no estoy guardando) desde el servidor → trabajo en vivo del equipo.
  useEffect(() => {
    if (!tFocused && !busy) setText(smart.text || '')
    if (!busy) setChecks(SMART_CRITERIA.map((_, i) => !!smart.checks?.[i]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smart.text, (smart.checks || []).join(''), tFocused, busy])

  const save = async (nt: string, nc: boolean[]) => {
    setBusy(true)
    try { await abpApi.saveSmart(team.id, nt, nc); await onSaved() } finally { setBusy(false); setTFocused(false) }
  }
  const toggle = (i: number) => { const nc = [...checks]; nc[i] = !nc[i]; setChecks(nc); if (editable) save(text, nc) }

  return (
    <div>
      <textarea value={text} onChange={e => setText(e.target.value)} onFocus={() => setTFocused(true)}
        onBlur={() => { if (editable && text !== (smart.text || '')) save(text, checks); else setTFocused(false) }}
        disabled={!editable} rows={3} placeholder="Nuestro objetivo es… (específico, medible, con plazo)"
        className="w-full rounded-xl px-3 py-2.5 text-sm mb-3 disabled:opacity-70 taller-ink" style={{ border: '1.5px solid var(--t-line)', background: 'var(--t-raised)' }} />
      <div className="grid sm:grid-cols-2 gap-2">
        {SMART_CRITERIA.map((c, i) => (
          <label key={c.k} className={`flex items-start gap-2.5 rounded-xl p-3 text-sm cursor-pointer ${busy ? 'opacity-70' : ''}`}
            style={{ border: `1.5px solid ${checks[i] ? 'color-mix(in srgb, var(--t-teal) 45%, var(--t-line))' : 'var(--t-line)'}`, background: checks[i] ? 'color-mix(in srgb, var(--t-teal) 8%, var(--t-surface))' : 'var(--t-surface)' }}>
            <input type="checkbox" checked={checks[i]} onChange={() => toggle(i)} disabled={!editable} className="mt-0.5" style={{ accentColor: 'var(--t-teal)' }} />
            <span className="taller-soft"><b className="taller-ink">{c.k}</b> · {c.t}</span>
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
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} placeholder="Nueva tarea…" className="flex-1 min-w-[160px] rounded-xl px-4 py-2.5 text-sm taller-ink" style={{ border: '1.5px solid var(--t-line)', background: 'var(--t-raised)' }} />
          <select value={owner} onChange={e => setOwner(e.target.value)} className="rounded-xl px-3 py-2.5 text-sm taller-ink" style={{ border: '1.5px solid var(--t-line)', background: 'var(--t-raised)' }}>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button onClick={add} disabled={!text.trim() || !owner || busy} className="taller-cta px-4 rounded-xl text-sm font-semibold disabled:opacity-50">Agregar</button>
        </div>
      )}
      <div className="grid sm:grid-cols-3 gap-3">
        {KANBAN_COLS.map((c, ci) => {
          const list = tasks.filter(t => t.col === ci)
          return (
            <div key={ci} className="rounded-xl p-3" style={{ background: 'color-mix(in srgb, var(--t-marigold) 6%, var(--t-surface))', border: '1px solid var(--t-line)' }}>
              <h5 className="font-bold text-sm taller-soft flex justify-between mb-2">{c}<span className="taller-muted font-mono">{list.length}</span></h5>
              <div className="space-y-2">
                {list.map(t => (
                  <div key={t.id} className="rounded-lg p-2.5 text-sm" style={{ background: 'var(--t-raised)', border: '1px solid var(--t-line)', boxShadow: 'var(--t-shadow-sm)' }}>
                    <div className={ci === 2 ? 'line-through taller-muted' : 'taller-ink'}>{t.text}</div>
                    <div className="text-xs taller-muted mt-1 flex items-center justify-between">
                      <span>👤 {t.ownerName}</span>
                      {editable && <button onClick={() => act(abpApi.removeTask(team.id, t.id))} className="text-slate-300 hover:text-rose-500">✕</button>}
                    </div>
                    {editable && ci < 2 && <button onClick={() => act(abpApi.moveTask(team.id, t.id))} className="mt-1.5 text-xs rounded px-2 py-1 font-medium" style={{ background: 'color-mix(in srgb, var(--t-marigold) 16%, transparent)', color: 'var(--t-marigold)' }}>{ci === 0 ? 'Iniciar →' : 'Terminar ✔'}</button>}
                  </div>
                ))}
                {list.length === 0 && <p className="text-xs taller-muted text-center py-2 opacity-60">Vacío</p>}
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
          <input value={link} onChange={e => setLink(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addLink() }} placeholder="Pega un enlace (Canva, MakeCode, video…)" className="flex-1 min-w-[200px] rounded-xl px-4 py-2.5 text-sm taller-ink" style={{ border: '1.5px solid var(--t-line)', background: 'var(--t-raised)' }} />
          <button onClick={addLink} disabled={!link.trim() || busy} className="taller-cta px-4 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"><Link2 className="w-4 h-4" /> Enlace</button>
          <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = '' }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="taller-card px-4 rounded-xl text-sm font-semibold taller-soft disabled:opacity-50 flex items-center gap-1.5"><Paperclip className="w-4 h-4" /> Archivo</button>
        </div>
      )}
      {evidences.length === 0 ? (
        <p className="text-sm taller-muted text-center py-6">Aún no hay evidencias. Sube fotos, videos o enlaces del prototipo.</p>
      ) : (
        <div className="space-y-2">
          {evidences.map((e: any) => (
            <div key={e.id} className="flex items-center gap-3 rounded-xl p-3" style={{ border: '1px solid var(--t-line)', background: 'var(--t-raised)' }}>
              <span>{e.kind === 'FILE' ? '📎' : '🔗'}</span>
              <button onClick={() => openStoredFile(e.url)} className="flex-1 text-left text-sm taller-mari hover:underline truncate">{e.label}</button>
              <span className="text-xs taller-muted">{e.byName}</span>
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
    <div className="rounded-xl p-4" style={{ border: `1.5px solid ${done ? 'color-mix(in srgb, var(--t-teal) 45%, var(--t-line))' : 'var(--t-line)'}`, background: done ? 'color-mix(in srgb, var(--t-teal) 7%, var(--t-surface))' : 'var(--t-surface)' }}>
      <div className="flex justify-between items-center mb-2">
        <h5 className="font-bold taller-ink">{sibling.emoji} {sibling.name}</h5>
        {done && <span className="text-xs font-semibold" style={{ color: 'var(--t-teal)' }}>✓ Evaluado</span>}
      </div>
      <div className="space-y-2">
        {COEVAL_CRITERIA.map((c, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <span className="text-sm taller-soft">{c}</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(n => (
                <button key={n} onClick={() => editable && setScores(s => { const x = [...s]; x[i] = n; return x })} disabled={!editable}
                  className="w-8 h-8 rounded-lg text-sm font-bold" style={scores[i] === n ? { background: 'var(--t-marigold)', color: '#241703' } : { background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-muted)' }}>{n}</button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {editable && <button onClick={submit} disabled={!complete || busy} className="taller-cta mt-3 w-full py-2 rounded-lg text-sm font-semibold disabled:opacity-50">{done ? 'Actualizar' : 'Enviar evaluación'}</button>}
    </div>
  )
}
function CoevalPhase({ team, onSaved }: { team: any; onSaved: () => void }) {
  const siblings = team.siblings || []
  const coevals = phaseData(team, 6).coevals || {}
  const editable = stateOf(team, 6) === 'IN_PROGRESS'
  if (siblings.length === 0) return <p className="text-sm taller-muted text-center py-6">Son el único equipo del proyecto: no hay coevaluación. Presenten su solución y soliciten la validación para cerrar la expedición.</p>
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {siblings.map((s: any) => <CoevalCard key={s.id} team={team} sibling={s} existing={coevals[s.id]} editable={editable} onSaved={onSaved} />)}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// VISTA ESTUDIANTE — su expedición
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// MISIONES — el trabajo real dentro de cada fase-hito (Opción A: herramienta = misión).
// ═══════════════════════════════════════════════════════════════════════════
const PHASE_TOOL_UI: Record<number, string> = { 1: 'CANVAS', 2: 'IDEAS', 3: 'SMART', 4: 'KANBAN', 5: 'EVIDENCE', 6: 'COEVAL' }

// Espacios de Trabajo (nivel de la Biblia): agrupan instrumentos por intención dentro
// de una estación. Se deriva de la herramienta de cada misión (sin tocar el modelo).
const ESPACIOS: Record<string, { label: string; icon: string; color: string }> = {
  EXPLORAR: { label: 'Exploración', icon: '🔭', color: 'var(--t-marigold)' },
  ANALIZAR: { label: 'Análisis', icon: '🧭', color: '#2E76BE' },
  DECIDIR: { label: 'Decisión', icon: '✅', color: '#5A54C8' },
  CONSTRUIR: { label: 'Construcción', icon: '🛠️', color: '#C1622E' },
  DOCUMENTAR: { label: 'Documentación', icon: '📚', color: '#7B7466' },
  VALIDAR: { label: 'Validación', icon: '🏆', color: 'var(--t-teal)' },
  PRACTICAR: { label: 'Práctica', icon: '🎮', color: '#B24578' },
}
const ESPACIO_ORDER = ['EXPLORAR', 'ANALIZAR', 'DECIDIR', 'CONSTRUIR', 'DOCUMENTAR', 'VALIDAR', 'PRACTICAR']
const TOOL_SPACE: Record<string, string> = { CANVAS: 'EXPLORAR', IDEAS: 'EXPLORAR', SMART: 'DECIDIR', KANBAN: 'CONSTRUIR', EVIDENCE: 'DOCUMENTAR', COEVAL: 'VALIDAR' }
function missionSpace(m: any): string {
  const toolAct = (m.activities || []).find((a: any) => a.content?.tool)
  const tool = toolAct?.content?.tool
  if (tool && TOOL_SPACE[tool]) return TOOL_SPACE[tool]
  return 'PRACTICAR' // misiones sin herramienta (actividades/juegos reutilizados)
}

// Resumen del Artefacto Vivo de la fase actual (para el Ritual de Validación).
function artifactSummary(team: any, phase: number): string[] {
  const d = phaseData(team, phase) || {}
  const out: string[] = []
  if (phase === 1) { const c = (d.canvas || []).filter((x: any) => x && String(x.value || '').trim()).length; out.push(`Canvas del reto · ${c} de 4 tarjetas`) }
  else if (phase === 2) { const ideas = d.ideas || []; const votes = ideas.reduce((s: number, i: any) => s + (i.votes || 0), 0); out.push(`${ideas.length} ideas · ${votes} votos`) }
  else if (phase === 3) { const sm = d.smart || {}; const ch = (sm.checks || []).filter(Boolean).length; out.push(`Objetivo SMART · ${ch}/5 criterios`) }
  else if (phase === 4) { const t = d.tasks || []; const done = t.filter((x: any) => x.col === 2).length; out.push(`${t.length} tareas · ${done} hechas`) }
  else if (phase === 5) { out.push(`${(d.evidences || []).length} evidencia(s) del prototipo`) }
  else if (phase === 6) { out.push(`${Object.keys(d.coevals || {}).length} equipo(s) coevaluado(s)`) }
  return out
}
const ACT_LABEL: Record<string, string> = { READING: '📖 Lectura', VIDEO: '🎬 Video', QUIZ: '❓ Quiz', INTERVIEW: '🎤 Entrevista', UPLOAD: '📤 Evidencia', LINK: '🔗 Enlace', CUSTOM: '✅ Tarea' }
const ACT_TYPES = ['READING', 'VIDEO', 'INTERVIEW', 'UPLOAD', 'LINK', 'CUSTOM']

function PhaseTool({ tool, team, onSaved }: { tool: string; team: any; onSaved: () => void }) {
  switch (tool) {
    case 'CANVAS': return <CanvasPhase team={team} onSaved={onSaved} />
    case 'IDEAS': return <IdeasPhase team={team} onSaved={onSaved} />
    case 'SMART': return <SmartPhase team={team} onSaved={onSaved} />
    case 'KANBAN': return <KanbanPhase team={team} onSaved={onSaved} />
    case 'EVIDENCE': return <EvidencePhase team={team} onSaved={onSaved} />
    case 'COEVAL': return <CoevalPhase team={team} onSaved={onSaved} />
    default: return null
  }
}

function AddActivityForm({ mission, onSaved }: { mission: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('READING')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!title.trim()) return
    setBusy(true)
    try { await abpApi.addActivity(mission.id, { type, title: title.trim() }); setTitle(''); setOpen(false); onSaved() } finally { setBusy(false) }
  }
  if (!open) return <button onClick={() => setOpen(true)} className="mt-2 text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Añadir actividad</button>
  return (
    <div className="mt-2 flex items-center gap-2 flex-wrap">
      <select value={type} onChange={e => setType(e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5">
        {ACT_TYPES.map(t => <option key={t} value={t}>{ACT_LABEL[t]}</option>)}
      </select>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Describe la actividad…" className="flex-1 min-w-[160px] text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" />
      <button onClick={save} disabled={busy || !title.trim()} className="text-xs font-bold bg-violet-600 text-white rounded-lg px-3 py-1.5 disabled:opacity-40">Añadir</button>
      <button onClick={() => setOpen(false)} className="text-xs text-slate-400">Cancelar</button>
    </div>
  )
}

const DELIVERY_LABEL: Record<string, string> = { FILE: 'Archivo', LINK: 'Enlace', TEXT: 'Texto' }

// Entrega de una misión de entrega (taller): el equipo cumple ENTREGANDO, no marcando.
function MissionDelivery({ mission, canDeliver, onSaved }: { mission: any; canDeliver: boolean; onSaved: () => void }) {
  const kind = mission.deliverableKind as 'FILE' | 'LINK' | 'TEXT'
  const delivered = mission.deliveryState === 'SUBMITTED'
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState('')
  const [text, setText] = useState(mission.deliveryText || '')
  const fileRef = useRef<HTMLInputElement>(null)

  const openFile = async (path: string) => {
    try { const { data } = await storageApi.resolveUrl(path); window.open(data.url, '_blank', 'noopener') }
    catch { window.open(path, '_blank', 'noopener') }
  }
  const submit = async (payload: { url?: string; text?: string; label?: string }) => {
    setBusy(true)
    try { await abpApi.submitDelivery(mission.id, payload); setEditing(false); setLink(''); onSaved() }
    catch (e: any) { alert(e?.response?.data?.message || 'No se pudo entregar') }
    finally { setBusy(false) }
  }
  const uploadFile = async (file: File) => {
    setBusy(true)
    try {
      const { data } = await classroomApi.uploadMaterial(file)
      const url = data?.data?.path || data?.data?.url
      if (url) await submit({ url, label: file.name })
      else { alert('No se pudo subir el archivo'); setBusy(false) }
    } catch (e: any) { alert(e?.response?.data?.message || 'No se pudo subir el archivo'); setBusy(false) }
  }

  return (
    <div className="mt-2 rounded-xl p-3" style={{ background: delivered ? 'color-mix(in srgb, var(--t-teal) 8%, var(--t-surface))' : 'color-mix(in srgb, var(--t-marigold) 7%, var(--t-surface))', border: '1px solid var(--t-line)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: delivered ? 'var(--t-teal)' : '#8a5a10' }}>
          {delivered ? '✓ Entregado' : `📎 Entrega requerida · ${DELIVERY_LABEL[kind]}`}
        </span>
      </div>

      {delivered && !editing ? (
        <div className="flex items-center gap-2 flex-wrap">
          {kind === 'TEXT'
            ? <p className="text-sm taller-soft whitespace-pre-line flex-1 min-w-0">{mission.deliveryText}</p>
            : kind === 'FILE'
              ? <button onClick={() => openFile(mission.deliveryUrl)} className="text-sm font-semibold taller-mari hover:opacity-70 flex items-center gap-1.5"><Paperclip className="w-4 h-4" /> {mission.deliveryLabel || 'Ver archivo'}</button>
              : <a href={mission.deliveryUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold taller-mari hover:opacity-70 flex items-center gap-1.5 break-all"><Link2 className="w-4 h-4 shrink-0" /> {mission.deliveryLabel || mission.deliveryUrl}</a>}
          {canDeliver && <button onClick={() => { setEditing(true); setText(mission.deliveryText || '') }} className="ml-auto text-xs font-semibold taller-muted hover:opacity-70">Reemplazar</button>}
        </div>
      ) : canDeliver ? (
        <div className="space-y-2">
          {kind === 'TEXT' && (
            <>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={5000} placeholder="Escribe aquí la entrega…"
                className="w-full text-sm rounded-lg p-2 resize-y" style={{ background: 'var(--t-raised)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
              <button onClick={() => text.trim() && submit({ text })} disabled={busy || !text.trim()} className="taller-cta px-4 py-1.5 rounded-lg font-bold text-xs disabled:opacity-50">{busy ? '…' : 'Entregar'}</button>
            </>
          )}
          {kind === 'LINK' && (
            <div className="flex gap-2">
              <input value={link} onChange={e => setLink(e.target.value)} placeholder="Pega el enlace (Drive, YouTube, etc.)…"
                className="flex-1 text-sm rounded-lg px-2.5 py-1.5" style={{ background: 'var(--t-raised)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
              <button onClick={() => link.trim() && submit({ url: link.trim() })} disabled={busy || !link.trim()} className="taller-cta px-4 rounded-lg font-bold text-xs disabled:opacity-50">{busy ? '…' : 'Entregar'}</button>
            </div>
          )}
          {kind === 'FILE' && (
            <>
              <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.currentTarget.value = '' }} />
              <button onClick={() => fileRef.current?.click()} disabled={busy} className="taller-cta px-4 py-1.5 rounded-lg font-bold text-xs disabled:opacity-50 flex items-center gap-1.5">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />} Subir archivo
              </button>
            </>
          )}
          {editing && <button onClick={() => setEditing(false)} className="text-xs taller-muted ml-2">Cancelar</button>}
        </div>
      ) : (
        <p className="text-sm taller-muted">Aún sin entregar.</p>
      )}
    </div>
  )
}

function MissionCard({ mission, team, onSaved }: { mission: any; team: any; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const [playing, setPlaying] = useState<string | null>(null)
  const toolAct = (mission.activities || []).find((a: any) => a.content?.tool)
  const tool = toolAct?.content?.tool
  const acts = (mission.activities || []).filter((a: any) => !a.content?.tool)
  const complete = !!mission.complete
  const run = async (fn: () => Promise<any>) => { setBusy(true); try { await fn(); onSaved() } finally { setBusy(false) } }
  return (
    <div className="rounded-2xl p-4" style={{ border: `1px solid ${complete ? 'color-mix(in srgb, var(--t-teal) 40%, var(--t-line))' : 'var(--t-line)'}`, background: complete ? 'color-mix(in srgb, var(--t-teal) 6%, var(--t-surface))' : 'var(--t-raised)', boxShadow: 'var(--t-shadow-sm)' }}>
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs shrink-0" style={{ background: complete ? 'var(--t-teal)' : 'color-mix(in srgb, var(--t-ink) 25%, transparent)' }}>{complete ? <Check className="w-3.5 h-3.5" /> : '○'}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold taller-ink text-sm">{mission.title}</h4>
            {mission.required && <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-1.5 py-0.5" style={{ background: 'color-mix(in srgb, var(--t-marigold) 16%, transparent)', color: 'var(--t-marigold)' }}>Obligatoria</span>}
            {!tool && <button onClick={() => run(() => abpApi.deleteMission(mission.id))} disabled={busy} className="ml-auto text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>}
          </div>
          {mission.description && <p className="text-xs taller-soft mt-0.5">{mission.description}</p>}

          {tool && (
            <div className="mt-3">
              <PhaseTool tool={tool} team={team} onSaved={onSaved} />
            </div>
          )}

          {/* Misión de ENTREGA: se cumple entregando un producto, no con checkbox */}
          {mission.deliverableKind && (
            <MissionDelivery mission={mission} canDeliver={!!team.myEnrollmentId} onSaved={onSaved} />
          )}

          {!mission.deliverableKind && (
          <div className="mt-2 space-y-1.5">
            {acts.map((a: any) => a.classroomActivityId ? (
              <div key={a.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-base">{a.completed ? '✅' : '🎮'}</span>
                <span className={`text-sm ${a.completed ? 'text-slate-400' : 'text-slate-700'}`}>{a.title}</span>
                <button onClick={() => setPlaying(a.classroomActivityId)} className="ml-auto text-xs font-bold bg-violet-600 text-white rounded-lg px-3 py-1.5 hover:bg-violet-700">▶ {a.completed ? 'Repetir' : 'Jugar'}</button>
              </div>
            ) : (
              <div key={a.id} className="flex items-center gap-2">
                <input type="checkbox" checked={!!a.completed} disabled={busy} onChange={e => run(() => abpApi.completeActivity(a.id, e.target.checked))} className="w-4 h-4" style={{ accentColor: 'var(--t-teal)' }} />
                <span className={`text-sm ${a.completed ? 'line-through taller-muted' : 'taller-soft'}`}><span className="taller-muted mr-1">{ACT_LABEL[a.type] || a.type}</span>{a.title}</span>
              </div>
            ))}
            {!tool && acts.length === 0 && (
              <label className="flex items-center gap-2 text-sm taller-soft">
                <input type="checkbox" checked={complete} disabled={busy} onChange={e => run(() => abpApi.setMissionStatus(mission.id, e.target.checked))} className="w-4 h-4" style={{ accentColor: 'var(--t-teal)' }} />
                Marcar como completada
              </label>
            )}
          </div>
          )}
        </div>
      </div>

      {playing && (
        <div className="fixed inset-0 z-[120]">
          <LessonPlayer activityId={playing} onClose={() => { setPlaying(null); onSaved() }} />
        </div>
      )}
    </div>
  )
}

function AddMissionForm({ team, phase, onSaved }: { team: any; phase: number; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!title.trim()) return
    setBusy(true)
    try { await abpApi.addMission(team.id, phase, { title: title.trim(), required: false }); setTitle(''); setOpen(false); onSaved() } finally { setBusy(false) }
  }
  if (!open) return <button onClick={() => setOpen(true)} className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-400 hover:border-violet-300 hover:text-violet-600 flex items-center justify-center gap-1.5"><Plus className="w-4 h-4" /> Añadir una misión propia</button>
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título de la misión…" className="flex-1 text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" />
      <button onClick={save} disabled={busy || !title.trim()} className="text-sm font-bold bg-violet-600 text-white rounded-lg px-3 py-1.5 disabled:opacity-40">Crear</button>
      <button onClick={() => setOpen(false)} className="text-sm text-slate-400">Cancelar</button>
    </div>
  )
}

function MissionsPanel({ team, onSaved }: { team: any; onSaved: () => void }) {
  const cur = team.currentPhase
  const missions = team.currentMissions || []
  // Equipos previos (sin misiones sembradas): renderiza la herramienta directamente.
  if (missions.length === 0) return <PhaseTool tool={PHASE_TOOL_UI[cur]} team={team} onSaved={onSaved} />
  // Agrupar por Espacio de Trabajo (nivel de la propuesta). Solo se muestran las zonas
  // cuando hay más de un Espacio (p. ej. instrumento principal + juego reutilizado).
  const groups: Record<string, any[]> = {}
  for (const m of missions) { const s = missionSpace(m); (groups[s] ||= []).push(m) }
  const spaces = ESPACIO_ORDER.filter(s => groups[s])
  const multi = spaces.length > 1
  return (
    <div className="space-y-4">
      {spaces.map(s => {
        const esp = ESPACIOS[s]
        return (
          <div key={s}>
            {multi && (
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-lg grid place-items-center text-xs shrink-0" style={{ background: `color-mix(in srgb, ${esp.color} 16%, transparent)`, color: esp.color }}>{esp.icon}</span>
                <span className="text-[11px] font-mono uppercase tracking-widest font-semibold" style={{ color: esp.color }}>{esp.label}</span>
                <span className="text-[10px] font-mono taller-muted">{groups[s].length}</span>
                <span className="flex-1 h-px" style={{ background: 'var(--t-line)' }} />
              </div>
            )}
            <div className="space-y-3">
              {groups[s].map((m: any) => <MissionCard key={m.id} mission={m} team={team} onSaved={onSaved} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PORTADA / PRESENTACIÓN (Nivel 1) — vista compartida + editor del docente.
// ═══════════════════════════════════════════════════════════════════════════
function videoEmbed(url: string): string | null {
  if (!url) return null
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vm = url.match(/vimeo\.com\/(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return null
}

// ─── Apertura y visualización de archivos de storage ───────────────────────────
const isHttp = (v: string) => /^https?:\/\//i.test(v || '')
const isImageUrl = (v: string) => /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/i.test(v || '')
const isPdfUrl = (v: string) => /\.pdf(\?|$)/i.test(v || '')

/** Resuelve una key de storage a URL firmada (si hace falta) y la abre en pestaña nueva. */
async function openStoredFile(value: string) {
  if (!value) return
  if (isHttp(value)) { window.open(value, '_blank', 'noopener'); return }
  try { const { data } = await storageApi.resolveUrl(value); window.open(data.url, '_blank', 'noopener') }
  catch { window.open(value, '_blank', 'noopener') }
}

/** Modal visor: resuelve la URL y muestra PDF/imagen/video en línea; el resto, botón de abrir. */
function FileViewerModal({ file, onClose }: { file: { title: string; url: string; type?: string }; onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const v = file.url
    if (isHttp(v)) { setUrl(v); setLoading(false) }
    else storageApi.resolveUrl(v).then(({ data }) => setUrl(data.url)).catch(() => setUrl(v)).finally(() => setLoading(false))
  }, [file])
  const embed = videoEmbed(url)
  const img = file.type === 'IMAGE' || isImageUrl(url) || isImageUrl(file.url)
  // PDF explícito, o un archivo subido a storage (key sin http) que no es imagen/video:
  // lo intentamos en iframe (el navegador renderiza PDF; otros formatos ofrecen descarga).
  const pdf = !img && !embed && (file.type === 'PDF' || isPdfUrl(url) || isPdfUrl(file.url) || !isHttp(file.url))
  return (
    <div className="fixed inset-0 z-[110] flex flex-col bg-slate-900/70 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3 bg-white/95 border-b border-slate-200" onClick={e => e.stopPropagation()}>
        <h3 className="font-bold text-slate-800 text-sm truncate">{file.title}</h3>
        <div className="flex items-center gap-2 shrink-0">
          {url && <button onClick={() => window.open(url, '_blank', 'noopener')} className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200">Abrir en pestaña ↗</button>}
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold">✕</button>
        </div>
      </div>
      <div className="flex-1 p-3 sm:p-6 overflow-auto flex items-center justify-center" onClick={e => e.stopPropagation()}>
        {loading ? <Loader2 className="w-8 h-8 animate-spin text-white" />
          : embed ? <iframe src={embed} className="w-full max-w-4xl aspect-video rounded-xl bg-black" allowFullScreen title={file.title} />
          : img ? <img src={url} alt={file.title} className="max-w-full max-h-full rounded-xl bg-white" />
          : pdf ? <iframe src={url} className="w-full h-full min-h-[70vh] max-w-5xl rounded-xl bg-white" title={file.title} />
          : (
            <div className="bg-white rounded-2xl p-8 text-center max-w-sm">
              <p className="text-slate-600 text-sm mb-4">Este tipo de archivo no se puede previsualizar aquí.</p>
              <button onClick={() => window.open(url, '_blank', 'noopener')} className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold">Abrir / descargar</button>
            </div>
          )}
      </div>
    </div>
  )
}

function PresentationView({ project }: { project: any }) {
  const p = project?.presentation || {}
  const embed = videoEmbed(p.videoUrl || '')
  return (
    <div className="space-y-4">
      {/* Portada / hero */}
      <div className="relative rounded-2xl overflow-hidden">
        {p.banner
          ? <img src={p.banner} alt="" className="w-full h-44 sm:h-56 object-cover" />
          : <div className="w-full h-44 sm:h-56 bg-gradient-to-br from-violet-500 to-fuchsia-500" />}
        <div className="absolute inset-0 bg-black/35 flex items-end p-5">
          <div>
            <div className="text-white/80 text-xs font-bold uppercase tracking-wide">Expedición ABP</div>
            <h2 className="text-2xl sm:text-3xl font-black text-white drop-shadow">{project.title}</h2>
          </div>
        </div>
      </div>

      {p.teacherMessage && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-xs font-bold uppercase tracking-wide text-violet-600 mb-1">Mensaje del docente</div>
          <p className="text-slate-700 whitespace-pre-line">{p.teacherMessage}</p>
        </div>
      )}

      {embed
        ? <div className="rounded-2xl overflow-hidden border border-slate-200 aspect-video"><iframe src={embed} className="w-full h-full" allowFullScreen title="Video de bienvenida" /></div>
        : p.videoUrl ? <a href={p.videoUrl} target="_blank" rel="noreferrer" className="block bg-white rounded-2xl border border-slate-200 p-4 font-semibold text-violet-600 hover:bg-violet-50">▶ Ver video de bienvenida</a> : null}

      {project.challenge && (
        <div className="bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-2xl p-6 text-white">
          <div className="text-xs font-bold uppercase tracking-wide opacity-80 mb-1">🎯 El gran reto</div>
          <p className="text-lg font-bold">{project.challenge}</p>
          <p className="text-sm opacity-80 mt-2">Cada equipo encontrará SU propia problemática dentro de este reto.</p>
        </div>
      )}

      {p.instructions?.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-violet-200 p-5">
          <h4 className="font-bold text-slate-800 mb-3">📋 ¿Qué deben hacer?</h4>
          <ol className="space-y-2">{p.instructions.map((s: string, i: number) => (
            <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
              <span className="w-6 h-6 shrink-0 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center text-xs">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}</ol>
        </div>
      )}

      {(p.context || p.why) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {p.context && <div className="bg-white rounded-2xl border border-slate-200 p-5"><div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Contexto</div><p className="text-sm text-slate-700 whitespace-pre-line">{p.context}</p></div>}
          {p.why && <div className="bg-white rounded-2xl border border-slate-200 p-5"><div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">¿Por qué es importante?</div><p className="text-sm text-slate-700 whitespace-pre-line">{p.why}</p></div>}
        </div>
      )}

      {p.skills?.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h4 className="font-bold text-slate-800 mb-3">📚 Lo que aprenderás</h4>
          <div className="grid sm:grid-cols-2 gap-2">{p.skills.map((s: string, i: number) => <div key={i} className="flex items-center gap-2 text-sm text-slate-700"><Check className="w-4 h-4 text-emerald-500 shrink-0" />{s}</div>)}</div>
        </div>
      )}

      {/* Cómo funciona — estático desde las 6 fases */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h4 className="font-bold text-slate-800 mb-3">🧭 Cómo funciona la expedición</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {PHASES.map(ph => (
            <div key={ph.n} className="rounded-xl border border-slate-200 p-3">
              <div className="text-2xl">{ph.icon}</div>
              <div className="text-xs font-bold text-violet-600 mt-1">Paso {ph.n}</div>
              <div className="text-sm font-semibold text-slate-700">{ph.name}</div>
            </div>
          ))}
        </div>
      </div>

      {p.rules?.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h4 className="font-bold text-slate-800 mb-3">📋 Reglas del proyecto</h4>
          <ul className="space-y-1.5">{p.rules.map((r: string, i: number) => <li key={i} className="flex items-start gap-2 text-sm text-slate-700"><span className="text-violet-500 mt-0.5">•</span>{r}</li>)}</ul>
        </div>
      )}

      {p.timeline?.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h4 className="font-bold text-slate-800 mb-3">📅 Cronograma</h4>
          <div className="space-y-2">{p.timeline.map((t: any, i: number) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-xs font-bold text-violet-600">{t.label}</div>
              <div className="flex-1 h-3 bg-violet-500 rounded-full" />
              <div className="text-xs text-slate-600 w-40 truncate text-right">{t.detail}</div>
            </div>
          ))}</div>
        </div>
      )}

      {p.faq?.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h4 className="font-bold text-slate-800 mb-3">❓ Preguntas frecuentes</h4>
          <div className="space-y-3">{p.faq.map((f: any, i: number) => (
            <div key={i}>
              <p className="text-sm font-semibold text-slate-700">{f.q}</p>
              <p className="text-sm text-slate-500 whitespace-pre-line">{f.a}</p>
            </div>
          ))}</div>
        </div>
      )}
    </div>
  )
}

function LineListInput({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500">{label} <span className="text-slate-300">(uno por línea)</span></label>
      <textarea value={(value || []).join('\n')} onChange={e => onChange(e.target.value.split('\n'))} rows={4} placeholder={placeholder} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm resize-none mt-1" />
    </div>
  )
}

function PresentationEditor({ project, onClose, onSaved }: { project: any; onClose: () => void; onSaved: () => void }) {
  const init = project?.presentation || {}
  const [challenge, setChallenge] = useState(project?.challenge || '')
  const [banner, setBanner] = useState(init.banner || '')
  const [videoUrl, setVideoUrl] = useState(init.videoUrl || '')
  const [teacherMessage, setTeacherMessage] = useState(init.teacherMessage || '')
  const [context, setContext] = useState(init.context || '')
  const [why, setWhy] = useState(init.why || '')
  const [instructions, setInstructions] = useState<string[]>(init.instructions || [])
  const [skills, setSkills] = useState<string[]>(init.skills || [])
  const [rules, setRules] = useState<string[]>(init.rules || [])
  const [timeline, setTimeline] = useState<{ label: string; detail: string }[]>(init.timeline || [])
  const [faq, setFaq] = useState<{ q: string; a: string }[]>(init.faq || [])
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadBanner = async (file: File) => {
    setBusy(true)
    try {
      const { data } = await classroomApi.uploadMaterial(file)
      const url = data?.data?.path || data?.data?.url
      if (url) setBanner(url)
    } catch { alert('No se pudo subir la imagen') } finally { setBusy(false) }
  }
  const save = async () => {
    setBusy(true)
    try {
      await abpApi.updatePresentation(project.id, {
        challenge,
        presentation: { banner, videoUrl, teacherMessage, context, why, instructions: instructions.filter(Boolean), skills: skills.filter(Boolean), rules: rules.filter(Boolean), timeline: timeline.filter(t => t.label || t.detail), faq: faq.filter(f => f.q || f.a) },
      })
      onSaved()
    } catch (e: any) { alert(e?.response?.data?.message || 'No se pudo guardar') } finally { setBusy(false) }
  }

  // Acordeón: una sección abierta a la vez; punto violeta = sección con contenido.
  const [openSection, setOpenSection] = useState<string>('reto')
  const sections: { key: string; icon: string; title: string; hint: string; filled: boolean }[] = [
    { key: 'reto', icon: '🎯', title: 'El reto y su propósito', hint: 'El gran reto, contexto y por qué importa', filled: !!(challenge.trim() || context.trim() || why.trim()) },
    { key: 'instrucciones', icon: '📋', title: 'Qué deben hacer los estudiantes', hint: 'Los pasos o tareas concretas de esta expedición', filled: instructions.some(s => s.trim()) },
    { key: 'portada', icon: '🖼️', title: 'Portada y bienvenida', hint: 'Banner, video y tu mensaje', filled: !!(banner.trim() || videoUrl.trim() || teacherMessage.trim()) },
    { key: 'aprendizajes', icon: '📚', title: 'Aprendizajes y reglas', hint: 'Qué aprenderán y las reglas del juego', filled: skills.some(s => s.trim()) || rules.some(r => r.trim()) },
    { key: 'cronograma', icon: '📅', title: 'Cronograma', hint: 'La línea de tiempo de la expedición', filled: timeline.some(t => t.label || t.detail) },
    { key: 'faq', icon: '❓', title: 'Preguntas frecuentes', hint: 'Respuestas a lo que siempre preguntan', filled: faq.some(f => f.q || f.a) },
  ]
  const inputCls = 'w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400'

  return (
    <div className="pb-20">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
        <button onClick={onClose} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ChevronLeft className="w-4 h-4" /> Volver</button>
        <span className="text-xs text-slate-400">{sections.filter(s => s.filled).length}/{sections.length} secciones con contenido</span>
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-1">✏️ Portada de la expedición</h3>
      <p className="text-sm text-slate-400 mb-4">Esto es lo primero que verán tus estudiantes. Completa las secciones que quieras — todas son opcionales.</p>

      <div className="space-y-2">
        {sections.map(s => (
          <div key={s.key} className={`bg-white rounded-2xl border transition-colors ${openSection === s.key ? 'border-violet-300 shadow-sm' : 'border-slate-200'}`}>
            <button onClick={() => setOpenSection(openSection === s.key ? '' : s.key)} className="w-full flex items-center gap-3 p-4 text-left">
              <span className="text-xl">{s.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-sm">{s.title}</span>
                  <span className={`w-2 h-2 rounded-full ${s.filled ? 'bg-violet-500' : 'bg-slate-200'}`} />
                </div>
                <p className="text-xs text-slate-400 truncate">{s.hint}</p>
              </div>
              <ChevronLeft className={`w-4 h-4 text-slate-300 transition-transform ${openSection === s.key ? 'rotate-90' : '-rotate-90'}`} />
            </button>

            {openSection === s.key && (
              <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-4">
                {s.key === 'reto' && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-slate-500">El gran reto (lo ven todos los equipos)</label>
                      <textarea value={challenge} onChange={e => setChallenge(e.target.value)} rows={2} placeholder="¿Cómo puede la tecnología mejorar un problema de nuestra institución?" className={`${inputCls} resize-none mt-1`} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-500">Contexto</label>
                        <textarea value={context} onChange={e => setContext(e.target.value)} rows={3} placeholder="De dónde nace este reto…" className={`${inputCls} resize-none mt-1`} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500">¿Por qué es importante?</label>
                        <textarea value={why} onChange={e => setWhy(e.target.value)} rows={3} placeholder="Qué cambia si lo resuelven…" className={`${inputCls} resize-none mt-1`} />
                      </div>
                    </div>
                  </>
                )}

                {s.key === 'instrucciones' && (
                  <>
                    <p className="text-xs text-slate-400 -mt-1">Escribe en pasos lo que cada equipo debe hacer en esta expedición. Aparecerá numerado en la portada del estudiante.</p>
                    <LineListInput label="Pasos / tareas" value={instructions} onChange={setInstructions} placeholder={'Formen su equipo y elijan un nombre.\nInvestiguen un problema real de la institución.\nDiseñen y construyan un prototipo.\nPreparen la presentación final.'} />
                  </>
                )}

                {s.key === 'portada' && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-slate-500">Banner</label>
                      <div className="flex gap-2 mt-1">
                        <input value={banner} onChange={e => setBanner(e.target.value)} placeholder="Pega la URL de una imagen…" className={inputCls} />
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadBanner(f); e.currentTarget.value = '' }} />
                        <button onClick={() => fileRef.current?.click()} disabled={busy} className="px-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5 shrink-0"><Paperclip className="w-4 h-4" /> Subir</button>
                      </div>
                      {banner && <img src={banner} alt="" className="mt-2 w-full h-32 object-cover rounded-xl" />}
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500">Video de bienvenida (YouTube/Vimeo)</label>
                      <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://youtu.be/…" className={`${inputCls} mt-1`} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500">Tu mensaje para los estudiantes</label>
                      <textarea value={teacherMessage} onChange={e => setTeacherMessage(e.target.value)} rows={3} placeholder="¡Bienvenidos a la expedición! …" className={`${inputCls} resize-none mt-1`} />
                    </div>
                  </>
                )}

                {s.key === 'aprendizajes' && (
                  <>
                    <LineListInput label="Lo que aprenderán" value={skills} onChange={setSkills} placeholder={'Investigación\nTrabajo colaborativo\nPython'} />
                    <LineListInput label="Reglas del proyecto" value={rules} onChange={setRules} placeholder={'Todos participan.\nLa bitácora se mantiene actualizada.'} />
                  </>
                )}

                {s.key === 'cronograma' && (
                  <div className="space-y-2">
                    {timeline.map((t, i) => (
                      <div key={i} className="flex gap-2">
                        <input value={t.label} onChange={e => setTimeline(ts => ts.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Semana 1" className="w-32 border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                        <input value={t.detail} onChange={e => setTimeline(ts => ts.map((x, j) => j === i ? { ...x, detail: e.target.value } : x))} placeholder="Encontrar el problema" className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                        <button onClick={() => setTimeline(ts => ts.filter((_, j) => j !== i))} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                    <button onClick={() => setTimeline(ts => [...ts, { label: '', detail: '' }])} className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Añadir fila</button>
                  </div>
                )}

                {s.key === 'faq' && (
                  <div className="space-y-2">
                    {faq.map((f, i) => (
                      <div key={i} className="flex gap-2 items-start">
                        <div className="flex-1 space-y-1">
                          <input value={f.q} onChange={e => setFaq(fs => fs.map((x, j) => j === i ? { ...x, q: e.target.value } : x))} placeholder="¿Puedo cambiar de equipo?" className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                          <textarea value={f.a} onChange={e => setFaq(fs => fs.map((x, j) => j === i ? { ...x, a: e.target.value } : x))} rows={2} placeholder="Respuesta…" className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm resize-none" />
                        </div>
                        <button onClick={() => setFaq(fs => fs.filter((_, j) => j !== i))} className="text-slate-300 hover:text-rose-500 mt-1"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                    <button onClick={() => setFaq(fs => [...fs, { q: '', a: '' }])} className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Añadir pregunta</button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Barra de guardado fija */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-t border-slate-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Cancelar</button>
          <button onClick={save} disabled={busy} className="px-6 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2 hover:bg-violet-700">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Guardar portada</button>
        </div>
      </div>
    </div>
  )
}

// ─── Recursos + Anuncios (Nivel 1) — compartidos alumno/docente ────────────────
const RES_ICON: Record<string, string> = { PDF: '📄', VIDEO: '🎬', LINK: '🔗', DOC: '📝', OTHER: '📎' }

/** Deduce el tipo del recurso a partir del nombre de archivo o la URL. */
function inferResourceType(nameOrUrl: string): string {
  const s = (nameOrUrl || '').toLowerCase()
  if (videoEmbed(s) || /youtube|youtu\.be|vimeo/.test(s) || /\.(mp4|mov|webm|mkv|avi)(\?|$)/.test(s)) return 'VIDEO'
  if (/\.pdf(\?|$)/.test(s)) return 'PDF'
  if (/\.(docx?|pptx?|xlsx?|txt|odt|pages|csv)(\?|$)/.test(s)) return 'DOC'
  if (/\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/.test(s)) return 'OTHER'
  if (/^https?:\/\//.test(s)) return 'LINK'
  return 'OTHER'
}
const stripExt = (name: string) => name.replace(/\.[^.]+$/, '')

function ResourcesView({ projectId, canManage }: { projectId: string; canManage?: boolean }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [viewer, setViewer] = useState<{ title: string; url: string; type?: string } | null>(null)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => { abpApi.listResources(projectId).then(({ data }) => setItems(data || [])).finally(() => setLoading(false)) }, [projectId])
  useEffect(() => { load() }, [load])
  const add = async () => {
    if (!url.trim()) return
    setBusy(true)
    try { await abpApi.addResource(projectId, { type: inferResourceType(url), title: title.trim() || url.trim(), url: url.trim() }); setTitle(''); setUrl(''); load() }
    catch (e: any) { alert(e?.response?.data?.message || 'Error') } finally { setBusy(false) }
  }
  const del = async (id: string) => { if (!confirm('¿Eliminar recurso?')) return; await abpApi.deleteResource(id); load() }
  // Enlace externo "normal" (no video/pdf/imagen) → pestaña nueva; el resto → visor.
  const open = (r: any) => {
    const viewable = r.type === 'PDF' || r.type === 'VIDEO' || !isHttp(r.url) || isPdfUrl(r.url) || isImageUrl(r.url) || videoEmbed(r.url)
    if (viewable) setViewer({ title: r.title, url: r.url, type: r.type })
    else openStoredFile(r.url)
  }
  if (loading) return <Loading />
  return (
    <div className="space-y-3">
      {viewer && <FileViewerModal file={viewer} onClose={() => setViewer(null)} />}
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h4 className="font-bold text-slate-800 mb-3">📚 Recursos del proyecto</h4>
        {items.length === 0 ? <p className="text-sm text-slate-400">Aún no hay recursos.</p> : (
          <div className="space-y-2">{items.map(r => (
            <div key={r.id} className="flex items-center gap-3 border border-slate-200 rounded-xl p-3 hover:border-violet-200 transition-colors">
              <span className="text-lg">{RES_ICON[r.type] || '📎'}</span>
              <button onClick={() => open(r)} className="flex-1 min-w-0 text-left">
                <span className="text-sm font-semibold text-violet-600 hover:underline truncate block">{r.title}</span>
                {r.description && <p className="text-xs text-slate-400 truncate">{r.description}</p>}
              </button>
              {canManage && <button onClick={() => del(r.id)} className="text-slate-300 hover:text-rose-500 shrink-0"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ))}</div>
        )}
      </div>
      {canManage && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-2">
          <h5 className="font-bold text-slate-700 text-sm">Añadir recurso</h5>
          <p className="text-xs text-slate-400">Pega un enlace (o video de YouTube) y pulsa Añadir, o sube un archivo. El tipo se detecta solo.</p>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título (opcional para archivos)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <div className="flex gap-2 flex-wrap">
            <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} placeholder="https://…" className="flex-1 min-w-[160px] border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <button onClick={add} disabled={busy || !url.trim()} className="px-4 bg-violet-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"><Link2 className="w-4 h-4" /> Añadir</button>
            <input type="file" id={`res-file-${projectId}`} className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              setBusy(true);
              try {
                const { data } = await classroomApi.uploadMaterial(f);
                const fileUrl = data?.data?.path || data?.data?.url;
                if (fileUrl) { await abpApi.addResource(projectId, { type: inferResourceType(f.name), title: title.trim() || stripExt(f.name), url: fileUrl }); setTitle(''); setUrl(''); load(); }
              } catch { alert('No se pudo subir el archivo'); } finally { setBusy(false); e.target.value = ''; }
            }} />
            <button onClick={() => document.getElementById(`res-file-${projectId}`)?.click()} disabled={busy} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5 transition-colors"><Paperclip className="w-4 h-4" /> Subir archivo</button>
          </div>
        </div>
      )}
    </div>
  )
}

function AnnouncementsView({ projectId, canManage }: { projectId: string; canManage?: boolean }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => { abpApi.listAnnouncements(projectId).then(({ data }) => setItems(data || [])).finally(() => setLoading(false)) }, [projectId])
  useEffect(() => { load() }, [load])
  const add = async () => { if (!content.trim()) return; setBusy(true); try { await abpApi.addAnnouncement(projectId, { content: content.trim() }); setContent(''); load() } finally { setBusy(false) } }
  const pin = async (a: any) => { await abpApi.pinAnnouncement(a.id, !a.pinned); load() }
  const del = async (id: string) => { if (!confirm('¿Eliminar anuncio?')) return; await abpApi.deleteAnnouncement(id); load() }
  if (loading) return <Loading />
  return (
    <div className="space-y-3">
      {canManage && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h5 className="font-bold text-slate-700 text-sm mb-2">📢 Publicar anuncio</h5>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={2} placeholder="Recuerden que el viernes se revisa la Fase 2…" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm resize-none" />
          <div className="flex justify-end mt-2"><button onClick={add} disabled={busy || !content.trim()} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">Publicar</button></div>
        </div>
      )}
      {items.length === 0 ? <Empty msg="No hay anuncios todavía." /> : (
        <div className="space-y-2">{items.map(a => (
          <div key={a.id} className={`rounded-2xl border p-4 ${a.pinned ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-start gap-2">
              {a.pinned && <span className="text-amber-500">📌</span>}
              <p className="flex-1 text-sm text-slate-700 whitespace-pre-line">{a.content}</p>
              {canManage && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => pin(a)} title={a.pinned ? 'Quitar fijado' : 'Fijar'} className={`text-sm ${a.pinned ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500'}`}>📌</button>
                  <button onClick={() => del(a.id)} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">{new Date(a.createdAt).toLocaleDateString()}</div>
          </div>
        ))}</div>
      )}
    </div>
  )
}

// ─── Bitácora + Descubrimientos (Nivel 2) — compartidos alumno/preview docente ──
function LogbookView({ teamId, currentPhase, readOnly }: { teamId: string; currentPhase?: number; readOnly?: boolean }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => { abpApi.listLog(teamId).then(({ data }) => setItems(data || [])).finally(() => setLoading(false)) }, [teamId])
  useEffect(() => { load() }, [load])
  const add = async () => { if (!content.trim()) return; setBusy(true); try { await abpApi.addLog(teamId, { content: content.trim(), phase: currentPhase }); setContent(''); load() } finally { setBusy(false) } }
  const del = async (id: string) => { if (!confirm('¿Eliminar entrada?')) return; await abpApi.deleteLog(id); load() }
  if (loading) return <Loading />
  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={2} placeholder="¿Qué pasó hoy en la expedición? (una nota corta)" className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm resize-none" />
          <div className="flex justify-end mt-2"><button onClick={add} disabled={busy || !content.trim()} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">📔 Anotar en bitácora</button></div>
        </div>
      )}
      {items.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">La bitácora está vacía. Anoten su primer paso.</p> : (
        <div className="space-y-2">{items.map(e => (
          <div key={e.id} className="bg-white rounded-xl border border-slate-200 p-3">
            <p className="text-sm text-slate-700 whitespace-pre-line">{e.content}</p>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
              <span className="font-semibold">{e.authorName}</span>
              {e.phase && <span>· Fase {e.phase}</span>}
              <span>· {new Date(e.createdAt).toLocaleDateString()}</span>
              {!readOnly && <button onClick={() => del(e.id)} className="ml-auto text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        ))}</div>
      )}
    </div>
  )
}

const IMPACT_META: Record<string, [string, string]> = { LOW: ['Bajo', 'bg-slate-100 text-slate-500'], MEDIUM: ['Medio', 'bg-sky-100 text-sky-700'], HIGH: ['Alto', 'bg-emerald-100 text-emerald-700'] }
function DiscoveriesView({ teamId, currentPhase, readOnly }: { teamId: string; currentPhase?: number; readOnly?: boolean }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [impact, setImpact] = useState('MEDIUM')
  const [evUrl, setEvUrl] = useState('')
  const [evKind, setEvKind] = useState('LINK')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const load = useCallback(() => { abpApi.listDiscoveries(teamId).then(({ data }) => setItems(data || [])).finally(() => setLoading(false)) }, [teamId])
  useEffect(() => { load() }, [load])
  const uploadEv = async (file: File) => {
    setBusy(true)
    try { const { data } = await classroomApi.uploadMaterial(file); const url = data?.data?.path || data?.data?.url; if (url) { setEvUrl(url); setEvKind('FILE') } }
    catch { alert('No se pudo subir el archivo') } finally { setBusy(false) }
  }
  const reset = () => { setTitle(''); setDescription(''); setImpact('MEDIUM'); setEvUrl(''); setEvKind('LINK'); setOpen(false) }
  const add = async () => {
    if (!title.trim() || !description.trim()) return
    setBusy(true)
    try { await abpApi.addDiscovery(teamId, { phase: currentPhase || 1, title: title.trim(), description: description.trim(), impact, evidenceUrl: evUrl.trim() || undefined, evidenceKind: evUrl.trim() ? evKind : undefined }); reset(); load() }
    catch (e: any) { alert(e?.response?.data?.message || 'Error') } finally { setBusy(false) }
  }
  const del = async (id: string) => { if (!confirm('¿Eliminar descubrimiento?')) return; await abpApi.deleteDiscovery(id); load() }
  if (loading) return <Loading />
  return (
    <div className="space-y-3">
      {!readOnly && (open ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="¿Qué descubrieron? (título)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Descríbanlo: qué aprendieron y por qué importa." className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" />
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs font-semibold text-slate-500">Impacto:</span>
            {['LOW', 'MEDIUM', 'HIGH'].map(v => <button key={v} onClick={() => setImpact(v)} className={`text-xs font-semibold rounded-full px-2.5 py-1 ${impact === v ? IMPACT_META[v][1] + ' ring-2 ring-offset-1 ring-violet-300' : 'bg-slate-100 text-slate-400'}`}>{IMPACT_META[v][0]}</button>)}
          </div>
          <div className="flex gap-2">
            <input value={evUrl} onChange={e => { setEvUrl(e.target.value); setEvKind('LINK') }} placeholder="Evidencia: enlace (opcional)" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadEv(f); e.currentTarget.value = '' }} />
            <button onClick={() => fileRef.current?.click()} disabled={busy} className="px-3 bg-slate-100 text-slate-700 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"><Paperclip className="w-4 h-4" /> Archivo</button>
          </div>
          {evUrl && <p className="text-xs text-slate-400 truncate">Evidencia: {evUrl}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={reset} className="px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg">Cancelar</button>
            <button onClick={add} disabled={busy || !title.trim() || !description.trim()} className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">Guardar descubrimiento</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="w-full py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-400 hover:border-violet-300 hover:text-violet-600 flex items-center justify-center gap-1.5"><Plus className="w-4 h-4" /> Registrar un descubrimiento</button>
      ))}
      {items.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">Aún no hay descubrimientos. Registren lo que van aprendiendo.</p> : (
        <div className="grid sm:grid-cols-2 gap-3">{items.map(d => (
          <div key={d.id} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <h5 className="font-bold text-slate-800">💡 {d.title}</h5>
              <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0 ${IMPACT_META[d.impact]?.[1] || ''}`}>Impacto {IMPACT_META[d.impact]?.[0] || d.impact}</span>
            </div>
            <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{d.description}</p>
            {d.evidenceUrl && <button onClick={() => openStoredFile(d.evidenceUrl)} className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline mt-2">{d.evidenceKind === 'FILE' ? '📎' : '🔗'} Ver evidencia</button>}
            <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
              <span className="font-semibold">{d.authorName}</span><span>· Fase {d.phase}</span>
              {!readOnly && <button onClick={() => del(d.id)} className="ml-auto text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          </div>
        ))}</div>
      )}
    </div>
  )
}

// Sets curados (§14.3): emblemas de equipo y avatares de estudiante.
const TEAM_EMBLEMS = ['🚀', '🦊', '🐼', '🦁', '🐯', '🦉', '🐺', '🐢', '🦅', '🐙', '🦄', '🐝', '🦋', '🐬', '🐸', '⚡', '🔥', '🌟', '🌊', '🏔️']
const AVATARS = ['🦊', '🐼', '🦁', '🐯', '🦉', '🐺', '🐢', '🦅', '🐙', '🦄', '🐝', '🦋', '🐬', '🐸', '🐵', '🐨', '🐷', '🐰', '🐧', '🦩']
const STATION_PURPOSE: Record<number, string> = { 1: 'Comprender el reto', 2: 'Generar y elegir ideas', 3: 'Fijar el objetivo', 4: 'Planear el trabajo', 5: 'Construir y evidenciar', 6: 'Presentar y coevaluar' }

// Estado de Colaboración OBJETIVO (por hechos: última actividad), nunca emocional.
type CollabKey = 'alto' | 'activo' | 'idle' | 'aten' | 'done' | 'nuevo'
const COLLAB_COLOR: Record<CollabKey, string> = { alto: 'var(--t-teal)', activo: '#2E76BE', idle: 'var(--t-marigold)', aten: '#CB4E42', done: 'var(--t-teal)', nuevo: 'var(--t-muted)' }
function collabState(t: any): { label: string; key: CollabKey } {
  if (t.done) return { label: 'Completa', key: 'done' }
  const last = t.lastActivityAt ? new Date(t.lastActivityAt).getTime() : 0
  if (!last) return { label: 'Sin empezar', key: 'nuevo' }
  const days = Math.floor((Date.now() - last) / 86400000)
  if (days <= 1) return { label: 'Muy activo', key: 'alto' }
  if (days <= 3) return { label: 'Activo', key: 'activo' }
  if (days <= 7) return { label: `Sin actividad · ${days}d`, key: 'idle' }
  return { label: `Necesita atención · ${days}d`, key: 'aten' }
}

// Ritual de fundación: el equipo (DRAFT) elige nombre + emblema como primer acuerdo.
function FoundTeam({ team, onDone }: { team: any; onDone: () => void }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🚀')
  const [busy, setBusy] = useState(false)
  const found = async () => {
    if (!name.trim() || busy) return
    if (!window.confirm(`¿"${emoji} ${name.trim()}" es el nombre acordado por TODO el equipo?\n\nUna vez fundado, cambiarlo requerirá el permiso del docente.`)) return
    setBusy(true)
    try { await abpApi.foundTeamIdentity(team.id, name.trim(), emoji); onDone() }
    catch (e: any) { alert(e?.response?.data?.message || 'No se pudo fundar el equipo') } finally { setBusy(false) }
  }
  return (
    <div className="taller">
      <div className="taller-card taller-mission max-w-lg mx-auto p-7 text-center">
        <div className="taller-crest w-16 h-16 rounded-2xl grid place-items-center text-3xl mx-auto shadow-sm">{emoji}</div>
        <h3 className="text-xl font-black taller-ink mt-3">¡Funden su equipo!</h3>
        <p className="text-sm taller-soft mb-3">Elijan juntos un nombre y un emblema. Es su primer acuerdo como equipo.</p>
        <div className="text-left text-xs rounded-xl p-3 mb-4 flex gap-2" style={{ background: 'color-mix(in srgb, var(--t-marigold) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--t-marigold) 28%, var(--t-line))' }}>
          <span>🤝</span>
          <span className="taller-soft"><b className="taller-ink">Pónganse de acuerdo entre TODOS antes de escribirlo.</b> Cualquier integrante puede fijarlo, y una vez fijado queda para el equipo: cambiarlo después necesitará el permiso del docente.</span>
        </div>
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') found() }} placeholder="Nombre acordado por el equipo…" className="w-full rounded-xl px-4 py-2.5 text-sm text-center mb-4 taller-ink" style={{ border: '1.5px solid var(--t-line)', background: 'var(--t-raised)' }} autoFocus />
        <div className="text-xs font-semibold taller-muted mb-1.5">Emblema del equipo</div>
        <div className="grid grid-cols-10 gap-1.5 mb-5">
          {TEAM_EMBLEMS.map(e => <button key={e} onClick={() => setEmoji(e)} className="text-xl rounded-lg py-1.5 transition hover:bg-amber-50" style={emoji === e ? { outline: '2px solid var(--t-marigold)', background: 'color-mix(in srgb, var(--t-marigold) 14%, transparent)' } : undefined}>{e}</button>)}
        </div>
        <button onClick={found} disabled={!name.trim() || busy} className="taller-cta w-full py-3 font-bold rounded-xl hover:opacity-95 disabled:opacity-40 flex items-center justify-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Fundar equipo 🎉</button>
      </div>
    </div>
  )
}

function StudentExpedition({ projects }: { projects: any[] }) {
  const [projectId, setProjectId] = useState<string>(projects[0]?.id || '')
  const [team, setTeam] = useState<any>(null)
  const [pres, setPres] = useState<any>(null)
  const [expTab, setExpTab] = useState<'phases' | 'log' | 'discoveries'>('phases')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [inTaller, setInTaller] = useState(false)
  const [cuartelLog, setCuartelLog] = useState<any[]>([])
  const [celebrate, setCelebrate] = useState<{ name: string; icon: string } | null>(null)
  const [ritualOpen, setRitualOpen] = useState(false)
  const prevValidatedRef = useRef<number | null>(null)

  useEffect(() => { if (team?.id) abpApi.listLog(team.id).then(({ data }) => setCuartelLog((data || []).slice(0, 4))).catch(() => { }) }, [team?.id])

  // Momento del HITO: al validarse una estación nueva, se celebra (sello + confeti).
  useEffect(() => {
    if (!team) return
    const validated = (team.phaseStates || []).filter((s: any) => s.status === 'VALIDATED').length
    if (prevValidatedRef.current !== null && validated > prevValidatedRef.current) {
      const top = (team.phaseStates || []).filter((s: any) => s.status === 'VALIDATED').reduce((m: number, s: any) => Math.max(m, s.phase), 0)
      const st = PHASES.find(p => p.n === top)
      setCelebrate({ name: st?.name || 'Estación', icon: st?.icon || '🏅' })
      try { confetti({ particleCount: 90, spread: 72, origin: { y: 0.6 }, colors: ['#E19325', '#C9791A', '#0F8074', '#D65C8A'] }) } catch { }
    }
    prevValidatedRef.current = validated
  }, [team])

  const requestRename = async () => {
    if (!team) return
    const n = window.prompt('Nuevo nombre del equipo (lo tendrá que aprobar el docente):', team.name)?.trim()
    if (!n) return
    try { await abpApi.requestTeamRename(team.id, n); load() } catch (e: any) { alert(e?.response?.data?.message || 'No se pudo solicitar el cambio') }
  }
  const pickAvatar = async (a: string) => {
    if (!team) return
    setAvatarOpen(false)
    try { await abpApi.setMyAvatar(team.id, a); load(true) } catch (e: any) { alert(e?.response?.data?.message || 'No se pudo guardar el avatar') }
  }

  const load = useCallback((silent = false) => {
    if (!projectId) { setLoading(false); return Promise.resolve() }
    if (!silent) setLoading(true)
    return Promise.all([
      abpApi.myTeam(projectId).catch(() => ({ data: null })),
      abpApi.projectPresentation(projectId).catch(() => ({ data: null })),
    ]).then(([t, p]) => { setTeam(t.data); setPres(p.data) }).finally(() => { if (!silent) setLoading(false) })
  }, [projectId])
  useEffect(() => { load() }, [load])

  // Capa 2: refresco en vivo (polling) mientras se trabaja la fase actual, para ver
  // el trabajo de los demás integrantes casi en tiempo real, sin websockets.
  const phaseInProgress = !!team && stateOf(team, team.currentPhase) === 'IN_PROGRESS'
  useEffect(() => {
    if (expTab !== 'phases' || !phaseInProgress) return
    const id = setInterval(() => load(true), 5000)
    return () => clearInterval(id)
  }, [expTab, phaseInProgress, load])

  const requestValidation = async () => {
    if (!team) return
    setBusy(true)
    try { await abpApi.requestValidation(team.id); load() } finally { setBusy(false) }
  }

  if (projects.length === 0) return <Empty msg="Tu docente aún no ha creado una Expedición ABP en esta aula." />
  if (loading) return <Loading />

  // Si no tiene equipo
  if (!team) {
    return (
      <div className="space-y-4">
        {projects.length > 1 && <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 font-medium">Aún no estás en un equipo de este proyecto. Tu docente te asignará a uno para empezar tu expedición.</div>
        {pres && <PresentationView project={pres} />}
      </div>
    )
  }

  // Ritual de fundación: hasta que el equipo elija nombre + emblema, no se trabaja.
  if (team.identityState === 'DRAFT') {
    return (
      <div className="space-y-4">
        {projects.length > 1 && <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} />}
        <FoundTeam team={team} onDone={load} />
      </div>
    )
  }

  const cur = team.currentPhase
  const curState = stateOf(team, cur)
  const curPs = (team.phaseStates || []).find((s: any) => s.phase === cur)
  // Gating desde las misiones: todas las misiones obligatorias completas (lo calcula el backend).
  const reqMissions = (team.currentMissions || []).filter((m: any) => m.required)
  const reqDone = reqMissions.filter((m: any) => m.complete).length
  const reqInstr: { key: string; used: boolean }[] = team.requiredInstruments || []
  const reqInstrUsed = reqInstr.filter(s => s.used).length
  const canRequest = !!team.readyForValidation

  return (
    <div className="space-y-4 taller">
      {/* HEADER ESTUDIANTE — El Taller */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {projects.length > 1 ? <ProjectPicker projects={projects} value={projectId} onChange={setProjectId} /> : <h3 className="font-black text-lg taller-ink tracking-tight">🚀 Expedición Activa</h3>}
        <button onClick={() => setShowManual(true)} className="taller-card flex items-center gap-2 px-4 py-2 text-sm font-bold taller-soft hover:shadow-md transition-shadow">
          📖 Manual de Expedición
        </button>
      </div>

      {/* Cabecera del equipo — Cuartel */}
      <div className="taller-card taller-mission p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3.5">
            <div className="taller-crest w-14 h-14 rounded-2xl grid place-items-center text-2xl shadow-sm shrink-0">{team.emoji}</div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-black taller-ink tracking-tight">{team.name}</h3>
                {team.identityState === 'RENAME_PENDING'
                  ? <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5">✏️ “{team.proposedName}” — esperando al docente</span>
                  : <button onClick={requestRename} className="text-[11px] font-semibold taller-mari hover:opacity-70">✏️ cambiar nombre</button>}
              </div>
              {team.problem && <p className="text-sm taller-soft mt-0.5">Reto: {team.problem}</p>}
              {/* Integrantes con su avatar + elegir el mío */}
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                {(team.members || []).map((m: any) => {
                  const nm = `${m.studentEnrollment?.student?.user?.firstName ?? ''}`.trim() || 'Integrante'
                  return <span key={m.id} title={nm} className="taller-avatar w-8 h-8 rounded-full grid place-items-center text-sm shadow-sm">{m.avatarId || nm[0]?.toUpperCase()}</span>
                })}
                {team.myEnrollmentId && <button onClick={() => setAvatarOpen(v => !v)} className="text-[11px] font-semibold taller-mari hover:opacity-70 ml-1">🎭 mi avatar</button>}
              </div>
              {avatarOpen && (
                <div className="taller-card mt-2 p-2 inline-block">
                  <div className="grid grid-cols-10 gap-1">
                    {AVATARS.map(a => <button key={a} onClick={() => pickAvatar(a)} className="text-lg rounded-lg px-1.5 py-1 hover:bg-amber-50">{a}</button>)}
                  </div>
                </div>
              )}
              {team.badges?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {team.badges.map((b: string) => <span key={b} className="text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-2.5 py-0.5">{b}</span>)}
                </div>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-black taller-mari">⭐ {team.xp}</div>
            <div className="text-xs taller-muted font-semibold">Chispas del equipo</div>
          </div>
        </div>
      </div>

      {/* ═══ CUARTEL GENERAL (sala de situación) ═══ */}
      {!inTaller && (
        <>
          {/* Agenda "Hoy deberán…": misiones + instrumentos obligatorios + docente + Valeria */}
          <StationAgenda
            team={team}
            phase={cur}
            stationName={phaseName(cur)}
            purpose={STATION_PURPOSE[cur]}
            feedback={curPs?.feedback}
            awaiting={curState === 'AWAITING'}
            onEnter={() => setInTaller(true)}
          />

          <div className="grid md:grid-cols-2 gap-4">
            {/* Mapa de la expedición */}
            <div className="taller-card p-5">
              <div className="text-[10px] font-mono uppercase tracking-widest taller-muted mb-3">Mapa de la expedición</div>
              {PHASES.map(p => {
                const st = stateOf(team, p.n)
                const done = st === 'VALIDATED'
                const now = p.n === cur
                return (
                  <div key={p.n} className="flex items-center gap-3 py-1.5">
                    <div className="w-8 h-8 rounded-lg grid place-items-center text-sm shrink-0" style={done ? { background: 'color-mix(in srgb, var(--t-teal) 16%, transparent)', color: 'var(--t-teal)', border: '2px solid color-mix(in srgb, var(--t-teal) 45%, var(--t-line))' } : now ? { background: 'color-mix(in srgb, var(--t-marigold) 16%, transparent)', color: 'var(--t-marigold)', border: '2px solid var(--t-marigold)' } : { background: 'var(--t-surface)', color: 'var(--t-muted)', border: '2px solid var(--t-line)' }}>{done ? '✓' : now ? p.icon : '🔒'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold" style={now ? { color: 'var(--t-marigold)' } : done ? { color: 'var(--t-ink)' } : { color: 'var(--t-muted)' }}>{p.name}</div>
                      <div className="text-[10px] font-mono taller-muted">{done ? 'validada' : now ? 'en curso' : 'bloqueada'}</div>
                    </div>
                    {done && <span className="text-base">🏅</span>}
                  </div>
                )
              })}
            </div>

            {/* Bitácora reciente (pulso del equipo) */}
            <div className="taller-card p-5">
              <div className="text-[10px] font-mono uppercase tracking-widest taller-muted mb-3">Bitácora reciente</div>
              {cuartelLog.length === 0 ? (
                <p className="text-sm taller-muted">Aún no hay notas. Anótenlas dentro del Taller (📔 Bitácora).</p>
              ) : cuartelLog.map((e: any) => (
                <div key={e.id} className="py-2" style={{ borderTop: '1px solid var(--t-line)' }}>
                  <p className="text-sm taller-soft whitespace-pre-line line-clamp-2">{e.content}</p>
                  <div className="text-[10px] font-mono taller-muted mt-0.5">{e.authorName} · {new Date(e.createdAt).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ═══ EL TALLER (trabajo de la estación) ═══ */}
      {inTaller && (<>
      <button onClick={() => setInTaller(false)} className="flex items-center gap-1 text-sm font-semibold taller-muted hover:opacity-70"><ChevronLeft className="w-4 h-4" /> Cuartel General</button>

      {/* Sendero */}
      <div className="taller-card p-4">
        <div className="text-[10px] font-mono uppercase tracking-widest taller-muted mb-2">Sendero de la expedición</div>
        <Trail team={team} />
      </div>

      {/* Sub-nav interna del Nivel 2 */}
      <div className="flex rounded-xl p-1 w-fit flex-wrap gap-0.5" style={{ background: 'color-mix(in srgb, var(--t-marigold) 8%, var(--t-surface))', border: '1px solid var(--t-line)' }}>
        {(['phases', 'log', 'discoveries'] as const).map(k => (
          <button key={k} onClick={() => setExpTab(k)} className="px-3 py-1.5 rounded-lg text-sm font-semibold transition"
            style={expTab === k ? { background: 'var(--t-raised)', color: 'var(--t-marigold)', boxShadow: 'var(--t-shadow-sm)' } : { color: 'var(--t-muted)' }}>
            {k === 'phases' ? '🚀 Fases' : k === 'log' ? '📔 Bitácora' : '💡 Descubrimientos'}
          </button>
        ))}
      </div>

      {expTab === 'log' && <LogbookView teamId={team.id} currentPhase={cur} />}
      {expTab === 'discoveries' && <DiscoveriesView teamId={team.id} currentPhase={cur} />}

      {/* Panel de la fase actual — Estación */}
      {expTab === 'phases' && (
      <div className="taller-card p-6">
        <div className="text-[11px] font-mono uppercase tracking-[0.15em] taller-mari mb-1">Estación {cur} de 6</div>
        <h3 className="text-xl font-black taller-ink mb-3 tracking-tight">{PHASES.find(p => p.n === cur)?.icon} {phaseName(cur)}</h3>

        {curPs?.feedback && (
          <div className="mb-4 p-3 rounded-xl text-sm" style={{ background: 'color-mix(in srgb, #CB4E42 10%, transparent)', borderLeft: '4px solid #CB4E42', color: '#7a2b22' }}>
            🧑‍🏫 <b>Retroalimentación del docente:</b> {curPs.feedback}
          </div>
        )}

        {curState === 'AWAITING' ? (
          <div className="p-4 rounded-xl font-semibold flex items-center gap-2" style={{ background: 'color-mix(in srgb, var(--t-marigold) 12%, transparent)', color: '#8a5a10' }}>
            <Clock className="w-5 h-5" /> En revisión — esperando al docente…
          </div>
        ) : cur === 6 && curState === 'VALIDATED' ? (
          <div className="text-center py-6">🏆<p className="font-black taller-ink mt-2">¡Llegaron a la cima de la expedición!</p></div>
        ) : (
          <>
            {/* 1. Instrucciones: qué haremos aquí y cómo (colapsable) */}
            <StationGuide team={team} phase={cur} />
            {/* 2. Espacio de trabajo: los instrumentos, a la mano */}
            <StationInstruments team={team} phase={cur} />
            {/* 3. Misiones: el detalle del trabajo */}
            <MissionsPanel team={team} onSaved={() => load(true)} />
            {/* 4. Compuerta de validación */}
            <div className="mt-5 flex items-center gap-3 flex-wrap pt-4" style={{ borderTop: '1px solid var(--t-line)' }}>
              {reqMissions.length > 0 && <span className="text-sm taller-soft">Misiones obligatorias: <b className="taller-ink">{reqDone}/{reqMissions.length}</b></span>}
              {reqInstr.length > 0 && <span className="text-sm taller-soft">Instrumentos obligatorios: <b className="taller-ink">{reqInstrUsed}/{reqInstr.length}</b></span>}
              <button onClick={() => canRequest && setRitualOpen(true)} disabled={busy || !canRequest}
                className={`ml-auto py-3 px-6 font-bold rounded-xl flex items-center justify-center gap-2 disabled:cursor-not-allowed transition ${canRequest ? 'taller-cta hover:opacity-95' : ''}`}
                style={!canRequest ? { background: 'var(--t-surface)', color: 'var(--t-muted)', border: '1px solid var(--t-line)' } : undefined}>
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : canRequest ? <Send className="w-5 h-5" /> : '🔒'}
                {canRequest ? 'Presentar a validación' : (reqDone < reqMissions.length ? 'Completa las misiones' : reqInstrUsed < reqInstr.length ? 'Usen los instrumentos obligatorios' : 'Completa las misiones')}
              </button>
            </div>
          </>
        )}
      </div>
      )}

      {/* Anuncios y Recursos (al fondo, igual que el docente) */}
      <div className="mt-8 grid sm:grid-cols-2 gap-4 pt-8" style={{ borderTop: '1px solid var(--t-line)' }}>
        <AnnouncementsView projectId={projectId} />
        <ResourcesView projectId={projectId} />
      </div>
      </>)}

      {/* RITUAL DE VALIDACIÓN — gesto ceremonial con resumen del artefacto */}
      {ritualOpen && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center p-4" onClick={() => setRitualOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="taller-card taller-mission relative max-w-sm w-full p-7 text-center" onClick={e => e.stopPropagation()}>
            <div className="text-4xl">{PHASES.find(p => p.n === cur)?.icon}</div>
            <div className="text-[11px] font-mono uppercase tracking-widest taller-mari mt-3">Ritual de validación</div>
            <h3 className="text-xl font-black taller-ink mt-1">¿Presentar {phaseName(cur)} al docente?</h3>
            <p className="text-sm taller-soft mt-2">Su artefacto queda en revisión. Podrán seguir puliéndolo mientras el docente lo mira.</p>
            <div className="taller-card mt-4 p-3 text-left">
              <div className="text-[10px] font-mono uppercase tracking-widest taller-muted mb-1.5">Resumen del artefacto</div>
              <ul className="text-sm taller-soft space-y-1">
                {artifactSummary(team, cur).map((s, i) => <li key={i} className="flex gap-2"><span className="taller-mari">•</span>{s}</li>)}
                {reqMissions.length > 0 && <li className="flex gap-2"><span className="taller-mari">•</span>{reqDone}/{reqMissions.length} misiones obligatorias</li>}
              </ul>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setRitualOpen(false)} className="flex-1 py-3 rounded-xl font-semibold" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-soft)' }}>Todavía no</button>
              <button onClick={async () => { setRitualOpen(false); await requestValidation() }} disabled={busy} className="taller-cta flex-1 py-3 rounded-xl font-bold disabled:opacity-50">Presentar al docente ✦</button>
            </div>
          </div>
        </div>
      )}

      {/* HITO — celebración al conquistar una estación */}
      {celebrate && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" onClick={() => setCelebrate(null)}>
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
          <div className="taller-card taller-mission relative max-w-sm w-full p-7 text-center" onClick={e => e.stopPropagation()}>
            <div className="text-6xl">{celebrate.icon}</div>
            <div className="text-[11px] font-mono uppercase tracking-widest taller-mari mt-3">Hito conquistado</div>
            <h3 className="text-2xl font-black taller-ink mt-1">¡{celebrate.name} conquistada!</h3>
            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
              <span className="taller-chip inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5" style={{ color: 'var(--t-teal)' }}>{celebrate.icon} Sello obtenido</span>
              <span className="taller-chip inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 taller-mari">⭐ Chispas ganadas</span>
            </div>
            <p className="text-sm taller-soft mt-3">Su artefacto queda en la bitácora del equipo. ¡A por la siguiente estación!</p>
            <button onClick={() => setCelebrate(null)} className="taller-cta mt-5 w-full py-3 rounded-xl font-bold">¡Seguir! →</button>
          </div>
        </div>
      )}

      {/* SIDE PEEK MANUAL DE EXPEDICIÓN */}
      {showManual && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowManual(false)} />
          <div className="relative w-full max-w-md bg-slate-50 h-full shadow-2xl overflow-y-auto border-l border-slate-200 animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <h3 className="font-black text-slate-800 text-lg">Manual de Expedición</h3>
              <button onClick={() => setShowManual(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold">✕</button>
            </div>
            <div className="p-6">
              <PresentationView project={pres} />
            </div>
          </div>
        </div>
      )}
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

// ─── Centro de Operaciones: preview de equipo (lectura) ────────────────────────
function StatusChip({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    IN_PROGRESS: ['En curso', 'bg-sky-100 text-sky-700'],
    AWAITING: ['Esperando validación', 'bg-amber-100 text-amber-700'],
    VALIDATED: ['Validada', 'bg-emerald-100 text-emerald-700'],
    RETURNED: ['Devuelta', 'bg-rose-100 text-rose-700'],
    LOCKED: ['Bloqueada', 'bg-slate-100 text-slate-400'],
  }
  const [label, cls] = map[status] || ['—', 'bg-slate-100 text-slate-400']
  return <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${cls}`}>{label}</span>
}

function RONone() { return <p className="text-sm text-slate-300">Sin contenido todavía.</p> }

/** Trabajo de una fase en modo lectura (para el preview del docente). */
function PhaseWorkRO({ phase, data }: { phase: number; data: any }) {
  data = data || {}
  if (phase === 1) {
    const canvas = data.canvas || []
    return (
      <div className="grid sm:grid-cols-2 gap-2">
        {CANVAS_CARDS.map((c, i) => (
          <div key={i} className="rounded-lg border border-slate-200 p-2.5">
            <div className="text-xs text-slate-400">{c.icon} {c.q}</div>
            <div className="text-sm text-slate-700 mt-0.5">{canvas[i]?.value || <span className="text-slate-300">—</span>}</div>
          </div>
        ))}
      </div>
    )
  }
  if (phase === 2) {
    const ideas = data.ideas || []
    if (!ideas.length) return <RONone />
    return <div className="space-y-1">{ideas.map((i: any) => <div key={i.id} className="flex items-center gap-2 text-sm"><span className="text-violet-600 font-bold w-8">▲{i.votes || 0}</span><span className="text-slate-700">{i.text}</span></div>)}</div>
  }
  if (phase === 3) {
    const s = data.smart || {}
    const checked = Array.isArray(s.checks) ? s.checks.filter(Boolean).length : 0
    return <div className="text-sm"><p className="text-slate-700">{s.text || <span className="text-slate-300">Sin objetivo.</span>}</p><p className="text-xs text-slate-400 mt-1">Criterios SMART: {checked}/5</p></div>
  }
  if (phase === 4) {
    const tasks = data.tasks || []
    const cols = ['Por hacer', 'En curso', 'Hecho']
    return (
      <div className="grid grid-cols-3 gap-2">
        {cols.map((c, ci) => (
          <div key={ci}>
            <p className="text-xs font-bold text-slate-500 mb-1">{c}</p>
            <div className="space-y-1">{tasks.filter((t: any) => t.col === ci).map((t: any) => <div key={t.id} className="text-xs bg-slate-50 rounded p-1.5 text-slate-700">{t.text}</div>)}</div>
          </div>
        ))}
      </div>
    )
  }
  if (phase === 5) {
    const ev = data.evidences || []
    if (!ev.length) return <RONone />
    return <div className="space-y-1">{ev.map((e: any) => <div key={e.id} className="text-sm text-slate-700 flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5 text-slate-400" />{e.label || e.url}</div>)}</div>
  }
  if (phase === 6) {
    const co = Object.keys(data.coevals || {}).length
    return <p className="text-sm text-slate-600">Equipos coevaluados: {co}</p>
  }
  return null
}

/** Editor de una misión para el docente: actividades + Valeria sugiere (Ticket 1 del arco). */
function TeacherMissionEditor({ mission, teamId, onChanged }: { mission: any; teamId: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState<{ type: string; title: string; description: string }[] | null>(null)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [notConfigured, setNotConfigured] = useState(false)
  const [editing, setEditing] = useState<{ activityId: string; title: string } | null>(null)
  const [genActId, setGenActId] = useState<string | null>(null)
  const [picker, setPicker] = useState<{ id: string; title: string; type: string }[] | null>(null)
  const [pickerLoading, setPickerLoading] = useState(false)
  const acts = (mission.activities || []).filter((a: any) => !a.content?.tool)
  const run = async (fn: () => Promise<any>) => { setBusy(true); try { await fn(); onChanged() } finally { setBusy(false) } }
  const addLesson = async () => {
    const title = window.prompt('Título de la lección o juego:')?.trim()
    if (!title) return
    setBusy(true)
    try { const { data } = await abpApi.addLessonActivity(mission.id, title); onChanged(); setEditing({ activityId: data.classroomActivityId, title }) }
    catch (e: any) { alert(e?.response?.data?.message || 'No se pudo crear la lección') } finally { setBusy(false) }
  }
  // Valeria escribe el contenido jugable, anclado a la problemática del equipo.
  const genLesson = async (a: any) => {
    const instructions = window.prompt('¿Alguna indicación para Valeria? (opcional)\nEj: enfócate en el reciclaje de plásticos y usa ejemplos del barrio.')
    if (instructions === null) return
    setGenActId(a.id)
    try {
      const { data } = await abpApi.generateLessonContent(a.id, instructions.trim() || undefined)
      onChanged()
      setEditing({ activityId: a.classroomActivityId, title: data.title || a.title })
    } catch (e: any) { alert(e?.response?.data?.message || 'Valeria no pudo generar la lección') }
    finally { setGenActId(null) }
  }
  // Reutilizar una actividad/juego que ya existe en el curso (pestaña Actividades).
  const openPicker = async () => {
    setPickerLoading(true); setPicker([])
    try { const { data } = await abpApi.reusableActivities(mission.id); setPicker(data) }
    catch (e: any) { alert(e?.response?.data?.message || 'No se pudieron cargar las actividades'); setPicker(null) }
    finally { setPickerLoading(false) }
  }
  const attach = async (classroomActivityId: string) => {
    setBusy(true)
    try { await abpApi.attachActivity(mission.id, classroomActivityId); setPicker(null); onChanged() }
    catch (e: any) { alert(e?.response?.data?.message || 'No se pudo reutilizar la actividad') }
    finally { setBusy(false) }
  }
  const suggest = async () => {
    setSuggesting(true); setSuggestions(null); setNotConfigured(false); setPicked(new Set())
    try {
      const { data } = await abpApi.suggestActivities(teamId, mission.id)
      if (!data.configured) { setNotConfigured(true); return }
      setSuggestions(data.activities || [])
      setPicked(new Set((data.activities || []).map((_, i) => i)))
    } catch (e: any) { alert(e?.response?.data?.message || 'No se pudo generar con Valeria') } finally { setSuggesting(false) }
  }
  const apply = async () => {
    if (!suggestions) return
    const items = suggestions.filter((_, i) => picked.has(i)).map(s => ({ type: s.type, title: s.title }))
    if (!items.length) return
    setBusy(true)
    try { await abpApi.addActivitiesBulk(mission.id, items); setSuggestions(null); onChanged() } finally { setBusy(false) }
  }
  return (
    <div className={`rounded-xl border p-3 ${mission.complete ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={mission.complete ? 'text-emerald-500' : 'text-slate-300'}>{mission.complete ? '✔' : '○'}</span>
        <span className={`text-sm font-semibold ${mission.complete ? 'text-slate-500' : 'text-slate-700'}`}>{mission.title}</span>
        {mission.required && <span className="text-[10px] font-bold text-violet-600 uppercase">obligatoria</span>}
        {mission.deliverableKind && <span className="text-[10px] font-bold uppercase" style={{ color: mission.deliveryState === 'SUBMITTED' ? '#0f9d8c' : '#C8811A' }}>{mission.deliveryState === 'SUBMITTED' ? '✓ entregado' : `📎 entrega · ${DELIVERY_LABEL[mission.deliverableKind]}`}</span>}
      </div>

      {/* Entrega del equipo (solo lectura para el docente) */}
      {mission.deliverableKind && mission.deliveryState === 'SUBMITTED' && (
        <div className="mt-2 pl-6 text-xs">
          {mission.deliverableKind === 'TEXT'
            ? <p className="text-slate-600 whitespace-pre-line bg-slate-50 rounded-lg p-2">{mission.deliveryText}</p>
            : mission.deliverableKind === 'FILE'
              ? <button onClick={async () => { try { const { data } = await storageApi.resolveUrl(mission.deliveryUrl); window.open(data.url, '_blank', 'noopener') } catch { window.open(mission.deliveryUrl, '_blank') } }} className="font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1"><Paperclip className="w-3.5 h-3.5" /> {mission.deliveryLabel || 'Ver archivo'}</button>
              : <a href={mission.deliveryUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1 break-all"><Link2 className="w-3.5 h-3.5 shrink-0" /> {mission.deliveryLabel || mission.deliveryUrl}</a>}
        </div>
      )}

      {acts.length > 0 && (
        <div className="mt-2 space-y-1 pl-6">
          {acts.map((a: any) => a.classroomActivityId ? (
            <div key={a.id} className="flex items-center gap-2 group">
              <span className={`text-xs ${a.completed ? 'text-emerald-500' : 'text-slate-400'}`}>🎮</span>
              <span className={`text-xs ${a.completed ? 'text-slate-400' : 'text-slate-600'}`}>{a.title}</span>
              <span className="text-[10px] font-semibold text-violet-500">{a.linkedActivity ? 'reutilizada' : 'lección/juego'}{a.completed ? ' · hecha' : ''}</span>
              <div className="ml-auto flex items-center gap-2 shrink-0">
                {!a.linkedActivity && (
                  <>
                    <button onClick={() => genLesson(a)} disabled={genActId === a.id} className="text-[11px] font-semibold text-fuchsia-600 hover:text-fuchsia-700 flex items-center gap-1 disabled:opacity-50">
                      {genActId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : '✨'} Generar
                    </button>
                    <button onClick={() => setEditing({ activityId: a.classroomActivityId, title: a.title })} className="text-[11px] font-semibold text-violet-600 hover:text-violet-700">✏️ Editar</button>
                  </>
                )}
                <button onClick={() => run(() => abpApi.deleteActivity(a.id))} disabled={busy} title={a.linkedActivity ? 'Quitar de la misión (no borra el original)' : 'Eliminar'} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ) : (
            <div key={a.id} className="flex items-center gap-2 group">
              <input type="checkbox" checked={!!a.completed} disabled={busy} onChange={e => run(() => abpApi.completeActivity(a.id, e.target.checked))} className="w-3.5 h-3.5 accent-violet-600" />
              <span className={`text-xs ${a.completed ? 'line-through text-slate-400' : 'text-slate-600'}`}><span className="text-slate-400 mr-1">{ACT_LABEL[a.type] || a.type}</span>{a.title}</span>
              <button onClick={() => run(() => abpApi.deleteActivity(a.id))} disabled={busy} className="ml-auto opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 pl-6 flex items-center gap-3 flex-wrap">
        <AddActivityForm mission={mission} onSaved={onChanged} />
        <button onClick={addLesson} disabled={busy} className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1 disabled:opacity-50"><Plus className="w-3.5 h-3.5" /> 🎮 Lección/Juego</button>
        <button onClick={openPicker} disabled={busy || pickerLoading} className="text-xs font-semibold text-teal-600 hover:text-teal-700 flex items-center gap-1 disabled:opacity-50">{pickerLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '♻️'} Reutilizar existente</button>
        <button onClick={suggest} disabled={suggesting} className="text-xs font-semibold text-fuchsia-600 hover:text-fuchsia-700 flex items-center gap-1 disabled:opacity-50">
          {suggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '✨'} Sugerir con Valeria
        </button>
      </div>

      {editing && (
        <div className="fixed inset-0 z-[120] bg-white overflow-auto">
          <LessonEditor activityId={editing.activityId} activityTitle={editing.title} onClose={() => { setEditing(null); onChanged() }} onPreview={() => { /* sin preview aquí */ }} />
        </div>
      )}

      {picker && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setPicker(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[80vh] flex flex-col">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm">♻️ Reutilizar una actividad del curso</h3>
              <button onClick={() => setPicker(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold">✕</button>
            </div>
            <div className="p-3 overflow-y-auto">
              {picker.length === 0 ? (
                <p className="text-xs text-slate-400 p-3 text-center">No hay actividades jugables disponibles en este curso (o ya están todas en la misión).</p>
              ) : picker.map(a => (
                <button key={a.id} onClick={() => attach(a.id)} disabled={busy} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-teal-50 text-left disabled:opacity-50">
                  <span>🎮</span>
                  <span className="flex-1 text-sm text-slate-700 truncate">{a.title}</span>
                  <span className="text-[10px] font-mono text-slate-400">{a.type}</span>
                  <span className="text-xs font-semibold text-teal-600 shrink-0">Añadir</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {notConfigured && <p className="mt-2 pl-6 text-xs text-amber-600">Valeria no está configurada (falta la API key de IA). Puedes añadir actividades manualmente.</p>}

      {suggestions && (
        <div className="mt-2 ml-6 rounded-xl border border-fuchsia-200 bg-fuchsia-50/40 p-3">
          {suggestions.length === 0 ? <p className="text-xs text-slate-500">Valeria no devolvió sugerencias. Intenta de nuevo.</p> : (
            <>
              <p className="text-xs font-bold text-fuchsia-700 mb-2">✨ Sugerencias de Valeria (revisa y elige)</p>
              <div className="space-y-1.5">
                {suggestions.map((s, i) => (
                  <label key={i} className="flex items-start gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={picked.has(i)} onChange={() => setPicked(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n })} className="w-3.5 h-3.5 accent-fuchsia-600 mt-0.5" />
                    <span><b className="text-slate-700">{ACT_LABEL[s.type] || s.type} · {s.title}</b>{s.description ? <span className="text-slate-500"> — {s.description}</span> : null}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setSuggestions(null)} className="text-xs text-slate-500 hover:text-slate-700">Descartar</button>
                <button onClick={apply} disabled={busy || picked.size === 0} className="text-xs font-bold bg-fuchsia-600 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">Añadir {picked.size} a la misión</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TeamPreview({ teamId, onBack }: { teamId: string; onBack: () => void }) {
  const [team, setTeam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(() => { abpApi.teamExpedition(teamId).then(({ data }) => setTeam(data)).finally(() => setLoading(false)) }, [teamId])
  useEffect(() => { load() }, [load])
  if (loading) return <Loading />
  if (!team) return <Empty msg="No se pudo cargar el equipo." />
  const phases = team.phaseStates || []
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ChevronLeft className="w-4 h-4" /> Volver al panel</button>
      <div className="bg-white rounded-2xl border-2 border-violet-200 p-5" style={{ borderTopColor: team.color, borderTopWidth: 6 }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">Vista del docente · solo lectura</span>
            <h3 className="text-xl font-bold text-slate-800 mt-1">{team.emoji} {team.name}</h3>
            {team.problem && <p className="text-sm text-slate-500">Reto: {team.problem}</p>}
          </div>
          <div className="text-right"><div className="text-2xl font-black text-violet-600">⭐ {team.xp}</div><div className="text-xs text-slate-400 font-semibold">XP</div></div>
        </div>
        <div className="mt-3"><Trail team={team} /></div>
      </div>
      {phases.map((ps: any) => (
        <div key={ps.phase} className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <h4 className="font-bold text-slate-800">{PHASES.find(p => p.n === ps.phase)?.icon} Fase {ps.phase}: {phaseName(ps.phase)}</h4>
            <StatusChip status={ps.status} />
          </div>
          {ps.feedback && <div className="mb-3 p-2.5 rounded-lg bg-rose-50 text-xs text-rose-700">🧑‍🏫 {ps.feedback}</div>}
          {(ps.missions || []).length > 0 && (
            <div className="mb-3 space-y-2">
              {ps.missions.map((m: any) => (
                <TeacherMissionEditor key={m.id} mission={m} teamId={team.id} onChanged={load} />
              ))}
            </div>
          )}
          {/* Espacio de trabajo del equipo: el docente abre los instrumentos de la estación */}
          <div className="taller">
            <StationInstruments team={team} phase={ps.phase} />
          </div>
          <PhaseWorkRO phase={ps.phase} data={ps.data} />
        </div>
      ))}

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h4 className="font-bold text-slate-800 mb-3">📔 Bitácora</h4>
        <LogbookView teamId={team.id} readOnly />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h4 className="font-bold text-slate-800 mb-3">💡 Descubrimientos</h4>
        <DiscoveriesView teamId={team.id} readOnly />
      </div>
    </div>
  )
}

function BroadcastMissionModal({ projectId, onClose, onDone }: { projectId: string; onClose: () => void; onDone: (count: number) => void }) {
  const [phase, setPhase] = useState(1)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [required, setRequired] = useState(true)
  const [kind, setKind] = useState<'NONE' | 'FILE' | 'LINK' | 'TEXT'>('NONE')
  const [activities, setActivities] = useState<{ type: string; title: string }[]>([])
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!title.trim()) return
    setBusy(true)
    try {
      const { data } = await abpApi.broadcastMission(projectId, { phase, title: title.trim(), description: description.trim() || undefined, required, deliverableKind: kind === 'NONE' ? undefined : kind, activities: kind === 'NONE' ? activities.filter(a => a.title.trim()) : [] })
      onDone(data.count)
    } catch (e: any) { alert(e?.response?.data?.message || 'No se pudo liberar la misión') } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">🎖️ Liberar misión a todos los equipos</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500">Fase</label>
            <select value={phase} onChange={e => setPhase(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1">
              {PHASES.map(p => <option key={p.n} value={p.n}>{p.icon} Fase {p.n}: {p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Título de la misión</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej. Entrevistar a un experto" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mt-1" autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Descripción (opcional)</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Qué deben lograr…" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none mt-1" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} className="w-4 h-4 accent-violet-600" />
            Obligatoria para validar la fase
          </label>
          <div>
            <label className="text-xs font-semibold text-slate-500">Tipo de misión</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {([['NONE', '📋 Trabajo libre'], ['FILE', '📎 Entrega · Archivo'], ['LINK', '🔗 Entrega · Enlace'], ['TEXT', '📝 Entrega · Texto']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setKind(k)} className="text-left text-sm rounded-lg px-3 py-2 border transition"
                  style={kind === k ? { background: 'color-mix(in srgb, #7C3AED 10%, white)', borderColor: '#7C3AED', color: '#5B21B6', fontWeight: 700 } : { background: 'white', borderColor: '#E2E8F0', color: '#475569' }}>
                  {label}
                </button>
              ))}
            </div>
            {kind !== 'NONE' && <p className="text-xs text-slate-400 mt-1.5">El equipo cumple esta misión <b>entregando</b> el producto desde el ABP. Se marca completa al entregar.</p>}
          </div>
          {kind === 'NONE' && (
          <div>
            <label className="text-xs font-semibold text-slate-500">Actividades (opcional)</label>
            <div className="space-y-2 mt-1">
              {activities.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <select value={a.type} onChange={e => setActivities(as => as.map((x, j) => j === i ? { ...x, type: e.target.value } : x))} className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs">
                    {ACT_TYPES.map(t => <option key={t} value={t}>{ACT_LABEL[t]}</option>)}
                  </select>
                  <input value={a.title} onChange={e => setActivities(as => as.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} placeholder="Describe la actividad…" className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm" />
                  <button onClick={() => setActivities(as => as.filter((_, j) => j !== i))} className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
              <button onClick={() => setActivities(as => [...as, { type: 'READING', title: '' }])} className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Añadir actividad</button>
            </div>
          </div>
          )}
        </div>
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Cancelar</button>
          <button onClick={submit} disabled={busy || !title.trim()} className="px-5 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center gap-2 hover:bg-violet-700">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Liberar a todos</button>
        </div>
      </div>
    </div>
  )
}

function TeacherProjectDetail({ classroomId, projectId, projectTitle, onBack }: { classroomId: string; projectId: string; projectTitle: string; onBack: () => void }) {
  const [project, setProject] = useState<any>(null)
  const [dash, setDash] = useState<any>(null)
  const [queue, setQueue] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [previewTeamId, setPreviewTeamId] = useState<string | null>(null)
  const [editTeamId, setEditTeamId] = useState<string | null>(null)
  const [editingPres, setEditingPres] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [broadcasting, setBroadcasting] = useState(false)
  const [tab, setTab] = useState<'panel' | 'map' | 'teams' | 'instruments' | 'announcements' | 'resources'>('panel')

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([abpApi.getProject(projectId), abpApi.queue(classroomId), abpApi.dashboard(projectId)])
      .then(([p, q, d]) => { setProject(p.data); setQueue((q.data || []).filter((x: any) => x.team?.projectId === projectId)); setDash(d.data) })
      .finally(() => setLoading(false))
  }, [projectId, classroomId])
  useEffect(() => { load() }, [load])

  if (reviewingId) return <AbpReview validationId={reviewingId} onClose={(changed) => { setReviewingId(null); if (changed) load() }} />
  if (previewTeamId) return <TeamPreview teamId={previewTeamId} onBack={() => setPreviewTeamId(null)} />
  if (editingPres && project) return <PresentationEditor project={project} onClose={() => setEditingPres(false)} onSaved={() => { setEditingPres(false); load() }} />
  if (loading) return <Loading />

  const teams = project?.teams || []

  // Agrupamos equipos por fase para el Mapa
  const teamsByPhase: Record<number, any[]> = {}
  PHASES.forEach(p => teamsByPhase[p.n] = [])
  ;(dash?.teams || []).forEach((t: any) => {
    if (teamsByPhase[t.currentPhase]) teamsByPhase[t.currentPhase].push(t)
  })

  const pendingValidations = queue.length
  const behindTeams = dash?.summary?.behind || 0

  const TABS: { key: typeof tab; label: string; badge?: number }[] = [
    { key: 'panel', label: '📊 Panel', badge: pendingValidations || undefined },
    { key: 'map', label: '🗺️ Mapa' },
    { key: 'teams', label: '👥 Equipos' },
    { key: 'instruments', label: '🧰 Instrumentos' },
    { key: 'announcements', label: '📢 Anuncios' },
    { key: 'resources', label: '📚 Recursos' },
  ]

  return (
    <div className="space-y-4 taller">
      {/* ── Cabecera compacta — Cockpit ───────────────────────────────────── */}
      <div className="taller-card overflow-hidden">
        <div className="h-1.5" style={{ background: 'linear-gradient(to right, var(--t-marigold), var(--t-terra))' }} />
        <div className="p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button onClick={onBack} className="flex items-center gap-1 text-sm font-semibold taller-muted hover:opacity-70">
              <ChevronLeft className="w-4 h-4" /> Todas las expediciones
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setBroadcasting(true)} className="taller-card px-3 py-1.5 taller-soft rounded-lg text-sm font-semibold hover:shadow-md transition-shadow">🎖️ Liberar misión</button>
              <button onClick={() => setShowManual(true)} className="taller-card px-3 py-1.5 taller-soft rounded-lg text-sm font-semibold hover:shadow-md transition-shadow">👁️ Vista del alumno</button>
              <button onClick={() => setEditingPres(true)} className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors" style={{ background: 'color-mix(in srgb, var(--t-marigold) 14%, transparent)', color: 'var(--t-marigold)' }}>✏️ Editar portada</button>
            </div>
          </div>

          <h3 className="text-2xl font-black taller-ink tracking-tight mt-3">🧭 {project?.title || projectTitle}</h3>
          {project?.challenge && <p className="text-sm taller-soft mt-1 max-w-3xl">🎯 {project.challenge}</p>}

          {dash && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="taller-chip inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5"><Users className="w-3.5 h-3.5" /> {dash.summary.teams} equipos</span>
              <span className="taller-chip inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5">🎓 {dash.summary.students} estudiantes</span>
              <button onClick={() => setTab('panel')} className="inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5" style={pendingValidations > 0 ? { background: 'color-mix(in srgb, var(--t-marigold) 16%, transparent)', color: 'var(--t-marigold)' } : { background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-muted)' }}>🔔 {pendingValidations} por validar</button>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1.5" style={behindTeams > 0 ? { background: 'color-mix(in srgb, #CB4E42 14%, transparent)', color: '#b0483c' } : { background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-muted)' }}>⏳ {behindTeams} atrasados</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Pestañas ──────────────────────────────────────────────────────── */}
      <div className="flex rounded-xl p-1 w-fit flex-wrap gap-0.5" style={{ background: 'color-mix(in srgb, var(--t-marigold) 8%, var(--t-surface))', border: '1px solid var(--t-line)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className="relative px-3 py-1.5 rounded-lg text-sm font-semibold transition"
            style={tab === t.key ? { background: 'var(--t-raised)', color: 'var(--t-marigold)', boxShadow: 'var(--t-shadow-sm)' } : { color: 'var(--t-muted)' }}>
            {t.label}
            {t.badge ? <span className="absolute -top-1 -right-1 w-4 h-4 text-white text-[10px] font-black rounded-full flex items-center justify-center" style={{ background: 'var(--t-marigold)' }}>{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* ── 📊 PANEL: triaje + progreso por equipo ────────────────────────── */}
      {tab === 'panel' && (
        <div className="space-y-4">
          {pendingValidations > 0 && (
            <div className="taller-card p-4" style={{ borderLeft: '4px solid var(--t-marigold)' }}>
              <h5 className="font-bold taller-ink text-sm mb-2">🔔 Esperando tu validación</h5>
              <div className="space-y-2">
                {queue.map(q => (
                  <div key={q.id} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2" style={{ background: 'color-mix(in srgb, var(--t-marigold) 9%, transparent)' }}>
                    <span className="text-sm taller-soft truncate"><b className="taller-ink">{q.team?.emoji} {q.team?.name}</b> · Fase {q.phase}: {phaseName(q.phase)}</span>
                    <button onClick={() => setReviewingId(q.id)} className="taller-cta px-3 py-1.5 text-xs font-bold rounded-lg shrink-0">Revisar →</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Alertas: equipos que necesitan atención (objetivo, por hechos) */}
          {(() => {
            const alerts = (dash?.teams || []).filter((t: any) => { const k = collabState(t).key; return k === 'idle' || k === 'aten' })
            if (alerts.length === 0) return null
            return (
              <div className="taller-card p-4" style={{ borderLeft: '4px solid #CB4E42' }}>
                <h5 className="font-bold taller-ink text-sm mb-2">⚠️ Necesitan atención</h5>
                <div className="flex flex-wrap gap-2">
                  {alerts.map((t: any) => (
                    <button key={t.id} onClick={() => setPreviewTeamId(t.id)} className="taller-chip inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 hover:shadow-sm">{t.emoji} {t.name} · {collabState(t).label}</button>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Radar · salud de los equipos */}
          <div className="taller-card p-5">
            <div className="flex items-baseline justify-between gap-2 flex-wrap mb-3">
              <h4 className="font-bold taller-ink">Radar · salud de los equipos</h4>
              <span className="text-[10px] font-mono taller-muted uppercase tracking-wide">Estado de Colaboración = hechos, no emociones</span>
            </div>
            {(dash?.teams || []).length === 0 ? (
              <p className="text-sm taller-muted">Aún no hay equipos. Créalos en la pestaña 👥 Equipos.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(dash?.teams || []).map((t: any) => {
                  const cs = collabState(t); const col = COLLAB_COLOR[cs.key]
                  return (
                    <button key={t.id} onClick={() => setPreviewTeamId(t.id)} className="taller-card p-4 text-left hover:shadow-md transition-shadow" style={{ borderLeft: `3px solid ${col}` }}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{t.emoji}</span>
                        <span className="font-bold taller-ink text-sm truncate flex-1">{t.name}</span>
                      </div>
                      <div className="text-[10px] font-mono taller-muted mt-0.5">Fase {t.currentPhase}/6</div>
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-1" style={{ color: col, background: `color-mix(in srgb, ${col} 13%, transparent)`, border: `1px solid color-mix(in srgb, ${col} 30%, transparent)` }}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: col }}></span>{cs.label}
                        </span>
                        {t.awaitingValidation && <span className="text-[10px] font-bold" style={{ color: 'var(--t-marigold)' }}>🔔 por validar</span>}
                        {t.currentStatus === 'RETURNED' && <span className="text-[10px] font-bold" style={{ color: '#b0483c' }}>devuelta</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-2.5">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--t-line)' }}><div className="h-full rounded-full" style={{ width: `${Math.max(t.progress, 4)}%`, background: t.color }} /></div>
                        <span className="text-[10px] font-mono taller-muted">{t.progress}%</span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] taller-muted">{t.members} integrantes</span>
                        <span className="text-[11px] font-black taller-mari">⭐ {t.xp}</span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 🗺️ MAPA: dónde está cada equipo en el sendero ─────────────────── */}
      {tab === 'map' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 overflow-x-auto">
          <div className="flex gap-4 min-w-[760px]">
            {PHASES.map((ph, idx) => {
              const pts = teamsByPhase[ph.n] || []
              return (
                <div key={ph.n} className="flex-1 relative">
                  {idx < PHASES.length - 1 && <div className="absolute top-5 left-1/2 w-full h-0.5 bg-slate-100 -z-10" />}
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base border-2 bg-white ${pts.length > 0 ? 'border-violet-500' : 'border-slate-200 grayscale opacity-60'}`}>{ph.icon}</div>
                    <span className="text-[11px] font-bold text-slate-500 mt-2 text-center leading-tight h-8">{ph.name}</span>
                    <div className="w-full mt-2 space-y-2">
                      {pts.map(t => (
                        <button key={t.id} onClick={() => setPreviewTeamId(t.id)} className="w-full bg-slate-50 hover:bg-violet-50 border border-slate-100 hover:border-violet-200 rounded-lg p-2 text-left transition-colors group" style={{ borderLeftColor: t.color, borderLeftWidth: 3 }}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{t.emoji}</span>
                            <span className="text-xs font-semibold text-slate-700 group-hover:text-violet-700 truncate">{t.name}</span>
                          </div>
                          {t.awaitingValidation && <div className="text-[9px] font-bold text-amber-600 mt-0.5">🔔 espera validación</div>}
                          {t.done && <div className="text-[9px] font-bold text-emerald-600 mt-0.5">🏆 completa</div>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 🧰 INSTRUMENTOS: Biblioteca por estación ──────────────────────── */}
      {tab === 'instruments' && project && (
        <TeacherInstrumentsConfig project={project} phases={PHASES} onSaved={load} />
      )}

      {/* ── 👥 EQUIPOS: gestión ───────────────────────────────────────────── */}
      {tab === 'teams' && (
        <div className="space-y-4">
          <CreateTeam classroomId={classroomId} projectId={projectId} onCreated={load} />
          {teams.length === 0 ? <Empty msg="Aún no hay equipos. Arma el primero." /> : (
            <div className="grid sm:grid-cols-2 gap-3">
              {teams.map((t: any) => (
                <div key={t.id} className="taller-card p-4" style={{ borderTopColor: t.color, borderTopWidth: 4 }}>
                  <div className="flex items-start justify-between">
                    <h5 className="font-bold taller-ink">{t.emoji} {t.name}</h5>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditTeamId(t.id)} title="Editar integrantes" className="text-slate-300 hover:text-slate-600" style={{ color: 'var(--t-faint, #AAA394)' }}><Users className="w-4 h-4" /></button>
                      <button onClick={async () => { if (confirm('¿Eliminar equipo?')) { await abpApi.deleteTeam(t.id); load() } }} title="Eliminar equipo" className="text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <p className="text-xs taller-muted mt-0.5">Fase {t.currentPhase}: {phaseName(t.currentPhase)} · ⭐ {t.xp} XP</p>
                  {t.identityState === 'RENAME_PENDING' && (
                    <div className="mt-2 p-2 rounded-lg text-xs" style={{ background: 'color-mix(in srgb, var(--t-marigold) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--t-marigold) 28%, var(--t-line))' }}>
                      <div style={{ color: 'var(--t-marigold)' }}>✏️ El equipo pide llamarse <b>“{t.proposedName}”</b></div>
                      <div className="flex gap-2 mt-1.5">
                        <button onClick={async () => { await abpApi.resolveTeamRename(t.id, true); load() }} className="font-semibold" style={{ color: 'var(--t-teal)' }}>✓ Aprobar</button>
                        <button onClick={async () => { await abpApi.resolveTeamRename(t.id, false); load() }} className="font-semibold text-rose-500 hover:text-rose-600">✕ Rechazar</button>
                      </div>
                    </div>
                  )}
                  <div className="my-2"><Trail team={t} mini /></div>
                  <div className="text-xs taller-soft line-clamp-1">{(t.members || []).map((m: any) => `${m.studentEnrollment?.student?.user?.firstName ?? ''}`).filter(Boolean).join(', ')}</div>
                  <button onClick={() => setPreviewTeamId(t.id)} className="mt-3 w-full text-sm font-semibold taller-mari rounded-lg py-1.5" style={{ border: '1px solid color-mix(in srgb, var(--t-marigold) 30%, var(--t-line))' }}>Ver expedición →</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 📢 / 📚 ───────────────────────────────────────────────────────── */}
      {tab === 'announcements' && <AnnouncementsView projectId={projectId} canManage />}
      {tab === 'resources' && <ResourcesView projectId={projectId} canManage />}

      {broadcasting && <BroadcastMissionModal projectId={projectId} onClose={() => setBroadcasting(false)} onDone={(count) => { setBroadcasting(false); alert(`Misión liberada a ${count} equipo(s).`); load() }} />}

      {editTeamId && <EditTeamMembers team={teams.find((t: any) => t.id === editTeamId)} classroomId={classroomId} projectId={projectId} onClose={() => setEditTeamId(null)} onChanged={load} />}

      {/* SIDE PEEK MANUAL DE EXPEDICIÓN */}
      {showManual && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowManual(false)} />
          <div className="relative w-full max-w-lg bg-slate-50 h-full shadow-2xl overflow-y-auto border-l border-slate-200 animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-200 px-5 py-3 flex items-center justify-between z-10">
              <div>
                <h3 className="font-black text-slate-800">👁️ Así lo ven tus estudiantes</h3>
                <p className="text-xs text-slate-400">Vista previa de la portada de la expedición</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => { setShowManual(false); setEditingPres(true) }} className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700">✏️ Editar</button>
                <button onClick={() => setShowManual(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold">✕</button>
              </div>
            </div>
            <div className="p-5">
              {project?.presentation || project?.challenge
                ? <PresentationView project={project} />
                : (
                  <div className="text-center py-12">
                    <p className="text-slate-500 text-sm mb-4">Aún no has creado la portada de esta expedición. Tus estudiantes verán una pantalla vacía.</p>
                    <button onClick={() => { setShowManual(false); setEditingPres(true) }} className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-bold">Crear portada ahora</button>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


function CreateTeam({ classroomId, projectId, onCreated }: { classroomId: string; projectId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [roster, setRoster] = useState<{ enrollmentId: string; name: string; assignedTeamName: string | null }[]>([])
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🚀')
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [letStudents, setLetStudents] = useState(false)

  // Recarga el roster cada vez que se abre el panel (y al cambiar de proyecto),
  // para que los alumnos ya asignados a un equipo salgan marcados y no se puedan
  // volver a seleccionar.
  useEffect(() => { if (open) abpApi.roster(classroomId, projectId).then(({ data }) => setRoster(data)) }, [open, classroomId, projectId])

  const create = async () => {
    if ((!name.trim() && !letStudents) || sel.size === 0) return
    setBusy(true)
    try { await abpApi.createTeam({ projectId, name: name.trim(), emoji, memberEnrollmentIds: [...sel], letStudentsName: letStudents }); setName(''); setSel(new Set()); setLetStudents(false); setOpen(false); onCreated() }
    catch (e: any) { alert(e?.response?.data?.message || 'No se pudo crear el equipo') }
    finally { setBusy(false) }
  }

  if (!open) return <button onClick={() => setOpen(true)} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200"><Plus className="w-5 h-5" /> Armar equipo</button>
  return (
    <div className="bg-white rounded-2xl border-2 border-violet-200 p-5 space-y-3">
      <h4 className="font-bold text-slate-800">Nuevo equipo</h4>
      <div className="flex gap-2">
        <input value={emoji} onChange={e => setEmoji(e.target.value)} disabled={letStudents} className="w-14 border border-slate-300 rounded-xl px-2 py-2.5 text-center text-lg disabled:opacity-50" maxLength={2} />
        <input value={name} onChange={e => setName(e.target.value)} disabled={letStudents} placeholder={letStudents ? 'Lo elegirán los estudiantes' : 'Nombre del equipo'} className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm disabled:opacity-50" autoFocus />
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
        <input type="checkbox" checked={letStudents} onChange={e => setLetStudents(e.target.checked)} className="accent-violet-600" />
        Dejar que el equipo elija su nombre y emblema (ritual de fundación)
      </label>
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1.5">Integrantes ({sel.size})</p>
        <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl p-2 grid sm:grid-cols-2 gap-1">
          {roster.map(r => {
            const taken = !!r.assignedTeamName
            return (
              <label key={r.enrollmentId} title={taken ? `Ya está en ${r.assignedTeamName}` : undefined} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${taken ? 'opacity-50 cursor-not-allowed text-slate-400' : sel.has(r.enrollmentId) ? 'bg-violet-50 text-violet-700 cursor-pointer' : 'hover:bg-slate-50 text-slate-600 cursor-pointer'}`}>
                <input type="checkbox" disabled={taken} checked={sel.has(r.enrollmentId)} onChange={() => { if (taken) return; setSel(s => { const n = new Set(s); n.has(r.enrollmentId) ? n.delete(r.enrollmentId) : n.add(r.enrollmentId); return n }) }} className="accent-violet-600 disabled:cursor-not-allowed" />
                <span className="flex-1 truncate">{r.name}</span>
                {taken && <span className="text-[10px] font-medium text-slate-400 shrink-0">{r.assignedTeamName}</span>}
              </label>
            )
          })}
          {roster.length === 0 && <p className="text-xs text-slate-400 p-2">Cargando matriculados…</p>}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl">Cancelar</button>
        <button onClick={create} disabled={(!name.trim() && !letStudents) || sel.size === 0 || busy} className="px-5 py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center gap-2">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Crear equipo</button>
      </div>
    </div>
  )
}

// Editar integrantes de un equipo YA creado: sacar/meter estudiantes.
function EditTeamMembers({ team, classroomId, projectId, onClose, onChanged }: { team: any; classroomId: string; projectId: string; onClose: () => void; onChanged: () => void }) {
  const [roster, setRoster] = useState<{ enrollmentId: string; name: string; assignedTeamName: string | null }[]>([])
  const [busy, setBusy] = useState(false)

  const reloadRoster = () => abpApi.roster(classroomId, projectId).then(({ data }) => setRoster(data))
  useEffect(() => { reloadRoster() }, [classroomId, projectId])

  if (!team) return null
  const members = teamMembers(team)
  const available = roster.filter(r => !r.assignedTeamName)

  const add = async (enrollmentId: string) => {
    setBusy(true)
    try { await abpApi.addTeamMember(team.id, enrollmentId); await reloadRoster(); onChanged() }
    catch (e: any) { alert(e?.response?.data?.message || 'No se pudo añadir') }
    finally { setBusy(false) }
  }
  const remove = async (enrollmentId: string) => {
    if (members.length <= 1) { alert('El equipo debe tener al menos un integrante.'); return }
    setBusy(true)
    try { await abpApi.removeTeamMember(team.id, enrollmentId); await reloadRoster(); onChanged() }
    catch (e: any) { alert(e?.response?.data?.message || 'No se pudo sacar') }
    finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">{team.emoji} {team.name} · Integrantes</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold">✕</button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">En el equipo ({members.length})</p>
            <div className="space-y-1">
              {members.map(m => (
                <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-violet-50 text-violet-800 text-sm">
                  <span className="truncate">{m.name}</span>
                  <button onClick={() => remove(m.id)} disabled={busy || members.length <= 1} title={members.length <= 1 ? 'El equipo no puede quedar vacío' : 'Sacar del equipo'} className="text-violet-300 hover:text-rose-500 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1.5">Disponibles para añadir ({available.length})</p>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {available.map(r => (
                <div key={r.enrollmentId} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-600 text-sm">
                  <span className="truncate">{r.name}</span>
                  <button onClick={() => add(r.enrollmentId)} disabled={busy} className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 disabled:opacity-40 shrink-0"><Plus className="w-4 h-4" /> Añadir</button>
                </div>
              ))}
              {available.length === 0 && <p className="text-xs text-slate-400 p-2">No hay estudiantes sin equipo en este proyecto.</p>}
            </div>
          </div>
        </div>
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
