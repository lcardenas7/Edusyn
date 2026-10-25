import { BadRequestException } from '@nestjs/common';
import { parseColombiaDate } from './datetime.util';

describe('parseColombiaDate', () => {
  it('anchors HTML date-only values at midnight in Colombia', () => {
    expect(parseColombiaDate('2026-10-25').toISOString()).toBe('2026-10-25T05:00:00.000Z');
  });

  it('preserves an existing Date value', () => {
    const date = new Date('2026-10-25T12:00:00.000Z');
    expect(parseColombiaDate(date)).toBe(date);
  });

  it('rejects invalid date-only calendar values', () => {
    expect(() => parseColombiaDate('2026-02-30')).toThrow(BadRequestException);
  });

  it('rejects unparseable timestamps', () => {
    expect(() => parseColombiaDate('no-es-fecha')).toThrow(BadRequestException);
  });
});
