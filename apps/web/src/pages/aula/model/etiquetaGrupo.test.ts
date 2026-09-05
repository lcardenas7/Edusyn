import { describe, it, expect } from 'vitest'
import { etiquetaDeGrupo } from '../model/grados'

/**
 * Salió al probar el aula con datos con la forma real del backend: la tarjeta decía
 * "Matemáticas · 8 8-A", porque el grado se llama "8" y el grupo "8-A", y se estaban juntando
 * sin mirar.
 */
describe('etiqueta de grado y grupo', () => {
  it('no repite el grado cuando el grupo ya lo lleva dentro', () => {
    expect(etiquetaDeGrupo('8', '8-A')).toBe('8-A')
    expect(etiquetaDeGrupo('8', '8A')).toBe('8A')
    expect(etiquetaDeGrupo('11', '11-2')).toBe('11-2')
  })

  it('los junta cuando de verdad dicen cosas distintas', () => {
    expect(etiquetaDeGrupo('Transición', 'Grupo A')).toBe('Transición Grupo A')
  })

  it('no confunde un grado con otro que empieza igual', () => {
    // "1" no debe considerarse contenido en "11-2": son grados distintos.
    expect(etiquetaDeGrupo('1', '11-2')).toBe('1 11-2')
  })

  it('aguanta que falte cualquiera de los dos', () => {
    expect(etiquetaDeGrupo(null, '8-A')).toBe('8-A')
    expect(etiquetaDeGrupo('8', null)).toBe('8')
    expect(etiquetaDeGrupo(null, null)).toBe('')
    expect(etiquetaDeGrupo('  ', ' 8-A ')).toBe('8-A')
  })
})
