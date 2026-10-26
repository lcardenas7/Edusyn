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

/** Election schedule fields are calendar dates, not instants. */
export function hasElectionStartDateArrived(
  startDate: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!startDate) return true;
  return calendarDateInBogota(now) >= startDate.slice(0, 10);
}

export function formatElectionDate(startDate: string): string {
  return new Date(startDate).toLocaleDateString('es-CO', { timeZone: 'UTC' });
}
