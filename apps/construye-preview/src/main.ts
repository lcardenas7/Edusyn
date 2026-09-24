import { escapeRawTextClose, isTrustedHighlightCodePositionMessage, isTrustedLoadProjectMessage, isTrustedSetExploreModeMessage, type Project } from './bridge'
import { createExploreController, type ExploreRange } from './explore'
import { instrumentHtml } from './instrument'
import { removeInlinedAssetReferences } from './virtualAssets'
import { evaluateCssPosition, findCssRulesForElement, MAX_RELATED_CSS_RULES, parseCssRules, type CssRuleRange } from './styles'

const protocol = 1
const params = new URLSearchParams(window.location.search)
const instanceId = params.get('instance') || ''
const parentOrigin = params.get('parent') || ''

function send(type: string, payload: Record<string, unknown> = {}) {
  if (!instanceId || !parentOrigin) return
  window.parent.postMessage({ protocol, instanceId, type, ...payload }, parentOrigin)
}

// Rangos de la última instrumentación — a qué parte de index.html corresponde cada
// data-edusyn-id. Se llenan una sola vez por instancia, cuando llega el único load-project
// que este runner recibirá (ver comentario en render()).
let ranges: ExploreRange[] = []
let exploreController: ReturnType<typeof createExploreController> | null = null
// Reglas del CSS APLICADO (el mismo que está pintando el preview), con sus posiciones en el
// texto que el estudiante ve en el editor. Se analiza el CSS original, no el escapado: los
// offsets deben corresponder al archivo del editor. `currentCss` se conserva aparte para
// poder recortar el VALOR exacto de una declaración (Paso 4.3) sin volver a parsear.
let cssRules: CssRuleRange[] = []
let currentCss = ''
// Paso 4.4 (contexto reactivo al viewport): el último rango de CSS consultado por
// highlight-code-position (ruta 'css'), para poder repetir EXACTAMENTE la misma consulta
// cuando cambia el viewport — nunca se vuelve a analizar el CSS ni se reinstrumenta nada,
// solo se reevalúa la MISMA posición contra el CSSOM/matchMedia actuales. `null` cuando no
// hay ninguna posición CSS vigente (el editor está en otra pestaña, o pidió dejar de
// resaltar) — no hay nada que reevaluar en ese caso.
let lastCssRange: { start: number; end: number } | null = null

/** Evalúa `range` contra el CSS/documento actuales y envía `css-position-status` — la misma
 * operación que antes vivía inline en el handler de `highlight-code-position`, ahora también
 * reutilizable desde `onViewportResize` para reevaluar sin reinstrumentar (Paso 4.4). */
function reportCssPosition(range: { start: number; end: number }) {
  if (!exploreController) return
  const evaluation = evaluateCssPosition(document, cssRules, currentCss, range)
  if (evaluation.status !== 'exact') {
    exploreController.hideCssMatches()
    send('css-position-status', { status: 'none', matchedCount: 0 })
    return
  }
  const resaltados = exploreController.showCssMatches(evaluation.elements)
  send('css-position-status', {
    status: 'exact',
    matchedCount: evaluation.matchedCount,
    highlightedCount: resaltados,
    selector: evaluation.selector,
    property: evaluation.property,
    value: evaluation.value,
    valueStart: evaluation.valueStart,
    valueEnd: evaluation.valueEnd,
    mediaText: evaluation.mediaText,
    mediaActive: evaluation.mediaActive,
  })
}

// Paso 4.4: cambiar el viewport (Computador ⇄ Celular) solo cambia, desde el host, el tamaño
// CSS de ESTE iframe — nunca su src, su key ni su instanceId (ver PreviewFrame.tsx). Eso
// significa que esta ventana (la del propio runner) recibe un evento "resize" nativo del
// navegador exactamente cuando termina de aplicar el nuevo tamaño de su viewport — es la
// misma señal que usaría cualquier página responsive, y por eso matchMedia() ya refleja el
// tamaño nuevo cuando este handler se ejecuta: no hace falta ningún mensaje nuevo del host
// pidiendo "reevalúa", ni ningún setTimeout arbitrario (punto 13 del gate).
//
// Se escuchan DOS señales reales para el mismo cambio — "resize" de esta ventana y un
// ResizeObserver sobre el propio <html> — en vez de depender de una sola: ambas están atadas
// al mismo paso del navegador (layout ya actualizado), así que nunca se disparan con un
// tamaño viejo, pero cubren la una a la otra si algún motor entrega una y no la otra (mismo
// patrón que ya usa PreviewFrame.tsx en el host con ResizeObserver). El `requestAnimationFrame`
// agrupa cualquier ráfaga (una o dos señales del mismo cambio, o varios "resize" seguidos) en
// una sola reevaluación: nunca una tormenta de mensajes (punto 12).
let viewportReevalScheduled = false
function onViewportResize() {
  if (viewportReevalScheduled) return
  viewportReevalScheduled = true
  requestAnimationFrame(() => {
    viewportReevalScheduled = false
    if (!exploreController || !exploreController.isEnabled()) return
    // CSS → Preview (Paso 4.1/4.3): repite la última consulta de posición, si hay una vigente.
    if (lastCssRange) reportCssPosition(lastCssRange)
    // Preview → CSS (Paso 4.2): refresca las reglas relacionadas del elemento ya seleccionado,
    // con la MISMA identidad — nunca una selección nueva (ver explore.ts).
    exploreController.reevaluateSelection()
  })
}

/** El sandbox no concede un origen propio, así que `localStorage` lanza SecurityError y las apps
 * que guardan datos (listas, puntajes, preferencias) se rompían. Se reemplaza por una memoria
 * con la misma API que vive mientras dure esta ejecución de la vista previa: la app funciona
 * igual, y el archivo descargado o instalado usa el almacenamiento real del navegador. */
function createMemoryStorage(): Storage {
  const data = new Map<string, string>()
  const storage = {
    get length() { return data.size },
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    getItem: (key: string) => (data.has(String(key)) ? data.get(String(key))! : null),
    setItem: (key: string, value: unknown) => { data.set(String(key), String(value)) },
    removeItem: (key: string) => { data.delete(String(key)) },
    clear: () => { data.clear() },
  }
  return storage as Storage
}

function installMemoryStorage() {
  for (const name of ['localStorage', 'sessionStorage'] as const) {
    try { Object.defineProperty(window, name, { configurable: true, enumerable: true, value: createMemoryStorage() }) } catch { /* sin memoria: la app verá el error de siempre */ }
  }
}

function render(project: Project) {
  const instrumented = instrumentHtml(project.html)
  ranges = instrumented.ranges
  cssRules = parseCssRules(project.css)
  currentCss = project.css

  // El listener de errores debe vivir en el documento del estudiante: `document.open()`
  // cancela el script Vite que inició el runner y puede disparar un error sobre ESE script.
  // Escucharlo desde el shell del runner producía una falsa alerta de recurso no cargado en
  // cada preview. Este puente se instala antes del HTML del proyecto, por lo que sí observa
  // imágenes, CSS y scripts que el estudiante haya incluido de verdad.
  const bridge = '<script>window.addEventListener("error",function(e){var t=e.target;if(t instanceof HTMLImageElement||t instanceof HTMLScriptElement||t instanceof HTMLLinkElement){window.parent.postMessage({protocol:1,instanceId:' +
    JSON.stringify(instanceId) + ',type:"resource-error",message:"Un recurso no pudo cargarse.",filename:t.src||t.href},' +
    JSON.stringify(parentOrigin) + ');return}window.parent.postMessage({protocol:1,instanceId:' +
    JSON.stringify(instanceId) + ',type:"runtime-error",message:e.message||"La app encontró un error mientras se ejecutaba.",filename:e.filename||undefined,line:e.lineno||undefined},' +
    JSON.stringify(parentOrigin) + ')},true);window.addEventListener("unhandledrejection",function(e){window.parent.postMessage({protocol:1,instanceId:' +
    JSON.stringify(instanceId) + ',type:"runtime-error",message:e.reason instanceof Error?e.reason.message:"La app no pudo completar una acción."},' +
    JSON.stringify(parentOrigin) + ')})</script>'
  const documentHtml = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
    escapeRawTextClose(project.css, 'style') + '</style></head><body>' + bridge + removeInlinedAssetReferences(instrumented.html) + '<script>' + escapeRawTextClose(project.js, 'script') + '</script></body></html>'
  document.open()
  installMemoryStorage()
  document.write(documentHtml)
  document.close()

  // HALLAZGO (ver bitácora): document.open()/write() desregistra TODOS los listeners que
  // hubiera en window/document — es la misma razón por la que `bridge` de arriba tiene que
  // volver a registrar su propio listener de "error" en vez de confiar en el de más abajo.
  // Hasta ahora nunca importó para "message": el runner jamás necesitaba recibir nada del
  // host DESPUÉS de renderizar. "Explorar" es la primera función que sí lo necesita, así que
  // hay que volver a registrar el listener de mensajes aquí, en el documento ya escrito.
  window.addEventListener('message', onHostMessage)
  // Paso 4.4: ver el comentario junto a `onViewportResize` — el "resize" de esta MISMA ventana
  // y el ResizeObserver sobre <html> son dos señales reales de que el host terminó de cambiar
  // el tamaño del iframe; cualquiera de las dos dispara la misma reevaluación coalescida.
  window.addEventListener('resize', onViewportResize)
  new ResizeObserver(onViewportResize).observe(document.documentElement)

  exploreController = createExploreController(document, () => ranges, (outcome, target, reevaluated) => {
    // Preview → CSS (Paso 4.2): se calcula sobre el elemento crudo, no sobre `target` de
    // `findTarget` — así un nodo sin data-edusyn-id (creado por JS) puede seguir reportando
    // estilos relacionados aunque su HTML sea 'none'. `total` es el conteo real ANTES de
    // recortar, para nunca mostrarle al estudiante un número menor al que existe de verdad.
    // Se recalcula siempre en el momento (nunca se cachea), así que una reevaluación tras un
    // cambio de viewport (Paso 4.4) refleja el matchMedia/DOM actuales sin ningún caso especial.
    const allMatches = target ? findCssRulesForElement(document, cssRules, target, currentCss) : []
    send('element-picked', {
      ...outcome,
      cssRelated: allMatches.slice(0, MAX_RELATED_CSS_RULES),
      cssRelatedTotal: allMatches.length,
      reevaluated,
    })
  })
}

function onHostMessage(event: MessageEvent<unknown>) {
  if (isTrustedLoadProjectMessage(event, window.parent, parentOrigin, protocol, instanceId)) {
    render(event.data.project)
    return
  }
  if (isTrustedSetExploreModeMessage(event, window.parent, parentOrigin, protocol, instanceId)) {
    if (!exploreController) return // llegó antes de que hubiera algo que explorar
    if (event.data.enabled) exploreController.enable()
    else exploreController.disable()
    return
  }
  if (isTrustedHighlightCodePositionMessage(event, window.parent, parentOrigin, protocol, instanceId)) {
    if (!exploreController) return // llegó antes de que hubiera algo que explorar
    const { range, file } = event.data
    if (!range) {
      // Paso 4.4: sin posición vigente no hay nada que reevaluar en un futuro cambio de
      // viewport — evita repetir una consulta CSS obsoleta si el estudiante cambió de pestaña.
      lastCssRange = null
      exploreController.hideCodePosition()
      exploreController.hideCssMatches()
      return
    }

    if (file === 'css') {
      // Ruta CSS (Paso 4.1), separada de la de HTML para no fragilizar el Paso 3.
      exploreController.hideCodePosition()
      lastCssRange = { start: range.start, end: range.end }
      reportCssPosition(lastCssRange)
      return
    }

    // Paso 4.4: la ruta HTML no depende del viewport (ver PreviewFrame.tsx/CodeWorkspace.tsx),
    // así que no hay una posición CSS vigente mientras el editor esté en esta pestaña.
    lastCssRange = null

    // Misma respuesta que un clic en el preview (element-picked), pero bajo otro nombre: el
    // host la usa solo para reflejar el estado ("Elemento: h1" / "sin coincidencia"), nunca
    // para volver a seleccionar nada en el editor — eso evitaría un bucle mientras se escribe.
    exploreController.hideCssMatches()
    send('code-position-status', exploreController.showCodePosition(range.start, range.end, range.explicit))
  }
}

window.addEventListener('message', onHostMessage)
send('ready')
