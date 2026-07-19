import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Trash2, MessageCircle, Pencil, Plus, X, GitBranch } from 'lucide-react'
import { tallerApi } from '../lib/api'

// ═══════════════════════════════════════════════════════════════════════════
// EL TALLER — Motor GRAPH · dinámica ÁRBOL DE IDEAS. El ejemplo fundador:
// "entran, ven un árbol, escriben ideas y las van colocando en el árbol".
// Cada idea es un Objeto Universal; colgar una idea de otra crea la arista
// 'deriva-de' en el grafo del proyecto. El layout del árbol es determinístico
// (se calcula del grafo, no se guardan posiciones): tronco abajo, ramas arriba.
// ═══════════════════════════════════════════════════════════════════════════

const DEPTH_COLORS = ['#CFE6BE', '#FBE7A6', '#C4DBF3', '#F6D3CE', '#DDD2F2']
const SLOT_W = 190   // ancho de columna por hoja
const NODE_W = 170
const NODE_H = 92
const LEVEL_V = 150  // separación vertical entre niveles

type TreeNode = { obj: any; children: TreeNode[]; x: number; y: number; depth: number }

export default function TallerTree({ teamId }: { teamId: string }) {
  const [inst, setInst] = useState<any>(null)
  const [objects, setObjects] = useState<any[]>([])
  const [edges, setEdges] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [composer, setComposer] = useState<{ parentId: string | null } | null>(null)
  const [composerText, setComposerText] = useState('')
  const [sending, setSending] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [commentsFor, setCommentsFor] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const busyRef = useRef(false)

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true)
    try {
      let instrument = inst
      if (!instrument) {
        instrument = (await tallerApi.resolveInstrument({ teamId, motor: 'GRAPH', dynamic: 'ARBOL_IDEAS', title: 'Árbol de ideas' })).data
        setInst(instrument)
      }
      const { data: st } = await tallerApi.instrumentState(instrument.id)
      setMe(st.me); setObjects(st.objects); setEdges(st.edges || [])
    } catch { /* siguiente poll reintenta */ }
    finally { if (!background) setLoading(false) }
  }, [teamId, inst])

  useEffect(() => { load() }, [teamId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => { if (!composer && !editingId && !busyRef.current) load(true) }, 4000)
    return () => clearInterval(t)
  }, [load, composer, editingId])

  // ─── construir + acomodar el árbol (layout determinístico) ────────────────
  const parentOf = new Map<string, string>()
  for (const e of edges) if (e.relType === 'deriva-de') parentOf.set(e.fromId, e.toId)
  const byId = new Map(objects.map(o => [o.id, o]))
  const childrenOf = new Map<string, any[]>()
  const roots: any[] = []
  for (const o of objects) {
    const p = parentOf.get(o.id)
    if (p && byId.has(p)) {
      if (!childrenOf.has(p)) childrenOf.set(p, [])
      childrenOf.get(p)!.push(o)
    } else roots.push(o)
  }
  const sortByDate = (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  roots.sort(sortByDate); childrenOf.forEach(c => c.sort(sortByDate))

  let leafCursor = 0
  let maxDepth = 0
  const layout = (o: any, depth: number): TreeNode => {
    maxDepth = Math.max(maxDepth, depth)
    const kids = (childrenOf.get(o.id) || []).map(c => layout(c, depth + 1))
    let x: number
    if (kids.length === 0) { x = leafCursor * SLOT_W + SLOT_W / 2; leafCursor += 1 }
    else x = (kids[0].x + kids[kids.length - 1].x) / 2
    return { obj: o, children: kids, x, y: 0, depth }
  }
  const forest = roots.map(r => layout(r, 0))
  const leaves = Math.max(leafCursor, 1)
  const W = Math.max(leaves * SLOT_W + 60, 700)
  const H = (maxDepth + 1) * LEVEL_V + 200
  const yOf = (depth: number) => H - 170 - depth * LEVEL_V - NODE_H
  const flat: TreeNode[] = []
  const collect = (n: TreeNode) => { n.y = yOf(n.depth); flat.push(n); n.children.forEach(collect) }
  forest.forEach(collect)
  const trunkX = forest.length ? (forest[0].x + forest[forest.length - 1].x) / 2 : W / 2

  // ─── acciones ─────────────────────────────────────────────────────────────
  const send = async () => {
    const t = composerText.trim()
    if (!t || !inst || sending) return
    setSending(true); busyRef.current = true
    try {
      await tallerApi.createObject(inst.id, { type: 'Idea', text: t, parentId: composer?.parentId ?? undefined })
      setComposer(null); setComposerText('')
      await load(true)
    } catch { alert('No se pudo agregar la idea') }
    finally { setSending(false); busyRef.current = false }
  }
  const saveEdit = async () => {
    if (!editingId) return
    const o = byId.get(editingId)
    const t = editText.trim()
    if (!o || !t || t === o.data?.text) { setEditingId(null); return }
    busyRef.current = true
    try { await tallerApi.updateObject(editingId, { text: t, version: o.version }); await load(true) }
    catch { alert('Conflicto al guardar; se recargó el árbol'); await load(true) }
    finally { busyRef.current = false; setEditingId(null) }
  }
  const vote = async (id: string) => {
    busyRef.current = true
    setObjects(prev => prev.map(x => x.id === id ? { ...x, iVoted: !x.iVoted, votes: x.votes + (x.iVoted ? -1 : 1) } : x))
    try { await tallerApi.toggleVote(id) } catch { }
    finally { busyRef.current = false; load(true) }
  }
  const remove = async (id: string) => {
    const kids = childrenOf.get(id)?.length ?? 0
    if (!confirm(kids ? `Esta rama tiene ${kids} idea(s) colgada(s); quedarán como ramas sueltas. ¿Quitar?` : '¿Quitar esta idea? (queda en la memoria del proyecto)')) return
    try { await tallerApi.deleteObject(id); setSelected(null); await load(true) } catch { alert('No se pudo quitar') }
  }
  const sendComment = async () => {
    const t = commentText.trim()
    if (!t || !commentsFor) return
    try { await tallerApi.addComment(commentsFor, t); setCommentText(''); await load(true) } catch { alert('No se pudo comentar') }
  }

  if (loading) return <div className="taller-card p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--t-marigold)' }} /></div>

  const sel = selected ? byId.get(selected) : null
  const selMine = sel && me?.enrollmentId && sel.authorId === me.enrollmentId
  const top = Math.max(...objects.map(o => o.votes), 0)
  const commentsObj = commentsFor ? byId.get(commentsFor) : null

  return (
    <div className="taller-card overflow-hidden">
      {/* barra del instrumento */}
      <div className="p-4 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--t-line)' }}>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest taller-mari">Motor Graph · Árbol de Ideas</div>
          <div className="font-black taller-ink">🌳 El árbol del equipo</div>
        </div>
        <button onClick={() => { setComposer({ parentId: null }); setComposerText(''); setSelected(null) }}
          className="taller-cta ml-auto px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1">
          <Plus className="w-4 h-4" /> Nueva rama
        </button>
      </div>

      {/* lienzo del árbol */}
      <div className="relative overflow-auto" style={{ height: 560, background: 'linear-gradient(to top, color-mix(in srgb, #CFE6BE 22%, var(--t-surface)) 0%, var(--t-surface) 40%)' }}>
        <div style={{ width: W, height: H, position: 'relative' }} onClick={() => setSelected(null)}>
          {/* ramas (SVG debajo de los nodos) */}
          <svg width={W} height={H} className="absolute inset-0 pointer-events-none">
            {/* tronco */}
            <rect x={trunkX - 14} y={H - 150} width={28} height={90} rx={9} fill="#8a6440" />
            <text x={trunkX} y={H - 34} textAnchor="middle" fontSize={22}>🌱</text>
            {/* de tronco a ramas principales */}
            {forest.map(r => (
              <path key={r.obj.id} d={`M ${trunkX} ${H - 140} C ${trunkX} ${r.y + NODE_H + 40}, ${r.x} ${r.y + NODE_H + 50}, ${r.x} ${r.y + NODE_H - 6}`}
                stroke="#8a6440" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.8} />
            ))}
            {/* de cada rama a sus hijas */}
            {flat.map(n => n.children.map(c => (
              <path key={`${n.obj.id}-${c.obj.id}`} d={`M ${n.x} ${n.y + 6} C ${n.x} ${n.y - 40}, ${c.x} ${c.y + NODE_H + 40}, ${c.x} ${c.y + NODE_H - 6}`}
                stroke="#a58a63" strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.7} />
            )))}
          </svg>

          {objects.length === 0 && (
            <div className="absolute inset-x-0 text-center taller-muted text-sm" style={{ top: H - 260 }}>
              El árbol está recién sembrado. Agreguen la primera rama 🌱
            </div>
          )}

          {/* nodos (ideas) */}
          {flat.map(n => {
            const o = n.obj
            const isTop = top > 0 && o.votes === top
            const isSel = selected === o.id
            return (
              <div key={o.id}
                className="absolute rounded-xl p-2.5 cursor-pointer transition-shadow"
                style={{
                  left: n.x - NODE_W / 2, top: n.y, width: NODE_W, minHeight: NODE_H,
                  background: DEPTH_COLORS[n.depth % DEPTH_COLORS.length], color: '#2a2412',
                  border: '1px solid rgba(0,0,0,.07)',
                  boxShadow: isSel ? '0 8px 24px rgba(0,0,0,.18)' : 'var(--t-shadow-sm)',
                  outline: isSel ? '2px solid var(--t-marigold)' : isTop ? '2px solid color-mix(in srgb, var(--t-marigold) 60%, transparent)' : 'none',
                  outlineOffset: '2px', zIndex: isSel ? 20 : 2,
                }}
                onClick={e => { e.stopPropagation(); setSelected(isSel ? null : o.id) }}>
                {editingId === o.id ? (
                  <textarea autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                    onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() } }}
                    onClick={e => e.stopPropagation()}
                    className="w-full text-xs bg-transparent resize-none outline-none" rows={3} maxLength={500} />
                ) : (
                  <p className="text-xs font-semibold leading-snug break-words" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{o.data?.text}</p>
                )}
                <div className="flex items-center gap-1 mt-1.5 text-[9px] opacity-70 font-semibold">
                  <span className="truncate">{o.authorName ?? '—'}</span>
                  <span className="ml-auto flex items-center gap-1 shrink-0">
                    {o.votes > 0 && <span>⭐{o.votes}</span>}
                    {(o.comments?.length ?? 0) > 0 && <span>{o.comments.length}💬</span>}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* barra de acciones del nodo seleccionado */}
        {sel && (
          <div className="sticky bottom-3 left-0 right-0 flex justify-center pointer-events-none" style={{ zIndex: 40 }}>
            <div className="taller-card pointer-events-auto flex items-center gap-1.5 px-3 py-2 rounded-2xl" style={{ boxShadow: '0 10px 30px rgba(0,0,0,.18)' }}>
              <span className="text-xs font-bold taller-ink max-w-[140px] truncate">{sel.data?.text}</span>
              <span className="w-px h-5 mx-1" style={{ background: 'var(--t-line)' }} />
              <button onClick={() => { setComposer({ parentId: sel.id }); setComposerText('') }} className="taller-cta text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1">
                <GitBranch className="w-3.5 h-3.5" /> Ramificar
              </button>
              {me?.role === 'student' && sel.authorId !== me?.enrollmentId && (
                <button onClick={() => vote(sel.id)} className="text-xs font-bold px-2.5 py-1.5 rounded-lg" style={{ background: sel.iVoted ? 'color-mix(in srgb, var(--t-marigold) 25%, transparent)' : 'var(--t-surface)', border: '1px solid var(--t-line)' }}>
                  ⭐ {sel.iVoted ? 'Quitar voto' : 'Votar'}
                </button>
              )}
              <button onClick={() => { setCommentsFor(sel.id); setCommentText('') }} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)' }}>
                <MessageCircle className="w-3.5 h-3.5 inline" /> {sel.comments?.length || ''}
              </button>
              {(selMine || me?.role === 'teacher') && (<>
                {selMine && (
                  <button onClick={() => { setEditingId(sel.id); setEditText(sel.data?.text ?? '') }} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)' }}>
                    <Pencil className="w-3.5 h-3.5 inline" />
                  </button>
                )}
                <button onClick={() => remove(sel.id)} className="text-xs px-2.5 py-1.5 rounded-lg opacity-70 hover:opacity-100" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)' }}>
                  <Trash2 className="w-3.5 h-3.5 inline" />
                </button>
              </>)}
            </div>
          </div>
        )}
      </div>

      {/* pie */}
      <div className="px-4 py-2 text-[10px] font-mono taller-muted flex items-center gap-2" style={{ borderTop: '1px solid var(--t-line)' }}>
        <span>toca una idea para ramificar, votar o conversar</span><span>·</span><span>⭐ la más votada brilla</span>
        <span className="ml-auto">grafo: cada rama es una arista 'deriva-de'</span>
      </div>

      {/* compositor: nueva rama / ramificar */}
      {composer && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" onClick={() => setComposer(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="taller-card relative max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <button onClick={() => setComposer(null)} className="absolute top-3 right-3 taller-muted hover:opacity-70"><X className="w-4 h-4" /></button>
            <div className="text-[10px] font-mono uppercase tracking-widest taller-mari mb-1">
              {composer.parentId ? 'Ramificar idea' : 'Nueva rama del árbol'}
            </div>
            {composer.parentId && (
              <div className="rounded-lg p-2.5 text-xs font-semibold mb-2" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-soft)' }}>
                🌿 Cuelga de: {byId.get(composer.parentId)?.data?.text}
              </div>
            )}
            <textarea autoFocus value={composerText} onChange={e => setComposerText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder={composer.parentId ? '¿Qué idea se desprende de esta?' : 'Escribe la idea principal…'} maxLength={500} rows={3}
              className="w-full px-3 py-2 rounded-xl text-sm resize-none" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
            <div className="flex justify-end mt-3">
              <button onClick={send} disabled={sending || !composerText.trim()} className="taller-cta px-5 py-2 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-1">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Colgar en el árbol
              </button>
            </div>
          </div>
        </div>
      )}

      {/* conversación sobre una idea */}
      {commentsObj && (
        <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-4" onClick={() => setCommentsFor(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="taller-card relative max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <button onClick={() => setCommentsFor(null)} className="absolute top-3 right-3 taller-muted hover:opacity-70"><X className="w-4 h-4" /></button>
            <div className="text-[10px] font-mono uppercase tracking-widest taller-mari mb-1">Conversación sobre la idea</div>
            <div className="rounded-lg p-3 text-sm font-medium mb-3" style={{ background: '#CFE6BE', color: '#2a2412' }}>{commentsObj.data?.text}</div>
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
