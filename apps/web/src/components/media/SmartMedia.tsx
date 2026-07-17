/**
 * Medios de la Lección — subida directa + resolución de la key de storage.
 *
 * Bug que arregla (§AUDITORIA_LECCIONES / brief multimedia): al subir un archivo se
 * guardaba la KEY de storage (ej. materiales/inst/x.png) y el <img src> no la
 * resolvía. Aquí:
 *  - `useResolvedMediaUrl` convierte la key en URL firmada para mostrar (URLs
 *    externas y data:/blob: se usan tal cual).
 *  - `SmartImg/SmartVideo/SmartAudio` la usan para render (player + preview).
 *  - `MediaInput` da al docente subir desde el dispositivo + arrastrar/soltar +
 *    pegar URL + vista previa inmediata. Guarda la KEY (estable), no la URL firmada
 *    (que expira).
 */
import { useEffect, useRef, useState } from 'react'
import { Loader2, Upload, X, Image as ImageIcon, Video as VideoIcon, Music, Mic, Square, Trash2 } from 'lucide-react'
import { storageApi, classroomApi } from '../../lib/api'

const isDirect = (v: string) => /^(https?:|data:|blob:)/i.test(v)

export function useResolvedMediaUrl(value?: string | null): string {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const v = (value || '').trim()
    if (!v) { setUrl(''); return }
    if (isDirect(v)) { setUrl(v); return }
    let alive = true
    storageApi.resolveUrl(v).then(({ data }) => { if (alive) setUrl(data.url) }).catch(() => { if (alive) setUrl(v) })
    return () => { alive = false }
  }, [value])
  return url
}

export function SmartImg({ src, alt = '', className = '' }: { src?: string | null; alt?: string; className?: string }) {
  const url = useResolvedMediaUrl(src)
  if (!url) return null
  return <img src={url} alt={alt} className={className} />
}

export function SmartVideo({ src, className = '' }: { src?: string | null; className?: string }) {
  const url = useResolvedMediaUrl(src)
  if (!url) return null
  return <video src={url} controls className={className} />
}

export function SmartAudio({ src, className = '' }: { src?: string | null; className?: string }) {
  const url = useResolvedMediaUrl(src)
  if (!url) return null
  return <audio src={url} controls className={className} />
}

/**
 * Grabador de audio en la app (MediaRecorder). El estudiante graba, escucha y decide
 * si adjunta. Al terminar entrega un File listo para subir por el flujo normal; al
 * borrar, entrega null. No sube nada por su cuenta — es el formulario quien sube.
 */
export function AudioRecorder({ onRecorded, disabled }: { onRecorded: (file: File | null) => void; disabled?: boolean }) {
  const [state, setState] = useState<'idle' | 'recording' | 'recorded'>('idle')
  const [seconds, setSeconds] = useState(0)
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)

  const MAX_SECONDS = 300 // 5 min (el backend limita a 10MB)

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  useEffect(() => () => { cleanupStream(); if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const pickMime = () => {
    const cands = ['audio/webm', 'audio/mp4', 'audio/ogg']
    for (const m of cands) { if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(m)) return m }
    return ''
  }

  const start = async () => {
    setError('')
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Tu navegador no permite grabar audio. Puedes adjuntar un archivo de audio.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = pickMime()
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunksRef.current = []
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const type = rec.mimeType || mime || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
        const file = new File([blob], `grabacion_${Date.now()}.${ext}`, { type })
        const url = URL.createObjectURL(blob)
        setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return url })
        setState('recorded')
        onRecorded(file)
        cleanupStream()
      }
      recRef.current = rec
      rec.start()
      setSeconds(0)
      setState('recording')
      timerRef.current = window.setInterval(() => setSeconds(s => {
        if (s + 1 >= MAX_SECONDS) { try { rec.stop() } catch {} }
        return s + 1
      }), 1000)
    } catch {
      setError('No se pudo acceder al micrófono. Revisa los permisos del navegador.')
      cleanupStream()
    }
  }

  const stop = () => { try { recRef.current?.stop() } catch {} }
  const discard = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(''); setSeconds(0); setState('idle'); onRecorded(null)
  }

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="rounded-xl border border-hairline p-3">
      {state === 'idle' && (
        <button type="button" onClick={start} disabled={disabled}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 hover:border-rose-300 transition-colors disabled:opacity-50" style={{ minHeight: '44px' }}>
          <Mic className="w-4 h-4" /> Grabar audio
        </button>
      )}
      {state === 'recording' && (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-rose-600">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" /> Grabando… {mmss(seconds)}
          </span>
          <button type="button" onClick={stop} className="ml-auto flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl" style={{ minHeight: '44px' }}>
            <Square className="w-4 h-4" /> Detener
          </button>
        </div>
      )}
      {state === 'recorded' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-600">Grabación ({mmss(seconds)})</span>
            <button type="button" onClick={discard} className="ml-auto text-slate-400 hover:text-rose-500 flex items-center gap-1 text-xs" title="Borrar y volver a grabar">
              <Trash2 className="w-4 h-4" /> Borrar
            </button>
          </div>
          {previewUrl && <audio src={previewUrl} controls className="w-full" />}
        </div>
      )}
      {error && <p className="text-xs text-rose-500 mt-2">{error}</p>}
    </div>
  )
}

type MediaKind = 'image' | 'video' | 'audio'
const ACCEPT: Record<MediaKind, string> = { image: 'image/*', video: 'video/*', audio: 'audio/*' }
const ICON: Record<MediaKind, typeof ImageIcon> = { image: ImageIcon, video: VideoIcon, audio: Music }
const LABEL: Record<MediaKind, string> = { image: 'imagen', video: 'video', audio: 'audio' }

/** Campo de medio para el editor: URL o subir/arrastrar; muestra vista previa. */
export function MediaInput({ kind, value, onChange, label }: { kind: MediaKind; value: string; onChange: (v: string) => void; label?: string }) {
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const Icon = ICON[kind]
  const preview = useResolvedMediaUrl(value)

  const upload = async (file: File) => {
    setBusy(true)
    try {
      const { data } = await classroomApi.uploadMaterial(file)
      const key = data?.data?.path || data?.data?.url
      if (key) onChange(key)
    } catch { /* silencioso */ } finally { setBusy(false) }
  }

  return (
    <div>
      <label className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1"><Icon className="w-3 h-3" /> {label || LABEL[kind]}</label>
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) upload(f) }}
        className={`rounded-xl border-2 border-dashed p-2 transition-colors ${drag ? 'border-violet-400 bg-violet-50' : 'border-slate-200'}`}
      >
        <div className="flex gap-2">
          <input
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={kind === 'video' ? 'Pega una URL (YouTube…) o sube un archivo' : 'Pega una URL o sube un archivo'}
            className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-sm"
          />
          <input ref={fileRef} type="file" accept={ACCEPT[kind]} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = '' }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5 shrink-0">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Subir
          </button>
          {value && <button type="button" onClick={() => onChange('')} className="text-slate-300 hover:text-rose-500 shrink-0" title="Quitar"><X className="w-4 h-4" /></button>}
        </div>
        {value && preview && (
          <div className="mt-2">
            {kind === 'image' && <img src={preview} alt="" className="max-h-32 rounded-lg" />}
            {kind === 'video' && !isDirect(value) && <video src={preview} controls className="max-h-32 rounded-lg" />}
            {kind === 'video' && isDirect(value) && <p className="text-xs text-slate-400 truncate">🔗 {value}</p>}
            {kind === 'audio' && <audio src={preview} controls className="w-full" />}
          </div>
        )}
      </div>
    </div>
  )
}
