import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronRight,
  Clock, Flag, Loader2, Lock, Play, Trophy, Volume2, VolumeX, X, Sparkles, AlertTriangle
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { lessonApi, type Lesson, type LessonSlide, type LessonProgress } from '../lib/api'
import { Stage } from './lesson/Stage'
import { BlockRenderer, blockHostsQuestion, gradeAnswer, isAnswerComplete, requiresSubmission } from './lesson/InteractiveBlocks'
import { SpeakButton, stripHtml } from './lesson/SpeakButton'
import { SmartImg, SmartVideo, SmartAudio } from './media/SmartMedia'
import { BlockStackView, blocksToPlainText } from './lesson/blocks'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface LessonPlayerProps {
  activityId: string
  onClose: () => void
  isTeacher?: boolean
}

type Phase = 'loading' | 'intro' | 'playing' | 'completed'

interface SlideResult {
  answer: any
  isCorrect: boolean
  points: number
  maxPoints: number
}

// ═══════════════════════════════════════════════════════════════════════════
// SOUNDS
// ═══════════════════════════════════════════════════════════════════════════

let audioCtx: AudioContext | null = null
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

function playSound(type: 'correct' | 'wrong' | 'advance' | 'complete' | 'checkpoint') {
  try {
    const ctx = getAudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    gain.gain.value = 0.15

    if (type === 'correct') {
      osc.frequency.value = 880
      osc.type = 'sine'
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.start(); osc.stop(ctx.currentTime + 0.3)
    } else if (type === 'wrong') {
      osc.frequency.value = 220
      osc.type = 'sawtooth'
      gain.gain.value = 0.1
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
      osc.start(); osc.stop(ctx.currentTime + 0.4)
    } else if (type === 'advance') {
      osc.frequency.value = 523
      osc.type = 'sine'
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
      osc.start(); osc.stop(ctx.currentTime + 0.15)
    } else if (type === 'checkpoint') {
      osc.frequency.value = 660
      osc.type = 'sine'
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      osc.start(); osc.stop(ctx.currentTime + 0.5)
    } else if (type === 'complete') {
      osc.frequency.value = 1046
      osc.type = 'sine'
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8)
      osc.start(); osc.stop(ctx.currentTime + 0.8)
    }
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function LessonPlayer({ activityId, onClose, isTeacher = false }: LessonPlayerProps) {
  const [phase, setPhase] = useState<Phase>('loading')
  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [progress, setProgress] = useState<LessonProgress | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [error, setError] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [slideStartTime, setSlideStartTime] = useState(Date.now())

  // Activity answer state
  const [selectedAnswer, setSelectedAnswer] = useState<any>(null)
  const [answerSubmitted, setAnswerSubmitted] = useState(false)
  const [slideResult, setSlideResult] = useState<SlideResult | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [attempts, setAttempts] = useState(0) // intentos en la actividad actual (P4)

  // Loading states
  const [advancing, setAdvancing] = useState(false)

  // Gamificación: toast flotante de XP ganado / subida de nivel
  const [xpToast, setXpToast] = useState<{ awarded: number; leveledUp: boolean; level: number | null } | null>(null)
  const xpToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Insignias recién ganadas (celebración destacada)
  const [badgeToast, setBadgeToast] = useState<{ emoji: string; name: string; description: string } | null>(null)
  const badgeToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  // ─────────────────────────────────────────────────────────────────
  // LOAD
  // ─────────────────────────────────────────────────────────────────

  const loadLesson = useCallback(async () => {
    try {
      setPhase('loading')
      const { data: lessonData } = await lessonApi.getByActivity(activityId)
      setLesson(lessonData)

      if (!isTeacher) {
        const { data: prog } = await lessonApi.getMyProgress(lessonData.id)
        setProgress(prog)

        if (prog.status === 'COMPLETED') {
          setCurrentIndex(lessonData.slides.length - 1)
          setPhase('completed')
        } else if (prog.status === 'IN_PROGRESS') {
          // Resume from last checkpoint if they left mid-lesson
          setCurrentIndex(prog.lastCheckpointIndex || prog.currentSlideIndex || 0)
          setPhase('playing')
        } else {
          setPhase('intro')
        }
      } else {
        setPhase('intro')
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al cargar la lección')
      setPhase('intro')
    }
  }, [activityId, isTeacher])

  useEffect(() => { loadLesson() }, [loadLesson])

  // ─────────────────────────────────────────────────────────────────
  // DERIVED
  // ─────────────────────────────────────────────────────────────────

  const slides = useMemo(() => lesson?.slides || [], [lesson])
  const totalSlides = slides.length
  const currentSlide = slides[currentIndex] as LessonSlide | undefined
  const completedSlides: string[] = useMemo(() =>
    Array.isArray(progress?.completedSlides) ? (progress!.completedSlides as string[]) : [],
  [progress?.completedSlides])
  const answers: Record<string, SlideResult> = useMemo(() =>
    (progress?.answers || {}) as Record<string, SlideResult>,
  [progress?.answers])
  const progressPercent = totalSlides > 0 ? Math.round(completedSlides.length / totalSlides * 100) : 0

  const isSlideCompleted = currentSlide ? completedSlides.includes(currentSlide.id) : false
  const hasAnswered = currentSlide ? !!answers[currentSlide.id] : false

  // Comportamiento configurable de la actividad (P4): obligatoria/opcional, gating
  // (no avanzar hasta acertar) e intentos.
  const behavior = (currentSlide?.activityData as any)?.behavior || {}
  const isOptionalAct = behavior.required === false
  const isGated = !!behavior.gateOnCorrect
  const maxAttempts = Number(behavior.maxAttempts) || 0 // 0 = ilimitado
  const attemptsExhausted = maxAttempts > 0 && attempts >= maxAttempts
  const answeredCorrect = slideResult?.isCorrect === true
  const canRetry = isGated && answerSubmitted && !answeredCorrect && !attemptsExhausted

  // ─────────────────────────────────────────────────────────────────
  // START
  // ─────────────────────────────────────────────────────────────────

  const handleStart = async () => {
    if (!lesson) return
    if (!isTeacher) {
      try {
        const { data: prog } = await lessonApi.start(lesson.id)
        setProgress(prog)
      } catch {}
    }
    setCurrentIndex(0)
    setPhase('playing')
    setSlideStartTime(Date.now())
  }

  // ─────────────────────────────────────────────────────────────────
  // ADVANCE / NAVIGATE
  // ─────────────────────────────────────────────────────────────────

  const handleAdvance = async () => {
    if (!lesson || !currentSlide || advancing) return

    const timeSpent = Math.round((Date.now() - slideStartTime) / 1000)

    // Gating (P4): las flashcards no requieren envío; las opcionales se pueden
    // saltar; las obligatorias exigen responder; y si "no avanzar hasta acertar"
    // está activo, se exige acierto (o agotar los intentos).
    if (
      currentSlide.type === 'ACTIVITY' &&
      requiresSubmission(currentSlide.activityData?.questionType) &&
      !isTeacher && !isOptionalAct
    ) {
      if (!answerSubmitted && !hasAnswered) return
      if (isGated && !hasAnswered && !answeredCorrect && !attemptsExhausted) return
    }

    if (!isTeacher) {
      try {
        setAdvancing(true)
        const { data } = await lessonApi.advance(lesson.id, {
          slideIndex: currentIndex,
          slideId: currentSlide.id,
          answer: currentSlide.type === 'ACTIVITY' && requiresSubmission(currentSlide.activityData?.questionType)
            ? selectedAnswer
            : undefined,
          attempt: attempts || 1,
          timeSpentDelta: timeSpent,
        })
        // Update local progress
        if (data) {
          setProgress(prev => ({
            ...prev!,
            currentSlideIndex: data.currentSlideIndex ?? currentIndex + 1,
            completedSlides: data.completedSlides || [...completedSlides, currentSlide.id],
            answers: data.answers || prev?.answers || {},
            score: data.score ?? prev?.score ?? 0,
            maxScore: data.maxScore ?? prev?.maxScore ?? 0,
            lastCheckpointIndex: data.lastCheckpointIndex ?? prev?.lastCheckpointIndex ?? 0,
            timeSpentSeconds: data.timeSpentSeconds ?? prev?.timeSpentSeconds ?? 0,
            badgeEarned: data.badgeEarned ?? false,
            status: data.status ?? prev?.status ?? 'IN_PROGRESS',
          } as LessonProgress))

          // Gamificación: mostrar XP ganado (dominio/completar) y subida de nivel
          if (data.xp && data.xp.awarded > 0) {
            setXpToast({ awarded: data.xp.awarded, leveledUp: !!data.xp.leveledUp, level: data.xp.level ?? null })
            if (data.xp.leveledUp) confetti({ particleCount: 120, spread: 90, origin: { y: 0.3 } })
            if (xpToastTimer.current) clearTimeout(xpToastTimer.current)
            xpToastTimer.current = setTimeout(() => setXpToast(null), 2600)
          }
          // Insignias recién ganadas: celebración destacada (una a la vez)
          if (data.xp?.newBadges && data.xp.newBadges.length > 0) {
            const b = data.xp.newBadges[0]
            setBadgeToast({ emoji: b.emoji, name: b.name, description: b.description })
            confetti({ particleCount: 160, spread: 100, origin: { y: 0.4 } })
            if (badgeToastTimer.current) clearTimeout(badgeToastTimer.current)
            badgeToastTimer.current = setTimeout(() => setBadgeToast(null), 4200)
          }

          if (data.isComplete) {
            if (soundEnabled) playSound('complete')
            confetti({ particleCount: 200, spread: 120, origin: { y: 0.6 } })
            setPhase('completed')
            return
          }
        }
      } catch (err: any) {
        console.error('Error advancing:', err)
      } finally {
        setAdvancing(false)
      }
    }

    // Move to next slide
    if (currentIndex < totalSlides - 1) {
      const nextSlide = slides[currentIndex + 1]
      if (soundEnabled) {
        if (nextSlide?.type === 'CHECKPOINT') playSound('checkpoint')
        else playSound('advance')
      }
      setCurrentIndex(currentIndex + 1)
      setSelectedAnswer(null)
      setAnswerSubmitted(false)
      setSlideResult(null)
      setShowExplanation(false)
      setAttempts(0)
      setSlideStartTime(Date.now())
    } else if (isTeacher) {
      // Teacher preview finished
      setPhase('completed')
    }
  }

  const handleGoBack = () => {
    if (currentIndex > 0) {
      // Can only go back to already completed slides
      const prevIndex = currentIndex - 1
      if (isTeacher || completedSlides.includes(slides[prevIndex]?.id)) {
        setCurrentIndex(prevIndex)
        setSelectedAnswer(null)
        setAnswerSubmitted(false)
        setSlideResult(null)
        setShowExplanation(false)
        setAttempts(0)
        setSlideStartTime(Date.now())
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // SUBMIT ANSWER
  // ─────────────────────────────────────────────────────────────────

  const handleSubmitAnswer = () => {
    if (!currentSlide?.activityData) return

    const actData = currentSlide.activityData
    if (!isAnswerComplete(actData, selectedAnswer)) return

    // Grading por tipo (MCQ, completar, ordenar, emparejar…) — un solo juez.
    const isCorrect = gradeAnswer(actData, selectedAnswer)
    const points = actData.points || 10

    const result: SlideResult = {
      answer: selectedAnswer,
      isCorrect,
      points: isCorrect ? points : 0,
      maxPoints: points,
    }

    setAttempts(a => a + 1)
    setSlideResult(result)
    setAnswerSubmitted(true)
    if (soundEnabled) playSound(isCorrect ? 'correct' : 'wrong')
    if (isCorrect) {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } })
    }
  }

  // Reintentar la actividad actual (mantiene el contador de intentos, P4).
  const handleRetry = () => {
    setSelectedAnswer(null)
    setAnswerSubmitted(false)
    setSlideResult(null)
    setShowExplanation(false)
  }

  // ─────────────────────────────────────────────────────────────────
  // PREVENT EXIT (beforeunload)
  // ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== 'playing' || isTeacher) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '¿Seguro que quieres salir? Tu progreso se guardará en el último checkpoint.'
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [phase, isTeacher])

  // Limpiar timers de toasts al desmontar
  useEffect(() => () => {
    if (xpToastTimer.current) clearTimeout(xpToastTimer.current)
    if (badgeToastTimer.current) clearTimeout(badgeToastTimer.current)
  }, [])

  // ─────────────────────────────────────────────────────────────────
  // RENDER: LOADING
  // ─────────────────────────────────────────────────────────────────

  if (phase === 'loading') {
    return (
      <div data-skill="reading" className="fixed inset-0 z-[100] bg-canvas flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center text-ink-secondary"
        >
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-accent" />
          <p className="text-base font-medium">Cargando lección...</p>
        </motion.div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER: INTRO SCREEN
  // ─────────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <div data-skill="reading" className="fixed inset-0 z-[100] bg-canvas flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full"
        >
          {/* Close button */}
          <button onClick={onClose} className="absolute top-4 right-4 text-ink-muted hover:text-ink-primary p-2">
            <X className="w-6 h-6" />
          </button>

          {/* Badge preview */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
            className="w-24 h-24 mx-auto mb-6 rounded-3xl flex items-center justify-center text-5xl shadow-lg"
            style={{ backgroundColor: lesson?.badgeColor || '#8B5CF6' }}
          >
            {lesson?.badgeEmoji || '🏆'}
          </motion.div>

          <h1 className="text-3xl font-black text-ink-primary text-center mb-2">
            {lesson?.title || 'Lección'}
          </h1>

          {lesson?.description && (
            <p className="text-ink-secondary text-center mb-6 text-sm leading-relaxed">
              {lesson.description}
            </p>
          )}

          {error && (
            <div className="bg-feedback-error/10 border border-feedback-error/30 rounded-xl p-3 mb-4 text-feedback-error text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-surface-2 border border-hairline rounded-xl p-3 text-center">
              <BookOpen className="w-5 h-5 text-skill-reading mx-auto mb-1" />
              <p className="text-ink-primary font-bold text-lg">{totalSlides}</p>
              <p className="text-ink-muted text-xs">Slides</p>
            </div>
            <div className="bg-surface-2 border border-hairline rounded-xl p-3 text-center">
              <Sparkles className="w-5 h-5 text-skill-writing mx-auto mb-1" />
              <p className="text-ink-primary font-bold text-lg">
                {slides.filter(s => s.type === 'ACTIVITY').length}
              </p>
              <p className="text-ink-muted text-xs">Actividades</p>
            </div>
            <div className="bg-surface-2 border border-hairline rounded-xl p-3 text-center">
              <Clock className="w-5 h-5 text-skill-listening mx-auto mb-1" />
              <p className="text-ink-primary font-bold text-lg">{lesson?.estimatedMinutes || '~5'}</p>
              <p className="text-ink-muted text-xs">Minutos</p>
            </div>
          </div>

          {/* Resume info */}
          {progress && progress.status === 'IN_PROGRESS' && (
            <div className="bg-feedback-warn/10 border border-feedback-warn/30 rounded-xl p-3 mb-4 text-feedback-warn text-sm text-center">
              <Flag className="w-4 h-4 inline mr-1" />
              Tienes progreso guardado ({progressPercent}%). Continuarás desde el último punto de control.
            </div>
          )}

          {/* Start button */}
          <motion.button
            onClick={handleStart}
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 bg-accent text-white font-bold text-lg rounded-2xl shadow-lg flex items-center justify-center gap-3"
          >
            <Play className="w-6 h-6" />
            {progress?.status === 'IN_PROGRESS' ? 'Continuar lección' : isTeacher ? 'Vista previa' : 'Iniciar lección'}
          </motion.button>

          {isTeacher && (
            <p className="text-ink-muted text-xs text-center mt-3">
              Modo vista previa — el progreso no se guardará
            </p>
          )}
        </motion.div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER: COMPLETED
  // ─────────────────────────────────────────────────────────────────

  if (phase === 'completed') {
    const score = Number(progress?.score || 0)
    const maxScore = Number(progress?.maxScore || 0)
    const scorePercent = maxScore > 0 ? Math.round(score / maxScore * 100) : 100

    return (
      <div data-skill="reading" className="fixed inset-0 z-[100] bg-canvas flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', bounce: 0.4 }}
          className="max-w-md w-full text-center"
        >
          {/* Badge */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', bounce: 0.6, delay: 0.3 }}
            className="w-32 h-32 mx-auto mb-6 rounded-3xl flex items-center justify-center text-7xl shadow-xl ring-4 ring-hairline"
            style={{ backgroundColor: lesson?.badgeColor || '#8B5CF6' }}
          >
            {lesson?.badgeEmoji || '🏆'}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-3xl font-black text-ink-primary mb-2"
          >
            {isTeacher ? 'Vista previa completada' : '¡Lección completada!'}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-ink-secondary mb-6"
          >
            {lesson?.badgeTitle || 'Has desbloqueado una insignia'}
          </motion.p>

          {/* Score card */}
          {maxScore > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-surface-2 border border-hairline rounded-2xl p-6 mb-6"
            >
              <div className="text-5xl font-black text-ink-primary mb-2">
                {score}<span className="text-2xl text-ink-muted">/{maxScore}</span>
              </div>
              <div className="w-full h-3 bg-surface-3 rounded-full overflow-hidden mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${scorePercent}%` }}
                  transition={{ duration: 1, delay: 0.8 }}
                  className={`h-full rounded-full ${scorePercent >= 80 ? 'bg-feedback-correct' : scorePercent >= 50 ? 'bg-feedback-warn' : 'bg-feedback-error'}`}
                />
              </div>
              <p className="text-ink-muted text-sm">
                {scorePercent >= 80 ? '¡Excelente trabajo!' : scorePercent >= 50 ? '¡Buen esfuerzo!' : 'Sigue practicando'}
              </p>
            </motion.div>
          )}

          {/* Stats */}
          {progress && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="grid grid-cols-2 gap-3 mb-6"
            >
              <div className="bg-surface-2 border border-hairline rounded-xl p-3">
                <p className="text-ink-muted text-xs">Tiempo</p>
                <p className="text-ink-primary font-bold">
                  {Math.floor((progress.timeSpentSeconds || 0) / 60)}m {(progress.timeSpentSeconds || 0) % 60}s
                </p>
              </div>
              <div className="bg-surface-2 border border-hairline rounded-xl p-3">
                <p className="text-ink-muted text-xs">Actividades</p>
                <p className="text-ink-primary font-bold">
                  {slides.filter(s => s.type === 'ACTIVITY').length} completadas
                </p>
              </div>
            </motion.div>
          )}

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            onClick={onClose}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 bg-accent text-white font-bold text-lg rounded-2xl shadow-lg"
          >
            Volver al aula
          </motion.button>
        </motion.div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER: PLAYING
  // ─────────────────────────────────────────────────────────────────

  const canAdvance = (() => {
    if (!currentSlide) return false
    if (isTeacher) return true
    if (currentSlide.type === 'CONTENT' || currentSlide.type === 'CHECKPOINT') return true
    if (currentSlide.type === 'BADGE_REVEAL') return true
    if (currentSlide.type === 'ACTIVITY') {
      if (!requiresSubmission(currentSlide.activityData?.questionType)) return true // flashcards
      if (isOptionalAct) return true // opcional: se puede saltar
      if (!(answerSubmitted || hasAnswered)) return false
      if (isGated && !hasAnswered) return answeredCorrect || attemptsExhausted // no avanzar sin acertar
      return true
    }
    return false
  })()

  const canGoBack = currentIndex > 0 && (isTeacher || completedSlides.includes(slides[currentIndex - 1]?.id))

  return (
    <div
      ref={containerRef}
      data-skill="reading"
      className="fixed inset-0 z-[100] bg-canvas flex flex-col select-none"
    >
      {/* XP TOAST (gamificación) */}
      {xpToast && (
        <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-[120] animate-bounce">
          <div className={`flex flex-col items-center gap-1 rounded-2xl px-6 py-3 shadow-xl border ${xpToast.leveledUp ? 'bg-feedback-warn/15 border-feedback-warn/40 text-feedback-warn' : 'bg-surface-1 border-hairline text-accent'}`}>
            <span className="text-2xl font-black tracking-tight">+{xpToast.awarded} XP</span>
            {xpToast.leveledUp && (
              <span className="text-sm font-bold uppercase tracking-wide">¡Subiste a nivel {xpToast.level ?? ''}! 🎉</span>
            )}
          </div>
        </div>
      )}

      {/* BADGE TOAST (insignia recién ganada) */}
      {badgeToast && (
        <div className="pointer-events-none fixed top-1/3 left-1/2 -translate-x-1/2 z-[121]">
          <div className="flex flex-col items-center gap-2 rounded-3xl bg-surface-1 px-8 py-5 shadow-2xl border border-feedback-warn/40 animate-[bounce_1s_ease-in-out_2]">
            <span className="text-5xl drop-shadow">{badgeToast.emoji}</span>
            <span className="text-xs font-bold uppercase tracking-widest text-feedback-warn">¡Insignia desbloqueada!</span>
            <span className="text-lg font-black text-ink-primary">{badgeToast.name}</span>
            <span className="text-xs text-ink-secondary">{badgeToast.description}</span>
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div className="flex items-center gap-3 px-4 py-3 relative z-10">
        {/* Exit warning */}
        {!isTeacher && (
          <button
            onClick={() => {
              if (confirm('Si sales, continuarás desde el último punto de control. ¿Salir?')) {
                onClose()
              }
            }}
            className="p-2 rounded-xl bg-surface-2 border border-hairline text-ink-secondary hover:text-ink-primary hover:bg-surface-3 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        {isTeacher && (
          <button onClick={onClose} className="p-2 rounded-xl bg-surface-2 border border-hairline text-ink-secondary hover:text-ink-primary">
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Progress bar — barra fina de avance (sin contador "1/11") */}
        <div className="flex-1 mx-2">
          <div className="flex items-center justify-end mb-1">
            <span className="text-ink-muted text-xs font-medium">
              {progressPercent}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-accent rounded-full"
              initial={false}
              animate={{ width: `${totalSlides > 0 ? ((currentIndex + 1) / totalSlides * 100) : 0}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {/* Score */}
        {Number(progress?.maxScore || 0) > 0 && (
          <div className="bg-surface-2 border border-hairline px-3 py-1.5 rounded-xl text-ink-primary text-sm font-bold">
            ⭐ {Number(progress?.score || 0)}/{Number(progress?.maxScore || 0)}
          </div>
        )}

        {/* Sound toggle */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-2 rounded-xl bg-surface-2 border border-hairline text-ink-secondary hover:text-ink-primary transition-colors"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* SLIDE CONTENT */}
      <div className="flex-1 flex items-start sm:items-center justify-center px-4 py-6 pb-28 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide?.id || currentIndex}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="w-full max-w-[720px]"
          >
            {currentSlide?.type === 'CONTENT' && renderContentSlide(currentSlide)}
            {currentSlide?.type === 'ACTIVITY' && renderActivitySlide(currentSlide)}
            {currentSlide?.type === 'CHECKPOINT' && renderCheckpointSlide()}
            {currentSlide?.type === 'BADGE_REVEAL' && renderBadgeSlide()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* BOTTOM NAV */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface-1/95 backdrop-blur-md border-t border-hairline px-4 py-3 flex items-center justify-between z-10">
        <button
          onClick={handleGoBack}
          disabled={!canGoBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-2 border border-hairline text-ink-secondary font-medium disabled:opacity-30 hover:bg-surface-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Anterior
        </button>

        <motion.button
          onClick={handleAdvance}
          disabled={!canAdvance || advancing}
          whileHover={canAdvance ? { scale: 1.03 } : undefined}
          whileTap={canAdvance ? { scale: 0.97 } : undefined}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
            canAdvance
              ? 'bg-accent text-white shadow-lg'
              : 'bg-surface-2 text-ink-muted cursor-not-allowed'
          }`}
        >
          {advancing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : currentIndex === totalSlides - 1 ? (
            <>Finalizar <Trophy className="w-4 h-4" /></>
          ) : (
            <>Siguiente <ArrowRight className="w-4 h-4" /></>
          )}
        </motion.button>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────
  // SLIDE RENDERERS
  // ─────────────────────────────────────────────────────────────────

  function renderContentSlide(slide: LessonSlide) {
    const layout = slide.layout || 'text-left-image-right'
    const hasImage = !!slide.imageUrl
    const hasVideo = !!slide.videoUrl
    // Motor de bloques: si la slide tiene bloques, se renderizan (y se ignora el
    // render legacy). Compat: las slides viejas sin bloques usan el camino de abajo.
    const blocks = Array.isArray((slide as any).blocks) ? (slide as any).blocks : null

    if (blocks && blocks.length) {
      const speak = blocksToPlainText(blocks)
      return (
        <div>
          {slide.title && (
            <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-2xl sm:text-3xl font-black text-ink-primary mb-4">{slide.title}</motion.h2>
          )}
          {speak && <div className="mb-4"><SpeakButton text={speak} label="Escuchar la lectura" /></div>}
          <BlockStackView blocks={blocks} />
        </div>
      )
    }

    return (
      <div>
        {slide.title && (
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl sm:text-3xl font-black text-ink-primary mb-4"
          >
            {slide.title}
          </motion.h2>
        )}

        {/* Oír la lectura con TTS (§3.1 vocabulario/pronunciación) */}
        {slide.body && (
          <div className="mb-4">
            <SpeakButton text={stripHtml(slide.body)} label="Escuchar la lectura" />
          </div>
        )}

        <div className={`${hasImage && layout === 'text-left-image-right' ? 'flex flex-col sm:flex-row gap-6' : ''}`}>
          {/* Text content */}
          {slide.body && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className={`prose prose-neutral prose-base sm:prose-lg max-w-none leading-relaxed text-ink-primary ${hasImage ? 'sm:flex-1' : ''}`}
              dangerouslySetInnerHTML={{ __html: slide.body }}
            />
          )}

          {/* Image */}
          {hasImage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className={`${layout === 'text-left-image-right' ? 'sm:w-2/5' : 'w-full mt-4'}`}
            >
              <SmartImg
                src={slide.imageUrl}
                alt={slide.title || 'Imagen'}
                className="w-full rounded-2xl border border-hairline shadow-sm object-contain max-h-64 sm:max-h-80"
              />
            </motion.div>
          )}
        </div>

        {/* Video */}
        {hasVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-4"
          >
            {slide.videoUrl!.includes('youtube') || slide.videoUrl!.includes('youtu.be') ? (
              <iframe
                src={slide.videoUrl!.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                className="w-full aspect-video rounded-2xl"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            ) : (
              <SmartVideo src={slide.videoUrl} className="w-full rounded-2xl max-h-80" />
            )}
          </motion.div>
        )}

        {/* Audio */}
        {slide.audioUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-4"
          >
            <SmartAudio src={slide.audioUrl} className="w-full" />
          </motion.div>
        )}
      </div>
    )
  }

  function renderActivitySlide(slide: LessonSlide) {
    if (!slide.activityData) return null
    const act = slide.activityData
    const alreadyAnswered = hasAnswered
    const previousAnswer = answers[slide.id]

    return (
      <div>
        {/* Question header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <span className="text-ink-muted text-sm font-medium">
            {act.questionType === 'FLASHCARDS' ? 'Tarjetas de estudio' : `Actividad • ${act.points || 10} pts`}
          </span>
        </div>

        {/* El enunciado se muestra arriba salvo cuando el bloque lo aloja
            dentro de sí (completar en línea: la frase con el hueco). */}
        {!blockHostsQuestion(act.questionType) && (
          <h3 className="text-xl sm:text-2xl font-bold text-ink-primary mb-6">{act.question}</h3>
        )}

        {/* Hint */}
        {act.hint && !answerSubmitted && !alreadyAnswered && (
          <p className="text-ink-secondary text-sm mb-4 italic">💡 {act.hint}</p>
        )}

        {/* Interacción — Stage + BlockRenderer (arquitectura de bloques DS-1) */}
        <Stage variant="question">
          <BlockRenderer
            act={act}
            value={selectedAnswer ?? previousAnswer?.answer ?? ''}
            onChange={setSelectedAnswer}
            showResult={answerSubmitted || alreadyAnswered}
          />
        </Stage>

        {/* Submit button (solo si el tipo requiere envío y aún no se envió) */}
        {requiresSubmission(act.questionType) && !answerSubmitted && !alreadyAnswered && (
          <motion.button
            onClick={handleSubmitAnswer}
            disabled={!isAnswerComplete(act, selectedAnswer)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="mt-6 w-full py-3 bg-accent text-white font-bold rounded-xl shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Comprobar
          </motion.button>
        )}

        {/* Result feedback */}
        {(answerSubmitted || alreadyAnswered) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-6 p-4 rounded-2xl border ${
              (slideResult?.isCorrect ?? previousAnswer?.isCorrect)
                ? 'bg-feedback-correct/10 border-feedback-correct/30'
                : 'bg-feedback-error/10 border-feedback-error/30'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {(slideResult?.isCorrect ?? previousAnswer?.isCorrect) ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-feedback-correct" />
                  <span className="text-feedback-correct font-bold">¡Correcto!</span>
                  <span className="text-feedback-correct text-sm ml-auto">+{slideResult?.points ?? previousAnswer?.points} pts</span>
                </>
              ) : (
                <>
                  <X className="w-5 h-5 text-feedback-error" />
                  <span className="text-feedback-error font-bold">Incorrecto</span>
                  <span className="text-feedback-error text-sm ml-auto">0 pts</span>
                </>
              )}
            </div>
            {/* Retroalimentación predefinida por el docente (setpoint §7) */}
            {(() => {
              const correct = slideResult?.isCorrect ?? previousAnswer?.isCorrect
              const msg = correct ? act.feedbackCorrect : act.feedbackIncorrect
              return msg ? <p className="text-ink-primary text-sm mt-2 font-medium">{msg}</p> : null
            })()}
            {act.explanation && (
              <p className="text-ink-secondary text-sm mt-2">{act.explanation}</p>
            )}
          </motion.div>
        )}

        {/* Gating P4: reintentar (no avanzar sin acertar) o aviso de intentos agotados */}
        {answerSubmitted && !answeredCorrect && !alreadyAnswered && (
          canRetry ? (
            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm text-ink-secondary">
                {maxAttempts > 0 ? `Te queda${maxAttempts - attempts === 1 ? '' : 'n'} ${maxAttempts - attempts} intento${maxAttempts - attempts === 1 ? '' : 's'}` : 'Inténtalo de nuevo'}
                {behavior.xpDecrement > 0 ? ' · el próximo acierto valdrá menos XP' : ''}
              </span>
              <motion.button onClick={handleRetry} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="px-5 py-2.5 bg-accent text-white font-bold rounded-xl shadow-lg">🔄 Reintentar</motion.button>
            </div>
          ) : (isGated && attemptsExhausted) ? (
            <p className="mt-3 text-sm text-ink-muted">Se agotaron los intentos. Revisa la explicación y continúa.</p>
          ) : null
        )}
      </div>
    )
  }

  function renderCheckpointSlide() {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', bounce: 0.5 }}
          className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-feedback-correct/10 border border-feedback-correct/30 flex items-center justify-center"
        >
          <Flag className="w-10 h-10 text-feedback-correct" />
        </motion.div>
        <h2 className="text-2xl font-black text-ink-primary mb-2">Punto de control</h2>
        <p className="text-ink-secondary mb-4">Tu progreso se ha guardado aquí. ¡Sigue adelante!</p>
        <div className="bg-surface-2 border border-hairline rounded-xl p-4 max-w-xs mx-auto">
          <p className="text-ink-muted text-xs mb-1">Progreso</p>
          <div className="w-full h-3 bg-surface-3 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-feedback-correct rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
          <p className="text-feedback-correct font-bold text-lg mt-1">{progressPercent}%</p>
        </div>
      </motion.div>
    )
  }

  function renderBadgeSlide() {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
          className="w-28 h-28 mx-auto mb-6 rounded-3xl flex items-center justify-center text-6xl shadow-xl ring-4 ring-hairline"
          style={{ backgroundColor: lesson?.badgeColor || '#8B5CF6' }}
        >
          {currentSlide?.badgeEmoji || lesson?.badgeEmoji || '🏆'}
        </motion.div>
        <h2 className="text-3xl font-black text-ink-primary mb-2">
          {currentSlide?.badgeTitle || lesson?.badgeTitle || '¡Felicitaciones!'}
        </h2>
        <p className="text-ink-secondary mb-4">
          Has completado todos los contenidos. Presiona "Finalizar" para obtener tu insignia.
        </p>
      </motion.div>
    )
  }
}
