import { BookOpen, Check, ChevronDown, ChevronRight, Cloud, Code2, Crosshair, Eye, FileCode2, FlaskConical, Layers3, Maximize2, Minimize2, Monitor, MousePointer2, RotateCcw, Smartphone, Sparkles } from 'lucide-react'
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
const editorClassBase = 'crea-code-editor w-full resize-y bg-[#111827] px-5 py-5 font-mono text-[13px] leading-6 text-slate-100 outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-400'

export interface CodeWorkspaceProps {
  /** Código de partida (p. ej. la última versión guardada). Se lee solo al montar. */
  initialProject?: PreviewProject
  /** Cuando se provee, habilita "Guardar versión". Debe devolver true si guardó (para
   * reflejar el cambio en el preview) o false si lo canceló tras avisar al equipo. */
  onSaveVersion?: (project: PreviewProject, note: string) => Promise<boolean>
  /** Versiones ya guardadas por el equipo, la más reciente primero. */
  versions?: SavedVersionSummary[]
  /** Se reenvía al preview: se dispara cuando el equipo copia el contexto de ayuda. */
  onHelpRequested?: () => void
}

export default function CodeWorkspace({ initialProject, onSaveVersion, versions = [], onHelpRequested }: CodeWorkspaceProps) {
  const [draft, setDraft] = useState<PreviewProject>(() => initialProject ?? SAMPLE)
  const [applied, setApplied] = useState<PreviewProject>(() => initialProject ?? SAMPLE)
  const [selected, setSelected] = useState<FileKey>('html')
  const [saving, setSaving] = useState(false)
  // Lo último que quedó guardado como versión. Se compara contra esto (no contra lo aplicado
  // al preview) para saber si hay algo nuevo que guardar: antes, aplicar al preview
  // deshabilitaba "Guardar versión" y el equipo no podía guardar lo que acababa de probar.
  const [savedProject, setSavedProject] = useState<PreviewProject | null>(() => initialProject ?? null)
  const [savePanelOpen, setSavePanelOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(true)
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
  const guide = FILE_GUIDES[selected]
  const editorClass = `${editorClassBase} ${expanded ? 'min-h-[60vh]' : 'min-h-[360px]'}`
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

  const save = async (note: string) => {
    if (!onSaveVersion) return
    setSaving(true)
    try {
      const saved = await onSaveVersion(draft, note)
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

  return <section className={expanded
    ? 'crea-studio fixed inset-0 z-50 overflow-auto p-3 sm:p-6'
    : 'crea-studio mt-6 overflow-hidden rounded-[28px] border border-slate-200 shadow-xl shadow-slate-900/10'}>
    <div className={expanded ? 'mx-auto max-w-[1680px] overflow-hidden rounded-[28px] border border-white/10 bg-white shadow-2xl' : ''}>
      <header className="border-b border-white/10 bg-[#12202f] px-4 py-4 text-white sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 to-emerald-300 text-slate-950 shadow-lg shadow-cyan-950/30"><FlaskConical className="h-5 w-5" /></span>
            <div>
              <div className="flex items-center gap-2"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-cyan-200">Edusyn Crea</p><span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-300">Laboratorio visual</span></div>
              <h2 className="mt-0.5 text-lg font-bold tracking-tight">Construyan, comprendan y prueben</h2>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!connected && <button type="button" onClick={() => setDraft(SAMPLE)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"><RotateCcw className="h-3.5 w-3.5" /> Cargar ejemplo</button>}
            <button type="button" onClick={() => setExploreMode(v => !v)} title="Conecta cada parte visible con el código que la crea" aria-pressed={exploreMode} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${exploreMode ? 'border-cyan-300 bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-950/30' : 'border-white/15 bg-white/5 text-white hover:bg-white/10'}`}>
              <Crosshair className="h-3.5 w-3.5" /> {exploreMode ? 'Exploración activa' : 'Explorar elementos'}
            </button>
            <button type="button" onClick={() => setExpanded(v => !v)} title={expanded ? 'Salir de pantalla completa (Esc)' : 'Expandir para trabajar en pantalla completa'} className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">
              {expanded ? <><Minimize2 className="h-3.5 w-3.5" /> Salir</> : <><Maximize2 className="h-3.5 w-3.5" /> Pantalla completa</>}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-slate-200"><Layers3 className="h-3.5 w-3.5 text-orange-300" /> 1. Editen el proyecto</span>
          <ChevronRight className="hidden h-3.5 w-3.5 text-slate-500 sm:block" />
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${hasChanges ? 'bg-amber-300 text-amber-950' : 'bg-white/10 text-slate-200'}`}><Eye className="h-3.5 w-3.5" /> 2. Apliquen al preview</span>
          <ChevronRight className="hidden h-3.5 w-3.5 text-slate-500 sm:block" />
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${connected && !unsaved ? 'bg-emerald-300 text-emerald-950' : 'bg-white/10 text-slate-200'}`}><Cloud className="h-3.5 w-3.5" /> 3. Guarden una versión</span>
          <span className="ml-auto text-[11px] text-slate-400">{latestVersion ? `Última evidencia: v${latestVersion.number}${unsaved ? ' · hay cambios sin guardar' : ''}` : 'Aún no hay una versión guardada'}</span>
        </div>
      </header>

      <div className="bg-[#f4f7f9] p-3 sm:p-5">
        {exploreMode && <div className="mb-4 flex items-start gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-950 shadow-sm">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-200"><MousePointer2 className="h-4 w-4" /></span>
          <div><p className="font-bold">Modo explorar encendido</p><p className="mt-0.5 text-xs leading-5 text-cyan-800">Haz clic en una parte de tu página para descubrir qué código la crea. También puedes poner el cursor en HTML o CSS para verla resaltada.</p></div>
        </div>}

        {savePanelOpen && connected && <SaveVersionPanel
          nextNumber={(latestVersion?.number ?? 0) + 1}
          changedFiles={changedSinceSave}
          untested={hasChanges}
          saving={saving}
          onApplyFirst={() => { setApplied(draft); setSavePanelOpen(false) }}
          onConfirm={save}
          onCancel={() => setSavePanelOpen(false)}
        />}

        <div className={`grid gap-4 ${expanded ? 'lg:grid-cols-[minmax(360px,.85fr)_minmax(0,1.15fr)]' : 'xl:grid-cols-[minmax(360px,.9fr)_minmax(0,1.1fr)]'}`}>
          <div className="min-w-0 overflow-hidden rounded-[22px] border border-slate-300 bg-[#111827] shadow-lg shadow-slate-900/10">
            <div className="border-b border-white/10 bg-[#182434] p-3">
              <div className="mb-3 flex items-center justify-between gap-3 px-1">
                <div><p className="text-xs font-bold text-white">Mapa del proyecto</p><p className="mt-0.5 text-[11px] text-slate-400">Tres archivos, tres funciones diferentes</p></div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${hasChanges ? 'bg-amber-300 text-amber-950' : 'bg-emerald-300 text-emerald-950'}`}>{hasChanges ? `${changed.length} con cambios` : 'Sin cambios'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Archivos del proyecto">{FILES.map((file) => <button key={file.key} role="tab" aria-selected={selected === file.key} onClick={() => setSelected(file.key)} className={`min-w-0 rounded-xl border p-2.5 text-left transition ${selected === file.key ? file.activeClass : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}>
                <span className="flex items-center gap-1.5 text-xs font-bold"><span className={`h-2 w-2 rounded-full ${file.dotClass}`} />{file.learningLabel}</span>
                <span className="mt-1 block truncate font-mono text-[10px] opacity-70">{file.label}</span>
              </button>)}</div>
            </div>
            <div className="border-b border-white/10 bg-[#141d2b] px-4 py-2.5">
              <button type="button" onClick={() => setGuideOpen(v => !v)} aria-expanded={guideOpen} className="flex w-full items-center justify-between gap-2 text-left text-xs font-bold text-slate-200">
                <span className="inline-flex items-center gap-2"><BookOpen className={`h-3.5 w-3.5 ${activeFile.accentClass}`} /> Cómo se lee {activeFile.label}</span>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${guideOpen ? 'rotate-180' : ''}`} />
              </button>
              {guideOpen && <div className="mt-2 space-y-2.5">
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
                <div className="rounded-lg border border-white/10 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Para conversar en equipo</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-4 text-slate-300">{guide.questions.map(question => <li key={question}>{question}</li>)}</ul>
                  {selected !== 'js' && <p className="mt-1.5 text-[11px] text-cyan-300">Tip: con “Explorar elementos” toquen una parte de la app y el editor les muestra su código.</p>}
                </div>
              </div>}
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#111827] px-5 py-2.5">
              <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-200"><FileCode2 className="h-3.5 w-3.5 text-cyan-300" /> {activeFile.description}</span>
              <span className="font-mono text-[10px] text-slate-500">{activeFile.label}</span>
            </div>
            <textarea ref={textareaRef} aria-label={`Editor de ${activeFile.label}`} value={draft[selected]} onChange={event => update(event.target.value)} onMouseUp={() => reportCursorPosition(true)} onKeyUp={reportCursorPositionDebounced} spellCheck={false} className={editorClass} />
            <div className="flex items-center gap-2 border-t border-white/10 bg-[#182434] px-4 py-2.5 text-[11px] text-slate-400"><Sparkles className="h-3.5 w-3.5 text-amber-300" /> Este es el código real de su proyecto. Cada cambio queda visible y revisable.</div>
          </div>

          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4">
              <div className={`flex items-center gap-2 text-sm font-semibold ${hasChanges ? 'text-amber-800' : 'text-emerald-700'}`}>{hasChanges ? <><Code2 className="h-4 w-4" /> El preview aún muestra la versión anterior</> : <><Check className="h-4 w-4" /> Código y preview están sincronizados</>}</div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-slate-50" role="group" aria-label="Cómo ver el proyecto">
                  <button type="button" onClick={() => setViewport('desktop')} aria-pressed={viewport === 'desktop'} title="Ver cómo queda en una computadora" className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold ${viewport === 'desktop' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:bg-white'}`}><Monitor className="h-3.5 w-3.5" /> Computador</button>
                  <button type="button" onClick={() => setViewport('mobile')} aria-pressed={viewport === 'mobile'} title="Ver cómo queda en un celular" className={`inline-flex items-center gap-1.5 border-l border-slate-200 px-3 py-2 text-xs font-semibold ${viewport === 'mobile' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:bg-white'}`}><Smartphone className="h-3.5 w-3.5" /> Celular</button>
                </div>
                <button type="button" disabled={!hasChanges} onClick={() => setApplied(draft)} className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"><Eye className="h-3.5 w-3.5" /> Aplicar al preview</button>
                {connected && <button type="button" disabled={!unsaved || saving} onClick={() => setSavePanelOpen(true)} title={unsaved ? 'Guardar lo que hay en el editor como evidencia' : 'No hay cambios desde la última versión guardada'} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"><Cloud className="h-3.5 w-3.5" /> {unsaved ? 'Guardar versión' : 'Versión guardada'}</button>}
              </div>
            </div>
            <PreviewFrame project={applied} onHelpRequested={onHelpRequested} viewport={viewport} onViewportChange={setViewport} exploreMode={exploreMode} onElementPicked={handleElementPicked} codePosition={codePosition} codeFile={selected === 'css' ? 'css' : 'html'} onNavigateToCssRule={handleNavigateToCssRule} onEditCssValue={handleEditCssValue} onEditHtmlText={handleEditHtmlText} onApplyPlan={handleApplyPlan} />
          </div>
        </div>

        {connected && <VersionHistory versions={versions} current={!unsaved} />}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
          <span><strong className="text-slate-800">Entorno protegido:</strong> el proyecto no puede acceder a cuentas, notas ni datos del aula.</span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-500"><Code2 className="h-3.5 w-3.5" /> HTML · CSS · JavaScript</span>
        </div>
      </div>
    </div>
  </section>
}
