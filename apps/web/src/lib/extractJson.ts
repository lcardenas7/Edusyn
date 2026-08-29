// Extrae un objeto/array JSON de un texto pegado por el docente.
//
// Las IA (ChatGPT, Gemini, Claude) casi nunca devuelven JSON "puro": lo envuelven
// en cercas ```json ... ```, añaden prosa antes/después, o devuelven CÓDIGO
// (p. ej. Python: `quiz = { ... }` con booleanos `True`/`False`/`None` y líneas
// al final como `print(f"...{len(quiz['questions'])}")` que también traen llaves).
// Por eso NO basta con "del primer { al último }": hay que emparejar llaves
// balanceadas (respetando comillas) para tomar exactamente el primer objeto/arreglo
// y descartar lo que venga después. Luego se traducen literales de Python.

function tryParse(s: string): any | undefined {
  try { return JSON.parse(s) } catch { return undefined }
}

// Desde el { o [ en startIdx, devuelve la subcadena hasta su cierre emparejado.
// Ignora llaves dentro de cadenas y respeta los escapes.
function sliceBalanced(s: string, startIdx: number): string {
  const open = s[startIdx]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inStr = false
  let quote = ''
  for (let i = startIdx; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      if (ch === '\\') { i++; continue }
      if (ch === quote) inStr = false
      continue
    }
    if (ch === '"' || ch === "'") { inStr = true; quote = ch; continue }
    if (ch === open) depth++
    else if (ch === close) { depth--; if (depth === 0) return s.slice(startIdx, i + 1) }
  }
  return s.slice(startIdx) // sin cierre: devuelve el resto
}

// Convierte literales estilo Python a JSON (True→true, False→false, None→null)
// SOLO fuera de las cadenas, para no tocar el texto de las preguntas.
function jsonifyPythonLiterals(s: string): string {
  let out = ''
  let inStr = false
  let quote = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (inStr) {
      out += ch
      if (ch === '\\') { out += s[i + 1] ?? ''; i++; continue }
      if (ch === quote) inStr = false
      continue
    }
    if (ch === '"' || ch === "'") { inStr = true; quote = ch; out += ch; continue }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i
      while (j < s.length && /[A-Za-z_]/.test(s[j])) j++
      const word = s.slice(i, j)
      out += word === 'True' ? 'true' : word === 'False' ? 'false' : word === 'None' ? 'null' : word
      i = j - 1
      continue
    }
    out += ch
  }
  return out
}

export function extractJson(raw: string): any {
  const text = String(raw ?? '').trim()
  if (!text) throw new Error('El texto está vacío.')

  // Quitar cercas de código markdown (```json … ``` / ~~~).
  const noFences = text
    .replace(/```[a-zA-Z]*/g, '')
    .replace(/```/g, '')
    .replace(/~~~[a-zA-Z]*/g, '')
    .replace(/~~~/g, '')
    .trim()

  // Intentos directos (JSON ya limpio).
  for (const candidate of [text, noFences]) {
    const parsed = tryParse(candidate)
    if (parsed !== undefined) return parsed
  }

  // Tomar el primer objeto/arreglo balanceado (ignora `quiz =` y código posterior).
  const start = noFences.search(/[{[]/)
  if (start >= 0) {
    const block = sliceBalanced(noFences, start)
    const attempts = [
      block,                                              // tal cual
      block.replace(/,(\s*[}\]])/g, '$1'),                // sin comas colgantes
      jsonifyPythonLiterals(block).replace(/,(\s*[}\]])/g, '$1'), // literales Python
    ]
    for (const a of attempts) {
      const parsed = tryParse(a)
      if (parsed !== undefined) return parsed
    }
  }

  throw new Error('No se pudo leer un JSON válido del texto. Verifica que hayas copiado el resultado completo de la IA.')
}
