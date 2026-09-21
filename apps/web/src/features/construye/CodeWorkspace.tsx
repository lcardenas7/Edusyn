import { BookOpen, Cloud, Code2, Crosshair, Expand, Eye, History, Lock, Maximize2, Minimize2, Monitor, MousePointer2, Play, RotateCcw, Smartphone, Wand2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from '../../lib/toast'
import { createTextareaEditorAdapter } from './editorAdapter'
import PreviewFrame, { type CodePosition, type PreviewProject } from './PreviewFrame'
import { replaceCssValueAtRange, type CssValueEditRequest } from './cssEdits'
import { prepareHtmlTextForSource, replaceHtmlTextAtRange, type HtmlTextEditRequest } from './htmlEdits'
import { describePlanFailure, executePlan, type ModificationPlan } from './plan'
import { clampCssRuleRange, clampElementPickRange, fileTracksAppliedProject, type PreviewEvent } from './protocol'
import { type ViewportKey } from './viewports'
import { FILE_GUIDES } from './fileGuides'
import { SaveVersionPanel, VersionHistory, type SavedVersionSummary } from './VersionEvidence'
import ChangeRequestPanel from './ChangeRequestPanel'
import { GATE_MISSING_LABEL, localGate, type ChangeRequest, type VersionEvidenceInput } from './journey'
import type { ConstruyeBuildGate, ConstruyeTeamBrief } from '../../lib/api/construye'

const SAMPLE: PreviewProject = {
  html: '<main>\n  <h1>Mi app escolar</h1>\n  <p>Escribe aquí el contenido de tu página.</p>\n  <button id="saludar">Probar</button>\n  <p id="mensaje"></p>\n</main>',
  css: 'body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; background: #f8fafc; font-size: 16px; }\nmain { max-width: 36rem; margin: auto; padding: 1.5rem; border-radius: 1rem; background: white; }\nh1 { font-size: 20px; margin: 0 0 8px; }\nbutton { padding: .7rem 1rem; border: 0; border-radius: .6rem; background: #4f46e5; color: white; font-size: 15px; }',
  js: 'document.querySelector("#saludar").addEventListener("click", () => {\n  document.querySelector("#mensaje").textContent = "¡Tu app está funcionando!"\n})',
}

type FileKey = keyof PreviewProject
const FILES: { key: FileKey; label: string; learningLabel: string; description: string; activeClass: string; dotClass: string; accentClass: string }[] = [
  { key: 'html', label: 'index.html', learningLabel: 'Contenido', description: 'Lo que aparece en la página', activeClass: 'border-orange-300 bg-orange-50 text-orange-950', dotClass: 'bg-orange-500', accentClass: 'text-orange-300' },
  { key: 'css', label: 'styles.css', learningLabel: 'Diseño', description: 'Colores, tamaños y espacios', activeClass: 'border-sky-300 bg-sky-50 text-sky-950', dotClass: 'bg-sky-500', accentClass: 'text-sky-300' },
  { key: 'js', label: 'app.js', learningLabel: 'Acciones', description: 'Lo que ocurre al interactuar', activeClass: 'border-violet-300 bg-violet-50 text-violet-950', dotClass: 'bg-violet-500', accentClass: 'text-violet-300' },
]
const editorClassBase = 'crea-code-editor w-full bg-[#111827] px-5 py-4 font-mono text-[13px] leading-6 text-slate-100 outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-400'

export interface CodeWorkspaceProps {
  /** Código de partida (p. ej. la última versión guardada). Se lee solo al montar. */
  initialProject?: PreviewProject
  /** Cuando se provee, habilita "Guardar versión". Debe devolver true si guardó (para
   * reflejar el cambio en el preview) o false si lo canceló tras avisar al equipo. */
  onSaveVersion?: (project: PreviewProject, evidence: VersionEvidenceInput) => Promise<boolean>
  /** Versiones ya guardadas por el equipo, la más reciente primero. */
  versions?: SavedVersionSummary[]
  /** Decisiones guardadas del recorrido: alimentan la petición de cambio y la condición de la
   * primera versión. */
  brief?: ConstruyeTeamBrief
  /** Respuesta del servidor; aquí solo importa si el docente habilitó la excepción. */
  buildGate?: ConstruyeBuildGate
  onChangeRequestCopied?: (request: ChangeRequest) => void
  /** Se reenvía al preview: se dispara cuando el equipo copia el contexto de ayuda. */
  onHelpRequested?: () => void
}

export default function CodeWorkspace({ initialProject, onSaveVersion, versions = [], brief, buildGate, onChangeRequestCopied, onHelpRequested }: CodeWorkspaceProps) {
  const [draft, setDraft] = useState<PreviewProject>(() => initialProject ?? SAMPLE)
  const [applied, setApplied] = useState<PreviewProject>(() => initialProject ?? SAMPLE)
  const [selected, setSelected] = useState<FileKey>('html')
  const [saving, setSaving] = useState(false)
  // Lo último que quedó guardado como versión. Se compara contra esto (no contra lo aplicado
  // al preview) para saber si hay algo nuevo que guardar: antes, aplicar al preview
  // deshabilitaba "Guardar versión" y el equipo no podía guardar lo que acababa de probar.
  const [savedProject, setSavedProject] = useState<PreviewProject | null>(() => initialProject ?? null)
  const [savePanelOpen, setSavePanelOpen] = useState(false)
  const [changePanelOpen, setChangePanelOpen] = useState(false)
  const [previewFocused, setPreviewFocused] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [mobilePane, setMobilePane] = useState<'preview' | 'code'>('code')
  const [expanded, setExpanded] = useState(false)
  const [exploreMode, setExploreMode] = useState(false)
  const [viewport, setViewport] = useState<ViewportKey>('desktop')
  // `file` decide en qué pestaña debe estar activa la edición para que el efecto de abajo
  // aplique la selección — así el mismo mecanismo sirve tanto para saltos HTML (Paso 3) como
  // para navegar a una regla CSS relacionada (Paso 4.2, "ver dónde está este estilo").
  const [pendingPick, setPendingPick] = useState<{ start: number; end: number; file: FileKey } | null>(null)
  // Una edición visual confirmada, a la espera de que su pestaña esté montada. `file` distingue
  // el archivo (styles.css en 5.0, index.html en 5.1) pero la escritura es la misma para ambos:
  // una sola ruta, no dos implementaciones.
  const [pendingEdit, setPendingEdit] = useState<{ file: 'css' | 'html'; range: { start: number; end: number }; newValue: string; content: string } | null>(null)
  const [codePosition, setCodePosition] = useState<CodePosition | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const cursorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorAdapter = useMemo(() => createTextareaEditorAdapter(() => textareaRef.current), [])
  const hasChanges = useMemo(() => FILES.some(({ key }) => draft[key] !== applied[key]), [draft, applied])
  const htmlInSync = draft.html === applied.html
  const cssInSync = draft.css === applied.css
  const changed = FILES.filter(({ key }) => draft[key] !== applied[key]).map(({ label }) => label)
  const update = (value: string) => setDraft(current => ({ ...current, [selected]: value }))
  const connected = Boolean(onSaveVersion)
  const changedSinceSave = FILES.filter(({ key }) => !savedProject || draft[key] !== savedProject[key]).map(({ label }) => label)
  const unsaved = changedSinceSave.length > 0
  const latestVersion = versions[0]
  const gate = brief ? localGate(brief, versions.length, buildGate?.unlockedByTeacher ?? false) : null
  const blockedBy = gate && !gate.canSaveFirstVersion ? gate.missing.map(field => GATE_MISSING_LABEL[field]) : []
  const guide = FILE_GUIDES[selected]
  const activeFile = FILES.find(file => file.key === selected) ?? FILES[0]

  // "Explorar" (Preview → Código): las posiciones que reporta el runner corresponden al
  // HTML que YA está en el preview (applied.html), instrumentado con parse5. Si hay cambios
  // sin aplicar en el archivo HTML, esas posiciones ya no describen con certeza lo que hay en
  // el editor — seleccionar ahí sería inventar una correspondencia, así que avisamos en vez
  // de adivinar. El cambio de pestaña a "html" se resuelve en el efecto de abajo: solo
  // entonces el <textarea> del DOM realmente contiene ese archivo.
  const handleElementPicked = (event: PreviewEvent) => {
    if (event.status !== 'exact') {
      toast.info('No pudimos ubicar ese elemento en el código (puede haberlo creado el propio JavaScript).')
      return
    }
    if (draft.html !== applied.html) {
      toast.info('Hay cambios de HTML sin aplicar: aplícalos antes de usar "Explorar" para que la ubicación sea exacta.')
      return
    }
    const range = clampElementPickRange(event, applied.html.length)
    if (!range) {
      toast.info('Ese elemento ya no corresponde al código actual (¿editaste el archivo?).')
      return
    }
    setSelected('html')
    setPendingPick({ ...range, file: 'html' })
  }

  // Preview → CSS (Paso 4.2): el estudiante eligió una de las reglas relacionadas con el
  // elemento clickeado ("ver dónde está este estilo"). Se revalida contra el CSS APLICADO en
  // este mismo instante — no el que tenía cuando llegó la lista de reglas — porque pudo
  // aplicar una versión distinta entre medias; nunca se navega a una posición que ya no
  // corresponde a lo que el preview está mostrando (misma protección que el salto HTML).
  const handleNavigateToCssRule = (range: { start: number; end: number }) => {
    if (!cssInSync) {
      toast.info('Hay cambios de CSS sin aplicar: aplícalos antes de ver dónde está esta regla.')
      return
    }
    const clamped = clampCssRuleRange(range, applied.css.length)
    if (!clamped) {
      toast.info('Esa regla ya no corresponde al CSS actual (¿editaste el archivo?).')
      return
    }
    setSelected('css')
    setPendingPick({ ...clamped, file: 'css' })
  }

  useEffect(() => {
    if (!pendingPick || selected !== pendingPick.file) return
    editorAdapter.selectRange(pendingPick.start, pendingPick.end)
    editorAdapter.scrollRangeIntoView(pendingPick.start)
    setPendingPick(null)
  }, [pendingPick, selected, editorAdapter])

  // Paso 5.0 (edición visual): el estudiante confirmó un nuevo valor desde la ficha pedagógica.
  // El archivo sigue siendo la fuente de verdad — aquí NO se crea ningún estilo paralelo: se
  // reemplaza exactamente el tramo del valor en styles.css y el estudiante lo aplica después
  // con el mismo botón de siempre.
  const handleEditCssValue = ({ valueStart, valueEnd, expectedValue, newValue }: CssValueEditRequest) => {
    if (!cssInSync) {
      toast.info('Hay cambios de CSS sin aplicar: aplícalos antes de cambiar un valor desde aquí.')
      return
    }
    // Revalidación obligatoria: el rango se calculó sobre el CSS que el preview tiene aplicado,
    // pero el archivo pudo cambiar entre que apareció la ficha y este clic. Si el texto en ese
    // rango ya no es el esperado NO se busca el valor en otro sitio — se cancela y se pide
    // volver a seleccionar.
    const resultado = replaceCssValueAtRange(draft.css, { start: valueStart, end: valueEnd }, expectedValue, newValue)
    if (!resultado) {
      toast.info('El código cambió desde que seleccionaste este elemento. Vuelve a seleccionarlo para continuar.')
      return
    }
    setSelected('css')
    setPendingEdit({ file: 'css', range: { start: valueStart, end: valueEnd }, newValue, content: resultado.css })
  }

  // Paso 5.1 (edición de texto): mismo contrato que la edición de CSS, sobre index.html. Lo
  // que el estudiante escribió se normaliza y se ESCAPA antes de tocar el archivo, así que un
  // texto como `Hola <script>` entra como texto visible y nunca como estructura.
  const handleEditHtmlText = ({ textStart, textEnd, expectedSource, newText }: HtmlTextEditRequest): boolean => {
    if (!htmlInSync) {
      toast.info('Hay cambios de HTML sin aplicar: aplícalos antes de cambiar un texto desde aquí.')
      return false
    }
    const textoSeguro = prepareHtmlTextForSource(newText)
    if (!textoSeguro) {
      toast.info('Escribe un texto para poder cambiarlo.')
      return false
    }
    // Misma revalidación obligatoria que en 5.0, pero contra el texto tal como está ESCRITO en
    // el archivo (con sus entidades): si ya no es el mismo, no se busca en otra parte.
    const resultado = replaceHtmlTextAtRange(draft.html, { start: textStart, end: textEnd }, expectedSource, textoSeguro)
    if (!resultado) {
      toast.info('El código cambió desde que seleccionaste este elemento. Vuelve a seleccionarlo para continuar.')
      return false
    }
    setSelected('html')
    setPendingEdit({ file: 'html', range: { start: textStart, end: textEnd }, newValue: textoSeguro, content: resultado.html })
    return true
  }

  // Paso 5.2: ejecutar un plan de "Ayúdame a modificarlo". Todo el trabajo de decidir QUÉ se
  // cambia ya ocurrió antes; aquí solo se revalida contra los archivos de este instante y se
  // escribe todo o nada. El plan puede tocar los dos archivos, así que los drafts se actualizan
  // en una sola operación: nunca queda HTML nuevo con CSS viejo por un fallo intermedio.
  const handleApplyPlan = (plan: ModificationPlan, currentContextId: string): boolean => {
    const resultado = executePlan({
      plan,
      currentContextId,
      html: draft.html,
      css: draft.css,
      htmlInSync,
      cssInSync,
    })
    if (!resultado.ok) {
      toast.info(describePlanFailure(resultado.reason))
      return false
    }
    // Escritura transaccional: un solo setDraft con los dos archivos ya calculados.
    setDraft(current => ({ ...current, html: resultado.html, css: resultado.css }))
    const archivos = resultado.files.map((file) => (file === 'css' ? 'styles.css' : 'index.html')).join(' y ')
    toast.success(`Cambios preparados en ${archivos}`, 'Pulsa “Aplicar al preview” para verlos.')
    return true
  }

  // Se espera a que la pestaña de styles.css esté realmente montada (igual que pendingPick):
  // la edición se hace SOBRE el <textarea> real, no sobre el estado, para que quede dentro del
  // historial de deshacer del navegador (Ctrl+Z) sin inventar un historial propio.
  useEffect(() => {
    if (!pendingEdit || selected !== pendingEdit.file) return
    const { file, range, newValue, content } = pendingEdit
    // La edición se hace SOBRE el <textarea> (execCommand), no asignando su valor: es la forma
    // de que React se entere por el mismo camino que si el estudiante hubiera tecleado, y de
    // acercarse lo más posible al historial de deshacer nativo. AVISO, comprobado en navegador
    // real: aun así Ctrl+Z NO revierte de forma fiable esta edición. Chrome descarta la entrada
    // de deshacer recién creada cuando, inmediatamente después, el componente controlado se
    // vuelve a renderizar y se reposiciona la selección — y lo único que lo evitaba en las
    // pruebas era esperar unos cientos de milisegundos, es decir un número mágico. Se prefiere
    // dejarlo así y documentarlo antes que inventar un historial de deshacer propio; con un
    // editor de código real (CodeMirror/Monaco) esto se resuelve con su API de transacciones.
    setPendingEdit(null)
    // Si el navegador no admite la edición por esa vía, el cambio se hace igual desde el
    // estado: nunca se pierde el cambio.
    if (!editorAdapter.replaceRange(range.start, range.end, newValue)) {
      setDraft(current => ({ ...current, [file]: content }))
    }
    // El estudiante tiene que VER qué cambió: el valor nuevo queda seleccionado y a la vista.
    // Se hace por el MISMO camino que un salto de "Explorar" (pendingPick) y no aquí mismo,
    // porque seleccionar en este instante no sobrevive: el re-render que provoca la propia
    // edición vuelve a colapsar la selección.
    setPendingPick({ start: range.start, end: range.start + newValue.length, file })
    const archivo = file === 'css' ? 'styles.css' : 'index.html'
    toast.success(`Cambiamos el código en ${archivo}`, 'Pulsa “Aplicar al preview” para verlo.')
  }, [pendingEdit, selected, editorAdapter])

  // "Explorar" (Código → Preview): reporta el cursor/selección actual del editor solo cuando
  // hay algo confiable que mapear — pestaña html, Explorar encendido, y el HTML del editor
  // coincide con el que el preview tiene renderizado (misma razón que arriba: un rango
  // calculado contra un HTML desactualizado no describe con certeza nada real). `explicit`
  // se resuelve a true también si el usuario ya tiene texto seleccionado (shift+flechas),
  // no solo por clic/mouseup — solo una acción explícita centra el elemento en el preview.
  // Paso 4.1: la pestaña css entra por su propia ruta (analiza reglas, no estructura). Cada
  // archivo se compara con SU versión aplicada: señalar contra un archivo que el preview
  // todavía no está usando mostraría una relación que el estudiante no puede ver.
  const exploraElArchivo = selected === 'js' ? false : fileTracksAppliedProject(selected, htmlInSync, cssInSync)

  const reportCursorPosition = (explicit: boolean) => {
    if (!exploreMode || !exploraElArchivo) return
    const el = textareaRef.current
    if (!el) return
    const { selectionStart, selectionEnd } = el
    setCodePosition({ start: selectionStart, end: selectionEnd, explicit: explicit || selectionStart !== selectionEnd })
  }

  const reportCursorPositionDebounced = () => {
    if (cursorDebounceRef.current) clearTimeout(cursorDebounceRef.current)
    cursorDebounceRef.current = setTimeout(() => reportCursorPosition(false), 60)
  }

  // Cubre las transiciones: encender/apagar Explorar, cambiar de pestaña, o que el HTML deje
  // de estar en sync — en cualquiera de esos casos hay que reportar la posición actual (si ya
  // se cumplen las condiciones) o pedir explícitamente que se deje de resaltar.
  useEffect(() => {
    if (exploreMode && exploraElArchivo) reportCursorPosition(false)
    else setCodePosition(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploreMode, selected, exploraElArchivo])

  useEffect(() => () => { if (cursorDebounceRef.current) clearTimeout(cursorDebounceRef.current) }, [])

  // Modo expandido: pantalla completa para trabajar cómodo en PC. Se sale con el botón,
  // con Escape, o si el equipo navega a otra parte (limpieza del listener y el scroll).
  useEffect(() => {
    if (!expanded) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpanded(false) }
    window.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow }
  }, [expanded])

  // Lo que no está guardado como versión solo vive en esta pantalla: se avisa antes de cerrarla.
  useEffect(() => {
    if (!connected || !unsaved) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [connected, unsaved])

  const save = async (evidence: VersionEvidenceInput) => {
    if (!onSaveVersion) return
    setSaving(true)
    try {
      const saved = await onSaveVersion(draft, evidence)
      if (saved) {
        setApplied(draft)
        setSavedProject(draft)
        setSavePanelOpen(false)
      }
    } catch (error) {
      toast.error(error)
    } finally {
      setSaving(false)
    }
  }

  // Un solo panel lateral a la vez (pedir cambio, guardar versión o historial), como cajón
  // sobre el taller: antes empujaban el editor hacia abajo y el estudiante perdía el contexto.
  const drawer: 'change' | 'save' | 'history' | null = savePanelOpen && connected ? 'save' : changePanelOpen ? 'change' : historyOpen ? 'history' : null
  const closeDrawer = () => { setSavePanelOpen(false); setChangePanelOpen(false); setHistoryOpen(false) }

  return <section className={`crea-studio flex flex-col overflow-hidden bg-white ${expanded ? 'fixed inset-0 z-50' : 'h-[calc(100dvh-10rem)] min-h-[620px]'}`}>
    {/* Celular: una sola columna con alternancia explícita; el estado se conserva al cambiar. */}
    <div className="flex border-b border-slate-200 lg:hidden" role="tablist" aria-label="Qué ver">
      {([['preview', 'Vista previa', Eye], ['code', 'Código', Code2]] as const).map(([key, label, Icon]) =>
        <button key={key} type="button" role="tab" aria-selected={mobilePane === key} onClick={() => setMobilePane(key)}
          className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-sm font-semibold ${mobilePane === key ? 'border-cyan-600 text-cyan-800' : 'border-transparent text-slate-500'}`}>
          <Icon className="h-4 w-4" /> {label}{key === 'code' && hasChanges && <span className="h-2 w-2 rounded-full bg-amber-500" aria-label="con cambios sin ver" />}
        </button>)}
    </div>

    <div className="flex min-h-0 flex-1">
      {/* Izquierda: la creación, con sus controles debajo (como el simulador de un editor por bloques). */}
      <aside className={`${mobilePane === 'preview' ? 'flex' : 'hidden'} min-h-0 w-full shrink-0 flex-col border-r border-slate-200 bg-slate-50 lg:flex lg:w-[440px] xl:w-[500px]`}>
        <div className="min-h-0 flex-1 overflow-auto">
          <PreviewFrame studio project={applied} onHelpRequested={onHelpRequested} viewport={viewport} onViewportChange={setViewport} focused={previewFocused} onFocusedChange={setPreviewFocused} exploreMode={exploreMode} onElementPicked={handleElementPicked} codePosition={codePosition} codeFile={selected === 'css' ? 'css' : 'html'} onNavigateToCssRule={handleNavigateToCssRule} onEditCssValue={handleEditCssValue} onEditHtmlText={handleEditHtmlText} onApplyPlan={handleApplyPlan} />
        </div>
        <div className="flex items-center justify-center gap-1 border-t border-slate-200 bg-white px-2 py-2" role="toolbar" aria-label="Controles de la vista previa">
          <ToolButton label="Ver como computador" pressed={viewport === 'desktop'} onClick={() => setViewport('desktop')}><Monitor className="h-4 w-4" /></ToolButton>
          <ToolButton label="Ver como celular" pressed={viewport === 'mobile'} onClick={() => setViewport('mobile')}><Smartphone className="h-4 w-4" /></ToolButton>
          <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />
          <ToolButton label={exploreMode ? 'Apagar Explorar' : 'Explorar: toca una parte y te muestra su código'} pressed={exploreMode} onClick={() => setExploreMode(v => !v)}><Crosshair className="h-4 w-4" /></ToolButton>
          <ToolButton label="Ver la app en grande" onClick={() => setPreviewFocused(true)}><Maximize2 className="h-4 w-4" /></ToolButton>
          <ToolButton label={expanded ? 'Salir de pantalla completa (Esc)' : 'Taller en pantalla completa'} pressed={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? <Minimize2 className="h-4 w-4" /> : <Expand className="h-4 w-4" />}</ToolButton>
        </div>
      </aside>

      {/* Derecha: el código, con una pestaña por archivo. */}
      <div className={`${mobilePane === 'code' ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-1 flex-col bg-[#111827] lg:flex`}>
        <div className="flex items-stretch gap-1 border-b border-white/10 bg-[#182434] px-2 pt-2" role="tablist" aria-label="Archivos del proyecto">
          {FILES.map(file => {
            const dirty = draft[file.key] !== applied[file.key]
            return <button key={file.key} type="button" role="tab" aria-selected={selected === file.key} onClick={() => setSelected(file.key)} title={file.description}
              className={`flex min-w-0 items-center gap-2 rounded-t-lg px-3 py-2 text-left text-xs transition ${selected === file.key ? 'bg-[#111827] text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
              <span className={`h-2 w-2 shrink-0 rounded-full ${file.dotClass}`} />
              <span className="font-semibold">{file.learningLabel}</span>
              <span className="hidden font-mono text-[10px] opacity-60 sm:inline">{file.label}</span>
              {dirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="con cambios sin ver" />}
            </button>
          })}
          <button type="button" onClick={() => setGuideOpen(v => !v)} aria-expanded={guideOpen} className={`ml-auto mb-1 inline-flex items-center gap-1.5 self-center rounded-md px-2 py-1 text-xs font-semibold ${guideOpen ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}>
            <BookOpen className={`h-3.5 w-3.5 ${activeFile.accentClass}`} /> <span className="hidden sm:inline">Cómo se lee</span>
          </button>
        </div>
        {guideOpen && <div className="max-h-[40%] shrink-0 space-y-2.5 overflow-auto border-b border-white/10 bg-[#141d2b] px-4 py-3">
          <p className="text-[11px] leading-5 text-slate-300">{guide.idea}</p>
          <div className="overflow-x-auto rounded-lg bg-black/30 px-3 py-2 font-mono text-[12px] leading-6">
            {guide.example.map((part, index) => part.name
              ? <span key={index} className={`rounded px-0.5 underline decoration-dotted underline-offset-4 ${activeFile.accentClass}`}>{part.text}</span>
              : <span key={index} className="text-slate-400">{part.text}</span>)}
          </div>
          <dl className="grid gap-x-3 gap-y-1 text-[11px] leading-4 sm:grid-cols-2">
            {guide.example.filter(part => part.name).map(part => <div key={part.name}>
              <dt className={`inline font-bold ${activeFile.accentClass}`}>{part.name}: </dt>
              <dd className="inline text-slate-300">{part.meaning}</dd>
            </div>)}
          </dl>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Para conversar en equipo</p>
          <ul className="list-disc space-y-0.5 pl-4 text-[11px] leading-4 text-slate-300">{guide.questions.map(question => <li key={question}>{question}</li>)}</ul>
        </div>}
        {exploreMode && <p className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-cyan-950/60 px-4 py-1.5 text-[11px] text-cyan-100"><MousePointer2 className="h-3.5 w-3.5 text-cyan-300" /> Explorar: toca una parte de tu app o pon el cursor en el código para ver cómo se relacionan.</p>}
        <textarea ref={textareaRef} aria-label={`Editor de ${activeFile.label}`} value={draft[selected]} onChange={event => update(event.target.value)} onMouseUp={() => reportCursorPosition(true)} onKeyUp={reportCursorPositionDebounced} spellCheck={false} className={`${editorClassBase} min-h-0 flex-1 resize-none`} />
      </div>
    </div>

    {/* Barra inferior: una acción principal (ver los cambios) y las de guardar a la derecha. */}
    <footer className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white px-3 py-2.5">
      <button type="button" disabled={!hasChanges} onClick={() => { setApplied(draft); setMobilePane('preview') }} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">
        <Play className="h-4 w-4" /> Ver mis cambios
      </button>
      <span className={`min-w-0 text-xs ${hasChanges ? 'font-semibold text-amber-700' : 'text-slate-500'}`}>
        {hasChanges ? `Cambios sin ver en ${changed.join(', ')}` : 'La vista previa muestra tu código'}
        {connected && <span className="text-slate-400"> · {latestVersion ? `v${latestVersion.number} guardada${unsaved ? ', hay cambios sin guardar' : ''}` : 'aún sin versiones guardadas'}</span>}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {!connected && <button type="button" onClick={() => setDraft(SAMPLE)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><RotateCcw className="h-3.5 w-3.5" /> Cargar ejemplo</button>}
        <button type="button" onClick={() => { closeDrawer(); setChangePanelOpen(true) }} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100"><Wand2 className="h-3.5 w-3.5" /> Pedir un cambio a la IA</button>
        {connected && <button type="button" onClick={() => { closeDrawer(); setHistoryOpen(true) }} title="Versiones guardadas" aria-label="Versiones guardadas" className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"><History className="h-4 w-4" /></button>}
        {connected && <button type="button" disabled={!unsaved || saving} onClick={() => { closeDrawer(); setSavePanelOpen(true) }} title={unsaved ? 'Guardar lo que hay en el editor como evidencia' : 'No hay cambios desde la última versión guardada'} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">{blockedBy.length && unsaved ? <Lock className="h-3.5 w-3.5" /> : <Cloud className="h-3.5 w-3.5" />} {unsaved ? 'Guardar versión' : 'Versión guardada'}</button>}
      </div>
    </footer>

    {drawer && <div className="fixed inset-0 z-[55] flex justify-end bg-slate-900/30" onClick={closeDrawer}>
      <div role="dialog" aria-modal="true" aria-label={drawer === 'save' ? 'Guardar versión' : drawer === 'change' ? 'Pedir un cambio a la IA' : 'Versiones guardadas'} onClick={event => event.stopPropagation()} className="flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="font-bold text-slate-800">{drawer === 'save' ? 'Guardar versión' : drawer === 'change' ? 'Pedir un cambio a la IA' : 'Versiones guardadas'}</p>
          <button type="button" onClick={closeDrawer} aria-label="Cerrar" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {drawer === 'change' && <ChangeRequestPanel brief={brief} project={draft} onCopied={onChangeRequestCopied} onClose={closeDrawer} />}
          {drawer === 'save' && <SaveVersionPanel
            nextNumber={(latestVersion?.number ?? 0) + 1}
            changedFiles={changedSinceSave}
            untested={hasChanges}
            saving={saving}
            blockedBy={blockedBy}
            onApplyFirst={() => { setApplied(draft); setSavePanelOpen(false); setMobilePane('preview') }}
            onConfirm={save}
            onCancel={closeDrawer}
          />}
          {drawer === 'history' && <VersionHistory versions={versions} current={!unsaved} />}
        </div>
      </div>
    </div>}
  </section>
}

/** Botón de icono de la barra de la vista previa: siempre con nombre accesible y tooltip. */
function ToolButton({ label, pressed, onClick, children }: { label: string; pressed?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={pressed}
    className={`grid h-9 w-9 place-items-center rounded-md transition ${pressed ? 'bg-cyan-100 text-cyan-800' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}>
    {children}
  </button>
}
