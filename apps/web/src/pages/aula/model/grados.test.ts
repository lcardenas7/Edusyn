import { describe, it, expect } from 'vitest'
import { compararGrados, ordenDeGrado } from './grados'

/**
 * Salió probando con datos reales: un docente con once aulas de la misma asignatura las veía
 * en desorden. Ordenar por nombre pone Décimo antes que Sexto.
 */
describe('orden de los grados', () => {
  it('sigue la escalera escolar, no el alfabeto', () => {
    const grados = ['Décimo', 'Sexto', 'Octavo', 'Transición', 'Once', 'Primero']
    expect([...grados].sort(compararGrados)).toEqual([
      'Transición',
      'Primero',
      'Sexto',
      'Octavo',
      'Décimo',
      'Once',
    ])
  })

  it('entiende el grado escrito con número', () => {
    expect(ordenDeGrado('8')).toBe(8)
    expect(ordenDeGrado('11°')).toBe(11)
    expect(ordenDeGrado('Grado 5')).toBe(5)
  })

  it('entiende el ordinal con y sin tilde', () => {
    expect(ordenDeGrado('Décimo')).toBe(10)
    expect(ordenDeGrado('decimo')).toBe(10)
    expect(ordenDeGrado('SÉPTIMO')).toBe(7)
  })

  it('coloca preescolar antes que primero', () => {
    expect(ordenDeGrado('Transición')).toBeLessThan(ordenDeGrado('Primero'))
    expect(ordenDeGrado('Jardín')).toBeLessThan(ordenDeGrado('Transición'))
  })

  it('lo desconocido va al final, pero ordenado entre sí', () => {
    const lista = ['Aceleración', 'Octavo', 'Ciclo especial']
    expect([...lista].sort(compararGrados)).toEqual(['Octavo', 'Aceleración', 'Ciclo especial'])
  })

  it('aguanta que no venga nombre', () => {
    expect(ordenDeGrado(null)).toBe(999)
    expect(ordenDeGrado('')).toBe(999)
  })
})
