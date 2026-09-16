import { describe, expect, it } from 'vitest'
import { escapeHtmlText, normalizeNewText, prepareHtmlTextForSource, replaceHtmlTextAtRange } from './htmlEdits'

describe('escapeHtmlText — la edición de texto nunca puede insertar HTML', () => {
  it('escapa & y los signos de menor/mayor', () => {
    expect(escapeHtmlText('Tomás & Ana')).toBe('Tomás &amp; Ana')
    expect(escapeHtmlText('a < b > c')).toBe('a &lt; b &gt; c')
  })

  it('un intento de inyectar <script> queda como texto visible, no como estructura', () => {
    expect(escapeHtmlText('Hola <script>alert(1)</script>'))
      .toBe('Hola &lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('escapa & antes que el resto, para no romper las entidades que él mismo produce', () => {
    // Si se escapara `<` primero, el `&` de `&lt;` se volvería a escapar y saldría `&amp;lt;`.
    expect(escapeHtmlText('<')).toBe('&lt;')
    expect(escapeHtmlText('&lt;')).toBe('&amp;lt;') // texto literal "&lt;", no un signo menor
  })

  it('deja intacto el texto normal, incluidas tildes y comillas', () => {
    expect(escapeHtmlText('Bienvenido a "Mi tienda" — Tomás')).toBe('Bienvenido a "Mi tienda" — Tomás')
  })
})

describe('normalizeNewText — lo que el estudiante escribe antes de escribirlo', () => {
  it('recorta los extremos y colapsa espacios internos', () => {
    expect(normalizeNewText('  Tienda   Escolar  ')).toBe('Tienda Escolar')
    expect(normalizeNewText('Hola\nmundo\tya')).toBe('Hola mundo ya')
  })

  it('un texto vacío o solo espacios no se escribe', () => {
    expect(normalizeNewText('')).toBeNull()
    expect(normalizeNewText('    ')).toBeNull()
    expect(normalizeNewText('\n\t')).toBeNull()
  })

  it('rechaza un texto desmedido', () => {
    expect(normalizeNewText('x'.repeat(2_001))).toBeNull()
  })
})

describe('prepareHtmlTextForSource — normaliza primero, escapa después', () => {
  it('produce el texto tal como quedará escrito en el archivo', () => {
    expect(prepareHtmlTextForSource('  Tomás & Ana  ')).toBe('Tomás &amp; Ana')
    expect(prepareHtmlTextForSource('Hola <b>')).toBe('Hola &lt;b&gt;')
  })

  it('sin texto válido no hay nada que escribir', () => {
    expect(prepareHtmlTextForSource('   ')).toBeNull()
  })
})

describe('replaceHtmlTextAtRange — reemplazo atómico del nodo de texto', () => {
  it('cambia el texto y deja etiquetas y atributos exactamente igual', () => {
    const html = '<h1 class="titulo" id="t">Mi tienda</h1>'
    const start = html.indexOf('Mi tienda')
    const r = replaceHtmlTextAtRange(html, { start, end: start + 9 }, 'Mi tienda', 'Tienda Escolar')!
    expect(r.html).toBe('<h1 class="titulo" id="t">Tienda Escolar</h1>')
  })

  it('conserva comentarios, indentación y elementos hermanos', () => {
    const html = '<!-- encabezado -->\n<main>\n  <h1>Mi tienda</h1>\n  <p>Bienvenido</p>\n</main>\n'
    const start = html.indexOf('Mi tienda')
    const r = replaceHtmlTextAtRange(html, { start, end: start + 9 }, 'Mi tienda', 'Tienda Escolar')!
    expect(r.html).toBe('<!-- encabezado -->\n<main>\n  <h1>Tienda Escolar</h1>\n  <p>Bienvenido</p>\n</main>\n')
  })

  it('dos textos idénticos: cambia SOLO el del rango, nunca el otro', () => {
    const html = '<button>Comprar</button>\n<button>Comprar</button>'
    const segundo = html.lastIndexOf('Comprar')
    const r = replaceHtmlTextAtRange(html, { start: segundo, end: segundo + 7 }, 'Comprar', 'Agregar')!
    expect(r.html).toBe('<button>Comprar</button>\n<button>Agregar</button>')
  })

  it('el texto esperado es el ESCRITO en el archivo, con sus entidades', () => {
    const html = '<p>Tomás &amp; Ana</p>'
    const start = html.indexOf('Tomás')
    const fuente = 'Tomás &amp; Ana'
    // Con el texto que el estudiante VE ("Tomás & Ana") NO valida: no es lo que hay escrito.
    expect(replaceHtmlTextAtRange(html, { start, end: start + fuente.length }, 'Tomás & Ana', 'Ana')).toBeNull()
    const r = replaceHtmlTextAtRange(html, { start, end: start + fuente.length }, fuente, 'Ana &amp; Tomás')!
    expect(r.html).toBe('<p>Ana &amp; Tomás</p>')
  })

  it('devuelve el rango del texto NUEVO para poder mostrárselo al estudiante', () => {
    const html = '<p>Bienvenido</p>'
    const start = html.indexOf('Bienvenido')
    const r = replaceHtmlTextAtRange(html, { start, end: start + 10 }, 'Bienvenido', 'Hola')!
    expect(r.range).toEqual({ start, end: start + 4 })
    expect(r.html.slice(r.range.start, r.range.end)).toBe('Hola')
  })

  it('rango obsoleto: null, y nunca se busca el texto en otra parte', () => {
    const html = '<h1>Otro título</h1>' // el estudiante ya lo cambió a mano
    const start = html.indexOf('Otro')
    expect(replaceHtmlTextAtRange(html, { start, end: start + 9 }, 'Mi tienda', 'Tienda Escolar')).toBeNull()
  })

  it('un borrador distinto del aplicado no se edita a ciegas', () => {
    const aplicado = '<h1>Mi tienda</h1>'
    const borrador = '<h1>Mi bodega</h1>'
    const start = aplicado.indexOf('Mi tienda')
    expect(replaceHtmlTextAtRange(borrador, { start, end: start + 9 }, 'Mi tienda', 'Tienda Escolar')).toBeNull()
  })

  it('rango fuera de límites, invertido o no entero: null', () => {
    const html = '<h1>Mi tienda</h1>'
    expect(replaceHtmlTextAtRange(html, { start: 500, end: 509 }, 'Mi tienda', 'X')).toBeNull()
    expect(replaceHtmlTextAtRange(html, { start: 12, end: 4 }, 'Mi tienda', 'X')).toBeNull()
    expect(replaceHtmlTextAtRange(html, { start: -1, end: 9 }, 'Mi tienda', 'X')).toBeNull()
    expect(replaceHtmlTextAtRange(html, { start: 1.5, end: 9 }, 'Mi tienda', 'X')).toBeNull()
  })

  it('el texto escapado entra como texto, no como estructura (circuito completo)', () => {
    const html = '<p>Bienvenido</p>'
    const start = html.indexOf('Bienvenido')
    const seguro = prepareHtmlTextForSource('Hola <script>alert(1)</script>')!
    const r = replaceHtmlTextAtRange(html, { start, end: start + 10 }, 'Bienvenido', seguro)!
    expect(r.html).toBe('<p>Hola &lt;script&gt;alert(1)&lt;/script&gt;</p>')
    expect(r.html).not.toContain('<script>')
  })
})
