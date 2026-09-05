import { describe, it, expect } from 'vitest'
import type { ActivityLike } from './activityState'
import { buildUnits, SIN_UNIDAD_ID, type SeccionLike } from './units'
import { PERIOD_ALL, PERIOD_NONE } from './list'

/**
 * Lo que se prueba aquí es que una unidad sea de verdad un TEMA —material más trabajo— y no
 * otra lista de actividades. Es la única razón por la que esta pestaña existe.
 */

const AHORA = new Date('2026-05-20T15:00:00.000Z')

const SECCIONES: SeccionLike[] = [
  {
    id: 'u3',
    title: 'Unidad 3: Álgebra',
    academicTermId: 'p2',
    materials: [
      { id: 'm1', type: 'VIDEO_YOUTUBE', title: 'Qué es una ecuación' },
      { id: 'm2', type: 'DOCUMENT', title: 'Guía de ejercicios' },
      { id: 'm3', type: 'LINK', title: 'Borrador interno', isVisible: false },
    ],
  },
  {
    id: 'u4',
    title: 'Unidad 4: Geometría',
    academicTermId: 'p2',
    materials: [{ id: 'm4', type: 'TEXT', title: 'Resumen de áreas' }],
  },
  { id: 'u1', title: 'Unidad 1: Diagnóstico', academicTermId: 'p1', materials: [] },
  { id: 'uOculta', title: 'Unidad en preparación', academicTermId: 'p2', isVisible: false, materials: [] },
]

function act(over: Partial<ActivityLike> & { id: string }): ActivityLike {
  return { type: 'TASK', title: 'Actividad', isPublished: true, ...over }
}

const ACTIVIDADES: ActivityLike[] = [
  act({ id: 'a1', section: { id: 'u3', title: 'Unidad 3: Álgebra', academicTermId: 'p2' } }),
  act({
    id: 'a2',
    section: { id: 'u3', title: 'Unidad 3: Álgebra', academicTermId: 'p2' },
    submissions: [{ status: 'GRADED', score: 4 }],
  }),
  act({ id: 'a3', section: { id: 'u4', title: 'Unidad 4: Geometría', academicTermId: 'p2' } }),
  act({ id: 'a4', section: { id: 'u1', title: 'Unidad 1: Diagnóstico', academicTermId: 'p1' } }),
  // Producto del defecto P0-1: una copia sin sección ni período.
  act({ id: 'huerfana', title: 'Copia suelta' }),
]

const base = { secciones: SECCIONES, actividades: ACTIVIDADES, now: AHORA }

describe('una unidad es un tema, no una lista de actividades', () => {
  it('trae juntos el material de estudio y el trabajo', () => {
    const u = buildUnits({ ...base, role: 'estudiante', periodo: 'p2' })
    const u3 = u.find((x) => x.id === 'u3')!
    expect(u3.total).toEqual({ materiales: 2, actividades: 2 })
    expect(u3.materiales.map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  it('una unidad con material y sin actividades sigue siendo una unidad', () => {
    const u = buildUnits({
      secciones: [{ id: 'x', title: 'Solo lectura', materials: [{ id: 'm', type: 'TEXT', title: 'Apunte' }] }],
      actividades: [],
      role: 'estudiante',
      periodo: PERIOD_ALL,
      now: AHORA,
    })
    expect(u).toHaveLength(1)
    expect(u[0].total).toEqual({ materiales: 1, actividades: 0 })
  })
})

describe('qué ve cada rol', () => {
  it('el estudiante no ve unidades ni materiales ocultos', () => {
    const u = buildUnits({ ...base, role: 'estudiante', periodo: 'p2' })
    expect(u.map((x) => x.id)).not.toContain('uOculta')
    expect(u.find((x) => x.id === 'u3')!.materiales.map((m) => m.id)).not.toContain('m3')
  })

  it('el docente sí los ve, y la unidad oculta viene marcada', () => {
    const u = buildUnits({ ...base, role: 'docente', periodo: 'p2' })
    const oculta = u.find((x) => x.id === 'uOculta')
    expect(oculta?.oculta).toBe(true)
    expect(u.find((x) => x.id === 'u3')!.materiales.map((m) => m.id)).toContain('m3')
  })
})

describe('período', () => {
  it('filtra unidades y actividades por el período elegido', () => {
    const u = buildUnits({ ...base, role: 'docente', periodo: 'p1' })
    expect(u.map((x) => x.id)).toContain('u1')
    expect(u.map((x) => x.id)).not.toContain('u3')
  })

  it('con "todos" se ven todas', () => {
    const u = buildUnits({ ...base, role: 'docente', periodo: PERIOD_ALL })
    expect(u.map((x) => x.id)).toEqual(expect.arrayContaining(['u1', 'u3', 'u4']))
  })

  it('"sin período" encuentra lo que quedó huérfano', () => {
    const u = buildUnits({ ...base, role: 'docente', periodo: PERIOD_NONE })
    expect(u.map((x) => x.id)).toEqual([SIN_UNIDAD_ID])
  })
})

describe('nada se pierde', () => {
  it('una actividad sin unidad no desaparece: cae en "Sin unidad"', () => {
    // Esconderlas es exactamente como se pierden las cosas en el aula actual.
    const u = buildUnits({ ...base, role: 'docente', periodo: PERIOD_ALL })
    const sueltas = u.find((x) => x.id === SIN_UNIDAD_ID)
    expect(sueltas?.actividades.map((d) => d.activity.id)).toEqual(['huerfana'])
  })

  it('si no hay nada suelto, no se inventa el cubo', () => {
    const u = buildUnits({
      secciones: SECCIONES,
      actividades: ACTIVIDADES.filter((a) => a.id !== 'huerfana'),
      role: 'docente',
      periodo: PERIOD_ALL,
      now: AHORA,
    })
    expect(u.map((x) => x.id)).not.toContain(SIN_UNIDAD_ID)
  })
})

describe('avance por unidad', () => {
  it('el estudiante ve cuánto lleva de cada tema', () => {
    const u = buildUnits({ ...base, role: 'estudiante', periodo: 'p2' })
    expect(u.find((x) => x.id === 'u3')!.avance).toBe(50) // una de dos
  })

  it('no castiga por lo bloqueado ni por lo que aún no abre', () => {
    const u = buildUnits({
      secciones: [{ id: 'x', title: 'U', materials: [] }],
      actividades: [
        act({ id: 'ok', section: { id: 'x', title: 'U' }, submissions: [{ status: 'GRADED', score: 5 }] }),
        act({ id: 'bloq', section: { id: 'x', title: 'U' }, locked: true }),
      ],
      role: 'estudiante',
      periodo: PERIOD_ALL,
      now: AHORA,
    })
    expect(u[0].avance).toBe(100)
  })

  it('una unidad solo de lectura no muestra porcentaje inventado', () => {
    const u = buildUnits({
      secciones: [{ id: 'x', title: 'U', materials: [{ id: 'm', type: 'TEXT', title: 'Apunte' }] }],
      actividades: [],
      role: 'estudiante',
      periodo: PERIOD_ALL,
      now: AHORA,
    })
    expect(u[0].avance).toBeNull()
  })

  it('el docente no tiene "avance": no es su métrica', () => {
    const u = buildUnits({ ...base, role: 'docente', periodo: 'p2' })
    expect(u.every((x) => x.avance === null)).toBe(true)
  })
})
