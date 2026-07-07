import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronRight,
  Clock, Flag, Loader2, Lock, Play, Trophy, Volume2, VolumeX, X, Sparkles, AlertTriangle
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { lessonApi, type Lesson, type LessonSlide, type LessonProgress } from '../lib/api'

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
// GRADIENT BACKGROUNDS
// ═══════════════════════════════════════════════════════════════════════════

const SLIDE_GRADIENTS = [
  'from-violet-600 via-purple-600 to-indigo-700',
  'from-blue-600 via-cyan-600 to-teal-600',
  'from-emerald-600 via-green-600 to-lime-600',
  'from-amber-500 via-orange-500 to-red-500',
  'from-pink-500 via-rose-500 to-red-500',
  'from-indigo-600 via-blue-600 to-cyan-600',
  'from-teal-500 via-emerald-500 to-green-500',
  'from-fuchsia-500 via-purple-500 to-violet-500',
]

const OPTION_COLORS = [
  { bg: 'bg-[#FF6B6B]', hover: 'hover:bg-[#E85555]', shape: '▲' },
  { bg: 'bg-[#4ECDC4]', hover: 'hover:bg-[#3BA89F]', shape: '◆' },
  { bg: 'bg-[#FFE66D]', hover: 'hover:bg-[#FFD93D]', textClass: '!text-amber-800', shape: '●' },
  { bg: 'bg-[#95E1D3]', hover: 'hover:bg-[#7DCFC0]', shape: '■' },
  { bg: 'bg-[#FF8E72]', hover: 'hover:bg-[#E87A60]', shape: '★' },
  { bg: 'bg-[#A8E6CF]', hover: 'hover:bg-[#8DD4B8]', textClass: '!text-emerald-800', shape: '♥' },
]

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
  const gradient = SLIDE_GRADIENTS[currentIndex % SLIDE_GRADIENTS.length]

  const isSlideCompleted = currentSlide ? completedSlides.includes(currentSlide.id) : false
  const hasAnswered = currentSlide ? !!answers[currentSlide.id] : false

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

    // For ACTIVITY slides, must answer first
    if (currentSlide.type === 'ACTIVITY' && !answerSubmitted && !hasAnswered && !isTeacher) return

    if (!isTeacher) {
      try {
        setAdvancing(true)
        const { data } = await lessonApi.advance(lesson.id, {
          slideIndex: currentIndex,
          slideId: currentSlide.id,
          answer: currentSlide.type === 'ACTIVITY' ? selectedAnswer : undefined,
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
        setSlideStartTime(Date.now())
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // SUBMIT ANSWER
  // ─────────────────────────────────────────────────────────────────

  const handleSubmitAnswer = () => {
    if (!currentSlide?.activityData || selectedAnswer === null || selectedAnswer === undefined) return

    const actData = currentSlide.activityData
    const correct = String(actData.correctAnswer || '').trim().toLowerCase()
    const given = String(selectedAnswer).trim().toLowerCase()
    const isCorrect = correct === given
    const points = actData.points || 10

    const result: SlideResult = {
      answer: selectedAnswer,
      isCorrect,
      points: isCorrect ? points : 0,
      maxPoints: points,
    }

    setSlideResult(result)
    setAnswerSubmitted(true)
    if (soundEnabled) playSound(isCorrect ? 'correct' : 'wrong')
    if (isCorrect) {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } })
    }
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
      <div className="fixed inset-0 z-[100] bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center text-white"
        >
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p className="text-lg font-medium">Cargando lección...</p>
        </motion.div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────
  // RENDER: INTRO SCREEN
  // ─────────────────────────────────────────────────────────────────

  if (phase === 'intro') {
    return (
      <div className="fixed inset-0 z-[100] bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-lg w-full"
        >
          {/* Close button */}
          <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white p-2">
            <X className="w-6 h-6" />
          </button>

          {/* Badge preview */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', bounce: 0.5, delay: 0.2 }}
            className="w-24 h-24 mx-auto mb-6 rounded-3xl flex items-center justify-center text-5xl shadow-2xl"
            style={{ backgroundColor: lesson?.badgeColor || '#8B5CF6' }}
          >
            {lesson?.badgeEmoji || '🏆'}
          </motion.div>

          <h1 className="text-3xl font-black text-white text-center mb-2">
            {lesson?.title || 'Lección'}
          </h1>

          {lesson?.description && (
            <p className="text-white/70 text-center mb-6 text-sm leading-relaxed">
              {lesson.description}
            </p>
          )}

          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 mb-4 text-red-200 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
              <BookOpen className="w-5 h-5 text-violet-300 mx-auto mb-1" />
              <p className="text-white font-bold text-lg">{totalSlides}</p>
              <p className="text-white/50 text-xs">Slides</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
              <Sparkles className="w-5 h-5 text-amber-300 mx-auto mb-1" />
              <p className="text-white font-bold text-lg">
                {slides.filter(s => s.type === 'ACTIVITY').length}
              </p>
              <p className="text-white/50 text-xs">Actividades</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
              <Clock className="w-5 h-5 text-emerald-300 mx-auto mb-1" />
              <p className="text-white font-bold text-lg">{lesson?.estimatedMinutes || '~5'}</p>
              <p className="text-white/50 text-xs">Minutos</p>
            </div>
          </div>

          {/* Resume info */}
          {progress && progress.status === 'IN_PROGRESS' && (
            <div className="bg-amber-500/20 border border-amber-400/30 rounded-xl p-3 mb-4 text-amber-200 text-sm text-center">
              <Flag className="w-4 h-4 inline mr-1" />
              Tienes progreso guardado ({progressPercent}%). Continuarás desde el último punto de control.
            </div>
          )}

          {/* Start button */}
          <motion.button
            onClick={handleStart}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="w-full py-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold text-lg rounded-2xl shadow-xl shadow-purple-500/30 flex items-center justify-center gap-3"
          >
            <Play className="w-6 h-6" />
            {progress?.status === 'IN_PROGRESS' ? 'Continuar lección' : isTeacher ? 'Vista previa' : 'Iniciar lección'}
          </motion.button>

          {isTeacher && (
            <p className="text-white/40 text-xs text-center mt-3">
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
      <div className="fixed inset-0 z-[100] bg-gradient-to-br from-violet-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4 overflow-y-auto">
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
            className="w-32 h-32 mx-auto mb-6 rounded-3xl flex items-center justify-center text-7xl shadow-2xl ring-4 ring-white/20"
            style={{ backgroundColor: lesson?.badgeColor || '#8B5CF6' }}
          >
            {lesson?.badgeEmoji || '🏆'}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-3xl font-black text-white mb-2"
          >
            {isTeacher ? 'Vista previa completada' : '¡Lección completada!'}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-white/60 mb-6"
          >
            {lesson?.badgeTitle || 'Has desbloqueado una insignia'}
          </motion.p>

          {/* Score card */}
          {maxScore > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6"
            >
              <div className="text-5xl font-black text-white mb-2">
                {score}<span className="text-2xl text-white/50">/{maxScore}</span>
              </div>
              <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden mb-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${scorePercent}%` }}
                  transition={{ duration: 1, delay: 0.8 }}
                  className={`h-full rounded-full ${scorePercent >= 80 ? 'bg-emerald-400' : scorePercent >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                />
              </div>
              <p className="text-white/50 text-sm">
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
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-white/50 text-xs">Tiempo</p>
                <p className="text-white font-bold">
                  {Math.floor((progress.timeSpentSeconds || 0) / 60)}m {(progress.timeSpentSeconds || 0) % 60}s
                </p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-white/50 text-xs">Actividades</p>
                <p className="text-white font-bold">
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
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="w-full py-4 bg-white text-violet-700 font-bold text-lg rounded-2xl shadow-xl"
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
    if (currentSlide.type === 'ACTIVITY') return answerSubmitted || hasAnswered
    return false
  })()

  const canGoBack = currentIndex > 0 && (isTeacher || completedSlides.includes(slides[currentIndex - 1]?.id))

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[100] bg-gradient-to-br ${gradient} transition-all duration-700 flex flex-col select-none`}
    >
      {/* XP TOAST (gamificación) */}
      {xpToast && (
        <div className="pointer-events-none fixed top-20 left-1/2 -translate-x-1/2 z-[120] animate-bounce">
          <div className={`flex flex-col items-center gap-1 rounded-2xl px-6 py-3 shadow-2xl border-2 ${xpToast.leveledUp ? 'bg-amber-400 border-amber-200 text-amber-950' : 'bg-white/95 border-violet-200 text-violet-900'}`}>
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
          <div className="flex flex-col items-center gap-2 rounded-3xl bg-gradient-to-br from-amber-300 to-yellow-500 px-8 py-5 shadow-2xl border-2 border-amber-100 animate-[bounce_1s_ease-in-out_2]">
            <span className="text-5xl drop-shadow">{badgeToast.emoji}</span>
            <span className="text-xs font-bold uppercase tracking-widest text-amber-900">¡Insignia desbloqueada!</span>
            <span className="text-lg font-black text-amber-950">{badgeToast.name}</span>
            <span className="text-xs text-amber-900/90">{badgeToast.description}</span>
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
            className="p-2 rounded-xl bg-black/20 text-white/70 hover:text-white hover:bg-black/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
        {isTeacher && (
          <button onClick={onClose} className="p-2 rounded-xl bg-black/20 text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Progress bar */}
        <div className="flex-1 mx-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white/60 text-xs font-medium">
              {currentIndex + 1} / {totalSlides}
            </span>
            <span className="text-white/60 text-xs font-medium">
              {progressPercent}%
            </span>
          </div>
          <div className="w-full h-2 bg-black/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white/80 rounded-full"
              initial={false}
              animate={{ width: `${totalSlides > 0 ? ((currentIndex + 1) / totalSlides * 100) : 0}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {/* Score */}
        {Number(progress?.maxScore || 0) > 0 && (
          <div className="bg-black/20 px-3 py-1.5 rounded-xl text-white text-sm font-bold">
            ⭐ {Number(progress?.score || 0)}/{Number(progress?.maxScore || 0)}
          </div>
        )}

        {/* Sound toggle */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-2 rounded-xl bg-black/20 text-white/70 hover:text-white transition-colors"
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>

      {/* SLIDE CONTENT */}
      <div className="flex-1 flex items-center justify-center px-4 pb-24 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide?.id || currentIndex}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-2xl"
          >
            {currentSlide?.type === 'CONTENT' && renderContentSlide(currentSlide)}
            {currentSlide?.type === 'ACTIVITY' && renderActivitySlide(currentSlide)}
            {currentSlide?.type === 'CHECKPOINT' && renderCheckpointSlide()}
            {currentSlide?.type === 'BADGE_REVEAL' && renderBadgeSlide()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* BOTTOM NAV */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/20 backdrop-blur-md border-t border-white/10 px-4 py-3 flex items-center justify-between z-10">
        <button
          onClick={handleGoBack}
          disabled={!canGoBack}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 text-white font-medium disabled:opacity-30 hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Anterior
        </button>

        {/* Slide type indicator */}
        <div className="flex items-center gap-2">
          {slides.map((s, i) => (
            <div
              key={s.id}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentIndex ? 'bg-white w-6' :
                completedSlides.includes(s.id) ? 'bg-white/60' : 'bg-white/20'
              }`}
            />
          ))}
        </div>

        <motion.button
          onClick={handleAdvance}
          disabled={!canAdvance || advancing}
          whileHover={canAdvance ? { scale: 1.05 } : undefined}
          whileTap={canAdvance ? { scale: 0.95 } : undefined}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all ${
            canAdvance
              ? 'bg-white text-violet-700 shadow-xl shadow-white/20'
              : 'bg-white/10 text-white/40 cursor-not-allowed'
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

    return (
      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl">
        {slide.title && (
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl sm:text-3xl font-black text-white mb-4"
          >
            {slide.title}
          </motion.h2>
        )}

        <div className={`${hasImage && layout === 'text-left-image-right' ? 'flex flex-col sm:flex-row gap-6' : ''}`}>
          {/* Text content */}
          {slide.body && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className={`prose prose-invert prose-sm sm:prose-base max-w-none ${hasImage ? 'sm:flex-1' : ''}`}
              dangerouslySetInnerHTML={{ __html: slide.body }}
            />
          )}

          {/* Image */}
          {hasImage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className={`${layout === 'text-left-image-right' ? 'sm:w-2/5' : 'w-full mt-4'}`}
            >
              <img
                src={slide.imageUrl!}
                alt={slide.title || 'Imagen'}
                className="w-full rounded-2xl shadow-xl object-contain max-h-64 sm:max-h-80"
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
              <video src={slide.videoUrl!} controls className="w-full rounded-2xl max-h-80" />
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
            <audio src={slide.audioUrl} controls className="w-full" />
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
      <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl">
        {/* Question header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-800" />
          </div>
          <span className="text-white/60 text-sm font-medium">Actividad • {act.points || 10} pts</span>
        </div>

        <h3 className="text-xl sm:text-2xl font-bold text-white mb-6">{act.question}</h3>

        {/* Hint */}
        {act.hint && !answerSubmitted && !alreadyAnswered && (
          <p className="text-white/40 text-sm mb-4 italic">💡 {act.hint}</p>
        )}

        {/* Options */}
        {(act.questionType === 'MULTIPLE_CHOICE' || act.questionType === 'TRUE_FALSE') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(act.options || []).map((opt: string, i: number) => {
              const style = OPTION_COLORS[i % OPTION_COLORS.length]
              const isSelected = selectedAnswer === opt
              const wasCorrect = previousAnswer?.isCorrect
              const isCorrectOption = opt === act.correctAnswer
              const showResult = answerSubmitted || alreadyAnswered

              let borderClass = ''
              if (showResult) {
                if (isCorrectOption) borderClass = 'ring-4 ring-emerald-400 ring-offset-2 ring-offset-transparent'
                else if (isSelected && !isCorrectOption) borderClass = 'ring-4 ring-red-400 ring-offset-2 ring-offset-transparent opacity-60'
              } else if (isSelected) {
                borderClass = 'ring-4 ring-white/50 ring-offset-2 ring-offset-transparent scale-[1.02]'
              }

              return (
                <motion.button
                  key={i}
                  onClick={() => !showResult && setSelectedAnswer(opt)}
                  disabled={!!showResult}
                  whileHover={!showResult ? { scale: 1.03, y: -2 } : undefined}
                  whileTap={!showResult ? { scale: 0.97 } : undefined}
                  className={`relative p-4 sm:p-5 rounded-2xl text-white font-bold text-left transition-all ${style.bg} ${style.hover} ${style.textClass || ''} shadow-xl overflow-hidden ${borderClass}`}
                >
                  <span className="absolute top-3 left-3 text-white/30 text-xl">{style.shape}</span>
                  <span className="relative z-10 block pl-7 text-sm sm:text-base">{opt}</span>
                  {showResult && isCorrectOption && (
                    <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-emerald-300" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                </motion.button>
              )
            })}
          </div>
        )}

        {/* Short answer */}
        {act.questionType === 'SHORT_ANSWER' && (
          <div>
            <input
              type="text"
              value={selectedAnswer || previousAnswer?.answer || ''}
              onChange={e => !answerSubmitted && !alreadyAnswered && setSelectedAnswer(e.target.value)}
              disabled={answerSubmitted || alreadyAnswered}
              placeholder="Escribe tu respuesta..."
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40 text-lg"
            />
          </div>
        )}

        {/* Submit button (only if not yet submitted) */}
        {!answerSubmitted && !alreadyAnswered && (
          <motion.button
            onClick={handleSubmitAnswer}
            disabled={selectedAnswer === null || selectedAnswer === undefined || selectedAnswer === ''}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="mt-6 w-full py-3 bg-white text-violet-700 font-bold rounded-xl shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirmar respuesta
          </motion.button>
        )}

        {/* Result feedback */}
        {(answerSubmitted || alreadyAnswered) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-6 p-4 rounded-2xl ${
              (slideResult?.isCorrect ?? previousAnswer?.isCorrect) 
                ? 'bg-emerald-500/20 border border-emerald-400/30' 
                : 'bg-red-500/20 border border-red-400/30'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {(slideResult?.isCorrect ?? previousAnswer?.isCorrect) ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                  <span className="text-emerald-200 font-bold">¡Correcto!</span>
                  <span className="text-emerald-300 text-sm ml-auto">+{slideResult?.points ?? previousAnswer?.points} pts</span>
                </>
              ) : (
                <>
                  <X className="w-5 h-5 text-red-300" />
                  <span className="text-red-200 font-bold">Incorrecto</span>
                  <span className="text-red-300 text-sm ml-auto">0 pts</span>
                </>
              )}
            </div>
            {act.explanation && (
              <p className="text-white/70 text-sm mt-2">{act.explanation}</p>
            )}
          </motion.div>
        )}
      </div>
    )
  }

  function renderCheckpointSlide() {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', bounce: 0.5 }}
          className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-emerald-500/30 backdrop-blur-md flex items-center justify-center"
        >
          <Flag className="w-10 h-10 text-emerald-300" />
        </motion.div>
        <h2 className="text-2xl font-black text-white mb-2">Punto de control</h2>
        <p className="text-white/60 mb-4">Tu progreso se ha guardado aquí. ¡Sigue adelante!</p>
        <div className="bg-white/10 rounded-xl p-4 max-w-xs mx-auto">
          <p className="text-white/50 text-xs mb-1">Progreso</p>
          <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-emerald-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
          <p className="text-emerald-300 font-bold text-lg mt-1">{progressPercent}%</p>
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
          className="w-28 h-28 mx-auto mb-6 rounded-3xl flex items-center justify-center text-6xl shadow-2xl ring-4 ring-white/20"
          style={{ backgroundColor: lesson?.badgeColor || '#8B5CF6' }}
        >
          {currentSlide?.badgeEmoji || lesson?.badgeEmoji || '🏆'}
        </motion.div>
        <h2 className="text-3xl font-black text-white mb-2">
          {currentSlide?.badgeTitle || lesson?.badgeTitle || '¡Felicitaciones!'}
        </h2>
        <p className="text-white/60 mb-4">
          Has completado todos los contenidos. Presiona "Finalizar" para obtener tu insignia.
        </p>
      </motion.div>
    )
  }
}
