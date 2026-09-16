import { describe, expect, it } from 'vitest'
import { computeViewportScale, VIEWPORT_PRESETS } from './viewports'

describe('VIEWPORT_PRESETS', () => {
  it('declara los viewports lógicos acordados para el Paso 4.0', () => {
    expect(VIEWPORT_PRESETS.desktop).toMatchObject({ width: 1280, height: 800 })
    expect(VIEWPORT_PRESETS.mobile).toMatchObject({ width: 390, height: 844 })
  })
})

describe('computeViewportScale', () => {
  it('no escala cuando el viewport lógico cabe entero', () => {
    expect(computeViewportScale(1400, 1280)).toBe(1)
    expect(computeViewportScale(450, 390)).toBe(1)
  })

  it('nunca amplía por encima del tamaño real aunque sobre espacio', () => {
    expect(computeViewportScale(3000, 390)).toBe(1)
  })

  it('reduce proporcionalmente cuando el panel es más angosto que el viewport lógico', () => {
    expect(computeViewportScale(640, 1280)).toBe(0.5)
    expect(computeViewportScale(960, 1280)).toBe(0.75)
  })

  it('es seguro antes de haber medido el panel (evita un preview colapsado en el primer frame)', () => {
    expect(computeViewportScale(0, 1280)).toBe(1)
    expect(computeViewportScale(Number.NaN, 1280)).toBe(1)
  })
})
