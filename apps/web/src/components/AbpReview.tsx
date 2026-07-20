import { useCallback, useEffect, useState } from 'react'
import { Check, Loader2, Send, ChevronLeft } from 'lucide-react'
import { abpApi } from '../lib/api'

const PHASE_META = [
  { icon: '🧭', name: 'El Reto' }, { icon: '⚡', name: 'Tormenta de Ideas' }, { icon: '🎯', name: 'Objetivos' },
  { icon: '🛠️', name: 'Plan de Acción' }, { icon: '🚀', name: 'Prototipo' }, { icon: '🏆', name: 'Socialización' },
]
const CANVAS_Q = ['🔍 ¿Qué está pasando?', '👥 ¿A quiénes afecta?', '⭐ ¿Por qué es importante?', '⚠️ ¿Qué pasa si nadie lo resuelve?']
const KANBAN = ['Por hacer', 'En proceso', 'Hecho']

// Trabajo del equipo en modo LECTURA (según la fase).
function PhaseWork({ phase, data }: { phase: number; data: any }) {
  if (phase === 1) {
    const canvas = data.canvas || []
    return <div className="grid sm:grid-cols-2 gap-3">{CANVAS_Q.map((q, i) => (
      <div key={i} className="border border-slate-200 rounded-xl p-3">
        <h4 className="text-xs font-bold text-violet-600 mb-1.5">{q}</h4>
        <p className="text-sm text-slate-700">{canvas[i]?.value || <span className="text-slate-300">— sin completar —</span>}</p>
        {canvas[i]?.byName && <p className="text-xs text-slate-400 mt-2">✍️ {canvas[i].byName}</p>}
      </div>
    ))}</div>
  }
  if (phase === 2) {
    const ideas = data.ideas || []; const max = ideas.reduce((m: number, i: any) => Math.max(m, i.votes || 0), 0)
    return <div className="grid sm:grid-cols-2 gap-2">{ideas.map((i: any) => (
      <div key={i.id} className={`rounded-lg border p-2.5 text-sm ${(i.votes || 0) === max && max > 0 ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200'}`}>
        <div className="text-slate-700">{i.text}</div>
        <div className="text-xs text-slate-400 mt-1 flex justify-between"><span>— {i.byName}</span><span>👍 {i.votes || 0}</span></div>
      </div>
    ))}</div>
  }
  if (phase === 3) {
    const s = data.smart || {}
    return <div><div className="border border-slate-200 rounded-xl p-3 mb-2 text-sm text-slate-700">{s.text || <span className="text-slate-300">— sin objetivo —</span>}</div>
      <div className="flex flex-wrap gap-1.5">{['S', 'M', 'A', 'R', 'T'].map((k, i) => (
        <span key={k} className={`text-xs font-bold rounded-lg px-2.5 py-1 ${s.checks?.[i] ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{k}</span>
      ))}</div></div>
  }
  if (phase === 4) {
    const tasks = data.tasks || []
    return <div className="grid sm:grid-cols-3 gap-2">{KANBAN.map((c, ci) => (
      <div key={ci} className="bg-slate-50 rounded-xl p-2.5">
        <h5 className="text-xs font-bold text-slate-600 mb-1.5">{c}</h5>
        {tasks.filter((t: any) => t.col === ci).map((t: any) => (
          <div key={t.id} className="bg-white rounded-lg p-2 text-xs mb-1.5 shadow-sm"><div className={ci === 2 ? 'line-through text-slate-400' : 'text-slate-700'}>{t.text}</div><div className="text-slate-400 mt-0.5">👤 {t.ownerName}</div></div>
        ))}
      </div>
    ))}</div>
  }
  if (phase === 5) {
    const ev = data.evidences || []
    return <div className="space-y-1.5">{ev.map((e: any) => (
      <div key={e.id} className="flex items-center gap-2 border border-slate-200 rounded-lg p-2 text-sm">
        <span>{e.kind === 'FILE' ? '📎' : '🔗'}</span><a href={e.url} target="_blank" rel="noreferrer" className="flex-1 text-violet-600 hover:underline truncate">{e.label}</a><span className="text-xs text-slate-400">{e.byName}</span>
      </div>
    ))}</div>
  }
  if (phase === 6) {
    const co = data.coevals || {}; const keys = Object.keys(co)
    return keys.length === 0 ? <p className="text-sm text-slate-400">Sin coevaluaciones aún.</p> : <div className="space-y-1.5">{keys.map(k => (
      <div key={k} className="flex items-center justify-between border border-slate-200 rounded-lg p-2 text-sm"><span className="text-slate-600">Equipo evaluado</span><span className="font-mono text-xs text-violet-600">{(co[k].scores || []).join(' · ')}</span></div>
    ))}</div>
  }
  return null
}

export default function AbpReview({ validationId, onClose }: { validationId: string; onClose: (changed?: boolean) => void }) {
  const [r, setR] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [scores, setScores] = useState<number[]>([])
  const [rubricComment, setRubricComment] = useState('')
  const [returning, setReturning] = useState(false)
  const [feedback, setFeedback] = useState('')
  // Misiones que el docente adjunta al devolver (se crean en esta estación).
  const [newMissions, setNewMissions] = useState<{ title: string; kind: 'NONE' | 'FILE' | 'LINK' | 'TEXT' }[]>([])
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    abpApi.getReview(validationId).then(({ data }) => { setR(data); setScores((data.rubricCriteria || []).map(() => 0)) }).finally(() => setLoading(false))
  }, [validationId])
  useEffect(() => { load() }, [load])

  const rubricComplete = scores.length > 0 && scores.every(s => s >= 1)

  const approve = async () => {
    if (!rubricComplete || busy) return
    setBusy(true)
    try { await abpApi.resolve(validationId, { action: 'approve', rubricScores: scores, rubricComment }); onClose(true) }
    catch (e: any) { alert(e?.response?.data?.message || 'Error') } finally { setBusy(false) }
  }
  const doReturn = async () => {
    setBusy(true)
    const missions = newMissions.filter(m => m.title.trim()).map(m => ({
      title: m.title.trim(), required: true,
      deliverableKind: m.kind === 'NONE' ? undefined : m.kind,
    }))
    try { await abpApi.resolve(validationId, { action: 'return', feedback, missions }); onClose(true) }
    catch (e: any) { alert(e?.response?.data?.message || 'No se pudo devolver') }
    finally { setBusy(false) }
  }
  const addComment = async () => {
    if (!comment.trim() || busy) return
    setBusy(true)
    try { await abpApi.addComment(r.team.id, { phase: r.phase, refType: 'PHASE', content: comment.trim() }); setComment(''); load() } finally { setBusy(false) }
  }
  const toggleResolve = async (c: any) => { await abpApi.resolveComment(c.id, !c.resolved); load() }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-100 overflow-y-auto">
      {loading || !r ? (
        <div className="flex justify-center items-center h-full"><Loader2 className="w-8 h-8 animate-spin text-violet-500" /></div>
      ) : (
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          <button onClick={() => onClose(false)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3"><ChevronLeft className="w-4 h-4" /> Volver a la cola</button>

          {/* Cabecera */}
          <div className="flex items-start gap-4 flex-wrap mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 grid place-items-center text-2xl">{r.team.emoji}</div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">{r.team.name}</h2>
                <p className="text-sm text-slate-500">{r.team.problem || 'Sin reto definido'} · {r.team.members.join(', ')}</p>
              </div>
            </div>
            <span className="ml-auto text-xs font-bold bg-amber-100 text-amber-700 rounded-full px-3 py-1.5">⏳ Revisando Fase {r.phase}: {PHASE_META[r.phase - 1]?.name}</span>
          </div>

          <div className="grid lg:grid-cols-[1fr_340px] gap-4 items-start">
            {/* Trabajo del equipo + comentarios */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-bold text-slate-800 mb-3">{PHASE_META[r.phase - 1]?.icon} Trabajo del equipo</h3>
                <PhaseWork phase={r.phase} data={r.phaseData} />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <h3 className="font-bold text-slate-800 mb-3">Comentarios</h3>
                <div className="space-y-2.5 mb-3">
                  {(r.comments || []).length === 0 && <p className="text-sm text-slate-400">Sin comentarios. Deja retroalimentación puntual para el equipo.</p>}
                  {(r.comments || []).map((c: any) => (
                    <div key={c.id} className="flex gap-2.5">
                      <div className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold text-white flex-none ${c.authorRole === 'DOCENTE' ? 'bg-violet-500' : 'bg-emerald-500'}`}>{c.authorName?.[0] || '?'}</div>
                      <div className="flex-1 bg-slate-50 rounded-xl px-3 py-2">
                        <div className="text-xs font-bold text-slate-700">{c.authorName} <span className="font-medium text-slate-400">· {c.authorRole === 'DOCENTE' ? 'Docente' : 'Estudiante'}</span></div>
                        <div className="text-sm text-slate-700">{c.content}</div>
                        <button onClick={() => toggleResolve(c)} className={`text-[11px] font-semibold mt-1 ${c.resolved ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}>{c.resolved ? '✓ Resuelto' : 'Marcar resuelto'}</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addComment() }} placeholder="Comentar para el equipo…" className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                  <button onClick={addComment} disabled={!comment.trim() || busy} className="px-3 bg-violet-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"><Send className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            {/* Decisión */}
            <div className="space-y-4 lg:sticky lg:top-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-800 mb-2 text-sm">Criterios automáticos</h3>
                {(r.criteria || []).map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm py-1">
                    <span className={`w-5 h-5 rounded grid place-items-center text-xs font-bold flex-none ${c.met ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>{c.met ? '✓' : '!'}</span>
                    <span className="text-slate-600">{c.label}</span>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-800 mb-1 text-sm">Rúbrica de cierre <span className="font-medium text-slate-400">· 1–4</span></h3>
                {(r.rubricCriteria || []).map((label: string, i: number) => (
                  <div key={i} className="py-2 border-b border-slate-100 last:border-0">
                    <div className="text-sm font-medium text-slate-700 mb-1.5 flex justify-between">{label}<span className="font-mono text-xs text-violet-600">{scores[i] ? `${scores[i]}/4` : '—'}</span></div>
                    <div className="flex gap-1.5">{[1, 2, 3, 4].map(n => (
                      <button key={n} onClick={() => setScores(s => { const x = [...s]; x[i] = n; return x })}
                        className={`flex-1 h-9 rounded-lg border-2 text-sm font-bold ${scores[i] === n ? 'bg-violet-600 border-violet-600 text-white' : 'border-slate-200 text-slate-400 hover:border-violet-300'}`}>{n}</button>
                    ))}</div>
                  </div>
                ))}
                <textarea value={rubricComment} onChange={e => setRubricComment(e.target.value)} placeholder="Comentario de la valoración (opcional)…" rows={2} className="w-full mt-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
                <button onClick={approve} disabled={!rubricComplete || busy} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-2">
                  {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />} Aprobar y desbloquear{r.phase < 6 ? ' Fase ' + (r.phase + 1) : ''}
                </button>
                {!rubricComplete && <p className="text-xs text-amber-600 text-center font-semibold">Puntúa los {r.rubricCriteria?.length || 3} criterios para aprobar</p>}
                <button onClick={() => setReturning(v => !v)} className="w-full py-3 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100">↩ Devolver con retroalimentación</button>
                {returning && (
                  <div className="space-y-2 pt-1">
                    <textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Explica qué debe corregir el equipo…" rows={2} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none" />

                    {/* Devolver CON misiones: se crean en esta estación y la compuerta las exigirá */}
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Misiones antes de aprobar (opcional)</div>
                      {newMissions.map((m, i) => (
                        <div key={i} className="space-y-1.5 rounded-lg bg-white border border-slate-200 p-2">
                          <div className="flex gap-1.5">
                            <input value={m.title} onChange={e => setNewMissions(ms => ms.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                              placeholder="Qué deben hacer…" className="flex-1 border border-slate-200 rounded-md px-2 py-1 text-sm" />
                            <button onClick={() => setNewMissions(ms => ms.filter((_, j) => j !== i))} className="text-slate-300 hover:text-rose-500 px-1">✕</button>
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {([['NONE', 'Trabajo libre'], ['FILE', '📎 Archivo'], ['LINK', '🔗 Enlace'], ['TEXT', '📝 Texto']] as const).map(([k, label]) => (
                              <button key={k} onClick={() => setNewMissions(ms => ms.map((x, j) => j === i ? { ...x, kind: k } : x))}
                                className="text-[11px] rounded-md px-2 py-1 border transition"
                                style={m.kind === k ? { background: '#EEF2FF', borderColor: '#6366F1', color: '#4338CA', fontWeight: 700 } : { background: 'white', borderColor: '#E2E8F0', color: '#64748B' }}>
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      <button onClick={() => setNewMissions(ms => [...ms, { title: '', kind: 'NONE' }])} className="text-xs font-semibold text-violet-600 hover:text-violet-700">+ Añadir misión</button>
                      {newMissions.length > 0 && <p className="text-[11px] text-slate-400">Serán obligatorias: el equipo no podrá volver a presentar sin cumplirlas.</p>}
                    </div>

                    <button onClick={doReturn} disabled={busy} className="w-full py-2.5 bg-rose-600 text-white font-bold rounded-lg text-sm disabled:opacity-50">
                      Devolver al equipo{newMissions.filter(m => m.title.trim()).length > 0 ? ` con ${newMissions.filter(m => m.title.trim()).length} misión(es)` : ''}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
