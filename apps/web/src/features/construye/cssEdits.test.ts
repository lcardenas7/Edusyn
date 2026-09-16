import { describe, expect, it } from 'vitest'
import { classifyEditableValue, describeEditImpact, describeEditMediaWarning, editableControlLabel, formatColorValue, formatLengthValue, replaceCssValueAtRange } from './cssEdits'

describe('classifyEditableValue — qué se puede editar (Paso 5.0)', () => {
  it('background-color y color con hex: editables como color', () => {
    const fondo = classifyEditableValue('background-color', '#ffffff')!
    expect(fondo).toMatchObject({ kind: 'color', property: 'background-color', current: '#ffffff', swatch: '#ffffff' })
    const texto = classifyEditableValue('color', '#000000')!
    expect(texto).toMatchObject({ kind: 'color', property: 'color', current: '#000000' })
  })

  it('hex corto: se conserva tal cual en el archivo, pero el control recibe su forma larga', () => {
    const r = classifyEditableValue('background-color', '#FFF')!
    expect(r.current).toBe('#FFF') // lo que el estudiante escribió, sin tocar
    expect(r).toMatchObject({ swatch: '#ffffff' }) // lo que necesita un selector de color
  })

  it('font-size y border-radius con px/rem/em: editables como longitud', () => {
    expect(classifyEditableValue('font-size', '24px')).toMatchObject({ kind: 'length', amount: 24, unit: 'px' })
    expect(classifyEditableValue('font-size', '1.5rem')).toMatchObject({ kind: 'length', amount: 1.5, unit: 'rem' })
    expect(classifyEditableValue('border-radius', '12px')).toMatchObject({ kind: 'length', amount: 12, unit: 'px' })
    expect(classifyEditableValue('font-size', '2em')).toMatchObject({ kind: 'length', amount: 2, unit: 'em' })
  })

  it('valores complejos: NO editables (se explican, no se tocan)', () => {
    expect(classifyEditableValue('background-color', 'var(--primary)')).toBeNull()
    expect(classifyEditableValue('color', 'rgb(0, 0, 0)')).toBeNull()
    expect(classifyEditableValue('color', 'hsl(210, 50%, 40%)')).toBeNull()
    expect(classifyEditableValue('font-size', 'calc(100% - 2px)')).toBeNull()
    expect(classifyEditableValue('font-size', 'clamp(1rem, 2vw, 2rem)')).toBeNull()
  })

  it('shorthand de varios valores: NO editable', () => {
    expect(classifyEditableValue('border-radius', '10px 20px')).toBeNull()
    expect(classifyEditableValue('border-radius', '10px 20px 30px 40px')).toBeNull()
  })

  it('unidades fuera del MVP: NO editables', () => {
    expect(classifyEditableValue('font-size', '5vw')).toBeNull()
    expect(classifyEditableValue('font-size', '120%')).toBeNull()
  })

  it('color con nombre: se explica pero NO se edita en este paso', () => {
    expect(classifyEditableValue('background-color', 'white')).toBeNull()
    expect(classifyEditableValue('color', 'navy')).toBeNull()
  })

  it('propiedad fuera del MVP: NO editable aunque el valor sea simple', () => {
    expect(classifyEditableValue('padding', '10px')).toBeNull()
    expect(classifyEditableValue('width', '100px')).toBeNull()
    expect(classifyEditableValue('display', 'flex')).toBeNull()
    expect(classifyEditableValue('background', '#ffffff')).toBeNull() // el shorthand no, solo background-color
  })

  it('valor vacío o a medio escribir: NO editable, sin lanzar', () => {
    expect(classifyEditableValue('font-size', '')).toBeNull()
    expect(classifyEditableValue('font-size', '   ')).toBeNull()
    expect(classifyEditableValue('background-color', '#')).toBeNull()
    expect(classifyEditableValue('font-size', '24')).toBeNull() // sin unidad
  })
})

describe('formatColorValue / formatLengthValue — seguridad del valor escrito', () => {
  it('normaliza el color a #rrggbb en minúsculas', () => {
    expect(formatColorValue('#2563EB')).toBe('#2563eb')
    expect(formatColorValue('#FFF')).toBe('#ffffff')
  })

  it('rechaza cualquier texto que no sea exactamente un hex', () => {
    expect(formatColorValue('red')).toBeNull()
    expect(formatColorValue('#2563eb; color: red')).toBeNull()
    expect(formatColorValue('url(javascript:alert(1))')).toBeNull()
    expect(formatColorValue('var(--x)')).toBeNull()
    expect(formatColorValue('#2563eb}')).toBeNull()
    expect(formatColorValue('')).toBeNull()
  })

  it('compone longitudes válidas y recorta decimales de coma flotante', () => {
    expect(formatLengthValue(24, 'px')).toBe('24px')
    expect(formatLengthValue(1.5, 'rem')).toBe('1.5rem')
    expect(formatLengthValue(16.000000000000004, 'px')).toBe('16px')
  })

  it('rechaza números imposibles y unidades no permitidas', () => {
    expect(formatLengthValue(NaN, 'px')).toBeNull()
    expect(formatLengthValue(-4, 'px')).toBeNull()
    expect(formatLengthValue(99_999, 'px')).toBeNull()
    expect(formatLengthValue(Infinity, 'px')).toBeNull()
    expect(formatLengthValue(10, 'vw')).toBeNull()
    expect(formatLengthValue(10, 'px; color: red')).toBeNull()
  })
})

describe('replaceCssValueAtRange — reemplazo atómico', () => {
  it('cambia SOLO el valor y deja el resto del archivo byte a byte igual', () => {
    const css = '.card {\n  background-color:   #fff ;\n  border-radius: 12px;\n}\n'
    const start = css.indexOf('#fff')
    const r = replaceCssValueAtRange(css, { start, end: start + 4 }, '#fff', '#2563eb')!
    expect(r.css).toBe('.card {\n  background-color:   #2563eb ;\n  border-radius: 12px;\n}\n')
  })

  it('conserva comentarios, indentación y otras reglas intactos', () => {
    const css = '/* colores del proyecto */\n.card {\n\tfont-size: 24px; /* título */\n}\n\n.otra { color: #000000; }\n'
    const start = css.indexOf('24px')
    const r = replaceCssValueAtRange(css, { start, end: start + 4 }, '24px', '32px')!
    expect(r.css).toBe('/* colores del proyecto */\n.card {\n\tfont-size: 32px; /* título */\n}\n\n.otra { color: #000000; }\n')
    expect(r.css).toContain('/* colores del proyecto */')
    expect(r.css).toContain('/* título */')
  })

  it('con dos reglas idénticas, cambia exactamente la del rango — no la primera que coincida por texto', () => {
    const css = '.card { background-color: #ffffff; }\n.card { background-color: #ffffff; }\n'
    const segundo = css.lastIndexOf('#ffffff')
    const r = replaceCssValueAtRange(css, { start: segundo, end: segundo + 7 }, '#ffffff', '#2563eb')!
    expect(r.css).toBe('.card { background-color: #ffffff; }\n.card { background-color: #2563eb; }\n')
  })

  it('devuelve el rango del valor NUEVO, para poder mostrárselo al estudiante', () => {
    const css = '.card { font-size: 24px; }'
    const start = css.indexOf('24px')
    const r = replaceCssValueAtRange(css, { start, end: start + 4 }, '24px', '9px')!
    expect(r.range).toEqual({ start, end: start + 3 })
    expect(r.css.slice(r.range.start, r.range.end)).toBe('9px')
  })

  it('rango obsoleto (el archivo cambió desde la selección): null, nunca busca el valor en otra parte', () => {
    const css = '.card { background-color: #123456; }' // el estudiante ya lo editó a mano
    const start = css.indexOf('#123456')
    expect(replaceCssValueAtRange(css, { start, end: start + 7 }, '#ffffff', '#2563eb')).toBeNull()
  })

  it('rango desplazado por una edición previa: null (el texto ahí ya no es el esperado)', () => {
    const css = '.card {\n  color: #000000;\n  background-color: #ffffff;\n}'
    const viejo = { start: 10, end: 17 } // posición que correspondía a otra versión del archivo
    expect(replaceCssValueAtRange(css, viejo, '#ffffff', '#2563eb')).toBeNull()
  })

  it('rango fuera de límites o invertido: null', () => {
    const css = '.card { color: #000000; }'
    expect(replaceCssValueAtRange(css, { start: 500, end: 507 }, '#000000', '#111111')).toBeNull()
    expect(replaceCssValueAtRange(css, { start: 20, end: 5 }, '#000000', '#111111')).toBeNull()
    expect(replaceCssValueAtRange(css, { start: -1, end: 5 }, '#000000', '#111111')).toBeNull()
    expect(replaceCssValueAtRange(css, { start: 1.5, end: 5 }, '#000000', '#111111')).toBeNull()
  })

  it('un CSS en borrador distinto del aplicado no se edita a ciegas: el texto no coincide y se cancela', () => {
    const aplicado = '.card { background-color: #ffffff; }'
    const borrador = '.card { background-color: #ff0000; }' // el estudiante escribió otra cosa sin aplicar
    const start = aplicado.indexOf('#ffffff')
    expect(replaceCssValueAtRange(borrador, { start, end: start + 7 }, '#ffffff', '#2563eb')).toBeNull()
  })
})

describe('describeEditImpact — cuántos elementos cambiarán (punto 15)', () => {
  it('usa el conteo real del runner, en plural y en singular', () => {
    expect(describeEditImpact(4)).toBe('Este cambio afectará 4 elementos.')
    expect(describeEditImpact(1)).toBe('Este cambio afectará este elemento.')
  })

  it('sin conteo o con cero elementos, no afirma nada', () => {
    expect(describeEditImpact(undefined)).toBeNull()
    expect(describeEditImpact(0)).toBeNull()
  })
})

describe('describeEditMediaWarning — editar una regla que ahora no se aplica (punto 16)', () => {
  it('avisa a qué pantallas corresponde el cambio y cuál se está viendo', () => {
    expect(describeEditMediaWarning('(max-width: 500px)', false, 'Computador'))
      .toBe('Este cambio corresponde a pantallas de hasta 500 px. Ahora estás viendo Computador.')
  })

  it('no avisa nada si la regla se aplica ahora, o si no depende de la pantalla', () => {
    expect(describeEditMediaWarning('(max-width: 500px)', true, 'Celular')).toBeNull()
    expect(describeEditMediaWarning(undefined, undefined, 'Computador')).toBeNull()
  })
})

describe('editableControlLabel — el título del control es pedagógico, no técnico', () => {
  it('traduce cada propiedad soportada', () => {
    expect(editableControlLabel('background-color')).toBe('Color de fondo')
    expect(editableControlLabel('color')).toBe('Color del texto')
    expect(editableControlLabel('font-size')).toBe('Tamaño del texto')
    expect(editableControlLabel('border-radius')).toBe('Redondeo de las esquinas')
  })
})
