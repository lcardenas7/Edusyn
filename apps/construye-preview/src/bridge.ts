export type Project = { html: string; css: string; js: string }

/** El estudiante controla css/js: si su texto contiene "</style" o "</script" literalmente
 * (p. ej. dentro de un string), cerraría antes de tiempo el elemento que lo envuelve y el
 * resto se interpretaría como marcado en vez de CSS/JS. No es una fuga del sandbox — el
 * código ya se ejecuta con las mismas libertades en ese origen aislado — pero corrompe el
 * documento sin avisar. Se escapa igual que cualquier inserción de texto no confiable
 * dentro de un elemento de texto crudo. */
export function escapeRawTextClose(text: string, tag: 'script' | 'style'): string {
  return text.replace(new RegExp('</(' + tag + ')', 'gi'), '<\\/$1')
}

export interface LoadProjectMessage {
  protocol: number
  instanceId: string
  type: 'load-project'
  project: Project
}

/** Activa/desactiva el modo "Explorar" (Preview → Código). Ver `explore.ts`. */
export interface SetExploreModeMessage {
  protocol: number
  instanceId: string
  type: 'set-explore-mode'
  enabled: boolean
}

/** Código → Preview: la posición actual del cursor/selección en el editor. `range: null`
 * significa "deja de resaltar" (el host cambió de pestaña, hay cambios sin aplicar, o ya no
 * hay una posición que mapear) — nunca se manda un rango a medias. `explicit` distingue una
 * acción deliberada (clic, selección de texto) de un simple movimiento de cursor. Ver
 * `explore.ts` → `showCodePosition`/`hideCodePosition`. */
export interface HighlightCodePositionMessage {
  protocol: number
  instanceId: string
  type: 'highlight-code-position'
  range: { start: number; end: number; explicit: boolean } | null
  /** Qué archivo está editando el estudiante. Son dos rutas paralelas: 'html' usa el mapeo
   * estructural de instrument.ts y 'css' el análisis de styles.ts. Ausente = 'html', para que
   * un host anterior al Paso 4.1 siga comportándose igual. */
  file?: 'html' | 'css'
}

function isProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false
  const data = value as Record<string, unknown>
  return typeof data.html === 'string' && typeof data.css === 'string' && typeof data.js === 'string'
}

/**
 * Comprobaciones comunes a todo mensaje que dice venir del host: el origen de este
 * documento es opaco ("null"), así que no puede exigir un origen propio; en su lugar exige
 * que el remitente sea exactamente la ventana padre indicada al cargar (event.source) y que
 * su origin declarado coincida con el que la URL de arranque recibió como parámetro
 * `parent`, además del protocolo y el instanceId de esta sesión. Devuelve el `data` del
 * mensaje sin tipar más — cada tipo de mensaje concreto valida su propia forma encima.
 */
function trustedHostEnvelope(
  message: { source: unknown; origin: string; data: unknown },
  expectedParentWindow: unknown,
  expectedParentOrigin: string,
  protocol: number,
  instanceId: string,
): Record<string, unknown> | undefined {
  if (!expectedParentOrigin || !instanceId) return undefined
  if (message.source !== expectedParentWindow || message.origin !== expectedParentOrigin) return undefined
  const data = message.data
  if (!data || typeof data !== 'object') return undefined
  const record = data as Record<string, unknown>
  if (record.protocol !== protocol || record.instanceId !== instanceId) return undefined
  return record
}

/**
 * Decide si un mensaje entrante merece confianza dentro del runner sandboxed. Solo acepta
 * el mensaje load-project, con el protocolo y el instanceId de esta sesión, y con un
 * proyecto compuesto solo por texto estático.
 */
export function isTrustedLoadProjectMessage(
  message: { source: unknown; origin: string; data: unknown },
  expectedParentWindow: unknown,
  expectedParentOrigin: string,
  protocol: number,
  instanceId: string,
): message is { source: unknown; origin: string; data: LoadProjectMessage } {
  const record = trustedHostEnvelope(message, expectedParentWindow, expectedParentOrigin, protocol, instanceId)
  if (!record || record.type !== 'load-project') return false
  return isProject(record.project)
}

/** Valida el mensaje que activa/desactiva "Explorar". Mismo patrón que load-project: sin
 * esto, cualquier ventana podría intentar prender el modo exploración del preview de otro. */
export function isTrustedSetExploreModeMessage(
  message: { source: unknown; origin: string; data: unknown },
  expectedParentWindow: unknown,
  expectedParentOrigin: string,
  protocol: number,
  instanceId: string,
): message is { source: unknown; origin: string; data: SetExploreModeMessage } {
  const record = trustedHostEnvelope(message, expectedParentWindow, expectedParentOrigin, protocol, instanceId)
  if (!record || record.type !== 'set-explore-mode') return false
  return typeof record.enabled === 'boolean'
}

function isValidCodeRange(value: unknown): value is { start: number; end: number; explicit: boolean } {
  if (!value || typeof value !== 'object') return false
  const range = value as Record<string, unknown>
  return (
    typeof range.start === 'number' && Number.isInteger(range.start) && range.start >= 0 &&
    typeof range.end === 'number' && Number.isInteger(range.end) && range.end >= range.start &&
    typeof range.explicit === 'boolean'
  )
}

/** Valida el mensaje de "Código → Preview". Mismo patrón que los anteriores: aunque el host
 * es la parte "de confianza" del sistema, el runner nunca asume que un mensaje con la forma
 * correcta llegó realmente del host solo porque lo dice — vuelve a comprobar protocolo,
 * instanceId, ventana y origen, y además valida que `range` (cuando no es null) tenga
 * offsets no negativos y coherentes antes de dejar que `explore.ts` los use. */
export function isTrustedHighlightCodePositionMessage(
  message: { source: unknown; origin: string; data: unknown },
  expectedParentWindow: unknown,
  expectedParentOrigin: string,
  protocol: number,
  instanceId: string,
): message is { source: unknown; origin: string; data: HighlightCodePositionMessage } {
  const record = trustedHostEnvelope(message, expectedParentWindow, expectedParentOrigin, protocol, instanceId)
  if (!record || record.type !== 'highlight-code-position') return false
  if (record.file !== undefined && record.file !== 'html' && record.file !== 'css') return false
  return record.range === null || isValidCodeRange(record.range)
}
