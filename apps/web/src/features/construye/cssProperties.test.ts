import { describe, expect, it } from 'vitest'
import { explainCssDeclaration } from './cssProperties'

const ctx = (over: Partial<Parameters<typeof explainCssDeclaration>[2]> = {}) => ({ matchedCount: 1, viewportLabel: 'Computador', ...over })

describe('explainCssDeclaration — propiedades del MVP', () => {
  it('color: menciona el color traducido y ofrece una muestra', () => {
    const r = explainCssDeclaration('color', 'red', ctx())!
    expect(r.sentence).toContain('Cambia el color del texto')
    expect(r.sentence).toContain('rojo')
    expect(r.colorSwatch).toBe('red')
  })

  it('background-color: hex se muestra literal (no se traduce)', () => {
    const r = explainCssDeclaration('background-color', '#ffffff', ctx())!
    expect(r.sentence).toContain('Cambia el color de fondo')
    expect(r.sentence).toContain('#ffffff')
    expect(r.colorSwatch).toBe('#ffffff')
  })

  it('background simple (un color) se explica como background-color', () => {
    const r = explainCssDeclaration('background', 'blue', ctx())!
    expect(r.sentence).toContain('Cambia el color de fondo')
    expect(r.colorSwatch).toBe('blue')
  })

  it('background complejo (gradiente) no inventa el color, solo dice que es avanzado', () => {
    const r = explainCssDeclaration('background', 'linear-gradient(to right, red, blue)', ctx())!
    expect(r.sentence).toBe('Esta propiedad controla el fondo. Aquí utiliza un valor más avanzado. Afecta a este elemento.')
    expect(r.colorSwatch).toBeUndefined()
  })

  it('font-size: valor simple con espacio antes de la unidad', () => {
    const r = explainCssDeclaration('font-size', '24px', ctx())!
    expect(r.sentence).toContain('Cambia el tamaño del texto')
    expect(r.sentence).toContain('24 px')
  })

  it('font-weight: bold/normal/lighter tienen frases distintas y numéricos intermedios muestran el valor', () => {
    expect(explainCssDeclaration('font-weight', 'bold', ctx())!.sentence).toContain('más grueso')
    expect(explainCssDeclaration('font-weight', 'normal', ctx())!.sentence).toContain('grosor normal')
    expect(explainCssDeclaration('font-weight', '300', ctx())!.sentence).toContain('más delgado')
    expect(explainCssDeclaration('font-weight', '500', ctx())!.sentence).toContain('500')
  })

  it('font-weight: un valor no reconocido no inventa explicación', () => {
    expect(explainCssDeclaration('font-weight', 'inherit', ctx())).toBeNull()
  })

  it('text-align: center/left/right/justify tienen frase propia', () => {
    expect(explainCssDeclaration('text-align', 'center', ctx())!.sentence).toContain('Centra el texto')
    expect(explainCssDeclaration('text-align', 'left', ctx())!.sentence).toContain('izquierda')
    expect(explainCssDeclaration('text-align', 'right', ctx())!.sentence).toContain('derecha')
    expect(explainCssDeclaration('text-align', 'justify', ctx())!.sentence).toContain('Justifica')
  })

  it('border-radius: redondea esquinas, con el valor', () => {
    const r = explainCssDeclaration('border-radius', '12px', ctx())!
    expect(r.sentence).toContain('Redondea las esquinas')
    expect(r.sentence).toContain('12 px')
  })

  it('padding y margin: frases distintas (dentro vs. fuera del elemento)', () => {
    expect(explainCssDeclaration('padding', '16px', ctx())!.sentence).toContain('dentro del elemento')
    expect(explainCssDeclaration('margin', '20px', ctx())!.sentence).toContain('fuera del elemento')
  })

  it('padding con shorthand: muestra el valor completo sin descomponerlo', () => {
    const r = explainCssDeclaration('padding', '10px 20px', ctx())!
    expect(r.sentence).toContain('Agrega espacio dentro del elemento')
    expect(r.sentence).toContain('10 px 20 px')
  })

  it('width y max-width: frases distintas, max-width usa "a {valor}"', () => {
    expect(explainCssDeclaration('width', '100%', ctx())!.sentence).toContain('Aquí usa 100%')
    expect(explainCssDeclaration('max-width', '800px', ctx())!.sentence).toBe('Limita el ancho máximo del elemento a 800 px. Afecta a este elemento.')
  })

  it('display: flex/grid/block tienen frase propia; otros valores no soportados no inventan', () => {
    expect(explainCssDeclaration('display', 'flex', ctx())!.sentence).toContain('distribución flexible')
    expect(explainCssDeclaration('display', 'grid', ctx())!.sentence).toContain('cuadrícula')
    expect(explainCssDeclaration('display', 'block', ctx())!.sentence).toContain('todo el ancho disponible')
    expect(explainCssDeclaration('display', 'inline-block', ctx())).toBeNull()
  })

  it('gap: separación entre elementos organizados', () => {
    expect(explainCssDeclaration('gap', '16px', ctx())!.sentence).toContain('separación entre los elementos')
  })
})

describe('explainCssDeclaration — valores complejos (var/calc/gradientes)', () => {
  it('var()/calc() no se explican como si fueran simples, pero la propiedad sí se explica', () => {
    expect(explainCssDeclaration('font-size', 'var(--tamano)', ctx())!.sentence).toContain('valor más avanzado')
    expect(explainCssDeclaration('width', 'calc(100% - 20px)', ctx())!.sentence).toContain('valor más avanzado')
  })
})

describe('explainCssDeclaration — propiedad no soportada', () => {
  it('devuelve null para una propiedad fuera del diccionario, sin inventar', () => {
    expect(explainCssDeclaration('transform', 'rotate(20deg)', ctx())).toBeNull()
    expect(explainCssDeclaration('opacity', '0.5', ctx())).toBeNull()
  })
})

describe('explainCssDeclaration — CSS incompleto', () => {
  it('valor vacío (declaración a medio escribir): sin explicación, sin lanzar', () => {
    expect(explainCssDeclaration('font-size', '', ctx())).toBeNull()
    expect(explainCssDeclaration('font-size', '   ', ctx())).toBeNull()
  })
})

describe('explainCssDeclaration — contexto de elementos relacionados', () => {
  it('un elemento: "este elemento"; pocos: número exacto; muchos: sin número', () => {
    expect(explainCssDeclaration('border-radius', '12px', ctx({ matchedCount: 1 }))!.sentence).toContain('este elemento')
    expect(explainCssDeclaration('border-radius', '12px', ctx({ matchedCount: 4 }))!.sentence).toContain('4 elementos relacionados')
    expect(explainCssDeclaration('border-radius', '12px', ctx({ matchedCount: 37 }))!.sentence).toContain('los elementos relacionados')
    expect(explainCssDeclaration('border-radius', '12px', ctx({ matchedCount: 37 }))!.sentence).not.toContain('37')
  })

  it('0 elementos: no explica la propiedad (ya lo dice el mensaje relacional del Paso 4.1)', () => {
    expect(explainCssDeclaration('border-radius', '12px', ctx({ matchedCount: 0 }))).toBeNull()
  })

  it('sin matchedCount (llamada fuera del flujo normal): omite la cláusula de elementos sin fallar', () => {
    const r = explainCssDeclaration('border-radius', '12px', { viewportLabel: 'Computador' })!
    expect(r.sentence).toBe('Redondea las esquinas. Aquí usa 12 px.')
  })
})

describe('explainCssDeclaration — activo/inactivo (media queries)', () => {
  it('display:none inactivo: explica el ocultamiento Y por qué no se aplica ahora', () => {
    const r = explainCssDeclaration('display', 'none', ctx({ matchedCount: 1, mediaText: '(max-width: 500px)', mediaActive: false, viewportLabel: 'Computador' }))!
    expect(r.sentence).toBe('Esta propiedad oculta el elemento, pero esta regla no se aplica ahora porque estás viendo Computador. Afecta a este elemento.')
  })

  it('display:none activo: dice que se aplica ahora', () => {
    const r = explainCssDeclaration('display', 'none', ctx({ mediaText: '(max-width: 500px)', mediaActive: true, viewportLabel: 'Celular' }))!
    expect(r.sentence).toContain('Esta regla se aplica ahora.')
  })

  it('otras propiedades dentro de una @media también reflejan activo/inactivo', () => {
    const inactiva = explainCssDeclaration('padding', '10px', ctx({ mediaText: '(max-width: 500px)', mediaActive: false, viewportLabel: 'Computador' }))!
    expect(inactiva.sentence).toContain('Ahora no se aplica porque estás viendo Computador')
    const activa = explainCssDeclaration('padding', '10px', ctx({ mediaText: '(max-width: 500px)', mediaActive: true, viewportLabel: 'Celular' }))!
    expect(activa.sentence).toContain('Se aplica ahora, en pantallas de hasta 500 px')
  })
})

// PASO 4.4 (punto 15 del gate): cierra la cobertura pedagógica de selector múltiple que 4.3
// dejó pendiente. `matchedCount: 3` es exactamente lo que styles.ts reporta para
// `h1, h2, .titulo { color: navy; }` con esos tres elementos en la página (ver styles.test.ts).
describe('explainCssDeclaration — selector múltiple con clase (h1, h2, .titulo)', () => {
  it('color: navy con 3 elementos relacionados: explicación + traducción de color + conteo correctos', () => {
    const r = explainCssDeclaration('color', 'navy', ctx({ matchedCount: 3 }))!
    expect(r.sentence).toContain('Cambia el color del texto')
    expect(r.sentence).toContain('azul marino')
    expect(r.sentence).toContain('3 elementos relacionados')
    expect(r.colorSwatch).toBe('navy')
  })

  it('conserva la misma explicación tras un cambio de viewport (Paso 4.4): solo cambia lo que dependa de la media query', () => {
    // Sin @media de por medio, un cambio de viewport no debería alterar en nada la frase — la
    // reevaluación de 4.4 repite la misma llamada con el mismo matchedCount y sin mediaText.
    const enComputador = explainCssDeclaration('color', 'navy', ctx({ matchedCount: 3, viewportLabel: 'Computador' }))!
    const enCelular = explainCssDeclaration('color', 'navy', ctx({ matchedCount: 3, viewportLabel: 'Celular' }))!
    expect(enComputador.sentence).toBe(enCelular.sentence)
  })
})

describe('explainCssDeclaration — nunca afirma el resultado visual final (cascada)', () => {
  it('el lenguaje describe la propiedad, no un resultado final asumido', () => {
    const r = explainCssDeclaration('background-color', 'blue', ctx({ matchedCount: 2 }))!
    expect(r.sentence).not.toMatch(/es azul|queda azul|se ve azul/i)
    expect(r.sentence).toMatch(/Cambia el color de fondo/)
  })
})
