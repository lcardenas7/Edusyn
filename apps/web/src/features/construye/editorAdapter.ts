/** Capa entre "Explorar" (Preview → Código) y el editor real. Hoy el editor es un
 * <textarea> plano; si algún día cambia a otro componente (CodeMirror, Monaco...), solo
 * esta capa debe conocer el detalle — el resto de "Explorar" solo pide "selecciona este
 * rango" y "llévalo a la vista", sin saber cómo. */
export interface EditorAdapter {
  selectRange(start: number, end: number): void
  scrollRangeIntoView(start: number): void
  /** Paso 5.0: reemplaza [start,end) por `text` COMO SI lo hubiera escrito el estudiante, para
   * que la edición visual entre en el historial de deshacer del propio editor (Ctrl+Z) en vez
   * de necesitar un historial paralelo de Construye. Devuelve `false` si el navegador no pudo
   * hacerlo por esa vía; entonces quien llama debe actualizar el estado él mismo (el cambio se
   * aplica igual, pero queda fuera del undo nativo). */
  replaceRange(start: number, end: number, text: string): boolean
}

/** Línea (0-based) donde cae `offset` dentro de `text`. Pura y testeable sin DOM. */
export function lineNumberAtOffset(text: string, offset: number): number {
  return text.slice(0, offset).split('\n').length - 1
}

/** scrollTop que centra `lineNumber` en el viewport, sin pasarse de los límites reales del
 * contenido. Pura y testeable sin DOM. */
export function computeCenteredScrollTop(lineNumber: number, lineHeight: number, viewportHeight: number, scrollHeight: number): number {
  if (lineHeight <= 0) return 0
  const target = lineNumber * lineHeight - viewportHeight / 2
  const maxScrollTop = Math.max(0, scrollHeight - viewportHeight)
  return Math.min(Math.max(0, target), maxScrollTop)
}

/** `getElement` se resuelve en cada llamada (no en la creación) porque el <textarea> puede
 * no existir todavía — p. ej. si "Explorar" selecciona una pestaña de archivo distinta a la
 * que está montada en ese momento. */
export function createTextareaEditorAdapter(getElement: () => HTMLTextAreaElement | null): EditorAdapter {
  return {
    selectRange(start, end) {
      const el = getElement()
      if (!el) return
      el.focus()
      el.setSelectionRange(start, end)
    },
    scrollRangeIntoView(start) {
      const el = getElement()
      if (!el) return
      const lineNumber = lineNumberAtOffset(el.value, start)
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 18
      el.scrollTop = computeCenteredScrollTop(lineNumber, lineHeight, el.clientHeight, el.scrollHeight)
    },
    replaceRange(start, end, text) {
      const el = getElement()
      if (!el) return false
      if (start < 0 || end > el.value.length || start > end) return false
      el.focus()
      el.setSelectionRange(start, end)
      // `execCommand('insertText')` está marcado como obsoleto, pero sigue siendo la ÚNICA vía
      // para que una edición hecha por código quede en la pila de deshacer nativa del
      // <textarea> y además dispare un evento `input` real — es decir, que React se entere por
      // el mismo camino que si el estudiante hubiera tecleado. La alternativa (asignar .value)
      // borra el historial de deshacer sin avisar, que es justo lo que este paso quiere evitar.
      try {
        return document.execCommand('insertText', false, text)
      } catch {
        return false
      }
    },
  }
}
