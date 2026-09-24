import type { AlumnoActividad, EntregaLike } from '../data/useActividad'
import { compareStudents } from '../../../utils/sortStudents'

/** Nunca convertir una respuesta incompleta en "todos entregaron". */
export function alumnosDeActividad(
  roster: unknown,
  assignments: unknown,
  restricted: boolean,
): AlumnoActividad[] {
  if (!Array.isArray(roster)) throw new Error('No se recibió la lista de estudiantes del aula')
  if (!restricted) return roster
  if (!Array.isArray(assignments)) throw new Error('No se recibió la lista de estudiantes asignados')
  const ids = new Set(assignments.map((a) => a?.studentEnrollmentId).filter((id) => typeof id === 'string'))
  return roster.filter((a) => ids.has(a.enrollmentId))
}

function datosDe(entrega: EntregaLike) {
  return entrega.studentEnrollment?.student ?? {}
}

export function nombrePorApellido(student: { firstName?: string; lastName?: string; secondLastName?: string | null }): string {
  return [[student.lastName, student.secondLastName].filter(Boolean).join(' '), student.firstName]
    .filter(Boolean).join(', ') || 'Estudiante'
}

export function resumenParticipacion(alumnos: AlumnoActividad[] | null, entregas: EntregaLike[]) {
  // Un borrador sin enviar no cuenta como entrega. Una entrega devuelta sí se conserva en el
  // historial y se muestra con su estado para que el docente pueda seguir la corrección.
  const entregaron = entregas.filter((e) => e.status !== 'DRAFT').sort((a, b) => {
    const sa = datosDe(a)
    const sb = datosDe(b)
    const porApellido = compareStudents(sa, sb)
    if (porApellido) return porApellido
    return (b.attemptNumber ?? 0) - (a.attemptNumber ?? 0)
  })
  const ids = new Set(entregaron.map((e) => e.studentEnrollmentId ?? e.studentEnrollment?.id).filter(Boolean))
  const sinEntregar = alumnos?.filter((a) => !ids.has(a.enrollmentId))
    .sort((a, b) => compareStudents(
      { ...a, secondLastName: a.secondLastName ?? undefined },
      { ...b, secondLastName: b.secondLastName ?? undefined },
    )) ?? null
  return {
    entregaron,
    sinEntregar,
    total: alumnos?.length ?? null,
    estudiantesQueEntregaron: alumnos ? alumnos.length - (sinEntregar?.length ?? 0) : ids.size,
  }
}
