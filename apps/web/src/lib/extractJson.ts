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
function sliceBalanced(s: string, startIdx: number): string {
  const end = balancedEnd(s, startIdx)
  return end < 0 ? s.slice(startIdx) : s.slice(startIdx, end + 1) // sin cierre: devuelve el resto
}

// Índice del cierre emparejado del { o [ en startIdx, o -1 si el texto termina antes.
// Ignora llaves dentro de cadenas y respeta los escapes.
function balancedEnd(s: string, startIdx: number): number {
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
    else if (ch === close) { depth--; if (depth === 0) return i }
  }
  return -1
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

// Al copiar desde el chat de una IA, WhatsApp o Word se cuelan espacios "raros" (NBSP, de ancho
// cero, BOM) que JSON.parse no acepta entre tokens. Dentro de las cadenas son inofensivos, así que
// se cambian por un espacio normal en todo el texto.
function normalizeSpaces(s: string): string {
  return s.replace(/[   -   　]/g, ' ').replace(/[​-‍⁠﻿]/g, '')
}

// Último recurso: comillas tipográficas usadas como delimitadores (“clave”: “valor”).
function straightenQuotes(s: string): string {
  return s.replace(/[“”„‟″]/g, '"')
}

/** El texto trae el inicio de un JSON pero no su cierre (la IA cortó la respuesta). */
export class IncompleteJsonError extends Error {}

export function extractJson(raw: string): any {
  const text = normalizeSpaces(String(raw ?? '')).trim()
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

  for (const source of [noFences, straightenQuotes(noFences)]) {
    // Tomar el primer objeto/arreglo balanceado (ignora `quiz =` y código posterior).
    const start = source.search(/[{[]/)
    if (start < 0) continue
    const block = sliceBalanced(source, start)
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

  const start = noFences.search(/[{[]/)
  if (start >= 0 && balancedEnd(noFences, start) < 0) {
    throw new IncompleteJsonError('La respuesta parece cortada: el JSON no termina. Pídele a la IA que la complete o que la genere en dos partes.')
  }
  throw new Error('No se pudo leer un JSON válido del texto. Verifica que hayas copiado el resultado completo de la IA.')
}
