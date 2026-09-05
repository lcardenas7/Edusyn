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
 * El acento de color a la izquierda se conserva, pero solo en lo urgente y **siempre**
 * acompañado del chip de texto: refuerzo, nunca único canal.
 */

import { ChevronRight, Lock, Paperclip, PenLine } from 'lucide-react'
import type { DecoratedActivity, Role } from '../model/list'
import { activityTypeLabel, activityTypeMeta } from '../model/labels'
import { agoCopy, bogotaLongDate, bogotaTime, dueCopy, opensCopy } from '../model/countdown'
import { ActivityGlyph } from '../visual/ActivityGlyph'
import { StudentStateChip, TeacherStateChip } from './StateChip'

/**
 * Cuánto pesa visualmente una tarjeta según su estado.
 *
 * Antes todas pesaban igual: una que vence hoy y una ya calificada ocupaban el mismo espacio
 * con la misma forma, y el único canal que variaba era un icono de 44 px. En una lista de
 * catorce no había ritmo y todo se leía igual.
 *
 * Ahora lo que exige acción se ve entero y con el color de su tipo; lo terminado se encoge a
 * una fila tranquila donde la nota es lo que manda.
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

export function ActivityCard({ item, role, onOpen, showUnit = true, totalEstudiantes, now = new Date() }: ActivityCardProps) {
  const a = item.activity
  const s = item.student
  const t = item.teacher
  const bloqueada = s?.state === 'bloqueada'

  const estado = (role === 'estudiante' ? s?.state : t?.state) ?? ''
  const peso: Peso = (role === 'estudiante' ? PESO_ESTUDIANTE[estado] : PESO_DOCENTE[estado]) ?? 'normal'
  // El color del tipo pinta SIEMPRE el borde izquierdo: es lo que hace que una lista de quizzes
  // y tareas se vea variada en vez de catorce ladrillos iguales.
  const colorTipo = activityTypeMeta(a.type).ink

  // Requisitos que faltan para desbloquear (los calcula el backend; la UI solo los pinta).
  const requisitos: { prerequisiteId: string; title: string; satisfied: boolean }[] =
    (a as unknown as { requirements?: { prerequisiteId: string; title: string; satisfied: boolean }[] }).requirements ?? []

  // La línea de tiempo solo aparece cuando hay algo que decir. Repetir "Sin fecha de entrega"
  // en cada lección sin plazo es ruido: eso se dice en voz baja, en la fila de metadatos.
  const tiempo = (() => {
    if (role === 'docente') {
      if (t?.state === 'programada' && t.seProgramaPara) {
        return `Se publica sola el ${bogotaLongDate(t.seProgramaPara, now)} a las ${bogotaTime(t.seProgramaPara)}`
      }
      return a.dueDate ? dueCopy(a.dueDate, now) : null
    }
    // Cuando el trabajo ya está cerrado, la fecha límite deja de importar: lo que el
    // estudiante quiere saber es cuándo lo entregó. Decirle "Venció hace 8 días" en una
    // actividad que ya tiene nota es alarmar sin motivo.
    if ((s?.state === 'entregada' || s?.state === 'calificada') && s.entregadaEn) {
      return `Entregaste ${agoCopy(s.entregadaEn, now)}`
    }
    if (s?.state === 'entregada' || s?.state === 'calificada') return null
    const abre = opensCopy(a.openDate, now)
    if (abre) return abre
    return a.dueDate ? dueCopy(a.dueDate, now) : null
  })()

  const entregadas = t?.entregas ?? 0
  // El aula sabe cuántos estudiantes tiene; la actividad no siempre lo trae.
  const total = totalEstudiantes ?? (a as unknown as { studentCount?: number }).studentCount ?? null

  return (
    <button
      type="button"
      onClick={() => !bloqueada && onOpen(a.id)}
      disabled={bloqueada}
      aria-disabled={bloqueada}
      style={{
        borderLeftColor: colorTipo,
        // Lo que reclama atención lleva un filo grueso; lo cerrado, apenas una línea.
        borderLeftWidth: peso === 'reclama' ? 5 : peso === 'cerrado' ? 2 : 3,
      }}
      className={`group w-full rounded-card border border-hairline text-left transition-colors ${
        peso === 'cerrado' ? 'bg-surface-2/60 p-2.5 sm:p-3' : 'bg-surface-1 p-3 sm:p-4'
      } ${
        bloqueada
          ? 'cursor-not-allowed opacity-70'
          : 'hover:border-accent/40 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none'
      }`}
    >
      <div className="flex items-start gap-2.5 sm:gap-3">
        {/* Lo terminado también se encoge: ocupa menos sitio y pesa menos en la mirada. */}
        <ActivityGlyph type={a.type} size={peso === 'cerrado' ? 30 : 38} className="sm:hidden" />
        <ActivityGlyph type={a.type} size={peso === 'cerrado' ? 34 : 44} className="hidden sm:inline-flex" />

        <div className="min-w-0 flex-1">
          {/* Título + estado */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3
              className={`min-w-0 break-words font-semibold ${
                peso === 'cerrado' ? 'text-body-sm text-ink-secondary' : 'text-body-base text-ink-primary'
              }`}
            >
              {a.title}
            </h3>
            {role === 'estudiante' && s && s.state !== 'calificada' && (
              <StudentStateChip state={s.state} size="sm" />
            )}
            {role === 'docente' && t && (
              <TeacherStateChip
                state={t.state}
                suffix={t.state === 'por-calificar' ? `· ${t.porCalificar}` : undefined}
                size="sm"
              />
            )}
          </div>

          {/* Tipo · unidad */}
          <p className="mt-0.5 break-words text-body-sm text-ink-muted">
            {activityTypeLabel(a.type, a.metadata)}
            {showUnit && a.section?.title ? ` · ${a.section.title}` : ''}
          </p>

          {/* Tiempo, dicho en cristiano */}
          {tiempo && (
            <p
              className={`mt-1.5 text-body-sm font-medium ${
                s?.state === 'vencida' || s?.state === 'vence-hoy' ? 'text-ink-primary' : 'text-ink-secondary'
              }`}
            >
              {tiempo}
            </p>
          )}

          {/* Datos que existían y nunca se mostraban */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-ink-muted">
            {s?.attempt && (
              <span>
                Intento {s.attempt.current} de {s.attempt.max}
              </span>
            )}
            {s?.hasDraft && s.state !== 'en-borrador' && (
              <span className="inline-flex items-center gap-1 text-warning-700">
                <PenLine className="h-3.5 w-3.5" aria-hidden="true" /> Tienes un borrador sin enviar
              </span>
            )}
            {!a.dueDate && !a.openDate && <span>Sin fecha límite</span>}
            {a.maxScore != null && <span>Vale {Number(a.maxScore)}</span>}
            {(a as unknown as { attachmentUrl?: string }).attachmentUrl && (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5" aria-hidden="true" /> Con adjunto
              </span>
            )}
          </div>

          {/* Docente: cuántos entregaron, en barra + número */}
          {role === 'docente' && t && t.state !== 'borrador' && t.state !== 'programada' && (
            <div className="mt-2.5 flex items-center gap-2.5">
              {/* Sin saber cuántos estudiantes son, NO se dibuja barra: la versión anterior la
                  pintaba llena en cuanto hubiera una entrega, así que 11 de 37 se veía como
                  "entregaron todos". Una barra que miente es peor que ninguna barra. */}
              {total != null && (
                <div
                  className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-3"
                  role="img"
                  aria-label={`${entregadas} de ${total} entregaron`}
                >
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.min(100, (entregadas / Math.max(total, 1)) * 100)}%` }}
                  />
                </div>
              )}
              <span className="text-body-sm text-ink-muted">
                {total != null
                  ? `${entregadas} de ${total} entregaron`
                  : `${entregadas} ${entregadas === 1 ? 'entrega' : 'entregas'}`}
              </span>
            </div>
          )}

          {/* Qué falta para desbloquear */}
          {bloqueada && requisitos.length > 0 && (
            <div className="mt-2.5 rounded-lg border border-hairline bg-surface-2 px-3 py-2">
              <p className="text-xs font-semibold text-ink-secondary">Primero tienes que completar:</p>
              <ul className="mt-1 space-y-0.5">
                {requisitos.map((r) => (
                  <li key={r.prerequisiteId} className="flex items-center gap-1.5 text-body-sm">
                    <span aria-hidden="true" className={r.satisfied ? 'text-success-600' : 'text-ink-muted'}>
                      {r.satisfied ? '✓' : '○'}
                    </span>
                    <span className={r.satisfied ? 'text-ink-muted line-through' : 'text-ink-secondary'}>{r.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* En una actividad calificada, el dato que el estudiante busca es la nota. Sustituye
            al chevron y se lleva el peso visual que antes tenía el título. */}
        {role === 'estudiante' && s?.state === 'calificada' && s.score != null ? (
          <span className="mt-0.5 shrink-0 text-right">
            <span className="block text-h3 leading-none font-bold text-ink-primary tabular-nums">
              {s.score.toFixed(1)}
            </span>
            {a.maxScore != null && (
              <span className="block text-xs text-ink-muted">de {Number(a.maxScore)}</span>
            )}
          </span>
        ) : bloqueada ? (
          <Lock className="mt-1 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
        ) : (
          <ChevronRight
            className="mt-1 h-5 w-5 shrink-0 text-ink-muted transition-colors group-hover:text-accent"
            aria-hidden="true"
          />
        )}
      </div>
    </button>
  )
}
