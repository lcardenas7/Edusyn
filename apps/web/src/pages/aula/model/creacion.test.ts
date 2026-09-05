import { describe, it, expect } from 'vitest'
import { aPayloadDeTipo, camposDe, INTENCIONES, mecanicaDe, mecanicasDe } from './creacion'

/**
 * La auditoría señaló que "Evaluar" ofrece seis mecánicas —tres de ellas variantes de quiz—
 * sin decir en qué se diferencian. Estas pruebas defienden que eso no vuelva a pasar.
 */

describe('catálogo de creación', () => {
  it('toda intención ofrece al menos una mecánica', () => {
    for (const i of INTENCIONES) {
      expect(mecanicasDe(i.id).length, i.id).toBeGreaterThan(0)
    }
  })

  it('toda mecánica explica en qué se diferencia', () => {
    for (const i of INTENCIONES) {
      for (const m of mecanicasDe(i.id)) {
        expect(m.hint.trim(), `${i.id}/${m.type}`).not.toBe('')
        // Una explicación de tres palabras no explica nada.
        expect(m.hint.split(/\s+/).length, `${i.id}/${m.type}`).toBeGreaterThan(5)
      }
    }
  })

  it('las tres variantes de quiz se distinguen por su explicación, no solo por el nombre', () => {
    const hints = ['QUIZ', 'LIVE_QUIZ', 'HOME_QUIZ'].map((t) => mecanicaDe(t)!.hint)
    expect(new Set(hints).size).toBe(3)
  })

  it('ningún tipo está repetido entre intenciones', () => {
    const todos = INTENCIONES.flatMap((i) => mecanicasDe(i.id).map((m) => m.type))
    expect(new Set(todos).size).toBe(todos.length)
  })
})

describe('qué campos pide cada tipo', () => {
  it('una tarea lleva nota y sus propias opciones de entrega', () => {
    expect(camposDe('TASK')).toEqual({ calificable: true, conPreguntas: false, esTarea: true })
  })

  it('un quiz lleva preguntas', () => {
    expect(camposDe('QUIZ').conPreguntas).toBe(true)
  })

  it('una lección no pide opciones de preguntas: las lleva dentro', () => {
    expect(camposDe('LESSON').conPreguntas).toBe(false)
  })

  it('un juego de práctica NO lleva nota', () => {
    // Ponerle nota a un repaso cambia lo que significa para el estudiante.
    expect(camposDe('BLOCK_CROSSWORD').calificable).toBe(false)
  })
})

describe('traducción al backend', () => {
  it('los juegos se guardan como GAME con su gameType, igual que hoy', () => {
    expect(aPayloadDeTipo('BLOCK_WORDSEARCH')).toEqual({ type: 'GAME', gameType: 'WORDSEARCH' })
  })

  it('el resto pasa tal cual', () => {
    expect(aPayloadDeTipo('QUIZ')).toEqual({ type: 'QUIZ' })
  })
})
