import {
  addDateOnlyDays,
  colombiaTodayKey,
  compareDateOnlyToColombiaToday,
  dateOnlyKey,
  formatDateOnlyInColombia,
} from './date-window.util';

describe('date-only windows in Colombia', () => {
  it('keeps UTC-midnight dates on their configured calendar day', () => {
    const date = new Date('2026-10-24T00:00:00.000Z');
    expect(dateOnlyKey(date)).toBe('2026-10-24');
    expect(formatDateOnlyInColombia(date)).toBe('24/10/2026');
  });

  it('compares open and close dates inclusively using Colombia today', () => {
    const closeDate = new Date('2026-10-24T00:00:00.000Z');
    const duringClosingDay = new Date('2026-10-25T02:00:00.000Z'); // 21:00 in Colombia on Oct 24
    const nextColombiaDay = new Date('2026-10-25T06:00:00.000Z'); // 01:00 in Colombia on Oct 25

    expect(colombiaTodayKey(duringClosingDay)).toBe('2026-10-24');
    expect(compareDateOnlyToColombiaToday(closeDate, duringClosingDay)).toBe(0);
    expect(
      compareDateOnlyToColombiaToday(closeDate, nextColombiaDay),
    ).toBeLessThan(0);
  });

  it('adds late-entry days as calendar dates', () => {
    expect(addDateOnlyDays(new Date('2026-10-24T00:00:00.000Z'), 2)).toBe(
      '2026-10-26',
    );
  });
});
