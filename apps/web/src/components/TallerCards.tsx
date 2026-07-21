import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Trash2, MessageCircle, Pencil, Plus, X, ExternalLink, Copy } from 'lucide-react'
import { tallerApi } from '../lib/api'

// ═══════════════════════════════════════════════════════════════════════════
// EL TALLER — Motor CARDS: fichas con CAMPOS estructurados (no solo texto).
// Cada ficha es un Objeto Universal con `data.fields`. Dos dinámicas:
//  · REFERENCIAS   → Gestor de fuentes "como en Word pero dinámico": el equipo
//    registra de dónde sacó la información y qué aprendió CON SUS PALABRAS.
//    Sirve al principio anti-"todo con IA": obliga a leer y a citar.
//  · PROS_CONTRAS  → dos columnas para pesar una decisión antes de tomarla.
// ═══════════════════════════════════════════════════════════════════════════

type FieldDef = { key: string; label: string; placeholder?: string; type?: 'text' | 'textarea' | 'date' | 'select'; options?: string[]; required?: boolean; width?: 'full' | 'half' }

const SOURCE_TYPES = ['Libro', 'Artículo', 'Página web', 'Video', 'Entrevista']

const VARIANTS: Record<string, {
  motorLabel: string; heading: string; addLabel: string; emptyMsg: string; hint?: string
  layout: 'list' | 'columns'
  objectType: string
  fields: FieldDef[]
  columns?: { key: string; label: string; value: string; color: string }[]
  titleOf: (f: Record<string, string>) => string
}> = {
  REFERENCIAS: {
    motorLabel: 'Motor Cards · Referencias',
    heading: '📑 Fuentes del proyecto',
    addLabel: 'Registrar fuente',
    emptyMsg: 'Aún no han registrado ninguna fuente. Cada dato que usen debería tener de dónde salió 📚',
    hint: 'Registren de dónde sacaron la información y escriban con SUS palabras qué aprendieron. Una fuente bien citada vale más que un resumen copiado.',
    layout: 'list',
    objectType: 'Link',
    fields: [
      { key: 'tipo', label: 'Tipo de fuente', type: 'select', options: SOURCE_TYPES, width: 'half' },
      { key: 'anio', label: 'Año', placeholder: '2026', width: 'half' },
      { key: 'titulo', label: 'Título', placeholder: 'Título del artículo, libro o video', required: true, width: 'full' },
      { key: 'autor', label: 'Autor(es)', placeholder: '¿Quién lo escribió o dijo?', width: 'half' },
      { key: 'fuente', label: 'Editorial / sitio', placeholder: 'El Tiempo, YouTube, Ministerio…', width: 'half' },
      { key: 'url', label: 'Enlace', placeholder: 'https://…', width: 'full' },
      { key: 'consultado', label: 'Fecha de consulta', type: 'date', width: 'half' },
      { key: 'cita', label: 'Cita textual (opcional)', placeholder: '"Copien aquí la frase exacta que les sirvió"', type: 'textarea', width: 'full' },
      { key: 'aprendi', label: 'Qué aprendimos (con nuestras palabras)', placeholder: 'En 2 o 3 líneas, sin copiar.', type: 'textarea', required: true, width: 'full' },
    ],
    titleOf: f => f.titulo || 'Fuente sin título',
  },
  PROS_CONTRAS: {
    motorLabel: 'Motor Cards · Pros y contras',
    heading: '⚖️ Pros y contras',
    addLabel: 'Añadir argumento',
    emptyMsg: 'Escriban los argumentos a favor y en contra antes de decidir ⚖️',
    layout: 'columns',
    objectType: 'Note',
    fields: [
      { key: 'lado', label: 'Lado', type: 'select', options: ['A favor', 'En contra'], required: true, width: 'full' },
      { key: 'argumento', label: 'Argumento', placeholder: '¿Por qué sí o por qué no?', type: 'textarea', required: true, width: 'full' },
    ],
    columns: [
      { key: 'pro', label: '👍 A favor', value: 'A favor', color: '#CFE6BE' },
      { key: 'con', label: '👎 En contra', value: 'En contra', color: '#F6D3CE' },
    ],
    titleOf: f => f.argumento || 'Argumento',
  },
}

/** Cita estilo APA simplificada, armada con lo que el equipo registró. */
function citaAPA(f: Record<string, string>): string {
  const partes: string[] = []
  if (f.autor) partes.push(f.autor)
  if (f.anio) partes.push(`(${f.anio})`)
  if (f.titulo) partes.push(`${f.titulo}.`)
  if (f.fuente) partes.push(`${f.fuente}.`)
  if (f.url) partes.push(f.url)
  return partes.join(' ')
}

export default function TallerCards({ teamId, dynamic = 'REFERENCIAS', stationId }: { teamId: string; dynamic?: string; stationId?: string }) {
  const V = VARIANTS[dynamic] ?? VARIANTS.REFERENCIAS
  const [inst, setInst] = useState<any>(null)
  const [objects, setObjects] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Record<string, string> | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [commentsFor, setCommentsFor] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const busyRef = useRef(false)

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true)
    try {
      let instrument = inst
      if (!instrument) {
        instrument = (await tallerApi.resolveInstrument({ teamId, motor: 'CARDS', dynamic, stationId, title: V.heading })).data
        setInst(instrument)
      }
      const { data: st } = await tallerApi.instrumentState(instrument.id)
      setMe(st.me); setObjects(st.objects)
    } catch { /* el próximo poll reintenta */ }
    finally { if (!background) setLoading(false) }
  }, [teamId, inst])

  useEffect(() => { load() }, [teamId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => { if (!form && !busyRef.current) load(true) }, 4000)
    return () => clearInterval(t)
  }, [load, form])

  const openNew = (preset?: Record<string, string>) => {
    const base: Record<string, string> = {}
    for (const f of V.fields) base[f.key] = ''
    if (V.fields.find(f => f.key === 'tipo')) base.tipo = SOURCE_TYPES[0]
    setEditingId(null); setForm({ ...base, ...(preset || {}) })
  }
  const openEdit = (o: any) => { setEditingId(o.id); setForm({ ...(o.data?.fields || {}) }) }

  const save = async () => {
    if (!form || !inst || sending) return
    const faltan = V.fields.filter(f => f.required && !String(form[f.key] || '').trim())
    if (faltan.length) { alert(`Falta: ${faltan.map(f => f.label).join(', ')}`); return }
    setSending(true); busyRef.current = true
    try {
      const text = V.titleOf(form).slice(0, 200)
      if (editingId) await tallerApi.updateObject(editingId, { text, fields: form })
      else await tallerApi.createObject(inst.id, { type: V.objectType, text, fields: form })
      setForm(null); setEditingId(null)
      await load(true)
    } catch (e: any) { alert(e?.response?.data?.message || 'No se pudo guardar') }
    finally { setSending(false); busyRef.current = false }
  }
  const remove = async (o: any) => {
    if (!confirm('¿Quitar esta ficha? (queda en la memoria del proyecto)')) return
    try { await tallerApi.deleteObject(o.id); await load(true) } catch { alert('No se pudo quitar') }
  }
  const sendComment = async () => {
    const t = commentText.trim()
    if (!t || !commentsFor) return
    try { await tallerApi.addComment(commentsFor, t); setCommentText(''); await load(true) } catch { alert('No se pudo comentar') }
  }
  const copiarCita = async (o: any) => {
    try { await navigator.clipboard.writeText(citaAPA(o.data?.fields || {})); setCopied(o.id); setTimeout(() => setCopied(null), 1500) } catch { }
  }

  if (loading) return <div className="taller-card p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" style={{ color: 'var(--t-marigold)' }} /></div>

  const mine = (o: any) => me?.enrollmentId && o.authorId === me.enrollmentId
  const commentsObj = commentsFor ? objects.find(o => o.id === commentsFor) : null

  // ── ficha (tarjeta) ──
  const Card = ({ o }: { o: any }) => {
    const f: Record<string, string> = o.data?.fields || {}
    const esRef = dynamic === 'REFERENCIAS'
    return (
      <div className="taller-card p-3.5" style={{ background: 'var(--t-surface)' }}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {esRef && f.tipo && <span className="text-[10px] font-mono uppercase tracking-widest taller-mari">{f.tipo}</span>}
            <h4 className="font-bold taller-ink text-sm leading-snug">{V.titleOf(f)}</h4>
            {esRef && (f.autor || f.anio || f.fuente) && (
              <p className="text-xs taller-muted mt-0.5">{[f.autor, f.anio, f.fuente].filter(Boolean).join(' · ')}</p>
            )}
            {f.cita && <p className="text-xs italic mt-1.5 pl-2" style={{ borderLeft: '3px solid var(--t-line)', color: 'var(--t-soft)' }}>“{f.cita}”</p>}
            {f.aprendi && <p className="text-sm taller-soft mt-1.5"><b className="taller-ink">Aprendimos:</b> {f.aprendi}</p>}
            {f.url && (
              <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold taller-mari hover:opacity-70 inline-flex items-center gap-1 mt-1.5 break-all">
                <ExternalLink className="w-3 h-3 shrink-0" /> {f.url.length > 48 ? f.url.slice(0, 48) + '…' : f.url}
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2 pt-2 text-[10px] taller-muted font-semibold" style={{ borderTop: '1px solid var(--t-line)' }}>
          <span className="truncate">{o.authorName ?? '—'}</span>
          <span className="ml-auto flex items-center gap-1.5 shrink-0">
            {esRef && <button onClick={() => copiarCita(o)} title="Copiar la cita" className="hover:opacity-70">{copied === o.id ? '✓ copiada' : <Copy className="w-3.5 h-3.5" />}</button>}
            <button onClick={() => { setCommentsFor(o.id); setCommentText('') }} className="hover:opacity-70" title="Comentar">
              <MessageCircle className="w-3.5 h-3.5" />{(o.comments?.length ?? 0) > 0 ? ` ${o.comments.length}` : ''}
            </button>
            {mine(o) && <button onClick={() => openEdit(o)} className="hover:opacity-70" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>}
            {(mine(o) || me?.role === 'teacher') && <button onClick={() => remove(o)} className="hover:opacity-70" title="Quitar"><Trash2 className="w-3.5 h-3.5" /></button>}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="taller-card overflow-hidden">
      <div className="p-4 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--t-line)' }}>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest taller-mari">{V.motorLabel}</div>
          <div className="font-black taller-ink">{V.heading}</div>
        </div>
        <button onClick={() => openNew()} className="taller-cta ml-auto px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1">
          <Plus className="w-4 h-4" /> {V.addLabel}
        </button>
      </div>

      {V.hint && (
        <div className="px-4 py-2 text-xs font-semibold" style={{ background: 'color-mix(in srgb, var(--t-marigold) 8%, var(--t-surface))', color: '#8a5a10', borderBottom: '1px solid var(--t-line)' }}>
          {V.hint}
        </div>
      )}

      <div className="p-4 max-h-[520px] overflow-y-auto">
        {objects.length === 0 ? (
          <p className="text-sm taller-muted text-center py-8">{V.emptyMsg}</p>
        ) : V.layout === 'columns' ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {V.columns!.map(col => {
              const items = objects.filter(o => (o.data?.fields?.lado || '') === col.value)
              return (
                <div key={col.key}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-black taller-ink">{col.label}</span>
                    <span className="text-[11px] font-mono taller-muted">{items.length}</span>
                    <button onClick={() => openNew({ lado: col.value })} className="ml-auto text-xs font-bold taller-mari hover:opacity-70">+ añadir</button>
                  </div>
                  <div className="space-y-2 rounded-xl p-2" style={{ background: `color-mix(in srgb, ${col.color} 35%, transparent)`, minHeight: 80 }}>
                    {items.length === 0 && <p className="text-xs taller-muted text-center py-3">Sin argumentos aún</p>}
                    {items.map(o => <Card key={o.id} o={o} />)}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-3">
            {objects.map(o => <Card key={o.id} o={o} />)}
          </div>
        )}
      </div>

      <div className="px-4 py-2 text-[10px] font-mono taller-muted flex items-center gap-2" style={{ borderTop: '1px solid var(--t-line)' }}>
        <span>{objects.length} ficha{objects.length === 1 ? '' : 's'}</span>
        {dynamic === 'REFERENCIAS' && <><span>·</span><span>copia la cita con un clic</span></>}
        <span className="ml-auto">todo queda en la memoria del proyecto</span>
      </div>

      {/* formulario de ficha */}
      {form && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" onClick={() => setForm(null)}>
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
          <div className="taller-card relative max-w-lg w-full p-5 max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setForm(null)} className="absolute top-3 right-3 taller-muted hover:opacity-70"><X className="w-4 h-4" /></button>
            <div className="text-[10px] font-mono uppercase tracking-widest taller-mari mb-3">{editingId ? 'Editar ficha' : V.addLabel}</div>
            <div className="grid grid-cols-2 gap-3">
              {V.fields.map(f => (
                <div key={f.key} className={f.width === 'half' ? 'col-span-1' : 'col-span-2'}>
                  <label className="text-[11px] font-bold taller-soft">{f.label}{f.required && <span style={{ color: '#CB4E42' }}> *</span>}</label>
                  {f.type === 'select' ? (
                    <select value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg text-sm" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }}>
                      {(f.options || []).map(op => <option key={op} value={op}>{op}</option>)}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} rows={2} placeholder={f.placeholder} maxLength={1000}
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg text-sm resize-y" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
                  ) : (
                    <input type={f.type === 'date' ? 'date' : 'text'} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} maxLength={300}
                      className="w-full mt-1 px-2.5 py-1.5 rounded-lg text-sm" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
                  )}
                </div>
              ))}
            </div>
            {dynamic === 'REFERENCIAS' && (form.autor || form.titulo) && (
              <div className="mt-3 p-2.5 rounded-lg text-xs" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-soft)' }}>
                <b className="taller-ink">Así quedará la cita:</b><br />{citaAPA(form) || '—'}
              </div>
            )}
            <div className="flex justify-end mt-4">
              <button onClick={save} disabled={sending} className="taller-cta px-5 py-2 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-1">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {editingId ? 'Guardar cambios' : 'Guardar ficha'}
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
            <div className="text-[10px] font-mono uppercase tracking-widest taller-mari mb-1">Conversación sobre la ficha</div>
            <div className="rounded-lg p-3 text-sm font-medium mb-3" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }}>
              {V.titleOf(commentsObj.data?.fields || {})}
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
