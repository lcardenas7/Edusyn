import { Check, Clock, Copy, ExternalLink, Loader2, Rocket, Send, Smartphone, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import QRCode from 'react-qr-code'
import { construyePublicationApi, type ConstruyePublication } from '../../lib/api/construye'
import { formatBogota } from '../../lib/datetime'
import { toast } from '../../lib/toast'
import AppUsage from './AppUsage'

/** Enlace con su origen: así el uso distingue QR, enlace compartido y el propio equipo. */
export const linkFor = (url: string, src: 'qr' | 'link' | 'team') => `${url}?src=${src}`

/**
 * Publicar la app: el equipo pide publicar una versión guardada, el docente la aprueba y la app
 * queda en un enlace con QR que cualquiera abre e instala en su celular. El reto del equipo es
 * que otras personas la instalen y la usen; el tablero de abajo lo muestra.
 */
export default function PublishPanel({ teamId, latestVersion, defaultTitle }: {
  teamId: string
  latestVersion: { id: string; number: number } | null
  defaultTitle: string
}) {
  const [data, setData] = useState<{ publication: ConstruyePublication | null; appsConfigured: boolean } | null>(null)
  const [title, setTitle] = useState(defaultTitle)
  const [sending, setSending] = useState(false)

  const load = useCallback(() => {
    construyePublicationApi.forTeam(teamId).then(({ data }) => {
      setData(data)
      if (data.publication?.title) setTitle(data.publication.title)
    }).catch(() => setData(current => current ?? { publication: null, appsConfigured: true }))
  }, [teamId])
  useEffect(() => { load() }, [load])
  // Con la app en línea, el uso se refresca solo mientras el panel está abierto.
  const live = data?.publication?.live
  useEffect(() => {
    if (!live) return
    const timer = window.setInterval(load, 60_000)
    return () => window.clearInterval(timer)
  }, [live, load])

  const request = async () => {
    if (!latestVersion) return
    setSending(true)
    try {
      const { data: publication } = await construyePublicationApi.request(teamId, { title: title.trim() || defaultTitle, versionId: latestVersion.id })
      setData(current => ({ appsConfigured: current?.appsConfigured ?? true, publication }))
      toast.success('Petición enviada', 'Su docente la revisará y la aprobará para que quede en línea.')
    } catch (error) {
      toast.error(error)
    } finally {
      setSending(false)
    }
  }

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success('Enlace copiado', 'Compártanlo con compañeros, amigos y familia.') }
    catch { toast.info('Selecciona el enlace y cópialo a mano.') }
  }

  if (!data) return <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando la publicación…</div>

  const publication = data.publication
  const pending = publication?.pendingVersionNumber ?? null
  const newer = latestVersion && (!publication?.versionNumber || latestVersion.number > publication.versionNumber) && latestVersion.number !== pending

  return <section className="rounded-xl border border-indigo-200 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-indigo-700">Publicar</p>
        <h2 className="mt-0.5 flex items-center gap-2 text-xl font-bold text-slate-900"><Rocket className="h-5 w-5 text-indigo-600" /> Su app en el celular de otras personas</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">Publiquen una versión guardada: tendrá un enlace y un código QR para instalarla en Android o iPhone. El reto es que compañeros, amigos y familia la instalen y la usen de verdad.</p>
      </div>
      {publication && <StatusChip publication={publication} />}
    </div>

    {!data.appsConfigured && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">La publicación de apps todavía no está activa en esta plataforma. Pueden seguir construyendo; avisen a su docente.</p>}

    {publication?.reviewNote && !pending && <p className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-900"><XCircle className="mt-0.5 h-4 w-4 shrink-0" /> Su docente dijo: {publication.reviewNote}</p>}
    {pending !== null && <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><Clock className="mt-0.5 h-4 w-4 shrink-0" /> La versión {pending} espera la aprobación de su docente{publication?.live ? '. Mientras tanto sigue en línea la versión ' + publication.versionNumber : ''}.</p>}

    {(!publication || newer) && <div className="mt-4 flex flex-wrap items-end gap-2">
      {!publication && <label className="block min-w-[220px] flex-1 text-xs font-semibold text-slate-700">Nombre de la app (así aparece bajo el ícono)
        <input value={title} maxLength={60} onChange={event => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal" />
      </label>}
      {latestVersion
        ? <button type="button" disabled={sending || !data.appsConfigured} onClick={request} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:bg-slate-300">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {publication ? `Pedir publicar la versión ${latestVersion.number}` : `Pedir publicación (versión ${latestVersion.number})`}
        </button>
        : <p className="text-sm text-slate-500">Primero guarden una versión en el taller de código: solo se publica una versión guardada.</p>}
    </div>}

    {publication?.live && publication.url && <div className="mt-5 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="min-w-0 text-center">
        <div className="inline-block rounded-xl border border-slate-200 bg-white p-3"><QRCode value={linkFor(publication.url, 'qr')} size={180} /></div>
        <p className="mt-1 text-xs text-slate-500">Escanéenlo con la cámara del celular</p>
      </div>
      <div className="min-w-0 space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <code className="w-full min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700 sm:w-auto">{linkFor(publication.url, 'link')}</code>
          <button type="button" onClick={() => copy(linkFor(publication.url!, 'link'))} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Copy className="h-3.5 w-3.5" /> Copiar enlace</button>
          <a href={linkFor(publication.url, 'team')} target="_blank" rel="noreferrer" title="Se abre marcada como del equipo: sus visitas no suman al conteo" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><ExternalLink className="h-3.5 w-3.5" /> Abrir (como equipo)</a>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3"><p className="flex items-center gap-1.5 font-semibold text-slate-800"><Smartphone className="h-4 w-4" /> Android</p><p className="mt-1 text-xs leading-5 text-slate-600">Abran el enlace en Chrome y toquen <b>Instalar</b> (o menú ⋮ → «Instalar app»).</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="flex items-center gap-1.5 font-semibold text-slate-800"><Smartphone className="h-4 w-4" /> iPhone</p><p className="mt-1 text-xs leading-5 text-slate-600">Ábranlo en Safari, toquen <b>Compartir</b> y luego <b>«Agregar a inicio»</b>.</p></div>
        </div>
        <p className="text-xs text-slate-500">Versión {publication.versionNumber} en línea{publication.expiresAt ? ` hasta el ${formatBogota(publication.expiresAt, { day: 'numeric', month: 'long' })}` : ''}. Para medir bien, ustedes ábranla con «Abrir (como equipo)»: sus visitas se cuentan aparte.</p>
      </div>
    </div>}

    {publication?.stats && (publication.live || publication.stats.devices > 0) && <div className="mt-5 border-t border-slate-100 pt-4">
      <p className="mb-2 text-sm font-bold text-slate-800">¿Quién la está usando?</p>
      <AppUsage stats={publication.stats} />
    </div>}
  </section>
}

export function StatusChip({ publication }: { publication: ConstruyePublication }) {
  const [label, style, Icon] = publication.live
    ? ['En línea', 'bg-emerald-100 text-emerald-800', Check] as const
    : publication.status === 'UNPUBLISHED' ? ['Retirada', 'bg-slate-200 text-slate-700', XCircle] as const
      : publication.status === 'PUBLISHED' ? ['Vencida', 'bg-slate-200 text-slate-700', Clock] as const
        : publication.status === 'REJECTED' ? ['No aprobada', 'bg-rose-100 text-rose-800', XCircle] as const
          : ['Esperando aprobación', 'bg-amber-100 text-amber-800', Clock] as const
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}><Icon className="h-3.5 w-3.5" /> {label}</span>
}
