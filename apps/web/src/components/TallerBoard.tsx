import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Trash2, MessageCircle, Pencil, Plus, X } from 'lucide-react'
import { tallerApi } from '../lib/api'

// ═══════════════════════════════════════════════════════════════════════════
// EL TALLER — Motor BOARD · dinámica BRAINSTORM (primer motor del Sistema
// Operativo de Colaboración). Todo lo que pasa aquí son Objetos Universales +
// Relaciones + Eventos del núcleo (tablas Taller*), NO el JSON del ABP legacy.
// v1: post-its, drag, votos (objeto Vote + arista 'vota'), comentarios
// (objeto Comment + arista 'responde-a'), edición del autor, live-sync.
// ═══════════════════════════════════════════════════════════════════════════

const STICKY = ['#FBE7A6', '#CFE6BE', '#C4DBF3', '#F6D3CE', '#DDD2F2']
const BOARD_W = 1600
const BOARD_H = 1000

export default function TallerBoard({ teamId, dynamic = 'BRAINSTORM', stationId, title = 'Tormenta de ideas', heading = '🧪 Muro de ideas del equipo' }: {
  teamId: string; dynamic?: string; stationId?: string; title?: string; heading?: string
}) {
  const [inst, setInst] = useState<any>(null)
  const [objects, setObjects] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [colorId, setColorId] = useState(0)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)   // objectId en edición
  const [editText, setEditText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [commentsFor, setCommentsFor] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null)

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true)
    try {
      let instrument = inst
      if (!instrument) {
        instrument = (await tallerApi.resolveInstrument({ teamId, motor: 'BOARD', dynamic, stationId, title })).data
        setInst(instrument)
      }
      const { data: st } = await tallerApi.instrumentState(instrument.id)
      setMe(st.me)
      // no pisar el post-it que estoy arrastrando o editando
      setObjects(prev => st.objects.map((o: any) => {
        if (dragRef.current?.id === o.id) return prev.find(p => p.id === o.id) ?? o
        return o
      }))
    } catch { /* red: el próximo poll reintenta */ }
    finally { if (!background) setLoading(false) }
  }, [teamId, inst])

  useEffect(() => { load() }, [teamId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live-sync (Capa 2): refresco suave cada 4s, pausado durante drag/edición.
  useEffect(() => {
    const t = setInterval(() => { if (!dragRef.current && !editing && !savingEdit) load(true) }, 4000)
    return () => clearInterval(t)
  }, [load, editing, savingEdit])

  // ─── Crear post-it ─────────────────────────────────────────────────────────
  const add = async () => {
    const t = text.trim()
    if (!t || !inst) return
    setAdding(true)
    try {
      // posición: cascada suave para que no se apilen exactos
      const n = objects.length
      const x = 40 + (n % 5) * 230 + Math.floor(Math.random() * 30)
      const y = 30 + Math.floor(n / 5) * 190 + Math.floor(Math.random() * 24)
      await tallerApi.createObject(inst.id, { text: t, colorId, x, y })
      setText('')
      await load(true)
    } catch { alert('No se pudo crear la nota. Intenta de nuevo.') }
    finally { setAdding(false) }
  }

  // ─── Drag (pointer events) ────────────────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent, o: any) => {
    if (editing) return
    const board = boardRef.current?.getBoundingClientRect()
    if (!board) return
    const scroll = boardRef.current!
    dragRef.current = {
      id: o.id,
      dx: e.clientX - board.left + scroll.scrollLeft - (o.data?.x ?? 0),
      dy: e.clientY - board.top + scroll.scrollTop - (o.data?.y ?? 0),
    }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    const board = boardRef.current?.getBoundingClientRect()
    if (!d || !board) return
    const scroll = boardRef.current!
    const x = Math.max(0, Math.min(BOARD_W - 210, e.clientX - board.left + scroll.scrollLeft - d.dx))
    const y = Math.max(0, Math.min(BOARD_H - 120, e.clientY - board.top + scroll.scrollTop - d.dy))
    setDragPos({ id: d.id, x, y })
  }
  const onPointerUp = async () => {
    const d = dragRef.current
    const pos = dragPos
    dragRef.current = null
    setDragPos(null)
    if (!d || !pos || pos.id !== d.id) return
    setObjects(prev => prev.map(o => o.id === d.id ? { ...o, data: { ...o.data, x: pos.x, y: pos.y } } : o))
    try { await tallerApi.updateObject(d.id, { x: pos.x, y: pos.y }) } catch { load(true) }
  }

  // ─── Editar texto (solo autor) ────────────────────────────────────────────
  const startEdit = (o: any) => {
    if (me?.role === 'student' && o.authorId && o.authorId !== me?.enrollmentId) return
    setEditing(o.id); setEditText(o.data?.text ?? '')
  }
  const saveEdit = async () => {
    if (!editing) return
    const t = editText.trim()
    const o = objects.find(x => x.id === editing)
    if (!o || t === (o.data?.text ?? '')) { setEditing(null); return }
    if (!t) { setEditing(null); return }
    setSavingEdit(true)
    try { await tallerApi.updateObject(editing, { text: t, version: o.version }); await load(true) }
    catch { alert('Conflicto o error al guardar; se recargó el muro.'); await load(true) }
    finally { setSavingEdit(false); setEditing(null) }
  }

  // ─── Voto / comentario / borrar ───────────────────────────────────────────
  const vote = async (o: any) => {
    if (busy) return
    setBusy(o.id)
    // optimista
    setObjects(prev => prev.map(x => x.id === o.id ? { ...x, iVoted: !x.iVoted, votes: x.votes + (x.iVoted ? -1 : 1) } : x))
    try { await tallerApi.toggleVote(o.id) } catch { }
    finally { setBusy(null); load(true) }
  }
  const remove = async (o: any) => {
    if (!confirm('¿Quitar esta nota? (queda guardada en la memoria del proyecto)')) return
    try { await tallerApi.deleteObject(o.id); await load(true) } catch { alert('No se pudo quitar') }
  }
  const sendComment = async () => {
    const t = commentText.trim()
    if (!t || !commentsFor) return
    try { await tallerApi.addComment(commentsFor, t); setCommentText(''); await load(true) } catch { alert('No se pudo comentar') }
  }

  if (loading) return <div className="taller-card p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--t-marigold)' }} /></div>

  const top = Math.max(...objects.map(o => o.votes), 0)
  const selected = commentsFor ? objects.find(o => o.id === commentsFor) : null

  return (
    <div className="taller-card overflow-hidden">
      {/* barra del instrumento */}
      <div className="p-4 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--t-line)' }}>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest taller-mari">Motor Board · {dynamic.toLowerCase()}</div>
          <div className="font-black taller-ink">{heading}</div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {STICKY.map((c, i) => (
            <button key={c} onClick={() => setColorId(i)} className="w-6 h-6 rounded-md transition"
              style={{ background: c, outline: colorId === i ? '2px solid var(--t-marigold)' : '1px solid rgba(0,0,0,.1)', outlineOffset: '1px' }} aria-label={`color ${i + 1}`} />
          ))}
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Escribe una idea…" maxLength={500}
            className="px-3 py-2 rounded-xl text-sm w-56" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
          <button onClick={add} disabled={adding || !text.trim()} className="taller-cta px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1 disabled:opacity-50">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Pegar nota
          </button>
        </div>
      </div>

      {/* lienzo */}
      <div ref={boardRef} className="relative overflow-auto" style={{ height: 520, background: 'radial-gradient(circle, var(--t-line) 1px, transparent 1px) 0 0 / 24px 24px, var(--t-surface)' }}
        onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
        <div style={{ width: BOARD_W, height: BOARD_H, position: 'relative' }}>
          {objects.length === 0 && (
            <div className="absolute inset-x-0 top-24 text-center taller-muted text-sm">El muro está vacío. Peguen la primera nota 📌</div>
          )}
          {objects.map(o => {
            const pos = (dragPos && dragPos.id === o.id) ? dragPos : { x: o.data?.x ?? 0, y: o.data?.y ?? 0 }
            const mine = me?.enrollmentId && o.authorId === me.enrollmentId
            const rot = ((o.id.charCodeAt(o.id.length - 1) % 5) - 2) * 0.8
            const isTop = top > 0 && o.votes === top
            return (
              <div key={o.id}
                className="absolute w-[210px] rounded-lg p-3 select-none touch-none"
                style={{
                  left: pos.x, top: pos.y,
                  background: STICKY[(o.data?.colorId ?? 0) % STICKY.length], color: '#2a2412',
                  boxShadow: dragPos?.id === o.id ? 'var(--t-shadow-lg, 0 12px 30px rgba(0,0,0,.18))' : 'var(--t-shadow-sm)',
                  transform: `rotate(${dragPos?.id === o.id ? 0 : rot}deg)`,
                  border: '1px solid rgba(0,0,0,.06)',
                  cursor: editing === o.id ? 'text' : 'grab',
                  zIndex: dragPos?.id === o.id ? 30 : isTop ? 5 : 1,
                  ...(isTop ? { outline: '2px solid var(--t-marigold)', outlineOffset: '2px' } : {}),
                }}
                onPointerDown={e => { if (editing !== o.id) onPointerDown(e, o) }}
                onDoubleClick={() => startEdit(o)}>
                {editing === o.id ? (
                  <textarea autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                    onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() } }}
                    className="w-full text-sm bg-transparent resize-none outline-none" rows={3} maxLength={500} />
                ) : (
                  <p className="text-sm font-medium whitespace-pre-wrap break-words">{savingEdit && editing === o.id ? '…' : o.data?.text}</p>
                )}
                <div className="flex items-center gap-1 mt-2 text-[10px] opacity-70 font-semibold">
                  <span className="truncate">{o.authorName ?? '—'}</span>
                  <span className="ml-auto flex items-center gap-1">
                    {(o.comments?.length ?? 0) > 0 && <span>{o.comments.length}💬</span>}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1.5 pt-1.5" style={{ borderTop: '1px dashed rgba(0,0,0,.15)' }}>
                  <button onClick={() => vote(o)} disabled={!!mine || me?.role !== 'student'}
                    className="text-xs font-bold px-2 py-0.5 rounded-md disabled:opacity-40"
                    style={{ background: o.iVoted ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.5)' }}
                    title={mine ? 'No puedes votar tu propia nota' : o.iVoted ? 'Quitar voto' : 'Votar'}>
                    ⭐ {o.votes}
                  </button>
                  <button onClick={() => { setCommentsFor(o.id); setCommentText('') }} className="text-xs px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,.5)' }} title="Comentarios">
                    <MessageCircle className="w-3.5 h-3.5 inline" />
                  </button>
                  {mine && editing !== o.id && (
                    <button onClick={() => startEdit(o)} className="text-xs px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(255,255,255,.5)' }} title="Editar mi nota">
                      <Pencil className="w-3.5 h-3.5 inline" />
                    </button>
                  )}
                  {(mine || me?.role === 'teacher') && (
                    <button onClick={() => remove(o)} className="ml-auto text-xs px-1.5 py-0.5 rounded-md opacity-60 hover:opacity-100" title="Quitar (borrado suave)">
                      <Trash2 className="w-3.5 h-3.5 inline" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* pie: leyenda del núcleo */}
      <div className="px-4 py-2 text-[10px] font-mono taller-muted flex items-center gap-2" style={{ borderTop: '1px solid var(--t-line)' }}>
        <span>⭐ la nota más votada lidera</span><span>·</span><span>✏️ o doble clic = editar tu nota</span><span>·</span><span>arrastra para organizar</span>
        <span className="ml-auto">núcleo: objetos + grafo + eventos</span>
      </div>

      {/* panel de comentarios (Inspector mínimo) */}
      {selected && (
        <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-4" onClick={() => setCommentsFor(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="taller-card relative max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <button onClick={() => setCommentsFor(null)} className="absolute top-3 right-3 taller-muted hover:opacity-70"><X className="w-4 h-4" /></button>
            <div className="text-[10px] font-mono uppercase tracking-widest taller-mari mb-1">Conversación sobre la nota</div>
            <div className="rounded-lg p-3 text-sm font-medium mb-3" style={{ background: STICKY[(selected.data?.colorId ?? 0) % STICKY.length], color: '#2a2412' }}>
              {selected.data?.text}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
              {(selected.comments ?? []).length === 0 && <p className="text-sm taller-muted">Sin comentarios aún. Empieza la conversación 💬</p>}
              {(selected.comments ?? []).map((c: any) => (
                <div key={c.id} className="text-sm">
                  <span className="font-bold taller-ink">{c.authorName ?? '—'}:</span>{' '}
                  <span className="taller-soft">{c.data?.text}</span>
                </div>
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
