import { useEffect, useRef } from 'react'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import type { EditorAdapter } from './editorAdapter'

export type CodeLanguage = 'html' | 'css' | 'js'

const LANGUAGE: Record<CodeLanguage, () => Extension> = { html: () => html(), css: () => css(), js: () => javascript() }

const FRAME = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: '#111827' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', lineHeight: '1.6' },
  '.cm-content': { padding: '12px 0' },
  '.cm-gutters': { backgroundColor: '#111827', borderRight: '1px solid rgba(255,255,255,.06)' },
  '&.cm-focused': { outline: 'none' },
})

export interface CodeSelection { start: number; end: number; explicit: boolean }

/**
 * Editor de código tradicional (CodeMirror): colores por sintaxis, números de línea,
 * autocompletado, cierre de etiquetas y paréntesis, búsqueda (Ctrl+F) y deshacer por archivo.
 * Cada archivo conserva su propio estado (cursor, historial) al cambiar de pestaña.
 */
export default function CodeEditor({ file, language, value, onChange, onSelection, onReady, ariaLabel }: {
  /** Identidad del archivo abierto: cambiarla intercambia el estado del editor, no lo reinicia. */
  file: string
  language: CodeLanguage
  value: string
  onChange: (value: string) => void
  onSelection?: (selection: CodeSelection) => void
  onReady?: (adapter: EditorAdapter) => void
  ariaLabel: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const states = useRef(new Map<string, EditorState>())
  const current = useRef(file)
  const handlers = useRef({ onChange, onSelection })
  handlers.current = { onChange, onSelection }

  const makeState = (doc: string, lang: CodeLanguage) => EditorState.create({
    doc,
    extensions: [
      lineNumbers(), highlightActiveLineGutter(), foldGutter(), history(), drawSelection(), indentOnInput(),
      // Sin esto, en un celular hay que desplazarse en horizontal para leer cada línea.
      EditorView.lineWrapping,
      bracketMatching(), closeBrackets(), autocompletion(), highlightActiveLine(), highlightSelectionMatches(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }), oneDark, FRAME, LANGUAGE[lang](),
      EditorState.tabSize.of(2),
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...completionKeymap, indentWithTab]),
      EditorView.contentAttributes.of({ 'aria-label': ariaLabel, spellcheck: 'false', autocapitalize: 'off' }),
      EditorView.updateListener.of(update => {
        if (update.docChanged) handlers.current.onChange(update.state.doc.toString())
        if (update.selectionSet) {
          const range = update.state.selection.main
          const explicit = update.transactions.some(tr => tr.isUserEvent('select.pointer')) || !range.empty
          handlers.current.onSelection?.({ start: range.from, end: range.to, explicit })
        }
      }),
    ],
  })

  useEffect(() => {
    if (!host.current) return
    const v = new EditorView({ state: makeState(value, language), parent: host.current })
    view.current = v
    onReady?.({
      selectRange(start, end) {
        const len = v.state.doc.length
        v.focus()
        v.dispatch({ selection: { anchor: Math.min(start, len), head: Math.min(end, len) }, scrollIntoView: true })
      },
      scrollRangeIntoView(start) {
        v.dispatch({ effects: EditorView.scrollIntoView(Math.min(start, v.state.doc.length), { y: 'center' }) })
      },
      replaceRange(start, end, text) {
        if (start < 0 || end > v.state.doc.length || start > end) return false
        // Entra al historial del propio editor: Ctrl+Z la deshace como si se hubiera tecleado.
        v.dispatch({ changes: { from: start, to: end, insert: text }, userEvent: 'input.replace' })
        return true
      },
    })
    return () => { v.destroy(); view.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cambio de archivo: se guarda el estado del que se deja (cursor, historial) y se recupera el
  // del que se abre.
  useEffect(() => {
    const v = view.current
    if (!v || current.current === file) return
    states.current.set(current.current, v.state)
    current.current = file
    const saved = states.current.get(file)
    v.setState(saved && saved.doc.toString() === value ? saved : makeState(value, language))
  }, [file]) // eslint-disable-line react-hooks/exhaustive-deps

  // El contenido cambió desde fuera (plan aplicado, borrador recuperado, ejemplo cargado).
  useEffect(() => {
    const v = view.current
    if (!v || current.current !== file) return
    const doc = v.state.doc.toString()
    if (doc !== value) v.dispatch({ changes: { from: 0, to: doc.length, insert: value } })
  }, [value, file])

  return <div ref={host} className="h-full min-h-0 overflow-hidden" />
}
