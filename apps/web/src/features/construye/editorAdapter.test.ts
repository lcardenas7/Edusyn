import { describe, expect, it } from 'vitest'
import { computeCenteredScrollTop, lineNumberAtOffset } from './editorAdapter'

describe('lineNumberAtOffset', () => {
  it('returns 0 for an offset on the first line', () => {
    expect(lineNumberAtOffset('<h1>hola</h1>', 5)).toBe(0)
  })

  it('counts newlines before the offset', () => {
    expect(lineNumberAtOffset('a\nb\nc\nd', 6)).toBe(3)
  })

  it('returns 0 for offset 0', () => {
    expect(lineNumberAtOffset('a\nb\nc', 0)).toBe(0)
  })
})

describe('computeCenteredScrollTop', () => {
  it('centers the target line in the viewport', () => {
    expect(computeCenteredScrollTop(10, 20, 400, 2000)).toBe(10 * 20 - 200)
  })

  it('never scrolls above the top of the content', () => {
    expect(computeCenteredScrollTop(0, 20, 400, 2000)).toBe(0)
  })

  it('never scrolls past the bottom of the content', () => {
    expect(computeCenteredScrollTop(99, 20, 400, 500)).toBe(100)
  })

  it('is safe against a zero/invalid line height', () => {
    expect(computeCenteredScrollTop(10, 0, 400, 2000)).toBe(0)
  })
})
