/**
 * La campana del aula.
 *
 * Dentro del aula, en móvil, el header de la plataforma se esconde para que no haya dos cromos
 * apilados (ver `index.css`, modo inmersivo). La campana venía en ese header, así que se trae
 * aquí: el estudiante no tiene que salir del aula para enterarse de que hay algo nuevo.
 *
 * Y el aviso de una actividad lleva DIRECTO a ella. Ese era el problema de fondo: "hay una
 * actividad nueva" obligaba a entrar al aula y buscarla entre todas.
 */

import { Bell, ClipboardList, Megaphone } from 'lucide-react'
import { cuandoLlego, type Aviso } from '../model/avisos'
import { Hoja } from './Hoja'

export function BotonAvisos({ sinLeer, onAbrir }: { sinLeer: number; onAbrir: () => void }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={sinLeer > 0 ? `Avisos: ${sinLeer} sin leer` : 'Avisos'}
      className="relative inline-flex min-h-btn shrink-0 items-center justify-center rounded-lg px-2 text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {sinLeer > 0 && (
        <span className="absolute top-1 right-0.5 min-w-4 rounded-full bg-warning-600 px-1 text-[10px] leading-4 font-bold text-white">
          {sinLeer > 9 ? '9+' : sinLeer}
        </span>
      )}
    </button>
  )
}

export function HojaAvisos({
  avisos,
  cargando,
  onAbrirAviso,
  onCerrar,
}: {
  avisos: Aviso[]
  cargando: boolean
  /** Marca el aviso como leído y, si lleva a alguna parte, va. */
  onAbrirAviso: (aviso: Aviso) => void
  onCerrar: () => void
}) {
  // Los de siempre también caben, pero los primeros son los que traen algo que hacer.
  const lista = avisos.slice(0, 30)

  return (
    <Hoja titulo="Avisos" detalle={cargando ? 'Buscando…' : undefined} onCerrar={onCerrar}>
      <div className="px-2 pb-3">
        {!cargando && lista.length === 0 && (
          <p className="px-3 py-6 text-center text-body-sm text-ink-muted">
            No tienes avisos. Cuando tu profe publique algo nuevo, aparece aquí.
          </p>
        )}

        {lista.map((aviso) => {
          const Icono = aviso.deActividad ? ClipboardList : Megaphone
          return (
            <button
              key={aviso.messageId}
              type="button"
              onClick={() => onAbrirAviso(aviso)}
              className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-surface-2 ${
                aviso.leido ? '' : 'bg-accent/5'
              }`}
            >
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  aviso.deActividad ? 'bg-accent/10 text-accent' : 'bg-surface-2 text-ink-muted'
                }`}
              >
                <Icono className="h-4 w-4" aria-hidden="true" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span
                    className={`min-w-0 flex-1 truncate text-body-sm ${
                      aviso.leido ? 'font-medium text-ink-secondary' : 'font-semibold text-ink-primary'
                    }`}
                  >
                    {aviso.titulo}
                  </span>
                  <span className="shrink-0 text-xs text-ink-muted">{cuandoLlego(aviso.fecha)}</span>
                </span>
                {aviso.detalle && <span className="mt-0.5 block text-xs text-ink-muted">{aviso.detalle}</span>}
                {aviso.enlace && (
                  <span className="mt-1 block text-xs font-medium text-accent">Abrir →</span>
                )}
              </span>

              {!aviso.leido && (
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Sin leer" />
              )}
            </button>
          )
        })}
      </div>
    </Hoja>
  )
}
