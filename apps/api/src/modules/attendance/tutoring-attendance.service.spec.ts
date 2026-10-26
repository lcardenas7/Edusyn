import { BadRequestException } from '@nestjs/common';
import { TutoringAttendanceService } from './tutoring-attendance.service';

describe('TutoringAttendanceService date-only report filters', () => {
  const service = new TutoringAttendanceService({} as any);
  const parse = (value: string, end = false) =>
    (service as any).fechaFiltroReporte(value, 'fecha', end) as Date;

  it('uses exact UTC calendar-day boundaries for a SQL DATE column', () => {
    expect(parse('2026-10-23').toISOString()).toBe('2026-10-23T00:00:00.000Z');
    expect(parse('2026-10-23', true).toISOString()).toBe('2026-10-23T23:59:59.999Z');
  });

  it('does not let adjacent calendar-day ranges overlap', () => {
    const endOf23 = parse('2026-10-23', true).getTime();
    const startOf24 = parse('2026-10-24').getTime();
    expect(endOf23).toBeLessThan(startOf24);
    expect(startOf24 - endOf23).toBe(1);
  });

  it('preserves timestamps that include a time', () => {
    expect(parse('2026-10-23T18:30:00.000Z').toISOString()).toBe('2026-10-23T18:30:00.000Z');
  });

  it('rejects invalid date-only values', () => {
    expect(() => parse('2026-02-30')).toThrow(BadRequestException);
  });
});