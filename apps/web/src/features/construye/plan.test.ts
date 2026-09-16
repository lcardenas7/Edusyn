import { describe, expect, it } from 'vitest'
import { buildCapabilityContext, type CapabilitySource } from './capabilities'
import { interpretIntent } from './intent'
import { applyRelativeChange, buildPlan, executePlan } from './plan'

/** Proyecto de referencia del gate: 4 botones .cta con las cuatro propiedades certificadas. */
const HTML = '<button class="cta">Comprar</button>\n<button class="cta">Comprar</button>\n'
const CSS = '.cta {\n  background-color:#ffffff;\n  color:#000000;\n  font-size:20px;\n  border-radius:8px;\n}\n'

const rango = (texto: string, dentro = CSS) => ({ start: dentro.indexOf(texto), end: dentro.indexOf(texto) + texto.length })

/** Declaración como la reporta el runner: valor con su rango y la declaración completa. */
export function declaracion(property: string, value: string, css = CSS) {
  const texto = `${property}:${value}`
  const start = css.indexOf(texto)
  return { property, value, valueStart: css.indexOf(value, start), valueEnd: css.indexOf(value, start) + value.length, start, end: start + texto.length }
}

function reglaCompleta(css: string, selector: string, declaraciones: ReturnType<typeof declaracion>[], extra: Record<string, unknown> = {}) {
  const start = css.indexOf(selector)
  const blockStart = css.indexOf('{', start)
  return {
    selector,
    start,
    end: css.indexOf('}', blockStart) + 1,
    blockStart,
    blockEnd: css.indexOf('}', blockStart) + 1,
    matchedCount: 4,
    declarations: declaraciones,
    declarationTotal: declaraciones.length,
    lastDeclarationEnd: declaraciones.length ? Math.max(...declaraciones.map((d) => d.end)) : undefined,
    ...extra,
  }
}

function fuente(over: Partial<CapabilitySource> = {}): CapabilitySource {
  return {
    tagName: 'button',
    text: { start: HTML.indexOf('Comprar'), end: HTML.indexOf('Comprar') + 7, value: 'Comprar', source: 'Comprar' },
    cssRelated: [reglaCompleta(CSS, '.cta', [
      declaracion('background-color', '#ffffff'),
      declaracion('color', '#000000'),
      declaracion('font-size', '20px'),
      declaracion('border-radius', '8px'),
    ])],
    css: CSS,
    htmlLength: HTML.length,
    cssLength: CSS.length,
    ...over,
  }
}

const planDe = (peticion: string, source = fuente()) => {
  const context = buildCapabilityContext(source)
  return { context, plan: buildPlan(context, interpretIntent(peticion, context.manifest)) }
}

describe('capability manifest — qué se puede modificar (Capa B)', () => {
  it('expone las capacidades del elemento con IDs opacos y SIN rangos ni archivos', () => {
    const { manifest, targets } = buildCapabilityContext(fuente())
    expect(manifest.element.tag).toBe('button')
    expect(manifest.capabilities.map((c) => c.id)).toEqual(['text-1', 'css-1', 'css-2', 'css-3', 'css-4'])
    // Ni un offset, ni un archivo, ni un selector: nada con lo que apuntar al código.
    const serializado = JSON.stringify(manifest)
    expect(serializado).not.toMatch(/valueStart|valueEnd|"start"|"end"|styles\.css|index\.html|\.cta/)
    // La resolución a rangos existe, pero vive aparte del manifiesto.
    expect(targets.find((t) => t.id === 'css-1')).toMatchObject({ file: 'css', expected: '#ffffff' })
    expect(targets.find((t) => t.id === 'text-1')).toMatchObject({ file: 'html', expected: 'Comprar' })
  })

  it('sin texto simple editable no hay capacidad de texto', () => {
    const { manifest } = buildCapabilityContext(fuente({ text: undefined }))
    expect(manifest.capabilities.some((c) => c.kind === 'text')).toBe(false)
  })

  it('C. un valor no editable (var, shorthand) no se modifica NI se duplica con una inserción', () => {
    const css = '.cta { background-color:var(--x); border-radius:10px 20px; }'
    const { manifest } = buildCapabilityContext(fuente({
      css,
      cssRelated: [reglaCompleta(css, '.cta', [declaracion('background-color', 'var(--x)', css), declaracion('border-radius', '10px 20px', css)])],
    }))
    const css_ = manifest.capabilities.filter((c) => c.kind === 'css')
    // Ninguna capacidad de MODIFICAR: los dos valores están fuera de la gramática segura.
    expect(css_.every((c) => c.action === 'add')).toBe(true)
    // Y ninguna inserción de esas dos propiedades: ya existen, aunque no se puedan modificar.
    expect(css_.some((c) => c.property === 'background-color')).toBe(false)
    expect(css_.some((c) => c.property === 'border-radius')).toBe(false)
    // La que sí falta en la regla puede ofrecerse.
    expect(css_.map((c) => c.property)).toEqual(['color'])
  })

  it('propiedad repetida en varias reglas: NO se ofrece (Construye no resuelve cascada)', () => {
    const css = '.cta { background-color:#ffffff; }\n@media (max-width: 500px) { .cta { background-color:#000000; } }'
    const { manifest } = buildCapabilityContext(fuente({
      cssRelated: [
        { selector: '.cta', start: 0, end: 34, matchedCount: 4, declarations: [{ property: 'background-color', value: '#ffffff', valueStart: css.indexOf('#ffffff'), valueEnd: css.indexOf('#ffffff') + 7 }] },
        { selector: '.cta', start: 35, end: css.length, matchedCount: 4, mediaText: '(max-width: 500px)', mediaActive: false, declarations: [{ property: 'background-color', value: '#000000', valueStart: css.indexOf('#000000'), valueEnd: css.indexOf('#000000') + 7 }] },
      ],
    }))
    expect(manifest.capabilities.some((c) => c.kind === 'css' && c.property === 'background-color')).toBe(false)
  })

  it('el contextId cambia si cambia el elemento o la versión de los archivos', () => {
    const base = buildCapabilityContext(fuente()).manifest.contextId
    expect(buildCapabilityContext(fuente({ htmlLength: 999 })).manifest.contextId).not.toBe(base)
    expect(buildCapabilityContext(fuente({ tagName: 'a' })).manifest.contextId).not.toBe(base)
  })
})

describe('intérprete local — de frase a intención (Capa A)', () => {
  it('color semántico sobre el fondo', () => {
    const { plan } = planDe('hazlo azul')
    expect(plan.operations).toHaveLength(1)
    expect(plan.operations[0]).toMatchObject({ label: 'Color de fondo', before: '#ffffff', after: '#2563eb', affectedElements: 4 })
  })

  it('hex escrito por el estudiante se respeta tal cual', () => {
    expect(planDe('cambia el fondo a #ff0000').plan.operations[0]).toMatchObject({ after: '#ff0000' })
  })

  it('distingue el color del TEXTO del color de fondo', () => {
    expect(planDe('pon el texto en rojo').plan.operations[0]).toMatchObject({ label: 'Color del texto', after: '#dc2626' })
    expect(planDe('el fondo rojo').plan.operations[0]).toMatchObject({ label: 'Color de fondo', after: '#dc2626' })
  })

  it('cambia el texto con "que diga X"', () => {
    const { plan } = planDe('que diga Comenzar')
    expect(plan.operations[0]).toMatchObject({ label: 'Texto', before: 'Comprar', after: 'Comenzar', file: 'html', affectedElements: 1 })
  })

  it('términos relativos: más grande / más pequeño / más redondeado / menos redondeado', () => {
    expect(planDe('haz el texto más grande').plan.operations[0]).toMatchObject({ before: '20px', after: '25px' })
    expect(planDe('haz el texto más pequeño').plan.operations[0]).toMatchObject({ before: '20px', after: '15px' })
    expect(planDe('redondea más las esquinas').plan.operations[0]).toMatchObject({ before: '8px', after: '12px' })
    expect(planDe('redondea menos las esquinas').plan.operations[0]).toMatchObject({ before: '8px', after: '4px' })
  })

  it('combina varias operaciones en un solo plan', () => {
    const { plan } = planDe('Quiero que sea azul, más redondeado y diga Comenzar')
    expect(plan.operations.map((o) => o.label).sort()).toEqual(['Color de fondo', 'Redondeo de las esquinas', 'Texto'])
    expect(plan.unsupported).toEqual([])
  })

  it('intención parcial: hace lo posible y avisa de lo que no (punto 8)', () => {
    const { plan } = planDe('Hazlo azul y agrega una animación que rebote')
    expect(plan.operations).toHaveLength(1)
    expect(plan.operations[0].label).toBe('Color de fondo')
    expect(plan.unsupported.join(' ')).toMatch(/animaci[óo]n/i)
  })

  it('sin regla inequívoca, sigue sin inventar una propiedad que no existe', () => {
    // Dos reglas relacionadas y ninguna elegida: no hay dónde insertar sin suponer.
    const css = '.button { color:#000; }\n.cta { background-color:#ffffff; }'
    const source = fuente({
      css,
      cssRelated: [reglaCompleta(css, '.button', [declaracion('color', '#000', css)]), reglaCompleta(css, '.cta', [declaracion('background-color', '#ffffff', css)])],
    })
    const { plan } = planDe('redondea más las esquinas', source)
    expect(plan.operations).toHaveLength(0)
    expect(plan.unsupported.join(' ')).toMatch(/redondeo/i)
  })

  it('no inventa texto editable cuando el contenido no es simple (punto 10)', () => {
    const { plan } = planDe('que diga Comenzar', fuente({ text: undefined }))
    expect(plan.operations).toHaveLength(0)
    expect(plan.unsupported.join(' ')).toMatch(/texto/i)
  })

  it('una petición fuera del MVP no produce ninguna operación', () => {
    const { plan } = planDe('Pon el botón flotando arriba a la derecha')
    expect(plan.operations).toHaveLength(0)
    expect(plan.unsupported.length).toBeGreaterThan(0)
  })
})

describe('applyRelativeChange — política determinística (punto 12)', () => {
  it('sube y baja de forma proporcional y predecible, sin números al azar', () => {
    expect(applyRelativeChange(20, 'px', 'font-size', 'increase')).toBe(25)
    expect(applyRelativeChange(20, 'px', 'font-size', 'decrease')).toBe(15)
    expect(applyRelativeChange(8, 'px', 'border-radius', 'increase')).toBe(12)
    expect(applyRelativeChange(1, 'rem', 'font-size', 'decrease')).toBe(0.75)
  })

  it('siempre cambia algo, aunque el valor sea diminuto', () => {
    expect(applyRelativeChange(1, 'px', 'font-size', 'increase')).toBe(2)
    expect(applyRelativeChange(2, 'px', 'border-radius', 'increase')).toBe(3)
  })

  it('respeta los topes: no baja de cero ni se dispara', () => {
    expect(applyRelativeChange(1, 'px', 'border-radius', 'decrease')).toBe(0)
    expect(applyRelativeChange(199, 'px', 'font-size', 'increase')).toBeNull()
  })

  it('no aplica a propiedades de color', () => {
    expect(applyRelativeChange(10, 'px', 'background-color', 'increase')).toBeNull()
  })
})

describe('executePlan — validación, atomicidad y escritura (Capas D y E)', () => {
  const ejecutar = (peticion: string, over: Partial<Parameters<typeof executePlan>[0]> = {}) => {
    const { context, plan } = planDe(peticion)
    return executePlan({ plan, currentContextId: context.manifest.contextId, html: HTML, css: CSS, htmlInSync: true, cssInSync: true, ...over })
  }

  it('aplica un plan de HTML + CSS a los dos archivos a la vez', () => {
    const r = ejecutar('que sea azul, más redondeado y diga Comenzar')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.files.sort()).toEqual(['css', 'html'])
    expect(r.html).toBe('<button class="cta">Comenzar</button>\n<button class="cta">Comprar</button>\n')
    expect(r.css).toContain('background-color:#2563eb;')
    expect(r.css).toContain('border-radius:12px;')
    // Lo que no estaba en el plan queda intacto, byte a byte.
    expect(r.css).toContain('color:#000000;')
    expect(r.css).toContain('font-size:20px;')
  })

  it('varios rangos en el MISMO archivo se aplican sin desplazarse entre sí (punto 17)', () => {
    const r = ejecutar('hazlo azul, más grande y más redondeado')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.css).toBe('.cta {\n  background-color:#2563eb;\n  color:#000000;\n  font-size:25px;\n  border-radius:12px;\n}\n')
  })

  it('si UNA operación ya no es válida, no se escribe NINGUNA (punto 15)', () => {
    const { context, plan } = planDe('que sea azul y diga Comenzar')
    const cssEditado = CSS.replace('#ffffff', '#123456') // alguien tocó el archivo entre medias
    const r = executePlan({ plan, currentContextId: context.manifest.contextId, html: HTML, css: cssEditado, htmlInSync: true, cssInSync: true })
    expect(r).toEqual({ ok: false, reason: 'codigo-cambiado' })
  })

  it('rechaza un plan hecho para otro elemento o versión (punto 20)', () => {
    const r = ejecutar('hazlo azul', { currentContextId: 'otro-contexto' })
    expect(r).toEqual({ ok: false, reason: 'contexto-cambiado' })
  })

  it('rechaza si el archivo implicado tiene cambios sin aplicar (punto 18)', () => {
    expect(ejecutar('hazlo azul', { cssInSync: false })).toEqual({ ok: false, reason: 'archivo-desincronizado' })
    expect(ejecutar('que diga Comenzar', { htmlInSync: false })).toEqual({ ok: false, reason: 'archivo-desincronizado' })
    // Un plan que solo toca CSS no se bloquea porque el HTML esté en borrador.
    expect(ejecutar('hazlo azul', { htmlInSync: false }).ok).toBe(true)
  })

  it('rechaza rangos superpuestos en vez de aplicar "casi bien"', () => {
    const { context, plan } = planDe('hazlo azul')
    const superpuesto = { ...plan, operations: [plan.operations[0], { ...plan.operations[0], capabilityId: 'css-9', range: { start: plan.operations[0].range.start + 1, end: plan.operations[0].range.end + 1 }, expected: CSS.slice(plan.operations[0].range.start + 1, plan.operations[0].range.end + 1) }] }
    const r = executePlan({ plan: superpuesto, currentContextId: context.manifest.contextId, html: HTML, css: CSS, htmlInSync: true, cssInSync: true })
    expect(r).toEqual({ ok: false, reason: 'rangos-superpuestos' })
  })

  it('un plan vacío no escribe nada', () => {
    expect(ejecutar('agrega una animación')).toEqual({ ok: false, reason: 'sin-operaciones' })
  })

  it('el texto del estudiante pasa por el escape de 5.1 antes de llegar al archivo', () => {
    const r = ejecutar('que diga Hola <script>alert(1)</script>')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.html).toContain('&lt;script&gt;')
    expect(r.html).not.toContain('<script>')
  })

  it('un valor CSS malicioso no llega al archivo', () => {
    const { context } = planDe('hazlo azul')
    const intencionMaliciosa = { operations: [{ kind: 'SET_CSS_VALUE' as const, capabilityId: 'css-1', value: { mode: 'absolute' as const, value: '#fff; } body { display:none' } }], unsupported: [] }
    const plan = buildPlan(context, intencionMaliciosa)
    expect(plan.operations).toHaveLength(0) // no pasa la gramática de color de 5.0
  })

  it('una operación que apunta a una capacidad inexistente no se planifica', () => {
    const { context } = planDe('hazlo azul')
    const plan = buildPlan(context, { operations: [{ kind: 'SET_TEXT', capabilityId: 'css-99', value: 'X' }], unsupported: [] })
    expect(plan.operations).toHaveLength(0)
    expect(plan.unsupported.length).toBeGreaterThan(0)
  })
})

// PASO 5.3 — inserción de una declaración certificada dentro de una regla existente.
describe('inserción de declaraciones CSS (Paso 5.3)', () => {
  const CSS_CORTO = '.cta {\n  background-color:#ffffff;\n  color:#000000;\n}\n'
  const fuenteCorta = (over: Partial<CapabilitySource> = {}) => fuente({
    css: CSS_CORTO,
    cssLength: CSS_CORTO.length,
    cssRelated: [reglaCompleta(CSS_CORTO, '.cta', [declaracion('background-color', '#ffffff', CSS_CORTO), declaracion('color', '#000000', CSS_CORTO)])],
    ...over,
  })

  it('A. ofrece agregar solo las propiedades certificadas que FALTAN en la regla', () => {
    const { manifest } = buildCapabilityContext(fuenteCorta())
    const añadibles = manifest.capabilities.filter((c) => c.kind === 'css' && c.action === 'add').map((c) => (c as { property: string }).property)
    // font-size no aparece: insertarla exigiría conocer el tamaño heredado (puntos 17 y 18).
    expect(añadibles).toEqual(['border-radius'])
  })

  it('B. si la propiedad ya existe, se ofrece MODIFICAR y nunca insertar una segunda', () => {
    const { manifest } = buildCapabilityContext(fuente()) // esa regla ya tiene las cuatro
    expect(manifest.capabilities.filter((c) => c.kind === 'css').every((c) => c.action === 'modify')).toBe(true)
  })

  it('A. "más redondeado" sin border-radius: prepara una INSERCIÓN con el default documentado', () => {
    const context = buildCapabilityContext(fuenteCorta())
    const plan = buildPlan(context, interpretIntent('redondea más las esquinas', context.manifest))
    expect(plan.operations).toHaveLength(1)
    expect(plan.operations[0]).toMatchObject({ label: 'Agregar redondeo de las esquinas', before: 'no existía', after: '12px', inserts: true, selector: '.cta', affectedElements: 4 })
  })

  it('"menos redondeado" sobre una propiedad ausente no significa nada: no se inserta', () => {
    const context = buildCapabilityContext(fuenteCorta())
    expect(buildPlan(context, interpretIntent('redondea menos las esquinas', context.manifest)).operations).toHaveLength(0)
  })

  it('un color solo se inserta si el estudiante lo nombró, y font-size nunca se inserta', () => {
    const css = '.cta {\n  border-radius:8px;\n}\n'
    const context = buildCapabilityContext(fuenteCorta({ css, cssLength: css.length, cssRelated: [reglaCompleta(css, '.cta', [declaracion('border-radius', '8px', css)])] }))
    expect(buildPlan(context, interpretIntent('hazlo azul', context.manifest)).operations[0]).toMatchObject({ label: 'Agregar color de fondo', after: '#2563eb', inserts: true })
    expect(buildPlan(context, interpretIntent('hazlo más grande', context.manifest)).operations).toHaveLength(0)
  })

  it('M/N. varias reglas: sin elección explícita no se inserta; con elección, solo en esa regla', () => {
    const css = '.button {\n  color:#000;\n}\n.cta {\n  background-color:#fff;\n}\n'
    const reglas = [reglaCompleta(css, '.button', [declaracion('color', '#000', css)]), reglaCompleta(css, '.cta', [declaracion('background-color', '#fff', css)])]
    const sinElegir = buildCapabilityContext(fuente({ css, cssLength: css.length, cssRelated: reglas }))
    expect(sinElegir.manifest.capabilities.some((c) => c.kind === 'css' && c.action === 'add')).toBe(false)

    const elegida = buildCapabilityContext(fuente({ css, cssLength: css.length, cssRelated: reglas, selectedRuleStart: css.indexOf('.cta') }))
    expect(elegida.targets.find((t) => t.id.startsWith('css-add'))!.selector).toBe('.cta')
    const plan = buildPlan(elegida, interpretIntent('redondea más las esquinas', elegida.manifest))
    const r = executePlan({ plan, currentContextId: elegida.manifest.contextId, html: HTML, css, htmlInSync: true, cssInSync: true })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.css).toBe('.button {\n  color:#000;\n}\n.cta {\n  background-color:#fff;\n  border-radius: 12px;\n}\n')
  })

  it('L. dentro de una @media: avisa a qué pantallas corresponde y estar inactiva no lo impide', () => {
    const css = '@media (max-width: 500px) {\n  .cta {\n    font-size:18px;\n  }\n}\n'
    const regla = reglaCompleta(css, '.cta', [declaracion('font-size', '18px', css)], { mediaText: '(max-width: 500px)', mediaActive: false })
    const context = buildCapabilityContext(fuente({ css, cssLength: css.length, cssRelated: [regla] }))
    const plan = buildPlan(context, interpretIntent('redondea más las esquinas', context.manifest))
    expect(plan.operations[0].mediaNote).toBe('Solo se aplica en pantallas de hasta 500 px.')
    const r = executePlan({ plan, currentContextId: context.manifest.contextId, html: HTML, css, htmlInSync: true, cssInSync: true })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.css).toBe('@media (max-width: 500px) {\n  .cta {\n    font-size:18px;\n    border-radius: 12px;\n  }\n}\n')
  })

  it('Q. plan combinado: texto + modificar fondo + insertar redondeo, en un solo paso', () => {
    const context = buildCapabilityContext(fuenteCorta())
    const plan = buildPlan(context, interpretIntent('Quiero que sea azul, más redondeado y diga Comenzar', context.manifest))
    expect(plan.operations.map((o) => o.label).sort()).toEqual(['Agregar redondeo de las esquinas', 'Color de fondo', 'Texto'])
    const r = executePlan({ plan, currentContextId: context.manifest.contextId, html: HTML, css: CSS_CORTO, htmlInSync: true, cssInSync: true })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.html).toBe('<button class="cta">Comenzar</button>\n<button class="cta">Comprar</button>\n')
    expect(r.css).toBe('.cta {\n  background-color:#2563eb;\n  color:#000000;\n  border-radius: 12px;\n}\n')
  })

  it('dos inserciones en el mismo punto conviven y quedan en orden determinístico', () => {
    const css = '.cta {\n  font-size:20px;\n}\n'
    const context = buildCapabilityContext(fuente({ css, cssLength: css.length, cssRelated: [reglaCompleta(css, '.cta', [declaracion('font-size', '20px', css)])] }))
    const plan = buildPlan(context, interpretIntent('hazlo azul y más redondeado', context.manifest))
    expect(plan.operations).toHaveLength(2)
    const r = executePlan({ plan, currentContextId: context.manifest.contextId, html: HTML, css, htmlInSync: true, cssInSync: true })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.css).toBe('.cta {\n  font-size:20px;\n  background-color: #2563eb;\n  border-radius: 12px;\n}\n')
  })

  it('P. si la propiedad aparece entre el plan y la confirmación, se cancela TODO', () => {
    const context = buildCapabilityContext(fuenteCorta())
    const plan = buildPlan(context, interpretIntent('más redondeado y que diga Comenzar', context.manifest))
    expect(plan.operations).toHaveLength(2)
    const cssTocado = '.cta {\n  background-color:#ffffff;\n  color:#000000;\n  border-radius:4px;\n}\n'
    expect(executePlan({ plan, currentContextId: context.manifest.contextId, html: HTML, css: cssTocado, htmlInSync: true, cssInSync: true }))
      .toEqual({ ok: false, reason: 'codigo-cambiado' })
  })

  it('O/R. un cambio en otra parte de la regla impide también la inserción: cero escrituras', () => {
    const context = buildCapabilityContext(fuenteCorta())
    const plan = buildPlan(context, interpretIntent('hazlo azul y más redondeado', context.manifest))
    const cssTocado = CSS_CORTO.replace('#ffffff', '#abcdef')
    expect(executePlan({ plan, currentContextId: context.manifest.contextId, html: HTML, css: cssTocado, htmlInSync: true, cssInSync: true }))
      .toEqual({ ok: false, reason: 'codigo-cambiado' })
  })

  it('S. un valor malicioso no llega a insertarse', () => {
    const context = buildCapabilityContext(fuenteCorta())
    const idInsercion = context.manifest.capabilities.find((c) => c.kind === 'css' && c.action === 'add')!.id
    const plan = buildPlan(context, { operations: [{ kind: 'INSERT_CSS_DECLARATION', capabilityId: idInsercion, value: { mode: 'absolute', value: '#fff; } body { display:none' } }], unsupported: [] })
    expect(plan.operations).toHaveLength(0)
  })

  it('T. formato no determinable (comentario en la regla): no se ofrece la inserción', () => {
    const css = '.cta {\n  background-color:#fff;\n  /* pendiente */\n}\n'
    const context = buildCapabilityContext(fuente({ css, cssLength: css.length, cssRelated: [reglaCompleta(css, '.cta', [declaracion('background-color', '#fff', css)])] }))
    const plan = buildPlan(context, interpretIntent('redondea más las esquinas', context.manifest))
    expect(plan.operations).toHaveLength(0)
    expect(plan.unsupported.length).toBeGreaterThan(0)
  })
})
