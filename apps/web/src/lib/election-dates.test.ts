import { describe, expect, it } from 'vitest'
import { formatElectionDate, hasElectionStartDateArrived } from './election-dates'

describe('election schedule dates', () => {
  it('does not enable a phase before its calendar date in Colombia', () => {
    const start = '2026-10-27T00:00:00.000Z'

    expect(hasElectionStartDateArrived(start, new Date('2026-10-27T04:59:00.000Z'))).toBe(false)
    expect(hasElectionStartDateArrived(start, new Date('2026-10-27T05:00:00.000Z'))).toBe(true)
  })

  it('allows a phase without a configured start date', () => {
    expect(hasElectionStartDateArrived(null, new Date('2026-10-26T12:00:00.000Z'))).toBe(true)
  })

  it('formats the scheduled date without shifting it to the previous day', () => {
    expect(formatElectionDate('2026-10-27T00:00:00.000Z')).toBe('27/10/2026')
  })
})
