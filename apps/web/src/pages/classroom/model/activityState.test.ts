import { describe, it, expect } from 'vitest'
import {
  bogotaDayKey,
  compareByUrgency,
  deriveStudentState,
  deriveTeacherState,
  matchesSearch,
  normalize,
  periodIdOf,
  sameBogotaDay,
  type ActivityLike,
} from './activityState'

/**
 * Estas pruebas fijan el contrato del estado de una actividad.
 *
 * Importan porque hoy la misma actividad puede tener dos verdades a la vez (el borde de color
 * y el badge se calculan por separado, en `getWorkInfo` y `getStudentTaskStatus`), y porque
 * todo lo relativo a "hoy" tiene que resolverse en hora de Colombia: un dispositivo en otra
 * zona no puede cambiar si una tarea está vencida.
 */

/** 20 de mayo de 2026, 10:00 en Bogotá (= 15:00 UTC). */
const AHORA = new Date('2026-05-20T15:00:00.000Z')

function act(over: Partial<ActivityLike> = {}): ActivityLike {
  return {
    id: 'a1',
    type: 'TASK',
    title: 'Tarea de fracciones',
    isPublished: true,
    ...over,
  }
}

describe('día de pared en Colombia', () => {
  it('usa la fecha de Bogotá, no la del dispositivo', () => {
    // 21 de mayo 02:00 UTC = 20 de mayo 21:00 en Colombia.
    expect(bogotaDayKey('2026-05-21T02:00:00.000Z')).toBe('2026-05-20')
  })

  it('reconoce el mismo día pese al cambio de fecha UTC', () => {
    expect(sameBogotaDay('2026-05-21T02:00:00.000Z', AHORA)).toBe(true)
  })

  it('devuelve null ante fechas ausentes o inválidas', () => {
    expect(bogotaDayKey(null)).toBeNull()
    expect(bogotaDayKey('no-es-fecha')).toBeNull()
    expect(sameBogotaDay(null, AHORA)).toBe(false)
  })
})

describe('estado del estudiante', () => {
  it('una entrega devuelta gana sobre cualquier otra cosa: exige actuar', () => {
    const d = deriveStudentState(
      act({ submissions: [{ status: 'RETURNED', score: 3 }], dueDate: '2026-05-10T23:59:00.000Z' }),
      AHORA,
    )
    expect(d.state).toBe('devuelta')
    // Aunque la fecha ya pasó, no se muestra "vencida": lo que toca es corregir.
    expect(d.urgency).toBeLessThan(10)
  })

  it('calificada expone la nota', () => {
    const d = deriveStudentState(act({ submissions: [{ status: 'GRADED', score: 4.5 }] }), AHORA)
    expect(d.state).toBe('calificada')
    expect(d.score).toBe(4.5)
  })

  it('entregada tarde sigue contando como entregada', () => {
    expect(deriveStudentState(act({ submissions: [{ status: 'LATE' }] }), AHORA).state).toBe('entregada')
  })

  it('vencida si la fecha límite ya pasó', () => {
    expect(deriveStudentState(act({ dueDate: '2026-05-19T23:59:00.000Z' }), AHORA).state).toBe('vencida')
  })

  it('vence hoy se decide por el día de Colombia, no por 24 horas', () => {
    // 21 de mayo 03:59 UTC = 20 de mayo 22:59 en Colombia → todavía es "hoy".
    const d = deriveStudentState(act({ dueDate: '2026-05-21T03:59:00.000Z' }), AHORA)
    expect(d.state).toBe('vence-hoy')
  })

  it('vence pronto dentro de las 48 horas siguientes', () => {
    expect(deriveStudentState(act({ dueDate: '2026-05-22T03:00:00.000Z' }), AHORA).state).toBe('vence-pronto')
  })

  it('pendiente cuando falta más de la ventana corta', () => {
    expect(deriveStudentState(act({ dueDate: '2026-06-30T23:59:00.000Z' }), AHORA).state).toBe('pendiente')
  })

  it('aún no abre cuando la fecha de apertura es futura', () => {
    const d = deriveStudentState(
      act({ openDate: '2026-05-25T13:00:00.000Z', dueDate: '2026-05-30T23:59:00.000Z' }),
      AHORA,
    )
    expect(d.state).toBe('no-abierta')
  })

  it('el candado del backend manda sobre todo lo demás', () => {
    const d = deriveStudentState(act({ locked: true, dueDate: '2026-05-01T00:00:00.000Z' }), AHORA)
    expect(d.state).toBe('bloqueada')
  })

  it('un borrador vencido se anuncia como vencido, pero recuerda que hay borrador', () => {
    const d = deriveStudentState(
      act({ submissions: [{ status: 'DRAFT' }], dueDate: '2026-05-18T23:59:00.000Z' }),
      AHORA,
    )
    expect(d.state).toBe('vencida')
    expect(d.hasDraft).toBe(true)
  })

  it('un borrador sin fecha se anuncia como sin enviar', () => {
    expect(deriveStudentState(act({ submissions: [{ status: 'DRAFT' }] }), AHORA).state).toBe('en-borrador')
  })

  it('solo reporta intentos cuando el tipo permite más de uno', () => {
    expect(deriveStudentState(act({ metadata: { maxAttempts: 1 } }), AHORA).attempt).toBeNull()
    expect(
      deriveStudentState(act({ metadata: { maxAttempts: 3 }, submissions: [{ status: 'DRAFT', attemptNumber: 2 }] }), AHORA)
        .attempt,
    ).toEqual({ current: 2, max: 3 })
  })
})

describe('estado del docente', () => {
  it('sin publicar y con fecha programada futura → programada', () => {
    const d = deriveTeacherState(
      act({ isPublished: false, scheduledPublishAt: '2026-05-22T13:00:00.000Z' }),
      AHORA,
    )
    expect(d.state).toBe('programada')
    expect(d.seProgramaPara).toBe('2026-05-22T13:00:00.000Z')
  })

  it('una programación ya vencida no sigue diciendo programada', () => {
    const d = deriveTeacherState(
      act({ isPublished: false, scheduledPublishAt: '2026-05-01T13:00:00.000Z' }),
      AHORA,
    )
    expect(d.state).toBe('borrador')
    expect(d.seProgramaPara).toBeNull()
  })

  it('calificar es lo primero cuando hay entregas esperando', () => {
    const d = deriveTeacherState(
      act({ gradingPending: 7, _count: { submissions: 12 }, dueDate: '2026-05-20T23:59:00.000Z' }),
      AHORA,
    )
    expect(d.state).toBe('por-calificar')
    expect(d.porCalificar).toBe(7)
    expect(d.urgency).toBe(0)
  })

  it('vencida sin entregas solo si de verdad no entregó nadie', () => {
    const vacia = deriveTeacherState(
      act({ dueDate: '2026-05-15T23:59:00.000Z', _count: { submissions: 0 } }),
      AHORA,
    )
    expect(vacia.state).toBe('vencida-sin-entregas')

    const conEntregas = deriveTeacherState(
      act({ dueDate: '2026-05-15T23:59:00.000Z', _count: { submissions: 9 } }),
      AHORA,
    )
    expect(conEntregas.state).toBe('publicada')
  })
})

describe('período', () => {
  it('el período propio de la actividad manda sobre el de su sección', () => {
    expect(periodIdOf(act({ academicTermId: 'p2', section: { id: 's', title: 'U1', academicTermId: 'p1' } }))).toBe('p2')
  })

  it('hereda el de la sección cuando no tiene propio', () => {
    expect(periodIdOf(act({ section: { id: 's', title: 'U1', academicTermId: 'p1' } }))).toBe('p1')
  })

  it('una actividad huérfana se reconoce como sin período', () => {
    // Es el resultado del defecto P0-1 (copia sin período). La UI tiene que poder mostrarla.
    expect(periodIdOf(act())).toBeNull()
  })
})

describe('búsqueda', () => {
  it('ignora tildes y mayúsculas', () => {
    expect(matchesSearch(act({ title: 'Lección de Álgebra' }), 'leccion algebra')).toBe(true)
  })

  it('exige que aparezcan todos los términos', () => {
    expect(matchesSearch(act({ title: 'Lección de Álgebra' }), 'leccion geometria')).toBe(false)
  })

  it('busca también en el nombre de la unidad', () => {
    const a = act({ title: 'Taller 3', section: { id: 's', title: 'Unidad 4: Geometría' } })
    expect(matchesSearch(a, 'geometria')).toBe(true)
  })

  it('una búsqueda vacía no filtra nada', () => {
    expect(matchesSearch(act(), '   ')).toBe(true)
  })

  it('normalize deja el texto comparable', () => {
    // La ñ también pierde su virgulilla: es deliberado. Un estudiante que escribe "nandu"
    // sin teclado en español debe encontrar "ñandú".
    expect(normalize('  ÁRBOL Ñandú  ')).toBe('arbol nandu')
  })
})

describe('orden', () => {
  it('primero la urgencia, luego la fecha más cercana, luego el título', () => {
    const a = act({ id: 'a', title: 'B', dueDate: '2026-06-01T00:00:00.000Z' })
    const b = act({ id: 'b', title: 'A', dueDate: '2026-05-25T00:00:00.000Z' })
    expect(compareByUrgency({ urgency: 1 }, a, { urgency: 0 }, b)).toBeGreaterThan(0)
    expect(compareByUrgency({ urgency: 0 }, a, { urgency: 0 }, b)).toBeGreaterThan(0)
    const sinFecha = act({ id: 'c', title: 'C' })
    expect(compareByUrgency({ urgency: 0 }, sinFecha, { urgency: 0 }, b)).toBeGreaterThan(0)
  })
})
