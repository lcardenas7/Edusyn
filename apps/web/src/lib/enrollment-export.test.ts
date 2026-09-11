import { expect, it } from 'vitest'
import { enrollmentCsv } from './enrollment-export'

it('exports accents, separators and quoted notes without creating spreadsheet formulas', () => {
  expect(enrollmentCsv([['María; López', 'Dice "hola"', '=1+1', '  @SUM(1)', null]])).toBe('\uFEFF"María; López";"Dice ""hola""";"\'=1+1";"\'  @SUM(1)";""')
})
