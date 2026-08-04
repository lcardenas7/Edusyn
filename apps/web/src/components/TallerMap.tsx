import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '../lib/toast'
import { confirmDialog } from './ui/confirm'
import { Loader2, Trash2, Pencil, Plus, X, MessageCircle, Link2, Check } from 'lucide-react'
import { tallerApi } from '../lib/api'
import { useIsMobile } from '../hooks/useIsMobile'

// ═══════════════════════════════════════════════════════════════════════════
// EL TALLER — Motor GRAPH · dinámica MAPA DE ACTORES. A diferencia del Árbol
// (jerárquico: cada nodo cuelga de un padre), aquí las piezas se colocan LIBRE-
// MENTE y se conectan entre cualquier par con una relación que el equipo
// describe: "el rector influye en la coordinadora", "los estudiantes usan los
// baños". Cada actor es un Objeto y cada conexión una arista 'conecta-con'.
// ═══════════════════════════════════════════════════════════════════════════

const SIZE = 10000            // el núcleo acota x/y a 0..10000 → % del lienzo
const NODE_W = 132
const NODE_H = 52

// Tipos de actor con su color (gramática visual: se distingue de un vistazo)
const ACTOR_TYPES = [
  { key: 'persona', label: '👤 Persona', color: '#C4DBF3' },
  { key: 'grupo', label: '👥 Grupo', color: '#CFE6BE' },
  { key: 'institucion', label: '🏛️ Institución', color: '#FBE7A6' },
  { key: 'externo', label: '🌍 Externo', color: '#F6D3CE' },
]
const typeOf = (o: any) => ACTOR_TYPES.find(t => t.key === (o.data?.fields?.tipo || 'persona')) ?? ACTOR_TYPES[0]

export default function TallerMap({ teamId, dynamic = 'MAPA_ACTORES', stationId }: { teamId: string; dynamic?: string; stationId?: string }) {
  const isMobile = useIsMobile()
  const [inst, setInst] = useState<any>(null)
  const [objects, setObjects] = useState<any[]>([])
  const [edges, setEdges] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [tipo, setTipo] = useState('persona')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [commentsFor, setCommentsFor] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  // modo conectar: se elige origen y luego destino
  const [conectando, setConectando] = useState(false)
  const [origen, setOrigen] = useState<string | null>(null)
  const [nuevaRel, setNuevaRel] = useState<{ fromId: string; toId: string } | null>(null)
  const [relLabel, setRelLabel] = useState('')
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number; moved: boolean } | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true)
    try {
      let instrument = inst
      if (!instrument) {
        instrument = (await tallerApi.resolveInstrument({ teamId, motor: 'GRAPH', dynamic, stationId, title: 'Mapa de actores' })).data
        setInst(instrument)
      }
      const { data: st } = await tallerApi.instrumentState(instrument.id)
      setMe(st.me); setEdges(st.edges || [])
      setObjects(prev => st.objects.map((o: any) => dragRef.current?.id === o.id ? (prev.find(p => p.id === o.id) ?? o) : o))
    } catch { /* el próximo poll reintenta */ }
    finally { if (!background) setLoading(false) }
  }, [teamId, inst])

  useEffect(() => { load() }, [teamId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => { if (!dragRef.current && !editingId && !nuevaRel && !busyRef.current) load(true) }, 4000)
    return () => clearInterval(t)
  }, [load, editingId, nuevaRel])

  const add = async () => {
    const t = text.trim()
    if (!t || !inst || adding) return
    setAdding(true); busyRef.current = true
    try {
      // se reparten en una espiral suave para que no nazcan encimados
      const n = objects.length
      const ang = n * 2.4, rad = 1200 + n * 420
      const x = Math.max(600, Math.min(SIZE - 600, Math.round(SIZE / 2 + Math.cos(ang) * rad)))
      const y = Math.max(600, Math.min(SIZE - 600, Math.round(SIZE / 2 + Math.sin(ang) * rad * 0.68)))
      await tallerApi.createObject(inst.id, { type: 'Note', text: t, x, y, fields: { tipo } })
      setText(''); await load(true)
    } catch (e: any) { toast.error(e?.response?.data?.message || 'No se pudo agregar el actor') }
    finally { setAdding(false); busyRef.current = false }
  }

  // ── arrastre libre ──
  const onPointerDown = (e: React.PointerEvent, o: any) => {
    if (editingId || conectando) return
    const r = boardRef.current?.getBoundingClientRect()
    if (!r) return
    const px = ((o.data?.x ?? SIZE / 2) / SIZE) * r.width
    const py = ((o.data?.y ?? SIZE / 2) / SIZE) * r.height
    dragRef.current = { id: o.id, dx: e.clientX - r.left - px, dy: e.clientY - r.top - py, moved: false }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current
    const r = boardRef.current?.getBoundingClientRect()
    if (!d || !r) return
    d.moved = true
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

  // ── conectar ──
  const clicActor = (o: any) => {
    if (!conectando) return
    if (!origen) { setOrigen(o.id); return }
    if (origen === o.id) { setOrigen(null); return }
    setNuevaRel({ fromId: origen, toId: o.id }); setRelLabel(''); setOrigen(null)
  }
  const guardarRelacion = async () => {
    if (!nuevaRel) return
    busyRef.current = true
    try {
      await tallerApi.connect({ fromId: nuevaRel.fromId, toId: nuevaRel.toId, relType: 'conecta-con', label: relLabel.trim() || undefined })
      setNuevaRel(null); setRelLabel(''); setConectando(false)
      await load(true)
    } catch (e: any) { toast.error(e?.response?.data?.message || 'No se pudo conectar') }
    finally { busyRef.current = false }
  }
  const quitarRelacion = async (id: string) => {
    if (!(await confirmDialog('¿Quitar esta conexión?', { danger: true }))) return
    try { await tallerApi.disconnect(id); await load(true) } catch { toast.error('No se pudo quitar la conexión') }
  }

  const saveEdit = async () => {
    if (!editingId) return
    const o = objects.find(x => x.id === editingId)
    const t = editText.trim()
    if (!o || !t || t === o.data?.text) { setEditingId(null); return }
    busyRef.current = true
    try { await tallerApi.updateObject(editingId, { text: t, version: o.version }); await load(true) }
    catch { toast.error('Conflicto al guardar; se recargó el mapa'); await load(true) }
    finally { busyRef.current = false; setEditingId(null) }
  }
  const remove = async (o: any) => {
    const conex = edges.filter(e => e.fromId === o.id || e.toId === o.id).length
    if (!(await confirmDialog(conex ? `Este actor tiene ${conex} conexión(es); se irán con él. ¿Quitarlo?` : '¿Quitar este actor? (queda en la memoria del proyecto)', { danger: true }))) return
    try { await tallerApi.deleteObject(o.id); await load(true) } catch { toast.error('No se pudo quitar') }
  }
  const sendComment = async () => {
    const t = commentText.trim()
    if (!t || !commentsFor) return
    try { await tallerApi.addComment(commentsFor, t); setCommentText(''); await load(true) } catch { toast.error('No se pudo comentar') }
  }

  if (loading) return <div className="taller-card p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--t-marigold)' }} /></div>

  const mine = (o: any) => me?.enrollmentId && o.authorId === me.enrollmentId
  const commentsObj = commentsFor ? objects.find(o => o.id === commentsFor) : null
  const byId = new Map(objects.map(o => [o.id, o]))
  const posOf = (o: any) => (dragPos && dragPos.id === o.id) ? dragPos : { x: o.data?.x ?? SIZE / 2, y: o.data?.y ?? SIZE / 2 }
  const pct = (v: number) => (v / SIZE) * 100
  const nombre = (id: string) => byId.get(id)?.data?.text ?? '—'

  return (
    <div className="taller-card overflow-hidden">
      <div className="p-4 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--t-line)' }}>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest taller-mari">Motor Graph · Mapa de Actores</div>
          <div className="font-black taller-ink">🗺️ ¿Quiénes están en esto?</div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <select value={tipo} onChange={e => setTipo(e.target.value)}
            className="px-2 py-2 rounded-xl text-sm" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }}>
            {ACTOR_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Nombre del actor…" maxLength={120}
            className="px-3 py-2 rounded-xl text-sm w-44" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
          <button onClick={add} disabled={adding || !text.trim()} className="taller-cta px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-1">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Añadir
          </button>
          <button onClick={() => { setConectando(v => !v); setOrigen(null) }}
            className="px-3 py-2 rounded-xl font-bold text-sm flex items-center gap-1.5 transition"
            style={conectando
              ? { background: 'color-mix(in srgb, var(--t-marigold) 22%, transparent)', color: '#8a5a10', border: '1px solid color-mix(in srgb, var(--t-marigold) 50%, transparent)' }
              : { background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-soft)' }}>
            {conectando ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />} {conectando ? 'Conectando…' : 'Conectar'}
          </button>
        </div>
      </div>

      <div className="px-4 py-2 text-xs font-semibold" style={{ background: 'color-mix(in srgb, var(--t-marigold) 8%, var(--t-surface))', color: '#8a5a10', borderBottom: '1px solid var(--t-line)' }}>
        {conectando
          ? (origen ? <>Ahora toca el actor con el que se relaciona <b>{nombre(origen)}</b>.</> : <>Toca el <b>primer actor</b> de la relación. (Vuelve a pulsar “Conectando” para salir.)</>)
          : <>Añadan a todos los involucrados y arrástrenlos donde quieran. Luego usen <b>Conectar</b> para describir cómo se relacionan entre sí.</>}
      </div>

      {isMobile ? (
        /* MÓVIL: lista de actores + conexiones (tocar dos tarjetas en modo Conectar). */
        <div className="p-3 space-y-2.5">
          {objects.length === 0 && (
            <div className="py-8 text-center taller-muted text-sm">¿Quiénes están involucrados? Añadan al primero 🗺️</div>
          )}
          {objects.map(o => {
            const t = typeOf(o)
            const esOrigen = origen === o.id
            const conex = edges.filter(e => e.fromId === o.id || e.toId === o.id)
            return (
              <div key={o.id} className="rounded-xl p-3"
                style={{
                  background: `color-mix(in srgb, ${t.color} 45%, var(--t-raised))`,
                  border: `1.5px solid ${esOrigen ? 'var(--t-marigold)' : 'rgba(0,0,0,.08)'}`,
                  outline: esOrigen ? '2px solid var(--t-marigold)' : 'none', outlineOffset: 2,
                  cursor: conectando ? 'pointer' : 'default',
                }}
                onClick={() => conectando && clicActor(o)}>
                {editingId === o.id ? (
                  <textarea autoFocus value={editText} onChange={e => setEditText(e.target.value)} onBlur={saveEdit}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() } }}
                    onClick={e => e.stopPropagation()}
                    className="w-full text-sm bg-transparent resize-none outline-none" style={{ color: '#2a2412' }} rows={2} maxLength={120} />
                ) : (
                  <p className="text-sm font-bold leading-snug break-words" style={{ color: '#2a2412' }}>{t.label.split(' ')[0]} {o.data?.text}</p>
                )}
                {conex.length > 0 && !conectando && (
                  <div className="mt-1.5 space-y-1">
                    {conex.map(e => {
                      const otro = e.fromId === o.id ? e.toId : e.fromId
                      return (
                        <div key={e.id} className="flex items-center gap-1 text-[11px]" style={{ color: 'rgba(42,36,18,.75)' }}>
                          <Link2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">{e.label ? <b>{e.label}</b> : 'conecta con'} → {nombre(otro)}</span>
                          <button onClick={ev => { ev.stopPropagation(); quitarRelacion(e.id) }} className="ml-auto shrink-0 opacity-60 hover:opacity-100" style={{ color: '#CB4E42' }}><X className="w-3 h-3" /></button>
                        </div>
                      )
                    })}
                  </div>
                )}
                {!conectando && (
                  <div className="flex items-center gap-2 mt-2 text-[11px] font-semibold" style={{ color: 'rgba(42,36,18,.65)' }}>
                    <span className="ml-auto flex items-center gap-2.5 shrink-0">
                      <button onClick={() => { setCommentsFor(o.id); setCommentText('') }} className="hover:opacity-70 flex items-center gap-0.5"><MessageCircle className="w-3.5 h-3.5" />{(o.comments?.length ?? 0) > 0 ? o.comments.length : ''}</button>
                      {mine(o) && editingId !== o.id && <button onClick={() => { setEditingId(o.id); setEditText(o.data?.text ?? '') }} className="hover:opacity-70"><Pencil className="w-3.5 h-3.5" /></button>}
                      {(mine(o) || me?.role === 'teacher') && <button onClick={() => remove(o)} className="hover:opacity-70"><Trash2 className="w-3.5 h-3.5" /></button>}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
      <div className="p-4">
        <div ref={boardRef} className="relative rounded-xl overflow-hidden select-none"
          style={{ aspectRatio: '1 / 0.66', border: '1px solid var(--t-line)', background: 'radial-gradient(circle, var(--t-line) 1px, transparent 1px) 0 0 / 28px 28px, var(--t-surface)' }}
          onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>

          {/* conexiones */}
          <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
            {edges.map(e => {
              const a = byId.get(e.fromId), b = byId.get(e.toId)
              if (!a || !b) return null
              const pa = posOf(a), pb = posOf(b)
              const x1 = `${pct(pa.x)}%`, y1 = `${pct(pa.y)}%`, x2 = `${pct(pb.x)}%`, y2 = `${pct(pb.y)}%`
              const mx = `${(pct(pa.x) + pct(pb.x)) / 2}%`, my = `${(pct(pa.y) + pct(pb.y)) / 2}%`
              return (
                <g key={e.id}>
                  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a58a63" strokeWidth={2} opacity={0.75} />
                  {e.label && (
                    <>
                      <rect x={mx} y={my} width={Math.min(e.label.length * 6.2 + 12, 150)} height={17} rx={8}
                        transform="translate(-40,-9)" fill="var(--t-raised)" stroke="var(--t-line)" />
                      <text x={mx} y={my} transform="translate(0,3)" textAnchor="middle" fontSize={10} fill="var(--t-soft)" fontWeight={600}>
                        {e.label.length > 22 ? e.label.slice(0, 22) + '…' : e.label}
                      </text>
                    </>
                  )}
                </g>
              )
            })}
          </svg>

          {/* botón de quitar conexión (fuera del svg para poder pulsarlo) */}
          {edges.map(e => {
            const a = byId.get(e.fromId), b = byId.get(e.toId)
            if (!a || !b) return null
            const pa = posOf(a), pb = posOf(b)
            return (
              <button key={`x-${e.id}`} onClick={() => quitarRelacion(e.id)}
                title={`Quitar: ${nombre(e.fromId)} → ${nombre(e.toId)}`}
                className="absolute w-4 h-4 rounded-full grid place-items-center text-[9px] opacity-0 hover:opacity-100 transition"
                style={{ left: `calc(${(pct(pa.x) + pct(pb.x)) / 2}% + 42px)`, top: `calc(${(pct(pa.y) + pct(pb.y)) / 2}% - 8px)`, background: 'var(--t-raised)', border: '1px solid var(--t-line)', color: '#CB4E42', zIndex: 12 }}>
                ✕
              </button>
            )
          })}

          {objects.length === 0 && (
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <p className="text-sm taller-muted">¿Quiénes están involucrados en el problema? Añadan al primero 🗺️</p>
            </div>
          )}

          {/* actores */}
          {objects.map(o => {
            const pos = posOf(o)
            const t = typeOf(o)
            const arrastrando = dragPos?.id === o.id
            const esOrigen = origen === o.id
            return (
              <div key={o.id} className="absolute rounded-xl p-2 touch-none"
                style={{
                  left: `calc(${pct(pos.x)}% - ${NODE_W / 2}px)`,
                  top: `calc(${pct(pos.y)}% - ${NODE_H / 2}px)`,
                  width: NODE_W, minHeight: NODE_H,
                  background: `color-mix(in srgb, ${t.color} 60%, var(--t-raised))`,
                  border: `1.5px solid ${esOrigen ? 'var(--t-marigold)' : 'rgba(0,0,0,.08)'}`,
                  outline: esOrigen ? '2px solid var(--t-marigold)' : 'none', outlineOffset: 2,
                  boxShadow: arrastrando ? '0 10px 24px rgba(0,0,0,.18)' : 'var(--t-shadow-sm)',
                  cursor: conectando ? 'crosshair' : editingId === o.id ? 'text' : 'grab',
                  zIndex: arrastrando ? 30 : 10,
                }}
                onPointerDown={e => { if (editingId !== o.id) onPointerDown(e, o) }}
                onClick={() => clicActor(o)}
                onDoubleClick={() => { if (mine(o) && !conectando) { setEditingId(o.id); setEditText(o.data?.text ?? '') } }}>
                {editingId === o.id ? (
                  <textarea autoFocus value={editText} onChange={e => setEditText(e.target.value)} onBlur={saveEdit}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() } }}
                    className="w-full text-[11px] bg-transparent resize-none outline-none" style={{ color: '#2a2412' }} rows={2} maxLength={120} />
                ) : (
                  <p className="text-[11px] font-bold leading-snug break-words" style={{ color: '#2a2412' }}>
                    {t.label.split(' ')[0]} {o.data?.text}
                  </p>
                )}
                {!conectando && (
                  <div className="flex items-center gap-1 mt-1 text-[9px] font-semibold" style={{ color: 'rgba(42,36,18,.6)' }}>
                    <span className="ml-auto flex items-center gap-1 shrink-0">
                      <button onClick={e => { e.stopPropagation(); setCommentsFor(o.id); setCommentText('') }} className="hover:opacity-70">
                        <MessageCircle className="w-3 h-3" />{(o.comments?.length ?? 0) > 0 ? o.comments.length : ''}
                      </button>
                      {mine(o) && editingId !== o.id && <button onClick={e => { e.stopPropagation(); setEditingId(o.id); setEditText(o.data?.text ?? '') }} className="hover:opacity-70"><Pencil className="w-3 h-3" /></button>}
                      {(mine(o) || me?.role === 'teacher') && <button onClick={e => { e.stopPropagation(); remove(o) }} className="hover:opacity-70"><Trash2 className="w-3 h-3" /></button>}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* leyenda */}
        <div className="flex items-center gap-3 flex-wrap mt-2">
          {ACTOR_TYPES.map(t => (
            <span key={t.key} className="flex items-center gap-1 text-[10px] font-semibold taller-muted">
              <span className="w-3 h-3 rounded" style={{ background: t.color, border: '1px solid rgba(0,0,0,.08)' }} /> {t.label}
            </span>
          ))}
        </div>
      </div>
      )}

      <div className="px-4 py-2 text-[10px] font-mono taller-muted flex items-center gap-2 flex-wrap" style={{ borderTop: '1px solid var(--t-line)' }}>
        <span>{objects.length} actor{objects.length === 1 ? '' : 'es'} · {edges.length} conexion{edges.length === 1 ? '' : 'es'}</span>
        <span className="ml-auto hidden sm:inline">arrastra para ubicar · pasa el cursor sobre una línea para quitarla</span>
      </div>

      {/* etiqueta de la nueva conexión */}
      {nuevaRel && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" onClick={() => setNuevaRel(null)}>
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
          <div className="taller-card relative max-w-sm w-full p-5" onClick={e => e.stopPropagation()}>
            <button onClick={() => setNuevaRel(null)} className="absolute top-3 right-3 taller-muted hover:opacity-70"><X className="w-4 h-4" /></button>
            <div className="text-[10px] font-mono uppercase tracking-widest taller-mari mb-2">Nueva conexión</div>
            <p className="text-sm taller-soft mb-2">
              <b className="taller-ink">{nombre(nuevaRel.fromId)}</b> … <b className="taller-ink">{nombre(nuevaRel.toId)}</b>
            </p>
            <label className="text-[11px] font-bold taller-soft">¿Cómo se relacionan?</label>
            <input value={relLabel} onChange={e => setRelLabel(e.target.value)} onKeyDown={e => e.key === 'Enter' && guardarRelacion()}
              placeholder="Ej: influye en · usa el agua de · reporta a" maxLength={120} autoFocus
              className="w-full mt-1 px-3 py-2 rounded-xl text-sm" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
            <div className="flex justify-end mt-3">
              <button onClick={guardarRelacion} className="taller-cta px-5 py-2 rounded-xl font-bold text-sm flex items-center gap-1"><Link2 className="w-4 h-4" /> Conectar</button>
            </div>
          </div>
        </div>
      )}

      {commentsObj && (
        <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-4" onClick={() => setCommentsFor(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="taller-card relative max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <button onClick={() => setCommentsFor(null)} className="absolute top-3 right-3 taller-muted hover:opacity-70"><X className="w-4 h-4" /></button>
            <div className="text-[10px] font-mono uppercase tracking-widest taller-mari mb-1">Conversación sobre el actor</div>
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
