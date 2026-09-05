import { describe, it, expect } from 'vitest'
import { agoCopy, bogotaDayDelta, bogotaShortDate, dueCopy, milestonesOf, opensCopy } from './countdown'

/**
 * Las fechas se dicen como las diría una persona. La auditoría (G3) encontró que la tarjeta
 * seguía diciendo "Vence 12 jun" tres días después de vencer, cambiando solo de color: un
 * estudiante no traduce eso a "llevo tres días de retraso".
 */

/** 20 de mayo de 2026, 10:00 en Bogotá. */
const AHORA = new Date('2026-05-20T15:00:00.000Z')

describe('distancia en días de calendario colombiano', () => {
  it('cuenta días de pared, no bloques de 24 horas', () => {
    // 21 de mayo 02:00 UTC = 20 de mayo 21:00 en Colombia → sigue siendo hoy.
    expect(bogotaDayDelta('2026-05-21T02:00:00.000Z', AHORA)).toBe(0)
    // 21 de mayo 06:00 UTC = 21 de mayo 01:00 en Colombia → ya es mañana.
    expect(bogotaDayDelta('2026-05-21T06:00:00.000Z', AHORA)).toBe(1)
  })

  it('es negativa hacia el pasado', () => {
    expect(bogotaDayDelta('2026-05-17T15:00:00.000Z', AHORA)).toBe(-3)
  })

  it('devuelve null sin fecha', () => {
    expect(bogotaDayDelta(null, AHORA)).toBeNull()
  })
})

describe('cómo se dice una fecha límite', () => {
  it('hoy incluye la hora, porque es lo que decide si alcanzo', () => {
    expect(dueCopy('2026-05-20T22:59:00.000Z', AHORA)).toMatch(/^Vence hoy a las /)
  })

  it('si la hora de hoy ya pasó, lo dice en pasado', () => {
    // A las 6 de la tarde, una tarea que cerraba a las 5 no "vence hoy": ya venció. Decirlo en
    // presente contradecía al chip de estado, que sí la marcaba como vencida.
    // AHORA = 20 de mayo, 10:00 en Bogotá; la fecha límite fueron las 8:00 del mismo día.
    expect(dueCopy('2026-05-20T13:00:00.000Z', AHORA)).toMatch(/^Venció hoy a las /)
  })

  it('mañana y los días siguientes se dicen en cristiano', () => {
    expect(dueCopy('2026-05-21T15:00:00.000Z', AHORA)).toBe('Vence mañana')
    expect(dueCopy('2026-05-23T15:00:00.000Z', AHORA)).toBe('Te quedan 3 días')
  })

  it('el pasado se dice en pasado, no como una fecha suelta', () => {
    expect(dueCopy('2026-05-19T15:00:00.000Z', AHORA)).toBe('Venció ayer')
    expect(dueCopy('2026-05-17T15:00:00.000Z', AHORA)).toBe('Venció hace 3 días')
  })

  it('lo lejano usa la fecha completa', () => {
    expect(dueCopy('2026-06-12T15:00:00.000Z', AHORA)).toBe('Vence el 12 de junio')
  })

  it('sin fecha lo dice, en vez de dejar el hueco', () => {
    expect(dueCopy(null, AHORA)).toBe('Sin fecha de entrega')
  })
})

describe('fecha de apertura', () => {
  it('calla si la actividad ya abrió: no hay nada que anunciar', () => {
    expect(opensCopy('2026-05-10T15:00:00.000Z', AHORA)).toBeNull()
    expect(opensCopy(null, AHORA)).toBeNull()
  })

  it('anuncia la apertura futura', () => {
    expect(opensCopy('2026-05-21T15:00:00.000Z', AHORA)).toBe('Se abre mañana')
    expect(opensCopy('2026-05-24T15:00:00.000Z', AHORA)).toBe('Se abre en 4 días')
    expect(opensCopy('2026-07-01T15:00:00.000Z', AHORA)).toBe('Se abre el 1 de julio')
  })
})

describe('tiempo transcurrido', () => {
  it('sirve para anuncios y entregas', () => {
    expect(agoCopy('2026-05-20T12:00:00.000Z', AHORA)).toBe('hoy')
    expect(agoCopy('2026-05-19T12:00:00.000Z', AHORA)).toBe('ayer')
    expect(agoCopy('2026-05-16T12:00:00.000Z', AHORA)).toBe('hace 4 días')
  })
})

describe('línea de tiempos', () => {
  it('solo incluye los hitos que existen', () => {
    const hitos = milestonesOf(
      { publishedAt: '2026-05-10T15:00:00.000Z', dueDate: '2026-05-25T15:00:00.000Z' },
      AHORA,
    )
    expect(hitos.map((h) => h.key)).toEqual(['publicada', 'vence'])
  })

  it('va en orden cronológico, no por el ciclo de vida', () => {
    // Quien entrega antes de la fecha límite vería "Vence 20 de mayo" y a su derecha
    // "Entregada 19 de mayo", que es justo lo que una línea de tiempo no puede hacer.
    const hitos = milestonesOf(
      { dueDate: '2026-05-20T22:00:00.000Z', submittedAt: '2026-05-19T20:00:00.000Z' },
      AHORA,
    )
    expect(hitos.map((h) => h.key)).toEqual(['entregada', 'vence'])
  })

  it('marca como cumplido solo lo que ya pasó', () => {
    const hitos = milestonesOf(
      {
        publishedAt: '2026-05-10T15:00:00.000Z',
        openDate: '2026-05-12T15:00:00.000Z',
        dueDate: '2026-05-25T15:00:00.000Z',
        submittedAt: '2026-05-18T15:00:00.000Z',
      },
      AHORA,
    )
    // Cronológico: la entrega (18 de mayo) va antes que el vencimiento (25 de mayo).
    expect(hitos.map((h) => [h.key, h.done])).toEqual([
      ['publicada', true],
      ['abre', true],
      ['entregada', true],
      ['vence', false],
    ])
  })

  it('sin fechas no inventa hitos vacíos', () => {
    expect(milestonesOf({}, AHORA)).toEqual([])
  })
})

describe('fecha corta', () => {
  it('no arrastra el punto de la abreviatura', () => {
    expect(bogotaShortDate('2026-06-12T15:00:00.000Z')).not.toContain('.')
  })
})
