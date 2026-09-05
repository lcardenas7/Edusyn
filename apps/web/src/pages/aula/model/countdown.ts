/**
 * Fechas dichas en español claro. **Lógica pura, sin React.**
 *
 * Por qué existe: la auditoría (hallazgo G3) encontró que la tarjeta dice "Vence 12 jun" aunque
 * ya haya pasado — solo cambia a rojo. Un estudiante de 13 años no traduce "Vence 12 jun" a
 * "llevo tres días de retraso". Aquí las fechas se dicen como las diría una persona.
 *
 * Todo se calcula en hora de pared de Colombia (UTC-5), no en la del dispositivo.
 */

import { BOGOTA_TZ, bogotaDayKey } from './activityState'

/** Días de calendario (en Colombia) entre `from` y `to`. Negativo = `to` ya pasó. */
export function bogotaDayDelta(
  to: string | Date | null | undefined,
  from: string | Date = new Date(),
): number | null {
  const kt = bogotaDayKey(to)
  const kf = bogotaDayKey(from)
  if (!kt || !kf) return null
  // Las claves son "YYYY-MM-DD": compararlas como fechas UTC evita el desfase de zona.
  const dt = Date.parse(`${kt}T00:00:00Z`)
  const df = Date.parse(`${kf}T00:00:00Z`)
  return Math.round((dt - df) / 86_400_000)
}

/** "5:00 p. m." en hora de Colombia. */
export function bogotaTime(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('es-CO', { timeZone: BOGOTA_TZ, hour: 'numeric', minute: '2-digit' })
}

/** "12 de junio". Sin año si cae en el año en curso. */
export function bogotaLongDate(value: string | Date | null | undefined, now: Date = new Date()): string {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  const sameYear = bogotaDayKey(d)?.slice(0, 4) === bogotaDayKey(now)?.slice(0, 4)
  return d.toLocaleString('es-CO', {
    timeZone: BOGOTA_TZ,
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

/** "12 jun" — la forma corta para líneas de metadatos apretadas. */
export function bogotaShortDate(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return ''
  return d
    .toLocaleString('es-CO', { timeZone: BOGOTA_TZ, day: 'numeric', month: 'short' })
    .replace('.', '')
}

/**
 * Cómo se dice una fecha límite. Es la frase que lee el estudiante en la tarjeta.
 *
 *   hoy        → "Vence hoy a las 5:00 p. m."
 *   mañana     → "Vence mañana"
 *   2..7 días  → "Te quedan 3 días"
 *   más lejos  → "Vence el 12 de junio"
 *   ayer       → "Venció ayer"
 *   pasado     → "Venció hace 3 días"
 */
export function dueCopy(dueDate: string | Date | null | undefined, now: Date = new Date()): string {
  const delta = bogotaDayDelta(dueDate, now)
  if (delta === null) return 'Sin fecha de entrega'
  if (delta === 0) {
    const hora = bogotaTime(dueDate)
    return hora ? `Vence hoy a las ${hora}` : 'Vence hoy'
  }
  if (delta === 1) return 'Vence mañana'
  if (delta === -1) return 'Venció ayer'
  if (delta > 1 && delta <= 7) return `Te quedan ${delta} días`
  if (delta < -1) return `Venció hace ${Math.abs(delta)} días`
  return `Vence el ${bogotaLongDate(dueDate, now)}`
}

/**
 * Cómo se dice una fecha de apertura futura: "Se abre mañana", "Se abre el 12 de junio".
 * Devuelve null si ya abrió (no hay nada que decir).
 */
export function opensCopy(openDate: string | Date | null | undefined, now: Date = new Date()): string | null {
  const delta = bogotaDayDelta(openDate, now)
  if (delta === null || delta < 0) return null
  if (delta === 0) {
    const hora = bogotaTime(openDate)
    return hora ? `Se abre hoy a las ${hora}` : 'Se abre hoy'
  }
  if (delta === 1) return 'Se abre mañana'
  if (delta <= 7) return `Se abre en ${delta} días`
  return `Se abre el ${bogotaLongDate(openDate, now)}`
}

/** "hace 2 días", "hoy", "ayer" — para anuncios y entregas. */
export function agoCopy(value: string | Date | null | undefined, now: Date = new Date()): string {
  const delta = bogotaDayDelta(value, now)
  if (delta === null) return ''
  if (delta === 0) return 'hoy'
  if (delta === -1) return 'ayer'
  if (delta < -1 && delta >= -7) return `hace ${Math.abs(delta)} días`
  if (delta === 1) return 'mañana'
  if (delta > 1 && delta <= 7) return `en ${delta} días`
  return `el ${bogotaLongDate(value, now)}`
}

// ─── Línea de tiempos de la actividad ────────────────────────────────────────

export interface Milestone {
  key: 'publicada' | 'abre' | 'vence' | 'entregada' | 'calificada'
  label: string
  date: string
  /** Ya ocurrió. */
  done: boolean
}

/**
 * Los hitos de una actividad, en orden y **solo los que existen**.
 *
 * El prototipo pintaba siempre los cinco, con guiones para los vacíos, en cinco columnas de
 * ancho fijo: en 360 px las etiquetas se montan unas sobre otras. Aquí se omite lo que no
 * aplica, así que la mayoría de actividades muestran dos o tres hitos.
 */
export function milestonesOf(
  dates: {
    publishedAt?: string | null
    openDate?: string | null
    dueDate?: string | null
    submittedAt?: string | null
    gradedAt?: string | null
  },
  now: Date = new Date(),
): Milestone[] {
  const t = now.getTime()
  const past = (iso?: string | null) => {
    if (!iso) return false
    const ms = new Date(iso).getTime()
    return !Number.isNaN(ms) && ms <= t
  }
  const rows: Milestone[] = []
  if (dates.publishedAt) rows.push({ key: 'publicada', label: 'Publicada', date: dates.publishedAt, done: true })
  if (dates.openDate) rows.push({ key: 'abre', label: 'Se abre', date: dates.openDate, done: past(dates.openDate) })
  if (dates.dueDate) rows.push({ key: 'vence', label: 'Vence', date: dates.dueDate, done: past(dates.dueDate) })
  if (dates.submittedAt) rows.push({ key: 'entregada', label: 'Entregada', date: dates.submittedAt, done: true })
  if (dates.gradedAt) rows.push({ key: 'calificada', label: 'Calificada', date: dates.gradedAt, done: true })
  return rows
}
