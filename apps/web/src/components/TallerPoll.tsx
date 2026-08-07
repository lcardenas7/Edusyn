import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '../lib/toast'
import { confirmDialog } from './ui/confirm'
import { Loader2, Trash2, MessageCircle, Plus, X, Trophy } from 'lucide-react'
import { tallerApi } from '../lib/api'

// ═══════════════════════════════════════════════════════════════════════════
// EL TALLER — Motor POLL · dinámica VOTACIÓN. El equipo pone las opciones sobre
// la mesa y decide votando. Cada opción es un Objeto (Decision) y cada voto es
// un objeto Vote + arista 'vota' del núcleo — la misma mecánica que el muro,
// pero aquí SÍ puedes votar tu propia propuesta (si no, quien propone pierde).
// Voto por aprobación: puedes apoyar varias opciones, una vez cada una.
// ═══════════════════════════════════════════════════════════════════════════

const BAR_COLORS = ['#C8811A', '#7BA05B', '#5B84A0', '#B06A5B', '#8A6BA0']

export default function TallerPoll({ teamId, dynamic = 'VOTACION', stationId }: { teamId: string; dynamic?: string; stationId?: string }) {
  const [inst, setInst] = useState<any>(null)
  const [objects, setObjects] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const [commentsFor, setCommentsFor] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const busyRef = useRef(false)

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true)
    try {
      let instrument = inst
      if (!instrument) {
        instrument = (await tallerApi.resolveInstrument({ teamId, motor: 'POLL', dynamic, stationId, title: 'Votación' })).data
        setInst(instrument)
      }
      const { data: st } = await tallerApi.instrumentState(instrument.id)
      setMe(st.me); setObjects(st.objects)
    } catch { /* el próximo poll reintenta */ }
    finally { if (!background) setLoading(false) }
  }, [teamId, inst])

  useEffect(() => { load() }, [teamId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => { if (!busyRef.current) load(true) }, 4000)
    return () => clearInterval(t)
  }, [load])

  const addOption = async () => {
    const t = text.trim()
    if (!t || !inst || adding) return
    setAdding(true); busyRef.current = true
    try { await tallerApi.createObject(inst.id, { type: 'Decision', text: t }); setText(''); await load(true) }
    catch (e: any) { toast.error(e?.response?.data?.message || 'No se pudo agregar la opción') }
    finally { setAdding(false); busyRef.current = false }
  }
  const vote = async (o: any) => {
    busyRef.current = true
    setObjects(prev => prev.map(x => x.id === o.id ? { ...x, iVoted: !x.iVoted, votes: x.votes + (x.iVoted ? -1 : 1) } : x))
    try { await tallerApi.toggleVote(o.id) } catch (e: any) { toast.error(e?.response?.data?.message || 'No se pudo votar') }
    finally { busyRef.current = false; load(true) }
  }
  const remove = async (o: any) => {
    if (!(await confirmDialog('¿Quitar esta opción? (queda en la memoria del proyecto)', { danger: true }))) return
    try { await tallerApi.deleteObject(o.id); await load(true) } catch { toast.error('No se pudo quitar') }
  }
  const sendComment = async () => {
    const t = commentText.trim()
    if (!t || !commentsFor) return
    try { await tallerApi.addComment(commentsFor, t); setCommentText(''); await load(true) } catch { toast.error('No se pudo comentar') }
  }

  if (loading) return <div className="taller-card p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--t-marigold)' }} /></div>

  const total = objects.reduce((s, o) => s + (o.votes || 0), 0)
  const max = Math.max(...objects.map(o => o.votes || 0), 0)
  const ordenadas = [...objects].sort((a, b) => (b.votes || 0) - (a.votes || 0))
  const misVotos = objects.filter(o => o.iVoted).length
  const commentsObj = commentsFor ? objects.find(o => o.id === commentsFor) : null
  const mine = (o: any) => me?.enrollmentId && o.authorId === me.enrollmentId

  return (
    <div className="taller-card overflow-hidden">
      <div className="p-4 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--t-line)' }}>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest taller-mari">Motor Poll · Votación</div>
          <div className="font-black taller-ink">🗳️ Decidamos entre todos</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addOption()}
            placeholder="Escribe una opción…" maxLength={300}
            className="px-3 py-2 rounded-xl text-sm w-56" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
          <button onClick={addOption} disabled={adding || !text.trim()} className="taller-cta px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-1">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Opción
          </button>
        </div>
      </div>

      <div className="px-4 py-2 text-xs font-semibold" style={{ background: 'color-mix(in srgb, var(--t-marigold) 8%, var(--t-surface))', color: '#8a5a10', borderBottom: '1px solid var(--t-line)' }}>
        Pongan las opciones sobre la mesa y apoyen las que les convenzan. Pueden votar varias — incluso la propia. Lo importante es conversar por qué.
      </div>

      <div className="p-4 max-h-[520px] overflow-y-auto">
        {objects.length === 0 ? (
          <p className="text-sm taller-muted text-center py-10">Aún no hay opciones. Escriban la primera para empezar a decidir 🗳️</p>
        ) : (
          <div className="space-y-2.5">
            {ordenadas.map((o, i) => {
              const votos = o.votes || 0
              const pct = total > 0 ? Math.round((votos / total) * 100) : 0
              const lider = max > 0 && votos === max
              return (
                <div key={o.id} className="rounded-xl p-3" style={{
                  background: 'var(--t-surface)',
                  border: `1px solid ${lider ? 'color-mix(in srgb, var(--t-marigold) 45%, transparent)' : 'var(--t-line)'}`,
                }}>
                  <div className="flex items-start gap-2.5">
                    <button onClick={() => vote(o)} disabled={me?.role !== 'student'}
                      className="shrink-0 px-3 py-2 rounded-xl font-bold text-sm transition disabled:opacity-40"
                      style={o.iVoted
                        ? { background: 'color-mix(in srgb, var(--t-marigold) 22%, transparent)', color: '#8a5a10', border: '1px solid color-mix(in srgb, var(--t-marigold) 50%, transparent)' }
                        : { background: 'var(--t-raised)', color: 'var(--t-soft)', border: '1px solid var(--t-line)' }}
                      title={o.iVoted ? 'Quitar mi apoyo' : 'Apoyar esta opción'}>
                      ⭐ {votos}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold taller-ink">{o.data?.text}</p>
                        {lider && votos > 0 && <Trophy className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--t-marigold)' }} />}
                      </div>
                      {/* barra de resultados */}
                      <div className="h-2 rounded-full mt-1.5 overflow-hidden" style={{ background: 'color-mix(in srgb, var(--t-line) 60%, transparent)' }}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[10px] taller-muted font-semibold">
                        <span>{pct}% · propuesta por {o.authorName ?? '—'}</span>
                        <span className="ml-auto flex items-center gap-1.5 shrink-0">
                          <button onClick={() => { setCommentsFor(o.id); setCommentText('') }} className="hover:opacity-70" title="Comentar">
                            <MessageCircle className="w-3.5 h-3.5" />{(o.comments?.length ?? 0) > 0 ? ` ${o.comments.length}` : ''}
                          </button>
                          {(mine(o) || me?.role === 'teacher') && <button onClick={() => remove(o)} className="hover:opacity-70" title="Quitar"><Trash2 className="w-3.5 h-3.5" /></button>}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="px-4 py-2 text-[10px] font-mono taller-muted flex items-center gap-2" style={{ borderTop: '1px solid var(--t-line)' }}>
        <span>{objects.length} opciones · {total} apoyo{total === 1 ? '' : 's'}</span>
        {me?.role === 'student' && <><span>·</span><span>apoyaste {misVotos}</span></>}
        <span className="ml-auto">🏆 la más apoyada lidera</span>
      </div>

      {commentsObj && (
        <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-4" onClick={() => setCommentsFor(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="taller-card relative max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <button onClick={() => setCommentsFor(null)} className="absolute top-3 right-3 taller-muted hover:opacity-70"><X className="w-4 h-4" /></button>
            <div className="text-[10px] font-mono uppercase tracking-widest taller-mari mb-1">¿Por qué esta opción?</div>
            <div className="rounded-lg p-3 text-sm font-medium mb-3" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }}>{commentsObj.data?.text}</div>
            <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
              {(commentsObj.comments ?? []).length === 0 && <p className="text-sm taller-muted">Sin argumentos aún 💬</p>}
              {(commentsObj.comments ?? []).map((c: any) => (
                <div key={c.id} className="text-sm"><span className="font-bold taller-ink">{c.authorName ?? '—'}:</span> <span className="taller-soft">{c.data?.text}</span></div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendComment()}
                placeholder="Explica por qué…" maxLength={400} autoFocus
                className="flex-1 px-3 py-2 rounded-xl text-sm" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
              <button onClick={sendComment} disabled={!commentText.trim()} className="taller-cta px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50">Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
