import DOMPurify from 'dompurify'

/**
 * HTML que escriben las personas (foro, anuncios, lecciones) → algo que se puede mostrar.
 *
 * Ni la API ni la web limpiaban ese HTML: se guardaba tal cual y se insertaba con
 * `dangerouslySetInnerHTML`. En el foro escriben los ESTUDIANTES, y cualquiera puede mandar a la
 * API un post con `<img src=x onerror=…>`: se ejecutaba en el navegador del docente que lo abría,
 * con su sesión. Todo HTML de usuario pasa por aquí antes de pintarse.
 */

// Los enlaces del editor abren en pestaña nueva: se conserva `target`, pero SIEMPRE con
// `rel="noopener noreferrer"`, para que la página enlazada no pueda manipular la de Edusyn.
if (typeof window !== 'undefined' && DOMPurify.isSupported) {
  DOMPurify.addHook('afterSanitizeAttributes', (nodo) => {
    if (nodo.tagName === 'A' && nodo.getAttribute('target')) {
      nodo.setAttribute('rel', 'noopener noreferrer')
    }
  })
}

/** HTML limpio: conserva el formato del editor (negrita, colores, listas, enlaces, imágenes) y quita lo ejecutable. */
export function htmlSeguro(html: string | null | undefined): string {
  if (!html) return ''
  if (typeof window === 'undefined' || !DOMPurify.isSupported) {
    // Sin DOM no hay dónde pintar; por si acaso, nunca se devuelve HTML crudo.
    return textoPlanoDeHtml(html)
  }
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, ADD_ATTR: ['target'] })
}

/**
 * HTML → texto plano de una línea, para vistas previas («Responde con tus propias palabras»).
 *
 * Usa `DOMParser`, que crea un documento INERTE: no ejecuta manejadores ni carga imágenes. El
 * truco habitual de `div.innerHTML = html` sobre un elemento suelto sí los ejecuta.
 */
export function textoPlanoDeHtml(html: string | null | undefined): string {
  if (!html) return ''
  // Un espacio tras cada bloque: sin él, «<p>Hola</p><p>mundo</p>» saldría «Holamundo».
  const separado = html.replace(/<\/(p|div|li|h[1-6]|blockquote|pre|tr)>|<br\s*\/?>/gi, '$& ')
  let texto: string
  if (typeof DOMParser !== 'undefined') {
    texto = new DOMParser().parseFromString(separado, 'text/html').body.textContent ?? ''
  } else {
    texto = separado
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
  }
  // `\s` incluye el espacio duro (U+00A0) que deja cada `&nbsp;` del editor.
  return texto.replace(/\s+/g, ' ').trim()
}
