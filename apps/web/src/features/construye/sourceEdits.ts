/**
 * Reemplazo atómico sobre el texto de un archivo del estudiante. Es la ÚNICA puerta por la que
 * Construye escribe código: la usan tanto la edición visual de CSS (Paso 5.0) como la de texto
 * HTML (Paso 5.1), y cualquier edición futura debe pasar por aquí en vez de traer su propia
 * versión.
 *
 * Su contrato es deliberadamente desconfiado: no busca nada, no interpreta nada y no arregla
 * nada. Recibe un rango exacto y el texto que se espera encontrar ahí; si no coincide, no
 * escribe.
 */

export interface SourceRange { start: number; end: number }

export interface SourceEditResult {
  content: string
  /** Dónde quedó el texto NUEVO, para poder mostrárselo al estudiante en su editor. */
  range: SourceRange
}

/**
 * Sustituye SOLO [start, end) por `replacement` y deja el resto del archivo byte a byte igual:
 * etiquetas, atributos, indentación, comentarios, elementos hermanos y cualquier otra
 * aparición del mismo texto. No se re-serializa ni se reformatea el archivo.
 *
 * Devuelve `null` cuando la edición ya no es segura: rango no entero, fuera de límites o
 * invertido, o —lo más importante— cuando el texto que hay AHORA en ese rango ya no es el que
 * el estudiante tenía a la vista (editó el archivo entre medias). En ese caso no se busca el
 * texto en otro sitio ni se intenta recuperar por parecido: se cancela y se le pide volver a
 * seleccionar.
 */
export function replaceExactRange(content: string, range: SourceRange, expected: string, replacement: string): SourceEditResult | null {
  if (!Number.isInteger(range.start) || !Number.isInteger(range.end)) return null
  if (range.start < 0 || range.end > content.length || range.start > range.end) return null
  if (content.slice(range.start, range.end) !== expected) return null
  return {
    content: content.slice(0, range.start) + replacement + content.slice(range.end),
    range: { start: range.start, end: range.start + replacement.length },
  }
}
