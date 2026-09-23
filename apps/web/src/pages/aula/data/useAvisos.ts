/**
 * Los avisos del usuario, para la campana del aula.
 *
 * Se leen de la misma bandeja que alimenta la campana del resto de la plataforma: dentro del
 * aula no hay una segunda campana con otra cuenta, es la misma. Se refresca cada minuto, igual
 * que en `Layout`, y al volver a la pestaña —si el estudiante dejó el aula abierta en el móvil y
 * vuelve media hora después, lo que ve tiene que estar al día.
 */

import { useCallback, useEffect, useState } from 'react'
// Del módulo, no de la fachada: `lib/api/index.ts` arrastra el grafo entero (bloque R1).
import { communicationsApi } from '../../../lib/api/communications'
import { normalizarAvisos, sinLeer, type Aviso } from '../model/avisos'

const CADA_MINUTO = 60000

export function useAvisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(async () => {
    try {
      const res = await communicationsApi.getInbox()
      setAvisos(normalizarAvisos(res.data))
    } catch {
      // La campana no puede tumbar el aula: sin bandeja, simplemente no hay avisos que mostrar.
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    recargar()
    const reloj = setInterval(recargar, CADA_MINUTO)
    const alVolver = () => {
      if (document.visibilityState === 'visible') recargar()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearInterval(reloj)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [recargar])

  /**
   * Marca en el servidor y en pantalla. Lo segundo primero: el estudiante toca el aviso y se va
   * a la actividad, así que no puede quedarse esperando a que responda la red para ver el cambio.
   */
  const marcarLeido = useCallback(async (messageId: string) => {
    setAvisos((previos) => previos.map((a) => (a.messageId === messageId ? { ...a, leido: true } : a)))
    try {
      await communicationsApi.markAsRead(messageId)
    } catch {
      // Si falla, el próximo refresco lo devuelve a no leído: el servidor manda.
    }
  }, [])

  return { avisos, sinLeer: sinLeer(avisos), cargando, recargar, marcarLeido }
}
