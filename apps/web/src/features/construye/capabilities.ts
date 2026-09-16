import { classifyEditableValue, type EditableCssProperty } from './cssEdits'
import type { CssRuleBlock } from './cssInsert'
import type { CssRelatedRuleInfo, SourceTextInfo } from './protocol'

/**
 * Paso 5.3 — qué propiedades se pueden INSERTAR cuando no existen, y bajo qué condición.
 * Es deliberadamente más corta que la lista de propiedades modificables:
 *
 * - `border-radius` y los dos colores se pueden insertar porque el valor sale de una política
 *   cerrada (un default documentado) o de un color que el estudiante nombró explícitamente.
 * - `font-size` NO se puede insertar: "más grande" exige saber el tamaño heredado, y eso
 *   requeriría un motor de cascada/computed style que este paso no autoriza. Antes que
 *   inventar un tamaño base, la capacidad no se ofrece.
 */
export const INSERTABLE_CSS_PROPERTIES: readonly EditableCssProperty[] = ['background-color', 'color', 'border-radius']

/**
 * CAPA B (Paso 5.2) — "qué se puede modificar de verdad sobre este elemento".
 *
 * El manifiesto es la frontera entre el mundo de la intención (lenguaje humano, y algún día un
 * LLM) y el motor determinístico. Contiene solo lo necesario para decidir qué pedir, y
 * deliberadamente NO contiene archivos, offsets ni selectores: la capa de intención elige una
 * capacidad por su ID opaco (`css-1`, `text-1`) y el motor es el único que sabe a qué rango
 * exacto corresponde ese ID. Así, una intención jamás puede apuntar a una posición del archivo
 * que ella misma haya inventado.
 */

export interface TextCapability {
  id: string
  kind: 'text'
  /** Lo que el estudiante VE (decodificado). */
  currentValue: string
}

export interface CssCapability {
  id: string
  kind: 'css'
  /** Paso 5.3: 'modify' cambia una declaración que ya existe; 'add' inserta una nueva en la
   * regla seleccionada. La capa de intención elige por ID; no decide cuál es cuál. */
  action: 'modify' | 'add'
  property: EditableCssProperty
  /** El valor tal como está escrito en styles.css. Ausente en una capacidad de inserción:
   * todavía no hay valor. */
  currentValue?: string
  /** Cuántos elementos comparten esta regla — se le advierte antes de confirmar. */
  affectedElements: number
  mediaText?: string
  mediaActive?: boolean
}

export type Capability = TextCapability | CssCapability

export interface CapabilityManifest {
  /** Identifica al elemento + versión de los archivos para los que se construyó. Un plan hecho
   * con otro contexto se rechaza (punto 20 del gate). */
  contextId: string
  element: { tag: string }
  capabilities: Capability[]
}

/** La otra mitad, PRIVADA: a qué apunta cada ID. Nunca sale de la capa determinística. */
export interface CapabilityTarget {
  id: string
  file: 'html' | 'css'
  /** Rango a sustituir. En una inserción no hay rango que sustituir, y va `undefined`. */
  range?: { start: number; end: number }
  /** Texto exacto que debe seguir estando en ese rango para poder escribir. */
  expected?: string
  property?: EditableCssProperty
  /** Paso 5.3: la regla donde insertar, con su estructura. Solo en capacidades de inserción. */
  block?: CssRuleBlock
  /** El selector, para poder decirle al estudiante en qué regla se va a insertar. Vive aquí —
   * no en el manifiesto— para mantener la frontera del Paso 5.2: lo que un intérprete llegue a
   * ver nunca incluye selectores, archivos ni rangos. */
  selector?: string
}

export interface CapabilityContext {
  manifest: CapabilityManifest
  targets: CapabilityTarget[]
  /** El CSS aplicado. Vive en el contexto PRIVADO (no en el manifiesto) porque hace falta para
   * calcular dónde y cómo insertar respetando el formato de la regla. */
  css: string
}

export interface CapabilitySource {
  tagName: string
  /** Texto simple editable del elemento (Paso 5.1), si lo tiene. */
  text?: SourceTextInfo
  /** Reglas CSS demostrablemente relacionadas (Paso 4.2), con sus declaraciones. */
  cssRelated: CssRelatedRuleInfo[]
  /** Paso 5.3: la regla que el estudiante eligió explícitamente en "Estilos relacionados", si
   * eligió alguna. Es la señal que desambigua dónde insertar cuando hay varias reglas. */
  selectedRuleStart?: number
  /** El CSS aplicado, para poder calcular inserciones respetando el formato local. */
  css: string
  /** Versión de los archivos aplicados: cambia el contextId cuando cambia el proyecto. */
  htmlLength: number
  cssLength: number
}

/**
 * Construye el manifiesto y su tabla de resolución.
 *
 * Regla importante sobre propiedades repetidas: si la MISMA propiedad aparece en más de una
 * declaración relacionada (p. ej. un `background-color` normal y otro dentro de una @media),
 * NO se ofrece ninguna de las dos. Construye no resuelve cascada —nunca lo ha hecho, desde el
 * Paso 4.2— así que elegir una sería afirmar cuál gana. Ante la duda, no se ofrece: la edición
 * manual de 5.0 sigue disponible para el caso en que el estudiante sepa cuál quiere tocar.
 */
export function buildCapabilityContext(source: CapabilitySource): CapabilityContext {
  const capabilities: Capability[] = []
  const targets: CapabilityTarget[] = []

  if (source.text) {
    const id = 'text-1'
    capabilities.push({ id, kind: 'text', currentValue: source.text.value })
    targets.push({ id, file: 'html', range: { start: source.text.start, end: source.text.end }, expected: source.text.source })
  }

  // Primero se recogen TODAS las declaraciones candidatas para poder detectar las repetidas.
  const candidatas = source.cssRelated.flatMap((rule) =>
    (rule.declarations ?? []).map((declaration) => ({ rule, declaration })),
  )
  const vecesPorPropiedad = new Map<string, number>()
  for (const { declaration } of candidatas) {
    const property = declaration.property.trim().toLowerCase()
    vecesPorPropiedad.set(property, (vecesPorPropiedad.get(property) ?? 0) + 1)
  }

  let indice = 0
  for (const { rule, declaration } of candidatas) {
    const property = declaration.property.trim().toLowerCase()
    if ((vecesPorPropiedad.get(property) ?? 0) > 1) continue // ambigua: no se ofrece
    // La autoridad sobre "esto se puede editar" sigue siendo la misma de 5.0: si el valor no
    // entra en su gramática segura (var(), shorthand, color con nombre…), no hay capacidad.
    const editable = classifyEditableValue(property, declaration.value)
    if (!editable) continue

    indice += 1
    const id = `css-${indice}`
    capabilities.push({
      id,
      kind: 'css',
      action: 'modify',
      property: editable.property,
      currentValue: declaration.value,
      affectedElements: rule.matchedCount ?? 0,
      mediaText: rule.mediaText,
      mediaActive: rule.mediaActive,
    })
    targets.push({
      id,
      file: 'css',
      range: { start: declaration.valueStart, end: declaration.valueEnd },
      expected: declaration.value,
      property: editable.property,
      selector: rule.selector,
    })
  }

  // Paso 5.3 — capacidades de INSERCIÓN. Solo sobre UNA regla inequívoca: la única relacionada,
  // o la que el estudiante eligió a mano en "Estilos relacionados". Con varias reglas y sin
  // elección explícita no se ofrece nada: elegir por especificidad o por "la que parece
  // adecuada" sería exactamente la clase de suposición que Construye no hace.
  const reglaParaInsertar = source.selectedRuleStart !== undefined
    ? source.cssRelated.find((rule) => rule.start === source.selectedRuleStart)
    : source.cssRelated.length === 1
      ? source.cssRelated[0]
      : undefined

  if (reglaParaInsertar) {
    const yaDeclaradas = new Set((reglaParaInsertar.declarations ?? []).map((d) => d.property.trim().toLowerCase()))
    const certificadas = (reglaParaInsertar.declarations ?? []).filter((d) => d.start !== undefined)
    for (const property of INSERTABLE_CSS_PROPERTIES) {
      // Si la propiedad ya existe en esa regla no se inserta una segunda, ni siquiera cuando su
      // valor actual no se puede modificar (var(), shorthand…): la propiedad ya está ahí.
      if (yaDeclaradas.has(property)) continue
      indice += 1
      const id = `css-add-${indice}`
      capabilities.push({
        id,
        kind: 'css',
        action: 'add',
        property,
        affectedElements: reglaParaInsertar.matchedCount ?? 0,
        mediaText: reglaParaInsertar.mediaText,
        mediaActive: reglaParaInsertar.mediaActive,
      })
      targets.push({
        id,
        file: 'css',
        property,
        selector: reglaParaInsertar.selector,
        block: {
          blockStart: reglaParaInsertar.blockStart ?? -1,
          blockEnd: reglaParaInsertar.blockEnd ?? -1,
          ruleStart: reglaParaInsertar.start,
          lastDeclarationEnd: reglaParaInsertar.lastDeclarationEnd,
          firstDeclarationStart: certificadas.length > 0 ? Math.min(...certificadas.map((d) => d.start as number)) : undefined,
        },
      })
    }
  }

  const contextId = [
    source.tagName,
    source.text ? `${source.text.start}-${source.text.end}` : 'sin-texto',
    targets.map((t) => `${t.id}:${t.range ? `${t.range.start}-${t.range.end}` : `b${t.block?.blockStart}-${t.block?.blockEnd}`}`).join(','),
    source.selectedRuleStart === undefined ? 'sin-regla' : `r${source.selectedRuleStart}`,
    `h${source.htmlLength}`,
    `c${source.cssLength}`,
  ].join('|')

  return { manifest: { contextId, element: { tag: source.tagName }, capabilities }, targets, css: source.css }
}

/** Busca la capacidad de una propiedad concreta, para que el intérprete pueda decir "quiero
 * cambiar el fondo" sin conocer IDs de antemano. Si esa propiedad se puede tanto modificar como
 * insertar, gana MODIFICAR: cambiar lo que el estudiante ya escribió siempre es preferible a
 * añadirle código nuevo. */
export function findCssCapability(manifest: CapabilityManifest, property: EditableCssProperty): CssCapability | undefined {
  const deEsaPropiedad = manifest.capabilities.filter((c): c is CssCapability => c.kind === 'css' && c.property === property)
  return deEsaPropiedad.find((c) => c.action === 'modify') ?? deEsaPropiedad[0]
}

export function findTextCapability(manifest: CapabilityManifest): TextCapability | undefined {
  return manifest.capabilities.find((c): c is TextCapability => c.kind === 'text')
}
