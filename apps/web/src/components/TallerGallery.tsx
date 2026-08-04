import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '../lib/toast'
import { confirmDialog } from './ui/confirm'
import { Loader2, Trash2, MessageCircle, Plus, X, Paperclip, Link2, ExternalLink } from 'lucide-react'
import { tallerApi, classroomApi, storageApi } from '../lib/api'

// ═══════════════════════════════════════════════════════════════════════════
// EL TALLER — Motor MEDIA · dinámica GALERÍA DE EVIDENCIAS. El equipo documenta
// el terreno: fotos, videos y hallazgos con autor y fecha. Cada evidencia es un
// Objeto Universal (type Evidence) con data.fields = { url, kind, caption }.
// Reutiliza la subida a storage que ya usan las entregas de misión.
// ═══════════════════════════════════════════════════════════════════════════

export default function TallerGallery({ teamId, dynamic = 'GALERIA', stationId }: { teamId: string; dynamic?: string; stationId?: string }) {
  const [inst, setInst] = useState<any>(null)
  const [objects, setObjects] = useState<any[]>([])
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<null | 'FILE' | 'LINK'>(null)
  const [caption, setCaption] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [commentsFor, setCommentsFor] = useState<string | null>(null)
  const [commentText, setCommentText] = useState('')
  const [lightbox, setLightbox] = useState<{ url: string; caption: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)
  const [resolved, setResolved] = useState<Record<string, string>>({})

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true)
    try {
      let instrument = inst
      if (!instrument) {
        instrument = (await tallerApi.resolveInstrument({ teamId, motor: 'MEDIA', dynamic, stationId, title: 'Galería de evidencias' })).data
        setInst(instrument)
      }
      const { data: st } = await tallerApi.instrumentState(instrument.id)
      setMe(st.me); setObjects(st.objects)
    } catch { /* el próximo poll reintenta */ }
    finally { if (!background) setLoading(false) }
  }, [teamId, inst])

  useEffect(() => { load() }, [teamId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => { if (!adding && !busyRef.current) load(true) }, 4000)
    return () => clearInterval(t)
  }, [load, adding])

  // Resolver las rutas de storage a URLs firmadas para poder previsualizar.
  useEffect(() => {
    for (const o of objects) {
      const f = o.data?.fields || {}
      if (f.kind === 'FILE' && f.url && !resolved[f.url]) {
        storageApi.resolveUrl(f.url)
          .then(({ data }) => setResolved(r => ({ ...r, [f.url]: data.url })))
          .catch(() => setResolved(r => ({ ...r, [f.url]: '' })))
      }
    }
  }, [objects]) // eslint-disable-line react-hooks/exhaustive-deps

  const crear = async (fields: Record<string, string>, texto: string) => {
    if (!inst) return
    busyRef.current = true
    try {
      await tallerApi.createObject(inst.id, { type: 'Evidence', text: texto, fields })
      setAdding(null); setCaption(''); setLink('')
      await load(true)
    } catch (e: any) { toast.error(e?.response?.data?.message || 'No se pudo agregar la evidencia') }
    finally { busyRef.current = false; setBusy(false) }
  }
  const subirArchivo = async (file: File) => {
    setBusy(true)
    try {
      const { data } = await classroomApi.uploadMaterial(file)
      const url = data?.data?.path || data?.data?.url
      if (!url) { toast.error('No se pudo subir el archivo'); setBusy(false); return }
      const esImagen = /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(file.name)
      await crear({ kind: 'FILE', url, nombre: file.name, caption: caption.trim(), media: esImagen ? 'image' : 'file' }, caption.trim() || file.name)
    } catch (e: any) { toast.error(e?.response?.data?.message || 'No se pudo subir el archivo'); setBusy(false) }
  }
  const agregarEnlace = async () => {
    const u = link.trim()
    if (!u) return
    setBusy(true)
    await crear({ kind: 'LINK', url: u, caption: caption.trim() }, caption.trim() || u)
  }
  const remove = async (o: any) => {
    if (!(await confirmDialog('¿Quitar esta evidencia? (queda en la memoria del proyecto)', { danger: true }))) return
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
  const urlDe = (f: any) => f.kind === 'FILE' ? (resolved[f.url] ?? '') : f.url

  return (
    <div className="taller-card overflow-hidden">
      <div className="p-4 flex items-center gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--t-line)' }}>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest taller-mari">Motor Media · Galería</div>
          <div className="font-black taller-ink">📷 Evidencias del terreno</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) subirArchivo(f); e.currentTarget.value = '' }} />
          <button onClick={() => setAdding('LINK')} className="taller-card px-3 py-2 rounded-xl font-bold text-sm taller-soft flex items-center gap-1.5"><Link2 className="w-4 h-4" /> Enlace</button>
          <button onClick={() => setAdding('FILE')} className="taller-cta px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> Subir evidencia</button>
        </div>
      </div>

      <div className="px-4 py-2 text-xs font-semibold" style={{ background: 'color-mix(in srgb, var(--t-marigold) 8%, var(--t-surface))', color: '#8a5a10', borderBottom: '1px solid var(--t-line)' }}>
        Documenten lo que ven con sus propios ojos: fotos del problema, videos, audios de entrevistas. Cada evidencia queda con su autor y su fecha.
      </div>

      <div className="p-4 max-h-[520px] overflow-y-auto">
        {objects.length === 0 ? (
          <p className="text-sm taller-muted text-center py-10">Aún no hay evidencias. Salgan al terreno y documenten lo que encuentren 📷</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {objects.map(o => {
              const f: Record<string, string> = o.data?.fields || {}
              const url = urlDe(f)
              const esImagen = f.media === 'image' && !!url
              return (
                <div key={o.id} className="taller-card overflow-hidden" style={{ background: 'var(--t-surface)' }}>
                  <button onClick={() => esImagen ? setLightbox({ url, caption: f.caption || o.data?.text || '' }) : url && window.open(url, '_blank', 'noopener')}
                    className="block w-full text-left" style={{ cursor: url ? 'pointer' : 'default' }}>
                    <div className="aspect-[4/3] grid place-items-center overflow-hidden" style={{ background: 'color-mix(in srgb, var(--t-line) 40%, transparent)' }}>
                      {esImagen
                        ? <img src={url} alt={f.caption || 'evidencia'} className="w-full h-full object-cover" />
                        : <span className="text-3xl">{f.kind === 'LINK' ? '🔗' : '📄'}</span>}
                    </div>
                  </button>
                  <div className="p-2.5">
                    <p className="text-xs font-semibold taller-ink line-clamp-2">{f.caption || f.nombre || o.data?.text}</p>
                    {f.kind === 'LINK' && f.url && (
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-[11px] taller-mari hover:opacity-70 inline-flex items-center gap-1 mt-0.5 break-all">
                        <ExternalLink className="w-3 h-3 shrink-0" /> ver
                      </a>
                    )}
                    <div className="flex items-center gap-1 mt-1.5 text-[10px] taller-muted font-semibold">
                      <span className="truncate">{o.authorName ?? '—'} · {new Date(o.createdAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
                      <span className="ml-auto flex items-center gap-1 shrink-0">
                        <button onClick={() => { setCommentsFor(o.id); setCommentText('') }} className="hover:opacity-70" title="Comentar">
                          <MessageCircle className="w-3.5 h-3.5" />{(o.comments?.length ?? 0) > 0 ? ` ${o.comments.length}` : ''}
                        </button>
                        {(mine(o) || me?.role === 'teacher') && <button onClick={() => remove(o)} className="hover:opacity-70" title="Quitar"><Trash2 className="w-3.5 h-3.5" /></button>}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="px-4 py-2 text-[10px] font-mono taller-muted flex items-center gap-2" style={{ borderTop: '1px solid var(--t-line)' }}>
        <span>{objects.length} evidencia{objects.length === 1 ? '' : 's'}</span>
        <span className="ml-auto">con autor y fecha · nada se pierde</span>
      </div>

      {/* añadir evidencia */}
      {adding && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4" onClick={() => !busy && setAdding(null)}>
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
          <div className="taller-card relative max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <button onClick={() => !busy && setAdding(null)} className="absolute top-3 right-3 taller-muted hover:opacity-70"><X className="w-4 h-4" /></button>
            <div className="text-[10px] font-mono uppercase tracking-widest taller-mari mb-2">{adding === 'FILE' ? 'Subir evidencia' : 'Evidencia por enlace'}</div>
            <label className="text-[11px] font-bold taller-soft">¿Qué muestra esta evidencia?</label>
            <input value={caption} onChange={e => setCaption(e.target.value)} placeholder="Ej: La llave del baño de secundaria goteando" maxLength={200} autoFocus
              className="w-full mt-1 mb-3 px-3 py-2 rounded-xl text-sm" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
            {adding === 'LINK' ? (
              <div className="flex gap-2">
                <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://… (video, noticia, foto)" maxLength={500}
                  className="flex-1 px-3 py-2 rounded-xl text-sm" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }} />
                <button onClick={agregarEnlace} disabled={busy || !link.trim()} className="taller-cta px-4 rounded-xl font-bold text-sm disabled:opacity-50">{busy ? '…' : 'Agregar'}</button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={busy} className="taller-cta w-full py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />} Elegir foto, video o audio
              </button>
            )}
          </div>
        </div>
      )}

      {/* lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="absolute inset-0 bg-slate-900/80" />
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setLightbox(null)} className="absolute -top-9 right-0 text-white/80 hover:text-white"><X className="w-6 h-6" /></button>
            <img src={lightbox.url} alt={lightbox.caption} className="w-full max-h-[80vh] object-contain rounded-xl" />
            {lightbox.caption && <p className="text-white/90 text-sm text-center mt-2">{lightbox.caption}</p>}
          </div>
        </div>
      )}

      {/* conversación */}
      {commentsObj && (
        <div className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-4" onClick={() => setCommentsFor(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="taller-card relative max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <button onClick={() => setCommentsFor(null)} className="absolute top-3 right-3 taller-muted hover:opacity-70"><X className="w-4 h-4" /></button>
            <div className="text-[10px] font-mono uppercase tracking-widest taller-mari mb-1">Conversación sobre la evidencia</div>
            <div className="rounded-lg p-3 text-sm font-medium mb-3" style={{ background: 'var(--t-surface)', border: '1px solid var(--t-line)', color: 'var(--t-ink)' }}>
              {commentsObj.data?.fields?.caption || commentsObj.data?.text}
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
