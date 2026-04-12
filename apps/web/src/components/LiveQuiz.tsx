import { useState, useEffect, useRef, useCallback } from 'react'
import { liveSessionApi, toPublicFileUrl } from '../lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import {
  Zap, Play, SkipForward, Trophy, X, CheckCircle2, XCircle,
  Clock, Users, Loader2, BarChart3, Image as ImageIcon, Volume2, VolumeX,
  ChevronRight, Award, Timer, Radio, Sparkles, Crown, RotateCcw
} from 'lucide-react'
import { AnimalAvatar, AvatarSelector, Podium, CircularTimer, getAvatarFromName, ANIMAL_AVATARS } from './AnimalAvatars'

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATION VARIANTS
// ═══════════════════════════════════════════════════════════════════════════

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 }
}

const scaleIn = {
  initial: { opacity: 0, scale: 0.8 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.8 }
}

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } }
}

const optionVariants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
  tap: { scale: 0.98 }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOUND EFFECTS (Web Audio API)
// ═══════════════════════════════════════════════════════════════════════════

const playSound = (type: 'correct' | 'incorrect' | 'tick' | 'winner' | 'countdown') => {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime

    switch (type) {
      case 'correct':
        // Happy ascending arpeggio
        osc.type = 'sine'
        osc.frequency.setValueAtTime(523, now)
        osc.frequency.setValueAtTime(659, now + 0.1)
        osc.frequency.setValueAtTime(784, now + 0.2)
        gain.gain.setValueAtTime(0.3, now)
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4)
        osc.start(now)
        osc.stop(now + 0.4)
        break
      case 'incorrect':
        // Sad descending tone
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(300, now)
        osc.frequency.setValueAtTime(200, now + 0.2)
        gain.gain.setValueAtTime(0.2, now)
        gain.gain.setValueAtTime(0.01, now + 0.3)
        osc.start(now)
        osc.stop(now + 0.3)
        break
      case 'tick':
        // Quick tick
        osc.type = 'square'
        osc.frequency.setValueAtTime(800, now)
        gain.gain.setValueAtTime(0.1, now)
        gain.gain.setValueAtTime(0, now + 0.05)
        osc.start(now)
        osc.stop(now + 0.05)
        break
      case 'winner':
        // Victory fanfare
        osc.type = 'sine'
        const notes = [523, 659, 784, 1047]
        notes.forEach((freq, i) => {
          osc.frequency.setValueAtTime(freq, now + i * 0.15)
        })
        gain.gain.setValueAtTime(0.3, now)
        gain.gain.setValueAtTime(0.01, now + 0.6)
        osc.start(now)
        osc.stop(now + 0.7)
        break
      case 'countdown':
        // Urgent beep
        osc.type = 'square'
        osc.frequency.setValueAtTime(440, now)
        gain.gain.setValueAtTime(0.15, now)
        gain.gain.setValueAtTime(0, now + 0.1)
        osc.start(now)
        osc.stop(now + 0.1)
        break
    }
  } catch (e) {
    // Audio not supported
  }
}

// Confetti effects
const fireConfetti = (type: 'correct' | 'winner' | 'celebration') => {
  switch (type) {
    case 'correct':
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#22c55e', '#4ade80', '#86efac']
      })
      break
    case 'winner':
      // Big celebration
      const duration = 3000
      const end = Date.now() + duration
      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#fbbf24', '#f59e0b', '#d97706']
        })
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#fbbf24', '#f59e0b', '#d97706']
        })
        if (Date.now() < end) requestAnimationFrame(frame)
      }
      frame()
      break
    case 'celebration':
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      })
      break
  }
}

// Animated counter hook
const useAnimatedCounter = (value: number, duration = 500) => {
  const [displayValue, setDisplayValue] = useState(value)
  const prevValue = useRef(value)

  useEffect(() => {
    if (value === prevValue.current) return
    
    const startValue = prevValue.current
    const diff = value - startValue
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.round(startValue + diff * eased))
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        prevValue.current = value
      }
    }
    
    requestAnimationFrame(animate)
  }, [value, duration])

  return displayValue
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface LiveQuizProps {
  classroomId: string
  isTeacher: boolean
  onClose: () => void
  // Teacher: pass activityId to create session
  activityId?: string
  activityTitle?: string
  // Student: pass existing sessionId
  sessionId?: string
  // Student: pass enrollmentId for connection tracking (auto-close feature)
  studentEnrollmentId?: string
  initialDeliveryMode?: 'SYNC' | 'ASYNC_HOME'
}

interface RankEntry {
  rank: number
  name: string
  academicPoints?: number
  totalPoints: number
  correctAnswers?: number
  studentEnrollmentId?: string
  teamId?: string
  color?: string
  avatarId?: string
}

// Color palette for avatar backgrounds
const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6',
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function normalizeQuestionMedia(question: any) {
  if (!question) return question

  return {
    ...question,
    imageUrl: toPublicFileUrl(question.imageUrl),
    context: question.context
      ? {
          ...question.context,
          imageUrl: toPublicFileUrl(question.context.imageUrl),
        }
      : question.context,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function LiveQuiz({ classroomId, isTeacher, onClose, activityId, activityTitle, sessionId: initialSessionId, studentEnrollmentId, initialDeliveryMode = 'SYNC' }: LiveQuizProps) {
  const [sessionId, setSessionId] = useState(initialSessionId || '')
  const [session, setSession] = useState<any>(null)
  const [phase, _setPhase] = useState<'setup' | 'loading' | 'lobby' | 'question' | 'answer_reveal' | 'ranking' | 'finished'>('setup')
  const phaseRef = useRef(phase)
  const setPhase = (p: typeof phase | ((prev: typeof phase) => typeof phase)) => {
    _setPhase(prev => {
      const next = typeof p === 'function' ? p(prev) : p
      phaseRef.current = next
      return next
    })
  }
  const [error, setError] = useState('')

  // Current question state
  const [currentQuestion, setCurrentQuestion] = useState<any>(null)
  const [questionIndex, setQuestionIndex] = useState(-1)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [timeLimit, setTimeLimit] = useState(15)
  const [timeLeft, setTimeLeft] = useState(0)
  const [isBonus, setIsBonus] = useState(false)
  const [multiplier, setMultiplier] = useState(1)

  // Student answer state
  const [selectedAnswer, setSelectedAnswer] = useState<string>('')
  const [multiAnswers, setMultiAnswers] = useState<string[]>([])
  const [matchAnswers, setMatchAnswers] = useState<Record<string, string>>({})
  const [blankAnswers, setBlankAnswers] = useState<string[]>([])
  const [orderAnswers, setOrderAnswers] = useState<string[]>([])
  const [answered, setAnswered] = useState(false)
  const [answerResult, setAnswerResult] = useState<{ isCorrect: boolean; points: number } | null>(null)
  const [answerStartTime, setAnswerStartTime] = useState(0)

  // Progress + ranking
  const [totalStudents, setTotalStudents] = useState(0)
  const [totalAnswered, setTotalAnswered] = useState(0)
  const [ranking, _setRanking] = useState<RankEntry[]>([])
  const rankingRef = useRef<RankEntry[]>([])
  const setRanking = (r: RankEntry[]) => {
    rankingRef.current = r
    _setRanking(r)
  }
  // Async home ranking metadata
  const [rankingMeta, setRankingMeta] = useState<{ completedCount: number; totalExpected: number; isSessionFinished: boolean; isPartial: boolean } | null>(null)

  // Team mode
  const [mode, setMode] = useState<'INDIVIDUAL' | 'TEAM'>('INDIVIDUAL')
  const [teams, setTeams] = useState<any[]>([])
  const [myTeamId, setMyTeamId] = useState<string | null>(null)
  const [teamSetupNames, setTeamSetupNames] = useState(['Equipo 1', 'Equipo 2'])
  const [joiningTeam, setJoiningTeam] = useState(false)

  // Delivery mode: live online or at home
  const [deliveryMode, setDeliveryMode] = useState<'SYNC' | 'ASYNC_HOME'>(initialDeliveryMode)

  // Add partner (search students to add to my team)
  const [showAddPartner, setShowAddPartner] = useState(false)
  const [partnerSearch, setPartnerSearch] = useState('')
  const [partnerResults, setPartnerResults] = useState<any[]>([])
  const [searchingPartner, setSearchingPartner] = useState(false)
  const [addingPartner, setAddingPartner] = useState('')

  // Time config
  const [globalTimeLimit, setGlobalTimeLimit] = useState(15)
  const [autoCloseOnTimeout, setAutoCloseOnTimeout] = useState(true)
  const autoCloseRef = useRef(true)

  // Team assignment mode: STUDENT_CHOICE = students pick, TEACHER_ASSIGNED = teacher pre-assigns
  const [teamAssignmentMode, setTeamAssignmentMode] = useState<'STUDENT_CHOICE' | 'TEACHER_ASSIGNED'>('STUDENT_CHOICE')
  const [showTeamAssigner, setShowTeamAssigner] = useState(false)
  const [groupStudents, setGroupStudents] = useState<any[]>([])
  const [teamAssignments, setTeamAssignments] = useState<Record<string, string>>({}) // enrollmentId -> teamId

  // Student create team
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [creatingTeam, setCreatingTeam] = useState(false)

  // Reveal state
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null)
  const [explanation, setExplanation] = useState<string | null>(null)

  // Context expand/collapse
  const [contextExpanded, setContextExpanded] = useState(false)

  // Music (all users during questions)
  const [musicOn, setMusicOn] = useState(false)
  const audioCtxRef = useRef<AudioContext | null>(null)

  // Sound effects toggle
  const [soundsOn, setSoundsOn] = useState(true)
  
  // Streak tracking (consecutive correct answers)
  const [streak, setStreak] = useState(0)
  
  // Points animation
  const [lastPointsGained, setLastPointsGained] = useState(0)
  const [showPointsAnimation, setShowPointsAnimation] = useState(false)
  const animatedPoints = useAnimatedCounter(answerResult?.points || 0)

  // Buffered answer result — revealed only when question is closed
  const pendingResultRef = useRef<{ isCorrect: boolean; points: number } | null>(null)
  const answeredRef = useRef(false)

  // Avatar selection (student picks before joining)
  const [myAvatarId, setMyAvatarId] = useState(() => {
    // Try to load from localStorage or generate from random
    const saved = localStorage.getItem('liveQuizAvatar')
    return saved || ANIMAL_AVATARS[Math.floor(Math.random() * ANIMAL_AVATARS.length)].id
  })
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)

  // SSE
  const eventSourceRef = useRef<EventSource | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const asyncHomeSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionIdRef = useRef(initialSessionId || '')
  const questionIndexRef = useRef(-1)

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (initialSessionId) {
      // Teacher or student resuming an existing session
      setPhase('loading')
      setSessionId(initialSessionId)
      loadSession(initialSessionId)
    } else if (isTeacher && activityId) {
      // Show setup phase for teacher to pick mode (new session)
      setPhase('setup')
    } else {
      setPhase('loading')
      checkActiveSession()
    }
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close()
      if (timerRef.current) clearInterval(timerRef.current)
      clearAsyncHomeSyncTimeout()
      stopMusic()
    }
  }, [clearAsyncHomeSyncTimeout])

  const createSession = async () => {
    setPhase('loading')
    try {
      // En modo TEAM, los estudiantes crean sus propios equipos dinámicamente (estilo Kahoot)
      const effectiveMode = deliveryMode === 'ASYNC_HOME' ? 'INDIVIDUAL' : mode
      const { data } = await liveSessionApi.create({ 
        classroomId, 
        activityId: activityId!, 
        mode: effectiveMode, 
        config: { 
          timeLimitOverride: globalTimeLimit, 
          autoClose: autoCloseOnTimeout, 
          teamAssignment: 'STUDENT_CHOICE', // Siempre estudiantes eligen/crean equipos
          deliveryMode,
        } 
      })
      autoCloseRef.current = autoCloseOnTimeout
      setSessionId(data.id)
      sessionIdRef.current = data.id
      setSession(data)
      setMode(data.mode || 'INDIVIDUAL')
      setTotalQuestions(data.activity?.questions?.length || 0)
      connectSSE(data.id)
      // No pre-creamos equipos - los estudiantes los crearán en el lobby
      setPhase('lobby')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear sesión')
      setPhase('loading')
    }
  }

  const loadSession = async (sid: string, allowHomeJoin = true) => {
    try {
      const { data } = await liveSessionApi.get(sid)

      if (!isTeacher && allowHomeJoin && data.deliveryMode === 'ASYNC_HOME' && !data.parentSessionId) {
        const { data: joinedSession } = await liveSessionApi.joinHome(sid)
        setSessionId(joinedSession.id)
        sessionIdRef.current = joinedSession.id
        setSession(joinedSession)
        setMode(joinedSession.mode || 'INDIVIDUAL')
        setDeliveryMode('ASYNC_HOME')
        syncQuestionFromSessionData(joinedSession)
        if (joinedSession.teams?.length) setTeams(joinedSession.teams)
        const joinedCfg = (joinedSession.config as any) || {}
        autoCloseRef.current = joinedCfg.autoClose ?? false
        setAutoCloseOnTimeout(joinedCfg.autoClose ?? false)
        if (joinedSession.status === 'FINISHED') {
          setPhase('finished')
        } else if (joinedSession.status === 'WAITING') {
          setPhase('lobby')
        } else {
          // ACTIVE - load current question directly from session data (don't wait for SSE)
          setPhase('question')
        }
        connectSSE(joinedSession.id)
        return
      }

      setSession(data)
      sessionIdRef.current = sid
      setMode(data.mode || 'INDIVIDUAL')
      setDeliveryMode((data.deliveryMode || (data.config as any)?.deliveryMode || 'SYNC') as 'SYNC' | 'ASYNC_HOME')
      setTotalQuestions(data.activity?.questions?.length || 0)
      if (data.teams?.length) setTeams(data.teams)
      // Sync autoClose from session config
      const cfg = (data.config as any) || {}
      autoCloseRef.current = cfg.autoClose ?? false
      setAutoCloseOnTimeout(cfg.autoClose ?? false)
      if (data.status === 'FINISHED') {
        setPhase('finished')
      } else if (data.status === 'WAITING') {
        setPhase('lobby')
      } else {
        // ACTIVE — for async home sessions, use REST as a fallback so the student
        // can keep progressing even if the SSE question event is delayed.
        if (data.deliveryMode === 'ASYNC_HOME' || (data.config as any)?.deliveryMode === 'ASYNC_HOME') {
          syncQuestionFromSessionData(data)
        }
        setPhase('question')
      }
      connectSSE(sid)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Sesión no encontrada')
    }
  }

  const checkActiveSession = async () => {
    try {
      const { data } = await liveSessionApi.getActive(classroomId)
      if (data && data.id) {
        setSessionId(data.id)
        loadSession(data.id)
      } else {
        setError('No hay sesión activa en este momento')
      }
    } catch {
      setError('No hay sesión activa en este momento')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SSE CONNECTION
  // ═══════════════════════════════════════════════════════════════════════════

  const connectSSE = useCallback((sid: string) => {
    if (eventSourceRef.current) eventSourceRef.current.close()

    const token = localStorage.getItem('token')
    const baseUrl = liveSessionApi.streamUrl(sid)
    // Include enrollmentId for student connection tracking (auto-close feature)
    // Include avatarId so backend can store it for ranking display
    const enrollmentParam = studentEnrollmentId ? `&enrollmentId=${studentEnrollmentId}` : ''
    const avatarParam = myAvatarId ? `&avatarId=${myAvatarId}` : ''
    const url = `${baseUrl}?token=${token}${enrollmentParam}${avatarParam}`

    const es = new EventSource(url)
    eventSourceRef.current = es

    es.addEventListener('SESSION_STARTED', () => {
      setPhase('lobby')
    })

    es.addEventListener('QUESTION', (e: any) => {
      const data = JSON.parse(e.data)
      clearAsyncHomeSyncTimeout()
      const normalizedQuestion = normalizeQuestionMedia(data)
      setCurrentQuestion(normalizedQuestion)
      setQuestionIndex(data.index)
      questionIndexRef.current = data.index
      setTotalQuestions(data.total)
      setTimeLimit(data.timeLimit || 15)
      setTimeLeft(data.timeLimit || 15)
      setIsBonus(data.isBonus || false)
      setMultiplier(data.multiplier || 1)
      setSelectedAnswer('')
      setMultiAnswers([])
      setMatchAnswers({})
      setBlankAnswers([])
      setOrderAnswers(data.options && data.type === 'ORDERING' ? shuffleArray([...(data.options as string[])]) : [])
      setAnswered(false)
      answeredRef.current = false
      pendingResultRef.current = null
      setAnswerResult(null)
      setCorrectAnswer(null)
      setExplanation(null)
      setContextExpanded(false)
      setTotalAnswered(0)
      setAnswerStartTime(Date.now())
      setPhase('question')
      startTimer(data.timeLimit || 15)
      // Auto-start suspense music for everyone
      startMusic()
    })

    es.addEventListener('ANSWER_PROGRESS', (e: any) => {
      const data = JSON.parse(e.data)
      setTotalAnswered(data.totalAnswered)
    })

    es.addEventListener('QUESTION_CLOSED', (e: any) => {
      const data = JSON.parse(e.data)
      // Only process if we're still in the question phase (ignore late close from previous question)
      if (phaseRef.current !== 'question') return
      setCorrectAnswer(data.correctAnswer)
      setExplanation(data.explanation)
      stopTimer()
      stopMusic()
      // Reveal buffered result for students (with sounds + confetti)
      revealPendingResult()
      setPhase('answer_reveal')
      if (!isTeacher && (deliveryMode === 'ASYNC_HOME' || (session?.config as any)?.deliveryMode === 'ASYNC_HOME')) {
        scheduleAsyncHomeSessionSync(sessionIdRef.current, questionIndexRef.current)
      }
    })

    es.addEventListener('RANKING', (e: any) => {
      const data = JSON.parse(e.data)
      // Handle async home ranking with metadata
      if (data.ranking && data.meta) {
        setRanking(data.ranking)
        setRankingMeta(data.meta)
      } else {
        setRanking(Array.isArray(data) ? data : [])
        setRankingMeta(null)
      }
      setPhase('ranking')
    })

    es.addEventListener('SESSION_FINISHED', (e: any) => {
      const data = JSON.parse(e.data)
      clearAsyncHomeSyncTimeout()
      // Handle async home ranking with metadata
      if (data.ranking && data.meta) {
        setRanking(data.ranking)
        setRankingMeta(data.meta)
      } else {
        setRanking(Array.isArray(data) ? data : [])
        setRankingMeta(null)
      }
      setPhase('finished')
      stopTimer()
      stopMusic()
      // Celebration effects!
      fireConfetti('winner')
      if (soundsOn) playSound('winner')
    })

    es.addEventListener('TEAMS_UPDATED', (e: any) => {
      const data = JSON.parse(e.data)
      setTeams(data)
    })

    es.addEventListener('SESSION_ENDED', async () => {
      clearAsyncHomeSyncTimeout()
      stopTimer()
      stopMusic()
      // Close current SSE connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      // For students: check if there's a new active session to join
      // Wait a bit for the new session to be created by the teacher
      if (!isTeacher) {
        await new Promise(resolve => setTimeout(resolve, 800))
        try {
          const { data } = await liveSessionApi.getActive(classroomId)
          if (data && data.id && data.id !== sessionIdRef.current) {
            // New session found — rejoin it
            setSessionId(data.id)
            sessionIdRef.current = data.id
            clearAsyncHomeSyncTimeout()
            setCurrentQuestion(null)
            setQuestionIndex(-1)
            questionIndexRef.current = -1
            setAnswered(false)
            answeredRef.current = false
            setAnswerResult(null)
            setCorrectAnswer(null)
            setExplanation(null)
            setTotalAnswered(0)
            setPhase('loading')
            loadSession(data.id)
            return
          }
        } catch { /* no new session */ }
      }
      // Only set phase to finished if not already finished (SESSION_FINISHED already handled it)
      // Don't clear ranking - keep whatever we have from SESSION_FINISHED
      if (phaseRef.current !== 'finished') {
        setPhase('finished')
        // Only clear ranking if we don't have any saved
        if (rankingRef.current.length === 0) {
          setRanking([])
        }
      }
    })

    es.addEventListener('PING', () => { /* keep alive */ })

    es.onerror = () => {
      // Auto-reconnect is built into EventSource
    }
  }, [myAvatarId, studentEnrollmentId])

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMER
  // ═══════════════════════════════════════════════════════════════════════════

  const startTimer = (seconds: number) => {
    stopTimer()
    setTimeLeft(seconds)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          stopTimer()
          // Backend handles auto-close via server-side timer — no frontend call needed
          return 0
        }
        // Play countdown sound in last 5 seconds (use ref to avoid stale closure)
        if (prev <= 6 && prev > 1 && !answeredRef.current) {
          playSound('countdown')
        }
        return prev - 1
      })
    }, 1000)
  }

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const clearAsyncHomeSyncTimeout = useCallback(() => {
    if (asyncHomeSyncTimeoutRef.current) {
      clearTimeout(asyncHomeSyncTimeoutRef.current)
      asyncHomeSyncTimeoutRef.current = null
    }
  }, [])

  const syncQuestionFromSessionData = useCallback((sessionData: any, minimumQuestionIdx = -1) => {
    const questions = sessionData?.activity?.questions || []
    const currentQuestionIdx = sessionData?.currentQuestionIdx ?? -1
    if (currentQuestionIdx < 0 || !questions[currentQuestionIdx] || currentQuestionIdx <= minimumQuestionIdx) return false

    const cfg = (sessionData?.config as any) || {}
    const q = questions[currentQuestionIdx]
    const timeLimit = cfg.timeLimitOverride || 15

    setCurrentQuestion({
      questionId: q.id,
      type: q.type,
      text: q.text,
      imageUrl: q.imageUrl,
      options: q.options,
      points: q.points,
      isBonus: Boolean(cfg.bonusQuestions?.includes(currentQuestionIdx)),
      multiplier: cfg.multipliers?.[String(currentQuestionIdx)] || 1,
      timeLimit,
      context: q.context || null,
    })
    setQuestionIndex(currentQuestionIdx)
    questionIndexRef.current = currentQuestionIdx
    setTotalQuestions(questions.length)
    setTimeLimit(timeLimit)
    setTimeLeft(timeLimit)
    setSelectedAnswer('')
    setMultiAnswers([])
    setMatchAnswers({})
    setBlankAnswers([])
    setOrderAnswers(q.type === 'ORDERING' && Array.isArray(q.options) ? shuffleArray([...(q.options as string[])]) : [])
    setAnswered(false)
    answeredRef.current = false
    pendingResultRef.current = null
    setAnswerResult(null)
    setCorrectAnswer(null)
    setExplanation(null)
    setContextExpanded(false)
    setTotalAnswered(0)
    setAnswerStartTime(Date.now())
    setPhase('question')
    startTimer(timeLimit)
    if (!isTeacher && (sessionData?.deliveryMode === 'ASYNC_HOME' || (sessionData?.config as any)?.deliveryMode === 'ASYNC_HOME')) {
      startMusic()
    }
    return true
  }, [isTeacher])

  const scheduleAsyncHomeSessionSync = useCallback((sid: string, minimumQuestionIdx = -1) => {
    clearAsyncHomeSyncTimeout()
    asyncHomeSyncTimeoutRef.current = setTimeout(async () => {
      try {
        const { data } = await liveSessionApi.get(sid)
        if (data?.status !== 'ACTIVE') return
        const advanced = syncQuestionFromSessionData(data, minimumQuestionIdx)
        if (!advanced) {
          scheduleAsyncHomeSessionSync(sid, minimumQuestionIdx)
        }
      } catch {}
    }, 900)
  }, [clearAsyncHomeSyncTimeout, syncQuestionFromSessionData])

  // ═══════════════════════════════════════════════════════════════════════════
  // MUSIC (Web Audio API - dynamic quiz music)
  // ═══════════════════════════════════════════════════════════════════════════
  const musicIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const startMusic = () => {
    // Stop any existing music first so we restart cleanly per question
    if (audioCtxRef.current || musicIntervalRef.current) stopMusic()
    const ctx = new AudioContext()
    audioCtxRef.current = ctx

    // Quiz-style arpeggio pattern (C major pentatonic + variations)
    const notes = [261.6, 329.6, 392, 523.3, 392, 329.6, 293.7, 349.2, 440, 523.3, 440, 349.2]
    let noteIndex = 0
    let beatCount = 0

    const playNote = () => {
      if (!audioCtxRef.current) return
      const now = audioCtxRef.current.currentTime

      // Main synth voice
      const osc = audioCtxRef.current.createOscillator()
      const gain = audioCtxRef.current.createGain()
      
      // Alternate between square and triangle for variety
      osc.type = beatCount % 8 < 4 ? 'square' : 'triangle'
      osc.frequency.value = notes[noteIndex]
      
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
      
      osc.connect(gain)
      gain.connect(audioCtxRef.current.destination)
      osc.start(now)
      osc.stop(now + 0.15)

      // Add bass on every 4th beat
      if (beatCount % 4 === 0) {
        const bassOsc = audioCtxRef.current.createOscillator()
        const bassGain = audioCtxRef.current.createGain()
        bassOsc.type = 'sine'
        bassOsc.frequency.value = notes[noteIndex] / 2
        bassGain.gain.setValueAtTime(0.06, now)
        bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
        bassOsc.connect(bassGain)
        bassGain.connect(audioCtxRef.current.destination)
        bassOsc.start(now)
        bassOsc.stop(now + 0.3)
      }

      // Add high sparkle on every 8th beat
      if (beatCount % 8 === 0) {
        const highOsc = audioCtxRef.current.createOscillator()
        const highGain = audioCtxRef.current.createGain()
        highOsc.type = 'sine'
        highOsc.frequency.value = notes[noteIndex] * 2
        highGain.gain.setValueAtTime(0.03, now)
        highGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)
        highOsc.connect(highGain)
        highGain.connect(audioCtxRef.current.destination)
        highOsc.start(now)
        highOsc.stop(now + 0.1)
      }

      noteIndex = (noteIndex + 1) % notes.length
      beatCount++
    }

    // Play at 140 BPM (approx 214ms per 8th note)
    playNote()
    musicIntervalRef.current = setInterval(playNote, 214)
    setMusicOn(true)
  }

  const stopMusic = () => {
    if (musicIntervalRef.current) {
      clearInterval(musicIntervalRef.current)
      musicIntervalRef.current = null
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close() } catch {}
      audioCtxRef.current = null
    }
    setMusicOn(false)
  }

  const toggleMusic = () => {
    if (musicOn) stopMusic()
    else startMusic()
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEACHER CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleStart = async () => {
    try {
      await liveSessionApi.start(sessionId)
      // After starting, immediately launch first question
      await liveSessionApi.nextQuestion(sessionId)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error')
    }
  }

  const handleNextQuestion = async () => {
    try {
      await liveSessionApi.nextQuestion(sessionId)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error')
    }
  }

  const handleCloseQuestion = async () => {
    try {
      await liveSessionApi.closeQuestion(sessionId)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error')
    }
  }

  const handleShowRanking = async () => {
    try {
      await liveSessionApi.showRanking(sessionId)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error')
    }
  }

  const handleFinish = async () => {
    try {
      await liveSessionApi.finish(sessionId)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STUDENT: SUBMIT ANSWER
  // ═══════════════════════════════════════════════════════════════════════════

  const submitAnswer = async (answerValue: string) => {
    if (answered || !currentQuestion) return
    setAnswered(true)
    answeredRef.current = true
    const responseTimeMs = Date.now() - answerStartTime
    try {
      const { data } = await liveSessionApi.answer(sessionId, {
        questionId: currentQuestion.questionId,
        answer: answerValue,
        responseTimeMs,
      })
      // Buffer the result — don't reveal yet, wait for QUESTION_CLOSED
      pendingResultRef.current = data
    } catch (err: any) {
      pendingResultRef.current = { isCorrect: false, points: 0 }
    }
  }

  // Reveal buffered result — called when QUESTION_CLOSED event arrives
  const revealPendingResult = () => {
    const result = pendingResultRef.current
    if (!result) {
      // If student answered but result hasn't arrived yet, wait and retry
      if (answeredRef.current) {
        setTimeout(() => {
          const delayedResult = pendingResultRef.current
          if (delayedResult) {
            setAnswerResult(delayedResult)
            if (delayedResult.isCorrect) {
              if (soundsOn) playSound('correct')
              fireConfetti('correct')
              setStreak(prev => prev + 1)
            } else {
              if (soundsOn) playSound('incorrect')
              setStreak(0)
            }
            pendingResultRef.current = null
          }
        }, 500)
      }
      return
    }
    setAnswerResult(result)
    if (result.isCorrect) {
      if (soundsOn) playSound('correct')
      fireConfetti('correct')
      setStreak(prev => prev + 1)
    } else {
      if (soundsOn) playSound('incorrect')
      setStreak(0)
    }
    pendingResultRef.current = null
  }

  const handleSelectOption = (opt: string) => {
    if (answered) return
    setSelectedAnswer(opt)
    submitAnswer(opt)
  }

  const handleMultiSelect = (opt: string) => {
    if (answered) return
    setMultiAnswers(prev => prev.includes(opt) ? prev.filter(o => o !== opt) : [...prev, opt])
  }

  const submitMultiAnswer = () => {
    if (answered) return
    submitAnswer(JSON.stringify(multiAnswers))
  }

  const handleMatchAnswer = (left: string, right: string) => {
    setMatchAnswers(prev => ({ ...prev, [left]: right }))
  }

  const submitMatchAnswer = () => {
    if (answered) return
    submitAnswer(JSON.stringify(matchAnswers))
  }

  const submitBlankAnswer = () => {
    if (answered) return
    submitAnswer(JSON.stringify(blankAnswers))
  }

  // Partner search
  const handleSearchPartner = async (q: string) => {
    setPartnerSearch(q)
    if (!sessionId) return
    setSearchingPartner(true)
    try {
      const { data } = await liveSessionApi.searchStudents(sessionId, q)
      setPartnerResults(data)
    } catch {} finally { setSearchingPartner(false) }
  }

  const handleAddPartner = async (enrollmentId: string) => {
    if (!myTeamId || !sessionId || addingPartner) return
    setAddingPartner(enrollmentId)
    try {
      await liveSessionApi.addPartner(sessionId, myTeamId, enrollmentId)
    } catch {} finally { setAddingPartner('') }
  }

  const handleCreateTeam = async () => {
    if (!sessionId || !newTeamName.trim() || creatingTeam) return
    setCreatingTeam(true)
    try {
      const { data } = await liveSessionApi.createTeamByStudent(sessionId, newTeamName.trim())
      setMyTeamId(data.id)
      setNewTeamName('')
      setShowCreateTeam(false)
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al crear equipo')
    } finally { setCreatingTeam(false) }
  }

  const handleOrderMove = (from: number, to: number) => {
    if (answered) return
    const arr = [...orderAnswers]
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
    setOrderAnswers(arr)
  }

  const submitOrderAnswer = () => {
    if (answered) return
    submitAnswer(JSON.stringify(orderAnswers))
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (error && phase === 'loading') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <XCircle className="w-16 h-16 text-red-400 mx-auto" />
          <p className="text-white text-lg">{error}</p>
          <button onClick={onClose} className="px-6 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20">Volver</button>
        </div>
      </div>
    )
  }

  // Timer bar width
  const timerPercent = timeLimit > 0 ? (timeLeft / timeLimit) * 100 : 0
  const timerColor = timeLeft > timeLimit * 0.5 ? 'bg-green-500' : timeLeft > timeLimit * 0.25 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="fixed inset-0 z-50 overflow-auto" style={{ background: 'linear-gradient(180deg, #7C3AED 0%, #06B6D4 100%)' }}>
      {/* Decorative background shapes - subtle geometric pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/5 rounded-3xl rotate-12" />
        <div className="absolute top-40 right-16 w-24 h-24 bg-white/5 rounded-2xl -rotate-6" />
        <div className="absolute bottom-32 left-1/4 w-40 h-40 bg-white/5 rounded-3xl rotate-45" />
        <div className="absolute bottom-20 right-1/4 w-28 h-28 bg-white/5 rounded-2xl -rotate-12" />
        <div className="absolute top-1/3 left-1/2 w-20 h-20 bg-white/5 rounded-xl rotate-6" />
      </div>

      {/* Top bar */}
      <div className="relative flex items-center justify-between px-4 py-3 bg-white/90 backdrop-blur-md shadow-lg shadow-black/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#FF6B6B] to-[#FF8E72] rounded-2xl flex items-center justify-center shadow-md shadow-red-300/30" style={{ transform: 'rotate(-5deg)' }}>
            <Zap className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="font-black text-lg tracking-tight bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4] bg-clip-text text-transparent">Live Quiz</span>
            {session?.activity?.title && (
              <p className="text-slate-400 text-xs truncate max-w-[150px] sm:max-w-none">{session.activity.title}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isTeacher && (
            <button 
              onClick={() => setShowAvatarPicker(!showAvatarPicker)} 
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
              title="Cambiar avatar"
            >
              <AnimalAvatar avatarId={myAvatarId} size="sm" />
            </button>
          )}
          <button onClick={toggleMusic} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors" title={musicOn ? 'Silenciar música' : 'Activar música'}>
            {musicOn ? <Volume2 className="w-5 h-5 text-[#4ECDC4]" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
          </button>
          <button onClick={() => { stopMusic(); onClose() }} className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Avatar picker dropdown */}
      <AnimatePresence>
        {showAvatarPicker && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-16 right-4 z-50 bg-slate-800 rounded-2xl shadow-2xl border border-white/20 p-2"
          >
            <AvatarSelector 
              selected={myAvatarId} 
              onSelect={(id) => {
                setMyAvatarId(id)
                localStorage.setItem('liveQuizAvatar', id)
                setShowAvatarPicker(false)
              }} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <div className="mx-4 mt-2 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-sm text-center">{error}</div>
      )}

      {/* SETUP (teacher picks mode + team names) */}
      {phase === 'setup' && isTeacher && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-8">
          <motion.div 
            className="w-full max-w-lg bg-white rounded-[30px] p-8 sm:p-10 shadow-2xl shadow-black/20 relative overflow-hidden"
            initial={{ opacity: 0, scale: 0.8, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, type: "spring" }}
          >
            {/* Decorative blobs inside card */}
            <div className="absolute -top-20 -right-20 w-60 h-60 bg-[#FF6B6B]/5 rounded-full pointer-events-none" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-[#4ECDC4]/5 rounded-full pointer-events-none" />
            
            <div className="relative z-10 space-y-8">
              {/* Title */}
              <div className="text-center space-y-3">
                <motion.div 
                  className="text-5xl inline-block"
                  animate={{ y: [0, -12, 0] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                >🚀</motion.div>
                <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-r from-[#FF6B6B] via-[#FFE66D] to-[#4ECDC4] bg-clip-text text-transparent">
                  {activityTitle || '¡Live Quiz!'}
                </h1>
                <p className="text-slate-400 font-semibold">Configura y comienza la diversión</p>
              </div>

              {/* Mode selector */}
              <div className="space-y-3">
                <p className="text-sm font-extrabold text-[#FF6B6B] uppercase tracking-widest text-center flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-[#FF6B6B] rounded-full" /> Modalidad
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <motion.button 
                    onClick={() => setMode('INDIVIDUAL')} 
                    whileHover={{ y: -6, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative p-5 rounded-2xl border-3 transition-all text-center ${
                      mode === 'INDIVIDUAL' 
                        ? 'bg-gradient-to-br from-[#FFE66D] to-[#FFD93D] border-[#FFC93D] shadow-lg shadow-yellow-300/30' 
                        : 'bg-gradient-to-br from-slate-50 to-purple-50 border-slate-200 hover:border-[#FF6B6B]'
                    }`}
                  >
                    {mode === 'INDIVIDUAL' && <span className="absolute top-2 right-3 text-[#FF6B6B] font-black text-lg">✓</span>}
                    <div className="text-3xl mb-2">👤</div>
                    <p className="text-slate-800 font-extrabold text-base">Individual</p>
                    <p className="text-slate-500 text-xs mt-1">Cada estudiante compite solo</p>
                  </motion.button>
                  <motion.button 
                    onClick={() => {
                      if (deliveryMode === 'ASYNC_HOME') return
                      setMode('TEAM')
                    }} 
                    whileHover={{ y: -6, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative p-5 rounded-2xl border-3 transition-all text-center ${
                      mode === 'TEAM' 
                        ? 'bg-gradient-to-br from-[#FFE66D] to-[#FFD93D] border-[#FFC93D] shadow-lg shadow-yellow-300/30' 
                        : deliveryMode === 'ASYNC_HOME'
                          ? 'bg-gradient-to-br from-slate-100 to-slate-200 border-slate-200 opacity-50 cursor-not-allowed'
                          : 'bg-gradient-to-br from-slate-50 to-purple-50 border-slate-200 hover:border-[#FF6B6B]'
                    }`}
                    disabled={deliveryMode === 'ASYNC_HOME'}
                  >
                    {mode === 'TEAM' && <span className="absolute top-2 right-3 text-[#FF6B6B] font-black text-lg">✓</span>}
                    <div className="text-3xl mb-2">🏆</div>
                    <p className="text-slate-800 font-extrabold text-base">Equipos</p>
                    <p className="text-slate-500 text-xs mt-1">Los estudiantes eligen un equipo</p>
                  </motion.button>
                </div>
              </div>

              {/* Delivery mode selector */}
              <div className="space-y-3">
                <p className="text-sm font-extrabold text-[#4ECDC4] uppercase tracking-widest text-center flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-[#4ECDC4] rounded-full" /> Entrega
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <motion.button
                    onClick={() => setDeliveryMode('SYNC')}
                    whileHover={{ y: -6, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative p-5 rounded-2xl border-3 transition-all text-center ${
                      deliveryMode === 'SYNC'
                        ? 'bg-gradient-to-br from-[#4ECDC4] to-[#3BA89F] border-[#2E8F88] shadow-lg shadow-teal-300/30'
                        : 'bg-gradient-to-br from-slate-50 to-cyan-50 border-slate-200 hover:border-[#4ECDC4]'
                    }`}
                  >
                    {deliveryMode === 'SYNC' && <span className="absolute top-2 right-3 text-white font-black text-lg">✓</span>}
                    <div className="text-3xl mb-2">🧑‍🏫</div>
                    <p className="text-slate-800 font-extrabold text-base">En vivo</p>
                    <p className="text-slate-500 text-xs mt-1">Todos juegan al mismo tiempo</p>
                  </motion.button>
                  <motion.button
                    onClick={() => {
                      setDeliveryMode('ASYNC_HOME')
                      setMode('INDIVIDUAL')
                    }}
                    whileHover={{ y: -6, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`relative p-5 rounded-2xl border-3 transition-all text-center ${
                      deliveryMode === 'ASYNC_HOME'
                        ? 'bg-gradient-to-br from-[#FF6B6B] to-[#FF8E72] border-[#FF6B6B] shadow-lg shadow-red-300/30'
                        : 'bg-gradient-to-br from-slate-50 to-rose-50 border-slate-200 hover:border-[#FF6B6B]'
                    }`}
                  >
                    {deliveryMode === 'ASYNC_HOME' && <span className="absolute top-2 right-3 text-white font-black text-lg">✓</span>}
                    <div className="text-3xl mb-2">🏠</div>
                    <p className="text-slate-800 font-extrabold text-base">En casa</p>
                    <p className="text-slate-500 text-xs mt-1">Cada estudiante avanza a su ritmo</p>
                  </motion.button>
                </div>
                {deliveryMode === 'ASYNC_HOME' && (
                  <p className="text-xs text-slate-500 text-center font-semibold">
                    El modo en casa usa progreso individual y ranking acumulado por estudiante.
                  </p>
                )}
              </div>

              {/* Team mode info */}
              {mode === 'TEAM' && deliveryMode !== 'ASYNC_HOME' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4 space-y-2"
                >
                  <p className="text-purple-700 font-bold text-sm">¿Cómo funciona?</p>
                  <ul className="text-purple-600 text-xs space-y-1">
                    <li>1. Cada estudiante puede crear un equipo con un nombre creativo</li>
                    <li>2. Pueden agregar compañeros a su equipo</li>
                    <li>3. O unirse a un equipo existente</li>
                  </ul>
                  <p className="text-amber-600 text-xs font-semibold flex items-center gap-1">
                    <Timer className="w-3.5 h-3.5" /> Máximo 20 equipos • Sin límite de integrantes
                  </p>
                </motion.div>
              )}

              {/* Time config */}
              <div className="space-y-3">
                <p className="text-sm font-extrabold text-[#FF6B6B] uppercase tracking-widest text-center flex items-center justify-center gap-2">
                  <span className="w-2 h-2 bg-[#FF6B6B] rounded-full" /> Tiempo por pregunta
                </p>
                <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-2xl p-5 border-2 border-blue-100 space-y-4">
                  <motion.div 
                    className="text-5xl sm:text-6xl font-black text-[#4ECDC4] text-center"
                    key={globalTimeLimit}
                    initial={{ scale: 0.9 }}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 0.3 }}
                    style={{ textShadow: '0 4px 10px rgba(78,205,196,0.2)' }}
                  >
                    {globalTimeLimit}s
                  </motion.div>
                  <input
                    type="range"
                    min={5}
                    max={120}
                    step={5}
                    value={globalTimeLimit}
                    onChange={e => setGlobalTimeLimit(Number(e.target.value))}
                    className="w-full h-3 rounded-full appearance-none cursor-pointer"
                    style={{ background: 'linear-gradient(90deg, #FF6B6B 0%, #FFE66D 50%, #4ECDC4 100%)' }}
                  />
                  <div className="flex items-center justify-center gap-3 pt-2 border-t-2 border-blue-100">
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={autoCloseOnTimeout}
                          onChange={e => setAutoCloseOnTimeout(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-6 h-6 border-3 border-[#4ECDC4] rounded-lg bg-white peer-checked:bg-gradient-to-br peer-checked:from-[#4ECDC4] peer-checked:to-[#3BA89F] peer-checked:border-[#4ECDC4] transition-all flex items-center justify-center">
                          {autoCloseOnTimeout && <span className="text-white text-sm font-black">✓</span>}
                        </div>
                      </div>
                      <span className="text-slate-500 text-sm font-semibold">Cerrar pregunta automáticamente</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Create session button */}
              <motion.button
                onClick={createSession}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-5 bg-gradient-to-r from-[#FF6B6B] to-[#FF8E72] text-white rounded-2xl text-lg font-black uppercase tracking-wide shadow-xl shadow-red-300/30 flex items-center justify-center gap-3 relative overflow-hidden group"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <span className="relative flex items-center gap-3">
                  <motion.span animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 0.8 }}>▶</motion.span>
                  ¡Vamos!
                </span>
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* LOADING */}
      {phase === 'loading' && (
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-center space-y-4">
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="inline-block"
            >
              <Loader2 className="w-14 h-14 text-white" />
            </motion.div>
            <p className="text-white font-bold text-lg">Preparando todo...</p>
          </div>
        </div>
      )}

      {/* LOBBY */}
      {phase === 'lobby' && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 space-y-8">
          <div className="text-center space-y-3">
            <motion.div className="text-5xl inline-block" animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>📡</motion.div>
            <h1 className="text-3xl sm:text-5xl font-black text-white drop-shadow-lg">
              {activityTitle || session?.activity?.title || 'Live Quiz'}
            </h1>
            <p className="text-white/80 text-lg font-semibold">
              {totalQuestions} preguntas
              {mode === 'TEAM' && <span className="ml-2 px-2 py-0.5 bg-white/20 text-white rounded-full text-xs font-bold">EQUIPOS</span>}
            </p>
          </div>

          {isTeacher ? (
            <div className="space-y-6 w-full max-w-lg">
              {/* Team display + assignment (teacher, TEAM mode) */}
              {mode === 'TEAM' && teams.length > 0 && (
                <div className="bg-white/5 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-white/80 font-semibold text-sm">Equipos</p>
                    {(session?.config as any)?.teamAssignment === 'TEACHER_ASSIGNED' && (
                      <button
                        onClick={async () => {
                          setShowTeamAssigner(!showTeamAssigner)
                          if (!showTeamAssigner && groupStudents.length === 0) {
                            try {
                              const { data } = await liveSessionApi.searchStudents(sessionId, '')
                              setGroupStudents(data)
                              const assignments: Record<string, string> = {}
                              data.forEach((s: any) => { if (s.teamId) assignments[s.enrollmentId] = s.teamId })
                              setTeamAssignments(assignments)
                            } catch {}
                          }
                        }}
                        className="text-xs text-purple-400 hover:text-purple-300 font-semibold"
                      >
                        {showTeamAssigner ? 'Ocultar asignación' : '✏️ Asignar estudiantes'}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {teams.map((t: any) => (
                      <div key={t.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10" style={{ backgroundColor: t.color + '20' }}>
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                        <span className="text-white text-sm font-medium truncate">{t.name}</span>
                        <span className="text-white/40 text-xs ml-auto">{t.members?.length || 0}</span>
                      </div>
                    ))}
                  </div>

                  {/* Teacher assignment panel */}
                  {showTeamAssigner && (
                    <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                      <p className="text-white/60 text-xs">Asigna cada estudiante a un equipo:</p>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {groupStudents.map((s: any) => (
                          <div key={s.enrollmentId} className="flex items-center gap-2 px-2 py-1.5 bg-white/5 rounded-lg">
                            <span className="text-white text-xs flex-1 truncate">{s.name}</span>
                            <select
                              value={teamAssignments[s.enrollmentId] || ''}
                              onChange={async (e) => {
                                const newTeamId = e.target.value
                                if (!newTeamId) return
                                setTeamAssignments(prev => ({ ...prev, [s.enrollmentId]: newTeamId }))
                                try {
                                  await liveSessionApi.addPartner(sessionId, newTeamId, s.enrollmentId)
                                } catch {}
                              }}
                              className="bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-white text-xs"
                            >
                              <option value="">Sin equipo</option>
                              {teams.map((t: any) => (
                                <option key={t.id} value={t.id} style={{ color: '#000' }}>{t.name}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {deliveryMode === 'ASYNC_HOME' ? (
                /* ASYNC HOME: El profesor solo publica, los estudiantes inician solos */
                <div className="space-y-4 text-center">
                  <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-400/50 rounded-2xl p-6 space-y-3">
                    <div className="text-4xl">🏠</div>
                    <h3 className="text-white font-bold text-lg">Quiz En Casa Activo</h3>
                    <p className="text-white/70 text-sm">
                      Los estudiantes pueden entrar cuando quieran y resolver el quiz a su propio ritmo.
                      Cada uno verá su progreso individual.
                    </p>
                    <div className="flex items-center justify-center gap-2 text-green-400 text-sm font-semibold">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      Esperando estudiantes...
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => setPhase('finished')}
                      className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg flex items-center gap-2 justify-center"
                    >
                      <Trophy className="w-5 h-5" /> Ver resultados parciales
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('¿Finalizar el quiz? Los estudiantes que no hayan terminado no podrán continuar.')) return
                        try {
                          await liveSessionApi.finish(sessionId)
                        } catch (err: any) {
                          alert('Error: ' + (err.response?.data?.message || err.message))
                        }
                      }}
                      className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 justify-center border border-white/20"
                    >
                      <XCircle className="w-4 h-4" /> Cerrar quiz
                    </button>
                  </div>
                </div>
              ) : (
                /* SYNC: Flujo normal - profesor controla cada pregunta */
                <>
                  <p className="text-white/60 text-center text-sm">
                    {(session?.config as any)?.teamAssignment === 'TEACHER_ASSIGNED' 
                      ? 'Asigna los estudiantes a equipos antes de iniciar'
                      : 'Los estudiantes pueden unirse desde su aula virtual'}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={handleStart}
                      className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl text-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg shadow-green-500/30 flex items-center gap-3 justify-center"
                    >
                      <Play className="w-6 h-6" /> Iniciar primera pregunta
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm('¿Reiniciar sesión? Se borrarán todas las respuestas anteriores.')) return
                        try {
                          const { data } = await liveSessionApi.reset(sessionId)
                          alert(`Sesión reiniciada. Se eliminaron ${data.deletedAnswers} respuestas.`)
                        } catch (err: any) {
                          alert('Error al reiniciar: ' + (err.response?.data?.message || err.message))
                        }
                      }}
                      className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white/80 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 justify-center border border-white/20"
                    >
                      <RotateCcw className="w-4 h-4" /> Reiniciar sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center space-y-4 w-full max-w-md">
              {/* Student: Team selection or waiting for assignment */}
              {mode === 'TEAM' ? (
                (session?.config as any)?.teamAssignment === 'TEACHER_ASSIGNED' && teams.length > 0 ? (
                  // Teacher assigns teams - student just waits
                  <div className="space-y-4">
                    <p className="text-white/80 font-semibold">Equipos</p>
                    <div className="grid grid-cols-2 gap-3">
                      {teams.map((t: any) => {
                        const isMyTeam = t.members?.some((m: any) => m.studentEnrollmentId === myTeamId) || myTeamId === t.id
                        const memberCount = t.members?.length || 0
                        return (
                          <div
                            key={t.id}
                            className={`p-4 rounded-2xl border-2 text-center ${isMyTeam ? 'border-green-400 bg-green-500/20' : 'border-white/10 bg-white/5'}`}
                          >
                            <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: t.color }}>
                              {t.name.charAt(0)}
                            </div>
                            <p className="text-white font-semibold text-sm">{t.name}</p>
                            <p className="text-white/40 text-xs">{memberCount} miembros</p>
                            {isMyTeam && <p className="text-green-400 text-xs font-bold mt-1">✓ Tu equipo</p>}
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-indigo-300 text-sm animate-pulse">
                      {myTeamId ? 'Esperando a que el profesor inicie...' : 'El profesor te asignará a un equipo...'}
                    </p>
                  </div>
                ) : (
                  // Students choose or create teams (Kahoot-style) - IMPROVED UI
                  <div className="space-y-5 w-full">
                    
                    {/* Header con estado */}
                    <div className="text-center">
                      {myTeamId ? (
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/40 rounded-full">
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                          <span className="text-green-400 font-semibold">¡Estás en un equipo!</span>
                        </div>
                      ) : (
                        <p className="text-white/80 font-semibold text-lg">
                          {teams.length > 0 ? '¡Únete a un equipo!' : '¡Crea tu equipo!'}
                        </p>
                      )}
                    </div>

                    {/* Mi equipo actual (si ya tengo uno) */}
                    {myTeamId && (() => {
                      const myTeam = teams.find((t: any) => t.id === myTeamId)
                      if (!myTeam) return null
                      const members = myTeam.members || []
                      return (
                        <div className="bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border-2 border-purple-400/50 rounded-2xl p-5 space-y-4">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg" style={{ backgroundColor: myTeam.color }}>
                              {myTeam.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <p className="text-white font-bold text-xl">{myTeam.name}</p>
                              <p className="text-purple-300 text-sm">{members.length} integrante{members.length !== 1 ? 's' : ''}</p>
                            </div>
                          </div>
                          
                          {/* Lista de miembros */}
                          {members.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {members.map((m: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full">
                                  <div className="w-6 h-6 rounded-full bg-purple-500/50 flex items-center justify-center text-white text-xs font-bold">
                                    {m.studentEnrollment?.student?.firstName?.charAt(0) || '?'}
                                  </div>
                                  <span className="text-white text-sm">
                                    {m.studentEnrollment?.student?.firstName} {m.studentEnrollment?.student?.lastName?.split(' ')[0]}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Botón agregar compañero */}
                          {!showAddPartner ? (
                            <button 
                              onClick={() => { setShowAddPartner(true); handleSearchPartner('') }}
                              className="w-full px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                            >
                              <Users className="w-4 h-4" />
                              Agregar compañero al equipo
                            </button>
                          ) : (
                            <div className="bg-black/20 rounded-xl p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-white font-semibold text-sm">Selecciona compañeros</p>
                                <button onClick={() => setShowAddPartner(false)} className="text-white/40 hover:text-white text-xs">✕ Cerrar</button>
                              </div>
                              <input
                                value={partnerSearch}
                                onChange={e => handleSearchPartner(e.target.value)}
                                placeholder="Buscar por nombre..."
                                autoFocus
                                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-purple-400"
                              />
                              <div className="max-h-48 overflow-y-auto space-y-1.5">
                                {searchingPartner ? (
                                  <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                                  </div>
                                ) : partnerResults.length === 0 ? (
                                  <p className="text-white/40 text-sm text-center py-4">No se encontraron estudiantes</p>
                                ) : (
                                  partnerResults.map((s: any) => {
                                    const inMyTeam = s.teamId === myTeamId
                                    const inOtherTeam = s.teamId && s.teamId !== myTeamId
                                    return (
                                      <div key={s.enrollmentId} className={`flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${inMyTeam ? 'bg-green-500/20' : 'bg-white/5 hover:bg-white/10'}`}>
                                        <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center text-white text-sm font-bold">
                                            {s.name.charAt(0)}
                                          </div>
                                          <span className="text-white text-sm font-medium">{s.name}</span>
                                        </div>
                                        {inMyTeam ? (
                                          <span className="flex items-center gap-1 text-green-400 text-xs font-bold">
                                            <CheckCircle2 className="w-4 h-4" /> En tu equipo
                                          </span>
                                        ) : inOtherTeam ? (
                                          <span className="text-white/30 text-xs">En otro equipo</span>
                                        ) : (
                                          <button
                                            onClick={() => handleAddPartner(s.enrollmentId)}
                                            disabled={!!addingPartner}
                                            className="px-4 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                          >
                                            {addingPartner === s.enrollmentId ? '...' : '+ Agregar'}
                                          </button>
                                        )}
                                      </div>
                                    )
                                  })
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {/* Equipos disponibles para unirse (si no tengo equipo) */}
                    {!myTeamId && teams.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-white/60 text-sm font-medium text-center">Equipos disponibles</p>
                        <div className="grid grid-cols-2 gap-3">
                          {teams.map((t: any) => {
                            const memberCount = t.members?.length || 0
                            const memberNames = t.members?.slice(0, 3).map((m: any) => 
                              m.studentEnrollment?.student?.firstName || '?'
                            ).join(', ') || ''
                            return (
                              <button
                                key={t.id}
                                onClick={async () => {
                                  if (joiningTeam) return
                                  setJoiningTeam(true)
                                  try {
                                    await liveSessionApi.joinTeam(sessionId, t.id)
                                    setMyTeamId(t.id)
                                  } catch {}
                                  setJoiningTeam(false)
                                }}
                                disabled={joiningTeam}
                                className="p-4 rounded-2xl border-2 border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30 transition-all text-left group"
                              >
                                <div className="flex items-center gap-3 mb-2">
                                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg group-hover:scale-110 transition-transform" style={{ backgroundColor: t.color }}>
                                    {t.name.charAt(0)}
                                  </div>
                                  <div>
                                    <p className="text-white font-semibold text-sm">{t.name}</p>
                                    <p className="text-white/40 text-xs">{memberCount} miembro{memberCount !== 1 ? 's' : ''}</p>
                                  </div>
                                </div>
                                {memberNames && (
                                  <p className="text-white/30 text-xs truncate">{memberNames}{memberCount > 3 ? '...' : ''}</p>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Crear equipo (si no tengo uno) */}
                    {!myTeamId && (
                      <div className="space-y-3">
                        {teams.length > 0 && (
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-white/10" />
                            <span className="text-white/40 text-xs">o crea uno nuevo</span>
                            <div className="flex-1 h-px bg-white/10" />
                          </div>
                        )}
                        
                        {!showCreateTeam ? (
                          <button
                            onClick={() => setShowCreateTeam(true)}
                            className="w-full px-5 py-4 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-purple-500/25 flex items-center justify-center gap-3"
                          >
                            <Award className="w-6 h-6" />
                            {teams.length > 0 ? 'Crear mi propio equipo' : '¡Crear mi equipo!'}
                          </button>
                        ) : (
                          <div className="bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/30 rounded-2xl p-5 space-y-4">
                            <div className="flex items-center gap-3">
                              <Award className="w-8 h-8 text-purple-400" />
                              <div>
                                <p className="text-white font-bold">Nombre de tu equipo</p>
                                <p className="text-purple-300 text-xs">Elige un nombre creativo</p>
                              </div>
                            </div>
                            <input
                              value={newTeamName}
                              onChange={e => setNewTeamName(e.target.value)}
                              placeholder="Ej: Los Invencibles, Team Rocket, Los Genios..."
                              maxLength={25}
                              autoFocus
                              className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 text-white text-lg placeholder:text-white/30 focus:outline-none focus:border-purple-400 transition-all"
                              onKeyDown={e => e.key === 'Enter' && newTeamName.trim() && handleCreateTeam()}
                            />
                            <div className="flex gap-3">
                              <button
                                onClick={() => { setShowCreateTeam(false); setNewTeamName('') }}
                                className="flex-1 px-4 py-3 bg-white/10 text-white/60 rounded-xl font-medium hover:bg-white/20 transition-all"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={handleCreateTeam}
                                disabled={!newTeamName.trim() || creatingTeam}
                                className="flex-1 px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {creatingTeam ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                {creatingTeam ? 'Creando...' : 'Crear'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mensaje de espera */}
                    {myTeamId && !showAddPartner && (
                      <div className="text-center pt-4">
                        <div className="inline-flex items-center gap-2 text-indigo-300 animate-pulse">
                          <Radio className="w-4 h-4" />
                          <span className="text-sm">Esperando a que el profesor inicie el quiz...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              ) : (
                /* INDIVIDUAL MODE - Avatar selection screen */
                <div className="space-y-6 w-full max-w-md">
                  {/* Title */}
                  <div className="text-center">
                    <h2 className="text-2xl font-black text-white mb-2">¡Elige tu avatar!</h2>
                    <p className="text-white/60">Selecciona el animal que te representará</p>
                  </div>

                  {/* Current avatar display */}
                  <motion.div 
                    className="flex flex-col items-center"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                  >
                    <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-6xl shadow-2xl mb-3">
                      {ANIMAL_AVATARS.find(a => a.id === myAvatarId)?.emoji || '🐱'}
                    </div>
                    <p className="text-white font-bold text-lg">
                      {ANIMAL_AVATARS.find(a => a.id === myAvatarId)?.name || 'Gato'}
                    </p>
                  </motion.div>

                  {/* Avatar grid */}
                  <div className="grid grid-cols-5 gap-2">
                    {ANIMAL_AVATARS.map((avatar) => (
                      <motion.button
                        key={avatar.id}
                        onClick={() => {
                          setMyAvatarId(avatar.id)
                          localStorage.setItem(`liveQuizAvatar_${sessionId}`, avatar.id)
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                        className={`aspect-square rounded-xl flex items-center justify-center text-2xl transition-all ${
                          myAvatarId === avatar.id 
                            ? 'bg-purple-500 ring-2 ring-white shadow-lg' 
                            : 'bg-white/10 hover:bg-white/20'
                        }`}
                      >
                        {avatar.emoji}
                      </motion.button>
                    ))}
                  </div>

                  {/* Waiting message */}
                  <div className="text-center pt-2">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/20 rounded-full">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      >
                        <Loader2 className="w-4 h-4 text-indigo-400" />
                      </motion.div>
                      <span className="text-indigo-300 text-sm font-medium">Esperando a que el profesor inicie...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* QUESTION - waiting state when student joins mid-session before SSE QUESTION event */}
      {phase === 'question' && !currentQuestion && !isTeacher && (
        <div className="flex items-center justify-center min-h-[60vh]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white/95 backdrop-blur-md rounded-3xl p-10 text-center shadow-2xl max-w-sm mx-4"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="inline-block mb-4"
            >
              <Loader2 className="w-12 h-12 text-[#4ECDC4]" />
            </motion.div>
            <p className="text-slate-800 text-xl font-black mb-1">¡Pregunta en curso!</p>
            <p className="text-slate-400 text-sm">Espera a la siguiente pregunta...</p>
          </motion.div>
        </div>
      )}

      {/* QUESTION */}
      <AnimatePresence mode="wait">
      {phase === 'question' && currentQuestion && (
        <motion.div 
          key={`question-${questionIndex}`}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="max-w-3xl mx-auto px-4 py-6 space-y-6"
        >
          {/* Question header with circular timer */}
          <motion.div 
            className="flex items-center justify-between bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg shadow-black/5"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#FF6B6B] to-[#FF8E72] rounded-xl flex items-center justify-center text-white font-black text-lg shadow-md">
                {questionIndex + 1}
              </div>
              <div>
                <p className="text-slate-800 font-bold">Pregunta {questionIndex + 1}</p>
                <p className="text-slate-400 text-xs">de {totalQuestions}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {isBonus && (
                <motion.div 
                  className="px-3 py-1.5 bg-[#FFE66D] text-amber-800 rounded-xl text-xs font-black flex items-center gap-1 shadow-lg"
                  animate={{ scale: [1, 1.1, 1], rotate: [0, -3, 3, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Sparkles className="w-3 h-3" />BONUS x{multiplier}
                </motion.div>
              )}
              <CircularTimer timeLeft={timeLeft} totalTime={timeLimit} size={56} />
            </div>
          </motion.div>

          {/* Context (reading passage / shared context) */}
          {currentQuestion.context && (
            <div className="bg-white/95 backdrop-blur-md border-2 border-amber-200 rounded-2xl overflow-hidden shadow-md">
              <button
                onClick={() => setContextExpanded(prev => !prev)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-amber-50 transition-colors"
              >
                <span className="text-amber-700 font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                  📖 {currentQuestion.context.title || 'Contexto / Lectura'}
                </span>
                <ChevronRight className={`w-4 h-4 text-amber-600 transition-transform duration-200 ${contextExpanded ? 'rotate-90' : ''}`} />
              </button>
              {contextExpanded && (
                <div className="px-5 pb-4 space-y-3">
                  {currentQuestion.context.text && (
                    <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-line">{currentQuestion.context.text}</p>
                  )}
                  {currentQuestion.context.imageUrl && (
                    <img src={currentQuestion.context.imageUrl} alt="" className="max-h-48 rounded-xl mx-auto object-contain" />
                  )}
                </div>
              )}
              {!contextExpanded && currentQuestion.context.text && (
                <p className="px-5 pb-3 text-slate-400 text-xs truncate">
                  {currentQuestion.context.text.substring(0, 120)}...
                  <span className="text-amber-600 ml-1 font-medium">Toca para leer</span>
                </p>
              )}
            </div>
          )}

          {/* Question text + image */}
          <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 shadow-lg shadow-black/5">
            <p className="text-xl sm:text-2xl font-bold text-slate-800 leading-relaxed">{currentQuestion.text}</p>
            {currentQuestion.imageUrl && (
              <img src={currentQuestion.imageUrl} alt="" className="mt-4 max-h-64 rounded-xl mx-auto object-contain" />
            )}
          </div>

          {/* Answer area */}
          {isTeacher ? (
            <motion.div 
              className="text-center space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <div className="bg-white/95 backdrop-blur-md rounded-2xl p-5 shadow-lg shadow-black/5">
                <div className="flex items-center justify-center gap-6 mb-4">
                  <motion.div 
                    className="text-center"
                    animate={{ scale: totalAnswered > 0 ? [1, 1.1, 1] : 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <p className="text-4xl font-black bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4] bg-clip-text text-transparent">{totalAnswered}</p>
                    <p className="text-slate-400 text-sm font-semibold">respuestas</p>
                  </motion.div>
                </div>
                <div className="flex justify-center gap-3 flex-wrap">
                  <motion.button 
                    onClick={handleCloseQuestion} 
                    className="px-6 py-3 bg-gradient-to-r from-[#FF6B6B] to-[#FF8E72] text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-red-300/30"
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Clock className="w-4 h-4" /> Cerrar pregunta
                  </motion.button>
                  <motion.button 
                    onClick={handleShowRanking} 
                    className="px-6 py-3 bg-gradient-to-r from-[#FFE66D] to-[#FFD93D] text-amber-800 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-yellow-300/30"
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Trophy className="w-4 h-4" /> Ver ranking
                  </motion.button>
                  {questionIndex < totalQuestions - 1 ? (
                    <motion.button 
                      onClick={handleNextQuestion} 
                      className="px-6 py-3 bg-gradient-to-r from-[#4ECDC4] to-[#3BA89F] text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-teal-300/30"
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <SkipForward className="w-4 h-4" /> Siguiente
                    </motion.button>
                  ) : (
                    <motion.button 
                      onClick={handleFinish} 
                      className="px-6 py-3 bg-gradient-to-r from-[#FF6B6B] to-[#FF8E72] text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-red-300/30"
                      whileHover={{ scale: 1.05, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Trophy className="w-4 h-4" /> Finalizar
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            /* Student answer UI */
            <div className="space-y-3">
              <AnimatePresence mode="wait">
              {answered && answerResult ? (
                /* ── RESULT REVEALED (after QUESTION_CLOSED) ── */
                <motion.div 
                  key="result"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", duration: 0.5 }}
                  className={`text-center p-6 rounded-2xl shadow-lg ${answerResult.isCorrect ? 'bg-white/95 border-2 border-green-300' : 'bg-white/95 border-2 border-red-300'}`}
                >
                  {answerResult.isCorrect ? (
                    <>
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", duration: 0.6 }}
                      >
                        <CheckCircle2 className="w-16 h-16 text-[#4ECDC4] mx-auto mb-3" />
                      </motion.div>
                      <motion.p 
                        className="text-[#4ECDC4] text-2xl font-black"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        ¡Correcto!
                      </motion.p>
                      <motion.p 
                        className="text-[#4ECDC4] text-xl font-black mt-2"
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3, type: "spring" }}
                      >
                        +{animatedPoints} pts
                      </motion.p>
                      {streak > 1 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-[#FFE66D]/30 text-amber-700 rounded-full text-sm font-bold"
                        >
                          🔥 Racha x{streak}
                        </motion.div>
                      )}
                    </>
                  ) : (
                    <>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1, x: [0, -10, 10, -10, 10, 0] }}
                        transition={{ duration: 0.5 }}
                      >
                        <XCircle className="w-16 h-16 text-[#FF6B6B] mx-auto mb-3" />
                      </motion.div>
                      <motion.p 
                        className="text-[#FF6B6B] text-2xl font-black"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        Incorrecto
                      </motion.p>
                      <p className="text-[#FF6B6B]/70 text-sm mt-1 font-semibold">0 pts</p>
                    </>
                  )}
                </motion.div>
              ) : answered && !answerResult ? (
                /* ── WAITING STATE: answered but result not yet revealed ── */
                <motion.div
                  key="waiting"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="text-center p-8 rounded-2xl bg-white/95 border-2 border-[#4ECDC4]/30 shadow-lg"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="inline-block"
                  >
                    <Loader2 className="w-14 h-14 text-[#4ECDC4] mx-auto mb-4" />
                  </motion.div>
                  <motion.p 
                    className="text-[#4ECDC4] text-xl font-bold"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    ¡Respuesta enviada!
                  </motion.p>
                  <p className="text-slate-400 text-sm mt-2">Esperando a que se cierre la pregunta...</p>
                </motion.div>
              ) : timeLeft <= 0 && !answered ? (
                <motion.div 
                  key="timeout"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center p-6 rounded-2xl bg-white/95 shadow-lg"
                >
                  <Clock className="w-14 h-14 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400 text-xl font-bold">Tiempo agotado</p>
                </motion.div>
              ) : (
                <motion.div key="options" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {renderAnswerOptions()}
                </motion.div>
              )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      )}
      </AnimatePresence>

      {/* ANSWER REVEAL */}
      {phase === 'answer_reveal' && (
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          {/* ── Student result banner ── */}
          {!isTeacher && answerResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", duration: 0.6, bounce: 0.4 }}
              className={`rounded-3xl p-8 text-center shadow-2xl ${
                answerResult.isCorrect 
                  ? 'bg-gradient-to-br from-[#4ECDC4] to-[#3BA89F]' 
                  : 'bg-gradient-to-br from-[#FF6B6B] to-[#E85555]'
              }`}
            >
              <motion.div
                initial={{ scale: 0, rotate: answerResult.isCorrect ? -180 : 0 }}
                animate={{ 
                  scale: 1, 
                  rotate: 0,
                  ...(answerResult.isCorrect ? {} : { x: [0, -8, 8, -8, 8, 0] })
                }}
                transition={{ type: "spring", duration: 0.7, delay: 0.1 }}
                className="w-24 h-24 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center"
              >
                {answerResult.isCorrect 
                  ? <CheckCircle2 className="w-16 h-16 text-white drop-shadow-lg" />
                  : <XCircle className="w-16 h-16 text-white drop-shadow-lg" />
                }
              </motion.div>
              <motion.h2 
                className="text-4xl font-black mb-2 text-white drop-shadow-md"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                {answerResult.isCorrect ? '¡Correcto!' : '¡Incorrecto!'}
              </motion.h2>
              <motion.p
                className="text-3xl font-bold text-white/90"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35, type: "spring" }}
              >
                {answerResult.isCorrect ? `+${animatedPoints} pts` : '0 pts'}
              </motion.p>
              {answerResult.isCorrect && streak > 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                  className="mt-4 inline-flex items-center gap-2 px-5 py-2 bg-yellow-400 text-yellow-900 rounded-full text-base font-black shadow-lg"
                >
                  🔥 ¡Racha de {streak}!
                </motion.div>
              )}
              {!answerResult.isCorrect && selectedAnswer && (
                <motion.p
                  className="text-white/70 text-sm mt-4"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  Tu respuesta: <span className="font-semibold text-white/90">{selectedAnswer}</span>
                </motion.p>
              )}
            </motion.div>
          )}

          {/* ── Student: no answer submitted ── */}
          {!isTeacher && !answerResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-3xl p-6 text-center bg-white/95 border-2 border-slate-200 shadow-lg"
            >
              <Clock className="w-14 h-14 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400 text-xl font-bold">No respondiste a tiempo</p>
            </motion.div>
          )}

          {/* ── Correct answer card (visible to all) ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: isTeacher ? 0 : 0.5 }}
            className="bg-white/95 backdrop-blur-md rounded-2xl p-6 text-center space-y-3 shadow-xl"
          >
            <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">La respuesta correcta es</p>
            {correctAnswer && (
              <motion.p
                className="text-[#4ECDC4] text-2xl font-black"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: isTeacher ? 0.1 : 0.6, type: "spring" }}
              >
                {correctAnswer}
              </motion.p>
            )}
            {explanation && (
              <motion.p 
                className="text-slate-500 text-sm mt-2 italic"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: isTeacher ? 0.2 : 0.7 }}
              >
                {explanation}
              </motion.p>
            )}
          </motion.div>

          {/* ── Teacher controls ── */}
          {isTeacher && (
            <motion.div
              className="flex justify-center gap-4 flex-wrap"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <motion.button 
                onClick={handleShowRanking} 
                className="px-8 py-4 bg-gradient-to-r from-[#FFE66D] to-[#FFD93D] text-amber-800 rounded-2xl text-lg font-black flex items-center gap-3 shadow-2xl shadow-yellow-300/40"
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
              >
                <Trophy className="w-6 h-6" /> Ver ranking
              </motion.button>
              {questionIndex < totalQuestions - 1 ? (
                <motion.button 
                  onClick={handleNextQuestion} 
                  className="px-8 py-4 bg-gradient-to-r from-[#4ECDC4] to-[#3BA89F] text-white rounded-2xl text-lg font-black flex items-center gap-3 shadow-2xl shadow-teal-400/40"
                  whileHover={{ scale: 1.05, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <SkipForward className="w-6 h-6" /> Siguiente pregunta
                </motion.button>
              ) : (
                <motion.button 
                  onClick={handleFinish} 
                  className="px-8 py-4 bg-gradient-to-r from-[#FF6B6B] to-[#FF8E72] text-white rounded-2xl text-lg font-black flex items-center gap-3 shadow-2xl shadow-red-400/40"
                  whileHover={{ scale: 1.05, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Trophy className="w-6 h-6" /> Finalizar Quiz
                </motion.button>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* RANKING */}
      {(phase === 'ranking' || phase === 'finished') && (
        <motion.div 
          className="relative max-w-2xl mx-auto px-4 py-6 space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {/* Title */}
          <motion.div 
            className="text-center space-y-2"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl font-black text-white drop-shadow-lg">
              {phase === 'finished' 
                ? '🏆 Resultados Finales' 
                : rankingMeta?.isPartial 
                  ? '📊 Resultados Parciales'
                  : '📊 Ranking'}
            </h2>
            {/* Async home: show completion counter */}
            {rankingMeta && (
              <p className="text-white/80 text-sm font-semibold">
                {rankingMeta.completedCount} de {rankingMeta.totalExpected} estudiantes completaron
                {rankingMeta.isPartial && <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">En curso</span>}
              </p>
            )}
          </motion.div>

          {/* Podium for finished state - show even with 1-2 participants */}
          {phase === 'finished' && ranking.length >= 1 && (
            <Podium 
              entries={ranking.slice(0, 3).map((r, i) => ({
                name: r.name,
                avatarId: r.avatarId || getAvatarFromName(r.name).id,
                score: r.academicPoints ?? r.totalPoints,
                rank: r.rank
              }))}
            />
          )}

          {/* Ranking list (top 5 for ranking phase, all for finished with scroll) */}
          {/* In finished phase, delay appearance to let podium animation complete (~5s) */}
          <motion.div 
            className={`space-y-2 bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-lg ${phase === 'finished' ? 'max-h-[50vh] overflow-y-auto' : ''}`}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: phase === 'finished' ? 5 : 0, duration: 0.5 }}
          >
            {(phase === 'finished' ? ranking : ranking.slice(0, 5)).map((entry, i) => {
              // Use avatarId from backend if available, fallback to hash-based
              const isMe = !isTeacher && entry.studentEnrollmentId === studentEnrollmentId
              const avatarId = entry.avatarId || getAvatarFromName(entry.name).id
              const avatar = { ...getAvatarFromName(entry.name), id: avatarId }
              const isTop3 = entry.rank <= 3
              const rankColors = {
                1: 'text-amber-500 drop-shadow-[0_1px_1px_rgba(120,53,15,0.35)]',
                2: 'text-slate-500',
                3: 'text-amber-700'
              }
              const bgColors = ['bg-gradient-to-r from-[#FFE66D]/20 to-[#FFD93D]/10', 'bg-slate-100', 'bg-amber-50', 'bg-slate-50']
              const rankSuffix = entry.rank === 1 ? 'st' : entry.rank === 2 ? 'nd' : entry.rank === 3 ? 'rd' : 'th'
              const displayScore = entry.academicPoints ?? entry.totalPoints
              
              return (
                <motion.div 
                  key={entry.name + i} 
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isMe 
                      ? 'bg-gradient-to-r from-purple-500/20 to-cyan-500/20 ring-2 ring-purple-400 shadow-lg' 
                      : bgColors[Math.min(i, 3)]
                  }`}
                  variants={{
                    hidden: { opacity: 0, x: -30 },
                    visible: { opacity: 1, x: 0 }
                  }}
                  transition={{ type: "spring", duration: 0.4 }}
                  whileHover={{ scale: 1.02, x: 5 }}
                >
                  {/* Rank */}
                  <div className={`w-10 text-center font-black text-xl ${isTop3 ? rankColors[entry.rank as 1 | 2 | 3] : 'text-slate-500'}`}>
                    {entry.rank}<sup className="text-xs">{rankSuffix}</sup>
                  </div>
                  
                  {/* Avatar */}
                  <motion.div
                    animate={entry.rank === 1 && phase === 'finished' ? { y: [0, -3, 0] } : {}}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    <AnimalAvatar avatarId={avatar.id} size="sm" animate={entry.rank === 1} />
                  </motion.div>
                  
                  {/* Name + "Tú" badge */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`font-bold truncate ${isMe ? 'text-purple-700' : 'text-slate-800'}`}>{entry.name}</p>
                      {isMe && <span className="px-2 py-0.5 bg-purple-500 text-white text-xs font-bold rounded-full">Tú</span>}
                    </div>
                    {entry.correctAnswers !== undefined && (
                      <p className="text-slate-400 text-xs">{entry.correctAnswers} correctas</p>
                    )}
                  </div>
                  
                  {/* Score */}
                  <motion.div 
                    className="text-right"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                  >
                    <p className={`text-xl font-black ${isMe ? 'text-purple-600' : 'bg-gradient-to-r from-[#FF6B6B] to-[#4ECDC4] bg-clip-text text-transparent'}`}>{displayScore.toLocaleString()}</p>
                  </motion.div>
                </motion.div>
              )
            })}
            {ranking.length === 0 && phase === 'ranking' && (
              <p className="text-slate-400 text-center py-6">Sin respuestas aún</p>
            )}
          </motion.div>

          {/* Teacher controls */}
          {isTeacher && phase === 'ranking' && (
            <div className="flex justify-center gap-3 pt-2">
              {questionIndex < totalQuestions - 1 ? (
                <motion.button 
                  onClick={handleNextQuestion} 
                  className="px-6 py-3 bg-gradient-to-r from-[#4ECDC4] to-[#3BA89F] text-white rounded-xl font-bold shadow-lg shadow-teal-300/30 flex items-center gap-2"
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <SkipForward className="w-5 h-5" /> Siguiente
                </motion.button>
              ) : null}
              <motion.button 
                onClick={handleFinish} 
                className="px-6 py-3 bg-gradient-to-r from-[#FF6B6B] to-[#FF8E72] text-white rounded-xl font-bold shadow-lg shadow-red-300/30 flex items-center gap-2"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
              >
                <Trophy className="w-5 h-5" /> Finalizar
              </motion.button>
            </div>
          )}

          {/* Finished state - show student position or session ended message */}
          {phase === 'finished' && (
            <motion.div 
              className="text-center pt-4 space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ranking.length > 0 ? 6 : 0.5 }}
            >
              {/* Show student's position if they participated */}
              {!isTeacher && ranking.length > 0 && (() => {
                const myPosition = ranking.findIndex(r => r.studentEnrollmentId === studentEnrollmentId)
                if (myPosition >= 0) {
                  const myEntry = ranking[myPosition]
                  return (
                    <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 text-center space-y-3 shadow-lg">
                      <p className="text-slate-700 text-xl font-bold">🎉 ¡Quiz finalizado!</p>
                      <p className="text-3xl font-black bg-gradient-to-r from-purple-600 to-cyan-500 bg-clip-text text-transparent">
                        Quedaste en el puesto #{myPosition + 1}
                      </p>
                      <p className="text-slate-500">
                        con <span className="font-bold text-slate-700">{(myEntry.academicPoints ?? myEntry.totalPoints).toLocaleString()}</span> puntos
                      </p>
                    </div>
                  )
                }
                return null
              })()}
              
              {/* Show session ended message only if no ranking data */}
              {ranking.length === 0 && (
                <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 text-center space-y-3 shadow-lg">
                  <XCircle className="w-14 h-14 text-slate-300 mx-auto" />
                  <p className="text-slate-700 text-xl font-bold">La sesión ha terminado</p>
                  <p className="text-slate-400 text-sm">El profesor ha finalizado el quiz</p>
                </div>
              )}
              
              <motion.button 
                onClick={onClose} 
                className="px-8 py-4 bg-gradient-to-r from-[#4ECDC4] to-[#3BA89F] text-white rounded-2xl text-lg font-black shadow-xl shadow-teal-400/30 transition-all"
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
              >
                Volver al aula
              </motion.button>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // ANSWER OPTIONS RENDERER (student)
  // ═══════════════════════════════════════════════════════════════════════════

  function renderAnswerOptions() {
    if (!currentQuestion) return null
    const q = currentQuestion
    const type = q.type
    const options = q.options

    // MULTIPLE_CHOICE / TRUE_FALSE
    if (type === 'MULTIPLE_CHOICE' || type === 'TRUE_FALSE') {
      const opts = Array.isArray(options) ? options as string[] : []
      // Blooket/Kahoot style colors with shapes
      const optStyles = [
        { bg: 'bg-[#FF6B6B] hover:bg-[#E85555]', shape: '▲' },
        { bg: 'bg-[#4ECDC4] hover:bg-[#3BA89F]', shape: '◆' },
        { bg: 'bg-[#FFE66D] hover:bg-[#FFD93D] !text-amber-800', shape: '●' },
        { bg: 'bg-[#95E1D3] hover:bg-[#7DCFC0]', shape: '■' },
        { bg: 'bg-[#FF8E72] hover:bg-[#E87A60]', shape: '★' },
        { bg: 'bg-[#A8E6CF] hover:bg-[#8DD4B8] !text-emerald-800', shape: '♥' },
      ]
      return (
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          variants={staggerContainer}
          initial="initial"
          animate="animate"
        >
          {opts.map((opt: string, i: number) => (
            <motion.button
              key={i}
              onClick={() => handleSelectOption(opt)}
              disabled={answered}
              variants={optionVariants}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className={`relative p-5 sm:p-6 rounded-2xl text-white font-bold text-base sm:text-lg text-left transition-all ${optStyles[i % optStyles.length].bg} disabled:opacity-50 shadow-xl overflow-hidden`}
            >
              {/* Shape icon */}
              <span className="absolute top-3 left-3 text-white/30 text-2xl">{optStyles[i % optStyles.length].shape}</span>
              {/* Answer text */}
              <span className="relative z-10 block pl-8">{opt}</span>
              {/* Decorative gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
            </motion.button>
          ))}
        </motion.div>
      )
    }

    // MULTIPLE_SELECT
    if (type === 'MULTIPLE_SELECT') {
      const opts = Array.isArray(options) ? options as string[] : []
      return (
        <div className="space-y-3">
          {opts.map((opt: string, i: number) => {
            const sel = multiAnswers.includes(opt)
            return (
              <button
                key={i}
                onClick={() => handleMultiSelect(opt)}
                className={`w-full p-4 rounded-2xl text-left font-semibold transition-all ${sel ? 'bg-[#4ECDC4]/20 border-2 border-[#4ECDC4] text-white' : 'bg-white/15 border-2 border-white/15 text-white/80 hover:border-white/40'}`}
              >
                <span className="mr-2 opacity-60">{String.fromCharCode(65 + i)}.</span>{opt}
              </button>
            )
          })}
          <button onClick={submitMultiAnswer} disabled={multiAnswers.length === 0} className="w-full py-3 bg-gradient-to-r from-[#4ECDC4] to-[#3BA89F] text-white rounded-xl font-bold shadow-md disabled:opacity-40">
            Confirmar selección
          </button>
        </div>
      )
    }

    // SHORT_ANSWER
    if (type === 'SHORT_ANSWER') {
      return (
        <div className="flex gap-2">
          <input
            value={selectedAnswer}
            onChange={e => setSelectedAnswer(e.target.value)}
            placeholder="Escribe tu respuesta..."
            className="flex-1 bg-white/95 border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-lg placeholder:text-slate-300 focus:outline-none focus:border-[#4ECDC4] shadow-md"
          />
          <button onClick={() => submitAnswer(selectedAnswer)} disabled={!selectedAnswer.trim()} className="px-6 py-3 bg-gradient-to-r from-[#4ECDC4] to-[#3BA89F] text-white rounded-xl font-bold shadow-md disabled:opacity-40">
            Enviar
          </button>
        </div>
      )
    }

    // FILL_BLANK
    if (type === 'FILL_BLANK') {
      const parts = q.text.split('___')
      const blankCount = parts.length - 1
      return (
        <div className="space-y-4">
          <div className="text-white/80 text-lg leading-relaxed">
            {parts.map((part: string, i: number) => (
              <span key={i}>
                {part}
                {i < blankCount && (
                  <input
                    value={blankAnswers[i] || ''}
                    onChange={e => { const arr = [...blankAnswers]; arr[i] = e.target.value; setBlankAnswers(arr) }}
                    className="inline-block w-32 mx-1 px-3 py-1 border-b-2 border-[#4ECDC4] bg-white/20 text-white font-medium text-center focus:outline-none"
                    placeholder={`(${i + 1})`}
                  />
                )}
              </span>
            ))}
          </div>
          <button onClick={submitBlankAnswer} disabled={blankAnswers.filter(b => b?.trim()).length === 0} className="w-full py-3 bg-gradient-to-r from-[#4ECDC4] to-[#3BA89F] text-white rounded-xl font-bold shadow-md disabled:opacity-40">
            Confirmar respuesta
          </button>
        </div>
      )
    }

    // ORDERING
    if (type === 'ORDERING') {
      return (
        <div className="space-y-3">
          {orderAnswers.map((item: string, i: number) => (
            <div key={i} className="flex items-center gap-2 p-3 bg-white/95 rounded-xl border-2 border-slate-100 shadow-sm">
              <span className="w-7 h-7 rounded-lg bg-[#FFE66D] text-amber-800 flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</span>
              <span className="flex-1 text-slate-800 font-medium">{item}</span>
              <div className="flex flex-col gap-0.5">
                <button onClick={() => i > 0 && handleOrderMove(i, i - 1)} disabled={i === 0} className="p-1 rounded hover:bg-slate-100 disabled:opacity-20 text-slate-400">▲</button>
                <button onClick={() => i < orderAnswers.length - 1 && handleOrderMove(i, i + 1)} disabled={i === orderAnswers.length - 1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-20 text-slate-400">▼</button>
              </div>
            </div>
          ))}
          <button onClick={submitOrderAnswer} className="w-full py-3 bg-gradient-to-r from-[#4ECDC4] to-[#3BA89F] text-white rounded-xl font-bold shadow-md">
            Confirmar orden
          </button>
        </div>
      )
    }

    // MATCHING
    if (type === 'MATCHING') {
      const leftItems = options?.left || []
      const rightItems = options?.right || []
      return (
        <div className="space-y-3">
          {leftItems.map((left: string, i: number) => (
            <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-white/10 rounded-xl border border-white/10">
              <div className="flex-1 p-2 bg-blue-500/20 border border-blue-500/30 rounded-lg text-blue-300 font-medium">{left}</div>
              <span className="text-white/30 text-center hidden sm:block">→</span>
              <select
                value={matchAnswers[left] || ''}
                onChange={e => handleMatchAnswer(left, e.target.value)}
                className="flex-1 p-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="" className="bg-slate-800">Seleccionar...</option>
                {rightItems.map((right: string, j: number) => (
                  <option key={j} value={right} className="bg-slate-800">{right}</option>
                ))}
              </select>
            </div>
          ))}
          <button onClick={submitMatchAnswer} disabled={Object.keys(matchAnswers).length < leftItems.length} className="w-full py-3 bg-green-500/30 text-green-400 rounded-xl font-bold hover:bg-green-500/40 disabled:opacity-30">
            Confirmar emparejamiento
          </button>
        </div>
      )
    }

    return <p className="text-white/50 text-center">Tipo de pregunta no soportado</p>
  }
}
