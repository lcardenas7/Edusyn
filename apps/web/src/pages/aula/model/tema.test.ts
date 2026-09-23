import { describe, it, expect } from 'vitest'
import { TEMAS, acentoLegible, colorDeEncabezado, contrasteConBlanco, hexARgb, resolverAcento, temaPorId } from './tema'

describe('el tema que elige el estudiante', () => {
  it('su tema gana sobre el color que puso el docente', () => {
    expect(resolverAcento('azul', '#B84A7D')).toBe('#2E6BE6')
  })

  it('sin tema propio manda el aula: es el estado de fábrica', () => {
    expect(resolverAcento(null, '#B84A7D')).toBe('#B84A7D')
  })

  it('un tema que ya no existe no deja el aula sin color', () => {
    // Pasa de verdad: se guardó un id, luego se quitó del catálogo.
    expect(resolverAcento('neon-2019', '#B84A7D')).toBe('#B84A7D')
    expect(temaPorId('neon-2019')).toBeNull()
  })
})

describe('el catálogo se puede usar de verdad', () => {
  it('sobre cada tema se lee el texto blanco de los botones', () => {
    // Sobre el acento van botones y chips en blanco. Un color donde eso no se lee es un color
    // roto, por lindo que sea. 4.5:1 es el mínimo de WCAG AA para texto normal.
    for (const t of TEMAS) {
      expect(`${t.nombre}: ${contrasteConBlanco(t.color).toFixed(2)}`).toBe(
        `${t.nombre}: ${Math.max(4.5, contrasteConBlanco(t.color)).toFixed(2)}`,
      )
    }
  })

  it('no hay dos ids repetidos ni dos colores repetidos', () => {
    expect(new Set(TEMAS.map((t) => t.id)).size).toBe(TEMAS.length)
    expect(new Set(TEMAS.map((t) => t.color)).size).toBe(TEMAS.length)
  })
})

describe('hexARgb', () => {
  it('traduce al formato que esperan los tokens del DS', () => {
    expect(hexARgb('#2E6BE6')).toBe('46 107 230')
  })

  it('entiende la forma corta', () => {
    expect(hexARgb('#0AF')).toBe('0 170 255')
  })
})

describe('colorDeEncabezado · el color de la barra de estado del teléfono', () => {
  it('es un color sólido: la barra del sistema no entiende transparencias', () => {
    expect(colorDeEncabezado('#2E6BE6')).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('es el acento apenas insinuado, no el acento a pleno', () => {
    // Aclara mucho porque el encabezado del aula es un lavado del acento sobre blanco.
    expect(colorDeEncabezado('#2E6BE6')).toBe('#e8eefc')
  })

  it('el blanco se queda en blanco', () => {
    expect(colorDeEncabezado('#FFFFFF')).toBe('#ffffff')
  })

  it('cada aula tiñe la barra con SU color, no todas igual', () => {
    expect(colorDeEncabezado('#B84A7D')).not.toBe(colorDeEncabezado('#2E6BE6'))
  })
})

describe('acentoLegible · sobre el acento siempre se lee el texto blanco', () => {
  it('un amarillo claro se oscurece hasta que se puede leer', () => {
    const corregido = acentoLegible('#FFD400')
    expect(contrasteConBlanco('#FFD400')).toBeLessThan(4.5)
    expect(contrasteConBlanco(corregido)).toBeGreaterThanOrEqual(4.5)
  })

  it('un color que ya se lee bien no se toca', () => {
    expect(acentoLegible('#2E6BE6')).toBe('#2e6be6')
  })

  it('mantiene el tono: un amarillo sigue siendo amarillo, no se vuelve gris', () => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(acentoLegible('#FFD400').slice(i, i + 2), 16))
    expect(r).toBeGreaterThan(b)
    expect(g).toBeGreaterThan(b)
  })

  it('el blanco, que es el peor caso, también acaba siendo legible', () => {
    expect(contrasteConBlanco(acentoLegible('#FFFFFF'))).toBeGreaterThanOrEqual(4.5)
  })

  it('los temas que se ofrecen no cambian: ya cumplían', () => {
    for (const t of TEMAS) expect(acentoLegible(t.color)).toBe(t.color.toLowerCase())
  })
})
