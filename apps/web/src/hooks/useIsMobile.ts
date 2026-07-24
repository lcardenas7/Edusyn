import { useEffect, useState } from 'react'

/**
 * ¿Estamos en un viewport de celular? Los motores del Taller (Board, Árbol,
 * Matriz, Mapa) usan un lienzo espacial con arrastre que en el teléfono queda
 * inmanejable: en móvil renderizan un layout apilado y táctil con las MISMAS
 * acciones (agregar, votar, comentar, editar, borrar), sin arrastre.
 */
export function useIsMobile(breakpoint = 640): boolean {
  const query = `(max-width: ${breakpoint - 0.02}px)`
  const [mobile, setMobile] = useState<boolean>(
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const mql = window.matchMedia(query)
    const on = () => setMobile(mql.matches)
    on()
    mql.addEventListener('change', on)
    return () => mql.removeEventListener('change', on)
  }, [query])
  return mobile
}
