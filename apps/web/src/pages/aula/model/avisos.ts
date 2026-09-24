/**
 * Los avisos que llegan a la campana.
 *
 * Son los mismos mensajes que ya recibía el estudiante (circulares, notificaciones del colegio),
 * más los que genera el aula cuando el docente publica una actividad. Lo que cambia es que ahora
 * algunos traen `link`: se toca el aviso y se abre la actividad, sin entrar al aula a buscarla.
 *
 * Esta capa solo transforma: la bandeja devuelve destinatarios con su mensaje dentro, y aquí se
 * aplana a algo que la interfaz pueda pintar sin saber cómo está guardado.
 */

/** Lo que devuelve `GET /communications/inbox`, en lo que nos importa. */
export interface FilaBandeja {
  id: string
  readAt?: string | null
  message?: {
    id: string
    subject?: string | null
    content?: string | null
    link?: string | null
    origin?: string | null
    createdAt?: string | null
    sentAt?: string | null
    author?: { firstName?: string | null; lastName?: string | null } | null
  } | null
}

export interface Aviso {
  /** El del mensaje: es lo que se marca como leído. */
  messageId: string
  titulo: string
  detalle: string
  /** A dónde lleva, si lleva a alguna parte. */
  enlace: string | null
  /** Lo generó el aula al publicar una actividad, no una persona. */
  deActividad: boolean
  leido: boolean
  fecha: string | null
}

export function normalizarAvisos(filas: FilaBandeja[] | null | undefined): Aviso[] {
  return (filas ?? [])
    .filter((f) => f?.message)
    .map((f) => {
      const m = f.message!
      return {
        messageId: m.id,
        titulo: (m.subject ?? '').trim() || 'Aviso',
        detalle: (m.content ?? '').trim(),
        enlace: m.link?.trim() || null,
        deActividad: m.origin === 'actividad-publicada',
        leido: !!f.readAt,
        fecha: m.sentAt ?? m.createdAt ?? null,
      }
    })
    .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''))
}

export function sinLeer(avisos: Aviso[]): number {
  return avisos.filter((a) => !a.leido).length
}

/**
 * Cuándo llegó, en corto. Un aviso de hace diez minutos no necesita fecha completa; uno de la
 * semana pasada sí, porque "hace 9 días" no le dice nada a nadie.
 */
export function cuandoLlego(fecha: string | null, ahora: Date = new Date()): string {
  if (!fecha) return ''
  const t = new Date(fecha).getTime()
  if (isNaN(t)) return ''
  const minutos = Math.floor((ahora.getTime() - t) / 60000)
  if (minutos < 1) return 'ahora'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  return new Date(t).toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: 'numeric', month: 'short' })
}
