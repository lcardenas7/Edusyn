import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { classroomApi } from '../../lib/api'
import { playPanelApi } from '../../lib/playApi'
import { usePlaySSE, PlaySSEEvent } from '../../lib/play-sse'
import LiveQuizPlayer from '../../components/play/LiveQuizPlayer'
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
  Image as ImageIcon,
  Upload,
  Timer,
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
  imageUrl?: string | null
  timeLimitSeconds?: number | null
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
  const [sseConnected, setSseConnected] = useState(false)
  const [sseFallback, setSseFallback] = useState(false)

  // New question form
  const [newType, setNewType] = useState('MULTIPLE_CHOICE')
  const [newText, setNewText] = useState('')
  const [newOptions, setNewOptions] = useState<Option[]>(defaultOptions())
  const [newCorrectAnswer, setNewCorrectAnswer] = useState('')
  const [newPoints, setNewPoints] = useState(10)
  const [newExplanation, setNewExplanation] = useState('')
  const [newImageUrl, setNewImageUrl] = useState('')
  const [newTimeLimitSeconds, setNewTimeLimitSeconds] = useState('15')
  const [uploadingImage, setUploadingImage] = useState(false)
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
    setNewImageUrl('')
    setNewTimeLimitSeconds('15')
    setError('')
  }

  const handleUploadImage = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setUploadingImage(true)
      setError('')
      try {
        const response = await classroomApi.uploadMaterial(file)
        const uploadedUrl = response.data?.data?.url || response.data?.data?.path || response.data?.url || response.data?.path
        if (uploadedUrl) {
          setNewImageUrl(uploadedUrl)
        } else {
          setError('No se pudo obtener la URL de la imagen subida')
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Error al subir imagen')
      } finally {
        setUploadingImage(false)
      }
    }
    input.click()
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
        imageUrl: newImageUrl.trim() || undefined,
        timeLimitSeconds: newTimeLimitSeconds ? parseInt(newTimeLimitSeconds, 10) || undefined : undefined,
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
  // SSE event handler — docente recibe actualizaciones en tiempo real
  const handleSSEEvent = useCallback((event: PlaySSEEvent) => {
    if (event.type === 'SESSION_STATE') {
      if (event.data?._fallback) {
        setSseFallback(true)
        return
      }
      setSseConnected(true)
      setLiveSession((prev: any) =>
        prev ? { ...prev, ...event.data } : event.data
      )
    } else if (event.type === 'GUEST_JOINED') {
      setLiveSession((prev: any) =>
        prev ? { ...prev, guestsCount: event.data.guestsCount } : prev
      )
    } else if (event.type === 'GUEST_LEFT') {
      setLiveSession((prev: any) =>
        prev ? { ...prev, guestsCount: Math.max(0, (prev.guestsCount ?? 1) - 1) } : prev
      )
    } else if (event.type === 'RANKING_UPDATED') {
      setLiveSession((prev: any) =>
        prev ? { ...prev, guests: event.data.ranking } : prev
      )
    } else if (event.type === 'SESSION_FINISHED') {
      setLiveSession((prev: any) =>
        prev ? { ...prev, status: 'FINISHED', guests: event.data.ranking } : prev
      )
    } else if (event.type === 'QUESTION_OPENED') {
      setLiveSession((prev: any) =>
        prev
          ? {
              ...prev,
              status: 'ACTIVE',
              currentQuestionIdx: event.data.questionIndex,
              totalQuestions: event.data.totalQuestions,
            }
          : prev
      )
    }
  }, [])

  // Fallback polling cuando SSE falla 3 veces
  const sseSessionId = liveSession?.id ?? ''
  const playToken = typeof window !== 'undefined' ? localStorage.getItem('play_token') ?? undefined : undefined

  const handleFallbackPoll = useCallback(async () => {
    if (!sseSessionId) return
    try {
      const status = await playPanelApi.getLiveQuizStatus(sseSessionId)
      setLiveSession(status.data)
    } catch {}
  }, [sseSessionId])

  usePlaySSE({
    sessionId: sseSessionId,
    token: playToken,
    onEvent: handleSSEEvent,
    onFallback: handleFallbackPoll,
    enabled: !!sseSessionId,
  })

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
      setSseConnected(false)
      setSseFallback(false)
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
      // El SSE enviará QUESTION_OPENED actualizando el estado; no hacemos poll
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al iniciar')
    }
  }

  const handleNextQuestion = async () => {
    if (!liveSession) return
    try {
      await playPanelApi.nextQuestionLive(liveSession.id)
      // El SSE enviará QUESTION_OPENED o SESSION_FINISHED actualizando el estado
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error')
    }
  }

  const handleFinishGame = async () => {
    if (!liveSession) return
    try {
      await playPanelApi.finishLiveQuiz(liveSession.id)
      // El SSE enviará SESSION_FINISHED con el ranking final
    } catch {}
  }

  const handleCloseLive = () => {
    setLiveSession(null)
    setSseConnected(false)
    setSseFallback(false)
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

      {liveSession && (
        <LiveQuizPlayer
          liveSession={liveSession}
          sseConnected={sseConnected}
          sseFallback={sseFallback}
          onCopyJoinCode={copyJoinCode}
          onStartGame={handleStartGame}
          onNextQuestion={handleNextQuestion}
          onFinishGame={handleFinishGame}
          onClose={handleCloseLive}
        />
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
                    {q.timeLimitSeconds ? (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Timer className="w-3 h-3" /> {q.timeLimitSeconds}s
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm font-medium text-gray-900">{q.text}</p>
                  {q.imageUrl && (
                    <img src={q.imageUrl} alt="Pregunta" className="mt-2 h-32 w-full rounded-lg object-cover border border-gray-200" />
                  )}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Imagen (opcional)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newImageUrl}
                  onChange={e => setNewImageUrl(e.target.value)}
                  placeholder="URL de imagen..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
                />
                <button
                  type="button"
                  onClick={handleUploadImage}
                  disabled={uploadingImage}
                  className="px-3 py-2 border border-violet-200 bg-violet-50 text-violet-700 rounded-lg text-sm font-medium hover:bg-violet-100 transition disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Subir
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tiempo límite (segundos)</label>
              <input
                type="number"
                value={newTimeLimitSeconds}
                onChange={e => setNewTimeLimitSeconds(e.target.value)}
                min={5}
                max={180}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 transition"
              />
            </div>
          </div>

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

          <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-800">
              <ImageIcon className="w-4 h-4" /> Vista previa
            </div>
            <div className="rounded-xl bg-white border border-violet-100 p-4">
              <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-violet-700">
                  <Hash className="w-3 h-3" /> {newPoints} pts
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                  <Timer className="w-3 h-3" /> {newTimeLimitSeconds || '—'}s
                </span>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-3">{newText.trim() || 'Aquí verás la pregunta...'}</p>
              {newImageUrl && (
                <img src={newImageUrl} alt="Vista previa" className="mb-3 h-40 w-full rounded-lg object-cover border border-gray-200" />
              )}
              {newType === 'MULTIPLE_CHOICE' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {newOptions.filter(opt => opt.text.trim()).map((opt, index) => (
                    <div key={opt.id} className={`rounded-lg border px-3 py-2 text-sm ${opt.isCorrect ? 'border-green-300 bg-green-50 text-green-800' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
                      <span className="mr-2 font-bold">{String.fromCharCode(65 + index)}.</span>{opt.text}
                    </div>
                  ))}
                </div>
              )}
              {newType === 'TRUE_FALSE' && (
                <div className="grid grid-cols-2 gap-2">
                  {['Verdadero', 'Falso'].map(label => (
                    <div key={label} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{label}</div>
                  ))}
                </div>
              )}
              {newType === 'SHORT_ANSWER' && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">Respuesta abierta del estudiante</div>
              )}
              {newExplanation && (
                <p className="mt-3 text-xs italic text-gray-500">💡 {newExplanation}</p>
              )}
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
