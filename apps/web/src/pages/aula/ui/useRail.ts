/**
 * Estado del riel de navegación del aula: expandido o solo iconos.
 *
 * Por qué es colapsable y no una barra fija (decisión D2 del plan): `Layout.tsx` ya tiene un
 * menú global de 256 px. Una segunda barra fija de 224 px dentro de la página deja ~480 px de
 * cromo en un portátil de 1366 px, es decir más de un tercio de la pantalla gastado en menús.
 *
 * La preferencia se recuerda por dispositivo. El valor inicial depende del ancho: en pantallas
 * grandes se abre expandido, en las medianas arranca como riel.
 */

import { useCallback, useEffect, useState } from 'react'

const CLAVE = 'edusyn:aula:rail'
/** Por debajo de esto el riel arranca colapsado, aunque quepa. */
const ANCHO_COMODO = 1280

type Guardado = 'expandido' | 'riel'

function leerPreferencia(): Guardado | null {
  try {
    const v = localStorage.getItem(CLAVE)
    return v === 'expandido' || v === 'riel' ? v : null
  } catch {
    return null
  }
}

function guardarPreferencia(v: Guardado): void {
  try {
    localStorage.setItem(CLAVE, v)
  } catch {
    /* sin acceso a localStorage: la preferencia dura lo que la sesión, y ya */
  }
}

export interface RailState {
  expandido: boolean
  alternar: () => void
}

export function useRail(): RailState {
  const [expandido, setExpandido] = useState<boolean>(() => {
    const guardado = leerPreferencia()
    if (guardado) return guardado === 'expandido'
    if (typeof window === 'undefined') return true
    return window.innerWidth >= ANCHO_COMODO
  })

  const alternar = useCallback(() => {
    setExpandido((v) => {
      guardarPreferencia(v ? 'riel' : 'expandido')
      return !v
    })
  }, [])

  // Si el usuario nunca eligió, el riel se adapta al ancho de la ventana. En cuanto elige,
  // manda su decisión: no se le vuelve a mover el menú bajo los pies.
  useEffect(() => {
    if (leerPreferencia()) return
    const alRedimensionar = () => setExpandido(window.innerWidth >= ANCHO_COMODO)
    window.addEventListener('resize', alRedimensionar)
    return () => window.removeEventListener('resize', alRedimensionar)
  }, [])

  return { expandido, alternar }
}
