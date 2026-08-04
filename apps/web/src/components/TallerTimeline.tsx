import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '../lib/toast'
import { confirmDialog } from './ui/confirm'
import { Loader2, Trash2, MessageCircle, Pencil, Plus, X } from 'lucide-react'
import { tallerApi } from '../lib/api'

// ═══════════════════════════════════════════════════════════════════════════
// EL TALLER — Motor TIMELINE · dinámica LÍNEA DE TIEMPO. El equipo construye
// la cronología del proyecto: hechos, hallazgos y entregas con fecha, ordenados
// sobre un eje vertical. Cada hito es un Objeto Universal (Note con data.date):
// misma memoria, mismo grafo, mismos permisos que el resto del Taller.
// ═══════════════════════════════════════════════════════════════════════════

const DOT_COLORS = ['#C8811A', '#7BA05B', '#5B84A0', '#B06A5B', '#8A6BA0']

export default function TallerTimeline({ teamId, dynamic = 'LINEA_TIEMPO', stationId }: { teamId: string; dynamic?: string; stationId?: string }) {
  const [inst, setInst] = useState<any>(null)
  const [objects, setObjects] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [composerOpen, setComposerOpen] = useState(false)
  const [text, setText] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [sending, setSending] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [editDate, setEditDate] = useState('')
  const [commentsFor, setCommentsFor] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const busyRef = useRef(false)

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true)
    try {
      let instrument = inst
      if (!instrument) {
        instrument = (await tallerApi.resolveInstrument({ teamId, motor: 'TIMELINE', dynamic, stationId, title: 'Línea de tiempo' })).data
        setInst(instrument)
      }
      const { data: st } = await tallerApi.instrumentState(instrument.id)
      setMe(st.me); setObjects(st.objects)
    } catch { /* siguiente poll reintenta */ }
    finally { if (!background) setLoading(false) }
  }, [teamId, inst])

  useEffect(() => { load() }, [teamId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => { if (!composerOpen && !editingId && !busyRef.current) load(true) }, 4000)
    return () => clearInterval(t)
  }, [load, composerOpen, editingId])

  const events = [...objects].sort((a, b) => String(a.data?.date ?? '').localeCompare(String(b.data?.date ?? '')) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  const send = async () => {
    const t = text.trim()
    if (!t || !date || !inst || sending) return
    setSending(true); busyRef.current = true
    try {
      await tallerApi.createObject(inst.id, { type: 'Note', text: t, date })
      setText(''); setComposerOpen(false)
      await load(true)
    } catch { toast.error('No se pudo agregar el hito') }
    finally { setSending(false); busyRef.current = false }
  }
  const saveEdit = async () => {
    if (!editingId) return
    const o = objects.find(x => x.id === editingId)
    const t = editText.trim()
    if (!o || !t) { setEditingId(null); return }
    busyRef.current = true
    try { await tallerApi.updateObject(editingId, { text: t, date: editDate || undefined, version: o.version }); await load(true) }
    catch { toast.error('Conflicto al guardar; se recargó la línea'); await load(true) }
    finally { busyRef.current = false; setEditingId(null) }
  }
  const remove = async (o: any) => {
    if (!(await confirmDialog('¿Quitar este hito? (queda en la memoria del proyecto)', { danger: true }))) return
    try { await tallerApi.deleteObject(o.id); await load(true) } catch { toast.error('No se pudo quitar') }
  }
  const sendComment = async () => {
    const t = commentText.trim()
    if (!t || !commentsFor) return
    try { await tallerApi.addComment(commentsFor, t); setCommentText(''); await load(true) } catch { toast.error('No se pudo comentar') }
  }

  if (loading) return <div className="taller-card p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--t-marigold)' }} /></div>

  const commentsObj = commentsFor ? objects.find(o => o.id === commentsFor) : null
  const fmt = (d?: string) => {
    if (!d) return '—'
    const dt = new Date(d + 'T12:00:00')
    return dt.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="taller-card overflow-hidden">
      <div className="p-4 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--t-line)' }}>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest taller-mari">Motor Timeline · Línea de tiempo</div>
          <div className="font-black taller-ink">📅 La cronología del proyecto</div>
        </div>
        <button onClick={() => { setComposerOpen(true); setText('') }} className="taller-cta ml-auto px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1">
          <Plus className="w-4 h-4" /> Nuevo hito
        </button>
      </div>

      <div className="p-5 max-h-[520px] overflow-y-auto">
        {events.length === 0 ? (
          <p className="text-sm taller-muted text-center py-8">La cronología está vacía. Registren el primer hecho del proyecto 📍</p>
        ) : (
          <div className="relative pl-8">
            {/* el eje */}
            <div className="absolute left-[11px] top-2 bottom-2 w-[3px] rounded-full" style={{ background: 'color-mix(in srgb, var(--t-marigold) 30%, var(--t-line))' }} />
            <div className="space-y-4">
              {events.map((o, i) => {
                const mine = me?.enrollmentId && o.authorId === me.enrollmentId
                return (
                  <div key={o.id} className="relative">
                    {/* punto en el eje */}
                    <span className="absolute -left-8 top-1.5 w-[15px] h-[15px] rounded-full border-2"
                      style={{ background: DOT_COLORS[i % DOT_COLORS.length], borderColor: 'var(--t-raised)', boxShadow: 'var(--t-shadow-sm)' }} />
                    <div className="taller-card p-3" style={{ background: 'var(--t-surface)' }}>
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-lg shrink-0" style={{ background: 'color-mix(in srgb, var(--t-marigold) 14%, transparent)', color: '#8a5a10' }}>
                          {fmt(o.data?.date)}
                        </span>
                        <div className="min-w-0 flex-1">
                          {editingId === o.id ? (
                            <div className="space-y-2">
                              <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="px-2 py-1 rounded-lg text-xs" style={{ background: 'var(--t-raised)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
                              <textarea autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() } }}
                                className="w-full text-sm rounded-lg p-2 resize-none" rows={2} maxLength={500}
                                style={{ background: 'var(--t-raised)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
                              <button onClick={saveEdit} className="taller-cta text-xs font-bold px-3 py-1 rounded-lg">Guardar</button>
                            </div>
                          ) : (
                            <p className="text-sm font-semibold taller-ink whitespace-pre-wrap break-words">{o.data?.text}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-[10px] taller-muted font-semibold">
                            <span>{o.authorName ?? '—'}</span>
                            {(o.comments?.length ?? 0) > 0 && <span>· {o.comments.length}💬</span>}
                            <span className="ml-auto flex items-center gap-1">
                              <button onClick={() => { setCommentsFor(o.id); setCommentText('') }} className="hover:opacity-70" title="Comentar"><MessageCircle className="w-3.5 h-3.5" /></button>
                              {mine && editingId !== o.id && (
                                <button onClick={() => { setEditingId(o.id); setEditText(o.data?.text ?? ''); setEditDate(o.data?.date ?? '') }} className="hover:opacity-70" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                              )}
                              {(mine || me?.role === 'teacher') && (
                                <button onClick={() => remove(o)} className="hover:opacity-70" title="Quitar"><Trash2 className="w-3.5 h-3.5" /></button>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 py-2 text-[10px] font-mono taller-muted flex items-center gap-2" style={{ borderTop: '1px solid var(--t-line)' }}>
        <span>registren hechos, hallazgos y entregas con su fecha</span>
        <span className="ml-auto">se ordenan solos en el eje</span>
      </div>

      {/* compositor */}
      {composerOpen && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" onClick={() => setComposerOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="taller-card relative max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <button onClick={() => setComposerOpen(false)} className="absolute top-3 right-3 taller-muted hover:opacity-70"><X className="w-4 h-4" /></button>
            <div className="text-[10px] font-mono uppercase tracking-widest taller-mari mb-1">Nuevo hito de la cronología</div>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm mb-2" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
            <textarea autoFocus value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="¿Qué pasó? (ej: 'Entrevistamos a la coordinadora')" maxLength={500} rows={3}
              className="w-full px-3 py-2 rounded-xl text-sm resize-none" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
            <div className="flex justify-end mt-3">
              <button onClick={send} disabled={sending || !text.trim() || !date} className="taller-cta px-5 py-2 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-1">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Registrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* conversación */}
      {commentsObj && (
        <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-4" onClick={() => setCommentsFor(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="taller-card relative max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <button onClick={() => setCommentsFor(null)} className="absolute top-3 right-3 taller-muted hover:opacity-70"><X className="w-4 h-4" /></button>
            <div className="text-[10px] font-mono uppercase tracking-widest taller-mari mb-1">Conversación sobre el hito</div>
            <div className="rounded-lg p-3 text-sm font-medium mb-3" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }}>
              {fmt(commentsObj.data?.date)} · {commentsObj.data?.text}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
              {(commentsObj.comments ?? []).length === 0 && <p className="text-sm taller-muted">Sin comentarios aún 💬</p>}
              {(commentsObj.comments ?? []).map((c: any) => (
                <div key={c.id} className="text-sm"><span className="font-bold taller-ink">{c.authorName ?? '—'}:</span> <span className="taller-soft">{c.data?.text}</span></div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendComment()}
                placeholder="Escribe un comentario…" maxLength={400} autoFocus
                className="flex-1 px-3 py-2 rounded-xl text-sm" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
              <button onClick={sendComment} disabled={!commentText.trim()} className="taller-cta px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50">Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
