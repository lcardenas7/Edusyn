import { describe, it, expect } from 'vitest'
import type { ActivityLike } from './activityState'
import { buildStudentToday, buildTeacherToday, ordenarAnuncios } from './today'
import { decorate, stateChipsFor } from './list'

/**
 * El objetivo declarado del tablero es que cada rol entienda su situación en menos de cinco
 * segundos. Eso solo se cumple si lo que sale arriba es de verdad lo más importante, así que
 * es exactamente lo que se prueba aquí.
 */

const AHORA = new Date('2026-05-20T15:00:00.000Z')
const UNIDAD = { id: 'u3', title: 'Unidad 3', academicTermId: 'p2' }

function act(over: Partial<ActivityLike> & { id: string }): ActivityLike {
  return { type: 'TASK', title: 'Actividad', isPublished: true, section: UNIDAD, ...over }
}

describe('tablero del estudiante', () => {
  it('el siguiente paso es lo más urgente, no lo más reciente', () => {
    const t = buildStudentToday(
      [
        act({ id: 'lejana', dueDate: '2026-06-30T22:00:00.000Z' }),
        act({ id: 'devuelta', submissions: [{ status: 'RETURNED' }] }),
        act({ id: 'hoy', dueDate: '2026-05-20T22:00:00.000Z' }),
      ],
      AHORA,
    )
    // Una devuelta pesa más que una que vence hoy: el profe ya la revisó y espera respuesta.
    expect(t.siguiente?.activity.id).toBe('devuelta')
    expect(t.meToca.map((d) => d.activity.id)).toEqual(['hoy'])
    expect(t.proximas.map((d) => d.activity.id)).toEqual(['lejana'])
  })

  it('no propone como siguiente paso algo que venció hace una semana', () => {
    // El caso que apareció al mirar el tablero: proponía un taller muerto por encima de una
    // lección devuelta y de un quiz que vencía ese mismo día.
    const t = buildStudentToday(
      [
        act({ id: 'muerta', dueDate: '2026-05-13T22:00:00.000Z' }),
        act({ id: 'hoy', dueDate: '2026-05-20T22:00:00.000Z' }),
        act({ id: 'devuelta', submissions: [{ status: 'RETURNED' }] }),
      ],
      AHORA,
    )
    expect(t.siguiente?.activity.id).toBe('devuelta')
    expect(t.meToca.map((d) => d.activity.id)).toEqual(['hoy', 'muerta'])
  })

  it('sin nada urgente, propone la pendiente más cercana en vez de quedarse mudo', () => {
    const t = buildStudentToday(
      [
        act({ id: 'julio', dueDate: '2026-07-01T22:00:00.000Z' }),
        act({ id: 'junio', dueDate: '2026-06-01T22:00:00.000Z' }),
      ],
      AHORA,
    )
    expect(t.siguiente?.activity.id).toBe('junio')
    expect(t.meToca).toHaveLength(0)
  })

  it('cuando de verdad no queda nada, lo dice', () => {
    const t = buildStudentToday(
      [act({ id: 'lista', submissions: [{ status: 'GRADED', score: 4.5 }] })],
      AHORA,
    )
    expect(t.siguiente).toBeNull()
    expect(t.progreso).toEqual({ hechas: 1, total: 1, pct: 100 })
  })

  it('el avance no castiga por lo que el estudiante no puede hacer todavía', () => {
    // Dos hechas, una pendiente, una bloqueada y una que aún no abre: el denominador son 3.
    const t = buildStudentToday(
      [
        act({ id: 'a', submissions: [{ status: 'GRADED', score: 4 }] }),
        act({ id: 'b', submissions: [{ status: 'SUBMITTED' }] }),
        act({ id: 'c', dueDate: '2026-06-10T22:00:00.000Z' }),
        act({ id: 'd', locked: true }),
        act({ id: 'e', openDate: '2026-06-01T13:00:00.000Z' }),
      ],
      AHORA,
    )
    expect(t.progreso).toEqual({ hechas: 2, total: 3, pct: 67 })
  })

  it('un aula vacía no divide por cero', () => {
    expect(buildStudentToday([], AHORA).progreso).toEqual({ hechas: 0, total: 0, pct: 0 })
  })

  it('las últimas notas salen de datos reales, no de un texto fijo', () => {
    // Hoy la tarjeta "Mis Calificaciones" del Home muestra una frase inventada (P1-6).
    const t = buildStudentToday(
      [
        act({
          id: 'vieja',
          maxScore: 5,
          submissions: [{ status: 'GRADED', score: 3.2, submittedAt: '2026-04-01T12:00:00.000Z' }],
        }),
        act({
          id: 'nueva',
          maxScore: 5,
          submissions: [{ status: 'GRADED', score: 4.6, submittedAt: '2026-05-15T12:00:00.000Z' }],
        }),
      ],
      AHORA,
    )
    expect(t.ultimasNotas.map((n) => n.activity.id)).toEqual(['nueva', 'vieja'])
    expect(t.ultimasNotas[0]).toMatchObject({ score: 4.6, maxScore: 5 })
  })

  it('no se le cuela al estudiante nada sin publicar', () => {
    const t = buildStudentToday([act({ id: 'draft', isPublished: false })], AHORA)
    expect(t.siguiente).toBeNull()
    expect(t.progreso.total).toBe(0)
  })
})

describe('tablero del docente', () => {
  const AULA: ActivityLike[] = [
    act({ id: 'calificar-a', gradingPending: 6, _count: { submissions: 18 } }),
    act({ id: 'calificar-b', gradingPending: 3, _count: { submissions: 9 } }),
    act({ id: 'hoy', dueDate: '2026-05-20T22:00:00.000Z', _count: { submissions: 4 } }),
    act({ id: 'desierta', dueDate: '2026-05-12T22:00:00.000Z', _count: { submissions: 0 } }),
    act({ id: 'borrador', isPublished: false }),
    act({ id: 'programada', isPublished: false, scheduledPublishAt: '2026-05-29T13:00:00.000Z' }),
  ]

  it('cuenta ENTREGAS por calificar, no actividades: es la carga real de trabajo', () => {
    const t = buildTeacherToday(AULA, AHORA)
    expect(t.porCalificar.entregas).toBe(9)
    expect(t.porCalificar.actividades).toHaveLength(2)
  })

  it('separa lo que vence hoy de lo que venció sin que nadie entregara', () => {
    const t = buildTeacherToday(AULA, AHORA)
    expect(t.vencenHoy.map((d) => d.activity.id)).toEqual(['hoy'])
    expect(t.sinEntregas.map((d) => d.activity.id)).toEqual(['desierta'])
  })

  it('una actividad que vence hoy Y tiene entregas por calificar sale en los dos paneles', () => {
    /*
     * Los paneles responden preguntas independientes. Se detectó mirando el tablero: decía
     * "Nada se cierra hoy" mientras el estudiante veía "Vence hoy a las 5:00 p.m." de esa
     * misma actividad, porque el estado excluyente `por-calificar` la absorbía.
     */
    const t = buildTeacherToday(
      [act({ id: 'ambas', dueDate: '2026-05-20T22:00:00.000Z', gradingPending: 6, _count: { submissions: 18 } })],
      AHORA,
    )
    expect(t.porCalificar.actividades.map((d) => d.activity.id)).toEqual(['ambas'])
    expect(t.vencenHoy.map((d) => d.activity.id)).toEqual(['ambas'])
  })

  it('un borrador que "vencería" hoy no cuenta: los estudiantes ni lo ven', () => {
    const t = buildTeacherToday(
      [act({ id: 'oculta', isPublished: false, dueDate: '2026-05-20T22:00:00.000Z' })],
      AHORA,
    )
    expect(t.vencenHoy).toHaveLength(0)
    expect(t.sinEntregas).toHaveLength(0)
  })

  it('lo que vence hoy sin entregas todavía no es "vencida sin entregas": aún hay horas', () => {
    const t = buildTeacherToday(
      [act({ id: 'hoy-vacia', dueDate: '2026-05-20T22:00:00.000Z', _count: { submissions: 0 } })],
      AHORA,
    )
    expect(t.vencenHoy).toHaveLength(1)
    expect(t.sinEntregas).toHaveLength(0)
  })

  it('distingue borrador de programada, que hoy se confunden', () => {
    const t = buildTeacherToday(AULA, AHORA)
    expect(t.borradores.map((d) => d.activity.id)).toEqual(['borrador'])
    expect(t.programadas.map((d) => d.activity.id)).toEqual(['programada'])
  })

  it('no cuenta borradores ni programadas como publicadas', () => {
    expect(buildTeacherToday(AULA, AHORA).publicadas).toBe(4)
  })

  it('reconoce cuando el docente está al día, para poder celebrarlo', () => {
    expect(buildTeacherToday(AULA, AHORA).todoAlDia).toBe(false)
    const limpio = buildTeacherToday(
      [act({ id: 'ok', dueDate: '2026-06-30T22:00:00.000Z', _count: { submissions: 20 } })],
      AHORA,
    )
    expect(limpio.todoAlDia).toBe(true)
  })
})

describe('el tablero y la lista no pueden contradecirse', () => {
  /**
   * Los paneles de "Hoy" y los chips de filtro de "Actividades" responden las mismas
   * preguntas. Si cada uno las calcula por su lado, el docente ve "Vencen hoy: 1" en el
   * tablero y ningún chip "Vencen hoy" en la lista. Pasó, y por eso ambos salen ahora de los
   * mismos predicados.
   */
  it('lo que el tablero cuenta es exactamente lo que el chip filtra', () => {
    const actividades = [
      act({ id: 'ambas', dueDate: '2026-05-20T22:00:00.000Z', gradingPending: 6, _count: { submissions: 18 } }),
      act({ id: 'desierta', dueDate: '2026-05-12T22:00:00.000Z', _count: { submissions: 0 } }),
      act({ id: 'borrador', isPublished: false }),
    ]
    const tablero = buildTeacherToday(actividades, AHORA)
    const chips = stateChipsFor('docente', AHORA)
    const cuenta = (id: string) => {
      const chip = chips.find((c) => c.id === id)!
      return actividades.filter((a) => chip.match(decorate(a, 'docente', AHORA))).length
    }

    expect(cuenta('vence-hoy')).toBe(tablero.vencenHoy.length)
    expect(cuenta('sin-entregas')).toBe(tablero.sinEntregas.length)
    expect(cuenta('por-calificar')).toBe(tablero.porCalificar.actividades.length)
    expect(cuenta('borrador')).toBe(tablero.borradores.length)
    // Y en concreto: la que vence hoy no desaparece por tener entregas por calificar.
    expect(cuenta('vence-hoy')).toBe(1)
  })
})

describe('muro de anuncios', () => {
  const anuncios = [
    { id: 'viejo', title: 'A', content: '', isPinned: false, createdAt: '2026-05-01T12:00:00.000Z' },
    { id: 'nuevo', title: 'B', content: '', isPinned: false, createdAt: '2026-05-19T12:00:00.000Z' },
    { id: 'fijado', title: 'C', content: '', isPinned: true, createdAt: '2026-04-01T12:00:00.000Z' },
  ]

  it('lo fijado manda, y dentro de cada grupo lo más reciente', () => {
    expect(ordenarAnuncios(anuncios).map((a) => a.id)).toEqual(['fijado', 'nuevo', 'viejo'])
  })

  it('respeta el límite', () => {
    expect(ordenarAnuncios(anuncios, 2).map((a) => a.id)).toEqual(['fijado', 'nuevo'])
  })

  it('no muta la lista que recibe', () => {
    const copia = [...anuncios]
    ordenarAnuncios(anuncios)
    expect(anuncios).toEqual(copia)
  })
})
