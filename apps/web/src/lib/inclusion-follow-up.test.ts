import { describe, expect, it } from 'vitest'
import { filterFollowUpPlans, followUpState } from './inclusion-follow-up'

describe('inclusion follow-up agenda', () => {
  const today = '2026-09-10'
  it('includes today without shifting UTC dates to yesterday', () => {
    expect(followUpState({ status: 'ACTIVE', followUpDate: '2026-09-10T00:00:00.000Z' }, today)).toBe('due')
    expect(followUpState({ status: 'ACTIVE', followUpDate: '2026-09-11T00:00:00.000Z' }, today)).toBe('upcoming')
  })
  it('does not count closed plans as overdue', () => {
    expect(followUpState({ status: 'COMPLETED', followUpDate: '2026-01-01' }, today)).toBe('closed')
    expect(followUpState({ status: 'CANCELLED' }, today)).toBe('closed')
  })
  it('shows missing dates explicitly', () => {
    expect(followUpState({ status: 'ACTIVE', followUpDate: null }, today)).toBe('unscheduled')
  })
  it('combines student search and due filter, keeping the source unchanged', () => {
    const plans = [
      { id: 'future', status: 'ACTIVE', followUpDate: '2026-10-01' },
      { id: 'due', status: 'ACTIVE', followUpDate: today, studentEnrollment: { student: { firstName: 'María', documentNumber: '123' } } },
      { id: 'closed', status: 'COMPLETED', followUpDate: today },
    ]
    expect(filterFollowUpPlans(plans, 'due', 'maria', today).map(p => p.id)).toEqual(['due'])
    expect(filterFollowUpPlans(plans, 'all', '123', today).map(p => p.id)).toEqual(['due'])
    expect(plans[0].id).toBe('future')
  })
})
