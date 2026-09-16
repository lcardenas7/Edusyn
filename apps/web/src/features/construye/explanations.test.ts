import { describe, expect, it } from 'vitest'
import { describeCssMatch, describeCssRelatedCount, describeCssRuleAvailability, describeMediaCondition, getElementExplanation } from './explanations'

describe('getElementExplanation', () => {
  it('returns a student-friendly explanation for a known tag', () => {
    expect(getElementExplanation('h1')).toBe('Este es un título principal.')
    expect(getElementExplanation('button')).toBe('Este es un botón que el usuario puede presionar.')
  })

  it('is case-insensitive', () => {
    expect(getElementExplanation('H1')).toBe(getElementExplanation('h1'))
  })

  it('returns null (never an invented generic explanation) for an unknown tag', () => {
    expect(getElementExplanation('marquee')).toBeNull()
    expect(getElementExplanation('custom-web-component')).toBeNull()
  })
})

describe('describeMediaCondition', () => {
  it('traduce los dos patrones que sabemos leer con certeza', () => {
    expect(describeMediaCondition('(max-width: 500px)')).toBe('pantallas de hasta 500 px')
    expect(describeMediaCondition('(min-width:768px)')).toBe('pantallas desde 768 px')
  })

  it('devuelve la condición original cuando no la reconoce, sin interpretarla', () => {
    expect(describeMediaCondition('(orientation: landscape)')).toBe('(orientation: landscape)')
    expect(describeMediaCondition('screen and (min-width: 40em)')).toBe('screen and (min-width: 40em)')
  })
})

describe('describeCssMatch', () => {
  const base = { status: 'exact' as const, viewportLabel: 'Computador' }

  it('cuenta los elementos afectados en singular y plural', () => {
    expect(describeCssMatch({ ...base, matchedCount: 1 })).toBe('Este estilo afecta este elemento.')
    expect(describeCssMatch({ ...base, matchedCount: 4 })).toBe('Este estilo afecta 4 elementos.')
  })

  it('distingue "no corresponde a nada" de "corresponde pero no se aplica ahora"', () => {
    expect(describeCssMatch({ ...base, matchedCount: 0 })).toBe('Este estilo no afecta ningún elemento de la vista actual.')
    expect(describeCssMatch({ ...base, matchedCount: 1, mediaText: '(max-width: 500px)', mediaActive: false }))
      .toBe('Este estilo corresponde a este elemento, pero ahora no se aplica porque estás viendo Computador.')
  })

  it('cuando la media está activa lo dice, sin atribuirse el resultado visual', () => {
    const frase = describeCssMatch({ ...base, matchedCount: 2, mediaText: '(max-width: 500px)', mediaActive: true, viewportLabel: 'Celular' })!
    expect(frase).toContain('Este estilo afecta 2 elementos.')
    expect(frase).toContain('Se aplica ahora')
    expect(frase).not.toMatch(/hace que|responsable|porque este código/i)
  })

  it('sin correspondencia determinable no inventa ninguna frase', () => {
    expect(describeCssMatch({ ...base, status: 'none', matchedCount: 0 })).toBeNull()
  })
})

// PASO 4.2 (Preview → CSS)
describe('describeCssRelatedCount', () => {
  it('cuenta en singular y plural, sin afirmar cuál regla es responsable del resultado', () => {
    expect(describeCssRelatedCount(1)).toBe('Este elemento tiene 1 estilo relacionado.')
    expect(describeCssRelatedCount(3)).toBe('Este elemento tiene 3 estilos relacionados.')
  })
})

describe('describeCssRuleAvailability', () => {
  it('sin condición de media, no hay nada que aclarar', () => {
    expect(describeCssRuleAvailability(undefined, undefined, 'Computador')).toBeNull()
  })

  it('dice honestamente que ahora no se aplica cuando la media está inactiva', () => {
    expect(describeCssRuleAvailability('(max-width: 500px)', false, 'Computador')).toBe('Ahora no se aplica porque estás viendo Computador.')
  })

  it('dice que se aplica ahora cuando la media está activa, con la condición traducida', () => {
    expect(describeCssRuleAvailability('(max-width: 500px)', true, 'Celular')).toBe('Se aplica ahora, en pantallas de hasta 500 px.')
  })
})
