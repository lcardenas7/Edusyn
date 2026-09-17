import { describe, expect, it } from 'vitest'
import { ASPECTS, looksFirstPerson, questionsFromAspects } from './formativeAspects'
import { buildRubricPrompt, groupByAspect, weightSum } from './formativeDraft'

describe('catálogo de aspectos', () => {
  it('cada aspecto trae preguntas en las dos voces y la coevaluación habla del compañero', () => {
    for (const a of ASPECTS) {
      expect(a.self.length).toBeGreaterThanOrEqual(2)
      expect(a.peer.length).toBe(a.self.length)
      for (const q of a.peer) expect(looksFirstPerson(q)).toBe(false)
      for (const q of a.self) expect(q).not.toMatch(/compañero (cumplió|entregó)/i)
    }
  })

  it('arma el cuestionario agrupado por aspecto, con pesos que suman 100', () => {
    const questions = questionsFromAspects([{ id: 'responsabilidad', name: 'Responsabilidad' }, { name: 'Uso del laboratorio' }], 'PEER', 3)
    expect(questions).toHaveLength(6)
    expect(weightSum({ label: 'x', evaluatorType: 'PEER', peersPerStudent: 2, evaluationComponentId: null, criteria: questions })).toBe(100)
    expect(questions[0].description).toMatch(/^Mi compañero/)
    expect(questions.slice(3).every(q => q.name === 'Uso del laboratorio' && q.description === '')).toBe(true)
    expect(groupByAspect(questions).map(g => [g.aspect, g.items.length])).toEqual([['Responsabilidad', 3], ['Uso del laboratorio', 3]])
  })

  it('detecta preguntas de coevaluación escritas para el mismo estudiante', () => {
    expect(looksFirstPerson('Entregué mi parte a tiempo.')).toBe(true)
    expect(looksFirstPerson('Me esforcé en el trabajo')).toBe(true)
    expect(looksFirstPerson('Cumplí con las tareas.')).toBe(true)
    expect(looksFirstPerson('Participó en clase, igual que yo.')).toBe(true)
    expect(looksFirstPerson('Aportó ideas al grupo.')).toBe(false)
    expect(looksFirstPerson('Mi compañero entregó su parte a tiempo.')).toBe(false)
    expect(looksFirstPerson('Escuchó las ideas del equipo.')).toBe(false)
  })

  it('la petición usa los aspectos elegidos y explica si las preguntas están relacionadas', () => {
    const mirrored = buildRubricPrompt({ purpose: 'Proyecto', types: ['SELF', 'PEER'], aspects: ['Responsabilidad', 'Respeto'], perAspect: 3, mirrorPeer: true })
    expect(mirrored).toContain('exactamente 6 preguntas (criteria): 3 por cada uno de estos aspectos, en este orden: Responsabilidad; Respeto')
    expect(mirrored).toContain('Preguntas relacionadas')
    expect(mirrored).toContain('IMPORTANTE sobre la coevaluación')
    const independent = buildRubricPrompt({ purpose: 'Proyecto', types: ['SELF', 'PEER'], mirrorPeer: false })
    expect(independent).toContain('Preguntas independientes')
    expect(buildRubricPrompt({ purpose: 'Proyecto', types: ['SELF'] })).not.toContain('IMPORTANTE sobre la coevaluación')
  })
})

describe('preguntas espejo', () => {
  it('pasa una pregunta del catálogo a la otra voz', async () => {
    const { mirrorStatement } = await import('./formativeAspects')
    expect(mirrorStatement('Entregué mi parte a tiempo.', 'PEER')).toBe('Mi compañero entregó su parte a tiempo.')
    expect(mirrorStatement('Mi compañero entregó su parte a tiempo.', 'SELF')).toBe('Entregué mi parte a tiempo.')
    expect(mirrorStatement('Una pregunta propia', 'PEER')).toBe('')
  })
})
