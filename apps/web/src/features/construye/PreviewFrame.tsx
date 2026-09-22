import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, HelpCircle, Loader2, Maximize2, Minimize2, Monitor, MousePointer2, Palette, Pencil, RotateCcw, ShieldCheck, Smartphone, Sparkles, ZoomIn, ZoomOut } from 'lucide-react'
import { explainCssDeclaration } from './cssProperties'
import { classifyEditableValue, describeEditImpact, describeEditMediaWarning, editableControlLabel, formatColorValue, formatLengthValue, type CssValueEditRequest } from './cssEdits'
import { normalizeNewText, type HtmlTextEditRequest } from './htmlEdits'
import { buildCapabilityContext } from './capabilities'
import { interpretIntent } from './intent'
import { buildPlan, type ModificationPlan } from './plan'
import type { SourceTextInfo } from './protocol'
import { describeCssMatch, describeCssRelatedCount, describeCssRuleAvailability, getElementExplanation } from './explanations'
import { buildHighlightCodePositionMessage, buildLoadProjectMessage, buildSetExploreModeMessage, isTrustedPreviewMessage, type ConstruyeFileKind, type CssRelatedRuleInfo, type PreviewEvent, type PreviewProject } from './protocol'
import { computeViewportScale, VIEWPORT_PRESETS, type ViewportKey } from './viewports'

/** Código → Preview: lo que el editor le pide al preview que resalte ahora mismo.
 * `explicit` distingue una acción deliberada (clic/selección) de un simple movimiento de
 * cursor — solo la primera centra el elemento en el preview (ver explore.ts). */
export interface CodePosition { start: number; end: number; explicit: boolean }

export type { PreviewProject }
const MAX_PROJECT_BYTES = 500_000

const DEMO_PROJECT: PreviewProject = {
  html: '<main><h1>Mi colegio recicla</h1><p>Elige un residuo y comprueba tu respuesta.</p><label><input type="radio" name="residuo" value="plástico"> Botella plástica</label><button id="comprobar">Comprobar</button><p id="resultado"></p></main>',
  css: 'body{font-family:system-ui,sans-serif;background:#effcf5;color:#102b26;margin:0;padding:32px;font-size:16px}main{background:white;border-radius:20px;max-width:420px;margin:auto;padding:24px;box-shadow:0 12px 30px #0d5c3d22}h1{font-size:20px;margin:0 0 8px}button{display:block;margin-top:20px;background:#087f5b;color:white;border:0;border-radius:10px;padding:12px 16px;font-size:15px;font-weight:700}',
  js: 'document.querySelector("#comprobar").addEventListener("click", () => { const selected = document.querySelector(\'input[name="residuo"]:checked\'); document.querySelector("#resultado").textContent = selected.value === "plástico" ? "Correcto" : "Intenta otra vez"; });',
}

// allow-forms: sin él Chrome no dispara ni siquiera el evento "submit", y cualquier app con
// formulario (agregar una tarea, enviar una respuesta) parece rota. Es seguro: la CSP del runner
// lleva form-action 'none', así que un envío real sigue bloqueado aunque el estudiante olvide
// preventDefault(). Nunca allow-same-origin: esa es la barrera que aísla el código del estudiante.
const PREVIEW_SANDBOX = 'allow-scripts allow-forms'

function describePreviewProblem(event: PreviewEvent): string {
  if (event.type === 'resource-error') return 'La página pide un archivo o imagen que no está dentro del proyecto.'
  if (event.type === 'syntax-error') return 'El JavaScript tiene un error de escritura y no pudo ejecutarse.'
  return 'El JavaScript encontró un error mientras se ejecutaba.'
}

function newInstanceId(): string { return crypto.getRandomValues(new Uint32Array(4)).join('-') }

function createRepairPrompt(event: PreviewEvent | null): string {
  return [
    'Estoy construyendo una app escolar estática con HTML, CSS y JavaScript.',
    'Error detectado: ' + (event?.message || 'No se recibió un error concreto.'),
    'Corrige solamente el archivo JavaScript necesario. No uses librerías, red, APIs, cuentas, secretos ni URLs externas. Devuelve únicamente el archivo completo.',
  ].join('\n')
}

export interface PreviewFrameProps {
  project?: PreviewProject
  onHelpRequested?: () => void
  /** Pantalla que representa el preview. Cambia solo el tamaño con el que se renderiza el
   * MISMO documento — nunca lo recarga ni lo reconstruye (ver comentario en el render). */
  viewport?: ViewportKey
  /** Permite cambiar de pantalla desde la vista grande, donde la barra del taller queda oculta. */
  onViewportChange?: (viewport: ViewportKey) => void
  /** Vista grande controlada desde fuera (el taller pone el botón junto a Computador/Celular).
   * Sin esto, el propio preview muestra su botón "Ver en grande". */
  focused?: boolean
  onFocusedChange?: (focused: boolean) => void
  /** Sin la ficha de diagnóstico ni el encabezado: solo el iframe, para incrustar en un
   * marco propio (p. ej. la vista de celular del docente). El aislamiento no cambia. */
  compact?: boolean
  /** Revisión a pantalla completa (docente): solo la app, escalada en proporción, con
   * Celular/Computador, Reiniciar y Cerrar. En un celular ocupa la pantalla como instalada. */
  review?: boolean
  reviewTitle?: string
  onClose?: () => void
  /** Dentro del taller tipo editor por bloques: encabezado mínimo y sin marco propio; los
   * controles de pantalla viven en la barra del taller. */
  studio?: boolean
  /** Modo "Explorar" (Preview → Código): al pasar el mouse resalta el elemento y al hacer
   * clic se intercepta la navegación y se reporta el elemento vía onElementPicked. */
  exploreMode?: boolean
  /** Un elemento del preview fue clickeado en modo Explorar. `event` trae status
   * 'exact' (con start/end/tagName) o 'none' — nunca se inventa una correspondencia. */
  onElementPicked?: (event: PreviewEvent) => void
  /** Código → Preview: posición actual del cursor/selección en el editor, o `null` para
   * dejar de resaltar (cambio de pestaña, Explorar apagado, cambios de HTML sin aplicar). */
  codePosition?: CodePosition | null
  /** Archivo al que pertenece `codePosition`: decide si el runner usa el mapeo HTML o el
   * análisis de reglas CSS. */
  codeFile?: ConstruyeFileKind
  /** Preview → CSS (Paso 4.2): el estudiante eligió una de las reglas relacionadas con el
   * último elemento clickeado — llevar el editor hasta ese rango de styles.css. */
  onNavigateToCssRule?: (range: { start: number; end: number }) => void
  /** Paso 5.0: el estudiante confirmó un cambio de valor desde la ficha. Quien recibe esto es
   * el dueño del archivo (CodeWorkspace): revalida el rango y escribe en styles.css. Sin este
   * callback no se ofrece ningún control de edición — la ficha queda solo explicativa. */
  onEditCssValue?: (edit: CssValueEditRequest) => void
  /** Paso 5.1: el estudiante confirmó un nuevo texto desde la ficha. Igual que con el CSS,
   * quien escribe es el dueño del archivo (CodeWorkspace). Sin este callback no se ofrece
   * ningún control de texto. */
  onEditHtmlText?: (edit: HtmlTextEditRequest) => boolean
  /** Paso 5.2: el estudiante confirmó un plan de modificación. El plan ya viene resuelto a
   * rangos por el motor determinístico; quien escribe sigue siendo el dueño de los archivos,
   * que además revalida todo otra vez antes de tocar nada. */
  onApplyPlan?: (plan: ModificationPlan, currentContextId: string) => boolean
}

const INITIAL_CSS_RELATED_VISIBLE = 3

/**
 * Paso 5.2: "Ayúdame a modificarlo". La ficha nunca ejecuta nada por su cuenta: interpreta,
 * construye un plan, lo MUESTRA y espera confirmación. El estudiante ve qué cambia, de qué a
 * qué, a cuántos elementos alcanza y qué parte de lo que pidió todavía no es posible.
 *
 * El padre le pasa una `key` ligada al elemento seleccionado, así que elegir otro elemento
 * descarta el plan anterior por construcción (punto 19).
 */
function IntentCard({ context, onApply }: { context: ReturnType<typeof buildCapabilityContext>; onApply: (plan: ModificationPlan, currentContextId: string) => boolean }) {
  const [abierto, setAbierto] = useState(false)
  const [peticion, setPeticion] = useState('')
  const [plan, setPlan] = useState<ModificationPlan | null>(null)

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100">
        <Sparkles className="h-3.5 w-3.5" /> Ayúdame a modificarlo
      </button>
    )
  }

  const cerrar = () => { setAbierto(false); setPeticion(''); setPlan(null) }

  return (
    <div className="mt-2 rounded-lg border border-violet-200 bg-white p-3">
      {!plan ? (
        <>
          <label className="block text-xs font-bold text-violet-900">
            ¿Qué quieres cambiar?
            <input
              type="text"
              value={peticion}
              onChange={(changeEvent) => setPeticion(changeEvent.target.value)}
              placeholder="Quiero que sea azul y diga Comenzar"
              className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 font-sans text-sm font-normal text-slate-800"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={!peticion.trim()} onClick={() => setPlan(buildPlan(context, interpretIntent(peticion, context.manifest)))} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300">
              Preparar cambios
            </button>
            <button type="button" onClick={cerrar} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
          </div>
        </>
      ) : (
        <>
          {plan.operations.length > 0 && <p className="text-xs font-bold text-violet-900">Entendí que quieres:</p>}
          <ul className="mt-1 space-y-1.5">
            {plan.operations.map((operation) => (
              <li key={operation.capabilityId} className="text-xs text-slate-700">
                <span className="font-semibold text-slate-800">✓ {operation.label}</span>
                <span className="mt-0.5 block font-mono text-[11px] text-slate-600">{operation.before} → <span className="font-bold text-violet-800">{operation.after}</span></span>
                <span className="block text-[11px] text-slate-500">
                  {/* En una inserción se dice en qué regla se añadirá: es código del propio
                      estudiante, y saberlo es parte de entender qué va a cambiar. */}
                  {operation.inserts && operation.selector ? `Se agregará en la regla ${operation.selector}. ` : ''}
                  {operation.affectedElements === 1 ? 'Afectará este elemento.' : `Afectará ${operation.affectedElements} elementos.`}
                  {operation.mediaNote ? ` ${operation.mediaNote}` : ''}
                </span>
              </li>
            ))}
          </ul>
          {plan.unsupported.length > 0 && (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2">
              <p className="text-[11px] font-semibold text-amber-900">Todavía no puedo hacer de forma segura:</p>
              <ul className="mt-0.5 list-inside list-disc text-[11px] text-amber-800">
                {plan.unsupported.map((motivo, indice) => <li key={indice}>{motivo}</li>)}
              </ul>
            </div>
          )}
          {plan.operations.length === 0 && (
            <p className="text-xs text-slate-600">Por ahora puedo ayudarte a cambiar el texto, los colores, el tamaño del texto y las esquinas de este elemento.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {/* Se envía el contexto VIGENTE (no el que guardó el plan): si el elemento o la
                versión del proyecto cambiaron desde que se preparó, el motor lo rechaza. */}
            {plan.operations.length > 0 && (
              <button type="button" onClick={() => { if (onApply(plan, context.manifest.contextId)) cerrar() }} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700">
                Aplicar cambios
              </button>
            )}
            <button type="button" onClick={() => setPlan(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Volver a escribir</button>
            <button type="button" onClick={cerrar} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Esto preparará cambios en tu código. Después pulsa “Aplicar al preview” para verlos.</p>
        </>
      )}
    </div>
  )
}

/**
 * Paso 5.1: "Cambiar texto". Una sola implementación para los dos caminos por los que el
 * estudiante puede llegar a un texto — clic en el preview o cursor en index.html — porque
 * ambos reciben el MISMO `text` del runner. Solo aparece cuando el runner demostró que el
 * contenido del elemento es un texto simple e inequívoco; si no, aquí no se renderiza nada.
 *
 * El padre le pasa una `key` derivada del texto señalado, así que al señalar otro elemento el
 * control se reinicia solo (React lo vuelve a montar) en vez de arrastrar lo que el estudiante
 * llevara escrito para otro elemento.
 */
function TextChangeCard({ text, onEdit }: { text: SourceTextInfo; onEdit: (edit: HtmlTextEditRequest) => boolean }) {
  const [abierto, setAbierto] = useState(false)
  const [nuevoTexto, setNuevoTexto] = useState(text.value)
  // Lo que realmente se escribiría: `null` si no queda nada válido (vacío o solo espacios).
  const listo = normalizeNewText(nuevoTexto)

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
        <Pencil className="h-3.5 w-3.5" /> Cambiar texto
      </button>
    )
  }

  return (
    <div className="mt-2 rounded-lg border border-indigo-200 bg-white p-3">
      <p className="text-xs font-bold text-indigo-900">Texto actual</p>
      <p className="mt-0.5 break-words font-mono text-xs text-slate-600">{text.value}</p>
      <label className="mt-2 block text-xs font-bold text-indigo-900">
        Nuevo texto
        <input
          type="text"
          value={nuevoTexto}
          onChange={(changeEvent) => setNuevoTexto(changeEvent.target.value)}
          className="mt-1 block w-full rounded border border-slate-300 px-2 py-1 font-sans text-sm font-normal text-slate-800"
        />
      </label>
      <p className="mt-2 text-xs text-slate-500">Este cambio afectará este elemento.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!listo || listo === text.value}
          // Si el cambio se rechaza (código desincronizado o rango obsoleto), el control se
          // queda abierto con lo que el estudiante escribió: perder su texto además de no poder
          // aplicarlo sería castigarlo dos veces por algo que no hizo mal.
          onClick={() => { if (onEdit({ textStart: text.start, textEnd: text.end, expectedSource: text.source, newText: nuevoTexto })) setAbierto(false) }}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Confirmar cambio
        </button>
        <button type="button" onClick={() => { setAbierto(false); setNuevoTexto(text.value) }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          Cancelar
        </button>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">Esto cambiará el código en index.html. Después pulsa “Aplicar al preview” para verlo.</p>
    </div>
  )
}

// Grosor del marco de celular (px en pantalla, no se escala): el iframe conserva su viewport
// lógico de 390 px y el marco se dibuja alrededor.
const DEVICE_FRAME_X = 24
const DEVICE_FRAME_Y = 56
const BROWSER_BAR_Y = 34
const SCALE_LABEL_Y = 28
// Por debajo de este ancho la guía pasa debajo de la vista: a su lado dejaba el preview de un
// portátil en un tercio del panel.
const SIDE_GUIDE_MIN_WIDTH = 900

export default function PreviewFrame({ project = DEMO_PROJECT, onHelpRequested, viewport = 'desktop', onViewportChange, focused: focusedProp, onFocusedChange, compact = false, review = false, reviewTitle, onClose, studio = false, exploreMode = false, onElementPicked, codePosition = null, codeFile = 'html', onNavigateToCssRule, onEditCssValue, onEditHtmlText, onApplyPlan }: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const viewportShellRef = useRef<HTMLDivElement>(null)
  const [viewportScale, setViewportScale] = useState(1)
  // Vista grande: el MISMO iframe pasa a ocupar la pantalla solo cambiando clases, sin
  // desmontarse — la app del estudiante conserva su estado (tareas agregadas, etc.).
  const [focusedInternal, setFocusedInternal] = useState(false)
  const focused = focusedProp ?? focusedInternal
  const setFocused = (next: boolean) => { if (onFocusedChange) onFocusedChange(next); else setFocusedInternal(next) }
  // En la vista grande: "fit" encoge el dispositivo hasta que quepa entero; "real" lo muestra
  // a su tamaño lógico (nunca más grande) y se desplaza para verlo completo.
  const [focusZoom, setFocusZoom] = useState<'fit' | 'real'>('fit')
  const rootRef = useRef<HTMLElement>(null)
  const [sideGuide, setSideGuide] = useState(false)
  // En un celular la revisión muestra la app a su ancho real, sin marco ni escala.
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639px)').matches)
  useEffect(() => {
    if (!review || !window.matchMedia) return
    const query = window.matchMedia('(max-width: 639px)')
    const update = () => setNarrow(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [review])
  const preset = VIEWPORT_PRESETS[viewport]
  const [instanceId, setInstanceId] = useState(newInstanceId)
  const [ready, setReady] = useState(false)
  const [event, setEvent] = useState<PreviewEvent | null>(null)
  const [copied, setCopied] = useState(false)
  // "¿Qué es esto?" (Preview → Código): el último elemento exacto clickeado, para la ficha
  // pedagógica. Se limpia si no hubo correspondencia, al recargar el proyecto o al salir de
  // Explorar — nunca se deja una explicación de un elemento que ya no es "el actual".
  const [lastPick, setLastPick] = useState<PreviewEvent | null>(null)
  // Código → Preview: el eco del runner sobre la última posición de cursor consultada — solo
  // para reflejar "sin coincidencia" con honestidad, nunca para reseleccionar nada en el editor.
  const [codeStatus, setCodeStatus] = useState<PreviewEvent | null>(null)
  // Paso 4.1: resultado de la última regla CSS consultada (cuántos elementos y si su @media
  // está activa en este viewport). Separado de codeStatus para no mezclar las dos rutas.
  const [cssStatus, setCssStatus] = useState<PreviewEvent | null>(null)
  // Paso 4.2 (Preview → CSS): reglas relacionadas con el ÚLTIMO elemento clickeado en el
  // preview. Independiente de `lastPick` (que solo guarda el caso HTML exacto) porque un
  // elemento sin HTML determinable (creado por JS) puede seguir teniendo CSS relacionado.
  const [lastCssRelated, setLastCssRelated] = useState<CssRelatedRuleInfo[]>([])
  const [lastCssRelatedTotal, setLastCssRelatedTotal] = useState(0)
  const [visibleCssRelated, setVisibleCssRelated] = useState(INITIAL_CSS_RELATED_VISIBLE)
  // Paso 5.0: el control de edición está cerrado por defecto — la ficha sigue siendo primero
  // una explicación, no un formulario. `valorElegido` guarda lo que el estudiante lleva
  // elegido pero AÚN NO confirmado; mientras tanto no se ha tocado ningún archivo.
  const [editorAbierto, setEditorAbierto] = useState(false)
  const [valorElegido, setValorElegido] = useState<string | null>(null)
  // Paso 5.3: qué regla de "Estilos relacionados" abrió el estudiante. Se guarda por su offset
  // de inicio (identidad estable dentro del CSS aplicado) y se olvida al elegir otro elemento.
  const [reglaElegida, setReglaElegida] = useState<number | null>(null)
  const projectKey = useMemo(() => JSON.stringify(project), [project])
  const loadedProjectKey = useRef(projectKey)
  const previewOrigin = import.meta.env.VITE_CONSTRUYE_PREVIEW_ORIGIN || (import.meta.env.DEV ? 'http://localhost:5174' : '')
  const src = useMemo(() => previewOrigin
    ? previewOrigin + '/?instance=' + encodeURIComponent(instanceId) + '&parent=' + encodeURIComponent(window.location.origin)
    : '', [previewOrigin, instanceId])
  const projectTooLarge = new TextEncoder().encode(projectKey).byteLength > MAX_PROJECT_BYTES

  // El runner escribe el proyecto con document.write y por diseño no conserva su
  // listener. Cada aplicación aplicada recibe un runner nuevo, aislado y efímero.
  useEffect(() => {
    if (loadedProjectKey.current === projectKey) return
    loadedProjectKey.current = projectKey
    setReady(false)
    setEvent(null)
    setLastPick(null)
    setCodeStatus(null)
    setLastCssRelated([])
    setLastCssRelatedTotal(0)
    setInstanceId(newInstanceId())
  }, [projectKey])

  useEffect(() => {
    const onMessage = (messageEvent: MessageEvent<unknown>) => {
      if (!isTrustedPreviewMessage(messageEvent, iframeRef.current?.contentWindow, instanceId)) return
      const incoming = messageEvent.data
      if (incoming.type === 'ready') {
        setReady(true)
        if (!projectTooLarge) iframeRef.current?.contentWindow?.postMessage(buildLoadProjectMessage(instanceId, project), '*')
        return
      }
      if (incoming.type === 'element-picked') {
        setLastPick(incoming.status === 'exact' ? incoming : null)
        // Independiente del status HTML: un elemento creado por JS puede ser 'none' en HTML
        // y aun así tener estilos CSS demostrablemente relacionados (Paso 4.2, punto 19).
        setLastCssRelated(incoming.cssRelated ?? [])
        setLastCssRelatedTotal(incoming.cssRelatedTotal ?? incoming.cssRelated?.length ?? 0)
        // Elegir otro elemento descarta la regla que se hubiera abierto para el anterior: esa
        // elección era contexto de AQUEL elemento, no una preferencia permanente.
        if (!incoming.reevaluated) setReglaElegida(null)
        // Paso 4.4: una reevaluación automática (cambio de viewport) refresca los datos de
        // ARRIBA con la MISMA identidad de elemento — pero no es una elección nueva, así que
        // no debe replegar una lista que el estudiante ya expandió ("Ver todos") ni disparar
        // los efectos de "acabo de elegir algo" (saltar de pestaña en el editor, mover el
        // cursor, hacer scroll) que sí corresponden a un clic real en el preview.
        if (!incoming.reevaluated) {
          setVisibleCssRelated(INITIAL_CSS_RELATED_VISIBLE)
          onElementPicked?.(incoming)
        }
        return
      }
      if (incoming.type === 'code-position-status') {
        setCodeStatus(incoming)
        return
      }
      if (incoming.type === 'css-position-status') {
        setCssStatus(incoming)
        return
      }
      setEvent(incoming)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [instanceId, project, projectTooLarge, onElementPicked])

  // El runner solo aprende a filtrar clics una vez que "ready" ya montó el controlador de
  // Explorar (ver comentario en apps/construye-preview/src/main.ts). Reenviar el mensaje
  // cada vez que cambia exploreMode/ready/instanceId cubre encender, apagar y "quedó
  // pegado" tras un reinicio del preview (nueva instancia siempre nace apagada).
  useEffect(() => {
    if (!ready) return
    iframeRef.current?.contentWindow?.postMessage(buildSetExploreModeMessage(instanceId, exploreMode), '*')
    if (!exploreMode) { setLastPick(null); setCodeStatus(null); setCssStatus(null); setLastCssRelated([]); setLastCssRelatedTotal(0) }
  }, [ready, exploreMode, instanceId])

  // Código → Preview: se reenvía cada vez que el editor reporta una nueva posición (o pide
  // dejar de resaltar con `null`). El editor ya decide cuándo NO enviar nada (pestaña
  // distinta de html, Explorar apagado, cambios sin aplicar) — aquí solo se transmite.
  useEffect(() => {
    if (!ready) return
    iframeRef.current?.contentWindow?.postMessage(buildHighlightCodePositionMessage(instanceId, codePosition, codeFile), '*')
    if (!codePosition) { setCodeStatus(null); setCssStatus(null) }
    // Cambiar de archivo limpia el estado de la ruta que se abandona, para que no quede
    // colgado un mensaje de CSS mientras se edita HTML (ni al revés).
    if (codeFile === 'css') setCodeStatus(null)
    else setCssStatus(null)
  }, [ready, codePosition, codeFile, instanceId])

  // El viewport lógico es fijo; lo que se adapta es cuánto se reduce visualmente para caber
  // en el panel. Se mide el contenedor real (no la ventana) porque el ancho disponible
  // depende de la disposición que elija el taller para cada viewport.
  useEffect(() => {
    const shell = viewportShellRef.current
    if (!shell) return
    // Se descuenta el relleno del contenedor y el marco del dispositivo: medir clientWidth a
    // secas hacía que el preview fuera más ancho que su espacio y quedara recortado.
    const update = () => {
      const style = window.getComputedStyle(shell)
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
      const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      const frameX = viewport === 'mobile' ? DEVICE_FRAME_X : 0
      const frameY = viewport === 'mobile' ? DEVICE_FRAME_Y : BROWSER_BAR_Y
      const width = shell.clientWidth - padX - frameX
      const fitHeight = (focused && focusZoom === 'fit') || review
      const height = fitHeight ? shell.clientHeight - padY - frameY - SCALE_LABEL_Y : undefined
      setViewportScale(computeViewportScale(width, preset.width, height, fitHeight ? preset.height : undefined))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(shell)
    return () => observer.disconnect()
  }, [preset.width, preset.height, viewport, focused, focusZoom, review, narrow])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const update = () => setSideGuide(root.clientWidth >= SIDE_GUIDE_MIN_WIDTH)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!review) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow }
  }, [review, onClose])

  useEffect(() => {
    if (!focused) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setFocused(false) }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow }
  }, [focused])

  const viewportLabel = preset.label === 'Escritorio' ? 'Computador' : 'Celular'

  const cssResumen = cssStatus
    ? describeCssMatch({
        status: cssStatus.status === 'exact' ? 'exact' : 'none',
        matchedCount: cssStatus.matchedCount ?? 0,
        mediaText: cssStatus.mediaText,
        mediaActive: cssStatus.mediaActive,
        viewportLabel,
      })
    : null

  // Paso 4.3: solo hay "¿qué significa este código?" cuando el cursor está dentro de una
  // DECLARACIÓN concreta (cssStatus.property/value presentes) — con el cursor solo dentro de
  // la regla, se conserva el mensaje relacional del Paso 4.1 (cssResumen) sin más. Si la
  // propiedad no está en el diccionario o el valor no es explicable con seguridad,
  // `explainCssDeclaration` devuelve null y el mensaje relacional sigue siendo el único texto.
  const declaracionExplicada = cssStatus?.status === 'exact' && cssStatus.property && cssStatus.value !== undefined
    ? explainCssDeclaration(cssStatus.property, cssStatus.value, {
        matchedCount: cssStatus.matchedCount,
        mediaText: cssStatus.mediaText,
        mediaActive: cssStatus.mediaActive,
        viewportLabel,
      })
    : null

  // Paso 5.0: qué se puede editar aquí, si es que algo. `null` = solo explicación (valor
  // complejo, shorthand, color con nombre, propiedad fuera del MVP, o un rango que el runner
  // no pudo reportar): nunca se ofrece un control que no sepamos escribir con seguridad.
  const declaracionEditable = onEditCssValue && cssStatus?.status === 'exact' && cssStatus.property && cssStatus.value !== undefined && cssStatus.valueStart !== undefined && cssStatus.valueEnd !== undefined
    ? classifyEditableValue(cssStatus.property, cssStatus.value)
    : null

  // Identidad de la declaración señalada. Cambia solo cuando el estudiante señala OTRA
  // declaración — no cuando el Paso 4.4 reevalúa la misma por un cambio de viewport, para que
  // un control abierto no se cierre solo al alternar Computador/Celular.
  const declaracionKey = declaracionEditable && cssStatus ? `${cssStatus.selector}|${cssStatus.property}|${cssStatus.valueStart}` : null
  useEffect(() => { setEditorAbierto(false); setValorElegido(null) }, [declaracionKey])

  // El valor que se escribiría AHORA MISMO si el estudiante confirmara. `null` = todavía no
  // hay nada válido que escribir (campo vacío, número fuera de rango), y el botón se deshabilita.
  const valorNuevo = !declaracionEditable ? null
    : declaracionEditable.kind === 'color'
      ? formatColorValue(valorElegido ?? declaracionEditable.swatch)
      : formatLengthValue(valorElegido === null ? declaracionEditable.amount : (valorElegido.trim() === '' ? NaN : Number(valorElegido)), declaracionEditable.unit)

  const confirmarEdicion = () => {
    if (!declaracionEditable || !valorNuevo) return
    if (!cssStatus?.property || cssStatus.value === undefined || cssStatus.valueStart === undefined || cssStatus.valueEnd === undefined) return
    onEditCssValue?.({ valueStart: cssStatus.valueStart, valueEnd: cssStatus.valueEnd, expectedValue: cssStatus.value, newValue: valorNuevo, property: cssStatus.property })
    setEditorAbierto(false)
    setValorElegido(null)
  }

  // Paso 5.2: el manifiesto de capacidades del elemento seleccionado. Se arma con lo que ya
  // demostraron los pasos anteriores (texto simple de 5.1 + reglas relacionadas de 4.2) — no
  // consulta nada nuevo ni analiza el proyecto por su cuenta.
  const capabilityContext = useMemo(() => {
    if (!onApplyPlan || lastPick?.status !== 'exact' || !lastPick.tagName) return null
    return buildCapabilityContext({
      tagName: lastPick.tagName,
      text: lastPick.text,
      cssRelated: lastCssRelated,
      // Paso 5.3: la regla que el estudiante abrió a mano desde "Estilos relacionados". Es la
      // única señal que autoriza insertar cuando hay varias reglas relacionadas.
      selectedRuleStart: reglaElegida ?? undefined,
      css: project.css,
      htmlLength: project.html.length,
      cssLength: project.css.length,
    })
  }, [onApplyPlan, lastPick, lastCssRelated, reglaElegida, project])

  const restart = () => { setReady(false); setEvent(null); setLastPick(null); setCodeStatus(null); setCssStatus(null); setLastCssRelated([]); setLastCssRelatedTotal(0); setInstanceId(newInstanceId()) }
  const copyRepairContext = async () => {
    await navigator.clipboard.writeText(createRepairPrompt(event))
    setCopied(true)
    onHelpRequested?.()
    window.setTimeout(() => setCopied(false), 2_000)
  }

  if (!previewOrigin) {
    if (compact) return <div className="flex h-full items-center justify-center bg-slate-100 p-3 text-center text-[11px] text-slate-500">Falta configurar el origen del preview.</div>
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      Configura <code className="font-mono">VITE_CONSTRUYE_PREVIEW_ORIGIN</code> con el origen aislado del preview antes de habilitar Edusyn Crea.
    </div>
  }

  if (review) {
    const phoneFrame = viewport === 'mobile' && !narrow
    return (
      <div role="dialog" aria-modal="true" aria-label={reviewTitle ? `Revisar: ${reviewTitle}` : 'Revisar la app'} className="fixed inset-0 z-[60] flex flex-col bg-slate-900">
        <header className="flex items-center gap-2 px-3 py-2 text-white">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{reviewTitle || 'App del equipo'}</p>
          {!narrow && onViewportChange && <div className="inline-flex overflow-hidden rounded-lg bg-white/10" role="group" aria-label="Cómo verla">
            <button type="button" onClick={() => onViewportChange('mobile')} aria-pressed={viewport === 'mobile'} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${viewport === 'mobile' ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-white/10'}`}><Smartphone className="h-3.5 w-3.5" /> Celular</button>
            <button type="button" onClick={() => onViewportChange('desktop')} aria-pressed={viewport === 'desktop'} className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${viewport === 'desktop' ? 'bg-white text-slate-900' : 'text-slate-200 hover:bg-white/10'}`}><Monitor className="h-3.5 w-3.5" /> Computador</button>
          </div>}
          <button type="button" onClick={restart} title="Reiniciar la app" aria-label="Reiniciar la app" className="rounded-lg p-2 text-slate-200 hover:bg-white/10"><RotateCcw className="h-4 w-4" /></button>
          <button type="button" onClick={onClose} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-100">Cerrar</button>
        </header>
        <div ref={viewportShellRef} className={`relative min-h-0 flex-1 ${narrow ? '' : 'flex items-center justify-center overflow-hidden p-4'}`}>
          {narrow
            ? <iframe ref={iframeRef} title="Preview aislado de Edusyn Crea" src={src} sandbox={PREVIEW_SANDBOX} className="h-full w-full border-0 bg-white" />
            : <div className={phoneFrame ? 'relative rounded-[40px] bg-black px-3 py-7 ring-1 ring-slate-700' : 'overflow-hidden rounded-xl'}>
              <div className={`overflow-hidden bg-white ${phoneFrame ? 'rounded-[18px]' : ''}`} style={{ width: preset.width * viewportScale, height: preset.height * viewportScale }}>
                <iframe ref={iframeRef} title="Preview aislado de Edusyn Crea" src={src} sandbox={PREVIEW_SANDBOX} className="border-0" style={{ width: preset.width, height: preset.height, transform: `scale(${viewportScale})`, transformOrigin: 'top left' }} />
              </div>
            </div>}
          {!ready && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-white" /></div>}
          {ready && event && <div className="absolute inset-x-3 bottom-3 rounded-lg bg-amber-900/95 px-3 py-2 text-center text-xs font-medium text-white">{describePreviewProblem(event)}</div>}
        </div>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-slate-100">
        <iframe ref={iframeRef} title="Preview aislado de Edusyn Crea" src={src} sandbox={PREVIEW_SANDBOX} className="h-full w-full border-0" />
        {!ready && <div className="absolute inset-0 flex items-center justify-center bg-slate-100/90"><Loader2 className="h-5 w-5 animate-spin text-indigo-600" /></div>}
        {ready && event && <div className="absolute inset-x-2 bottom-2 rounded-lg bg-amber-900/95 px-2 py-1.5 text-center text-[11px] font-medium text-white">Encontramos algo para revisar</div>}
      </div>
    )
  }

  return (
    <section ref={rootRef} className={focused
      ? 'fixed inset-0 z-[60] flex flex-col bg-white'
      : studio ? 'bg-white' : 'overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-lg shadow-slate-900/5'}>
      {studio && !focused && <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">{ready ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />} Vista previa protegida</span>
        <button type="button" onClick={restart} title="Reiniciar la prueba" aria-label="Reiniciar la prueba" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"><RotateCcw className="h-4 w-4" /></button>
      </div>}
      <header className={`${studio && !focused ? 'hidden' : 'flex'} flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3.5`}>
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><ShieldCheck className="h-4 w-4" /></span>
          <div><h2 className="font-bold text-slate-900">Así está quedando</h2><p className="text-xs text-slate-500">Vista previa protegida · sin acceso a datos de Edusyn</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {focused && onViewportChange && (
            <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-slate-50" role="group" aria-label="Cómo ver el proyecto">
              <button type="button" onClick={() => onViewportChange('desktop')} aria-pressed={viewport === 'desktop'} className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold ${viewport === 'desktop' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:bg-white'}`}><Monitor className="h-3.5 w-3.5" /> Computador</button>
              <button type="button" onClick={() => onViewportChange('mobile')} aria-pressed={viewport === 'mobile'} className={`inline-flex items-center gap-1.5 border-l border-slate-200 px-3 py-2 text-xs font-semibold ${viewport === 'mobile' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:bg-white'}`}><Smartphone className="h-3.5 w-3.5" /> Celular</button>
            </div>
          )}
          {focused && (
            <button type="button" onClick={() => setFocusZoom(z => z === 'fit' ? 'real' : 'fit')} title={focusZoom === 'fit' ? 'Ver al tamaño real del dispositivo' : 'Encoger hasta que quepa en la pantalla'} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              {focusZoom === 'fit' ? <><ZoomIn className="h-3.5 w-3.5" /> Tamaño real</> : <><ZoomOut className="h-3.5 w-3.5" /> Ajustar a pantalla</>}
            </button>
          )}
          <button type="button" onClick={restart} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><RotateCcw className="h-3.5 w-3.5" /> Reiniciar prueba</button>
          {(focused || !onFocusedChange) && <button type="button" onClick={() => setFocused(!focused)} title={focused ? 'Volver al taller (Esc)' : 'Ver la app en grande, sin el editor'} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${focused ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-cyan-600 text-white hover:bg-cyan-700'}`}>
            {focused ? <><Minimize2 className="h-3.5 w-3.5" /> Volver al taller</> : <><Maximize2 className="h-3.5 w-3.5" /> Ver en grande</>}
          </button>}
        </div>
      </header>
      <div className={`grid gap-4 ${studio && !focused ? 'bg-slate-50 p-3' : 'bg-[#f8fafb] p-3 sm:p-4'} ${sideGuide ? 'grid-cols-[minmax(0,1fr)_300px]' : ''} ${focused ? 'min-h-0 flex-1 overflow-auto' : ''}`}>
        {/* El iframe se renderiza SIEMPRE a las dimensiones lógicas del preset y solo se
            encoge visualmente con transform: scale. Cambiar de viewport toca únicamente
            estilos del host: mismo src, misma key, mismo instanceId, ningún remount — por eso
            el documento, su JavaScript y la instrumentación de Explorar sobreviven al cambio.
            El contenedor exterior lleva el tamaño YA escalado porque transform no reserva
            espacio en el layout. */}
        <div ref={viewportShellRef} className={`min-w-0 rounded-2xl border border-slate-200 bg-[radial-gradient(circle_at_1px_1px,#cbd5e1_1px,transparent_0)] bg-[length:18px_18px] p-3 sm:p-5 ${focused ? `${sideGuide ? 'h-full' : 'h-[calc(100dvh-7rem)]'} overflow-auto` : ''}`}>
          <div className="mx-auto" style={{ width: preset.width * viewportScale + (viewport === 'mobile' ? DEVICE_FRAME_X : 0) }}>
            {viewport === 'desktop' && (
              <div className="flex items-center gap-1.5 rounded-t-xl border border-b-0 border-slate-200 bg-slate-100 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                <span className="ml-2 truncate text-[11px] font-medium text-slate-500">Proyecto del equipo</span>
              </div>
            )}
            {/* Marco de celular: el contenedor existe SIEMPRE (solo cambian sus clases) para
                que pasar de Computador a Celular no desmonte el iframe. */}
            <div className={viewport === 'mobile' ? 'relative rounded-[40px] bg-slate-900 px-3 py-7 shadow-2xl shadow-slate-900/30 ring-1 ring-slate-700' : ''}>
              {viewport === 'mobile' && <span aria-hidden="true" className="absolute left-1/2 top-3 h-1.5 w-16 -translate-x-1/2 rounded-full bg-slate-700" />}
            <div
              className={`overflow-hidden bg-white ${viewport === 'desktop' ? 'rounded-b-xl border border-slate-200' : 'rounded-[18px]'}`}
              style={{ width: preset.width * viewportScale, height: preset.height * viewportScale }}
            >
              <iframe
                ref={iframeRef}
                title="Preview aislado de Edusyn Crea"
                src={src}
                sandbox={PREVIEW_SANDBOX}
                className="border-0"
                style={{ width: preset.width, height: preset.height, transform: `scale(${viewportScale})`, transformOrigin: 'top left' }}
              />
            </div>
              {viewport === 'mobile' && <span aria-hidden="true" className="absolute bottom-2.5 left-1/2 h-1 w-24 -translate-x-1/2 rounded-full bg-slate-600" />}
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              {preset.label} · {preset.width} px{viewportScale < 1 && <span> · vista al {Math.round(viewportScale * 100)}%</span>}
            </p>
          </div>
        </div>
        <aside className={`space-y-3 ${focused && sideGuide ? 'overflow-auto' : ''}`}>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">Guía de comprensión</p>
            {ready ? <span className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Proyecto listo para probar</span>
              : <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-indigo-600" /> Conectando preview…</span>}
            {ready && !exploreMode && <p className="mt-2 text-xs leading-5 text-slate-500">Activa “Explorar elementos” para tocar una parte de la página y descubrir cómo está construida.</p>}
            {ready && exploreMode && <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-cyan-800"><MousePointer2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Toca un título, botón o tarjeta dentro del preview.</p>}
          </div>
          {exploreMode && codePosition && codeFile === 'html' && (
            <div className="rounded-xl bg-slate-50 px-4 py-2 text-xs text-slate-500">
              {codeStatus?.status === 'exact' && codeStatus.tagName
                ? <>Cursor en el código → <span className="font-mono font-semibold text-slate-700">{`<${codeStatus.tagName}>`}</span></>
                : 'Cursor en el código → sin coincidencia exacta en esta posición'}
              {/* Paso 5.1 (punto 17): llegar desde el código ofrece exactamente la misma
                  edición que llegar desde el preview — mismo componente, misma función de
                  reemplazo. */}
              {onEditHtmlText && codeStatus?.status === 'exact' && codeStatus.text && (
                <TextChangeCard key={`codigo:${codeStatus.text.start}:${codeStatus.text.value}`} text={codeStatus.text} onEdit={onEditHtmlText} />
              )}
            </div>
          )}
          {exploreMode && codePosition && codeFile === 'css' && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950">
              {declaracionExplicada ? (
                <div className="flex items-start gap-2">
                  {declaracionExplicada.colorSwatch && (
                    <span aria-hidden className="mt-0.5 h-4 w-4 shrink-0 rounded border border-indigo-300" style={{ background: declaracionExplicada.colorSwatch }} />
                  )}
                  <p>{declaracionExplicada.sentence}</p>
                </div>
              ) : (
                <p>{cssResumen ?? 'No pudimos relacionar esta parte de los estilos con el preview.'}</p>
              )}
              {/* Paso 5.0: la edición es una acción pequeña DESPUÉS de la explicación — la
                  ficha nunca se convierte en un formulario permanente. Si la declaración no es
                  editable con seguridad, aquí simplemente no aparece nada. */}
              {declaracionEditable && (
                <div className="mt-3">
                  {!editorAbierto ? (
                    <button type="button" onClick={() => setEditorAbierto(true)} className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">
                      <Pencil className="h-3.5 w-3.5" /> Cambiar
                    </button>
                  ) : (
                    <div className="rounded-lg border border-indigo-200 bg-white p-3">
                      <p className="mb-2 text-xs font-bold text-indigo-900">{editableControlLabel(declaracionEditable.property)}</p>
                      {declaracionEditable.kind === 'color' ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            aria-label="Nuevo color"
                            value={valorElegido ?? declaracionEditable.swatch}
                            onChange={(changeEvent) => setValorElegido(changeEvent.target.value)}
                            className="h-8 w-12 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                          />
                          <span className="font-mono text-xs text-slate-600">{valorNuevo ?? '—'}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={9999}
                            step={1}
                            aria-label="Nuevo valor"
                            value={valorElegido ?? String(declaracionEditable.amount)}
                            onChange={(changeEvent) => setValorElegido(changeEvent.target.value)}
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-sm text-slate-800"
                          />
                          {/* La unidad no se cambia en este paso: se conserva la que ya tenía el
                              archivo, para no convertir "24px" en "24rem" sin que se note. */}
                          <span className="text-xs font-semibold text-slate-600">{declaracionEditable.unit}</span>
                        </div>
                      )}
                      <p className="mt-2 text-xs text-slate-600">
                        <span className="font-mono">{declaracionEditable.current}</span>
                        <span className="mx-1.5" aria-hidden>→</span>
                        <span className="font-mono font-bold text-indigo-800">{valorNuevo ?? '—'}</span>
                      </p>
                      {describeEditImpact(cssStatus?.matchedCount) && <p className="mt-1 text-xs text-slate-500">{describeEditImpact(cssStatus?.matchedCount)}</p>}
                      {describeEditMediaWarning(cssStatus?.mediaText, cssStatus?.mediaActive, viewportLabel) && (
                        <p className="mt-1 text-xs text-amber-700">{describeEditMediaWarning(cssStatus?.mediaText, cssStatus?.mediaActive, viewportLabel)}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" disabled={!valorNuevo || valorNuevo === declaracionEditable.current} onClick={confirmarEdicion} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                          Confirmar cambio
                        </button>
                        <button type="button" onClick={() => { setEditorAbierto(false); setValorElegido(null) }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                          Cancelar
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">Esto cambiará el código en styles.css. Después pulsa “Aplicar al preview” para verlo.</p>
                    </div>
                  )}
                </div>
              )}
              {/* Nombre técnico como segunda capa: visible, pero nunca la frase principal. */}
              {cssStatus?.status === 'exact' && cssStatus.selector && (
                <p className="mt-2 font-mono text-xs text-indigo-800">
                  {cssStatus.selector}
                  {cssStatus.property && <span className="text-indigo-600"> · {cssStatus.property}</span>}
                </p>
              )}
            </div>
          )}
          {exploreMode && lastPick?.status === 'exact' && lastPick.tagName && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-950">
              <div className="mb-1 flex items-center gap-2 font-bold"><HelpCircle className="h-4 w-4" /> {lastPick.tagName}</div>
              <p>{getElementExplanation(lastPick.tagName) ?? 'Todavía no tenemos una explicación preparada para este elemento.'}</p>
              <p className="mt-2 text-xs text-indigo-800">Código relacionado: exacto</p>
              {/* Paso 5.1: flujo principal — el estudiante toca un texto en el preview y aquí
                  mismo puede cambiarlo, sin tener que ir a buscarlo a index.html. Si el
                  contenido no es un texto simple e inequívoco, no aparece nada. */}
              {onEditHtmlText && lastPick.text && (
                <TextChangeCard key={`preview:${lastPick.text.start}:${lastPick.text.value}`} text={lastPick.text} onEdit={onEditHtmlText} />
              )}
              {/* Paso 5.2: la capa de intención, por encima de todo lo anterior. Solo aparece
                  si el elemento tiene alguna capacidad demostrable que modificar. */}
              {onApplyPlan && capabilityContext && capabilityContext.manifest.capabilities.length > 0 && (
                <IntentCard key={`intent:${capabilityContext.manifest.contextId}`} context={capabilityContext} onApply={onApplyPlan} />
              )}
            </div>
          )}
          {/* Preview → CSS (Paso 4.2): no es un DevTools — solo el selector, cuántos elementos
              y (si aplica) si esa regla se aplica ahora o solo en otra pantalla. Sin elegir
              "la regla ganadora": si hay varias, se muestran todas como relacionadas. */}
          {exploreMode && lastCssRelatedTotal > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <div className="mb-1 flex items-center gap-2 font-bold text-slate-800"><Palette className="h-4 w-4" /> Estilos relacionados</div>
              <p className="mb-2 text-xs text-slate-500">{describeCssRelatedCount(lastCssRelatedTotal)}</p>
              <ul className="space-y-1.5">
                {lastCssRelated.slice(0, visibleCssRelated).map((rule, index) => {
                  const disponibilidad = describeCssRuleAvailability(rule.mediaText, rule.mediaActive, viewportLabel)
                  return (
                    <li key={index}>
                      <button
                        type="button"
                        onClick={() => { setReglaElegida(rule.start); onNavigateToCssRule?.({ start: rule.start, end: rule.end }) }}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
                      >
                        <span className="block font-mono text-xs font-semibold text-slate-700">{rule.selector}</span>
                        {disponibilidad && <span className="mt-0.5 block text-[11px] text-slate-500">{disponibilidad}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
              {lastCssRelatedTotal > visibleCssRelated && (
                <button type="button" onClick={() => setVisibleCssRelated(lastCssRelatedTotal)} className="mt-2 text-xs font-semibold text-indigo-700 hover:underline">
                  Ver todos ({lastCssRelatedTotal})
                </button>
              )}
            </div>
          )}
          {projectTooLarge && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Esta versión supera 500 KB. Reduzcan los archivos antes de probarla.</div>}
          {event ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <div className="mb-2 flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> Encontramos algo para revisar</div>
            <p>{describePreviewProblem(event)}</p>
            <p className="mt-2 text-xs text-amber-800">Error técnico: {event.message}</p>
            <button onClick={copyRepairContext} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-900 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-950">
              <Copy className="h-3.5 w-3.5" /> {copied ? 'Contexto copiado' : 'Copiar contexto para ChatGPT/DeepSeek'}
            </button>
          </div> : <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Si la app encuentra un error al ejecutarse, Edusyn lo explicará aquí.</div>}
          <a href={previewOrigin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:underline"><ExternalLink className="h-3.5 w-3.5" /> Abrir el origen aislado</a>
        </aside>
      </div>
    </section>
  )
}
