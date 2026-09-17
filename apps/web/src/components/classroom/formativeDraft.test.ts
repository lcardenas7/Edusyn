import { describe, expect, it } from 'vitest'
import { buildRubricPrompt, draftFromSaved, draftProblems, hasEvenWeights, parseRubricDraft, sanitizeDraft, starterFrom, weightSum } from './formativeDraft'

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

  it('tolera espacios invisibles y comillas tipográficas que se cuelan al copiar del chat', () => {
    const json = JSON.stringify(sample)
    const withNbsp = json.replace(/,"/g, ', "').replace(/:/g, ': ')
    const curly = json.replace(/"(\w+)":/g, '“$1”:')
    for (const pasted of [withNbsp, '﻿' + withNbsp, curly]) {
      const result = parseRubricDraft(pasted)
      expect('draft' in result && result.draft.dimensions.length).toBe(2)
    }
  })

  it('avisa cuando la respuesta de la IA viene cortada', () => {
    const json = JSON.stringify(sample)
    expect(parseRubricDraft(json.slice(0, json.length - 30))).toEqual({ error: expect.stringContaining('parece cortada') })
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

describe('plantillas para crear a mano', () => {
  it('reparte niveles en la escala y pesos que suman 100', async () => {
    const { levelScores, evenWeights, blankDraft } = await import('./formativeDraft')
    expect(levelScores(1, 5, 4)).toEqual([1, 2.3, 3.7, 5])
    expect(levelScores(0, 100, 5)).toEqual([0, 25, 50, 75, 100])
    expect(evenWeights(3)).toEqual([33, 33, 34])
    // Muchas preguntas: el sobrante se reparte, ninguna pesa más de un punto que otra.
    for (const n of [7, 12, 28, 40]) {
      const w = evenWeights(n)
      expect(w.reduce((a, b) => a + b, 0)).toBe(100)
      expect(Math.max(...w) - Math.min(...w)).toBeLessThanOrEqual(1)
    }
    expect(evenWeights(28).filter(x => x === 4)).toHaveLength(16)
    const draft = blankDraft(['SELF', 'PEER'], 1, 5)
    expect(draft.dimensions.map(d => [d.label, d.evaluatorType, d.peersPerStudent, d.criteria.length])).toEqual([['Autoevaluación', 'SELF', null, 3], ['Coevaluación', 'PEER', 2, 3]])
    expect(draft.dimensions.every(d => weightSum(d) === 100)).toBe(true)
  })

  it('explica qué falta antes de crear', async () => {
    const { blankDraft, draftProblems } = await import('./formativeDraft')
    const draft = blankDraft(['SELF'])
    expect(draftProblems(draft, '')).toEqual(expect.arrayContaining(['Escribe un título.', 'Elige un período abierto.', 'Hay preguntas sin aspecto en "Autoevaluación".']))
    draft.title = 'Proyecto'
    draft.dimensions[0].criteria.forEach((c, i) => { c.name = `Criterio ${i + 1}`; c.description = 'Cumplí mi parte' })
    expect(draftProblems(draft, 't1')).toEqual([])
    draft.dimensions[0].criteria[0].weight = 10
    expect(draftProblems(draft, 't1')).toEqual([expect.stringContaining('deben sumar 100%')])
  })
})

describe('borradores guardados y plantillas', () => {
  it('reconstruye un borrador editable desde lo guardado', () => {
    const draft = draftFromSaved({ title: 'Proyecto', description: null, dimensions: [
      { label: 'Coevaluación', evaluatorType: 'PEER', peersPerStudent: 3, rubricSnapshot: { criteria: [
        { id: 'c1', name: 'Escucha', description: 'Mi compañero escucha', weight: 100, levels: [{ id: 'l1', label: 'Bajo', description: null, score: 1 }, { id: 'l2', label: 'Alto', score: 5 }] },
      ] } },
    ] })
    expect(draft).toEqual({ title: 'Proyecto', description: '', dimensions: [{ label: 'Coevaluación', evaluatorType: 'PEER', peersPerStudent: 3, evaluationComponentId: null, criteria: [
      { name: 'Escucha', description: 'Mi compañero escucha', weight: 100, levels: [{ label: 'Bajo', description: '', score: 1 }, { label: 'Alto', description: '', score: 5 }] },
    ] }] })
  })

  it('la coevaluación nueva conserva los aspectos pero no las frases en primera persona', () => {
    const self = sanitizeDraft(sample).dimensions[0]
    const peer = starterFrom(self, 'PEER')
    expect(peer.evaluatorType).toBe('PEER')
    expect(peer.peersPerStudent).toBe(2)
    expect(peer.criteria.map(c => [c.name, c.description, c.weight])).toEqual([['Responsabilidad', '', 50], ['Escucha', '', 50]])
    expect(peer.criteria[0].levels.every(l => l.description === '')).toBe(true)
    expect(hasEvenWeights(peer)).toBe(true)
  })

  it('pide una sola dimensión por tipo', () => {
    const draft = sanitizeDraft(sample)
    draft.dimensions.push({ ...draft.dimensions[1] })
    expect(draftProblems(draft, 't1')).toContain('Deja una sola coevaluación: junta sus preguntas en una.')
  })

  it('la petición pide la persona correcta según quién responde', () => {
    const prompt = buildRubricPrompt({ purpose: 'x', types: ['SELF', 'PEER'] })
    expect(prompt).toContain('primera persona')
    expect(prompt).toContain('Mi compañero')
  })
})
