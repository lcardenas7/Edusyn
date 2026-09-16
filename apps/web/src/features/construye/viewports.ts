/** Viewports lógicos del preview. "Lógico" es la clave: son las dimensiones con las que el
 * proyecto se renderiza de verdad dentro del iframe, y por tanto contra las que el navegador
 * evalúa las media queries. El escalado visual (transform: scale) solo cambia cuánto espacio
 * ocupa en pantalla — nunca estas dimensiones. Por eso NO se usa `zoom`: ese sí alteraría el
 * viewport interno y el proyecto dejaría de comportarse como en la pantalla que dice representar. */
export type ViewportKey = 'desktop' | 'mobile'

export interface ViewportPreset {
  key: ViewportKey
  label: string
  width: number
  height: number
}

export const VIEWPORT_PRESETS: Record<ViewportKey, ViewportPreset> = {
  desktop: { key: 'desktop', label: 'Escritorio', width: 1280, height: 800 },
  mobile: { key: 'mobile', label: 'Móvil', width: 390, height: 844 },
}

/** Cuánto hay que reducir el viewport lógico para que quepa en el espacio real del panel.
 * Nunca amplía (tope en 1): mostrar un proyecto más grande que su tamaño real engañaría sobre
 * cómo se ve. Sin espacio medido todavía (0), se asume 1 para no renderizar un preview
 * colapsado en el primer frame. */
export function computeViewportScale(availableWidth: number, logicalWidth: number, availableHeight?: number, logicalHeight?: number): number {
  if (!Number.isFinite(availableWidth) || availableWidth <= 0) return 1
  const byWidth = Math.min(1, availableWidth / logicalWidth)
  // El alto solo cuenta cuando se pide (vista enfocada): ahí el dispositivo entero debe caber
  // en la pantalla sin desplazarse. En el panel normal el alto sigue libre.
  if (availableHeight === undefined || logicalHeight === undefined || !Number.isFinite(availableHeight) || availableHeight <= 0) return byWidth
  return Math.min(byWidth, availableHeight / logicalHeight)
}
