// Extrae un objeto/array JSON de un texto pegado por el docente.
//
// Las IA (ChatGPT, Gemini, Claude) casi nunca devuelven JSON "puro": lo envuelven
// en cercas de código ```json ... ```, o añaden una frase antes/después ("Aquí tienes
// tu quiz:"). Un JSON.parse directo revienta con eso. Este helper es tolerante:
// quita cercas, recorta desde el primer { o [ hasta el último } o ], e intenta
// limpiar comas colgantes como último recurso.

function tryParse(s: string): any | undefined {
  try { return JSON.parse(s) } catch { return undefined }
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

  // Recortar desde el primer { o [ hasta el último } o ] (descarta prosa alrededor).
  const start = noFences.search(/[{[]/)
  const end = Math.max(noFences.lastIndexOf('}'), noFences.lastIndexOf(']'))
  if (start >= 0 && end > start) {
    const candidate = noFences.slice(start, end + 1)
    const parsed = tryParse(candidate)
    if (parsed !== undefined) return parsed
    // Último recurso: quitar comas colgantes antes de } o ].
    const cleaned = tryParse(candidate.replace(/,(\s*[}\]])/g, '$1'))
    if (cleaned !== undefined) return cleaned
  }

  throw new Error('No se pudo leer un JSON válido del texto. Verifica que hayas copiado el resultado completo de la IA.')
}
