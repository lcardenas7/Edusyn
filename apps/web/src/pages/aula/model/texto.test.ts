import { describe, it, expect } from 'vitest'
import { textoLegible } from './texto'

describe('texto libre listo para pintar', () => {
  it('un espacio duro pasa a ser un espacio normal', () => {
    // Es lo que rompía la pantalla: sin sitio donde cortar, el párrafo era una sola palabra.
    expect(textoLegible('Guía 1 y el documento')).toBe('Guía 1 y el documento')
  })

  it('también el espacio fino y el de cifras', () => {
    expect(textoLegible('10 000 1')).toBe('10 000 1')
  })

  it('los saltos de línea se respetan: son la estructura que escribió el docente', () => {
    expect(textoLegible('a. Primero\nb. Segundo')).toBe('a. Primero\nb. Segundo')
  })

  it('un texto normal no se toca', () => {
    expect(textoLegible('Ya estaba bien escrito.')).toBe('Ya estaba bien escrito.')
  })

  it('sin texto no revienta', () => {
    expect(textoLegible(null)).toBe('')
    expect(textoLegible(undefined)).toBe('')
    expect(textoLegible('')).toBe('')
  })
})
