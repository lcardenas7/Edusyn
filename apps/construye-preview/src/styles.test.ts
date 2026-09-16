// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { evaluateCssPosition, findCssRuleAtOffset, findCssRulesForElement, MAX_RELATED_CSS_RULES, normalizeSelector, parseCssRules, resolveCssRuleInDocument } from './styles'

const CSS = [
  '.card { background: white; border-radius: 12px; }',   // 0
  '#menu { display: flex; }',                             // 1
  'button { font-size: 14px; }',                          // 2
  'h1, h2 { margin: 0; }',                                // 3
  '.card p { color: #333; }',                             // 4
  '.no-existe { color: red; }',                           // 5
  '.card { padding: 8px; }',                              // 6 (regla repetida)
  '@media (max-width: 500px) { .menu { display: none; } .card { background: #fde68a; } }',
].join('\n')

function rangoDe(fragmento: string): number {
  return CSS.indexOf(fragmento)
}

describe('parseCssRules — rangos', () => {
  it('da el rango exacto de cada regla', () => {
    const reglas = parseCssRules(CSS)
    const card = reglas.find((r) => r.selectorText === '.card')!
    expect(CSS.slice(card.start, card.end)).toBe('.card { background: white; border-radius: 12px; }')
  })

  it('da el rango exacto de cada declaración (lo que 4.3 necesitará)', () => {
    const reglas = parseCssRules(CSS)
    const card = reglas.find((r) => r.selectorText === '.card')!
    const fondo = card.declarations.find((d) => d.property === 'background')!
    expect(CSS.slice(fondo.start, fondo.end)).toBe('background: white')
    expect(card.declarations.map((d) => d.property)).toEqual(['background', 'border-radius'])
  })

  it('el rango del VALOR (Paso 4.3) cubre solo el valor, preservado byte a byte', () => {
    const css = '.card { border-radius: 12PX ; }'
    const reglas = parseCssRules(css)
    const decl = reglas[0].declarations[0]
    expect(css.slice(decl.start, decl.end)).toBe('border-radius: 12PX ')
    // El valor no incluye "property:" ni los espacios que lo rodean por fuera del token.
    expect(css.slice(decl.valueStart, decl.valueEnd)).toBe('12PX')
  })

  it('conserva las reglas repetidas como entradas distintas', () => {
    const repetidas = parseCssRules(CSS).filter((r) => r.selectorText === '.card' && r.mediaText === null)
    expect(repetidas).toHaveLength(2)
    expect(repetidas[0].start).not.toBe(repetidas[1].start)
  })

  it('normaliza el selector múltiple igual que lo hará el CSSOM', () => {
    const reglas = parseCssRules(CSS)
    expect(reglas.some((r) => r.selectorText === 'h1,h2')).toBe(true)
    expect(normalizeSelector('h1, h2')).toBe('h1,h2')
    expect(normalizeSelector('.card   p')).toBe('.card p') // el espacio descendiente se conserva
  })

  it('marca las reglas que están dentro de una @media con su condición', () => {
    const reglas = parseCssRules(CSS)
    const dentro = reglas.filter((r) => r.mediaText !== null)
    expect(dentro).toHaveLength(2)
    // La condición se conserva tal como la escribió el estudiante, sin reformatear.
    expect(dentro[0].mediaText).toBe('(max-width: 500px)')
    expect(dentro.map((r) => r.selectorText)).toEqual(['.menu', '.card'])
  })

  it('la ruta de índices distingue nivel superior de contenido de @media', () => {
    const reglas = parseCssRules(CSS)
    expect(reglas.find((r) => r.selectorText === '#menu')!.path).toEqual([1])
    expect(reglas.filter((r) => r.mediaText !== null).map((r) => r.path)).toEqual([[7, 0], [7, 1]])
  })
})

describe('parseCssRules — CSS a medio escribir', () => {
  it('no lanza con una declaración incompleta y conserva lo que sí es legible', () => {
    const css = '.card {\n  background-col\n}\n.otra { color: red; }'
    expect(() => parseCssRules(css)).not.toThrow()
    const reglas = parseCssRules(css)
    expect(reglas.some((r) => r.selectorText === '.otra')).toBe(true)
  })

  it('no lanza con una regla sin cerrar', () => {
    expect(() => parseCssRules('.card { color: ')).not.toThrow()
  })

  it('no lanza con CSS vacío ni con basura', () => {
    expect(parseCssRules('')).toEqual([])
    expect(() => parseCssRules('}}} no es css {{{')).not.toThrow()
  })
})

describe('findCssRuleAtOffset', () => {
  it('encuentra la regla que contiene el cursor', () => {
    const reglas = parseCssRules(CSS)
    const dentroDeMenu = rangoDe('#menu') + 2
    expect(findCssRuleAtOffset(reglas, dentroDeMenu, dentroDeMenu)!.rule.selectorText).toBe('#menu')
  })

  it('identifica además la declaración concreta bajo el cursor', () => {
    const reglas = parseCssRules(CSS)
    const dentroDeRadius = rangoDe('border-radius') + 3
    const hit = findCssRuleAtOffset(reglas, dentroDeRadius, dentroDeRadius)!
    expect(hit.rule.selectorText).toBe('.card')
    expect(hit.declaration?.property).toBe('border-radius')
  })

  it('dentro de una @media elige la regla interna, no el bloque entero', () => {
    const reglas = parseCssRules(CSS)
    const dentro = rangoDe('display: none') + 2
    const hit = findCssRuleAtOffset(reglas, dentro, dentro)!
    expect(hit.rule.selectorText).toBe('.menu')
    expect(hit.rule.mediaText).toBe('(max-width: 500px)')
  })

  it('devuelve null si el cursor no está dentro de ninguna regla', () => {
    const reglas = parseCssRules(CSS)
    expect(findCssRuleAtOffset(reglas, 0, 0)).not.toBeNull() // inicio de .card sí cuenta
    expect(findCssRuleAtOffset(reglas, CSS.length + 50, CSS.length + 50)).toBeNull()
  })
})

describe('resolveCssRuleInDocument — puente AST ⇄ CSSOM', () => {
  function montar(css: string, html: string) {
    document.head.innerHTML = '<style>' + css + '</style>'
    document.body.innerHTML = html
    return parseCssRules(css)
  }

  it('cuenta exactamente los elementos que coinciden con el selector', () => {
    const css = '.card { color: red; }'
    const reglas = montar(css, '<div class="card">1</div><div class="card">2</div><div class="card">3</div><div class="card">4</div>')
    const hit = findCssRuleAtOffset(reglas, 2, 2)!
    const match = resolveCssRuleInDocument(document, hit)
    expect(match.status).toBe('exact')
    expect(match.matchedCount).toBe(4)
    expect(match.elements).toHaveLength(4)
  })

  it('un selector sin coincidencias es EXACTO con cero elementos, no "no determinable"', () => {
    const css = '.fantasma { color: red; }'
    const reglas = montar(css, '<div class="card">1</div>')
    const match = resolveCssRuleInDocument(document, findCssRuleAtOffset(reglas, 2, 2)!)
    expect(match.status).toBe('exact')
    expect(match.matchedCount).toBe(0)
  })

  it('resuelve selectores de elemento, id, descendiente y múltiples', () => {
    const css = 'button { color: red; }\n#menu { color: blue; }\n.card p { color: green; }\nh1, h2 { margin: 0; }'
    const reglas = montar(css, '<button>b</button><nav id="menu"></nav><div class="card"><p>x</p><p>y</p></div><h1>t</h1><h2>s</h2>')
    const cuenta = (fragmento: string) => {
      const pos = css.indexOf(fragmento) + 1
      return resolveCssRuleInDocument(document, findCssRuleAtOffset(reglas, pos, pos)!).matchedCount
    }
    expect(cuenta('button')).toBe(1)
    expect(cuenta('#menu')).toBe(1)
    expect(cuenta('.card p')).toBe(2)
    expect(cuenta('h1, h2')).toBe(2)
  })

  it('conserva la propiedad bajo el cursor para el futuro "¿Qué es esto?"', () => {
    const css = '.card { background: white; }'
    const reglas = montar(css, '<div class="card"></div>')
    const pos = css.indexOf('background') + 2
    expect(resolveCssRuleInDocument(document, findCssRuleAtOffset(reglas, pos, pos)!).property).toBe('background')
  })

  it('si el navegador no tiene esa regla donde el texto dice, responde NO DETERMINABLE', () => {
    const css = '.card { color: red; }'
    const reglas = montar(css, '<div class="card"></div>')
    const hit = findCssRuleAtOffset(reglas, 2, 2)!
    // Simula el desajuste: la hoja aplicada no es la que se analizó.
    document.head.innerHTML = '<style>.otra-cosa { color: blue; }</style>'
    expect(resolveCssRuleInDocument(document, hit).status).toBe('none')
  })

  it('una ruta que no existe en el CSSOM es NO DETERMINABLE, nunca una regla vecina', () => {
    const css = '.card { color: red; }'
    const reglas = montar(css, '<div class="card"></div>')
    const hit = findCssRuleAtOffset(reglas, 2, 2)!
    const inventada = { ...hit, rule: { ...hit.rule, path: [99] } }
    expect(resolveCssRuleInDocument(document, inventada).status).toBe('none')
  })

  it('reporta la condición de la @media que envuelve a la regla', () => {
    const css = '@media (max-width: 500px) { .card { color: red; } }'
    const reglas = montar(css, '<div class="card"></div>')
    const pos = css.indexOf('color') + 1
    const match = resolveCssRuleInDocument(document, findCssRuleAtOffset(reglas, pos, pos)!)
    expect(match.status).toBe('exact')
    expect(match.mediaText).toContain('max-width')
    // jsdom no implementa matchMedia: activo/inactivo se verifica en navegador real.
  })
})

// PASO 4.2 (Preview → CSS): dado un elemento del preview, qué reglas están DEMOSTRABLEMENTE
// relacionadas — element.matches(selectorText), nunca por parecido de nombres ni herencia.
describe('findCssRulesForElement — Preview → CSS', () => {
  function montar(css: string, html: string) {
    document.head.innerHTML = '<style>' + css + '</style>'
    document.body.innerHTML = html
    return parseCssRules(css)
  }

  it('un elemento con una sola regla relacionada', () => {
    const reglas = montar('.card { color: red; }', '<div class="card"></div>')
    const el = document.querySelector('.card')!
    const related = findCssRulesForElement(document, reglas, el)
    expect(related).toHaveLength(1)
    expect(related[0].selector).toBe('.card')
  })

  it('un elemento con varias reglas relacionadas, en orden del archivo', () => {
    const css = '.card { color: red; }\nh1 { margin: 0; }\n.card { padding: 8px; }'
    const reglas = montar(css, '<div class="card"><h1>Título</h1></div>')
    const h1 = document.querySelector('h1')!
    const related = findCssRulesForElement(document, reglas, h1)
    expect(related.map((r) => r.selector)).toEqual(['h1'])

    const card = document.querySelector('.card')!
    const relacionadasCard = findCssRulesForElement(document, reglas, card)
    // Las dos reglas .card, en el mismo orden en que aparecen en el archivo — nunca reordenadas
    // por una supuesta importancia.
    expect(relacionadasCard).toHaveLength(2)
    expect(relacionadasCard[0].start).toBeLessThan(relacionadasCard[1].start)
  })

  it('regla normal + regla dentro de @media, con su condición y estado', () => {
    const css = '.card { background: white; }\n@media (max-width: 500px) { .card { background: yellow; } }'
    const reglas = montar(css, '<div class="card"></div>')
    const related = findCssRulesForElement(document, reglas, document.querySelector('.card')!)
    expect(related).toHaveLength(2)
    expect(related[0].mediaText).toBeUndefined()
    expect(related[1].mediaText).toBe('(max-width: 500px)')
    // jsdom no implementa matchMedia — activo/inactivo real se verifica en navegador.
  })

  it('selector múltiple: h1, h2 relaciona con un h1 seleccionado', () => {
    const reglas = montar('h1, h2 { color: navy; }', '<h1>Título</h1><h2>Subtítulo</h2>')
    const relacionH1 = findCssRulesForElement(document, reglas, document.querySelector('h1')!)
    const relacionH2 = findCssRulesForElement(document, reglas, document.querySelector('h2')!)
    expect(relacionH1).toHaveLength(1)
    expect(relacionH2).toHaveLength(1)
  })

  it('selector descendiente: relaciona el hijo, NUNCA el contenedor directamente', () => {
    const reglas = montar('.card p { color: gray; }', '<div class="card"><p>Texto</p></div>')
    const p = document.querySelector('p')!
    const card = document.querySelector('.card')!
    expect(findCssRulesForElement(document, reglas, p)).toHaveLength(1)
    expect(findCssRulesForElement(document, reglas, card)).toHaveLength(0)
  })

  it('herencia: una regla en body no se muestra como relación directa de un <p> que no la selecciona', () => {
    const reglas = montar('body { color: black; }', '<p>Texto</p>')
    const p = document.querySelector('p')!
    expect(findCssRulesForElement(document, reglas, p)).toEqual([])
  })

  it('regla que no coincide con el elemento: lista vacía, no "no determinable"', () => {
    const reglas = montar('.fantasma { color: red; }', '<div class="card"></div>')
    expect(findCssRulesForElement(document, reglas, document.querySelector('.card')!)).toEqual([])
  })

  it('elemento sin ninguna regla en el archivo', () => {
    const reglas = montar('', '<div class="card"></div>')
    expect(findCssRulesForElement(document, reglas, document.querySelector('.card')!)).toEqual([])
  })

  it('mismatch AST ⇄ CSSOM: la regla no se muestra como relacionada (nunca una vecina)', () => {
    const reglas = montar('.card { color: red; }', '<div class="card"></div>')
    const el = document.querySelector('.card')!
    // Desincroniza a propósito la hoja aplicada respecto a lo que se analizó.
    document.head.innerHTML = '<style>.otra-cosa { color: blue; }</style>'
    expect(findCssRulesForElement(document, reglas, el)).toEqual([])
  })

  it('elemento creado por JavaScript (sin rango HTML fuente) puede tener CSS relacionado igual', () => {
    const reglas = montar('.card { color: red; }', '<main></main>')
    // Simula lo que hace el estudiante en tiempo de ejecución: un nodo que parse5 nunca vio.
    const nuevo = document.createElement('div')
    nuevo.className = 'card'
    document.querySelector('main')!.appendChild(nuevo)
    const related = findCssRulesForElement(document, reglas, nuevo)
    expect(related).toHaveLength(1)
    expect(related[0].selector).toBe('.card')
  })

  it('respeta el tope de reglas relacionadas exportado para el mensaje al host', () => {
    const css = Array.from({ length: MAX_RELATED_CSS_RULES + 10 }, () => '.card { color: red; }').join('\n')
    const reglas = montar(css, '<div class="card"></div>')
    const related = findCssRulesForElement(document, reglas, document.querySelector('.card')!)
    // La función en sí no recorta — el conteo real completo es responsabilidad de quien la
    // llama (main.ts), para nunca reportar un total falso.
    expect(related.length).toBe(MAX_RELATED_CSS_RULES + 10)
  })
})

// PASO 4.4 (punto 15 del gate): cierra la cobertura pedagógica de selector múltiple que 4.3
// dejó pendiente — un selector con TRES ramas, incluyendo una clase, no solo dos etiquetas.
describe('selector múltiple con clase — cierre de cobertura pendiente de 4.3', () => {
  it('h1, h2, .titulo { color: navy } detecta la declaración exacta y cuenta los 3 elementos, nunca el párrafo normal', () => {
    const css = 'h1, h2, .titulo { color: navy; }'
    document.head.innerHTML = '<style>' + css + '</style>'
    document.body.innerHTML = '<h1>Título</h1><h2>Subtítulo</h2><p class="titulo">Otro título</p><p>Normal</p>'
    const rules = parseCssRules(css)
    const pos = css.indexOf('navy')
    const hit = findCssRuleAtOffset(rules, pos, pos)!
    expect(hit.declaration?.property).toBe('color')
    expect(css.slice(hit.declaration!.valueStart, hit.declaration!.valueEnd)).toBe('navy')

    const match = resolveCssRuleInDocument(document, hit)
    expect(match.status).toBe('exact')
    expect(match.matchedCount).toBe(3) // h1 + h2 + .titulo — el <p> sin la clase queda fuera
  })
})

// PASO 4.4: la reevaluación al cambiar de viewport depende de repetir EXACTAMENTE la misma
// consulta (mismo `range`) contra el CSSOM actual, sin volver a analizar el CSS. Estas pruebas
// verifican esa función compuesta directamente — jsdom no implementa matchMedia de verdad
// (se confirma en navegador real), así que aquí se controla con un mock para probar que la
// función SIEMPRE recalcula y nunca devuelve un resultado cacheado de una llamada anterior.
describe('evaluateCssPosition — Paso 4.4: recalcula en cada llamada, nunca cachea', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('con la MISMA posición, refleja un matchMedia distinto en cada llamada (base de la reevaluación por viewport)', () => {
    const css = '@media (max-width: 500px) { .menu { display: none; } }'
    document.head.innerHTML = '<style>' + css + '</style>'
    document.body.innerHTML = '<nav class="menu"></nav>'
    const rules = parseCssRules(css)
    const pos = css.indexOf('display')
    const range = { start: pos, end: pos }

    const matchMediaMock = vi.fn().mockReturnValue({ matches: false })
    vi.stubGlobal('matchMedia', matchMediaMock)

    const enComputador = evaluateCssPosition(document, rules, css, range)
    expect(enComputador.status).toBe('exact')
    expect(enComputador.mediaActive).toBe(false)

    matchMediaMock.mockReturnValue({ matches: true })
    const enCelular = evaluateCssPosition(document, rules, css, range) // MISMO range, MISMA llamada repetida
    expect(enCelular.mediaActive).toBe(true) // se recalculó — no quedó pegado al resultado anterior

    // Identidad sin cambios entre una reevaluación y otra (punto 8 del gate): solo el ESTADO
    // (mediaActive) cambia, nunca la declaración/selector que se reporta.
    expect(enCelular.selector).toBe(enComputador.selector)
    expect(enCelular.property).toBe(enComputador.property)
  })

  it('incluye el valor exacto de la declaración (Paso 4.3) en cada evaluación, byte a byte', () => {
    const css = '.card { border-radius: 12PX ; }'
    document.head.innerHTML = '<style>' + css + '</style>'
    document.body.innerHTML = '<div class="card"></div>'
    const rules = parseCssRules(css)
    const pos = css.indexOf('12PX')
    const result = evaluateCssPosition(document, rules, css, { start: pos, end: pos })
    expect(result.value).toBe('12PX')
  })

  // PASO 5.0: sin el rango exacto del valor no puede haber edición segura — el host reemplaza
  // ese tramo y nada más, así que debe recortar exactamente el mismo texto que `value`.
  it('reporta el rango exacto del valor, coherente con `value` (Paso 5.0)', () => {
    const css = '.card {\n  background-color:   #fff ;\n  border-radius: 12px;\n}'
    document.head.innerHTML = '<style>' + css + '</style>'
    document.body.innerHTML = '<div class="card"></div>'
    const rules = parseCssRules(css)
    const pos = css.indexOf('#fff')
    const result = evaluateCssPosition(document, rules, css, { start: pos, end: pos })
    expect(result.value).toBe('#fff')
    expect(css.slice(result.valueStart!, result.valueEnd!)).toBe('#fff')
    // El rango cubre SOLO el valor: ni la propiedad, ni los dos puntos, ni el espacio sobrante.
    expect(css.slice(result.valueStart! - 1, result.valueStart!)).toBe(' ')
  })

  it('con el cursor en la regla pero fuera de una declaración, no hay rango de valor que ofrecer', () => {
    const css = '.card { color: #000000; }'
    document.head.innerHTML = '<style>' + css + '</style>'
    document.body.innerHTML = '<div class="card"></div>'
    const rules = parseCssRules(css)
    const pos = css.indexOf('.card') + 1 // dentro del selector, no de la declaración
    const result = evaluateCssPosition(document, rules, css, { start: pos, end: pos })
    expect(result.status).toBe('exact')
    expect(result.value).toBeUndefined()
    expect(result.valueStart).toBeUndefined()
    expect(result.valueEnd).toBeUndefined()
  })

  it('sin ninguna regla en esa posición: "none" con cero elementos, nunca inventado', () => {
    const css = '.card { color: red; }'
    document.head.innerHTML = '<style>' + css + '</style>'
    const rules = parseCssRules(css)
    const fuera = evaluateCssPosition(document, rules, css, { start: css.length + 20, end: css.length + 20 })
    expect(fuera).toEqual({ status: 'none', matchedCount: 0, elements: [] })
  })
})
