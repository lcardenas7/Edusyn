/**
 * Sesión en vivo de quiz. **Lógica pura, sin React.**
 *
 * Es lo más urgente que puede pasar en un aula: el profe arrancó un quiz y la clase está
 * respondiendo AHORA. Merece tratamiento aparte del resto de estados.
 *
 * Tres problemas del comportamiento actual que esto corrige:
 *
 *  1. El aviso vive dentro de la pestaña **Actividades**. Un estudiante que aterriza en Inicio
 *     no se entera de que hay un quiz en curso. Aquí el aviso va arriba de "Hoy", que es la
 *     pantalla de aterrizaje.
 *  2. El docente solo ve aviso en modo "en casa". Si arranca un quiz en vivo y recarga la
 *     página, pierde la sesión sin forma de volver.
 *  3. El modo llega en dos sitios distintos (`deliveryMode` o `config.deliveryMode`) y se lee
 *     con la misma expresión repetida en cuatro lugares. Aquí se normaliza una vez.
 */

export interface LiveSessionLike {
  id: string
  activityId: string
  /** 'SYNC' (en clase, todos a la vez) o 'ASYNC_HOME' (cada quien a su ritmo). */
  deliveryMode?: string | null
  config?: { deliveryMode?: string | null } | null
  /** 'WAITING' | 'ACTIVE' | 'FINISHED' … */
  status?: string | null
  activity?: { title?: string | null } | null
}

/** Cómo se está corriendo el quiz. */
export type LiveMode = 'en-vivo' | 'en-casa'

/**
 * El modo, leído de los dos sitios donde el backend puede ponerlo.
 * Ante la duda, "en vivo": es el caso que exige entrar YA, así que equivocarse hacia allá
 * cuesta un aviso de más y no un estudiante que se pierde el quiz.
 */
export function liveModeOf(s: LiveSessionLike | null | undefined): LiveMode {
  const raw = s?.deliveryMode ?? s?.config?.deliveryMode ?? null
  return raw === 'ASYNC_HOME' ? 'en-casa' : 'en-vivo'
}

/** ¿Sigue viva? Una sesión terminada no debe anunciarse. */
export function isSessionOpen(s: LiveSessionLike | null | undefined): boolean {
  if (!s?.id) return false
  return s.status !== 'FINISHED'
}

export interface LiveSessionCopy {
  titulo: string
  detalle: string
  cta: string
}

/**
 * Los textos del aviso. Nomenclatura del glosario (§5.5 del plan): "Quiz en vivo" y
 * "Quiz en casa", nunca "Live Quiz" ni "En Línea" ni "🏠 Quiz En Casa Activo".
 */
export function liveSessionCopy(
  s: LiveSessionLike,
  role: 'docente' | 'estudiante',
): LiveSessionCopy {
  const modo = liveModeOf(s)
  const titulo = s.activity?.title?.trim()

  if (role === 'estudiante') {
    return modo === 'en-casa'
      ? {
          titulo: 'Tienes un quiz en casa abierto',
          detalle: titulo ? `${titulo} · avanza a tu ritmo.` : 'Avanza a tu ritmo.',
          cta: 'Continuar',
        }
      : {
          titulo: 'Quiz en vivo en curso',
          detalle: titulo ? `${titulo} · tu profe ya empezó.` : 'Tu profe ya empezó.',
          cta: 'Entrar ahora',
        }
  }

  return modo === 'en-casa'
    ? {
        titulo: 'Quiz en casa abierto',
        detalle: titulo ? `${titulo} · tus estudiantes están resolviendo.` : 'Tus estudiantes están resolviendo.',
        cta: 'Ver el progreso',
      }
    : {
        titulo: 'Tienes un quiz en vivo abierto',
        detalle: titulo ? `${titulo} · la sesión sigue activa.` : 'La sesión sigue activa.',
        cta: 'Volver a la sesión',
      }
}
