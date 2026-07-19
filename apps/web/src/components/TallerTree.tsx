import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Trash2, MessageCircle, Pencil, Plus, X, GitBranch } from 'lucide-react'
import { tallerApi } from '../lib/api'

// ═══════════════════════════════════════════════════════════════════════════
// EL TALLER — Motor GRAPH · dinámica ÁRBOL DE IDEAS. El ejemplo fundador:
// "entran, ven un árbol, escriben ideas y las van colocando en el árbol".
// Cada idea es un Objeto Universal; colgar una idea de otra crea la arista
// 'deriva-de' en el grafo. Layout RADIAL determinístico (copa en abanico):
// tronco abajo al centro, las ramas principales se abren en arco y cada
// generación crece hacia afuera — como la copa de un árbol real.
// ═══════════════════════════════════════════════════════════════════════════

// follaje: del verde profundo (ramas principales) a tonos claros (brotes)
const LEAF_BG = [
  'linear-gradient(135deg, #DDEBC9 0%, #CBE3AE 100%)',
  'linear-gradient(135deg, #E9F2D8 0%, #D8EBC0 100%)',
  'linear-gradient(135deg, #F4F7E4 0%, #E6F0CF 100%)',
  'linear-gradient(135deg, #FBF6DF 0%, #F1EBC4 100%)',
  'linear-gradient(135deg, #FDF3E4 0%, #F6E6CB 100%)',
]
const LEAF_EDGE = ['#9DBF77', '#AECB8A', '#C0D69E', '#D3CD8F', '#DEC69B']
const NODE_W = 168
const NODE_H = 84
// Separación mínima entre centros de tarjetas vecinas: la DIAGONAL de la tarjeta
// (las tarjetas son rectángulos alineados al eje; usar solo el ancho dejaba que
// vecinas en ángulos diagonales se sobrepusieran).
const RECT_GAP = Math.ceil(Math.hypot(NODE_W, NODE_H)) + 26
const R_BASE = 210      // radio de la primera generación
const R_STEP = 205      // separación radial entre generaciones (≥ diagonal + margen)
const STAGGER = 38      // escalonado radial alterno de las hojas (evita choques y da vida)
const SPAN_DEG = 150    // apertura total de la copa (grados)

type TreeNode = { obj: any; children: TreeNode[]; angle: number; depth: number; x: number; y: number; leafIdx: number }

// Textos por dinámica: el MISMO motor Graph sirve para ideas, problemas, actores…
// (instrumento nuevo = configuración, no desarrollo).
const TREE_VARIANTS: Record<string, { heading: string; motorLabel: string; newRoot: string; rootPlaceholder: string; branchPlaceholder: string; emptyMsg: string; branchLabel: string }> = {
  ARBOL_IDEAS: {
    heading: '🌳 El árbol del equipo', motorLabel: 'Motor Graph · Árbol de Ideas',
    newRoot: 'Nueva rama', rootPlaceholder: 'Escribe la idea principal…',
    branchPlaceholder: '¿Qué idea se desprende de esta?',
    emptyMsg: 'El árbol está recién sembrado. Agreguen la primera rama 🌱', branchLabel: 'Ramificar',
  },
  ARBOL_PROBLEMAS: {
    heading: '🌲 Árbol de problemas', motorLabel: 'Motor Graph · Árbol de Problemas',
    newRoot: 'Nueva causa', rootPlaceholder: '¿Qué causa directa provoca el problema?',
    branchPlaceholder: '¿Y esta causa por qué ocurre? (causa más profunda)',
    emptyMsg: 'Empiecen por las causas directas del problema 🌱', branchLabel: 'Profundizar',
  },
}

export default function TallerTree({ teamId, dynamic = 'ARBOL_IDEAS', stationId }: { teamId: string; dynamic?: string; stationId?: string }) {
  const V = TREE_VARIANTS[dynamic] ?? TREE_VARIANTS.ARBOL_IDEAS
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const centeredRef = useRef(false)

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true)
    try {
      let instrument = inst
      if (!instrument) {
        instrument = (await tallerApi.resolveInstrument({ teamId, motor: 'GRAPH', dynamic, stationId, title: V.heading })).data
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

  // ─── construir el bosque desde el grafo ────────────────────────────────────
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

  // ─── layout RADIAL (copa en abanico) ───────────────────────────────────────
  // Cada hoja recibe una porción angular igual; el ángulo del padre es el punto
  // medio de sus hijas. El radio crece por generación, y se ensancha si hace
  // falta para que las tarjetas de una misma generación no se toquen.
  let leafCursor = 0
  let maxDepth = 0
  const countLeaves = (o: any): number => {
    const kids = childrenOf.get(o.id) || []
    return kids.length === 0 ? 1 : kids.reduce((s, k) => s + countLeaves(k), 0)
  }
  const totalLeaves = Math.max(roots.reduce((s, r) => s + countLeaves(r), 0), 1)
  const spanRad = (Math.min(SPAN_DEG, 40 + totalLeaves * 22) * Math.PI) / 180
  const dTheta = spanRad / totalLeaves
  const build = (o: any, depth: number): TreeNode => {
    maxDepth = Math.max(maxDepth, depth)
    const kids = (childrenOf.get(o.id) || []).map(k => build(k, depth + 1))
    let angle: number
    let leafIdx = -1
    if (kids.length === 0) { angle = Math.PI / 2 + spanRad / 2 - (leafCursor + 0.5) * dTheta; leafIdx = leafCursor; leafCursor += 1 }
    else angle = (kids[0].angle + kids[kids.length - 1].angle) / 2
    return { obj: o, children: kids, angle, depth, x: 0, y: 0, leafIdx }
  }
  const forest = roots.map(r => build(r, 0))
  // Anillo base: el mínimo para que dos tarjetas vecinas del anillo más interno
  // queden separadas al menos una diagonal a lo largo del arco (los anillos externos
  // se separan solos: a mayor radio, mayor cuerda). Cada generación SIEMPRE suma
  // R_STEP desde la base — si no, padre e hija caían en el mismo anillo y se encimaban.
  const ringBase = Math.max(R_BASE, RECT_GAP / Math.max(dTheta, 0.001))
  const rOf = (depth: number) => ringBase + depth * R_STEP
  const maxR = rOf(maxDepth) + STAGGER
  const CX = maxR + NODE_W / 2 + 40
  const trunkBaseY = maxR + NODE_H + 190
  const trunkTopY = trunkBaseY - 120
  const W = CX * 2
  const H = trunkBaseY + 60
  const place = (n: TreeNode) => {
    // hojas alternas ligeramente más afuera: rompe los choques entre vecinas y
    // da el desorden natural del follaje
    const r = rOf(n.depth) + (n.leafIdx >= 0 && n.leafIdx % 2 === 1 ? STAGGER : 0)
    n.x = CX + r * Math.cos(n.angle)
    n.y = trunkTopY - r * Math.sin(n.angle)
    n.children.forEach(place)
  }
  forest.forEach(place)
  const flat: TreeNode[] = []
  const collect = (n: TreeNode) => { flat.push(n); n.children.forEach(collect) }
  forest.forEach(collect)

  // centrar el scroll en el tronco la primera vez
  useEffect(() => {
    if (!centeredRef.current && scrollRef.current && !loading) {
      const el = scrollRef.current
      el.scrollLeft = Math.max(0, CX - el.clientWidth / 2)
      el.scrollTop = el.scrollHeight
      centeredRef.current = true
    }
  }, [loading, CX])

  // rama orgánica: curva desde el punto padre hacia la hija siguiendo el radial
  const branch = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
    // control desplazado hacia el tronco para dar la comba natural de una rama
    const c1x = x1 + (mx - x1) * 0.3, c1y = y1 - Math.abs(y1 - y2) * 0.35
    const c2x = x2 - (x2 - mx) * 0.3, c2y = y2 + Math.abs(y1 - y2) * 0.45
    return `M ${x1} ${y1} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x2} ${y2}`
  }

  // ─── acciones (idénticas: todo es el núcleo) ──────────────────────────────
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
          <div className="text-[10px] font-mono uppercase tracking-widest taller-mari">{V.motorLabel}</div>
          <div className="font-black taller-ink">{V.heading}</div>
        </div>
        <button onClick={() => { setComposer({ parentId: null }); setComposerText(''); setSelected(null) }}
          className="taller-cta ml-auto px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1">
          <Plus className="w-4 h-4" /> {V.newRoot}
        </button>
      </div>

      {/* lienzo del árbol */}
      <div ref={scrollRef} className="relative overflow-auto" style={{ height: 580, background: 'linear-gradient(to bottom, #FDFBF3 0%, #FAF6E9 55%, #F0EED9 100%)' }}>
        <div style={{ width: W, height: H, position: 'relative', margin: '0 auto' }} onClick={() => setSelected(null)}>
          <svg width={W} height={H} className="absolute inset-0 pointer-events-none">
            <defs>
              <linearGradient id="trunkGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#6d4c2f" /><stop offset="100%" stopColor="#8a6440" />
              </linearGradient>
              <radialGradient id="canopyGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#BFDA9B" stopOpacity="0.35" /><stop offset="100%" stopColor="#BFDA9B" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* halo de copa detrás de todo */}
            {flat.length > 0 && (
              <ellipse cx={CX} cy={trunkTopY - (rOf(0) + rOf(maxDepth)) / 2 * 0.72} rx={maxR + 60} ry={maxR * 0.78 + 60} fill="url(#canopyGlow)" />
            )}

            {/* césped */}
            <ellipse cx={CX} cy={trunkBaseY + 26} rx={Math.max(320, maxR)} ry={44} fill="#DCE8C4" opacity={0.8} />
            <ellipse cx={CX - 120} cy={trunkBaseY + 30} rx={140} ry={22} fill="#CFE0B2" opacity={0.7} />
            <ellipse cx={CX + 130} cy={trunkBaseY + 32} rx={160} ry={24} fill="#CFE0B2" opacity={0.6} />
            <text x={CX - 170} y={trunkBaseY + 18} fontSize={13}>🌼</text>
            <text x={CX + 185} y={trunkBaseY + 22} fontSize={12}>🌸</text>
            <text x={CX + 60} y={trunkBaseY + 34} fontSize={11}>🌿</text>

            {/* tronco que se afina, con ligera curva */}
            <path d={`M ${CX - 26} ${trunkBaseY} C ${CX - 22} ${trunkBaseY - 55}, ${CX - 12} ${trunkTopY + 40}, ${CX - 7} ${trunkTopY}
                      L ${CX + 7} ${trunkTopY} C ${CX + 12} ${trunkTopY + 40}, ${CX + 22} ${trunkBaseY - 55}, ${CX + 26} ${trunkBaseY} Z`}
              fill="url(#trunkGrad)" />
            {/* raíces */}
            <path d={`M ${CX - 26} ${trunkBaseY} q -22 6 -38 22 M ${CX + 26} ${trunkBaseY} q 22 6 38 22 M ${CX} ${trunkBaseY} q 4 12 2 22`}
              stroke="#6d4c2f" strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.85} />

            {/* ramas: del tronco a cada rama principal */}
            {forest.map(r => (
              <path key={r.obj.id} d={branch(CX, trunkTopY, r.x, r.y + NODE_H / 2 - 4)}
                stroke="#8a6440" strokeWidth={6} fill="none" strokeLinecap="round" opacity={0.9} />
            ))}
            {/* ramas: de cada idea a sus hijas (más finas por generación) */}
            {flat.map(n => n.children.map(c => (
              <path key={`${n.obj.id}-${c.obj.id}`} d={branch(n.x, n.y - NODE_H / 2 + 8, c.x, c.y + NODE_H / 2 - 4)}
                stroke="#a58a63" strokeWidth={Math.max(4.5 - n.depth, 2)} fill="none" strokeLinecap="round" opacity={0.8} />
            )))}
          </svg>

          {objects.length === 0 && (
            <div className="absolute inset-x-0 text-center taller-muted text-sm" style={{ top: trunkTopY - 90 }}>
              {V.emptyMsg}
            </div>
          )}

          {/* hojas (ideas) */}
          {flat.map(n => {
            const o = n.obj
            const isTop = top > 0 && o.votes === top
            const isSel = selected === o.id
            const d = Math.min(n.depth, LEAF_BG.length - 1)
            // la esquina "de tallo" apunta hacia el tronco
            const leftSide = n.x < CX
            const radius = leftSide ? '20px 20px 20px 5px' : '20px 20px 5px 20px'
            return (
              <div key={o.id}
                className="absolute p-2.5 cursor-pointer transition-shadow"
                style={{
                  left: n.x - NODE_W / 2, top: n.y - NODE_H / 2, width: NODE_W, minHeight: NODE_H,
                  background: LEAF_BG[d], color: '#33401f',
                  border: `1.5px solid ${LEAF_EDGE[d]}`, borderRadius: radius,
                  boxShadow: isSel ? '0 10px 28px rgba(80,90,40,.25)' : '0 3px 10px rgba(80,90,40,.12)',
                  outline: isSel ? '2.5px solid var(--t-marigold)' : 'none', outlineOffset: '2px',
                  zIndex: isSel ? 20 : 2,
                }}
                onClick={e => { e.stopPropagation(); setSelected(isSel ? null : o.id) }}>
                {isTop && (
                  <span className="absolute -top-3 -right-2 text-base drop-shadow" title="La idea más votada">🌟</span>
                )}
                {editingId === o.id ? (
                  <textarea autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                    onBlur={saveEdit} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() } }}
                    onClick={e => e.stopPropagation()}
                    className="w-full text-xs bg-transparent resize-none outline-none" rows={3} maxLength={500} />
                ) : (
                  <p className="text-xs font-semibold leading-snug break-words" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{o.data?.text}</p>
                )}
                <div className="flex items-center gap-1 mt-1.5 text-[9px] opacity-75 font-semibold">
                  <span className="truncate">🍃 {o.authorName ?? '—'}</span>
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
                <GitBranch className="w-3.5 h-3.5" /> {V.branchLabel}
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
        <span>toca una hoja para ramificar, votar o conversar</span><span>·</span><span>🌟 la más votada</span>
        <span className="ml-auto">grafo: cada rama es una arista 'deriva-de'</span>
      </div>

      {/* compositor: nueva rama / ramificar */}
      {composer && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" onClick={() => setComposer(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="taller-card relative max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <button onClick={() => setComposer(null)} className="absolute top-3 right-3 taller-muted hover:opacity-70"><X className="w-4 h-4" /></button>
            <div className="text-[10px] font-mono uppercase tracking-widest taller-mari mb-1">
              {composer.parentId ? V.branchLabel : V.newRoot}
            </div>
            {composer.parentId && (
              <div className="rounded-lg p-2.5 text-xs font-semibold mb-2" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-soft)' }}>
                🌿 Cuelga de: {byId.get(composer.parentId)?.data?.text}
              </div>
            )}
            <textarea autoFocus value={composerText} onChange={e => setComposerText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder={composer.parentId ? V.branchPlaceholder : V.rootPlaceholder} maxLength={500} rows={3}
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
            <div className="rounded-lg p-3 text-sm font-medium mb-3" style={{ background: '#DDEBC9', color: '#33401f' }}>{commentsObj.data?.text}</div>
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
