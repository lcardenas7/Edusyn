import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Trash2, Pencil, Plus, X, MessageCircle } from 'lucide-react'
import { tallerApi } from '../lib/api'
import { useIsMobile } from '../hooks/useIsMobile'

// ═══════════════════════════════════════════════════════════════════════════
// EL TALLER — Motor MATRIX · dinámica IMPACTO / ESFUERZO. Las ideas se colocan
// sobre dos ejes y el cuadrante habla solo: lo de mucho impacto y poco esfuerzo
// es lo que hay que hacer YA. Reutiliza x/y del núcleo (0–10000 → % del lienzo)
// y el arrastre del motor Board.
// ═══════════════════════════════════════════════════════════════════════════

const SIZE = 10000 // el núcleo acota x/y a 0..10000 → lo usamos como porcentaje fino
const CARD_W = 150
const CARD_H = 56

const QUADRANTS = [
  { key: 'ya', label: '✅ Háganlo ya', hint: 'Mucho impacto · poco esfuerzo', top: 0, left: 0, color: '#CFE6BE' },
  { key: 'proyecto', label: '🏗️ Gran proyecto', hint: 'Mucho impacto · mucho esfuerzo', top: 0, left: 50, color: '#FBE7A6' },
  { key: 'relleno', label: '🪶 Si sobra tiempo', hint: 'Poco impacto · poco esfuerzo', top: 50, left: 0, color: '#C4DBF3' },
  { key: 'descartar', label: '🚫 Mejor no', hint: 'Poco impacto · mucho esfuerzo', top: 50, left: 50, color: '#F6D3CE' },
]

// Centro de cada cuadrante (para colocar por toque en móvil, sin arrastre).
const QUAD_CENTER: Record<string, { x: number; y: number }> = {
  ya: { x: 2500, y: 2500 }, proyecto: { x: 7500, y: 2500 },
  relleno: { x: 2500, y: 7500 }, descartar: { x: 7500, y: 7500 },
}

export default function TallerMatrix({ teamId, dynamic = 'IMPACTO_ESFUERZO', stationId }: { teamId: string; dynamic?: string; stationId?: string }) {
  const isMobile = useIsMobile()
  const [inst, setInst] = useState<any>(null)
  const [objects, setObjects] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [commentsFor, setCommentsFor] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true)
    try {
      let instrument = inst
      if (!instrument) {
        instrument = (await tallerApi.resolveInstrument({ teamId, motor: 'MATRIX', dynamic, stationId, title: 'Matriz impacto / esfuerzo' })).data
        setInst(instrument)
      }
      const { data: st } = await tallerApi.instrumentState(instrument.id)
      setMe(st.me)
      setObjects(prev => st.objects.map((o: any) => dragRef.current?.id === o.id ? (prev.find(p => p.id === o.id) ?? o) : o))
    } catch { /* el próximo poll reintenta */ }
    finally { if (!background) setLoading(false) }
  }, [teamId, inst])

  useEffect(() => { load() }, [teamId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => { if (!dragRef.current && !editingId && !busyRef.current) load(true) }, 4000)
    return () => clearInterval(t)
  }, [load, editingId])

  const add = async () => {
    const t = text.trim()
    if (!t || !inst || adding) return
    setAdding(true); busyRef.current = true
    try {
      // nace en el centro: el equipo decide dónde va arrastrándola
      await tallerApi.createObject(inst.id, { type: 'Idea', text: t, x: Math.round(SIZE / 2), y: Math.round(SIZE / 2) })
      setText(''); await load(true)
    } catch (e: any) { alert(e?.response?.data?.message || 'No se pudo agregar') }
    finally { setAdding(false); busyRef.current = false }
  }

  // ── arrastre (porcentual sobre el lienzo) ──
  const onPointerDown = (e: React.PointerEvent, o: any) => {
    if (editingId) return
    const r = boardRef.current?.getBoundingClientRect()
    if (!r) return
    const px = ((o.data?.x ?? SIZE / 2) / SIZE) * r.width
    const py = ((o.data?.y ?? SIZE / 2) / SIZE) * r.height
    dragRef.current = { id: o.id, dx: e.clientX - r.left - px, dy: e.clientY - r.top - py }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    const r = boardRef.current?.getBoundingClientRect()
    if (!d || !r) return
    const px = Math.max(0, Math.min(r.width, e.clientX - r.left - d.dx))
    const py = Math.max(0, Math.min(r.height, e.clientY - r.top - d.dy))
    setDragPos({ id: d.id, x: Math.round((px / r.width) * SIZE), y: Math.round((py / r.height) * SIZE) })
  }
  const onPointerUp = async () => {
    const d = dragRef.current, pos = dragPos
    dragRef.current = null; setDragPos(null)
    if (!d || !pos || pos.id !== d.id) return
    setObjects(prev => prev.map(o => o.id === d.id ? { ...o, data: { ...o.data, x: pos.x, y: pos.y } } : o))
    try { await tallerApi.updateObject(d.id, { x: pos.x, y: pos.y }) } catch { load(true) }
  }

  const saveEdit = async () => {
    if (!editingId) return
    const o = objects.find(x => x.id === editingId)
    const t = editText.trim()
    if (!o || !t || t === o.data?.text) { setEditingId(null); return }
    busyRef.current = true
    try { await tallerApi.updateObject(editingId, { text: t, version: o.version }); await load(true) }
    catch { alert('Conflicto al guardar; se recargó la matriz'); await load(true) }
    finally { busyRef.current = false; setEditingId(null) }
  }
  const remove = async (o: any) => {
    if (!confirm('¿Quitar esta idea de la matriz? (queda en la memoria del proyecto)')) return
    try { await tallerApi.deleteObject(o.id); await load(true) } catch { alert('No se pudo quitar') }
  }
  const sendComment = async () => {
    const t = commentText.trim()
    if (!t || !commentsFor) return
    try { await tallerApi.addComment(commentsFor, t); setCommentText(''); await load(true) } catch { alert('No se pudo comentar') }
  }
  // Móvil: colocar en un cuadrante por toque (mueve x/y a su centro).
  const setQuad = async (o: any, key: string) => {
    const c = QUAD_CENTER[key]
    setObjects(prev => prev.map(x => x.id === o.id ? { ...x, data: { ...x.data, x: c.x, y: c.y } } : x))
    try { await tallerApi.updateObject(o.id, { x: c.x, y: c.y }) } catch { load(true) }
  }
  const currentQuadKey = (o: any) => {
    const x = o.data?.x ?? SIZE / 2, y = o.data?.y ?? SIZE / 2
    return y < SIZE / 2 ? (x < SIZE / 2 ? 'ya' : 'proyecto') : (x < SIZE / 2 ? 'relleno' : 'descartar')
  }

  if (loading) return <div className="taller-card p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--t-marigold)' }} /></div>

  const mine = (o: any) => me?.enrollmentId && o.authorId === me.enrollmentId
  const commentsObj = commentsFor ? objects.find(o => o.id === commentsFor) : null
  // cuadrante de una idea, para el resumen del pie
  const quadOf = (o: any) => {
    const x = o.data?.x ?? SIZE / 2, y = o.data?.y ?? SIZE / 2
    return QUADRANTS.find(q => (x >= (q.left / 100) * SIZE) === (q.left === 50) && (y >= (q.top / 100) * SIZE) === (q.top === 50))
  }
  const enYa = objects.filter(o => quadOf(o)?.key === 'ya').length

  return (
    <div className="taller-card overflow-hidden">
      <div className="p-4 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--t-line)' }}>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest taller-mari">Motor Matrix · Impacto / Esfuerzo</div>
          <div className="font-black taller-ink">📈 ¿Qué hacemos primero?</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Escribe una idea…" maxLength={300}
            className="px-3 py-2 rounded-xl text-sm w-52" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
          <button onClick={add} disabled={adding || !text.trim()} className="taller-cta px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-1">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Añadir
          </button>
        </div>
      </div>

      <div className="px-4 py-2 text-xs font-semibold" style={{ background: 'color-mix(in srgb, var(--t-marigold) 8%, var(--t-surface))', color: '#8a5a10', borderBottom: '1px solid var(--t-line)' }}>
        Arrastren cada idea: <b>arriba</b> = más impacto en el problema · <b>derecha</b> = más esfuerzo para hacerla. El cuadrante les dirá por dónde empezar.
      </div>

      {isMobile ? (
        /* MÓVIL: cada idea con selector de cuadrante por toque (sin arrastre). */
        <div className="p-3 space-y-3">
          {objects.length === 0 && (
            <div className="py-8 text-center taller-muted text-sm">Añadan ideas y elijan su cuadrante 📈</div>
          )}
          {objects.map(o => {
            const cur = currentQuadKey(o)
            return (
              <div key={o.id} className="rounded-xl p-3" style={{ background: 'var(--t-raised)', border: '1px solid var(--t-line)' }}>
                {editingId === o.id ? (
                  <textarea autoFocus value={editText} onChange={e => setEditText(e.target.value)} onBlur={saveEdit}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() } }}
                    className="w-full text-sm bg-transparent resize-none outline-none taller-ink" rows={2} maxLength={300} />
                ) : (
                  <p className="text-sm font-semibold taller-ink leading-snug break-words">{o.data?.text}</p>
                )}
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {QUADRANTS.map(q => (
                    <button key={q.key} onClick={() => setQuad(o, q.key)}
                      className="text-[11px] font-bold rounded-lg px-2 py-1.5 text-left leading-tight transition"
                      style={{ background: cur === q.key ? `color-mix(in srgb, ${q.color} 65%, var(--t-surface))` : 'var(--t-surface)', border: `1.5px solid ${cur === q.key ? '#4a4335' : 'var(--t-line)'}`, color: '#4a4335' }}>
                      {q.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2 text-[11px] taller-muted font-semibold">
                  <span className="truncate">{o.authorName ?? '—'}</span>
                  <span className="ml-auto flex items-center gap-2 shrink-0">
                    <button onClick={() => { setCommentsFor(o.id); setCommentText('') }} className="hover:opacity-70 flex items-center gap-0.5"><MessageCircle className="w-3.5 h-3.5" />{(o.comments?.length ?? 0) > 0 ? o.comments.length : ''}</button>
                    {mine(o) && editingId !== o.id && <button onClick={() => { setEditingId(o.id); setEditText(o.data?.text ?? '') }} className="hover:opacity-70"><Pencil className="w-3.5 h-3.5" /></button>}
                    {(mine(o) || me?.role === 'teacher') && <button onClick={() => remove(o)} className="hover:opacity-70"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
      <div className="p-4">
        <div className="flex gap-2">
          {/* eje Y */}
          <div className="flex flex-col items-center justify-between py-1 shrink-0" style={{ width: 22 }}>
            <span className="text-[10px] font-mono font-bold taller-muted" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>MÁS IMPACTO ↑</span>
          </div>

          <div className="flex-1 min-w-0">
            <div ref={boardRef} className="relative rounded-xl overflow-hidden select-none"
              style={{ aspectRatio: '1 / 0.72', border: '1px solid var(--t-line)' }}
              onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
              {/* cuadrantes */}
              {QUADRANTS.map(q => (
                <div key={q.key} className="absolute" style={{ top: `${q.top}%`, left: `${q.left}%`, width: '50%', height: '50%', background: `color-mix(in srgb, ${q.color} 30%, var(--t-surface))`, borderRight: q.left === 0 ? '1px dashed var(--t-line)' : undefined, borderBottom: q.top === 0 ? '1px dashed var(--t-line)' : undefined }}>
                  <div className="p-2">
                    <div className="text-[11px] font-black" style={{ color: '#4a4335' }}>{q.label}</div>
                    <div className="text-[9px] font-mono taller-muted">{q.hint}</div>
                  </div>
                </div>
              ))}

              {objects.length === 0 && (
                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                  <p className="text-sm taller-muted">Añadan ideas y arrástrenlas al cuadrante que les corresponde 📈</p>
                </div>
              )}

              {/* tarjetas */}
              {objects.map(o => {
                const pos = (dragPos && dragPos.id === o.id) ? dragPos : { x: o.data?.x ?? SIZE / 2, y: o.data?.y ?? SIZE / 2 }
                const arrastrando = dragPos?.id === o.id
                return (
                  <div key={o.id} className="absolute rounded-lg p-2 touch-none"
                    style={{
                      left: `calc(${(pos.x / SIZE) * 100}% - ${CARD_W / 2}px)`,
                      top: `calc(${(pos.y / SIZE) * 100}% - ${CARD_H / 2}px)`,
                      width: CARD_W, minHeight: CARD_H,
                      background: 'var(--t-raised)', border: '1px solid var(--t-line)',
                      boxShadow: arrastrando ? '0 10px 24px rgba(0,0,0,.18)' : 'var(--t-shadow-sm)',
                      cursor: editingId === o.id ? 'text' : 'grab', zIndex: arrastrando ? 30 : 2,
                    }}
                    onPointerDown={e => { if (editingId !== o.id) onPointerDown(e, o) }}
                    onDoubleClick={() => { if (mine(o)) { setEditingId(o.id); setEditText(o.data?.text ?? '') } }}>
                    {editingId === o.id ? (
                      <textarea autoFocus value={editText} onChange={e => setEditText(e.target.value)} onBlur={saveEdit}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() } }}
                        className="w-full text-[11px] bg-transparent resize-none outline-none taller-ink" rows={2} maxLength={300} />
                    ) : (
                      <p className="text-[11px] font-semibold taller-ink leading-snug break-words" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{o.data?.text}</p>
                    )}
                    <div className="flex items-center gap-1 mt-1 text-[9px] taller-muted font-semibold">
                      <span className="truncate">{o.authorName ?? '—'}</span>
                      <span className="ml-auto flex items-center gap-1 shrink-0">
                        <button onClick={e => { e.stopPropagation(); setCommentsFor(o.id); setCommentText('') }} className="hover:opacity-70">
                          <MessageCircle className="w-3 h-3" />{(o.comments?.length ?? 0) > 0 ? o.comments.length : ''}
                        </button>
                        {mine(o) && editingId !== o.id && <button onClick={e => { e.stopPropagation(); setEditingId(o.id); setEditText(o.data?.text ?? '') }} className="hover:opacity-70"><Pencil className="w-3 h-3" /></button>}
                        {(mine(o) || me?.role === 'teacher') && <button onClick={e => { e.stopPropagation(); remove(o) }} className="hover:opacity-70"><Trash2 className="w-3 h-3" /></button>}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            {/* eje X */}
            <div className="text-center mt-1"><span className="text-[10px] font-mono font-bold taller-muted">MÁS ESFUERZO →</span></div>
          </div>
        </div>
      </div>
      )}

      <div className="px-4 py-2 text-[10px] font-mono taller-muted flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid var(--t-line)' }}>
        <span>{objects.length} idea{objects.length === 1 ? '' : 's'}</span>
        {enYa > 0 && <><span>·</span><span style={{ color: '#4a6b34' }}>{enYa} para hacer ya</span></>}
        <span className="ml-auto hidden sm:inline">arrastra para ubicar · doble clic para editar la tuya</span>
      </div>

      {commentsObj && (
        <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-4" onClick={() => setCommentsFor(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="taller-card relative max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <button onClick={() => setCommentsFor(null)} className="absolute top-3 right-3 taller-muted hover:opacity-70"><X className="w-4 h-4" /></button>
            <div className="text-[10px] font-mono uppercase tracking-widest taller-mari mb-1">Conversación sobre la idea</div>
            <div className="rounded-lg p-3 text-sm font-medium mb-3" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }}>{commentsObj.data?.text}</div>
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
