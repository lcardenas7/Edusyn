// ═══════════════════════════════════════════════════════════════════════════
// WORDSEARCH (sopa de letras) — motor puro de rejilla, sin React ni UI.
// ─────────────────────────────────────────────────────────────────────────
// El docente da la lista de palabras; aquí se genera la rejilla (colocación en
// 8 direcciones con solape permitido + relleno) y se resuelve la selección del
// alumno. Separado del componente para poder testearlo aislado (como grading.ts).
// ═══════════════════════════════════════════════════════════════════════════

export type WSCell = { r: number; c: number }
export interface WSGrid {
  size: number
  grid: string[][]
  placements: Record<string, WSCell[]> // palabra original → celdas
}

export const WS_DIRS = [[0, 1], [1, 0], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1], [-1, 1]] as const
const WS_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// A LETRAS mayúsculas sin acentos. NFD separa el acento; ̀-ͯ lo quita.
// (La Ñ se descompone en N + tilde → queda como N, aceptable para la rejilla.)
export function wsClean(w: string): string {
  return String(w).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z]/g, '')
}

export function wsBuild(words: string[], rng: () => number = Math.random): WSGrid {
  const items = words
    .map(orig => ({ orig, cl: wsClean(orig) }))
    .filter(x => x.cl.length >= 2)
  if (items.length === 0) return { size: 8, grid: [], placements: {} }

  const longest = Math.max(...items.map(x => x.cl.length))
  const size = Math.min(16, Math.max(8, longest, items.length + 1))
  const rnd = (n: number) => Math.floor(rng() * n)

  const tryPlace = (grid: string[][], cl: string): WSCell[] | null => {
    for (let t = 0; t < 80; t++) {
      const [dr, dc] = WS_DIRS[rnd(WS_DIRS.length)]
      const r0 = rnd(size), c0 = rnd(size)
      const cells: WSCell[] = []
      let ok = true
      for (let i = 0; i < cl.length; i++) {
        const r = r0 + dr * i, c = c0 + dc * i
        if (r < 0 || c < 0 || r >= size || c >= size) { ok = false; break }
        const cur = grid[r][c]
        if (cur !== '' && cur !== cl[i]) { ok = false; break }
        cells.push({ r, c })
      }
      if (ok) return cells
    }
    return null
  }

  let grid: string[][] = []
  let placements: Record<string, WSCell[]> = {}
  let placedAll = false
  for (let attempt = 0; attempt < 15 && !placedAll; attempt++) {
    grid = Array.from({ length: size }, () => Array(size).fill(''))
    placements = {}
    placedAll = true
    for (const { orig, cl } of items) {
      const cells = tryPlace(grid, cl)
      if (!cells) { placedAll = false; break }
      cells.forEach((cell, i) => { grid[cell.r][cell.c] = cl[i] })
      placements[orig] = cells
    }
  }
  // Respaldo garantizado: cada palabra en su propia fila (siempre cabe).
  if (!placedAll) {
    grid = Array.from({ length: size }, () => Array(size).fill(''))
    placements = {}
    items.forEach(({ orig, cl }, row) => {
      const cells: WSCell[] = []
      for (let i = 0; i < cl.length; i++) { grid[row][i] = cl[i]; cells.push({ r: row, c: i }) }
      placements[orig] = cells
    })
  }
  // Rellena huecos con letras aleatorias.
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (grid[r][c] === '') grid[r][c] = WS_ALPHABET[rnd(26)]
  }
  return { size, grid, placements }
}

// Línea recta (snap a las 8 direcciones) de start→cur, recortada a la rejilla.
export function wsLine(start: WSCell, cur: WSCell, size: number): WSCell[] {
  const dr = cur.r - start.r, dc = cur.c - start.c
  const adr = Math.abs(dr), adc = Math.abs(dc)
  const sg = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0)
  let ur = 0, uc = 0, steps = 0
  if (adr === 0 && adc === 0) return [start]
  if (adr > adc * 2) { ur = sg(dr); uc = 0; steps = adr }
  else if (adc > adr * 2) { ur = 0; uc = sg(dc); steps = adc }
  else { ur = sg(dr); uc = sg(dc); steps = Math.max(adr, adc) }
  const cells: WSCell[] = []
  for (let i = 0; i <= steps; i++) {
    const r = start.r + ur * i, c = start.c + uc * i
    if (r < 0 || c < 0 || r >= size || c >= size) break
    cells.push({ r, c })
  }
  return cells
}

// ¿Las letras de estas celdas forman alguna palabra sin encontrar? Devuelve la
// palabra original (para acumular en la respuesta) o null.
export function wsMatch(cells: WSCell[], grid: string[][], words: string[], found: Set<string>): string | null {
  const letters = cells.map(c => grid[c.r][c.c]).join('')
  const rev = letters.split('').reverse().join('')
  for (const w of words) {
    if (found.has(w)) continue
    const cl = wsClean(w)
    if (cl.length >= 2 && (cl === letters || cl === rev)) return w
  }
  return null
}
