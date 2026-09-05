import { describe, it, expect } from 'vitest'
import { TEMAS, contrasteConBlanco, hexARgb, resolverAcento, temaPorId } from './tema'

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
