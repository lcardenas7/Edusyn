import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { playPanelApi } from '../../lib/playApi'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  GripVertical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileQuestion,
  Hash,
  Type,
  Play,
  Copy,
  Users,
  Radio,
  SkipForward,
  Square,
  Trophy,
} from 'lucide-react'

interface Option {
  id: string
  text: string
  isCorrect: boolean
}

interface Question {
  id: string
  type: string
  text: string
  options: Option[] | null
  correctAnswer: string | null
  points: number
  explanation: string | null
  sortOrder: number
}

const QUESTION_TYPES = [
  { value: 'MULTIPLE_CHOICE', label: 'Opción múltiple', icon: CheckCircle2 },
  { value: 'TRUE_FALSE', label: 'Verdadero/Falso', icon: XCircle },
  { value: 'SHORT_ANSWER', label: 'Respuesta corta', icon: Type },
]

function generateId() {
  return Math.random().toString(36).substring(2, 10)
}

function defaultOptions(): Option[] {
  return [
    { id: generateId(), text: '', isCorrect: true },
    { id: generateId(), text: '', isCorrect: false },
    { id: generateId(), text: '', isCorrect: false },
    { id: generateId(), text: '', isCorrect: false },
  ]
}

export default function PlayQuizEditor() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editingIdx, setEditingIdx] = useState<number | null>(null)

  // Live session state
  const [liveSession, setLiveSession] = useState<any>(null)
  const [launchingLive, setLaunchingLive] = useState(false)
  const [pollingInterval, setPollingInterval] = useState<any>(null)

  // New question form
  const [newType, setNewType] = useState('MULTIPLE_CHOICE')
  const [newText, setNewText] = useState('')
  const [newOptions, setNewOptions] = useState<Option[]>(defaultOptions())
  const [newCorrectAnswer, setNewCorrectAnswer] = useState('')
  const [newPoints, setNewPoints] = useState(10)
  const [newExplanation, setNewExplanation] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    if (!quizId) return
    playPanelApi.listQuestions(quizId)
      .then(res => setQuestions(res.data || []))
      .catch(() => setError('Error al cargar preguntas'))
      .finally(() => setLoading(false))
  }, [quizId])

  const resetForm = () => {
    setNewType('MULTIPLE_CHOICE')
    setNewText('')
    setNewOptions(defaultOptions())
    setNewCorrectAnswer('')
    setNewPoints(10)
    setNewExplanation('')
    setError('')
  }

  const handleAddQuestion = async () => {
    if (!newText.trim()) {
      setError('El texto de la pregunta es obligatorio')
      return
    }
    if (!quizId) return

    let options: any = undefined
    let correctAnswer: string | undefined = undefined

    if (newType === 'MULTIPLE_CHOICE') {
      const filled = newOptions.filter(o => o.text.trim())
      if (filled.length < 2) {
        setError('Necesitas al menos 2 opciones')
        return
      }
      if (!filled.some(o => o.isCorrect)) {
        setError('Marca al menos una opción correcta')
        return
      }
      options = filled.map(o => ({ id: o.id, text: o.text.trim(), isCorrect: o.isCorrect }))
      correctAnswer = filled.find(o => o.isCorrect)?.id
    } else if (newType === 'TRUE_FALSE') {
      options = [
        { id: 'true', text: 'Verdadero', isCorrect: newCorrectAnswer === 'true' },
        { id: 'false', text: 'Falso', isCorrect: newCorrectAnswer === 'false' },
      ]
      correctAnswer = newCorrectAnswer || 'true'
    } else {
      correctAnswer = newCorrectAnswer.trim() || undefined
    }

    setSaving(true)
    setError('')
    try {
      const res = await playPanelApi.addQuestion(quizId, {
        type: newType,
        text: newText.trim(),
        options,
        correctAnswer,
        points: newPoints,
        explanation: newExplanation.trim() || undefined,
      })
      setQuestions(prev => [...prev, res.data])
      resetForm()
      setShowAddForm(false)
      setSuccess('Pregunta agregada')
      setTimeout(() => setSuccess(''), 2000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al agregar pregunta')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('¿Eliminar esta pregunta?')) return
    try {
      await playPanelApi.deleteQuestion(questionId)
      setQuestions(prev => prev.filter(q => q.id !== questionId))
    } catch {
      setError('Error al eliminar pregunta')
    }
  }

  const openAddForm = () => {
    resetForm()
    setShowAddForm(true)
  }

  // ── Live Quiz Session ──────────────────────────────────
  const handleLaunchLive = async () => {
    if (!quizId) return
    if (questions.length === 0) {
      setError('Agrega al menos una pregunta antes de jugar en vivo')
      return
    }
    setLaunchingLive(true)
    setError('')
    try {
      const res = await playPanelApi.createLiveQuiz(quizId)
      setLiveSession(res.data)
      // Start polling for guest count
      const interval = setInterval(async () => {
        try {
          const status = await playPanelApi.getLiveQuizStatus(res.data.id)
          setLiveSession(status.data)
        } catch {}
      }, 3000)
      setPollingInterval(interval)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al crear sesión en vivo')
    } finally {
      setLaunchingLive(false)
    }
  }

  const handleStartGame = async () => {
    if (!liveSession) return
    try {
      await playPanelApi.startLiveQuiz(liveSession.id)
      const status = await playPanelApi.getLiveQuizStatus(liveSession.id)
      setLiveSession(status.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al iniciar')
    }
  }

  const handleNextQuestion = async () => {
    if (!liveSession) return
    try {
      const res = await playPanelApi.nextQuestionLive(liveSession.id)
      if (res.data.finished) {
        const status = await playPanelApi.getLiveQuizStatus(liveSession.id)
        setLiveSession(status.data)
      } else {
        setLiveSession((prev: any) => ({
          ...prev,
          currentQuestionIdx: res.data.currentQuestionIdx,
          status: 'ACTIVE',
        }))
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error')
    }
  }

  const handleFinishGame = async () => {
    if (!liveSession) return
    try {
      await playPanelApi.finishLiveQuiz(liveSession.id)
      if (pollingInterval) clearInterval(pollingInterval)
      const status = await playPanelApi.getLiveQuizStatus(liveSession.id)
      setLiveSession(status.data)
    } catch {}
  }

  const handleCloseLive = () => {
    if (pollingInterval) clearInterval(pollingInterval)
    setLiveSession(null)
  }

  const copyJoinCode = () => {
    if (liveSession?.joinCode) {
      navigator.clipboard.writeText(liveSession.joinCode)
      setSuccess('Código copiado!')
      setTimeout(() => setSuccess(''), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate('/play/quizzes')}
          className="p-2 rounded-lg hover:bg-gray-100 transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <FileQuestion className="w-5 h-5 text-violet-500" />
            Editor de Preguntas
          </h1>
          <p className="text-sm text-gray-500">{questions.length} pregunta(s)</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleLaunchLive}
            disabled={launchingLive || questions.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition text-sm disabled:opacity-50"
          >
            {launchingLive ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Jugar en Vivo
          </button>
          <button
            onClick={openAddForm}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium transition text-sm"
          >
            <Plus className="w-4 h-4" /> Agregar Pregunta
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-700">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-sm text-green-700">{success}</span>
        </div>
      )}

      {/* Live Quiz Session Panel */}
      {liveSession && (
        <div className="mb-6 bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl p-6 text-white shadow-lg">
          {/* WAITING / LOBBY */}
          {liveSession.status === 'WAITING' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Radio className="w-5 h-5 animate-pulse" />
                  <span className="font-bold text-lg">Esperando jugadores...</span>
                </div>
                <button onClick={handleCloseLive} className="text-white/60 hover:text-white text-sm">Cancelar</button>
              </div>

              <div className="text-center mb-6">
                <p className="text-green-100 text-sm mb-2">Comparte este código con tus participantes</p>
                <div className="flex items-center justify-center gap-3">
                  <div className="bg-white text-green-800 text-4xl font-mono font-bold px-6 py-3 rounded-xl tracking-[0.3em] select-all">
                    {liveSession.joinCode}
                  </div>
                  <button onClick={copyJoinCode} className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition" title="Copiar código">
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-green-200 text-xs mt-2">Los participantes entran en <strong>edusyn.co/join</strong></p>
              </div>

              <div className="flex items-center justify-between bg-white/10 rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  <span className="font-medium">{liveSession.guestsCount || 0} conectados</span>
                </div>
                <button
                  onClick={handleStartGame}
                  disabled={!liveSession.guestsCount}
                  className="px-6 py-2.5 bg-white text-green-700 rounded-lg font-bold hover:bg-green-50 transition disabled:opacity-50 flex items-center gap-2"
                >
                  <Play className="w-4 h-4" /> Iniciar Juego
                </button>
              </div>

              {liveSession.guests && liveSession.guests.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {liveSession.guests.map((g: any) => (
                    <span key={g.id} className="bg-white/20 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                      {g.avatarEmoji || '👤'} {g.nickname}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ACTIVE */}
          {liveSession.status === 'ACTIVE' && (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Radio className="w-5 h-5 text-red-300 animate-pulse" />
                  <span className="font-bold text-lg">En vivo</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{liveSession.guestsCount || 0} jugadores</span>
                </div>
                <span className="text-sm text-green-200">
                  Pregunta {(liveSession.currentQuestionIdx ?? 0) + 1} / {liveSession.totalQuestions}
                </span>
              </div>

              {/* Current question preview */}
              {liveSession.questions && liveSession.questions[liveSession.currentQuestionIdx] && (
                <div className="bg-white/10 rounded-xl p-4 mb-4">
                  <p className="font-medium text-sm">{liveSession.questions[liveSession.currentQuestionIdx].text}</p>
                </div>
              )}

              {/* Progress bar */}
              <div className="w-full bg-white/20 rounded-full h-2 mb-4">
                <div
                  className="bg-white rounded-full h-2 transition-all"
                  style={{ width: `${(((liveSession.currentQuestionIdx ?? 0) + 1) / liveSession.totalQuestions) * 100}%` }}
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleNextQuestion}
                  className="flex-1 py-2.5 bg-white text-green-700 rounded-lg font-bold hover:bg-green-50 transition flex items-center justify-center gap-2"
                >
                  <SkipForward className="w-4 h-4" />
                  {(liveSession.currentQuestionIdx ?? 0) + 1 >= liveSession.totalQuestions ? 'Finalizar' : 'Siguiente Pregunta'}
                </button>
                <button
                  onClick={handleFinishGame}
                  className="py-2.5 px-4 bg-red-500/80 text-white rounded-lg font-medium hover:bg-red-500 transition flex items-center gap-2"
                >
                  <Square className="w-4 h-4" /> Terminar
                </button>
              </div>
            </>
          )}

          {/* FINISHED */}
          {liveSession.status === 'FINISHED' && (
            <>
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-6 h-6 text-yellow-300" />
                <span className="font-bold text-lg">Juego Terminado</span>
              </div>

              {liveSession.guests && liveSession.guests.length > 0 ? (
                <div className="space-y-2 mb-4">
                  <p className="text-green-100 text-sm font-medium">Ranking Final</p>
                  {liveSession.guests.slice(0, 10).map((g: any, i: number) => (
                    <div key={g.id} className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
                      <span className="text-lg font-bold w-8 text-center">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                      </span>
                      <span className="text-lg">{g.avatarEmoji || '👤'}</span>
                      <span className="flex-1 font-medium">{g.nickname}</span>
                      <span className="font-bold">{g.score} pts</span>
                      <span className="text-xs text-green-200">{g.correctAnswers}/{g.totalAnswers} correctas</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-green-100 text-sm mb-4">No hubo participantes</p>
              )}

              <button
                onClick={handleCloseLive}
                className="w-full py-2.5 bg-white text-green-700 rounded-lg font-bold hover:bg-green-50 transition"
              >
                Cerrar
              </button>
            </>
          )}
        </div>
      )}

      {/* Questions List */}
      {questions.length === 0 && !showAddForm && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
            <FileQuestion className="w-7 h-7 text-violet-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Sin preguntas aún</h3>
          <p className="text-gray-500 max-w-sm mx-auto mb-6">
            Agrega preguntas de opción múltiple, verdadero/falso o respuesta corta.
          </p>
          <button
            onClick={openAddForm}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium transition"
          >
            <Plus className="w-4 h-4" /> Agregar Pregunta
          </button>
        </div>
      )}

      <div className="space-y-3">
        {questions.map((q, idx) => {
          const typeInfo = QUESTION_TYPES.find(t => t.value === q.type) || QUESTION_TYPES[0]
          const TypeIcon = typeInfo.icon
          return (
            <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4 group">
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-1 text-gray-400 pt-1">
                  <GripVertical className="w-4 h-4" />
                  <span className="text-xs font-medium w-5 text-center">{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                      <TypeIcon className="w-3 h-3" /> {typeInfo.label}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Hash className="w-3 h-3" /> {q.points} pts
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{q.text}</p>
                  {q.options && Array.isArray(q.options) && (
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {(q.options as Option[]).map((opt) => (
                        <div
                          key={opt.id}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border ${
                            opt.isCorrect
                              ? 'bg-green-50 border-green-300 text-green-800'
                              : 'bg-gray-50 border-gray-200 text-gray-600'
                          }`}
                        >
                          {opt.isCorrect && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                          {opt.text}
                        </div>
                      ))}
                    </div>
                  )}
                  {q.type === 'SHORT_ANSWER' && q.correctAnswer && (
                    <p className="mt-1.5 text-xs text-green-700 bg-green-50 inline-block px-2 py-1 rounded">
                      Respuesta: {q.correctAnswer}
                    </p>
                  )}
                  {q.explanation && (
                    <p className="mt-1.5 text-xs text-gray-500 italic">💡 {q.explanation}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteQuestion(q.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 opacity-0 group-hover:opacity-100 transition"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add Question Form */}
      {showAddForm && (
        <div className="mt-4 bg-white rounded-xl border-2 border-violet-300 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Nueva Pregunta</h3>

          {/* Type selector */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {QUESTION_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => {
                  setNewType(t.value)
                  if (t.value === 'TRUE_FALSE') setNewCorrectAnswer('true')
                  else setNewCorrectAnswer('')
                }}
                className={`p-2.5 rounded-lg border-2 text-center text-xs font-medium transition ${
                  newType === t.value
                    ? 'border-violet-500 bg-violet-50 text-violet-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <t.icon className={`w-4 h-4 mx-auto mb-1 ${newType === t.value ? 'text-violet-600' : 'text-gray-400'}`} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Question text */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Pregunta *</label>
            <textarea
              value={newText}
              onChange={e => setNewText(e.target.value)}
              placeholder="Escribe la pregunta aquí..."
              rows={2}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition resize-none text-sm"
              autoFocus
            />
          </div>

          {/* Multiple Choice Options */}
          {newType === 'MULTIPLE_CHOICE' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Opciones (marca la correcta)</label>
              <div className="space-y-2">
                {newOptions.map((opt, i) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setNewOptions(prev =>
                        prev.map((o, j) => ({ ...o, isCorrect: j === i }))
                      )}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                        opt.isCorrect
                          ? 'border-green-500 bg-green-500'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {opt.isCorrect && <CheckCircle2 className="w-4 h-4 text-white" />}
                    </button>
                    <input
                      type="text"
                      value={opt.text}
                      onChange={e => setNewOptions(prev =>
                        prev.map((o, j) => j === i ? { ...o, text: e.target.value } : o)
                      )}
                      placeholder={`Opción ${String.fromCharCode(65 + i)}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
                    />
                    {newOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setNewOptions(prev => prev.filter((_, j) => j !== i))}
                        className="p-1 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {newOptions.length < 6 && (
                  <button
                    type="button"
                    onClick={() => setNewOptions(prev => [...prev, { id: generateId(), text: '', isCorrect: false }])}
                    className="text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Agregar opción
                  </button>
                )}
              </div>
            </div>
          )}

          {/* True/False */}
          {newType === 'TRUE_FALSE' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Respuesta correcta</label>
              <div className="flex gap-3">
                {[{ v: 'true', l: 'Verdadero' }, { v: 'false', l: 'Falso' }].map(opt => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setNewCorrectAnswer(opt.v)}
                    className={`flex-1 py-2.5 rounded-lg border-2 font-medium text-sm transition ${
                      newCorrectAnswer === opt.v
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Short Answer */}
          {newType === 'SHORT_ANSWER' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Respuesta correcta</label>
              <input
                type="text"
                value={newCorrectAnswer}
                onChange={e => setNewCorrectAnswer(e.target.value)}
                placeholder="Respuesta esperada..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
              />
            </div>
          )}

          {/* Points + Explanation */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Puntos</label>
              <input
                type="number"
                value={newPoints}
                onChange={e => setNewPoints(Number(e.target.value) || 10)}
                min={1}
                max={100}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Explicación (opcional)</label>
              <input
                type="text"
                value={newExplanation}
                onChange={e => setNewExplanation(e.target.value)}
                placeholder="¿Por qué es correcta?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddForm(false)}
              className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddQuestion}
              disabled={saving}
              className="flex-1 py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 font-medium transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <><Save className="w-4 h-4" /> Guardar Pregunta</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
