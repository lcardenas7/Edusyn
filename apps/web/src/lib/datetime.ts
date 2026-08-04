// Utilidades de fecha/hora ancladas a Colombia (America/Bogota).
//
// Colombia usa UTC-5 fijo TODO el año (no tiene horario de verano desde 1993),
// así que la hora de pared no depende de la zona configurada en el dispositivo.
// Estas funciones evitan el bug de "la hora sale 5 horas antes" que ocurría al
// depender de la zona horaria del navegador/servidor.

export const BOGOTA_TZ = 'America/Bogota'
const BOGOTA_OFFSET = '-05:00'

// Valor de <input type="datetime-local"> ("YYYY-MM-DDTHH:MM") → ISO UTC,
// interpretando la hora escrita como hora de Colombia.
// Ej: "2026-08-17T23:59" → "2026-08-18T04:59:00.000Z".
export function bogotaInputToIso(value?: string): string | undefined {
  if (!value) return undefined
  const withSeconds = value.length === 16 ? `${value}:00` : value
  const d = new Date(`${withSeconds}${BOGOTA_OFFSET}`)
  return isNaN(d.getTime()) ? undefined : d.toISOString()
}

// Fecha/ISO → valor para <input type="datetime-local"> con la HORA DE PARED de
// Colombia (independiente de la zona del dispositivo). Ej: "2026-08-17T23:59".
export function isoToBogotaInput(d?: string | Date | null): string {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return ''
  // 'sv-SE' produce "YYYY-MM-DD HH:MM:SS"; lo llevamos al formato del input.
  const s = date.toLocaleString('sv-SE', { timeZone: BOGOTA_TZ, hour12: false })
  return s.replace(' ', 'T').slice(0, 16)
}

// Formatea una fecha/ISO en hora de Colombia. Por defecto: "17 ago 2026, 23:59".
export function formatBogota(
  d?: string | Date | null,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
): string {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleString('es-CO', { timeZone: BOGOTA_TZ, ...opts })
}
