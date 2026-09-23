/**
 * Hoja modal: sube desde abajo en móvil, se centra en escritorio.
 *
 * Existe para que todos los diálogos del aula se comporten igual — mismo fondo, mismo cierre
 * con Escape, mismo alcance para el pulgar. Cada uno por su cuenta acababa olvidando algo; el
 * primero que escribí no cerraba con el teclado.
 */

import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function Hoja({
  titulo,
  detalle,
  onCerrar,
  children,
}: {
  titulo: string
  detalle?: string
  onCerrar: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', alTeclear)
    /*
     * Mientras la hoja está abierta, lo de detrás se queda QUIETO. Sin esto, arrastrar sobre la
     * hoja desplazaba la página de atrás y se veía el contenido corriendo bajo el diálogo: el
     * gesto más delator de que esto es una página web.
     *
     * No basta con `overflow: hidden`: el scroll lo lleva el elemento raíz, y en Safari de iOS
     * ni aun así se detiene el arrastre. Lo que sí funciona es sacar el cuerpo del flujo y
     * subirlo lo que estuviera desplazado, guardando la posición para devolverla al cerrar —si
     * no, la página vuelve arriba del todo y el estudiante pierde dónde estaba.
     */
    const desplazamiento = window.scrollY
    const { body } = document
    const previos = { position: body.style.position, top: body.style.top, width: body.style.width }
    body.setAttribute('data-aula-hoja-abierta', '')
    body.style.position = 'fixed'
    body.style.top = `-${desplazamiento}px`
    body.style.width = '100%'
    return () => {
      window.removeEventListener('keydown', alTeclear)
      body.removeAttribute('data-aula-hoja-abierta')
      body.style.position = previos.position
      body.style.top = previos.top
      body.style.width = previos.width
      window.scrollTo(0, desplazamiento)
    }
  }, [onCerrar])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
    >
      <button type="button" aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-ink-primary/40" />

      <div className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-modal border border-hairline bg-surface-1 pb-[env(safe-area-inset-bottom)] shadow-lg sm:rounded-modal sm:pb-0">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <h2 className="text-body-base font-semibold text-ink-primary">{titulo}</h2>
            {detalle && <p className="mt-0.5 text-body-sm text-ink-muted">{detalle}</p>}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mt-1 flex min-h-btn min-w-btn shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
