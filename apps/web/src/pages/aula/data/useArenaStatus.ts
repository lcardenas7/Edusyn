/**
 * Estado de la Arena para la tarjeta de Actividades.
 *
 * Dos cosas que la tarjeta necesita y que antes no sabía:
 *  - si la Arena tiene preguntas suficientes: sin ellas, al estudiante no se le
 *    ofrece una puerta que da a «La Arena todavía no abre»;
 *  - si al estudiante lo retaron o le toca jugar: un reto recibido no dejaba
 *    ninguna señal fuera de la Arena, y solo lo descubría quien entraba a mirar.
 *
 * Se consulta al montar y cada vez que la pestaña vuelve a verse, que es cuando
 * el estudiante mira. No se consulta en bucle: un reto no es urgente al segundo.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import api from '../../../lib/api/client'

export type ArenaStatus = { role: 'teacher' | 'student'; ready: boolean; pendingInvites: number; myTurn: number }

export function useArenaStatus(classroomId: string | null | undefined) {
  const [status, setStatus] = useState<ArenaStatus | null>(null)
  const [failed, setFailed] = useState(false)
  const vivo = useRef(true)

  const consultar = useCallback(async () => {
    if (!classroomId) return
    try {
      const { data } = await api.get<ArenaStatus>(`/classroom-duels/classrooms/${classroomId}/status`)
      if (vivo.current) { setStatus(data); setFailed(false) }
    } catch {
      // Si falla, la tarjeta se comporta como antes: visible y sin aviso. Un error
      // aquí no debe romper el aula ni esconder la Arena a quien sí puede jugar.
      if (vivo.current) setFailed(true)
    }
  }, [classroomId])

  useEffect(() => {
    vivo.current = true
    void consultar()
    const alVolver = () => { if (document.visibilityState === 'visible') void consultar() }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      vivo.current = false
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [consultar])

  return { status, failed }
}
