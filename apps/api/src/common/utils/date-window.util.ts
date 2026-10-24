const COLOMBIA_TIME_ZONE = 'America/Bogota';

/** Return a date-only value as YYYY-MM-DD without shifting UTC-midnight dates. */
export function dateOnlyKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Return today's calendar date in Colombia, independent of the server timezone. */
export function colombiaTodayKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: COLOMBIA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

/** Add calendar days to a date-only value without using the server's local timezone. */
export function addDateOnlyDays(date: Date, days: number): string {
  const result = new Date(`${dateOnlyKey(date)}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return dateOnlyKey(result);
}

/** Compare a stored date-only value with today's date in Colombia. */
export function compareDateOnlyToColombiaToday(
  date: Date,
  now: Date = new Date(),
): number {
  return dateOnlyKey(date).localeCompare(colombiaTodayKey(now));
}

/** Format a stored date-only value in Spanish without converting it to the prior UTC-5 day. */
export function formatDateOnlyInColombia(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
