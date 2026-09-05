import { describe, it, expect } from 'vitest'
import { ordenarPeriodos, periodoCorto } from './periodos'

describe('etiqueta corta del período', () => {
  it('reconoce los nombres que usan los colegios', () => {
    expect(periodoCorto('Primer Período')).toBe('P1')
    expect(periodoCorto('SEGUNDO PERIODO')).toBe('P2')
    expect(periodoCorto('Tercer periodo')).toBe('P3')
    expect(periodoCorto('Cuarto Período')).toBe('P4')
  })

  it('reconoce las formas numeradas', () => {
    expect(periodoCorto('Periodo 2')).toBe('P2')
    expect(periodoCorto('Período 3')).toBe('P3')
    expect(periodoCorto('P4')).toBe('P4')
    expect(periodoCorto('2do periodo')).toBe('P2')
  })

  it('lo que no reconoce lo dice, en vez de inventar una abreviatura', () => {
    // Quien llama muestra el nombre completo recortado con "…". Un "SE" en el encabezado
    // sería peor que un nombre largo bien recortado.
    expect(periodoCorto('Semestre A')).toBeNull()
    expect(periodoCorto('Intensivo de verano')).toBeNull()
    expect(periodoCorto('')).toBeNull()
  })
})

describe('orden de los períodos', () => {
  const nombres = (l: { name: string }[]) => l.map((p) => p.name)

  it('van en su orden real, no en orden alfabético', () => {
    // Como llegaban del backend, ordenados por nombre: "Cuarto" salía primero.
    const crudo = [
      { name: 'Cuarto Período' },
      { name: 'Primer Período' },
      { name: 'Segundo Período' },
      { name: 'Tercer Período' },
    ]
    expect(nombres(ordenarPeriodos(crudo))).toEqual([
      'Primer Período',
      'Segundo Período',
      'Tercer Período',
      'Cuarto Período',
    ])
  })

  it('el número que manda el colegio gana sobre lo que diga el nombre', () => {
    const crudo = [
      { name: 'Segundo Período', orden: 1 },
      { name: 'Primer Período', orden: 2 },
    ]
    expect(nombres(ordenarPeriodos(crudo))).toEqual(['Segundo Período', 'Primer Período'])
  })

  it('lo que no se puede ordenar va al final y no se pierde', () => {
    const crudo = [{ name: 'Nivelación' }, { name: 'Segundo Período' }, { name: 'Intensivo' }]
    expect(nombres(ordenarPeriodos(crudo))).toEqual(['Segundo Período', 'Intensivo', 'Nivelación'])
  })
})
