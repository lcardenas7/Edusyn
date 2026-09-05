/**
 * El chip de estado: **texto + icono + color**, en ese orden de importancia.
 *
 * Es la corrección del hallazgo P1-1 de la auditoría: hoy el estado de una actividad se
 * codifica en un borde izquierdo de 4 px sin leyenda. Nadie aprende un código de colores que
 * nunca se explica, y quien no distingue rojo de naranja no lo aprende nunca.
 *
 * Regla: el color es refuerzo. Si le quitas el color al chip, sigue diciendo lo mismo.
 */

import {
  AlarmClock,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock,
  FileEdit,
  Lock,
  PenLine,
  RotateCcw,
  Send,
  TriangleAlert,
  UserX,
  type LucideIcon,
} from 'lucide-react'
import type { StateTone, StudentState, TeacherState } from '../model/labels'
import { TONE_CLASSES, studentStateMeta, teacherStateMeta } from '../model/labels'

const STUDENT_ICON: Record<StudentState, LucideIcon> = {
  bloqueada: Lock,
  'no-abierta': CalendarClock,
  devuelta: RotateCcw,
  vencida: TriangleAlert,
  'vence-hoy': AlarmClock,
  'vence-pronto': Clock,
  'en-borrador': PenLine,
  pendiente: Circle,
  entregada: Send,
  calificada: CheckCircle2,
}

const TEACHER_ICON: Record<TeacherState, LucideIcon> = {
  'por-calificar': ClipboardCheck,
  'vence-hoy': AlarmClock,
  'vencida-sin-entregas': UserX,
  borrador: FileEdit,
  programada: CalendarClock,
  publicada: CheckCircle2,
}

export interface ChipProps {
  /** Texto adicional pegado a la etiqueta, p. ej. la nota o el número de entregas. */
  suffix?: string
  size?: 'sm' | 'md'
  className?: string
}

function Chip({
  icon: Icon,
  label,
  tone,
  title,
  suffix,
  size = 'md',
  className = '',
}: {
  icon: LucideIcon
  label: string
  tone: StateTone
  title: string
  suffix?: string
  size?: 'sm' | 'md'
  className?: string
}) {
  const box = size === 'sm' ? 'gap-1 px-2 py-0.5 text-xs' : 'gap-1.5 px-2.5 py-1 text-badge'
  const ico = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border font-medium ${box} ${TONE_CLASSES[tone]} ${className}`}
      title={title}
    >
      <Icon className={`${ico} shrink-0`} aria-hidden="true" />
      <span className="whitespace-nowrap">
        {label}
        {suffix ? ` ${suffix}` : ''}
      </span>
    </span>
  )
}

export function StudentStateChip({ state, suffix, size, className }: { state: StudentState } & ChipProps) {
  const meta = studentStateMeta(state)
  return (
    <Chip
      icon={STUDENT_ICON[state]}
      label={meta.label}
      tone={meta.tone}
      title={meta.hint}
      suffix={suffix}
      size={size}
      className={className}
    />
  )
}

export function TeacherStateChip({ state, suffix, size, className }: { state: TeacherState } & ChipProps) {
  const meta = teacherStateMeta(state)
  return (
    <Chip
      icon={TEACHER_ICON[state]}
      label={meta.label}
      tone={meta.tone}
      title={meta.hint}
      suffix={suffix}
      size={size}
      className={className}
    />
  )
}

/**
 * Leyenda de estados. La auditoría señaló que el código de colores no se explica en ninguna
 * parte; esto va en un desplegable "¿Qué significan?" junto a los filtros.
 */
export function StateLegend({ role }: { role: 'docente' | 'estudiante' }) {
  const states: (StudentState | TeacherState)[] =
    role === 'estudiante'
      ? ['vencida', 'vence-hoy', 'devuelta', 'en-borrador', 'pendiente', 'entregada', 'calificada', 'no-abierta', 'bloqueada']
      : ['por-calificar', 'vence-hoy', 'vencida-sin-entregas', 'borrador', 'programada', 'publicada']

  return (
    <ul className="space-y-2">
      {states.map((s) => {
        const meta = role === 'estudiante' ? studentStateMeta(s as StudentState) : teacherStateMeta(s as TeacherState)
        return (
          <li key={s} className="flex items-start gap-2.5">
            {role === 'estudiante' ? (
              <StudentStateChip state={s as StudentState} size="sm" />
            ) : (
              <TeacherStateChip state={s as TeacherState} size="sm" />
            )}
            <span className="text-body-sm text-ink-secondary">{meta.hint}</span>
          </li>
        )
      })}
    </ul>
  )
}
