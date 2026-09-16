import { findCssCapability, findTextCapability, type CapabilityManifest } from './capabilities'
import type { EditableCssProperty } from './cssEdits'

/**
 * CAPA A (Paso 5.2) — de lenguaje humano a una INTENCIÓN ESTRUCTURADA.
 *
 * Este archivo es, a propósito, la pieza intercambiable de todo el paso: hoy lo resuelve un
 * intérprete local determinístico; el día que se conecte un LLM, lo único que cambia es quién
 * produce el `ModificationIntent`. Nada más de la cadena depende de cómo se haya interpretado
 * la frase, porque el contrato de salida es cerrado:
 *
 * - solo existen dos operaciones (SET_TEXT y SET_CSS_VALUE);
 * - una operación apunta a una capacidad por su ID OPACO, nunca a un archivo, un rango, un
 *   selector ni un fragmento de código;
 * - un valor CSS es o bien un color explícito, o bien "súbelo/bájalo" — nunca texto libre que
 *   acabe escrito tal cual en la hoja de estilos.
 *
 * Con ese contrato, una intención mal formada (o malintencionada) no tiene ninguna vía para
 * convertirse en código arbitrario: como mucho pedirá algo que el motor rechazará.
 */

export type CssValueIntent =
  | { mode: 'absolute'; value: string }
  | { mode: 'relative'; direction: 'increase' | 'decrease' }

export type ModificationOperation =
  | { kind: 'SET_TEXT'; capabilityId: string; value: string }
  | { kind: 'SET_CSS_VALUE'; capabilityId: string; value: CssValueIntent }
  /** Paso 5.3. Fíjate en lo que NO lleva: ni la propiedad, ni la regla, ni el punto de
   * inserción. El `capabilityId` YA representa "puedes añadir esta propiedad concreta en esta
   * regla concreta"; la intención solo aporta el valor deseado, y dentro de la misma gramática
   * cerrada que una modificación. */
  | { kind: 'INSERT_CSS_DECLARATION'; capabilityId: string; value: CssValueIntent }

export interface ModificationIntent {
  operations: ModificationOperation[]
  /** Lo que se entendió que el estudiante pedía pero Construye todavía no sabe hacer de forma
   * segura. Se le muestra tal cual, para que sepa qué quedó fuera y por qué (punto 8). */
  unsupported: string[]
}

/**
 * Paleta cerrada y documentada (punto 11). Deliberadamente pequeña: un LLM no debe "elegir un
 * tono bonito" — si el estudiante quiere otro azul, escribe el hex o usa el selector de color
 * del Paso 5.0. Tonos tomados de una escala de uso común, con contraste razonable.
 */
export const COLOR_VOCABULARY: Record<string, string> = {
  azul: '#2563eb', rojo: '#dc2626', verde: '#16a34a', amarillo: '#eab308',
  naranja: '#ea580c', morado: '#7c3aed', rosado: '#db2777', gris: '#6b7280',
  negro: '#000000', blanco: '#ffffff',
}

const HEX = /#([0-9a-f]{3}|[0-9a-f]{6})\b/i

/** Palabras que indican que el color va al TEXTO y no al fondo. Sin ninguna de ellas, un color
 * suelto ("hazlo azul") se entiende como color de fondo, que es lo que espera un estudiante
 * cuando habla de un botón o una tarjeta. */
const TEXTO_HINTS = /\b(texto|letra|letras|tipograf[ií]a|fuente)\b/i
const FONDO_HINTS = /\b(fondo|background)\b/i

const MAS = /\b(m[áa]s|aumenta|sube|agranda|agrandar|grande)\b/i
const MENOS = /\b(menos|reduce|baja|achica|achicar|peque[ñn]o|peque[ñn]a)\b/i
const REDONDEO = /\b(redonde\w*|esquina\w*|borde\w*\s+redonde\w*)\b/i

/** Frases que piden cambiar el contenido: "que diga X", "cambia el texto a X". */
const DICE = /\b(?:que\s+)?(?:diga|ponga|escriba|diciendo)\b\s*[:,]?\s*(.+)$/i
const TEXTO_A = /\b(?:cambia|cambiar|pon|poner)\b[^]*?\btexto\b\s*(?:a|por|:)\s*(.+)$/i
const ENTRECOMILLADO = /[«"“']([^«»"”']{1,200})[»"”']/

/**
 * Corta la petición en cláusulas independientes para poder responder de forma PARCIAL: cada
 * cláusula que no se entienda queda listada como "todavía no puedo", sin tumbar las que sí.
 *
 * El texto literal (lo que va después de "diga") se extrae ANTES de cortar, porque puede
 * contener comas o la palabra "y" y partirlo lo destrozaría. Limitación conocida y
 * documentada: un texto sin comillas se toma hasta el final de la frase.
 */
function separarClausulas(request: string): string[] {
  return request
    .split(/[,;.]+|\s+\by\b\s+|\s+\btambi[ée]n\b\s+/i)
    .map((parte) => parte.trim())
    .filter(Boolean)
}

function extraerTextoPedido(request: string): { value: string; resto: string } | null {
  const entrecomillado = request.match(ENTRECOMILLADO)
  if (entrecomillado && /\b(diga|texto|ponga|escriba)\b/i.test(request)) {
    return { value: entrecomillado[1].trim(), resto: request.replace(entrecomillado[0], ' ') }
  }
  for (const patron of [TEXTO_A, DICE]) {
    const match = request.match(patron)
    if (match && match[1].trim()) {
      return { value: match[1].trim(), resto: request.slice(0, match.index ?? 0) }
    }
  }
  return null
}

function colorDeClausula(clausula: string): string | null {
  const hex = clausula.match(HEX)
  if (hex) return hex[0].toLowerCase()
  for (const [palabra, valor] of Object.entries(COLOR_VOCABULARY)) {
    if (new RegExp(`\\b${palabra}s?\\b`, 'i').test(clausula)) return valor
  }
  return null
}

function operacionCss(manifest: CapabilityManifest, property: EditableCssProperty, value: CssValueIntent): ModificationOperation | null {
  const capability = findCssCapability(manifest, property)
  if (!capability) return null
  // Modificar o insertar lo decide la CAPACIDAD, no la frase: el intérprete nunca elige añadir
  // código por su cuenta.
  const kind = capability.action === 'add' ? 'INSERT_CSS_DECLARATION' : 'SET_CSS_VALUE'
  return { kind, capabilityId: capability.id, value }
}

/**
 * Traduce la petición del estudiante a operaciones sobre las capacidades REALES del elemento.
 * Si una cláusula se entiende pero el elemento no tiene esa capacidad (no existe la declaración
 * CSS, o el texto no es editable), no se inventa nada: se devuelve como "todavía no puedo".
 *
 * Es el contrato que un intérprete de IA deberá cumplir más adelante, con la misma firma.
 */
export function interpretIntent(request: string, manifest: CapabilityManifest): ModificationIntent {
  const operations: ModificationOperation[] = []
  const unsupported: string[] = []
  const texto = extraerTextoPedido(request)

  if (texto) {
    const capability = findTextCapability(manifest)
    if (capability) operations.push({ kind: 'SET_TEXT', capabilityId: capability.id, value: texto.value })
    else unsupported.push('cambiar el texto de este elemento')
  }

  for (const clausula of separarClausulas(texto ? texto.resto : request)) {
    const pideMas = MAS.test(clausula)
    const pideMenos = MENOS.test(clausula)
    const color = colorDeClausula(clausula)
    let reconocida = false

    if (REDONDEO.test(clausula) && (pideMas || pideMenos)) {
      reconocida = true
      const operacion = operacionCss(manifest, 'border-radius', { mode: 'relative', direction: pideMenos ? 'decrease' : 'increase' })
      if (operacion) operations.push(operacion)
      else unsupported.push('cambiar el redondeo de las esquinas de este elemento')
    } else if ((pideMas || pideMenos) && !color) {
      // "más grande" a secas se entiende como tamaño del texto porque es la ÚNICA capacidad de
      // tamaño certificada hoy. Si mañana hubiera otras (ancho, alto), esta regla tendría que
      // volverse explícita en vez de adivinar.
      reconocida = true
      const operacion = operacionCss(manifest, 'font-size', { mode: 'relative', direction: pideMenos ? 'decrease' : 'increase' })
      if (operacion) operations.push(operacion)
      else unsupported.push('cambiar el tamaño del texto de este elemento')
    } else if (color) {
      reconocida = true
      const property: EditableCssProperty = TEXTO_HINTS.test(clausula) && !FONDO_HINTS.test(clausula) ? 'color' : 'background-color'
      const operacion = operacionCss(manifest, property, { mode: 'absolute', value: color })
        // "hazlo azul" en un elemento sin fondo editable puede referirse al color del texto:
        // se intenta la otra propiedad antes de rendirse, pero nunca se inventa una declaración.
        ?? (property === 'background-color' && !FONDO_HINTS.test(clausula)
          ? operacionCss(manifest, 'color', { mode: 'absolute', value: color })
          : null)
      if (operacion) operations.push(operacion)
      else unsupported.push('cambiar ese color en este elemento')
    }

    if (!reconocida && clausula.length > 2) unsupported.push(clausula)
  }

  return { operations, unsupported }
}
