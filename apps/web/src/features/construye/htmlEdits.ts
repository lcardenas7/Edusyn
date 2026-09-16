import { replaceExactRange, type SourceRange } from './sourceEdits'

/**
 * "Cambiar texto" (Paso 5.1) — edición del contenido visible, sin IA y sin tocar estructura.
 *
 * La distinción que gobierna todo este archivo es la del punto 5 del gate: **texto que se ve**
 * vs. **texto que está escrito**. El estudiante ve `Tomás & Ana`; el archivo contiene
 * `Tomás &amp; Ana`. El runner entrega lo primero (ya decodificado por el parser) y aquí se
 * produce lo segundo antes de escribir. Nunca se escribe en el archivo lo que el estudiante
 * tecleó tal cual.
 *
 * Consecuencia de seguridad (punto 6): si teclea `Hola <script>alert(1)</script>`, eso NO puede
 * convertirse en un `<script>` real. Al escaparlo queda como texto visible. La edición de texto
 * no es una vía para insertar HTML, aunque el proyecto ya viva dentro del sandbox.
 */

/** Tope defensivo para el texto que se escribe en el archivo. */
const MAX_TEXT_LENGTH = 2_000

/**
 * Escape determinístico para contenido de un NODO DE TEXTO. `&` va primero, si no se
 * re-escaparían los `&` que uno mismo acaba de introducir. `<` es el que impide que aparezca
 * una etiqueta; `>` no es estrictamente necesario en este contexto, pero se escapa igual para
 * que el resultado no dependa de cómo se recupere un parser ante marcado a medias.
 */
export function escapeHtmlText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Normaliza lo que el estudiante escribió antes de escribirlo: colapsa cualquier espacio en
 * blanco (incluidos saltos de línea o tabulaciones pegados desde otro sitio) a un solo espacio
 * y recorta los extremos.
 *
 * No es cosmética: el criterio de "texto simple editable" exige que el nodo de texto NO tenga
 * espacio en blanco alrededor (ver `instrument.ts`). Si se escribiera texto con espacios en los
 * extremos, el elemento dejaría de ser editable en la siguiente selección. Además, el navegador
 * colapsa esos espacios al renderizar de todas formas, así que esto no cambia lo que se ve.
 *
 * `null` cuando no queda nada que escribir: un texto vacío dejaría al elemento sin contenido
 * que señalar y sin forma de volver a editarlo desde el preview.
 */
export function normalizeNewText(text: string): string | null {
  const normalizado = text.replace(/[\s ]+/g, ' ').trim()
  if (!normalizado || normalizado.length > MAX_TEXT_LENGTH) return null
  return normalizado
}

/** Texto listo para escribir en el archivo, o `null` si no hay nada válido que escribir.
 * Normaliza primero y escapa después: ese orden importa, porque el escape introduce `&` y `;`
 * que no deben volver a tocarse. */
export function prepareHtmlTextForSource(text: string): string | null {
  const normalizado = normalizeNewText(text)
  return normalizado === null ? null : escapeHtmlText(normalizado)
}

export interface HtmlTextEditResult {
  html: string
  /** Dónde quedó el texto NUEVO en el archivo, para poder mostrárselo al estudiante. */
  range: SourceRange
}

/**
 * Reemplazo atómico del nodo de texto. Usa la misma puerta de escritura que la edición de CSS
 * (`replaceExactRange`), así que hereda su contrato: se sustituye SOLO el tramo del texto y no
 * se toca ninguna etiqueta, atributo, comentario, indentación exterior ni ninguna otra
 * aparición del mismo texto en el archivo. Dos botones que digan "Comprar" tienen rangos
 * distintos; editar uno nunca afecta al otro.
 *
 * `expectedSourceText` es el texto tal como está ESCRITO en el archivo (con sus entidades), no
 * el que ve el estudiante: es lo que permite detectar que el archivo cambió desde la selección.
 */
export function replaceHtmlTextAtRange(html: string, range: SourceRange, expectedSourceText: string, newSourceText: string): HtmlTextEditResult | null {
  const resultado = replaceExactRange(html, range, expectedSourceText, newSourceText)
  return resultado ? { html: resultado.content, range: resultado.range } : null
}

/** Lo que la ficha pide cuando el estudiante confirma un cambio de texto. Viaja con el rango y
 * el texto esperado para que quien escriba pueda revalidar antes de tocar el archivo. */
export interface HtmlTextEditRequest {
  textStart: number
  textEnd: number
  /** El texto tal como está ESCRITO en el archivo (con sus entidades). Es contra esto que se
   * comprueba que nada cambió desde la selección — no contra el texto que se ve. */
  expectedSource: string
  /** Lo que el estudiante quiere que diga ahora (sin normalizar ni escapar todavía). */
  newText: string
}
