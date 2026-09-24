import { describe, expect, it } from 'vitest'
import { alumnosDeActividad, nombrePorApellido, resumenParticipacion } from './participacion'
import type { AlumnoActividad, EntregaLike } from '../data/useActividad'

const alumnos: AlumnoActividad[] = [
  { enrollmentId: 'e1', studentId: 's1', firstName: 'Ana', lastName: 'Zapata' },
  { enrollmentId: 'e2', studentId: 's2', firstName: 'Luis', lastName: 'Álvarez' },
  { enrollmentId: 'e3', studentId: 's3', firstName: 'Eva', lastName: 'Pérez' },
]
const entrega = (id: string, status: string): EntregaLike => ({
  id: `sub-${id}`, activityId: 'act', status, studentEnrollmentId: id,
  studentEnrollment: { id, student: {
    id: id.replace('e', 's'), firstName: alumnos.find(a => a.enrollmentId === id)!.firstName,
    lastName: alumnos.find(a => a.enrollmentId === id)!.lastName,
  } },
})

describe('participación en una actividad', () => {
  it('ordena entregas y pendientes por apellido, sin contar borradores como entregas', () => {
    const result = resumenParticipacion(alumnos, [entrega('e1', 'SUBMITTED'), entrega('e2', 'DRAFT'), entrega('e3', 'GRADED')])
    expect(result.entregaron.map(e => e.studentEnrollmentId)).toEqual(['e3', 'e1'])
    expect(result.sinEntregar?.map(a => a.enrollmentId)).toEqual(['e2'])
    expect(result.estudiantesQueEntregaron).toBe(2)
    expect(result.total).toBe(3)
  })

  it('conserva intentos y no duplica el conteo de estudiantes', () => {
    const result = resumenParticipacion(alumnos, [{ ...entrega('e1', 'RETURNED'), attemptNumber: 2 }, { ...entrega('e1', 'GRADED'), attemptNumber: 1 }])
    expect(result.entregaron.map(e => e.attemptNumber)).toEqual([2, 1])
    expect(result.estudiantesQueEntregaron).toBe(1)
    expect(result.sinEntregar).toHaveLength(2)
  })

  it('si falla la lista de matrículas, no inventa quién falta', () => {
    expect(resumenParticipacion(null, [entrega('e1', 'SUBMITTED')]).sinEntregar).toBeNull()
    expect(nombrePorApellido(alumnos[1])).toBe('Álvarez, Luis')
  })

  it('una actividad restringida solo muestra quienes fueron asignados', () => {
    expect(alumnosDeActividad(alumnos, [{ studentEnrollmentId: 'e2' }], true).map(a => a.enrollmentId)).toEqual(['e2'])
    expect(() => alumnosDeActividad(alumnos, null, true)).toThrow('asignados')
    expect(() => alumnosDeActividad(null, null, false)).toThrow('estudiantes')
  })
})
