import { describe, expect, it } from 'vitest'
import { sanitizeSvg } from './svg'

describe('sanitizeSvg', () => {
  it('keeps an allowed illustrative SVG', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#17a56b"/></svg>'
    expect(sanitizeSvg(svg)).toBe(svg)
  })
  it('rejects active and remote SVG content', () => {
    expect(() => sanitizeSvg('<svg><script>alert(1)</script></svg>')).toThrow()
    expect(() => sanitizeSvg('<svg><image href="https://evil.test/a.png"/></svg>')).toThrow()
    expect(() => sanitizeSvg('<svg><rect onclick="alert(1)"/></svg>')).toThrow()
  })
})
