// Saludo dinámico según hora del día. Genera tono cálido y humano.

export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'morning'
  if (h >= 12 && h < 18) return 'afternoon'
  if (h >= 18 && h < 22) return 'evening'
  return 'night'
}

const GREETINGS: Record<ReturnType<typeof getTimeOfDay>, string[]> = {
  morning: ['Buenos días', 'Hola, buen día', 'Buen día'],
  afternoon: ['Buenas tardes', 'Hola', 'Qué tal'],
  evening: ['Buenas tardes', 'Hola', 'Cómo te fue hoy'],
  night: ['Buenas noches', 'Hola', 'Trabajando hasta tarde'],
}

export function getGreeting(name?: string | null): string {
  const tod = getTimeOfDay()
  const options = GREETINGS[tod]
  // Determinístico por día — el mismo saludo todo el día, cambia cada día
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  const greeting = options[dayOfYear % options.length]
  return name ? `${greeting}, ${name}` : greeting
}

const DATE_FORMATTER = new Intl.DateTimeFormat('es-CO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export function getFormattedDate(): string {
  const formatted = DATE_FORMATTER.format(new Date())
  // Capitalizar primera letra
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}
