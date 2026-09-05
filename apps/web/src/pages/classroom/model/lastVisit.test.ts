import { describe, it, expect } from 'vitest'
import { esNueva, leerUltimaVisita, marcarVisitada } from './lastVisit'

/**
 * Estas pruebas defienden la garantía G4 del plan: al estrenar el aula nueva, el estudiante
 * NO debe ver de golpe todo marcado como nuevo, y si vuelve al aula actual, tampoco.
 *
 * Es pérdida de información del usuario aunque no se borre ninguna fila de la base, así que se
 * trata como lo que es: un traspaso que hay que probar.
 */

const AULA = 'aula-123'
const AHORA = new Date('2026-05-20T15:00:00.000Z')

/** `localStorage` de mentira, para no depender del entorno del navegador. */
function almacenFalso(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial))
  return {
    datos,
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
  }
}

/** Un almacén que revienta, como en modo privado o con cookies bloqueadas. */
const almacenRoto = {
  getItem() {
    throw new Error('acceso denegado')
  },
  setItem() {
    throw new Error('acceso denegado')
  },
}

describe('herencia del estado local entre el aula actual y la nueva', () => {
  it('lee la clave que dejó el aula actual', () => {
    const a = almacenFalso({ [`classroom_visited_${AULA}`]: '2026-05-18T12:00:00.000Z' })
    expect(leerUltimaVisita(AULA, a)?.toISOString()).toBe('2026-05-18T12:00:00.000Z')
  })

  it('lee también la otra clave que el aula actual escribe en paralelo', () => {
    const a = almacenFalso({ [`edusyn:seenActs:${AULA}`]: String(Date.parse('2026-05-19T12:00:00.000Z')) })
    expect(leerUltimaVisita(AULA, a)?.toISOString()).toBe('2026-05-19T12:00:00.000Z')
  })

  it('si las dos claves discrepan, gana la más reciente', () => {
    const a = almacenFalso({
      [`classroom_visited_${AULA}`]: '2026-05-10T12:00:00.000Z',
      [`edusyn:seenActs:${AULA}`]: String(Date.parse('2026-05-19T12:00:00.000Z')),
    })
    expect(leerUltimaVisita(AULA, a)?.toISOString()).toBe('2026-05-19T12:00:00.000Z')
  })

  it('escribe las DOS claves, para que volver al aula actual no pierda la marca', () => {
    const a = almacenFalso()
    marcarVisitada(AULA, AHORA, a)
    expect(a.datos.get(`edusyn:seenActs:${AULA}`)).toBe(String(AHORA.getTime()))
    expect(a.datos.get(`classroom_visited_${AULA}`)).toBe(AHORA.toISOString())
  })

  it('nunca ha entrado: lo dice, en vez de inventar una fecha', () => {
    expect(leerUltimaVisita(AULA, almacenFalso())).toBeNull()
  })

  it('un valor corrupto no rompe la vista', () => {
    const a = almacenFalso({
      [`edusyn:seenActs:${AULA}`]: 'no-es-un-numero',
      [`classroom_visited_${AULA}`]: 'tampoco-es-fecha',
    })
    expect(leerUltimaVisita(AULA, a)).toBeNull()
  })

  it('sin acceso a localStorage se sigue navegando', () => {
    expect(() => leerUltimaVisita(AULA, almacenRoto)).not.toThrow()
    expect(leerUltimaVisita(AULA, almacenRoto)).toBeNull()
    expect(() => marcarVisitada(AULA, AHORA, almacenRoto)).not.toThrow()
    expect(() => marcarVisitada(AULA, AHORA, null)).not.toThrow()
  })
})

describe('qué se marca como NUEVO', () => {
  const visita = new Date('2026-05-18T12:00:00.000Z')

  it('lo publicado después de la última visita', () => {
    expect(esNueva('2026-05-19T10:00:00.000Z', visita, AHORA)).toBe(true)
  })

  it('lo publicado antes, no', () => {
    expect(esNueva('2026-05-17T10:00:00.000Z', visita, AHORA)).toBe(false)
  })

  it('quien entra por primera vez no ve cincuenta cosas nuevas: solo la última semana', () => {
    expect(esNueva('2026-05-16T10:00:00.000Z', null, AHORA)).toBe(true)
    expect(esNueva('2026-04-01T10:00:00.000Z', null, AHORA)).toBe(false)
  })

  it('sin fecha de publicación no hay nada que anunciar', () => {
    expect(esNueva(null, visita, AHORA)).toBe(false)
    expect(esNueva('fecha-rota', visita, AHORA)).toBe(false)
  })
})
