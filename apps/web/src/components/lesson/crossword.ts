// ═══════════════════════════════════════════════════════════════════════════
// CROSSWORD (crucigrama) — motor puro de layout, sin React ni UI.
// ─────────────────────────────────────────────────────────────────────────
// El docente da pares "RESPUESTA::pista" (camino A, en `options`). Aquí se
// genera un tablero entrelazado (cruces donde comparten letra; respaldo
// desconectado para garantizar que TODA palabra sea resoluble) y se numera.
// Separado del componente para testearlo aislado (como grading.ts / wordsearch).
// ═══════════════════════════════════════════════════════════════════════════
import { wsClean } from './wordsearch'

export type CWDir = 'across' | 'down'
export interface CWClue { answer: string; clue: string } // answer = forma original
export interface CWCell { r: number; c: number }
export interface CWEntry {
  num: number
  r: number
  c: number
  dir: CWDir
  answer: string  // original (para reportar/graduar)
  cl: string      // limpio (para casar celdas)
  clue: string
  cells: CWCell[]
}
export interface CWLayout {
  rows: number
  cols: number
  solution: (string | null)[][] // letra o null (celda bloqueada)
  entries: CWEntry[]
}

const DELTA: Record<CWDir, [number, number]> = { across: [0, 1], down: [1, 0] }
const PERP: Record<CWDir, CWDir> = { across: 'down', down: 'across' }

interface Placed { cl: string; answer: string; clue: string; r: number; c: number; dir: CWDir }

export function cwBuild(items: CWClue[], rng: () => number = Math.random): CWLayout {
  const clean = items
    .map(it => ({ answer: it.answer, clue: it.clue, cl: wsClean(it.answer) }))
    .filter(x => x.cl.length >= 2)
  if (clean.length === 0) return { rows: 0, cols: 0, solution: [], entries: [] }

  // Palabras largas primero → mejor entrelazado.
  clean.sort((a, b) => b.cl.length - a.cl.length)

  const map = new Map<string, string>() // "r,c" -> letra
  const key = (r: number, c: number) => r + ',' + c
  const get = (r: number, c: number) => map.get(key(r, c))
  const placed: Placed[] = []

  const write = (p: Placed) => {
    const [dr, dc] = DELTA[p.dir]
    for (let i = 0; i < p.cl.length; i++) map.set(key(p.r + dr * i, p.c + dc * i), p.cl[i])
    placed.push(p)
  }

  // ¿Es válido colocar cl en (r0,c0) dir? Devuelve nº de cruces o -1 si inválido.
  const score = (cl: string, r0: number, c0: number, dir: CWDir): number => {
    const [dr, dc] = DELTA[dir]
    const [pr, pc] = DELTA[PERP[dir]]
    // límites (celda antes/después deben estar vacías)
    if (get(r0 - dr, c0 - dc) != null) return -1
    if (get(r0 + dr * cl.length, c0 + dc * cl.length) != null) return -1
    let crosses = 0
    for (let i = 0; i < cl.length; i++) {
      const r = r0 + dr * i, c = c0 + dc * i
      const cur = get(r, c)
      if (cur != null) {
        if (cur !== cl[i]) return -1
        crosses++ // cruce válido
      } else {
        // celda nueva: sus vecinas perpendiculares deben estar vacías (evita palabras pegadas)
        if (get(r + pr, c + pc) != null) return -1
        if (get(r - pr, c - pc) != null) return -1
      }
    }
    return crosses
  }

  // Primera palabra: horizontal en el origen.
  write({ ...clean[0], r: 0, c: 0, dir: 'across' })

  for (let k = 1; k < clean.length; k++) {
    const { cl, answer, clue } = clean[k]
    let best: { r: number; c: number; dir: CWDir; s: number } | null = null
    // Probar cruces contra cada letra ya colocada.
    for (const p of placed) {
      const [pdr, pdc] = DELTA[p.dir]
      for (let j = 0; j < p.cl.length; j++) {
        const cellR = p.r + pdr * j, cellC = p.c + pdc * j
        const letter = p.cl[j]
        const dir = PERP[p.dir]
        const [dr, dc] = DELTA[dir]
        for (let i = 0; i < cl.length; i++) {
          if (cl[i] !== letter) continue
          const r0 = cellR - dr * i, c0 = cellC - dc * i
          const s = score(cl, r0, c0, dir)
          if (s > 0 && (!best || s > best.s)) best = { r: r0, c: c0, dir, s }
        }
      }
    }
    if (best) {
      write({ cl, answer, clue, r: best.r, c: best.c, dir: best.dir })
    } else {
      // Respaldo desconectado: fila propia debajo de todo (siempre resoluble).
      let maxR = 0
      placed.forEach(p => { const len = p.dir === 'down' ? p.cl.length : 1; maxR = Math.max(maxR, p.r + len) })
      write({ cl, answer, clue, r: maxR + 1, c: 0, dir: 'across' })
    }
  }

  // Normalizar a (0,0).
  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity
  for (const kk of map.keys()) {
    const [r, c] = kk.split(',').map(Number)
    minR = Math.min(minR, r); minC = Math.min(minC, c)
    maxR = Math.max(maxR, r); maxC = Math.max(maxC, c)
  }
  const rows = maxR - minR + 1, cols = maxC - minC + 1
  const solution: (string | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null))
  for (const [kk, v] of map.entries()) {
    const [r, c] = kk.split(',').map(Number)
    solution[r - minR][c - minC] = v
  }

  // Numeración: celdas de inicio ordenadas en orden de lectura.
  const norm = placed.map(p => ({ ...p, r: p.r - minR, c: p.c - minC }))
  const startKeys = Array.from(new Set(norm.map(p => key(p.r, p.c))))
  startKeys.sort((a, b) => {
    const [ar, ac] = a.split(',').map(Number), [br, bc] = b.split(',').map(Number)
    return ar - br || ac - bc
  })
  const numOf = new Map<string, number>()
  startKeys.forEach((sk, i) => numOf.set(sk, i + 1))

  const entries: CWEntry[] = norm.map(p => {
    const [dr, dc] = DELTA[p.dir]
    const cells: CWCell[] = []
    for (let i = 0; i < p.cl.length; i++) cells.push({ r: p.r + dr * i, c: p.c + dc * i })
    return { num: numOf.get(key(p.r, p.c))!, r: p.r, c: p.c, dir: p.dir, answer: p.answer, cl: p.cl, clue: p.clue, cells }
  }).sort((a, b) => a.num - b.num)

  return { rows, cols, solution, entries }
}

// Palabras (originales) resueltas dado el mapa de letras tecleadas ("r,c"->letra).
export function cwSolved(entries: CWEntry[], letters: Record<string, string>): string[] {
  const out: string[] = []
  for (const e of entries) {
    const ok = e.cells.every((cell, i) => (letters[cell.r + ',' + cell.c] || '') === e.cl[i])
    if (ok) out.push(e.answer)
  }
  return out
}
