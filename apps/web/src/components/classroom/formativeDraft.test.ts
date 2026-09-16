import { describe, expect, it } from 'vitest'
import { buildRubricPrompt, parseRubricDraft, sanitizeDraft, weightSum } from './formativeDraft'

const sample = {
  title: 'Trabajo en equipo',
  description: 'Piensa en tu aporte',
  dimensions: [
    { label: 'Autoevaluación', evaluatorType: 'SELF', criteria: [
      { name: 'Responsabilidad', description: 'Cumple', weight: 50, levels: [{ label: 'Inicial', score: 1 }, { label: 'Logrado', score: 5 }] },
      { name: 'Escucha', description: 'Escucha', weight: 50, levels: [{ label: 'Inicial', score: 1 }, { label: 'Logrado', score: 5 }] },
    ] },
    { label: 'Coevaluación', evaluatorType: 'PEER', peersPerStudent: 3, criteria: [
      { name: 'Aporte', weight: 100, levels: [{ label: 'Poco', score: 1 }, { label: 'Mucho', score: 5 }] },
    ] },
  ],
}

describe('buildRubricPrompt', () => {
  it('pide solo las dimensiones elegidas, en la escala de la institución y sin datos personales', () => {
    const prompt = buildRubricPrompt({ purpose: 'Participación en el proyecto', types: ['SELF'], minScore: 1, maxScore: 5 })
    expect(prompt).toContain('Qué queremos evaluar: Participación en el proyecto')
    expect(prompt).toContain('Dimensiones (exactamente 1): Autoevaluación (evaluatorType "SELF")')
    expect(prompt).toContain('score creciente entre 1 y 5')
    expect(prompt).toContain('No incluyas nombres ni datos personales')
    expect(prompt).toContain('ÚNICAMENTE con un JSON válido')
  })
})

describe('parseRubricDraft', () => {
  it('lee la respuesta aunque venga con texto y cercas de código', () => {
    const result = parseRubricDraft(`Claro, aquí está:\n\`\`\`json\n${JSON.stringify(sample)}\n\`\`\`\nEspero que sirva.`)
    expect('draft' in result && result.draft.dimensions.map(d => [d.label, d.evaluatorType, d.peersPerStudent])).toEqual([
      ['Autoevaluación', 'SELF', null],
      ['Coevaluación', 'PEER', 3],
    ])
  })

  it('explica el problema cuando no hay JSON o no trae criterios', () => {
    expect(parseRubricDraft('')).toEqual({ error: 'Pega la respuesta de la IA.' })
    expect('error' in parseRubricDraft('no sé hacer eso')).toBe(true)
    expect(parseRubricDraft('{"title":"x","dimensions":[{"label":"A","criteria":[]}]}')).toEqual({ error: expect.stringContaining('no trae dimensiones') })
  })
})

describe('sanitizeDraft', () => {
  it('aplica las mismas reglas que el servidor', () => {
    const draft = sanitizeDraft({ dimensions: [
      { label: 'Docente', evaluatorType: 'TEACHER', criteria: [{ name: 'C', weight: 100, levels: [{ label: 'a', score: 1 }, { label: 'b', score: 'x' }, { label: 'c', score: 3 }] }] },
      { label: 'Sin niveles', evaluatorType: 'SELF', criteria: [{ name: 'C', weight: 100, levels: [{ label: 'a', score: 1 }] }] },
      { label: 'Pares', evaluatorType: 'PEER', peersPerStudent: 50, criteria: [{ name: 'C', weight: 100, levels: [{ label: 'a', score: 1 }, { label: 'b', score: 2 }] }] },
    ] })
    expect(draft.title).toBe('Evaluación formativa')
    expect(draft.dimensions.map(d => d.label)).toEqual(['Docente', 'Pares'])
    expect(draft.dimensions[0].evaluatorType).toBe('SELF')
    expect(draft.dimensions[0].criteria[0].levels).toHaveLength(2)
    expect(draft.dimensions[1].peersPerStudent).toBe(10)
  })

  it('suma los pesos para validar el 100 %', () => {
    const draft = sanitizeDraft(sample)
    expect(draft.dimensions.map(weightSum)).toEqual([100, 100])
  })
})
