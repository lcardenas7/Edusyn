import { useState, useEffect, useRef, useCallback } from 'react'
import { liveSessionApi } from '../lib/api'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import {
  Zap, Play, SkipForward, Trophy, X, CheckCircle2, XCircle,
  Clock, Users, Loader2, BarChart3, Image as ImageIcon, Volume2, VolumeX,
  ChevronRight, Award, Timer, Radio, Sparkles
} from 'lucide-react'

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
}

interface RankEntry {
  rank: number
  name: string
  totalPoints: number
  correctAnswers?: number
  studentEnrollmentId?: string
  teamId?: string
  color?: string
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

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function LiveQuiz({ classroomId, isTeacher, onClose, activityId, activityTitle, sessionId: initialSessionId }: LiveQuizProps) {
  const [sessionId, setSessionId] = useState(initialSessionId || '')
  const [session, setSession] = useState<any>(null)
  const [phase, setPhase] = useState<'setup' | 'loading' | 'lobby' | 'question' | 'answer_reveal' | 'ranking' | 'finished'>('setup')
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
  const [ranking, setRanking] = useState<RankEntry[]>([])

  // Team mode
  const [mode, setMode] = useState<'INDIVIDUAL' | 'TEAM'>('INDIVIDUAL')
  const [teams, setTeams] = useState<any[]>([])
  const [myTeamId, setMyTeamId] = useState<string | null>(null)
  const [teamSetupNames, setTeamSetupNames] = useState(['Equipo 1', 'Equipo 2'])
  const [joiningTeam, setJoiningTeam] = useState(false)

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

  // SSE
  const eventSourceRef = useRef<EventSource | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ═══════════════════════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (isTeacher && activityId) {
      // Show setup phase for teacher to pick mode
      setPhase('setup')
    } else if (initialSessionId) {
      setPhase('loading')
      setSessionId(initialSessionId)
      loadSession(initialSessionId)
    } else {
      setPhase('loading')
      checkActiveSession()
    }
    return () => {
      if (eventSourceRef.current) eventSourceRef.current.close()
      if (timerRef.current) clearInterval(timerRef.current)
      stopMusic()
    }
  }, [])

  const createSession = async () => {
    setPhase('loading')
    try {
      // En modo TEAM, los estudiantes crean sus propios equipos dinámicamente (estilo Kahoot)
      const { data } = await liveSessionApi.create({ 
        classroomId, 
        activityId: activityId!, 
        mode, 
        config: { 
          timeLimitOverride: globalTimeLimit, 
          autoClose: autoCloseOnTimeout, 
          teamAssignment: 'STUDENT_CHOICE' // Siempre estudiantes eligen/crean equipos
        } 
      })
      autoCloseRef.current = autoCloseOnTimeout
      setSessionId(data.id)
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

  const loadSession = async (sid: string) => {
    try {
      const { data } = await liveSessionApi.get(sid)
      setSession(data)
      setMode(data.mode || 'INDIVIDUAL')
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
    const url = `${baseUrl}?token=${token}`

    const es = new EventSource(url)
    eventSourceRef.current = es

    es.addEventListener('SESSION_STARTED', () => {
      setPhase('lobby')
    })

    es.addEventListener('QUESTION', (e: any) => {
      const data = JSON.parse(e.data)
      setCurrentQuestion(data)
      setQuestionIndex(data.index)
      setTotalQuestions(data.total)
      setTimeLimit(data.timeLimit || 15)
      setTimeLeft(data.timeLimit || 15)
      setIsBonus(data.isBonus || false)
      setMultiplier(data.multiplier || 1)
      setSelectedAnswer('')
      setMultiAnswers([])
      setMatchAnswers({})
      setBlankAnswers([])
      setOrderAnswers(data.options && data.type === 'ORDERING' ? [...(data.options as string[])] : [])
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
      setCorrectAnswer(data.correctAnswer)
      setExplanation(data.explanation)
      stopTimer()
      stopMusic()
      // Reveal buffered result for students (with sounds + confetti)
      revealPendingResult()
      setPhase('answer_reveal')
    })

    es.addEventListener('RANKING', (e: any) => {
      const data = JSON.parse(e.data)
      setRanking(data)
      setPhase('ranking')
    })

    es.addEventListener('SESSION_FINISHED', (e: any) => {
      const data = JSON.parse(e.data)
      setRanking(data)
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

    es.addEventListener('PING', () => { /* keep alive */ })

    es.onerror = () => {
      // Auto-reconnect is built into EventSource
    }
  }, [])

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
          // Auto-close question when timer expires (teacher only)
          if (isTeacher && autoCloseRef.current) {
            handleCloseQuestion()
          }
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
    if (!result) return
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
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 overflow-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/20">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-yellow-400" />
          <span className="text-white font-bold text-lg">Live Quiz</span>
          {session?.activity?.title && (
            <span className="text-white/60 text-sm hidden sm:block">— {session.activity.title}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleMusic} className="p-2 rounded-lg hover:bg-white/10 transition-colors" title={musicOn ? 'Silenciar música' : 'Activar música'}>
            {musicOn ? <Volume2 className="w-5 h-5 text-yellow-400" /> : <VolumeX className="w-5 h-5 text-white/40" />}
          </button>
          <button onClick={() => { stopMusic(); onClose() }} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-2 p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-sm text-center">{error}</div>
      )}

      {/* SETUP (teacher picks mode + team names) */}
      {phase === 'setup' && isTeacher && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 space-y-8">
          <div className="text-center space-y-3">
            <Zap className="w-16 h-16 text-yellow-400 mx-auto" />
            <h1 className="text-3xl sm:text-4xl font-black text-white">
              {activityTitle || 'Live Quiz'}
            </h1>
            <p className="text-indigo-300">Configura la sesión antes de iniciar</p>
          </div>

          <div className="w-full max-w-md space-y-6">
            {/* Mode selector */}
            <div className="space-y-2">
              <p className="text-white/80 font-semibold text-sm text-center">Modalidad</p>
              <div className="flex gap-3">
                <button onClick={() => setMode('INDIVIDUAL')} className={`flex-1 p-4 rounded-2xl border-2 transition-all text-center ${mode === 'INDIVIDUAL' ? 'border-indigo-400 bg-indigo-500/20' : 'border-white/10 bg-white/5 hover:border-white/30'}`}>
                  <Users className="w-8 h-8 mx-auto mb-2 text-indigo-400" />
                  <p className="text-white font-semibold">Individual</p>
                  <p className="text-white/40 text-xs mt-1">Cada estudiante compite solo</p>
                </button>
                <button onClick={() => setMode('TEAM')} className={`flex-1 p-4 rounded-2xl border-2 transition-all text-center ${mode === 'TEAM' ? 'border-purple-400 bg-purple-500/20' : 'border-white/10 bg-white/5 hover:border-white/30'}`}>
                  <Award className="w-8 h-8 mx-auto mb-2 text-purple-400" />
                  <p className="text-white font-semibold">Equipos</p>
                  <p className="text-white/40 text-xs mt-1">Los estudiantes eligen un equipo</p>
                </button>
              </div>
            </div>

            {/* Team mode info */}
            {mode === 'TEAM' && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/30 flex items-center justify-center">
                    <Users className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Modo Equipos</p>
                    <p className="text-purple-300 text-xs">Los estudiantes crearán sus propios equipos</p>
                  </div>
                </div>
                <div className="bg-white/5 rounded-xl p-3 space-y-2">
                  <p className="text-white/80 text-sm font-medium">¿Cómo funciona?</p>
                  <ul className="text-white/60 text-xs space-y-1">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400">1.</span>
                      <span>Cada estudiante puede crear un equipo con un nombre creativo</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400">2.</span>
                      <span>Pueden agregar compañeros que no tengan celular a su equipo</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-400">3.</span>
                      <span>O unirse a un equipo existente creado por otro compañero</span>
                    </li>
                  </ul>
                </div>
                <div className="flex items-center gap-2 text-amber-400 text-xs">
                  <Timer className="w-4 h-4" />
                  <span>Máximo 12 equipos • Sin límite de integrantes</span>
                </div>
              </div>
            )}

            {/* Time config */}
            <div className="bg-white/5 rounded-2xl p-4 space-y-3">
              <p className="text-white/80 font-semibold text-sm">Tiempo por pregunta</p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={5}
                  max={120}
                  step={5}
                  value={globalTimeLimit}
                  onChange={e => setGlobalTimeLimit(Number(e.target.value))}
                  className="flex-1 accent-indigo-500"
                />
                <span className="text-white font-bold text-lg w-16 text-center">{globalTimeLimit}s</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCloseOnTimeout}
                  onChange={e => setAutoCloseOnTimeout(e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-500"
                />
                <span className="text-white/60 text-sm">Cerrar pregunta automáticamente al agotar el tiempo</span>
              </label>
            </div>

            {/* Create session button */}
            <button
              onClick={createSession}
              className="w-full px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl text-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg shadow-green-500/30 flex items-center justify-center gap-3"
            >
              <Play className="w-6 h-6" /> Crear sesión
            </button>
          </div>
        </div>
      )}

      {/* LOADING */}
      {phase === 'loading' && (
        <div className="flex items-center justify-center h-[80vh]">
          <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
        </div>
      )}

      {/* LOBBY */}
      {phase === 'lobby' && (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 space-y-8">
          <div className="text-center space-y-3">
            <Radio className="w-16 h-16 text-indigo-400 mx-auto animate-pulse" />
            <h1 className="text-3xl sm:text-5xl font-black text-white">
              {activityTitle || session?.activity?.title || 'Live Quiz'}
            </h1>
            <p className="text-indigo-300 text-lg">
              {totalQuestions} preguntas
              {mode === 'TEAM' && <span className="ml-2 px-2 py-0.5 bg-purple-500/30 text-purple-300 rounded-full text-xs font-bold">EQUIPOS</span>}
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

              <p className="text-white/60 text-center text-sm">
                {(session?.config as any)?.teamAssignment === 'TEACHER_ASSIGNED' 
                  ? 'Asigna los estudiantes a equipos antes de iniciar'
                  : 'Los estudiantes pueden unirse desde su aula virtual'}
              </p>
              <button
                onClick={handleStart}
                className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl text-xl font-bold hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg shadow-green-500/30 flex items-center gap-3 mx-auto"
              >
                <Play className="w-6 h-6" /> Iniciar primera pregunta
              </button>
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
                <div className="space-y-3">
                  <div className="w-20 h-20 rounded-full bg-indigo-500/30 flex items-center justify-center mx-auto">
                    <Users className="w-10 h-10 text-indigo-400" />
                  </div>
                  <p className="text-white/60 text-lg">Esperando a que el profesor inicie...</p>
                </div>
              )}
            </div>
          )}
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
          {/* Timer bar */}
          <motion.div 
            className="relative h-3 bg-white/10 rounded-full overflow-hidden"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div 
              className={`absolute inset-y-0 left-0 ${timerColor} rounded-full`} 
              initial={{ width: '100%' }}
              animate={{ width: `${timerPercent}%` }}
              transition={{ duration: 0.5, ease: "linear" }}
            />
          </motion.div>

          {/* Question header */}
          <motion.div 
            className="flex items-center justify-between"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <span className="text-indigo-300 font-semibold">Pregunta {questionIndex + 1} / {totalQuestions}</span>
            <div className="flex items-center gap-2">
              {isBonus && (
                <motion.span 
                  className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs font-bold"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                >
                  <Sparkles className="w-3 h-3 inline mr-1" />BONUS x{multiplier}
                </motion.span>
              )}
              <motion.span 
                className={`text-3xl font-black ${timeLeft <= 5 ? 'text-red-400' : 'text-white'}`}
                animate={timeLeft <= 5 ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.5 }}
              >
                {timeLeft}s
              </motion.span>
            </div>
          </motion.div>

          {/* Context (reading passage / shared context) */}
          {currentQuestion.context && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl backdrop-blur-sm overflow-hidden">
              <button
                onClick={() => setContextExpanded(prev => !prev)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-amber-500/10 transition-colors"
              >
                <span className="text-amber-300 font-semibold text-sm uppercase tracking-wide flex items-center gap-2">
                  📖 {currentQuestion.context.title || 'Contexto / Lectura'}
                </span>
                <ChevronRight className={`w-4 h-4 text-amber-300 transition-transform duration-200 ${contextExpanded ? 'rotate-90' : ''}`} />
              </button>
              {contextExpanded && (
                <div className="px-5 pb-4 space-y-3">
                  {currentQuestion.context.text && (
                    <p className="text-white/90 text-sm leading-relaxed whitespace-pre-line">{currentQuestion.context.text}</p>
                  )}
                  {currentQuestion.context.imageUrl && (
                    <img src={currentQuestion.context.imageUrl} alt="" className="max-h-48 rounded-xl mx-auto object-contain" />
                  )}
                </div>
              )}
              {!contextExpanded && currentQuestion.context.text && (
                <p className="px-5 pb-3 text-white/50 text-xs truncate">
                  {currentQuestion.context.text.substring(0, 120)}...
                  <span className="text-amber-400 ml-1 font-medium">Toca para leer</span>
                </p>
              )}
            </div>
          )}

          {/* Question text + image */}
          <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm">
            <p className="text-xl sm:text-2xl font-bold text-white leading-relaxed">{currentQuestion.text}</p>
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
              <div className="flex items-center justify-center gap-6">
                <motion.div 
                  className="text-center"
                  animate={{ scale: totalAnswered > 0 ? [1, 1.1, 1] : 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-4xl font-black text-white">{totalAnswered}</p>
                  <p className="text-white/50 text-sm">respuestas</p>
                </motion.div>
              </div>
              <div className="flex justify-center gap-3 flex-wrap">
                <motion.button 
                  onClick={handleCloseQuestion} 
                  className="px-5 py-3 bg-amber-500/20 text-amber-400 rounded-xl font-semibold hover:bg-amber-500/30 flex items-center gap-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Clock className="w-4 h-4" /> Cerrar pregunta
                </motion.button>
                <motion.button 
                  onClick={handleShowRanking} 
                  className="px-5 py-3 bg-purple-500/20 text-purple-400 rounded-xl font-semibold hover:bg-purple-500/30 flex items-center gap-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Trophy className="w-4 h-4" /> Ver ranking
                </motion.button>
                <motion.button 
                  onClick={handleNextQuestion} 
                  className="px-5 py-3 bg-indigo-500/20 text-indigo-400 rounded-xl font-semibold hover:bg-indigo-500/30 flex items-center gap-2"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <SkipForward className="w-4 h-4" /> Siguiente
                </motion.button>
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
                  className={`text-center p-6 rounded-2xl ${answerResult.isCorrect ? 'bg-green-500/20 border-2 border-green-500/40' : 'bg-red-500/20 border-2 border-red-500/40'}`}
                >
                  {answerResult.isCorrect ? (
                    <>
                      <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", duration: 0.6 }}
                      >
                        <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-3" />
                      </motion.div>
                      <motion.p 
                        className="text-green-400 text-2xl font-bold"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                      >
                        ¡Correcto!
                      </motion.p>
                      <motion.p 
                        className="text-green-300 text-xl font-bold mt-2"
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
                          className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-bold"
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
                        <XCircle className="w-16 h-16 text-red-400 mx-auto mb-3" />
                      </motion.div>
                      <motion.p 
                        className="text-red-400 text-2xl font-bold"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                      >
                        Incorrecto
                      </motion.p>
                      <p className="text-red-300 text-sm mt-1">0 pts</p>
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
                  className="text-center p-8 rounded-2xl bg-indigo-500/10 border-2 border-indigo-500/30"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    className="inline-block"
                  >
                    <Loader2 className="w-14 h-14 text-indigo-400 mx-auto mb-4" />
                  </motion.div>
                  <motion.p 
                    className="text-indigo-300 text-xl font-bold"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                  >
                    ¡Respuesta enviada!
                  </motion.p>
                  <p className="text-indigo-400/60 text-sm mt-2">Esperando a que se cierre la pregunta...</p>
                </motion.div>
              ) : timeLeft <= 0 && !answered ? (
                <motion.div 
                  key="timeout"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center p-6 rounded-2xl bg-white/5"
                >
                  <Clock className="w-14 h-14 text-white/30 mx-auto mb-3" />
                  <p className="text-white/50 text-xl font-bold">Tiempo agotado</p>
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
              className={`rounded-3xl p-8 text-center border-2 backdrop-blur-sm ${
                answerResult.isCorrect 
                  ? 'bg-gradient-to-br from-green-500/20 to-emerald-500/10 border-green-500/40' 
                  : 'bg-gradient-to-br from-red-500/20 to-rose-500/10 border-red-500/40'
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
              >
                {answerResult.isCorrect 
                  ? <CheckCircle2 className="w-20 h-20 text-green-400 mx-auto mb-4 drop-shadow-lg" />
                  : <XCircle className="w-20 h-20 text-red-400 mx-auto mb-4 drop-shadow-lg" />
                }
              </motion.div>
              <motion.h2 
                className={`text-3xl font-black mb-2 ${answerResult.isCorrect ? 'text-green-400' : 'text-red-400'}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                {answerResult.isCorrect ? '¡Correcto!' : '¡Incorrecto!'}
              </motion.h2>
              <motion.p
                className={`text-2xl font-bold ${answerResult.isCorrect ? 'text-green-300' : 'text-red-300/60'}`}
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
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-bold border border-yellow-500/30"
                >
                  🔥 ¡Racha de {streak}!
                </motion.div>
              )}
              {!answerResult.isCorrect && selectedAnswer && (
                <motion.p
                  className="text-red-300/50 text-sm mt-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  Tu respuesta: <span className="font-semibold text-red-300/70">{selectedAnswer}</span>
                </motion.p>
              )}
            </motion.div>
          )}

          {/* ── Student: no answer submitted ── */}
          {!isTeacher && !answerResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-3xl p-6 text-center bg-white/5 border-2 border-white/10"
            >
              <Clock className="w-14 h-14 text-white/30 mx-auto mb-3" />
              <p className="text-white/50 text-xl font-bold">No respondiste a tiempo</p>
            </motion.div>
          )}

          {/* ── Correct answer card (visible to all) ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: isTeacher ? 0 : 0.5 }}
            className="bg-white/10 rounded-2xl p-6 text-center space-y-3 backdrop-blur-sm border border-white/10"
          >
            <p className="text-white/50 text-sm font-semibold uppercase tracking-wider">La respuesta correcta es</p>
            {correctAnswer && (
              <motion.p
                className="text-green-400 text-2xl font-black"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: isTeacher ? 0.1 : 0.6, type: "spring" }}
              >
                {correctAnswer}
              </motion.p>
            )}
            {explanation && (
              <motion.p 
                className="text-white/50 text-sm mt-2 italic"
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
              className="flex justify-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <button onClick={handleShowRanking} className="px-5 py-3 bg-purple-500/20 text-purple-400 rounded-xl font-semibold hover:bg-purple-500/30 flex items-center gap-2">
                <Trophy className="w-4 h-4" /> Ver ranking
              </button>
              <button onClick={handleNextQuestion} className="px-5 py-3 bg-green-500/20 text-green-400 rounded-xl font-semibold hover:bg-green-500/30 flex items-center gap-2">
                <SkipForward className="w-4 h-4" /> Siguiente pregunta
              </button>
            </motion.div>
          )}
        </div>
      )}

      {/* RANKING */}
      {(phase === 'ranking' || phase === 'finished') && (
        <motion.div 
          className="max-w-2xl mx-auto px-4 py-6 space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div 
            className="text-center space-y-2"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", duration: 0.6 }}
          >
            <motion.div
              animate={phase === 'finished' ? { 
                rotate: [0, -10, 10, -10, 10, 0],
                scale: [1, 1.2, 1]
              } : {}}
              transition={{ duration: 0.8 }}
            >
              <Trophy className="w-16 h-16 text-yellow-400 mx-auto" />
            </motion.div>
            <h2 className="text-3xl font-black text-white">
              {phase === 'finished' ? '🎉 Resultados finales 🎉' : 'Ranking'}
            </h2>
          </motion.div>

          <motion.div 
            className="space-y-3"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.1 } },
              hidden: {}
            }}
          >
            {ranking.map((entry, i) => {
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null
              const bgColor = i === 0 ? 'bg-yellow-500/20 border-yellow-500/40' : i === 1 ? 'bg-slate-400/20 border-slate-400/40' : i === 2 ? 'bg-amber-700/20 border-amber-700/40' : 'bg-white/5 border-white/10'
              const color = entry.color || getAvatarColor(entry.name)
              return (
                <motion.div 
                  key={i} 
                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 ${bgColor} transition-all`}
                  variants={{
                    hidden: { opacity: 0, x: -50 },
                    visible: { opacity: 1, x: 0 }
                  }}
                  transition={{ type: "spring", duration: 0.5 }}
                  whileHover={{ scale: 1.02, x: 5 }}
                >
                  <motion.div 
                    className="text-2xl font-black text-white w-8 text-center"
                    animate={i === 0 && phase === 'finished' ? { scale: [1, 1.3, 1] } : {}}
                    transition={{ repeat: phase === 'finished' ? 3 : 0, duration: 0.5 }}
                  >
                    {medal || entry.rank}
                  </motion.div>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ backgroundColor: color }}>
                    {entry.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold truncate">{entry.name}</p>
                    {entry.correctAnswers !== undefined && (
                      <p className="text-white/40 text-xs">{entry.correctAnswers} correctas</p>
                    )}
                  </div>
                  <div className="text-right">
                    <motion.p 
                      className="text-2xl font-black text-white"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                    >
                      {entry.totalPoints.toLocaleString()}
                    </motion.p>
                    <p className="text-white/40 text-xs">pts</p>
                  </div>
                </motion.div>
              )
            })}
            {ranking.length === 0 && (
              <p className="text-white/40 text-center py-8">Sin respuestas aún</p>
            )}
          </motion.div>

          {isTeacher && phase === 'ranking' && (
            <div className="flex justify-center gap-3">
              <button onClick={handleNextQuestion} className="px-5 py-3 bg-green-500/20 text-green-400 rounded-xl font-semibold hover:bg-green-500/30 flex items-center gap-2">
                <SkipForward className="w-4 h-4" /> Siguiente pregunta
              </button>
              <button onClick={handleFinish} className="px-5 py-3 bg-red-500/20 text-red-400 rounded-xl font-semibold hover:bg-red-500/30 flex items-center gap-2">
                <X className="w-4 h-4" /> Finalizar
              </button>
            </div>
          )}

          {phase === 'finished' && (
            <motion.div 
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <motion.button 
                onClick={onClose} 
                className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl text-lg font-bold hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg"
                whileHover={{ scale: 1.05 }}
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
      const optColors = ['from-blue-500 to-blue-600', 'from-red-500 to-red-600', 'from-green-500 to-green-600', 'from-yellow-500 to-yellow-600', 'from-purple-500 to-purple-600', 'from-pink-500 to-pink-600']
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {opts.map((opt: string, i: number) => (
            <button
              key={i}
              onClick={() => handleSelectOption(opt)}
              disabled={answered}
              className={`p-4 sm:p-5 rounded-2xl text-white font-bold text-base sm:text-lg text-center transition-all bg-gradient-to-br ${optColors[i % optColors.length]} hover:scale-[1.02] active:scale-95 disabled:opacity-50 shadow-lg`}
            >
              <span className="mr-2 opacity-60">{String.fromCharCode(65 + i)}.</span>{opt}
            </button>
          ))}
        </div>
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
                className={`w-full p-4 rounded-2xl text-left font-semibold transition-all ${sel ? 'bg-indigo-500/40 border-2 border-indigo-400 text-white' : 'bg-white/10 border-2 border-white/10 text-white/80 hover:border-white/30'}`}
              >
                <span className="mr-2 opacity-60">{String.fromCharCode(65 + i)}.</span>{opt}
              </button>
            )
          })}
          <button onClick={submitMultiAnswer} disabled={multiAnswers.length === 0} className="w-full py-3 bg-green-500/30 text-green-400 rounded-xl font-bold hover:bg-green-500/40 disabled:opacity-30">
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
            className="flex-1 bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 text-white text-lg placeholder:text-white/30 focus:outline-none focus:border-indigo-500"
          />
          <button onClick={() => submitAnswer(selectedAnswer)} disabled={!selectedAnswer.trim()} className="px-6 py-3 bg-green-500/30 text-green-400 rounded-xl font-bold hover:bg-green-500/40 disabled:opacity-30">
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
                    className="inline-block w-32 mx-1 px-3 py-1 border-b-2 border-indigo-400 bg-indigo-900/50 text-indigo-200 font-medium text-center focus:outline-none"
                    placeholder={`(${i + 1})`}
                  />
                )}
              </span>
            ))}
          </div>
          <button onClick={submitBlankAnswer} disabled={blankAnswers.filter(b => b?.trim()).length === 0} className="w-full py-3 bg-green-500/30 text-green-400 rounded-xl font-bold hover:bg-green-500/40 disabled:opacity-30">
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
            <div key={i} className="flex items-center gap-2 p-3 bg-white/10 rounded-xl border border-white/10">
              <span className="w-7 h-7 rounded-lg bg-amber-500/30 text-amber-400 flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</span>
              <span className="flex-1 text-white">{item}</span>
              <div className="flex flex-col gap-0.5">
                <button onClick={() => i > 0 && handleOrderMove(i, i - 1)} disabled={i === 0} className="p-1 rounded hover:bg-white/10 disabled:opacity-20 text-white/60">▲</button>
                <button onClick={() => i < orderAnswers.length - 1 && handleOrderMove(i, i + 1)} disabled={i === orderAnswers.length - 1} className="p-1 rounded hover:bg-white/10 disabled:opacity-20 text-white/60">▼</button>
              </div>
            </div>
          ))}
          <button onClick={submitOrderAnswer} className="w-full py-3 bg-green-500/30 text-green-400 rounded-xl font-bold hover:bg-green-500/40">
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
