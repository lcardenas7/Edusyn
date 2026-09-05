/**
 * El tema que el estudiante eligió para su vista del aula.
 *
 * Vive en el dispositivo a propósito: es una preferencia personal, no un dato del colegio. No
 * hay endpoint que guardar, no hay permiso que pedir, y no cambia lo que ven sus compañeros.
 * Si cambia de celular, vuelve al color del docente, que es un punto de partida razonable.
 *
 * Una sola clave para todas las aulas: quien no quiere el rosado tampoco lo quiere en la otra
 * materia. Elegir "Cada materia con su color" devuelve el comportamiento de fábrica.
 */

import { useCallback, useEffect, useState } from 'react'
import type { TemaElegido } from '../model/tema'
import { temaPorId } from '../model/tema'

const CLAVE = 'edusyn:aula:tema'

export function useTemaEstudiante(activo: boolean) {
  const [tema, setTema] = useState<TemaElegido>(null)

  useEffect(() => {
    if (!activo) return
    try {
      // `temaPorId` filtra un id viejo que ya no esté en el catálogo.
      setTema(temaPorId(localStorage.getItem(CLAVE))?.id ?? null)
    } catch {
      setTema(null)
    }
  }, [activo])

  const elegir = useCallback((id: TemaElegido) => {
    setTema(id)
    try {
      if (id) localStorage.setItem(CLAVE, id)
      else localStorage.removeItem(CLAVE)
    } catch {
      /* sin almacenamiento: la elección dura lo que la sesión */
    }
  }, [])

  return { tema: activo ? tema : null, elegir }
}
