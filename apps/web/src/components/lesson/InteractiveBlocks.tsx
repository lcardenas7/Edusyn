import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { CheckCircle2, GripVertical, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'
import { type ActivityData, norm, parsePairs, parseHotspots, gradeAnswer, isAnswerComplete } from './grading'
import { type WSCell, wsBuild, wsLine, wsMatch } from './wordsearch'
import { useResolvedMediaUrl } from '../media/SmartMedia'
import { cwBuild, cwSolved } from './crossword'
import { SpeakButton } from './SpeakButton'

export { gradeAnswer, isAnswerComplete }
export type { ActivityData }

// ═══════════════════════════════════════════════════════════════════════════
// INTERACTIVE BLOCKS (DS-1)
// ─────────────────────────────────────────────────────────────────────────
// Bloques puros de interacción. Reciben el estado desde el player; no conocen
// la API ni el avance. Un BlockRenderer hace el switch por tipo → bloque puro.
// Sello táctil: la respuesta correcta se asienta, la incorrecta tiembla.
// Ver LEARNING_EXPERIENCE_SPEC.md §3 y DESIGN_SYSTEM_LEARNING.md §3/§5.
// ═══════════════════════════════════════════════════════════════════════════

interface BlockProps {
  act: ActivityData
  value: any
  onChange: (v: any) => void
  showResult: boolean
}

const EASE = [0.2, 0.8, 0.2, 1] as const

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Pregunta (decisión) — MULTIPLE_CHOICE / TRUE_FALSE ────────────────────
function ChoiceBlock({ act, value, onChange, showResult }: BlockProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {(act.options || []).map((opt, i) => {
        const isSelected = value === opt
        const isCorrectOption = opt === act.correctAnswer

        let cardClass = 'bg-surface-1 border-hairline'
        let letterClass = 'bg-surface-3 text-ink-secondary'
        if (showResult) {
          if (isCorrectOption) {
            cardClass = 'bg-feedback-correct/10 border-feedback-correct'
            letterClass = 'bg-feedback-correct text-white'
          } else if (isSelected) {
            cardClass = 'bg-feedback-error/10 border-feedback-error opacity-70'
            letterClass = 'bg-feedback-error text-white'
          }
        } else if (isSelected) {
          cardClass = 'bg-accent/5 border-accent ring-1 ring-accent'
          letterClass = 'bg-accent text-white'
        }

        // Sello táctil (DS §5): correcta se asienta (settle), errónea seleccionada tiembla.
        const animate = showResult
          ? isCorrectOption
            ? { scale: [1, 1.03, 1] }
            : isSelected
              ? { x: [0, -6, 6, -4, 4, 0] }
              : {}
          : {}

        return (
          <motion.button
            key={i}
            onClick={() => !showResult && onChange(opt)}
            disabled={showResult}
            animate={animate}
            transition={{ duration: 0.4, ease: EASE }}
            whileHover={!showResult ? { scale: 1.01 } : undefined}
            whileTap={!showResult ? { scale: 0.99 } : undefined}
            className={`relative flex items-center gap-3 p-4 rounded-2xl border text-left text-ink-primary font-medium transition-colors ${cardClass} ${!showResult ? 'hover:border-accent/50 hover:bg-surface-2' : ''}`}
          >
            <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${letterClass}`}>
              {String.fromCharCode(65 + i)}
            </span>
            <span className="flex-1 text-sm sm:text-base">{opt}</span>
            {showResult && isCorrectOption && (
              <CheckCircle2 className="flex-shrink-0 w-5 h-5 text-feedback-correct" />
            )}
          </motion.button>
        )
      })}
    </div>
  )
}

// ─── Completar en línea — FILL_BLANK (el hueco DENTRO de la frase) ──────────
function InlineBlankBlock({ act, value, onChange, showResult }: BlockProps) {
  // El enunciado trae el hueco como "___" (2+ guiones bajos). Lo partimos y
  // metemos el input en su lugar → se completa dentro de la oración (§3.7).
  const parts = useMemo(() => (act.question || '').split(/_{2,}/), [act.question])
  const hasBlank = parts.length > 1
  const isCorrect = showResult && norm(value) === norm(act.correctAnswer)
  const typed = String(value ?? '')

  const input = (
    <motion.input
      type="text"
      value={typed}
      onChange={e => !showResult && onChange(e.target.value)}
      disabled={showResult}
      placeholder="…"
      autoFocus
      animate={showResult ? (isCorrect ? { scale: [1, 1.06, 1] } : { x: [0, -5, 5, -3, 3, 0] }) : {}}
      transition={{ duration: 0.4, ease: EASE }}
      style={{ width: `${Math.max(6, typed.length + 2)}ch` }}
      className={`inline-block mx-1 text-center bg-surface-1 border-b-2 px-2 py-0.5 font-semibold align-baseline focus:outline-none disabled:opacity-100 ${
        showResult
          ? isCorrect
            ? 'border-feedback-correct text-feedback-correct'
            : 'border-feedback-error text-feedback-error'
          : 'border-accent text-ink-primary'
      }`}
    />
  )

  if (hasBlank) {
    return (
      <p className="text-xl sm:text-2xl leading-relaxed text-ink-primary">
        {parts[0]}
        {input}
        {parts.slice(1).join(' ')}
      </p>
    )
  }

  // Fallback: sin marcador de hueco → enunciado arriba + input debajo.
  return (
    <div>
      <p className="text-xl sm:text-2xl text-ink-primary mb-4">{act.question}</p>
      {input}
    </div>
  )
}

// ─── Respuesta corta — SHORT_ANSWER (escritura libre breve) ────────────────
function ShortAnswerBlock({ value, onChange, showResult }: BlockProps) {
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={e => !showResult && onChange(e.target.value)}
      disabled={showResult}
      placeholder="Escribe tu respuesta…"
      autoFocus
      className="w-full bg-surface-1 border border-hairline rounded-xl px-4 py-3 text-ink-primary placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent text-lg disabled:opacity-70"
    />
  )
}

// ─── Ordenar secuencias — ORDERING (arrastrar para reordenar) ──────────────
// Cada palabra/paso es una ficha con id único (tolera repetidas). Se arrastra
// verticalmente (framer Reorder, táctil). value expuesto = array de palabras.
function OrderWordsBlock({ act, value, onChange, showResult }: BlockProps) {
  const options = act.options || []

  // Orden inicial: el guardado (revisita) o uno barajado. Se calcula una vez.
  const initial = useMemo<{ id: number; w: string }[]>(() => {
    const base = Array.isArray(value) && value.length === options.length ? value : shuffle(options)
    return base.map((w, i) => ({ id: i, w }))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [items, setItems] = useState(initial)

  // Sincroniza el parent en el primer render si aún no hay respuesta.
  useEffect(() => {
    if (!Array.isArray(value)) onChange(initial.map(x => x.w))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const order = showResult && Array.isArray(value) && value.length ? value : items.map(x => x.w)
  const isCorrect = showResult && norm(order.join(' ')) === norm(act.correctAnswer)

  // Resultado: estático con color + sello táctil.
  if (showResult) {
    return (
      <div>
        <motion.ol
          animate={isCorrect ? { scale: [1, 1.01, 1] } : { x: [0, -6, 6, -4, 4, 0] }}
          transition={{ duration: 0.4, ease: EASE }}
          className="space-y-2"
        >
          {order.map((w, i) => (
            <li
              key={`${w}-${i}`}
              className={`flex items-center gap-3 p-3 rounded-xl border text-ink-primary ${
                isCorrect ? 'border-feedback-correct bg-feedback-correct/10' : 'border-feedback-error bg-feedback-error/10'
              }`}
            >
              <span className="text-ink-muted text-sm w-5 text-center">{i + 1}</span>
              <span className="flex-1">{w}</span>
            </li>
          ))}
        </motion.ol>
        {!isCorrect && act.correctAnswer && (
          <p className="text-ink-secondary text-sm mt-3">
            Correcto: <span className="text-feedback-correct font-medium">{act.correctAnswer}</span>
          </p>
        )}
      </div>
    )
  }

  return (
    <div>
      <p className="text-ink-muted text-sm mb-3">Arrastra para ordenar.</p>
      <Reorder.Group
        axis="y"
        values={items}
        onReorder={next => {
          setItems(next)
          onChange(next.map(x => x.w))
        }}
        className="space-y-2"
      >
        {items.map((item, i) => (
          <Reorder.Item
            key={item.id}
            value={item}
            className="flex items-center gap-3 p-3 rounded-xl border border-hairline bg-surface-1 text-ink-primary cursor-grab active:cursor-grabbing select-none"
          >
            <GripVertical className="w-4 h-4 text-ink-muted flex-shrink-0" />
            <span className="text-ink-muted text-sm w-5 text-center">{i + 1}</span>
            <span className="flex-1 text-sm sm:text-base font-medium">{item.w}</span>
          </Reorder.Item>
        ))}
      </Reorder.Group>
    </div>
  )
}

// ─── Emparejar ideas — MATCHING (conectar izquierda↔derecha) ───────────────
function MatchPairsBlock({ act, value, onChange, showResult }: BlockProps) {
  const pairs = useMemo(() => parsePairs(act.options), [act.options])
  const lefts = pairs.map(p => p.left)
  const rights = useMemo(() => shuffle(pairs.map(p => p.right)), [act.question]) // eslint-disable-line react-hooks/exhaustive-deps
  const assigned: Record<string, string> = value && typeof value === 'object' ? value : {}
  const [activeLeft, setActiveLeft] = useState<string | null>(null)

  const assign = (right: string) => {
    if (showResult || !activeLeft) return
    onChange({ ...assigned, [activeLeft]: right })
    setActiveLeft(null)
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Columna izquierda: los conceptos */}
      <div className="flex flex-col gap-2">
        {lefts.map(left => {
          const truth = pairs.find(p => p.left === left)?.right
          const chosen = assigned[left]
          const ok = showResult && norm(chosen) === norm(truth)
          const bad = showResult && chosen && !ok
          return (
            <button
              key={left}
              onClick={() => !showResult && setActiveLeft(left)}
              disabled={showResult}
              className={`text-left p-3 rounded-xl border text-ink-primary text-sm font-medium transition-colors ${
                bad
                  ? 'border-feedback-error bg-feedback-error/10'
                  : ok
                    ? 'border-feedback-correct bg-feedback-correct/10'
                    : activeLeft === left
                      ? 'border-accent ring-1 ring-accent bg-accent/5'
                      : 'border-hairline bg-surface-1'
              }`}
            >
              <span>{left}</span>
              {chosen && <span className="block text-xs text-ink-muted mt-1">→ {chosen}</span>}
            </button>
          )
        })}
      </div>

      {/* Columna derecha: los significados (barajados) */}
      <div className="flex flex-col gap-2">
        {rights.map(right => {
          const used = Object.values(assigned).includes(right)
          return (
            <button
              key={right}
              onClick={() => assign(right)}
              disabled={showResult || !activeLeft}
              className={`text-left p-3 rounded-xl border text-ink-primary text-sm font-medium transition-colors ${
                used ? 'border-accent/40 bg-surface-2 opacity-60' : 'border-hairline bg-surface-1'
              } ${!showResult && activeLeft ? 'hover:border-accent/50 hover:bg-surface-2' : ''}`}
            >
              {right}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Flashcards — estudio con RECUERDO ACTIVO (no releer, §1.2) ─────────────
// Frente → intenta recordar → voltea a comprobar → autoevalúa. Pares en
// `options` como "frente::reverso". Sin calificación (es estudio).
function FlashcardsBlock({ act }: BlockProps) {
  const cards = useMemo(() => parsePairs(act.options), [act.options])
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)

  if (cards.length === 0) return null
  const card = cards[i]
  const atEnd = i >= cards.length - 1

  const go = (delta: number) => {
    setFlipped(false)
    setI(p => Math.min(cards.length - 1, Math.max(0, p + delta)))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-ink-muted text-sm">Tarjeta {i + 1} de {cards.length}</span>
        <SpeakButton text={card.left} label="Oír" />
      </div>

      {/* La tarjeta (voltea al tocar) */}
      <AnimatePresence mode="wait">
        <motion.button
          key={`${i}-${flipped ? 'b' : 'f'}`}
          onClick={() => setFlipped(f => !f)}
          initial={{ opacity: 0, scale: 0.98, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.18, ease: EASE }}
          className={`w-full min-h-[168px] rounded-2xl border p-6 flex flex-col items-center justify-center gap-2 text-center ${
            flipped ? 'border-accent bg-accent/5' : 'border-hairline bg-surface-1'
          }`}
        >
          <span className="text-ink-muted text-xs uppercase tracking-wide">{flipped ? 'Reverso' : 'Frente'}</span>
          <span className="text-2xl font-bold text-ink-primary">{flipped ? card.right : card.left}</span>
          {!flipped && (
            <span className="inline-flex items-center gap-1 text-ink-muted text-xs mt-2">
              <RotateCcw className="w-3 h-3" /> Toca para voltear
            </span>
          )}
        </motion.button>
      </AnimatePresence>

      {/* Autoevaluación (recuerdo activo) tras voltear */}
      {flipped && !atEnd && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <span className="text-ink-secondary text-sm">¿Lo recordaste?</span>
          <button
            onClick={() => go(1)}
            className="px-4 py-1.5 rounded-lg border border-feedback-correct/40 text-feedback-correct text-sm font-medium hover:bg-feedback-correct/10 transition-colors"
          >
            Sí
          </button>
          <button
            onClick={() => go(1)}
            className="px-4 py-1.5 rounded-lg border border-hairline text-ink-secondary text-sm font-medium hover:bg-surface-2 transition-colors"
          >
            Todavía no
          </button>
        </div>
      )}

      {/* Navegación entre tarjetas */}
      <div className="flex items-center justify-between mt-4">
        <button
          onClick={() => go(-1)}
          disabled={i === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-hairline text-ink-secondary text-sm disabled:opacity-30 hover:bg-surface-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Anterior
        </button>
        <button
          onClick={() => go(1)}
          disabled={atEnd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-hairline text-ink-secondary text-sm disabled:opacity-30 hover:bg-surface-3 transition-colors"
        >
          Siguiente <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Escuchar y seleccionar — LISTENING (§3.3) ─────────────────────────────
// El alumno OYE la frase (TTS, texto oculto) y elige. Gradúa como MCQ.
function ListeningBlock(props: BlockProps) {
  return (
    <div>
      <div className="flex flex-col items-center gap-3 py-6 mb-4 rounded-2xl border border-hairline bg-surface-1">
        <span className="text-ink-secondary text-sm">Escucha y elige la respuesta</span>
        <SpeakButton text={props.act.question} label="Reproducir audio" className="px-4 py-2 text-sm" />
      </div>
      <ChoiceBlock {...props} />
    </div>
  )
}

// ─── Sopa de letras — WORDSEARCH (rejilla de palabras, §juegos) ────────────
// Motor genérico en `wordsearch.ts` (puro, testeable). El docente da la lista de
// palabras (en `options`); el alumno arrastra sobre las letras. Es completa (y
// correcta) cuando encuentra TODAS. value = array de palabras encontradas.
function WordSearchBlock({ act, value, onChange, showResult }: BlockProps) {
  const words = act.options || []
  const wordsKey = words.join('|')
  const { size, grid, placements } = useMemo(() => wsBuild(words), [wordsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const initialFound = useMemo(
    () => new Set<string>(Array.isArray(value) ? value.filter(v => words.includes(v)) : []),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const [found, setFound] = useState<Set<string>>(initialFound)
  const [sel, setSel] = useState<{ start: WSCell; cur: WSCell } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // En modo resultado se muestran TODAS las palabras resaltadas.
  const shownFound = showResult ? new Set(Object.keys(placements)) : found

  const cellFromEvent = (e: React.PointerEvent): WSCell | null => {
    const el = gridRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * size)
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * size)
    if (r < 0 || c < 0 || r >= size || c >= size) return null
    return { r, c }
  }

  const selCells = sel ? wsLine(sel.start, sel.cur, size) : []
  const selKey = new Set(selCells.map(c => `${c.r},${c.c}`))
  const foundKey = useMemo(() => {
    const s = new Set<string>()
    shownFound.forEach(w => (placements[w] || []).forEach(c => s.add(`${c.r},${c.c}`)))
    return s
  }, [shownFound, placements])

  const finishSel = () => {
    if (!sel) return
    const cells = wsLine(sel.start, sel.cur, size)
    const hit = wsMatch(cells, grid, words, found)
    if (hit) {
      const next = new Set(found); next.add(hit)
      setFound(next)
      onChange(Array.from(next))
    }
    setSel(null)
  }

  if (grid.length === 0) {
    return <p className="text-ink-muted text-sm">Añade palabras a esta sopa de letras.</p>
  }

  return (
    <div className="flex flex-col sm:flex-row gap-5 items-start">
      {/* Rejilla */}
      <div
        ref={gridRef}
        className="grid gap-0.5 select-none touch-none mx-auto"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, width: 'min(100%, 380px)', aspectRatio: '1 / 1' }}
        onPointerDown={e => { if (showResult) return; e.preventDefault(); const c = cellFromEvent(e); if (c) { setSel({ start: c, cur: c }); (e.target as HTMLElement).setPointerCapture?.(e.pointerId) } }}
        onPointerMove={e => { if (!sel || showResult) return; const c = cellFromEvent(e); if (c) setSel(s => (s ? { ...s, cur: c } : s)) }}
        onPointerUp={() => finishSel()}
        onPointerCancel={() => setSel(null)}
      >
        {grid.map((row, r) => row.map((ch, c) => {
          const k = `${r},${c}`
          const isSel = selKey.has(k)
          const isFound = foundKey.has(k)
          return (
            <div
              key={k}
              className={`flex items-center justify-center aspect-square rounded-[4px] font-bold uppercase leading-none transition-colors ${
                isSel ? 'bg-accent text-white'
                  : isFound ? 'bg-accent/20 text-accent'
                  : 'bg-surface-1 text-ink-primary'
              }`}
              style={{ fontSize: `clamp(10px, ${Math.floor(320 / size)}px, 18px)` }}
            >
              {ch}
            </div>
          )
        }))}
      </div>

      {/* Lista de palabras */}
      <div className="flex-shrink-0 w-full sm:w-40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-ink-muted text-xs uppercase tracking-wide">Palabras</span>
          <span className="text-ink-secondary text-xs font-semibold">{shownFound.size}/{words.length}</span>
        </div>
        <ul className="flex flex-wrap sm:flex-col gap-x-3 gap-y-1.5">
          {words.map(w => {
            const done = shownFound.has(w)
            return (
              <li
                key={w}
                className={`text-sm font-medium transition-colors ${done ? 'text-accent line-through' : 'text-ink-secondary'}`}
              >
                {done && <CheckCircle2 className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />}
                {w}
              </li>
            )
          })}
        </ul>
        {!showResult && (
          <p className="text-ink-muted text-xs mt-3">Arrastra sobre las letras para marcar cada palabra.</p>
        )}
      </div>
    </div>
  )
}

// ─── Crucigrama — CROSSWORD (tablero entrelazado con pistas) ───────────────
// Motor de layout en `crossword.ts` (puro). Pares "RESPUESTA::pista" en `options`.
// El alumno teclea; se resuelve al completar todas. value = array de respuestas.
function CrosswordBlock({ act, value, onChange, showResult }: BlockProps) {
  const items = useMemo(() => parsePairs(act.options).map(p => ({ answer: p.left, clue: p.right })), [act.options])
  const itemsKey = items.map(i => i.answer).join('|')
  const { rows, cols, solution, entries } = useMemo(() => cwBuild(items), [itemsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const [letters, setLetters] = useState<Record<string, string>>({})
  const [activeIdx, setActiveIdx] = useState<number | null>(entries.length ? 0 : null)
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})

  const key = (r: number, c: number) => r + ',' + c

  // Celda → nº de inicio y entradas que la contienen.
  const startNum = useMemo(() => {
    const m: Record<string, number> = {}
    entries.forEach(e => { const k = key(e.r, e.c); if (m[k] == null) m[k] = e.num })
    return m
  }, [entries])
  const cellEntries = useMemo(() => {
    const m: Record<string, { across?: number; down?: number }> = {}
    entries.forEach((e, idx) => e.cells.forEach(cell => {
      const k = key(cell.r, cell.c); m[k] = m[k] || {}
      m[k][e.dir] = idx
    }))
    return m
  }, [entries])

  const active = activeIdx != null ? entries[activeIdx] : null
  const activeCellKeys = useMemo(() => new Set((active?.cells || []).map(c => key(c.r, c.c))), [active])

  const solvedNow = showResult ? entries.map(e => e.answer) : cwSolved(entries, letters)
  const solvedSet = new Set(solvedNow)

  const setLetter = (r: number, c: number, ch: string) => {
    const v = ch.toUpperCase().replace(/[^A-ZÑ]/g, '').slice(-1)
    const next = { ...letters, [key(r, c)]: v }
    setLetters(next)
    onChange(cwSolved(entries, next))
    // avanzar a la siguiente celda de la entrada activa
    if (v && active) {
      const i = active.cells.findIndex(cell => cell.r === r && cell.c === c)
      const nxt = active.cells[i + 1]
      if (nxt) inputs.current[key(nxt.r, nxt.c)]?.focus()
    }
  }

  const onCellFocus = (r: number, c: number) => {
    const k = key(r, c)
    const ce = cellEntries[k]
    if (!ce) return
    // conservar dirección si la celda pertenece a la entrada activa; si no, across→down
    if (active && activeCellKeys.has(k)) return
    setActiveIdx(ce.across ?? ce.down ?? null)
  }

  const onCellKey = (e: React.KeyboardEvent, r: number, c: number) => {
    if (e.key === 'Backspace' && !letters[key(r, c)] && active) {
      const i = active.cells.findIndex(cell => cell.r === r && cell.c === c)
      const prev = active.cells[i - 1]
      if (prev) { e.preventDefault(); inputs.current[key(prev.r, prev.c)]?.focus() }
    }
  }

  if (rows === 0) {
    return <p className="text-ink-muted text-sm">Añade pares Respuesta::Pista a este crucigrama.</p>
  }

  const across = entries.filter(e => e.dir === 'across')
  const down = entries.filter(e => e.dir === 'down')

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* Tablero */}
      <div
        className="grid gap-0.5 mx-auto flex-shrink-0"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, width: `min(100%, ${cols * 34}px)` }}
      >
        {solution.map((row, r) => row.map((sol, c) => {
          const k = key(r, c)
          if (sol == null) return <div key={k} className="aspect-square" />
          const num = startNum[k]
          const inActive = activeCellKeys.has(k)
          const shown = showResult ? sol : (letters[k] || '')
          const cellSolved = showResult || (shown === sol && (cellEntries[k]?.across != null || cellEntries[k]?.down != null) && [cellEntries[k]?.across, cellEntries[k]?.down].some(idx => idx != null && solvedSet.has(entries[idx!].answer)))
          return (
            <div key={k} className="relative aspect-square">
              {num != null && (
                <span className="absolute top-0 left-0.5 text-[8px] leading-none text-ink-muted z-10 pointer-events-none">{num}</span>
              )}
              <input
                ref={el => { inputs.current[k] = el }}
                value={shown}
                maxLength={1}
                disabled={showResult}
                onChange={e => setLetter(r, c, e.target.value)}
                onFocus={() => onCellFocus(r, c)}
                onKeyDown={e => onCellKey(e, r, c)}
                className={`w-full h-full text-center uppercase font-bold rounded-[3px] border focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-100 ${
                  showResult || cellSolved
                    ? 'bg-feedback-correct/15 border-feedback-correct/40 text-feedback-correct'
                    : inActive
                      ? 'bg-accent/10 border-accent/50 text-ink-primary'
                      : 'bg-surface-1 border-hairline text-ink-primary'
                }`}
                style={{ fontSize: 'clamp(11px, 3.5vw, 16px)' }}
              />
            </div>
          )
        }))}
      </div>

      {/* Pistas */}
      <div className="flex-1 w-full grid sm:grid-cols-2 lg:grid-cols-1 gap-x-6 gap-y-4 min-w-0">
        {[{ t: 'Horizontales', list: across }, { t: 'Verticales', list: down }].map(g => g.list.length > 0 && (
          <div key={g.t}>
            <h4 className="text-ink-muted text-xs uppercase tracking-wide mb-2">{g.t}</h4>
            <ul className="space-y-1.5">
              {g.list.map(e => {
                const idx = entries.indexOf(e)
                const done = solvedSet.has(e.answer)
                return (
                  <li key={`${e.num}-${e.dir}`}>
                    <button
                      onClick={() => { setActiveIdx(idx); const f = e.cells.find(cell => !letters[key(cell.r, cell.c)]) || e.cells[0]; inputs.current[key(f.r, f.c)]?.focus() }}
                      className={`text-left text-sm w-full transition-colors ${done ? 'text-feedback-correct' : activeIdx === idx ? 'text-accent font-medium' : 'text-ink-secondary hover:text-ink-primary'}`}
                    >
                      <span className="font-semibold tabular-nums">{e.num}.</span>{' '}
                      {done && <CheckCircle2 className="inline w-3.5 h-3.5 mr-0.5 -mt-0.5" />}
                      {e.clue || '—'} <span className="text-ink-muted">({e.cl.length})</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Memory — MEMORY (parejas / concentración) ─────────────────────────────
// Pares "izq::der" en `options` (como emparejar). Cada par = 2 cartas boca abajo;
// el alumno voltea dos: si son pareja se quedan, si no se ocultan. Completa/correcta
// al emparejar TODAS. value = izquierdas emparejadas (grading layout-independiente).
type MemoryCard = { id: number; pair: number; text: string }
function MemoryBlock({ act, value, onChange, showResult }: BlockProps) {
  const pairs = useMemo(() => parsePairs(act.options), [act.options])
  const deck = useMemo<MemoryCard[]>(
    () => shuffle(pairs.flatMap((p, i) => [{ id: i * 2, pair: i, text: p.left }, { id: i * 2 + 1, pair: i, text: p.right }])),
    [act.options] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const [matched, setMatched] = useState<Set<number>>(() => {
    const s = new Set<number>()
    if (Array.isArray(value)) pairs.forEach((p, i) => { if (value.includes(p.left)) s.add(i) })
    return s
  })
  const [flipped, setFlipped] = useState<number[]>([])
  const [lock, setLock] = useState(false)

  const shownMatched = showResult ? new Set(pairs.map((_, i) => i)) : matched

  const clickCard = (card: MemoryCard) => {
    if (showResult || lock) return
    if (shownMatched.has(card.pair) || flipped.includes(card.id) || flipped.length >= 2) return
    const next = [...flipped, card.id]
    setFlipped(next)
    if (next.length === 2) {
      const a = deck.find(c => c.id === next[0])!, b = deck.find(c => c.id === next[1])!
      if (a.pair === b.pair) {
        const nm = new Set(matched); nm.add(a.pair)
        setMatched(nm); setFlipped([])
        onChange(Array.from(nm).map(i => pairs[i].left))
      } else {
        setLock(true)
        setTimeout(() => { setFlipped([]); setLock(false) }, 850)
      }
    }
  }

  if (pairs.length === 0) return <p className="text-ink-muted text-sm">Añade parejas a este juego de memoria.</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-ink-muted text-sm">Voltea dos cartas y encuentra las parejas.</span>
        <span className="text-ink-secondary text-sm font-semibold tabular-nums">{shownMatched.size}/{pairs.length}</span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
        {deck.map(card => {
          const up = showResult || shownMatched.has(card.pair) || flipped.includes(card.id)
          const done = shownMatched.has(card.pair)
          return (
            <motion.button
              key={card.id}
              onClick={() => clickCard(card)}
              disabled={showResult}
              animate={done ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 0.35, ease: EASE }}
              className={`aspect-[3/4] rounded-xl border-2 flex items-center justify-center p-2 text-center text-sm font-semibold leading-tight transition-colors ${
                up
                  ? done
                    ? 'bg-feedback-correct/10 border-feedback-correct text-feedback-correct'
                    : 'bg-accent/5 border-accent text-ink-primary'
                  : 'bg-surface-2 border-hairline text-ink-muted hover:border-accent/50'
              }`}
            >
              {up ? <span>{card.text}</span> : <span className="text-xl text-ink-muted/60">?</span>}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Etiquetar sobre imagen — LABEL_IMAGE (Ciencias / Geografía) ────────────
// Imagen de fondo (act.imageUrl) + puntos "etiqueta::x::y" en `options` (x,y en %).
// El alumno toca una etiqueta y luego su punto. value = etiquetas por punto (orden).
function LabelImageBlock({ act, value, onChange, showResult }: BlockProps) {
  const spots = useMemo(() => parseHotspots(act.options), [act.options])
  const labels = useMemo(() => shuffle(spots.map(s => s.label)), [act.options]) // eslint-disable-line react-hooks/exhaustive-deps
  const [assigned, setAssigned] = useState<string[]>(() => (Array.isArray(value) ? [...value] : spots.map(() => '')))
  const [activeLabel, setActiveLabel] = useState<string | null>(null)
  const imgUrl = useResolvedMediaUrl(act.imageUrl)

  if (!act.imageUrl) return <p className="text-ink-muted text-sm">Añade una imagen y marca los puntos a etiquetar.</p>
  if (spots.length === 0) return <p className="text-ink-muted text-sm">Marca al menos un punto en la imagen.</p>

  const assign = (i: number) => {
    if (showResult || !activeLabel) return
    const next = assigned.map(a => (a === activeLabel ? '' : a)) // cada etiqueta una vez
    while (next.length < spots.length) next.push('')
    next[i] = activeLabel
    setAssigned(next); setActiveLabel(null); onChange(next)
  }

  const used = new Set(assigned.filter(Boolean))

  return (
    <div>
      <div className="relative inline-block max-w-full rounded-xl overflow-hidden border border-hairline bg-surface-2">
        <img src={imgUrl} alt="" className="block max-w-full select-none" draggable={false} />
        {spots.map((s, i) => {
          const lbl = showResult ? s.label : assigned[i]
          const ok = showResult && norm(assigned[i]) === norm(s.label)
          const bad = showResult && !!assigned[i] && !ok
          return (
            <button
              key={i}
              onClick={() => assign(i)}
              disabled={showResult}
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 min-w-[24px] h-6 px-1.5 rounded-full text-[11px] font-bold border-2 flex items-center justify-center whitespace-nowrap shadow ${
                ok ? 'bg-feedback-correct text-white border-white'
                  : bad ? 'bg-feedback-error text-white border-white'
                    : lbl ? 'bg-accent text-white border-white'
                      : 'bg-white text-accent border-accent'
              }`}
            >
              {lbl || i + 1}
            </button>
          )
        })}
      </div>

      {!showResult ? (
        <div className="mt-4">
          <p className="text-ink-muted text-sm mb-2">Toca una etiqueta y luego su punto en la imagen.</p>
          <div className="flex flex-wrap gap-2">
            {labels.map((l, k) => (
              <button
                key={`${l}-${k}`}
                onClick={() => setActiveLabel(l)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  activeLabel === l
                    ? 'border-accent ring-1 ring-accent bg-accent/5 text-ink-primary'
                    : used.has(l)
                      ? 'border-hairline bg-surface-2 text-ink-muted opacity-50'
                      : 'border-hairline bg-surface-1 text-ink-primary hover:border-accent/50'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-ink-secondary text-sm mt-3">Se muestran las etiquetas correctas.</p>
      )}
    </div>
  )
}

// ─── Rompecabezas — PUZZLE (armar la imagen) ───────────────────────────────
// Imagen (act.imageUrl) partida en rejilla N×N (options[0]=N). Se baraja; el alumno
// intercambia piezas hasta reconstruirla. value = arreglo actual; resuelto = identidad.
function PuzzleBlock({ act, value, onChange, showResult }: BlockProps) {
  const n = parseInt(act.options?.[0] || '3') || 3
  const total = n * n
  const [arr, setArr] = useState<number[]>(() => {
    if (Array.isArray(value) && value.length === total) return [...value]
    let a = shuffle(Array.from({ length: total }, (_, i) => i))
    let tries = 0
    while (a.every((v, i) => v === i) && tries++ < 6) a = shuffle(a)
    return a
  })
  const [sel, setSel] = useState<number | null>(null)
  const imgUrl = useResolvedMediaUrl(act.imageUrl)

  if (!act.imageUrl) return <p className="text-ink-muted text-sm">Añade una imagen para armar el rompecabezas.</p>

  const shown = showResult ? Array.from({ length: total }, (_, i) => i) : arr
  const solved = shown.every((v, i) => v === i)

  const clickPos = (pos: number) => {
    if (showResult) return
    if (sel === null) { setSel(pos); return }
    if (sel === pos) { setSel(null); return }
    const next = [...arr]
    const tmp = next[sel]; next[sel] = next[pos]; next[pos] = tmp
    setArr(next); setSel(null); onChange(next)
  }

  return (
    <div>
      <div
        className="grid gap-0.5 mx-auto rounded-xl overflow-hidden border border-hairline"
        style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, width: 'min(100%, 360px)', aspectRatio: '1 / 1' }}
      >
        {shown.map((tile, pos) => {
          const r = Math.floor(tile / n), c = tile % n
          return (
            <button
              key={pos}
              onClick={() => clickPos(pos)}
              disabled={showResult}
              className={`aspect-square transition-all ${sel === pos ? 'ring-4 ring-accent ring-inset z-10' : ''} ${!showResult && !solved ? 'hover:brightness-110' : ''}`}
              style={{
                backgroundImage: imgUrl ? `url(${imgUrl})` : undefined,
                backgroundSize: `${n * 100}% ${n * 100}%`,
                backgroundPosition: `${n > 1 ? (c / (n - 1)) * 100 : 0}% ${n > 1 ? (r / (n - 1)) * 100 : 0}%`,
              }}
            />
          )
        })}
      </div>
      {!showResult && (
        <p className="text-ink-muted text-sm mt-3 text-center">
          {solved ? '¡Completo! Pulsa Comprobar.' : 'Toca dos piezas para intercambiarlas.'}
        </p>
      )}
    </div>
  )
}

// ─── Switch por tipo → bloque puro ─────────────────────────────────────────
export function BlockRenderer(props: BlockProps) {
  switch (props.act.questionType) {
    case 'FILL_BLANK':
      return <InlineBlankBlock {...props} />
    case 'SHORT_ANSWER':
      return <ShortAnswerBlock {...props} />
    case 'ORDERING':
      return <OrderWordsBlock {...props} />
    case 'MATCHING':
      return <MatchPairsBlock {...props} />
    case 'FLASHCARDS':
      return <FlashcardsBlock {...props} />
    case 'LISTENING':
      return <ListeningBlock {...props} />
    case 'WORDSEARCH':
      return <WordSearchBlock {...props} />
    case 'CROSSWORD':
      return <CrosswordBlock {...props} />
    case 'MEMORY':
      return <MemoryBlock {...props} />
    case 'LABEL_IMAGE':
      return <LabelImageBlock {...props} />
    case 'PUZZLE':
      return <PuzzleBlock {...props} />
    case 'MULTIPLE_CHOICE':
    case 'TRUE_FALSE':
    default:
      return <ChoiceBlock {...props} />
  }
}

// Las flashcards son estudio, no se "comprueban" → no requieren envío ni grading.
export function requiresSubmission(questionType?: string): boolean {
  return questionType !== 'FLASHCARDS'
}


// El bloque inline aloja el enunciado dentro de sí (la frase con el hueco),
// así el player no debe renderizar el <h3> de la pregunta por separado.
export function blockHostsQuestion(questionType: string) {
  // FILL_BLANK aloja la frase con el hueco; LISTENING oculta el texto (se OYE).
  return questionType === 'FILL_BLANK' || questionType === 'LISTENING'
}
