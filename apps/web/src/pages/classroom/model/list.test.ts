import { describe, it, expect } from 'vitest'
import type { ActivityLike } from './activityState'
import {
  availableTypes,
  buildActivityList,
  EMPTY_FILTERS,
  PERIOD_ALL,
  PERIOD_NONE,
  stateChipsFor,
  type ListFilters,
} from './list'

/**
 * El pipeline decide QUÉ se ve y EN QUÉ ORDEN. Se prueba aquí, y no en la vista, por dos
 * razones concretas de la auditoría:
 *
 *  - C5: hoy los conteos de los chips no cuadran con la lista, porque se calculan por caminos
 *    distintos. Aquí salen del mismo universo, y la prueba lo fija.
 *  - E2: hoy "Ver todas" no limpia el filtro de período, así que el clic no resuelve el vacío.
 *    Aquí el período es parte del mismo objeto de filtros y limpiarlo es una sola operación.
 */

const AHORA = new Date('2026-05-20T15:00:00.000Z')

function act(over: Partial<ActivityLike> & { id: string }): ActivityLike {
  return { type: 'TASK', title: 'Actividad', isPublished: true, ...over }
}

const UNIDAD_3 = { id: 'u3', title: 'Unidad 3: Álgebra', academicTermId: 'p2' }
const UNIDAD_4 = { id: 'u4', title: 'Unidad 4: Geometría', academicTermId: 'p2' }

/** Un aula realista: dos períodos, dos unidades y una huérfana sin período. */
const AULA: ActivityLike[] = [
  act({
    id: 'por-calificar',
    title: 'Taller de ecuaciones',
    section: UNIDAD_3,
    dueDate: '2026-05-18T23:59:00.000Z',
    gradingPending: 5,
    _count: { submissions: 14 },
  }),
  act({
    id: 'vence-hoy',
    title: 'Quiz de proporciones',
    type: 'QUIZ',
    section: UNIDAD_3,
    dueDate: '2026-05-20T23:59:00.000Z',
    _count: { submissions: 3 },
  }),
  act({
    id: 'borrador',
    title: 'Examen del período',
    type: 'EXAM',
    section: UNIDAD_4,
    isPublished: false,
  }),
  act({
    id: 'sin-entregas',
    title: 'Lectura de áreas',
    type: 'LESSON',
    section: UNIDAD_4,
    dueDate: '2026-05-12T23:59:00.000Z',
    _count: { submissions: 0 },
  }),
  act({
    id: 'periodo-1',
    title: 'Diagnóstico inicial',
    section: { id: 'u1', title: 'Unidad 1: Diagnóstico', academicTermId: 'p1' },
    dueDate: '2026-02-10T23:59:00.000Z',
    _count: { submissions: 20 },
  }),
  act({
    // Producto del defecto P0-1: una copia que quedó sin período ni sección.
    id: 'huerfana',
    title: 'Copia de Taller de ecuaciones',
    isPublished: false,
  }),
]

function filters(over: Partial<ListFilters> = {}): ListFilters {
  return { ...EMPTY_FILTERS, ...over }
}

describe('el período es el organizador primario', () => {
  it('con "todos" se ven también las actividades de otros períodos', () => {
    const r = buildActivityList({ activities: AULA, role: 'docente', filters: filters(), groupBy: 'unidad', now: AHORA })
    expect(r.total).toBe(6)
  })

  it('filtrar por un período deja fuera al resto', () => {
    const r = buildActivityList({
      activities: AULA,
      role: 'docente',
      filters: filters({ period: 'p2' }),
      groupBy: 'unidad',
      now: AHORA,
    })
    expect(r.total).toBe(4)
  })

  it('las copias sin período se pueden encontrar en vez de quedar invisibles', () => {
    const r = buildActivityList({
      activities: AULA,
      role: 'docente',
      filters: filters({ period: PERIOD_NONE }),
      groupBy: 'unidad',
      now: AHORA,
    })
    expect(r.groups.flatMap((g) => g.items).map((d) => d.activity.id)).toEqual(['huerfana'])
  })
})

describe('los conteos de los chips salen del mismo universo que la lista', () => {
  it('cada chip cuenta lo que mostraría al pulsarlo', () => {
    const base = { activities: AULA, role: 'docente' as const, groupBy: 'unidad' as const, now: AHORA }
    const r = buildActivityList({ ...base, filters: filters() })

    for (const chip of stateChipsFor('docente')) {
      const alFiltrar = buildActivityList({ ...base, filters: filters({ state: chip.id }) })
      expect(alFiltrar.visible, `chip ${chip.id}`).toBe(r.chipCounts[chip.id])
    }
  })

  it('los conteos respetan el período elegido', () => {
    const r = buildActivityList({
      activities: AULA,
      role: 'docente',
      filters: filters({ period: 'p1' }),
      groupBy: 'unidad',
      now: AHORA,
    })
    expect(r.chipCounts['por-calificar']).toBe(0)
    expect(r.chipCounts['todas']).toBe(1)
  })
})

describe('agrupación', () => {
  it('por unidad deja "Sin unidad" al final', () => {
    const r = buildActivityList({
      activities: AULA,
      role: 'docente',
      filters: filters(),
      groupBy: 'unidad',
      now: AHORA,
    })
    expect(r.groups.at(-1)?.label).toBe('Sin unidad')
  })

  it('por estado pone primero lo que exige trabajo del docente', () => {
    const r = buildActivityList({
      activities: AULA,
      role: 'docente',
      filters: filters(),
      groupBy: 'estado',
      now: AHORA,
    })
    expect(r.groups[0].label).toBe('Por calificar')
    expect(r.groups.map((g) => g.label)).toContain('Borradores')
  })

  it('por vencimiento usa cubos de calendario, no una fecha por grupo', () => {
    const r = buildActivityList({
      activities: AULA,
      role: 'docente',
      filters: filters(),
      groupBy: 'vencimiento',
      now: AHORA,
    })
    const labels = r.groups.map((g) => g.label)
    expect(labels[0]).toBe('Ya vencieron')
    expect(labels).toContain('Hoy')
    expect(labels.at(-1)).toBe('Sin fecha de entrega')
  })

  it('cada grupo de estado explica de qué va', () => {
    const r = buildActivityList({
      activities: AULA,
      role: 'docente',
      filters: filters(),
      groupBy: 'estado',
      now: AHORA,
    })
    expect(r.groups.every((g) => !!g.hint)).toBe(true)
  })
})

describe('búsqueda y tipo', () => {
  it('la búsqueda atraviesa la agrupación', () => {
    const r = buildActivityList({
      activities: AULA,
      role: 'docente',
      filters: filters({ search: 'ecuaciones' }),
      groupBy: 'unidad',
      now: AHORA,
    })
    expect(r.visible).toBe(2) // el taller y su copia huérfana
  })

  it('el filtro de tipo usa familias, no enums crudos', () => {
    const r = buildActivityList({
      activities: AULA,
      role: 'docente',
      filters: filters({ type: 'examen' }),
      groupBy: 'unidad',
      now: AHORA,
    })
    expect(r.visible).toBe(1)
  })

  it('solo se ofrecen los tipos que existen en el aula', () => {
    const tipos = availableTypes(AULA).map((t) => t.family)
    expect(tipos).toEqual(expect.arrayContaining(['tarea', 'quiz', 'examen', 'leccion']))
    expect(tipos).not.toContain('icfes')
  })
})

describe('limpiar filtros', () => {
  it('el período forma parte de los filtros, así que "quitar filtros" también lo restablece', () => {
    const conFiltros = filters({ period: 'p1', search: 'nada', type: 'quiz', state: 'borrador' })
    const r = buildActivityList({ activities: AULA, role: 'docente', filters: conFiltros, groupBy: 'unidad', now: AHORA })
    expect(r.visible).toBe(0)
    expect(r.filtered).toBe(true)

    const limpio = buildActivityList({
      activities: AULA,
      role: 'docente',
      filters: EMPTY_FILTERS,
      groupBy: 'unidad',
      now: AHORA,
    })
    expect(limpio.filtered).toBe(false)
    expect(limpio.visible).toBe(6)
    expect(EMPTY_FILTERS.period).toBe(PERIOD_ALL)
  })
})

describe('vista del estudiante', () => {
  const DEL_ALUMNO: ActivityLike[] = [
    act({ id: 'devuelta', title: 'Ensayo', section: UNIDAD_3, submissions: [{ status: 'RETURNED' }] }),
    act({ id: 'hoy', title: 'Quiz', type: 'QUIZ', section: UNIDAD_3, dueDate: '2026-05-20T23:59:00.000Z' }),
    act({ id: 'lista', title: 'Taller', section: UNIDAD_3, submissions: [{ status: 'GRADED', score: 4.2 }] }),
    act({ id: 'lejos', title: 'Proyecto', section: UNIDAD_4, dueDate: '2026-07-01T23:59:00.000Z' }),
  ]

  it('"Me toca" reúne todo lo que exige acción del estudiante', () => {
    const r = buildActivityList({
      activities: DEL_ALUMNO,
      role: 'estudiante',
      filters: filters({ state: 'me-toca' }),
      groupBy: 'estado',
      now: AHORA,
    })
    expect(r.visible).toBe(2)
    expect(r.groups[0].label).toBe('Para corregir')
  })

  it('lo terminado baja al final de la lista', () => {
    const r = buildActivityList({
      activities: DEL_ALUMNO,
      role: 'estudiante',
      filters: filters(),
      groupBy: 'unidad',
      now: AHORA,
    })
    const unidad3 = r.groups.find((g) => g.label === UNIDAD_3.title)!
    expect(unidad3.items.map((d) => d.activity.id)).toEqual(['devuelta', 'hoy', 'lista'])
  })

  it('la nota viaja con la actividad calificada', () => {
    const r = buildActivityList({
      activities: DEL_ALUMNO,
      role: 'estudiante',
      filters: filters(),
      groupBy: 'unidad',
      now: AHORA,
    })
    const calificada = r.groups.flatMap((g) => g.items).find((d) => d.activity.id === 'lista')
    expect(calificada?.student?.score).toBe(4.2)
  })
})
