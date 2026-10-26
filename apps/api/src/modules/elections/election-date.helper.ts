const ELECTION_TIME_ZONE = 'America/Bogota';

function calendarDateInBogota(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ELECTION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * Election schedule fields are calendar dates. Compare their UTC date portion
 * with the current date in Colombia so a UTC server cannot advance the phase
 * one day early or late.
 */
export function hasElectionStartDateArrived(
  startDate: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!startDate) return true;
  return calendarDateInBogota(now) >= startDate.toISOString().slice(0, 10);
}

export function formatElectionDate(startDate: Date): string {
  return startDate.toLocaleDateString('es-CO', { timeZone: 'UTC' });
}
