/**
 * "Tu siguiente paso" — la tarjeta grande del tablero del estudiante.
 *
 * Es la apuesta central del rediseño para el alumno. Hoy el Home le muestra TODAS las
 * actividades en una lista donde todo pesa lo mismo, sin distinguir entregadas de pendientes
 * (P1-6). Un estudiante de bachillerato no necesita un inventario: necesita saber qué hacer
 * ahora. Así que una sola tarjeta responde eso, grande y sin competencia.
 *
 * Es el **único** momento de color saturado de la pantalla, que es justo lo que el Design
 * System permite: "premium = silencio + un momento de color cuando importa".
 */

import { ArrowRight, Lock } from 'lucide-react'
import type { DecoratedActivity } from '../model/list'
import { activityTypeLabel } from '../model/labels'
import { dueCopy, opensCopy } from '../model/countdown'
import { ActivityGlyph } from '../visual/ActivityGlyph'
import { StudentStateChip } from './StateChip'

export interface NextStepProps {
  item: DecoratedActivity
  onOpen: (activityId: string) => void
  now?: Date
}

export function NextStep({ item, onOpen, now = new Date() }: NextStepProps) {
  const a = item.activity
  const s = item.student
  if (!s) return null

  const bloqueada = s.state === 'bloqueada' || s.state === 'no-abierta'
  const apremia = s.state === 'vencida' || s.state === 'vence-hoy'

  const cuando = opensCopy(a.openDate, now) ?? (a.dueDate ? dueCopy(a.dueDate, now) : null)

  // El verbo cambia con el estado: no es lo mismo empezar que corregir o terminar.
  const accion =
    s.state === 'devuelta'
      ? 'Corregir y volver a entregar'
      : s.state === 'en-borrador'
        ? 'Terminar y enviar'
        : s.attempt && s.attempt.current > 0
          ? `Intentar de nuevo · intento ${s.attempt.current + 1} de ${s.attempt.max}`
          : 'Empezar'

  return (
    <section aria-labelledby="siguiente-paso" className="relative overflow-hidden rounded-modal border border-accent/25 bg-accent/[0.06]">
      <div className="p-5 sm:p-6">
        <p id="siguiente-paso" className="text-xs font-semibold tracking-wide text-accent uppercase">
          Tu siguiente paso
        </p>

        <div className="mt-3 flex items-start gap-4">
          <ActivityGlyph type={a.type} size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="text-h2 leading-tight font-bold text-ink-primary">{a.title}</h2>
            <p className="mt-1 text-body-sm text-ink-secondary">
              {activityTypeLabel(a.type, a.metadata)}
              {a.section?.title ? ` · ${a.section.title}` : ''}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StudentStateChip state={s.state} />
              {cuando && (
                <span className={`text-body-sm ${apremia ? 'font-semibold text-ink-primary' : 'text-ink-secondary'}`}>
                  {cuando}
                </span>
              )}
            </div>

            {s.hasDraft && s.state !== 'en-borrador' && (
              <p className="mt-2 text-body-sm text-warning-700">
                Ya tienes un borrador empezado: puedes seguir donde lo dejaste.
              </p>
            )}
          </div>
        </div>

        <div className="mt-5">
          {bloqueada ? (
            <p className="inline-flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-body-sm text-ink-secondary">
              <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
              {s.state === 'no-abierta'
                ? 'Todavía no se puede abrir. Vuelve en la fecha de apertura.'
                : 'Se desbloquea cuando completes lo que pide.'}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => onOpen(a.id)}
              className="inline-flex min-h-btn items-center gap-2 rounded-lg bg-accent px-5 text-body-base font-semibold text-white transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {accion}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
