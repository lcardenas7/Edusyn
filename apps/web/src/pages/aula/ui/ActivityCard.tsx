/**
 * La tarjeta de actividad. Es **el** componente del aula: es lo que un estudiante mira cien
 * veces al mes.
 *
 * Qué corrige respecto de la lista actual:
 *  - P1-1 El estado se dice con texto, no solo con un borde de color sin leyenda.
 *  - P1-5 Se muestran los datos que ya existían y nunca se pintaban: fecha de apertura,
 *         intentos ("Intento 2 de 3"), entregas del grupo.
 *  - G3   La fecha se dice en español claro ("Venció hace 3 días"), no "Vence 12 jun" en rojo.
 *  - X7   Sin emoji como canal de estado.
 *
 * Y dos cosas que pidió el fundador viendo la lista con sus datos:
 *
 *  1. **El tipo se lee como tipo.** Antes era un icono de color y una línea gris pequeña bajo
 *     el título; catorce actividades parecían la misma. Ahora cada tarjeta lleva arriba una
 *     banda con el color y el NOMBRE de su tipo, que es lo primero que se ve.
 *  2. **Las tarjetas caben en parrilla.** Estructura de altura consistente —cabecera, cuerpo,
 *     pie— para poder ponerlas de dos en dos sin que queden desiguales.
 *
 * El peso visual sigue al estado: lo que reclama acción va entero, lo terminado se apaga y
 * deja que la nota sea lo que se vea.
 */

import { Lock, Paperclip, PenLine } from 'lucide-react'
import type { DecoratedActivity, Role } from '../model/list'
import { activityTypeLabel, activityTypeMeta } from '../model/labels'
import { agoCopy, bogotaLongDate, bogotaTime, dueCopy, opensCopy } from '../model/countdown'
import { ActivityGlyph } from '../visual/ActivityGlyph'
import { StudentStateChip, TeacherStateChip } from './StateChip'

/**
 * Cuánto pesa visualmente una tarjeta según su estado. Antes todas pesaban igual: una que vence
 * hoy y una ya calificada ocupaban el mismo espacio con la misma forma.
 */
type Peso = 'reclama' | 'normal' | 'cerrado'

const PESO_ESTUDIANTE: Record<string, Peso> = {
  vencida: 'reclama',
  'vence-hoy': 'reclama',
  devuelta: 'reclama',
  'vence-pronto': 'reclama',
  'en-borrador': 'reclama',
  pendiente: 'normal',
  'no-abierta': 'normal',
  bloqueada: 'normal',
  entregada: 'cerrado',
  calificada: 'cerrado',
}

const PESO_DOCENTE: Record<string, Peso> = {
  'por-calificar': 'reclama',
  'vence-hoy': 'reclama',
  'vencida-sin-entregas': 'reclama',
  borrador: 'normal',
  programada: 'normal',
  publicada: 'cerrado',
}

export interface ActivityCardProps {
  item: DecoratedActivity
  role: Role
  onOpen: (activityId: string) => void
  /** Muestra el nombre de la unidad. Se apaga cuando la lista ya está agrupada por unidad. */
  showUnit?: boolean
  /** Estudiantes del grupo. Sin este dato no se dibuja la barra de entregas. */
  totalEstudiantes?: number | null
  now?: Date
}

export function ActivityCard({
  item,
  role,
  onOpen,
  showUnit = true,
  totalEstudiantes,
  now = new Date(),
}: ActivityCardProps) {
  const a = item.activity
  const s = item.student
  const t = item.teacher
  const bloqueada = s?.state === 'bloqueada'

  const estado = (role === 'estudiante' ? s?.state : t?.state) ?? ''
  const peso: Peso = (role === 'estudiante' ? PESO_ESTUDIANTE[estado] : PESO_DOCENTE[estado]) ?? 'normal'
  const meta = activityTypeMeta(a.type)
  const cerrado = peso === 'cerrado'

  const requisitos: { prerequisiteId: string; title: string; satisfied: boolean }[] =
    (a as unknown as { requirements?: { prerequisiteId: string; title: string; satisfied: boolean }[] }).requirements ?? []

  const tiempo = (() => {
    if (role === 'docente') {
      if (t?.state === 'programada' && t.seProgramaPara) {
        return `Se publica el ${bogotaLongDate(t.seProgramaPara, now)} a las ${bogotaTime(t.seProgramaPara)}`
      }
      return a.dueDate ? dueCopy(a.dueDate, now) : null
    }
    if ((s?.state === 'entregada' || s?.state === 'calificada') && s.entregadaEn) {
      return `Entregaste ${agoCopy(s.entregadaEn, now)}`
    }
    if (s?.state === 'entregada' || s?.state === 'calificada') return null
    return opensCopy(a.openDate, now) ?? (a.dueDate ? dueCopy(a.dueDate, now) : null)
  })()

  const entregadas = t?.entregas ?? 0
  const total = totalEstudiantes ?? (a as unknown as { studentCount?: number }).studentCount ?? null
  const adjunto = (a as unknown as { attachmentUrl?: string }).attachmentUrl
  const notaVisible = role === 'estudiante' && s?.state === 'calificada' && s.score != null

  return (
    <button
      type="button"
      onClick={() => !bloqueada && onOpen(a.id)}
      disabled={bloqueada}
      aria-disabled={bloqueada}
      className={`group flex h-full w-full flex-col overflow-hidden rounded-card border border-hairline text-left transition-colors ${
        cerrado ? 'bg-surface-2/50' : 'bg-surface-1'
      } ${
        bloqueada
          ? 'cursor-not-allowed opacity-70'
          : 'hover:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none'
      }`}
    >
      {/* ── Portada del tipo. Misma familia visual que las tarjetas de curso y de unidad:
             degradado del color del tipo con su glifo en grande. Es lo que convierte la lista
             en algo que se mira, en vez de una pila de rectángulos horizontales. ── */}
      <div
        className="relative shrink-0 overflow-hidden"
        style={{
          height: cerrado ? 44 : 68,
          backgroundImage: `linear-gradient(135deg, ${meta.ink}${cerrado ? '14' : '26'} 0%, ${meta.ink}0D 60%, ${meta.ink}06 100%)`,
        }}
      >
        <span className="absolute -right-2 -bottom-3 opacity-[0.18]" aria-hidden="true">
          <ActivityGlyph type={a.type} size={cerrado ? 62 : 88} variant="bare" />
        </span>
        <span className="absolute bottom-2 left-3" aria-hidden="true">
          <ActivityGlyph type={a.type} size={cerrado ? 28 : 36} />
        </span>

        <span className="absolute top-2 right-2.5">
          {role === 'estudiante' && s && !notaVisible && <StudentStateChip state={s.state} size="sm" />}
          {role === 'docente' && t && (
            <TeacherStateChip
              state={t.state}
              suffix={t.state === 'por-calificar' ? `· ${t.porCalificar}` : undefined}
              size="sm"
            />
          )}
        </span>
      </div>

      {/* ── Cuerpo ─────────────────────────────────────────────────────────── */}
      <div className={`flex min-w-0 flex-1 flex-col px-3 ${cerrado ? 'py-2.5' : 'py-3'}`}>
        <div className="flex items-start justify-between gap-2">
          <span
            className="min-w-0 truncate text-xs font-bold tracking-wide uppercase"
            style={{ color: meta.ink, opacity: cerrado ? 0.6 : 1 }}
          >
            {activityTypeLabel(a.type, a.metadata)}
          </span>
          {/* La nota es el dato que el estudiante busca. */}
          {notaVisible && (
            <span className="shrink-0 text-right leading-none">
              <span className="text-h3 font-bold text-ink-primary tabular-nums">{s!.score!.toFixed(1)}</span>
              {a.maxScore != null && (
                <span className="ml-0.5 text-xs text-ink-muted">/{Number(a.maxScore)}</span>
              )}
            </span>
          )}
          {bloqueada && <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />}
        </div>

        <h3
          className={`mt-1 min-w-0 break-words font-semibold ${
            cerrado ? 'text-body-sm text-ink-secondary' : 'text-body-base text-ink-primary'
          }`}
        >
          {a.title}
        </h3>
        {showUnit && a.section?.title && (
          <p className="mt-0.5 truncate text-body-sm text-ink-muted">{a.section.title}</p>
        )}

        {tiempo && (
          <p
            className={`mt-1.5 text-body-sm ${
              peso === 'reclama' ? 'font-medium text-ink-primary' : 'text-ink-secondary'
            }`}
          >
            {tiempo}
          </p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-ink-muted">
          {s?.attempt && (
            <span>
              Intento {s.attempt.current} de {s.attempt.max}
            </span>
          )}
          {s?.hasDraft && s.state !== 'en-borrador' && (
            <span className="inline-flex items-center gap-1 text-warning-700">
              <PenLine className="h-3.5 w-3.5" aria-hidden="true" /> Borrador sin enviar
            </span>
          )}
          {!a.dueDate && !a.openDate && !cerrado && <span>Sin fecha límite</span>}
          {a.maxScore != null && !notaVisible && <span>Vale {Number(a.maxScore)}</span>}
          {adjunto && (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="h-3.5 w-3.5" aria-hidden="true" /> Adjunto
            </span>
          )}
        </div>

        {bloqueada && requisitos.length > 0 && (
          <div className="mt-2.5 rounded-lg border border-hairline bg-surface-2 px-3 py-2">
            <p className="text-xs font-semibold text-ink-secondary">Primero tienes que completar:</p>
            <ul className="mt-1 space-y-0.5">
              {requisitos.map((r) => (
                <li key={r.prerequisiteId} className="flex items-center gap-1.5 text-body-sm">
                  <span aria-hidden="true" className={r.satisfied ? 'text-success-600' : 'text-ink-muted'}>
                    {r.satisfied ? '✓' : '○'}
                  </span>
                  <span className={r.satisfied ? 'text-ink-muted line-through' : 'text-ink-secondary'}>
                    {r.title}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Pie: cuántos entregaron. Va al fondo para que en parrilla todas cuadren. ── */}
      {role === 'docente' && t && t.state !== 'borrador' && t.state !== 'programada' && (
        <div className="mt-auto flex items-center gap-2.5 border-t border-hairline px-3 py-2">
          {/* Sin saber cuántos estudiantes son NO se dibuja barra: antes se pintaba llena en
              cuanto hubiera una entrega, así que 11 de 37 se veía como "entregaron todos". */}
          {total != null && (
            <div
              className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-surface-3"
              role="img"
              aria-label={`${entregadas} de ${total} entregaron`}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (entregadas / Math.max(total, 1)) * 100)}%`,
                  backgroundColor: meta.ink,
                }}
              />
            </div>
          )}
          <span className="truncate text-body-sm text-ink-muted">
            {total != null
              ? `${entregadas} de ${total} entregaron`
              : `${entregadas} ${entregadas === 1 ? 'entrega' : 'entregas'}`}
          </span>
        </div>
      )}
    </button>
  )
}
