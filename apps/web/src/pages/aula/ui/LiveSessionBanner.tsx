/**
 * El aviso de sesión en vivo. Es lo único que tiene permiso para interrumpir en el aula.
 *
 * Diferencias con el aviso actual:
 *  - Va arriba de "Hoy" (la pantalla de aterrizaje), no escondido dentro de Actividades.
 *  - No hace `animate-pulse` sobre todo el bloque. Un rectángulo grande latiendo es agresivo y
 *    en `prefers-reduced-motion` no debería moverse nada: aquí late un punto de 8 px, y ni eso
 *    si el sistema pide menos movimiento.
 *  - El docente también lo ve en modo "en vivo", para poder volver a su sesión si recargó.
 *  - Nomenclatura del glosario: "Quiz en vivo" / "Quiz en casa", nunca "Live Quiz".
 */

import { ChevronRight, House, Zap } from 'lucide-react'
import { liveModeOf, liveSessionCopy, type LiveSessionLike } from '../model/liveSession'

export function LiveSessionBanner({
  session,
  role,
  onEntrar,
}: {
  session: LiveSessionLike
  role: 'docente' | 'estudiante'
  onEntrar: (session: LiveSessionLike) => void
}) {
  const modo = liveModeOf(session)
  const copy = liveSessionCopy(session, role)
  const Icono = modo === 'en-casa' ? House : Zap

  // "En vivo" reclama atención; "en casa" informa sin prisa.
  const urgente = modo === 'en-vivo'

  return (
    <button
      type="button"
      onClick={() => onEntrar(session)}
      className={`flex w-full items-center gap-3 rounded-modal border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none ${
        urgente
          ? 'border-warning-500 bg-warning-50 hover:bg-warning-100'
          : 'border-hairline bg-surface-1 hover:bg-surface-2'
      }`}
    >
      <span
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
          urgente ? 'bg-warning-100' : 'bg-surface-2'
        }`}
      >
        <Icono className={`h-5 w-5 ${urgente ? 'text-warning-700' : 'text-ink-secondary'}`} aria-hidden="true" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          {urgente && (
            <span
              className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-warning-600 motion-reduce:animate-none"
              aria-hidden="true"
            />
          )}
          <span className="text-body-base font-semibold text-ink-primary">{copy.titulo}</span>
        </span>
        <span className="mt-0.5 block truncate text-body-sm text-ink-secondary">{copy.detalle}</span>
      </span>

      <span
        className={`hidden shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-body-sm font-semibold sm:inline-flex ${
          urgente ? 'bg-warning-600 text-white' : 'bg-surface-2 text-ink-primary'
        }`}
      >
        {copy.cta}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-ink-muted sm:hidden" aria-hidden="true" />
    </button>
  )
}
