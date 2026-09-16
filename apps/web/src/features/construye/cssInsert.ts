import type { EditableCssProperty } from './cssEdits'

/**
 * Inserción segura de una declaración CSS (Paso 5.3).
 *
 * Es la primera operación de Construye que AÑADE código en vez de sustituirlo, así que su
 * contrato es todavía más desconfiado que el resto:
 *
 * - el punto de inserción sale del rango estructural del bloque que reportó el parser, nunca de
 *   buscar la llave de cierre con indexOf/regex;
 * - no se reserializa ni se reformatea nada: se analiza solo el espacio en blanco LOCAL de esa
 *   regla para que la línea nueva se vea como las que ya escribió el estudiante;
 * - ante cualquier duda —un comentario donde la inserción lo dejaría descolocado, un formato
 *   que no sabemos leer— se devuelve `null` y la capacidad simplemente no se ofrece.
 */

/** Rango estructural de la regla, tal como lo entrega el parser (ver `styles.ts`). */
export interface CssRuleBlock {
  /** Offset de `{` y offset justo después de `}`. */
  blockStart: number
  blockEnd: number
  /** Dónde termina la última declaración de la regla (sin contar su `;`), si hay alguna. */
  lastDeclarationEnd?: number
  /** Inicio de la regla completa: sirve para leer su indentación cuando la regla está vacía. */
  ruleStart: number
  /** Indentación de la primera declaración certificada, si la regla tiene alguna. */
  firstDeclarationStart?: number
}

export interface CssInsertion {
  /** Dónde se inserta y qué texto exacto — el resto del archivo no se toca. */
  offset: number
  text: string
  /** Región cuyo contenido debe seguir siendo idéntico para que la inserción siga siendo
   * válida. Cubre de una sola vez "la regla no cambió", "la propiedad sigue ausente" y "el
   * formato sigue siendo el mismo". */
  guard: { start: number; end: number; text: string }
}

const ESPACIO = /^[ \t]*$/

/** Indentación de la línea en la que empieza `offset`: el espacio en blanco desde el salto de
 * línea anterior. Es lectura local y exacta, no una preferencia global del proyecto. */
function indentacionEnLinea(css: string, offset: number): string | null {
  const inicioLinea = css.lastIndexOf('\n', offset - 1) + 1
  const prefijo = css.slice(inicioLinea, offset)
  return ESPACIO.test(prefijo) ? prefijo : null
}

/**
 * Calcula dónde y cómo insertar `property: value` en la regla. `null` = no se puede hacer con
 * seguridad, y entonces no se ofrece la capacidad.
 */
export function planCssInsertion(css: string, block: CssRuleBlock, property: EditableCssProperty, value: string): CssInsertion | null {
  const { blockStart, blockEnd } = block
  if (blockStart < 0 || blockEnd > css.length || blockEnd - blockStart < 2) return null
  if (css[blockStart] !== '{' || css[blockEnd - 1] !== '}') return null

  const interior = css.slice(blockStart + 1, blockEnd - 1)
  // Un comentario dentro del bloque se deja fuera del MVP: insertar antes o después cambiaría a
  // qué declaración parece referirse, y eso es justo el tipo de suposición que no queremos.
  if (interior.includes('/*')) return null

  const multilinea = interior.includes('\n')
  const saltoDeLinea = interior.includes('\r\n') ? '\r\n' : '\n'
  // Un archivo con saltos mezclados no se toca: no sabríamos cuál respetar.
  if (multilinea && interior.includes('\r\n') && /[^\r]\n/.test(interior)) return null

  const declaracion = `${property}: ${value};`
  const guard = { start: blockStart, end: blockEnd, text: css.slice(blockStart, blockEnd) }

  if (block.lastDeclarationEnd === undefined) {
    // Regla vacía. Solo se acepta si dentro no hay nada más que espacio en blanco.
    if (interior.trim() !== '') return null
    if (multilinea) {
      const indentacionRegla = indentacionEnLinea(css, block.ruleStart)
      if (indentacionRegla === null) return null
      return { offset: blockStart + 1, text: `${saltoDeLinea}${indentacionRegla}  ${declaracion}`, guard }
    }
    // Inline: `{}` necesita separar por ambos lados; `{ }` ya trae el espacio final.
    return { offset: blockStart + 1, text: interior === '' ? ` ${declaracion} ` : ` ${declaracion}`, guard }
  }

  const finDeclaracion = block.lastDeclarationEnd
  if (finDeclaracion < blockStart || finDeclaracion > blockEnd - 1) return null

  // Qué hay entre el final de la última declaración y el cierre del bloque. Se lee para dos
  // cosas: saber si ya existe el `;` y comprobar que ahí no hay nada más que espacio.
  const cola = css.slice(finDeclaracion, blockEnd - 1)
  const puntoYComa = cola.indexOf(';')
  const resto = puntoYComa === -1 ? cola : cola.slice(puntoYComa + 1)
  if (resto.trim() !== '') return null

  const offset = puntoYComa === -1 ? finDeclaracion : finDeclaracion + puntoYComa + 1
  const cierre = puntoYComa === -1 ? ';' : ''

  if (!multilinea) return { offset, text: `${cierre} ${declaracion}`, guard }

  const referencia = block.firstDeclarationStart ?? finDeclaracion
  const indentacion = indentacionEnLinea(css, referencia)
  if (indentacion === null) return null
  return { offset, text: `${cierre}${saltoDeLinea}${indentacion}${declaracion}`, guard }
}
