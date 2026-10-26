import { formatElectionDate, hasElectionStartDateArrived } from './election-date.helper';

describe('election calendar dates', () => {
  it('keeps the phase closed until the configured date in Colombia', () => {
    const start = new Date('2026-10-27T00:00:00.000Z');

    expect(hasElectionStartDateArrived(start, new Date('2026-10-27T04:59:00.000Z'))).toBe(false);
    expect(hasElectionStartDateArrived(start, new Date('2026-10-27T05:00:00.000Z'))).toBe(true);
  });

  it('allows a phase with no configured start date', () => {
    expect(hasElectionStartDateArrived(null, new Date('2026-10-26T12:00:00.000Z'))).toBe(true);
  });

  it('formats the configured calendar day without timezone shifting', () => {
    expect(formatElectionDate(new Date('2026-10-27T00:00:00.000Z'))).toBe('27/10/2026');
  });
});
