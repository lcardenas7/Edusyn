import { describe, expect, it } from 'vitest'
import { instrumentHtml } from './instrument'

/** Extrae, de un HTML instrumentado, el texto que cae dentro del rango indicado — así las
 * pruebas verifican contra el HTML ORIGINAL (lo que el estudiante ve en su editor), nunca
 * contra el HTML instrumentado (que el estudiante nunca ve). */
function sliceOriginal(originalHtml: string, range: { start: number; end: number }): string {
  return originalHtml.slice(range.start, range.end)
}

describe('instrumentHtml — casos base', () => {
  it('1. h1 simple: un rango que cubre exactamente el elemento', () => {
    const html = '<h1>Hola</h1>'
    const { ranges } = instrumentHtml(html)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].tagName).toBe('h1')
    expect(sliceOriginal(html, ranges[0])).toBe('<h1>Hola</h1>')
  })

  it('2. botón: rango exacto y atributo agregado solo al HTML instrumentado, nunca al original', () => {
    const html = '<button class="principal">Comenzar</button>'
    const { html: instrumented, ranges } = instrumentHtml(html)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].tagName).toBe('button')
    expect(sliceOriginal(html, ranges[0])).toBe(html)
    expect(instrumented).toContain('data-edusyn-id="0"')
    expect(html).not.toContain('data-edusyn-id')
  })
})

describe('instrumentHtml — 3. varias tarjetas visualmente iguales', () => {
  it('asigna un id y un rango distinto a cada tarjeta idéntica', () => {
    const card = '<div class="tarjeta"><h2>Tarjeta</h2><p>Contenido</p></div>'
    const html = card + card + card
    const { ranges } = instrumentHtml(html)
    const cardRanges = ranges.filter((r) => r.tagName === 'div')
    expect(cardRanges).toHaveLength(3)
    const starts = cardRanges.map((r) => r.start)
    expect(new Set(starts).size).toBe(3) // tres posiciones distintas, no una repetida
    cardRanges.forEach((range) => expect(sliceOriginal(html, range)).toBe(card))
  })
})

describe('instrumentHtml — 4. elementos anidados', () => {
  it('el rango del hijo queda contenido dentro del rango del padre', () => {
    const html = '<section><article><h3>Título</h3><p>Texto</p></article></section>'
    const { ranges } = instrumentHtml(html)
    const section = ranges.find((r) => r.tagName === 'section')!
    const article = ranges.find((r) => r.tagName === 'article')!
    const h3 = ranges.find((r) => r.tagName === 'h3')!
    expect(section.start).toBeLessThanOrEqual(article.start)
    expect(article.end).toBeLessThanOrEqual(section.end)
    expect(article.start).toBeLessThanOrEqual(h3.start)
    expect(h3.end).toBeLessThanOrEqual(article.end)
  })
})

describe('instrumentHtml — 5 y 6. HTML imperfecto: tags sin cerrar y auto-cierre HTML5', () => {
  it('dos <p> sin cerrar: cada uno recibe su propio rango, sin solaparse', () => {
    const html = '<div><p>uno<p>dos</div>'
    const { ranges } = instrumentHtml(html)
    const paragraphs = ranges.filter((r) => r.tagName === 'p')
    expect(paragraphs).toHaveLength(2)
    // El primer <p> se cierra implícitamente justo donde empieza el segundo (regla real de
    // HTML5, no una decisión nuestra) — no deben solaparse.
    expect(paragraphs[0].end).toBeLessThanOrEqual(paragraphs[1].start)
  })

  it('no revienta con HTML gravemente roto y sigue reportando rangos dentro de los límites', () => {
    const html = '<div><span><b>texto sin cerrar nada'
    expect(() => instrumentHtml(html)).not.toThrow()
    const { ranges } = instrumentHtml(html)
    ranges.forEach((r) => {
      expect(r.start).toBeGreaterThanOrEqual(0)
      expect(r.end).toBeLessThanOrEqual(html.length)
      expect(r.start).toBeLessThanOrEqual(r.end)
    })
  })
})

describe('instrumentHtml — 7. elementos void (img, input)', () => {
  it('img: se instrumenta sin romper el tag autocontenido', () => {
    const html = '<img src="foto.png" alt="una foto">'
    const { html: instrumented, ranges } = instrumentHtml(html)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].tagName).toBe('img')
    expect(sliceOriginal(html, ranges[0])).toBe(html)
    expect(instrumented).toMatch(/^<img src="foto\.png" alt="una foto" data-edusyn-id="0">$/)
  })

  it('input: mismo comportamiento que img', () => {
    const html = '<input type="text" placeholder="nombre">'
    const { ranges } = instrumentHtml(html)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].tagName).toBe('input')
  })
})

describe('instrumentHtml — 8. elemento sin correspondencia fiable (nodo implícito del parser)', () => {
  it('una tabla sin <tbody> explícito: el <tbody> implícito NO se instrumenta, sus hijos sí', () => {
    const html = '<table><tr><td>x</td></tr></table>'
    const { ranges } = instrumentHtml(html)
    expect(ranges.some((r) => r.tagName === 'tbody')).toBe(false)
    expect(ranges.some((r) => r.tagName === 'tr')).toBe(true)
    expect(ranges.some((r) => r.tagName === 'td')).toBe(true)
    // Los que sí se instrumentaron siguen apuntando exactamente a su propio texto.
    const tr = ranges.find((r) => r.tagName === 'tr')!
    expect(sliceOriginal(html, tr)).toBe('<tr><td>x</td></tr>')
  })
})

describe('instrumentHtml — 10. elementos con texto repetido', () => {
  it('dos párrafos con el mismo texto obtienen rangos distintos y correctos', () => {
    const html = '<p>Hola</p><p>Hola</p>'
    const { ranges } = instrumentHtml(html)
    expect(ranges).toHaveLength(2)
    expect(ranges[0].start).not.toBe(ranges[1].start)
    expect(sliceOriginal(html, ranges[0])).toBe('<p>Hola</p>')
    expect(sliceOriginal(html, ranges[1])).toBe('<p>Hola</p>')
  })
})

describe('instrumentHtml — 14. atributos largos/multilínea', () => {
  it('un atributo que ocupa varias líneas no rompe el rango ni el punto de inserción', () => {
    const html = '<button\n  class="principal"\n  data-title="Un texto\nmuy largo que sigue\nen varias líneas más"\n>Comenzar</button>'
    const { html: instrumented, ranges } = instrumentHtml(html)
    expect(ranges).toHaveLength(1)
    expect(ranges[0].tagName).toBe('button')
    expect(sliceOriginal(html, ranges[0])).toBe(html)
    expect(instrumented).toContain('data-edusyn-id="0"')
    // El atributo multilínea llega intacto (nada lo cortó a la mitad) y el nuevo atributo se
    // agregó justo antes del ">" de apertura, después de él.
    expect(instrumented).toContain('data-title="Un texto\nmuy largo que sigue\nen varias líneas más"')
    expect(instrumented).toMatch(/data-edusyn-id="0"\s*>Comenzar/)
  })
})

describe('instrumentHtml — defensas adicionales', () => {
  it('no pisa un atributo data-edusyn-id que ya existiera en el HTML del estudiante', () => {
    const html = '<div data-edusyn-id="lo-que-sea">contenido</div>'
    const { ranges, html: instrumented } = instrumentHtml(html)
    expect(ranges.some((r) => r.tagName === 'div')).toBe(false)
    // No se duplica el atributo ni se altera su valor original.
    expect(instrumented).toBe(html)
  })

  it('SVG permitido: se instrumenta igual que HTML normal', () => {
    const html = '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#000"/></svg>'
    const { ranges } = instrumentHtml(html)
    expect(ranges.some((r) => r.tagName === 'svg')).toBe(true)
    expect(ranges.some((r) => r.tagName === 'circle')).toBe(true)
  })

  it('HTML vacío no revienta y no produce rangos', () => {
    expect(instrumentHtml('').ranges).toEqual([])
    expect(instrumentHtml('   ').ranges).toEqual([])
  })
})

describe('instrumentHtml — 13. no altera visualmente el preview', () => {
  it('la instrumentación es reversible: quitando data-edusyn-id se recupera el HTML original byte a byte', () => {
    const html = '<main class="tarjeta"><h1>Reto</h1><p>Texto <b>importante</b></p><img src="x.png"><button>Ir</button></main>'
    const { html: instrumented } = instrumentHtml(html)
    const stripped = instrumented.replace(/ data-edusyn-id="\d+"/g, '')
    expect(stripped).toBe(html)
  })

  it('data-* es un atributo sin efecto de presentación propio: no agrega estilos ni clases', () => {
    const html = '<button class="principal">Comenzar</button>'
    const { html: instrumented } = instrumentHtml(html)
    expect(instrumented).not.toMatch(/style=/)
    expect(instrumented).toContain('class="principal"') // la clase original queda intacta
  })
})

// PASO 5.1: criterio de "texto simple editable". La ausencia de `text` es la señal de "aquí no
// se puede cambiar el texto" — el host no lo deduce de ninguna otra forma.
describe('instrumentHtml — texto simple editable (Paso 5.1)', () => {
  const textoDe = (html: string, tagName: string) => instrumentHtml(html).ranges.find((r) => r.tagName === tagName)?.text

  it('elementos con un único nodo de texto: editables, con rango exacto', () => {
    for (const [html, tag, valor] of [
      ['<h1>Mi tienda</h1>', 'h1', 'Mi tienda'],
      ['<p>Bienvenido</p>', 'p', 'Bienvenido'],
      ['<button>Comprar</button>', 'button', 'Comprar'],
      ['<span>Hola</span>', 'span', 'Hola'],
      ['<label>Nombre</label>', 'label', 'Nombre'],
      ['<li>Uno</li>', 'li', 'Uno'],
      ['<h2 class="x" id="y">Sección</h2>', 'h2', 'Sección'],
    ] as const) {
      const text = textoDe(html, tag)
      expect(text, html).toBeDefined()
      expect(text!.value).toBe(valor)
      expect(html.slice(text!.start, text!.end)).toBe(valor)
      expect(text!.source).toBe(valor)
    }
  })

  it('dos elementos con el mismo texto tienen rangos DISTINTOS (nunca se confunden)', () => {
    const html = '<button>Comprar</button><button>Comprar</button>'
    const botones = instrumentHtml(html).ranges.filter((r) => r.tagName === 'button')
    expect(botones).toHaveLength(2)
    expect(botones[0].text!.start).not.toBe(botones[1].text!.start)
    expect(html.slice(botones[1].text!.start, botones[1].text!.end)).toBe('Comprar')
  })

  it('entidades: `value` es lo que se ve y `source` lo que está escrito', () => {
    const html = '<p>Tomás &amp; Ana</p>'
    const text = textoDe(html, 'p')!
    expect(text.value).toBe('Tomás & Ana')
    expect(text.source).toBe('Tomás &amp; Ana')
    expect(html.slice(text.start, text.end)).toBe('Tomás &amp; Ana')
  })

  it('estructura hija que se perdería: NO editable', () => {
    expect(textoDe('<p>Hola <strong>Luis</strong></p>', 'p')).toBeUndefined()
    expect(textoDe('<button><span>Comprar</span></button>', 'button')).toBeUndefined()
    expect(textoDe('<p>Texto <br> siguiente</p>', 'p')).toBeUndefined()
    expect(textoDe('<p>Hola <span>Luis</span>, bienvenido.</p>', 'p')).toBeUndefined()
  })

  it('el hijo que SÍ es editable dentro de un padre que no lo es, sigue siéndolo', () => {
    // <p> tiene varios hijos, pero el <strong> interior es un texto simple inequívoco.
    const html = '<p>Hola <strong>Luis</strong></p>'
    expect(textoDe(html, 'p')).toBeUndefined()
    expect(textoDe(html, 'strong')!.value).toBe('Luis')
  })

  it('elemento sin texto: NO editable', () => {
    expect(textoDe('<p></p>', 'p')).toBeUndefined()
    expect(textoDe('<div><span>x</span></div>', 'div')).toBeUndefined()
  })

  it('texto con espacio en blanco alrededor: NO editable (no reformatear la indentación)', () => {
    expect(textoDe('<h1>\n    Mi tienda\n</h1>', 'h1')).toBeUndefined()
    expect(textoDe('<p> Hola</p>', 'p')).toBeUndefined()
    expect(textoDe('<p>Hola </p>', 'p')).toBeUndefined()
    expect(textoDe('<p>   </p>', 'p')).toBeUndefined()
  })

  it('el espacio interior no estorba: solo importan los extremos', () => {
    expect(textoDe('<p>Bienvenido a nuestra tienda</p>', 'p')!.value).toBe('Bienvenido a nuestra tienda')
  })

  it('script/style/textarea/title/pre: NO editables como texto', () => {
    expect(textoDe('<script>alert(1)</script>', 'script')).toBeUndefined()
    expect(textoDe('<style>p{color:red}</style>', 'style')).toBeUndefined()
    expect(textoDe('<textarea>hola</textarea>', 'textarea')).toBeUndefined()
    expect(textoDe('<pre>hola</pre>', 'pre')).toBeUndefined()
  })

  it('los atributos NO son texto editable en este paso', () => {
    // <input> no tiene hijos: nunca ofrece edición de texto, aunque tenga value="Luis".
    expect(textoDe('<input value="Luis">', 'input')).toBeUndefined()
    // Y en un elemento con texto, el rango cubre el texto, jamás el atributo.
    const html = '<button title="Ir a la tienda">Comprar</button>'
    const text = textoDe(html, 'button')!
    expect(html.slice(text.start, text.end)).toBe('Comprar')
  })
})
