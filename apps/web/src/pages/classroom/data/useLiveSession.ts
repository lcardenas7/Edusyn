/**
 * Vigila si hay una sesión de quiz abierta en el aula.
 *
 * El aula actual consulta esto **una sola vez** al montar el componente. Consecuencia real: un
 * estudiante que ya tiene la pantalla abierta cuando el profe arranca el quiz en vivo no se
 * entera nunca — justo el caso más frecuente, porque la clase entra al aula ANTES de que el
 * profe lance la sesión.
 *
 * Aquí se consulta cada cierto tiempo, y además:
 *  - se calla mientras la pestaña está oculta (no gasta peticiones con el celular guardado);
 *  - vuelve a consultar en cuanto la pestaña se ve otra vez, que es cuando el estudiante mira;
 *  - si la sesión termina, el aviso desaparece solo.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { liveSessionApi } from '../../../lib/api'
import { isSessionOpen, type LiveSessionLike } from '../model/liveSession'

/** Cada cuánto se pregunta, con la pestaña visible. */
const INTERVALO_MS = 20_000

export function useLiveSession(classroomId: string | null | undefined) {
  const [session, setSession] = useState<LiveSessionLike | null>(null)
  const vivo = useRef(true)

  const consultar = useCallback(async () => {
    if (!classroomId) return
    try {
      const { data } = await liveSessionApi.getActive(classroomId)
      if (!vivo.current) return
      setSession(isSessionOpen(data) ? (data as LiveSessionLike) : null)
    } catch {
      // Un fallo aquí no debe romper el aula ni mostrar un error: lo peor que pasa es que el
      // aviso aparezca en el siguiente ciclo. Se traga a propósito, y es la única excepción a
      // la regla de "cero catch vacíos" del módulo, por eso queda explicada.
    }
  }, [classroomId])

  useEffect(() => {
    vivo.current = true
    if (!classroomId) {
      setSession(null)
      return
    }

    consultar()
    let timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') consultar()
    }, INTERVALO_MS)

    const alVolver = () => {
      if (document.visibilityState === 'visible') consultar()
    }
    document.addEventListener('visibilitychange', alVolver)

    return () => {
      vivo.current = false
      window.clearInterval(timer)
      timer = 0
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [classroomId, consultar])

  /** Para forzar una consulta tras cerrar el quiz, sin esperar al siguiente ciclo. */
  return { session, refrescar: consultar }
}
