// Extrae un objeto/array JSON de un texto pegado por el docente.
//
// Las IA (ChatGPT, Gemini, Claude) casi nunca devuelven JSON "puro": lo envuelven
// en cercas de código ```json ... ```, añaden una frase antes/después ("Aquí tienes
// tu quiz:"), o incluso devuelven CÓDIGO (p. ej. Python: `quiz = { ... }` con
// booleanos `True`/`False`/`None` y líneas extra al final). Un JSON.parse directo
// revienta con todo eso. Este helper es tolerante: quita cercas, recorta desde el
// primer { o [ hasta el último } o ], normaliza literales de Python fuera de las
// comillas y limpia comas colgantes.

function tryParse(s: string): any | undefined {
  try { return JSON.parse(s) } catch { return undefined }
}

// Convierte literales estilo Python a JSON (True→true, False→false, None→null)
// SOLO fuera de las cadenas, para no tocar el texto de las preguntas. Recorre el
// texto respetando comillas simples/dobles y los escapes.
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
    // Fuera de cadena: si empieza una palabra, léela completa y traduce si aplica.
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

  // Intentos directos.
  for (const candidate of [text, noFences]) {
    const parsed = tryParse(candidate)
    if (parsed !== undefined) return parsed
  }

  // Recortar desde el primer { o [ hasta el último } o ] (descarta prosa/código alrededor).
  const start = noFences.search(/[{[]/)
  const end = Math.max(noFences.lastIndexOf('}'), noFences.lastIndexOf(']'))
  if (start >= 0 && end > start) {
    const candidate = noFences.slice(start, end + 1)
    // 1) tal cual  2) sin comas colgantes  3) literales Python + comas colgantes
    const attempts = [
      candidate,
      candidate.replace(/,(\s*[}\]])/g, '$1'),
      jsonifyPythonLiterals(candidate).replace(/,(\s*[}\]])/g, '$1'),
    ]
    for (const a of attempts) {
      const parsed = tryParse(a)
      if (parsed !== undefined) return parsed
    }
  }

  throw new Error('No se pudo leer un JSON válido del texto. Verifica que hayas copiado el resultado completo de la IA.')
}
