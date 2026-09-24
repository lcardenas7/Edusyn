import { BarChart3, Check, Copy, ExternalLink, Rocket, XCircle } from 'lucide-react'
import { useState } from 'react'
import QRCode from 'react-qr-code'
import { confirmDialog, promptDialog } from '../../components/ui/confirm'
import { construyePublicationApi, type ConstruyePublication } from '../../lib/api/construye'
import { formatBogota } from '../../lib/datetime'
import { toast } from '../../lib/toast'
import AppUsage from './AppUsage'
import { linkFor, StatusChip } from './PublishPanel'

const dateInBogota = (iso: string) => new Date(new Date(iso).getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10)

/** En la tarjeta del equipo: aprobar, retirar o eliminar la publicación y ver su uso. */
export default function TeacherPublication({ publication, onChanged, onDeleted }: { publication: ConstruyePublication; onChanged: (publication: ConstruyePublication) => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false)
  const [expiresAt, setExpiresAt] = useState(publication.expiresAt && new Date(publication.expiresAt).getTime() > Date.now() ? dateInBogota(publication.expiresAt) : '')
  const [showUsage, setShowUsage] = useState(false)
  const pending = publication.pendingVersionNumber

  const run = async (action: () => Promise<{ data: ConstruyePublication }>, done: string) => {
    setBusy(true)
    try {
      const { data } = await action()
      onChanged(data)
      toast.success(done)
    } catch (error) {
      toast.error(error)
    } finally {
      setBusy(false)
    }
  }

  const approve = () => run(() => construyePublicationApi.approve(publication.id, expiresAt ? { expiresAt } : {}), 'App publicada')
  const reject = async () => {
    const note = await promptDialog('¿Qué deben ajustar antes de publicarla? El equipo verá este mensaje.', { title: 'No aprobar todavía', confirmLabel: 'Enviar' })
    if (note === null) return
    await run(() => construyePublicationApi.reject(publication.id, { note }), 'El equipo verá tu comentario')
  }
  const unpublish = async () => {
    if (!await confirmDialog('La app dejará de abrir en línea. Una copia ya instalada podrá seguir funcionando sin conexión. Podrás volver a publicarla con el mismo enlace.', { title: 'Retirar la app', confirmLabel: 'Retirar', danger: true })) return
    await run(() => construyePublicationApi.unpublish(publication.id), 'App retirada')
  }
  const remove = async () => {
    const title = await promptDialog(`Para eliminar definitivamente la publicación y su detalle de uso, escribe exactamente «${publication.title}». El proyecto, las versiones y un resumen de uso se conservarán.`, { title: 'Eliminar publicación', confirmLabel: 'Eliminar', danger: true })
    if (title === null) return
    if (title.trim() !== publication.title) { toast.warning('El nombre no coincide; no se eliminó la publicación'); return }
    setBusy(true)
    try {
      await construyePublicationApi.deletePublication(publication.id, title.trim())
      toast.success('Publicación eliminada', 'El proyecto y sus versiones siguen disponibles.')
      onDeleted()
    } catch (error) {
      toast.error(error)
    } finally {
      setBusy(false)
    }
  }

  return <div className="mt-3 min-w-0 rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800"><Rocket className="h-4 w-4 text-indigo-600" /> {publication.title}</p>
      <StatusChip publication={publication} />
    </div>

    {pending !== null && <div className="mt-2 space-y-2 rounded-lg bg-white p-2.5 text-xs text-slate-700">
      <p>Piden publicar la <b>versión {pending}</b>{publication.requestedAt ? ` (${formatBogota(publication.requestedAt, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })})` : ''}. Revísala con «Ver la app» antes de aprobar.</p>
      <label className="flex flex-wrap items-center gap-2">Disponible hasta (si lo dejas vacío: 30 días después del cierre del año lectivo)
        <input type="date" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} className="rounded border border-slate-200 px-2 py-1" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={approve} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><Check className="h-3.5 w-3.5" /> Aprobar y publicar</button>
        <button type="button" disabled={busy} onClick={reject} className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><XCircle className="h-3.5 w-3.5" /> No aprobar todavía</button>
      </div>
    </div>}

    {publication.live && publication.url && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-slate-600">Versión {publication.versionNumber}{publication.expiresAt ? ` · hasta ${formatBogota(publication.expiresAt, { day: 'numeric', month: 'short' })}` : ''}</span>
      <a href={linkFor(publication.url, 'team')} target="_blank" rel="noreferrer" title="Tus visitas se cuentan como del equipo, aparte" className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Abrir</a>
      <button type="button" onClick={() => navigator.clipboard.writeText(linkFor(publication.url!, 'link')).then(() => toast.success('Enlace copiado')).catch(() => {})} className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline"><Copy className="h-3.5 w-3.5" /> Copiar enlace</button>
      <button type="button" disabled={busy} onClick={unpublish} className="ml-auto font-semibold text-rose-700 hover:underline disabled:opacity-50">Retirar</button>
    </div>}

    {!publication.live && publication.versionNumber !== null && pending === null && <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-slate-600">{publication.status === 'UNPUBLISHED' ? 'La retiraste del enlace público.' : 'Venció la fecha de publicación.'}</span>
      <input type="date" value={expiresAt} onChange={event => setExpiresAt(event.target.value)} aria-label="Disponible hasta" className="rounded border border-slate-200 px-2 py-1" />
      <button type="button" disabled={busy} onClick={approve} className="font-semibold text-emerald-700 hover:underline disabled:opacity-50">Volver a publicar</button>
    </div>}

    {!publication.live && <button type="button" disabled={busy} onClick={remove} className="mt-3 text-xs font-semibold text-rose-700 underline disabled:opacity-50">Eliminar publicación y detalle de uso</button>}

    {publication.stats && publication.versionNumber !== null && <div className="mt-2">
      <button type="button" onClick={() => setShowUsage(v => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline">
        <BarChart3 className="h-3.5 w-3.5" /> {showUsage ? 'Ocultar uso' : `Uso: ${publication.stats.devices} personas · ${publication.stats.installs} instalaciones · ${publication.stats.activeWeek} activas esta semana`}
      </button>
      {showUsage && <div className="mt-2 space-y-3">
        <AppUsage stats={publication.stats} compact />
        {publication.live && publication.url && <div className="flex items-center gap-3 rounded-lg bg-white p-2"><QRCode value={linkFor(publication.url, 'qr')} size={84} /><p className="text-xs text-slate-500">QR para proyectarlo en clase o imprimirlo.</p></div>}
      </div>}
    </div>}
  </div>
}
