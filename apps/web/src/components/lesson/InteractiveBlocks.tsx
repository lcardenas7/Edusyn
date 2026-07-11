import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════
// INTERACTIVE BLOCKS (DS-1)
// ─────────────────────────────────────────────────────────────────────────
// Bloques puros de interacción. Reciben el estado desde el player; no conocen
// la API ni el avance. Un BlockRenderer hace el switch por tipo → bloque puro.
// Sello táctil: la respuesta correcta se asienta, la incorrecta tiembla.
// Ver LEARNING_EXPERIENCE_SPEC.md §3 y DESIGN_SYSTEM_LEARNING.md §3/§5.
// ═══════════════════════════════════════════════════════════════════════════

export interface ActivityData {
  questionType: string
  question: string
  options?: string[]
  correctAnswer?: string
  explanation?: string
  points?: number
  hint?: string
}

interface BlockProps {
  act: ActivityData
  value: any
  onChange: (v: any) => void
  showResult: boolean
}

const EASE = [0.2, 0.8, 0.2, 1] as const

function norm(s: any) {
  return String(s ?? '').trim().toLowerCase()
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

// ─── Switch por tipo → bloque puro ─────────────────────────────────────────
export function BlockRenderer(props: BlockProps) {
  switch (props.act.questionType) {
    case 'FILL_BLANK':
      return <InlineBlankBlock {...props} />
    case 'SHORT_ANSWER':
      return <ShortAnswerBlock {...props} />
    case 'MULTIPLE_CHOICE':
    case 'TRUE_FALSE':
    default:
      return <ChoiceBlock {...props} />
  }
}

// El bloque inline aloja el enunciado dentro de sí (la frase con el hueco),
// así el player no debe renderizar el <h3> de la pregunta por separado.
export function blockHostsQuestion(questionType: string) {
  return questionType === 'FILL_BLANK'
}
