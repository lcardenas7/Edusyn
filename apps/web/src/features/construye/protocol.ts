export const CONSTRUYE_PROTOCOL_VERSION = 1 as const
export const MAX_PREVIEW_MESSAGE_BYTES = 8_000

export type PreviewEventType = 'ready' | 'runtime-error' | 'syntax-error' | 'resource-error' | 'preview-log' | 'element-picked' | 'code-position-status' | 'css-position-status'

/** Archivo que el estudiante está editando. Decide qué ruta usa el runner: 'html' el mapeo
 * estructural (Pasos 2-3) y 'css' el análisis de reglas (Paso 4.1). */
export type ConstruyeFileKind = 'html' | 'css'

/** Preview → Código (modo "Explorar"). "exact" es la única confianza que existe hoy — el
 * elemento coincide con un rango real de index.html, calculado por el runner con el parser
 * HTML5 real (parse5), nunca adivinado. "none" es la respuesta honesta cuando el elemento
 * clickeado no tiene una ubicación fuente confiable (creado por JS, o un nodo que el propio
 * parser insertó implícitamente) — nunca se inventa una relación para evitar decir "no sé". */
export type ElementPickStatus = 'exact' | 'none'

export interface PreviewEvent {
  protocol: typeof CONSTRUYE_PROTOCOL_VERSION
  instanceId: string
  type: PreviewEventType
  message?: string
  filename?: string
  line?: number
  status?: ElementPickStatus
  start?: number
  end?: number
  tagName?: string
  /** Paso 5.1: el texto del elemento cuando su contenido es inequívoco (un único nodo de
   * texto, sin estructura hija que se perdería). `start`/`end` son el tramo fuente exacto en
   * el `index.html` APLICADO y `value` es el texto YA DECODIFICADO (lo que se ve en pantalla,
   * no lo que está escrito en el archivo). Su ausencia significa "aquí no se puede cambiar el
   * texto" — nunca se deduce de otra forma. */
  text?: SourceTextInfo
  /** Solo en 'css-position-status' (Paso 4.1). `matchedCount` es el número REAL de elementos
   * que coinciden con el selector; `highlightedCount` puede ser menor si se aplicó el tope
   * visual del runner — nunca se le muestra al estudiante un conteo recortado. */
  matchedCount?: number
  highlightedCount?: number
  selector?: string
  property?: string
  /** Paso 4.3: el valor EXACTO que escribió el estudiante para `property` (p. ej. "12PX",
   * conservando mayúsculas/espacios) — solo presente cuando el cursor está dentro de una
   * declaración concreta, no solo dentro de la regla. */
  value?: string
  /** Paso 5.0: posición exacta de `value` dentro del `styles.css` APLICADO. Es lo único que
   * permite una edición visual segura: se reemplaza ese tramo y nada más, y solo si el texto
   * que hay ahí sigue siendo exactamente `value` (ver `cssEdits.ts`). Nunca se busca el valor
   * por texto ni se regenera la hoja. */
  valueStart?: number
  valueEnd?: number
  mediaText?: string
  mediaActive?: boolean
  /** Preview → CSS (Paso 4.2), solo en 'element-picked'. Reglas DEMOSTRABLEMENTE relacionadas
   * con el elemento que se acaba de clickear — independiente de si el HTML fue exacto o
   * 'none' (un nodo creado por JS puede no tener HTML fuente y aun así tener CSS relacionado).
   * `cssRelatedTotal` es el conteo real; `cssRelated` puede venir recortado por el runner. */
  cssRelated?: CssRelatedRuleInfo[]
  cssRelatedTotal?: number
  /** Paso 4.4 (contexto reactivo al viewport): presente y en `true` solo en un
   * 'element-picked' que es una REEVALUACIÓN automática tras un cambio de viewport
   * (Computador ⇄ Celular) para la MISMA selección vigente en el preview — nunca una nueva
   * elección del estudiante. El host lo usa para refrescar datos dependientes del viewport
   * (p. ej. `mediaActive` de `cssRelated`) sin repetir los efectos de una elección nueva
   * (cambiar de pestaña en el editor, saltar el cursor, replegar la lista de estilos). */
  reevaluated?: boolean
}

export interface SourceTextInfo {
  start: number
  end: number
  /** Texto decodificado: lo que el estudiante VE. */
  value: string
  /** Texto tal como está escrito en el archivo: contra esto se revalida antes de escribir. */
  source: string
}

/** El texto que llega del runner se valida como cualquier otro dato externo: o viene completo
 * y coherente, o el mensaje entero se rechaza. Nunca se "arregla" un rango a medias. */
function isValidSourceText(value: unknown): value is SourceTextInfo {
  if (!value || typeof value !== 'object') return false
  const t = value as Record<string, unknown>
  if (typeof t.start !== 'number' || !Number.isInteger(t.start) || t.start < 0) return false
  if (typeof t.end !== 'number' || !Number.isInteger(t.end) || t.end < t.start) return false
  if (typeof t.value !== 'string' || t.value.length > 2_000) return false
  if (typeof t.source !== 'string' || t.source.length > 4_000) return false
  if (t.source.length !== t.end - t.start) return false
  return true
}

/** Una regla relacionada con el elemento seleccionado en el preview. `start`/`end` son el
 * rango exacto de la regla en el `styles.css` APLICADO — lo que hace falta para navegar el
 * editor hasta ahí. */
export interface CssRelatedDeclarationInfo {
  property: string
  /** Valor tal como está escrito en styles.css, con su rango exacto. */
  value: string
  valueStart: number
  valueEnd: number
  /** Paso 5.3: rango de la declaración completa, para saber dónde insertar otra a continuación. */
  start?: number
  end?: number
}

export interface CssRelatedRuleInfo {
  selector: string
  start: number
  end: number
  mediaText?: string
  mediaActive?: boolean
  /** Paso 5.2: conteo demostrable de elementos que coinciden con la regla. */
  matchedCount?: number
  /** Paso 5.2: declaraciones editables de la regla, para poder construir el manifiesto de
   * capacidades de un elemento sin tener que ir a buscar nada al archivo. */
  declarations?: CssRelatedDeclarationInfo[]
  /** Paso 5.3: rango estructural del bloque `{...}` y datos de su última declaración, para
   * poder insertar una propiedad nueva sin buscar la llave de cierre por texto. */
  blockStart?: number
  blockEnd?: number
  declarationTotal?: number
  lastDeclarationEnd?: number
}

const EVENT_TYPES = new Set<PreviewEventType>(['ready', 'runtime-error', 'syntax-error', 'resource-error', 'preview-log', 'element-picked', 'code-position-status', 'css-position-status'])
const ELEMENT_PICK_STATUSES = new Set<ElementPickStatus>(['exact', 'none'])
const TAG_NAME_PATTERN = /^[a-z][a-z0-9-]{0,30}$/i

export function isPreviewEvent(value: unknown): value is PreviewEvent {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  if (data.protocol !== CONSTRUYE_PROTOCOL_VERSION) return false
  if (typeof data.instanceId !== 'string' || data.instanceId.length < 16 || data.instanceId.length > 128) return false
  if (typeof data.type !== 'string' || !EVENT_TYPES.has(data.type as PreviewEventType)) return false
  for (const key of ['message', 'filename']) {
    if (data[key] !== undefined && (typeof data[key] !== 'string' || data[key].length > 2_000)) return false
  }
  if (data.line !== undefined && (typeof data.line !== 'number' || !Number.isInteger(data.line) || data.line < 0 || data.line > 100_000)) return false
  if (data.type === 'css-position-status') {
    if (typeof data.status !== 'string' || !ELEMENT_PICK_STATUSES.has(data.status as ElementPickStatus)) return false
    if (typeof data.matchedCount !== 'number' || !Number.isInteger(data.matchedCount) || data.matchedCount < 0) return false
    if (data.highlightedCount !== undefined && (typeof data.highlightedCount !== 'number' || data.highlightedCount < 0)) return false
    for (const key of ['selector', 'property', 'value', 'mediaText']) {
      if (data[key] !== undefined && (typeof data[key] !== 'string' || data[key].length > 500)) return false
    }
    if (data.mediaActive !== undefined && typeof data.mediaActive !== 'boolean') return false
    // Paso 5.0: el rango del valor solo se acepta completo y coherente — un rango a medias o
    // invertido no se "arregla", se rechaza el mensaje entero.
    for (const key of ['valueStart', 'valueEnd']) {
      if (data[key] !== undefined && (typeof data[key] !== 'number' || !Number.isInteger(data[key]) || (data[key] as number) < 0)) return false
    }
    if ((data.valueStart === undefined) !== (data.valueEnd === undefined)) return false
    if (data.valueStart !== undefined && (data.valueEnd as number) < (data.valueStart as number)) return false
    return true
  }
  if (data.type === 'element-picked' || data.type === 'code-position-status') {
    if (typeof data.status !== 'string' || !ELEMENT_PICK_STATUSES.has(data.status as ElementPickStatus)) return false
    if (data.status === 'exact') {
      if (typeof data.start !== 'number' || !Number.isInteger(data.start) || data.start < 0) return false
      if (typeof data.end !== 'number' || !Number.isInteger(data.end) || data.end < data.start) return false
      if (typeof data.tagName !== 'string' || !TAG_NAME_PATTERN.test(data.tagName)) return false
    }
    // Paso 5.1: el texto editable viaja en los dos sentidos (clic en el preview y cursor en el
    // código), así que se valida una sola vez, aquí, para ambos tipos de mensaje.
    if (data.text !== undefined && !isValidSourceText(data.text)) return false
  }
  if (data.type === 'element-picked') {
    if (data.cssRelated !== undefined) {
      if (!isValidCssRelatedList(data.cssRelated)) return false
      if (data.cssRelatedTotal !== undefined && (typeof data.cssRelatedTotal !== 'number' || !Number.isInteger(data.cssRelatedTotal) || data.cssRelatedTotal < 0)) return false
    }
    if (data.reevaluated !== undefined && typeof data.reevaluated !== 'boolean') return false
  }
  return true
}

/** Preview → CSS (Paso 4.2): nunca se confía en la forma de un mensaje solo porque llegó del
 * runner — cada entrada se valida igual que cualquier otro dato externo. */
function isValidCssRelatedList(value: unknown): value is CssRelatedRuleInfo[] {
  if (!Array.isArray(value) || value.length > 200) return false
  return value.every((entry) => {
    if (!entry || typeof entry !== 'object') return false
    const r = entry as Record<string, unknown>
    if (typeof r.selector !== 'string' || r.selector.length > 500) return false
    if (typeof r.start !== 'number' || !Number.isInteger(r.start) || r.start < 0) return false
    if (typeof r.end !== 'number' || !Number.isInteger(r.end) || r.end < r.start) return false
    if (r.mediaText !== undefined && (typeof r.mediaText !== 'string' || r.mediaText.length > 500)) return false
    if (r.mediaActive !== undefined && typeof r.mediaActive !== 'boolean') return false
    if (r.matchedCount !== undefined && (typeof r.matchedCount !== 'number' || !Number.isInteger(r.matchedCount) || r.matchedCount < 0)) return false
    if (r.declarations !== undefined && !isValidDeclarationList(r.declarations)) return false
    // Paso 5.3: el rango del bloque solo se acepta completo y coherente.
    for (const key of ['blockStart', 'blockEnd', 'declarationTotal', 'lastDeclarationEnd']) {
      const v = r[key]
      if (v !== undefined && (typeof v !== 'number' || !Number.isInteger(v) || v < 0)) return false
    }
    if ((r.blockStart === undefined) !== (r.blockEnd === undefined)) return false
    if (r.blockStart !== undefined && (r.blockEnd as number) <= (r.blockStart as number)) return false
    return true
  })
}

/** Paso 5.2: las declaraciones habilitan una edición, así que se validan con la misma dureza
 * que todo lo demás — rango completo y coherente con el valor que dice contener. */
function isValidDeclarationList(value: unknown): value is CssRelatedDeclarationInfo[] {
  if (!Array.isArray(value) || value.length > 50) return false
  return value.every((entry) => {
    if (!entry || typeof entry !== 'object') return false
    const d = entry as Record<string, unknown>
    if (typeof d.property !== 'string' || d.property.length > 100) return false
    if (typeof d.value !== 'string' || d.value.length > 500) return false
    if (typeof d.valueStart !== 'number' || !Number.isInteger(d.valueStart) || d.valueStart < 0) return false
    if (typeof d.valueEnd !== 'number' || !Number.isInteger(d.valueEnd) || d.valueEnd < d.valueStart) return false
    if (d.value.length !== d.valueEnd - d.valueStart) return false
    return true
  })
}

export function fitsPreviewMessageLimit(value: unknown): boolean {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength <= MAX_PREVIEW_MESSAGE_BYTES
  } catch {
    return false
  }
}

export interface PreviewProject { html: string; css: string; js: string }

/**
 * Decide si un mensaje entrante del preview merece confianza. Un iframe sandboxed sin
 * allow-same-origin reporta origin "null", así que la identidad se prueba con
 * event.source (debe ser exactamente la ventana del iframe activo) y con el instanceId
 * de un solo uso (invalida mensajes de un preview anterior tras reiniciar o recargar).
 */
export function isTrustedPreviewMessage(
  message: { source: unknown; data: unknown },
  expectedSource: unknown,
  expectedInstanceId: string,
): message is { source: unknown; data: PreviewEvent } {
  if (message.source !== expectedSource) return false
  if (!fitsPreviewMessageLimit(message.data) || !isPreviewEvent(message.data)) return false
  return message.data.instanceId === expectedInstanceId
}

/** Único mensaje que el host puede enviar al preview. Nunca debe llevar JWT, cookies,
 * datos de usuario ni de institución: solo el código estático del proyecto. */
export function buildLoadProjectMessage(instanceId: string, project: PreviewProject) {
  return { protocol: CONSTRUYE_PROTOCOL_VERSION, instanceId, type: 'load-project' as const, project }
}

/** Enciende/apaga el modo "Explorar" (Preview → Código) en el runner. */
export function buildSetExploreModeMessage(instanceId: string, enabled: boolean) {
  return { protocol: CONSTRUYE_PROTOCOL_VERSION, instanceId, type: 'set-explore-mode' as const, enabled }
}

/** Código → Preview: informa al runner la posición actual del cursor/selección del editor,
 * para que resalte (y opcionalmente centre) el elemento correspondiente. `range: null` pide
 * dejar de resaltar — se usa al cambiar de pestaña, al desactivar Explorar, o cuando el HTML
 * del editor ya no corresponde al que el preview tiene renderizado (ver `clampElementPickRange`
 * y la regla de "borradores no aplicados"). */
export function buildHighlightCodePositionMessage(
  instanceId: string,
  range: { start: number; end: number; explicit: boolean } | null,
  file: ConstruyeFileKind = 'html',
) {
  return { protocol: CONSTRUYE_PROTOCOL_VERSION, instanceId, type: 'highlight-code-position' as const, range, file }
}

/** Un rango de `element-picked` es "confiable" para el editor solo si además cae dentro de
 * los límites del `index.html` que el editor tiene ahora mismo — nunca se confía en el
 * número ciegamente, ni siquiera viniendo ya validado por `isPreviewEvent`. Devuelve `null`
 * en vez de recortar el rango: un rango fuera de límites indica un desajuste (p. ej. el
 * estudiante editó el archivo después de aplicar la versión que el preview muestra), no
 * algo que debamos adivinar cómo arreglar. */
export function clampElementPickRange(event: PreviewEvent, currentHtmlLength: number): { start: number; end: number } | null {
  if (event.status !== 'exact' || event.start === undefined || event.end === undefined) return null
  if (event.start < 0 || event.end > currentHtmlLength || event.start > event.end) return null
  return { start: event.start, end: event.end }
}

/** Preview → CSS (Paso 4.2): antes de navegar el editor a una regla, comprueba que su rango
 * sigue cabiendo en el `styles.css` ACTUALMENTE aplicado — igual que clampElementPickRange
 * para HTML. El estudiante pudo editar/aplicar una versión distinta entre el clic en el
 * preview y el momento en que elige "ver esta regla"; nunca se navega a una posición que ya
 * no corresponde a lo que el preview está mostrando. */
export function clampCssRuleRange(range: { start: number; end: number }, currentCssLength: number): { start: number; end: number } | null {
  if (range.start < 0 || range.end > currentCssLength || range.start > range.end) return null
  return { start: range.start, end: range.end }
}

/**
 * Paso 4.2/4.4: si el archivo que el estudiante tiene abierto en el editor no coincide con lo
 * que el preview tiene APLICADO, ninguna posición calculada contra ese archivo es confiable —
 * ni para resaltar en el preview (Paso 3/4.1), ni para lo que un cambio de viewport pueda
 * reevaluar después (Paso 4.4). Un borrador sin aplicar nunca debe analizarse como si lo
 * estuviera: mientras esta función devuelva `false`, el host no envía ninguna posición al
 * runner, así que no queda ningún `lastCssRange` vigente que un cambio de viewport pudiera
 * reevaluar por error (ver `main.ts` del runner).
 */
export function fileTracksAppliedProject(file: ConstruyeFileKind, htmlInSync: boolean, cssInSync: boolean): boolean {
  return file === 'html' ? htmlInSync : cssInSync
}
