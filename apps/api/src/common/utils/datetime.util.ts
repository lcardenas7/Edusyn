import { BadRequestException } from '@nestjs/common';

/**
 * Parse a date coming from an HTML date input as a Colombia calendar date.
 * Date-only values are anchored at midnight in UTC-5 so rendering them in
 * Colombia does not move the selected day to the previous date.
 */
export function parseColombiaDate(value: string | Date): Date {
  if (value instanceof Date) return value;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const calendarDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      calendarDate.getUTCFullYear() !== Number(year) ||
      calendarDate.getUTCMonth() + 1 !== Number(month) ||
      calendarDate.getUTCDate() !== Number(day)
    ) {
      throw new BadRequestException('Fecha no válida');
    }
  }
  const parsed = new Date(dateOnly ? `${value}T00:00:00.000-05:00` : value);

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Fecha no válida');
  }

  return parsed;
}
