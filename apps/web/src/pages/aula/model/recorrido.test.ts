import { describe, it, expect } from 'vitest'
import { avanceDelRecorrido, claveDeMaterial, construirRecorrido, type Paso } from './recorrido'
import { decorate } from './list'
import type { ActivityLike } from './activityState'
import type { Unidad } from './units'

const AHORA = new Date('2026-05-20T15:00:00.000Z')

function act(over: Partial<ActivityLike> & { id: string }): ActivityLike {
  return { type: 'TASK', title: 'Actividad', isPublished: true, ...over }
}

function unidad(over: Partial<Unidad> = {}): Unidad {
  return {
    id: 'u1',
    titulo: 'Unidad 1',
    oculta: false,
    materiales: [
      { id: 'm2', type: 'DOCUMENT', title: 'Guía', ...({ sortOrder: 2 } as object) },
      { id: 'm1', type: 'VIDEO_YOUTUBE', title: 'Video', ...({ sortOrder: 1 } as object) },
    ],
    actividades: [],
    avance: null,
    total: { materiales: 2, actividades: 0 },
    ...over,
  }
}

const vacio = new Set<string>()

describe('el recorrido respeta el orden que dejó el docente', () => {
  it('los recursos van en su `sortOrder`, no como vengan', () => {
    // El orden existe en la base y la interfaz lo ignoraba: primero el video, luego la guía.
    const pasos = construirRecorrido({ unidad: unidad(), role: 'estudiante', vistos: vacio })
    expect(pasos.map((p) => p.material?.id)).toEqual(['m1', 'm2'])
  })

  it('primero lo que hay que mirar y después lo que hay que hacer', () => {
    const u = unidad({
      actividades: [decorate(act({ id: 'a1' }), 'estudiante', AHORA)],
      total: { materiales: 2, actividades: 1 },
    })
    const pasos = construirRecorrido({ unidad: u, role: 'estudiante', vistos: vacio })
    expect(pasos.map((p) => p.clave)).toEqual(['mat:m1', 'mat:m2', 'act:a1'])
    expect(pasos.map((p) => p.numero)).toEqual([1, 2, 3])
  })
})

describe('dónde va el estudiante', () => {
  it('el primer paso que puede hacer es el actual: eso convierte la lista en camino', () => {
    const pasos = construirRecorrido({ unidad: unidad(), role: 'estudiante', vistos: vacio })
    expect(pasos[0].estado).toBe('actual')
    expect(pasos[1].estado).toBe('pendiente')
  })

  it('lo ya visto queda hecho y el actual avanza', () => {
    const pasos = construirRecorrido({
      unidad: unidad(),
      role: 'estudiante',
      vistos: new Set([claveDeMaterial('m1')]),
    })
    expect(pasos[0].estado).toBe('hecho')
    expect(pasos[1].estado).toBe('actual')
  })

  it('una actividad entregada cuenta como hecha', () => {
    const u = unidad({
      materiales: [],
      actividades: [decorate(act({ id: 'a1', submissions: [{ status: 'GRADED', score: 4 }] }), 'estudiante', AHORA)],
      total: { materiales: 0, actividades: 1 },
    })
    expect(construirRecorrido({ unidad: u, role: 'estudiante', vistos: vacio })[0].estado).toBe('hecho')
  })

  it('lo bloqueado no se marca como actual: no depende de él', () => {
    const u = unidad({
      materiales: [],
      actividades: [
        decorate(act({ id: 'bloq', locked: true }), 'estudiante', AHORA),
        decorate(act({ id: 'libre' }), 'estudiante', AHORA),
      ],
      total: { materiales: 0, actividades: 2 },
    })
    const pasos = construirRecorrido({ unidad: u, role: 'estudiante', vistos: vacio })
    expect(pasos[0].estado).toBe('bloqueado')
    expect(pasos[1].estado).toBe('actual')
  })

  it('el docente no "hace" el recorrido: lo ve como la estructura que armó', () => {
    const pasos = construirRecorrido({ unidad: unidad(), role: 'docente', vistos: vacio })
    expect(pasos.every((p) => p.estado === 'pendiente')).toBe(true)
  })
})

describe('avance del recorrido', () => {
  const pasos = (estados: Paso['estado'][]): Paso[] =>
    estados.map((estado, i) => ({ clave: `p${i}`, numero: i + 1, estado }))

  it('cuenta los hechos sobre lo que sí depende del estudiante', () => {
    expect(avanceDelRecorrido(pasos(['hecho', 'actual', 'pendiente', 'bloqueado']))).toEqual({
      hechos: 1,
      total: 3,
      pct: 33,
    })
  })

  it('una unidad vacía no divide por cero', () => {
    expect(avanceDelRecorrido([])).toEqual({ hechos: 0, total: 0, pct: 0 })
  })
})
