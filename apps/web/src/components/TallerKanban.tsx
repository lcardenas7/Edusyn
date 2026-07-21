import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Trash2, Pencil, Plus, X, MessageCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import { tallerApi } from '../lib/api'

// ═══════════════════════════════════════════════════════════════════════════
// EL TALLER — Motor FLOW · dinámica KANBAN. El plan de acción visible: cada
// tarea es un Objeto (Task) con `state` = columna y `fields.owner` = responsable.
// "Nadie se queda sin tarea": se ve de un vistazo quién tiene qué.
// ═══════════════════════════════════════════════════════════════════════════

const COLUMNS = [
  { key: 'TODO', label: '📋 Por hacer', color: '#C4DBF3' },
  { key: 'DOING', label: '🔨 Haciendo', color: '#FBE7A6' },
  { key: 'DONE', label: '✅ Hecho', color: '#CFE6BE' },
]

export default function TallerKanban({ teamId, dynamic = 'KANBAN', stationId, members = [] }: {
  teamId: string; dynamic?: string; stationId?: string; members?: any[]
}) {
  const [inst, setInst] = useState<any>(null)
  const [objects, setObjects] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [owner, setOwner] = useState('')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [commentsFor, setCommentsFor] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const busyRef = useRef(false)

  const nameOf = (m: any) => `${m.studentEnrollment?.student?.user?.firstName ?? ''} ${m.studentEnrollment?.student?.user?.lastName ?? ''}`.trim() || 'Integrante'
  const ownerName = (id?: string) => {
    if (!id) return null
    const m = members.find((x: any) => x.studentEnrollmentId === id)
    return m ? nameOf(m) : null
  }

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true)
    try {
      let instrument = inst
      if (!instrument) {
        instrument = (await tallerApi.resolveInstrument({ teamId, motor: 'FLOW', dynamic, stationId, title: 'Kanban' })).data
        setInst(instrument)
      }
      const { data: st } = await tallerApi.instrumentState(instrument.id)
      setMe(st.me); setObjects(st.objects)
    } catch { /* el próximo poll reintenta */ }
    finally { if (!background) setLoading(false) }
  }, [teamId, inst])

  useEffect(() => { load() }, [teamId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => { if (!editingId && !busyRef.current) load(true) }, 4000)
    return () => clearInterval(t)
  }, [load, editingId])

  const add = async () => {
    const t = text.trim()
    if (!t || !inst || adding) return
    setAdding(true); busyRef.current = true
    try {
      await tallerApi.createObject(inst.id, { type: 'Task', text: t, fields: { col: 'TODO', ...(owner ? { owner } : {}) } })
      setText(''); setOwner(''); await load(true)
    } catch (e: any) { alert(e?.response?.data?.message || 'No se pudo crear la tarea') }
    finally { setAdding(false); busyRef.current = false }
  }
  const mover = async (o: any, dir: 1 | -1) => {
    const actual = COLUMNS.findIndex(c => c.key === (o.data?.fields?.col || 'TODO'))
    const destino = Math.max(0, Math.min(COLUMNS.length - 1, actual + dir))
    if (destino === actual) return
    busyRef.current = true
    setObjects(prev => prev.map(x => x.id === o.id ? { ...x, data: { ...x.data, fields: { ...x.data?.fields, col: COLUMNS[destino].key } } } : x))
    try { await tallerApi.updateObject(o.id, { fields: { col: COLUMNS[destino].key } }) }
    catch (e: any) { alert(e?.response?.data?.message || 'No se pudo mover'); await load(true) }
    finally { busyRef.current = false; load(true) }
  }
  const asignar = async (o: any, enrollmentId: string) => {
    busyRef.current = true
    try { await tallerApi.updateObject(o.id, { fields: { owner: enrollmentId } }); await load(true) }
    catch (e: any) { alert(e?.response?.data?.message || 'No se pudo asignar') }
    finally { busyRef.current = false }
  }
  const saveEdit = async () => {
    if (!editingId) return
    const o = objects.find(x => x.id === editingId)
    const t = editText.trim()
    if (!o || !t || t === o.data?.text) { setEditingId(null); return }
    busyRef.current = true
    try { await tallerApi.updateObject(editingId, { text: t, version: o.version }); await load(true) }
    catch { alert('Conflicto al guardar; se recargó el tablero'); await load(true) }
    finally { busyRef.current = false; setEditingId(null) }
  }
  const remove = async (o: any) => {
    if (!confirm('¿Quitar esta tarea? (queda en la memoria del proyecto)')) return
    try { await tallerApi.deleteObject(o.id); await load(true) } catch { alert('No se pudo quitar') }
  }
  const sendComment = async () => {
    const t = commentText.trim()
    if (!t || !commentsFor) return
    try { await tallerApi.addComment(commentsFor, t); setCommentText(''); await load(true) } catch { alert('No se pudo comentar') }
  }

  if (loading) return <div className="taller-card p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--t-marigold)' }} /></div>

  const mine = (o: any) => me?.enrollmentId && o.authorId === me.enrollmentId
  const commentsObj = commentsFor ? objects.find(o => o.id === commentsFor) : null
  const hechas = objects.filter(o => (o.data?.fields?.col || 'TODO') === 'DONE').length
  const sinDueno = objects.filter(o => !o.data?.fields?.owner).length

  return (
    <div className="taller-card overflow-hidden">
      <div className="p-4 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--t-line)' }}>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest taller-mari">Motor Flow · Kanban</div>
          <div className="font-black taller-ink">📋 Plan de acción del equipo</div>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Nueva tarea…" maxLength={300}
            className="px-3 py-2 rounded-xl text-sm w-48" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
          {members.length > 0 && (
            <select value={owner} onChange={e => setOwner(e.target.value)}
              className="px-2 py-2 rounded-xl text-sm" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }}>
              <option value="">Sin responsable</option>
              {members.map((m: any) => <option key={m.id} value={m.studentEnrollmentId}>{nameOf(m)}</option>)}
            </select>
          )}
          <button onClick={add} disabled={adding || !text.trim()} className="taller-cta px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-1">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Añadir
          </button>
        </div>
      </div>

      <div className="px-4 py-2 text-xs font-semibold" style={{ background: 'color-mix(in srgb, var(--t-marigold) 8%, var(--t-surface))', color: '#8a5a10', borderBottom: '1px solid var(--t-line)' }}>
        Repartan el trabajo: cada tarea con su responsable. Muevan las tarjetas con ‹ › a medida que avanzan. <b>Nadie se queda sin tarea.</b>
      </div>

      <div className="p-4">
        <div className="grid sm:grid-cols-3 gap-3">
          {COLUMNS.map((col, ci) => {
            const items = objects.filter(o => (o.data?.fields?.col || 'TODO') === col.key)
            return (
              <div key={col.key}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-black taller-ink">{col.label}</span>
                  <span className="text-[11px] font-mono taller-muted">{items.length}</span>
                </div>
                <div className="space-y-2 rounded-xl p-2" style={{ background: `color-mix(in srgb, ${col.color} 28%, transparent)`, minHeight: 110 }}>
                  {items.length === 0 && <p className="text-xs taller-muted text-center py-4">Vacío</p>}
                  {items.map(o => {
                    const dueno = ownerName(o.data?.fields?.owner)
                    return (
                      <div key={o.id} className="taller-card p-2.5" style={{ background: 'var(--t-raised)' }}>
                        {editingId === o.id ? (
                          <textarea autoFocus value={editText} onChange={e => setEditText(e.target.value)} onBlur={saveEdit}
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() } }}
                            className="w-full text-sm bg-transparent resize-none outline-none taller-ink" rows={2} maxLength={300} />
                        ) : (
                          <p className={`text-sm font-semibold break-words ${col.key === 'DONE' ? 'taller-muted line-through' : 'taller-ink'}`}>{o.data?.text}</p>
                        )}

                        {/* responsable */}
                        <div className="mt-1.5">
                          {members.length > 0 ? (
                            <select value={o.data?.fields?.owner || ''} onChange={e => asignar(o, e.target.value)}
                              className="text-[10px] rounded-md px-1.5 py-1 w-full"
                              style={{ background: dueno ? 'color-mix(in srgb, var(--t-marigold) 14%, transparent)' : 'var(--t-surface)', border: '1px solid var(--t-line)', color: dueno ? '#8a5a10' : 'var(--t-muted)', fontWeight: dueno ? 700 : 400 }}>
                              <option value="">⚠️ Sin responsable</option>
                              {members.map((m: any) => <option key={m.id} value={m.studentEnrollmentId}>👤 {nameOf(m)}</option>)}
                            </select>
                          ) : dueno && <span className="text-[10px] font-bold" style={{ color: '#8a5a10' }}>👤 {dueno}</span>}
                        </div>

                        <div className="flex items-center gap-1 mt-1.5 pt-1.5 text-[10px] taller-muted font-semibold" style={{ borderTop: '1px solid var(--t-line)' }}>
                          <button onClick={() => mover(o, -1)} disabled={ci === 0} className="disabled:opacity-25 hover:opacity-70" title="Mover atrás"><ChevronLeft className="w-3.5 h-3.5" /></button>
                          <button onClick={() => mover(o, 1)} disabled={ci === COLUMNS.length - 1} className="disabled:opacity-25 hover:opacity-70" title="Mover adelante"><ChevronRight className="w-3.5 h-3.5" /></button>
                          <span className="ml-auto flex items-center gap-1.5 shrink-0">
                            <button onClick={() => { setCommentsFor(o.id); setCommentText('') }} className="hover:opacity-70">
                              <MessageCircle className="w-3.5 h-3.5" />{(o.comments?.length ?? 0) > 0 ? ` ${o.comments.length}` : ''}
                            </button>
                            {mine(o) && editingId !== o.id && <button onClick={() => { setEditingId(o.id); setEditText(o.data?.text ?? '') }} className="hover:opacity-70"><Pencil className="w-3.5 h-3.5" /></button>}
                            {(mine(o) || me?.role === 'teacher') && <button onClick={() => remove(o)} className="hover:opacity-70"><Trash2 className="w-3.5 h-3.5" /></button>}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="px-4 py-2 text-[10px] font-mono taller-muted flex items-center gap-2" style={{ borderTop: '1px solid var(--t-line)' }}>
        <span>{hechas}/{objects.length} hechas</span>
        {sinDueno > 0 && <><span>·</span><span style={{ color: '#8a5a10' }}>⚠️ {sinDueno} sin responsable</span></>}
        <span className="ml-auto">mueve con ‹ ›</span>
      </div>

      {commentsObj && (
        <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-4" onClick={() => setCommentsFor(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="taller-card relative max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <button onClick={() => setCommentsFor(null)} className="absolute top-3 right-3 taller-muted hover:opacity-70"><X className="w-4 h-4" /></button>
            <div className="text-[10px] font-mono uppercase tracking-widest taller-mari mb-1">Conversación sobre la tarea</div>
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
