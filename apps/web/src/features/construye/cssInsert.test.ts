import { describe, expect, it } from 'vitest'
import { planCssInsertion, type CssRuleBlock } from './cssInsert'

/** Construye el bloque estructural igual que lo haría el parser, a partir de marcas del texto. */
function bloque(css: string, opciones: { ultimaDeclaracion?: string; primeraDeclaracion?: string; reglaEn?: string } = {}): CssRuleBlock {
  const blockStart = css.indexOf('{')
  const blockEnd = css.lastIndexOf('}') + 1
  const { ultimaDeclaracion, primeraDeclaracion, reglaEn } = opciones
  return {
    blockStart,
    blockEnd,
    ruleStart: reglaEn ? css.indexOf(reglaEn) : 0,
    lastDeclarationEnd: ultimaDeclaracion ? css.indexOf(ultimaDeclaracion) + ultimaDeclaracion.length : undefined,
    firstDeclarationStart: primeraDeclaracion ? css.indexOf(primeraDeclaracion) : undefined,
  }
}

/** Aplica la inserción para poder comparar el archivo resultante completo. */
function insertar(css: string, block: CssRuleBlock, property = 'border-radius' as const, value = '12px') {
  const r = planCssInsertion(css, block, property, value)
  return r ? css.slice(0, r.offset) + r.text + css.slice(r.offset) : null
}

describe('planCssInsertion — casos de formato (Paso 5.3)', () => {
  it('A/E. regla multilínea: la declaración nueva copia la indentación existente', () => {
    const css = '.cta {\n  background-color:#ffffff;\n}\n'
    const b = bloque(css, { ultimaDeclaracion: 'background-color:#ffffff', primeraDeclaracion: 'background-color' })
    expect(insertar(css, b)).toBe('.cta {\n  background-color:#ffffff;\n  border-radius: 12px;\n}\n')
  })

  it('F. regla inline: se queda inline, sin partir la línea', () => {
    const css = '.cta { color:#000; }'
    const b = bloque(css, { ultimaDeclaracion: 'color:#000', primeraDeclaracion: 'color' })
    expect(insertar(css, b)).toBe('.cta { color:#000; border-radius: 12px; }')
  })

  it('última declaración sin punto y coma: se añade antes de la nueva', () => {
    const css = '.cta { color:#000 }'
    const b = bloque(css, { ultimaDeclaracion: 'color:#000', primeraDeclaracion: 'color' })
    expect(insertar(css, b)).toBe('.cta { color:#000; border-radius: 12px; }')
  })

  it('G. regla vacía multilínea: respeta la indentación de la propia regla', () => {
    const css = '.cta {\n}\n'
    expect(insertar(css, bloque(css, { reglaEn: '.cta' }))).toBe('.cta {\n  border-radius: 12px;\n}\n')
  })

  it('G. regla vacía multilínea anidada: hereda la indentación de su nivel', () => {
    const css = '@media (max-width: 500px) {\n  .cta {\n  }\n}\n'
    const blockStart = css.indexOf('{', css.indexOf('.cta'))
    const b: CssRuleBlock = { blockStart, blockEnd: css.indexOf('}', blockStart) + 1, ruleStart: css.indexOf('.cta') }
    const r = planCssInsertion(css, b, 'border-radius', '12px')!
    expect(css.slice(0, r.offset) + r.text + css.slice(r.offset)).toBe('@media (max-width: 500px) {\n  .cta {\n    border-radius: 12px;\n  }\n}\n')
  })

  it('H. regla vacía inline, con y sin espacio interior', () => {
    expect(insertar('.cta {}', bloque('.cta {}', { reglaEn: '.cta' }))).toBe('.cta { border-radius: 12px; }')
    expect(insertar('.cta { }', bloque('.cta { }', { reglaEn: '.cta' }))).toBe('.cta { border-radius: 12px; }')
  })

  it('I. archivo con CRLF: la línea nueva también usa CRLF', () => {
    const css = '.cta {\r\n  color:#000;\r\n}\r\n'
    const b = bloque(css, { ultimaDeclaracion: 'color:#000', primeraDeclaracion: 'color' })
    expect(insertar(css, b)).toBe('.cta {\r\n  color:#000;\r\n  border-radius: 12px;\r\n}\r\n')
  })

  it('indentación con tabuladores: se copia tal cual, sin convertirla a espacios', () => {
    const css = '.cta {\n\tcolor:#000;\n}'
    const b = bloque(css, { ultimaDeclaracion: 'color:#000', primeraDeclaracion: 'color' })
    expect(insertar(css, b)).toBe('.cta {\n\tcolor:#000;\n\tborder-radius: 12px;\n}')
  })

  it('L. regla dentro de @media: se inserta en ESA regla y con su indentación', () => {
    const css = '@media (max-width: 500px) {\n  .cta {\n    font-size:18px;\n  }\n}\n'
    const blockStart = css.indexOf('{', css.indexOf('.cta'))
    const b: CssRuleBlock = {
      blockStart,
      blockEnd: css.indexOf('}', blockStart) + 1,
      ruleStart: css.indexOf('.cta'),
      lastDeclarationEnd: css.indexOf('font-size:18px') + 14,
      firstDeclarationStart: css.indexOf('font-size'),
    }
    const r = planCssInsertion(css, b, 'border-radius', '12px')!
    expect(css.slice(0, r.offset) + r.text + css.slice(r.offset))
      .toBe('@media (max-width: 500px) {\n  .cta {\n    font-size:18px;\n    border-radius: 12px;\n  }\n}\n')
  })
})

describe('planCssInsertion — casos que NO se insertan', () => {
  it('J/K. cualquier comentario dentro de la regla deja el caso fuera del MVP', () => {
    const antes = '.cta {\n  /* color principal */\n  color:#000;\n}'
    expect(planCssInsertion(antes, bloque(antes, { ultimaDeclaracion: 'color:#000', primeraDeclaracion: 'color:#000' }), 'border-radius', '12px')).toBeNull()
    const despues = '.cta {\n  color:#000;\n  /* pendiente */\n}'
    expect(planCssInsertion(despues, bloque(despues, { ultimaDeclaracion: 'color:#000', primeraDeclaracion: 'color' }), 'border-radius', '12px')).toBeNull()
  })

  it('T. algo inesperado entre la última declaración y el cierre: no se toca', () => {
    const css = '.cta { color:#000; ??? }'
    expect(planCssInsertion(css, bloque(css, { ultimaDeclaracion: 'color:#000', primeraDeclaracion: 'color' }), 'border-radius', '12px')).toBeNull()
  })

  it('T. saltos de línea mezclados: no se elige cuál respetar', () => {
    const css = '.cta {\r\n  color:#000;\n}'
    expect(planCssInsertion(css, bloque(css, { ultimaDeclaracion: 'color:#000', primeraDeclaracion: 'color' }), 'border-radius', '12px')).toBeNull()
  })

  it('rango de bloque inválido o que ya no apunta a un bloque: null', () => {
    const css = '.cta { color:#000; }'
    expect(planCssInsertion(css, { blockStart: 0, blockEnd: css.length, ruleStart: 0 }, 'border-radius', '12px')).toBeNull()
    expect(planCssInsertion(css, { blockStart: 5, blockEnd: 900, ruleStart: 0 }, 'border-radius', '12px')).toBeNull()
  })

  it('regla vacía con basura dentro: no se inserta', () => {
    const css = '.cta { ; }'
    expect(planCssInsertion(css, bloque(css, { reglaEn: '.cta' }), 'border-radius', '12px')).toBeNull()
  })
})

describe('planCssInsertion — guard de revalidación', () => {
  it('el guard cubre toda la regla, así que detecta cualquier cambio dentro de ella', () => {
    const css = '.cta {\n  color:#000;\n}'
    const b = bloque(css, { ultimaDeclaracion: 'color:#000', primeraDeclaracion: 'color' })
    const r = planCssInsertion(css, b, 'border-radius', '12px')!
    expect(r.guard.text).toBe('{\n  color:#000;\n}')
    expect(css.slice(r.guard.start, r.guard.end)).toBe(r.guard.text)
  })
})
