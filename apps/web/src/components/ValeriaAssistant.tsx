import { useEffect, useRef, useState } from 'react'
import { Copy, Loader2, Send, Sparkles, Trash2, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { apdApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { type ValeriaActivityDraft, useValeriaAssistant } from '../contexts/ValeriaContext'

interface ValeriaMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const quickPrompts = [
  '¿Qué puedo hacer en Edusyn?',
  '¿Cómo funciona Classroom?',
  'Sugerencia pedagógica',
]

function getPageContext(pathname: string) {
  if (pathname.startsWith('/classroom')) {
    return {
      pageName: 'Classroom',
      pageSummary: 'Gestiona actividades, preguntas, guías, quizzes, foros y seguimiento dentro del aula.',
      currentPath: pathname,
    }
  }

  if (pathname.startsWith('/grades')) {
    return {
      pageName: 'Calificaciones',
      pageSummary: 'Permite registrar y revisar notas, logros y evaluaciones cuantitativas o cualitativas.',
      currentPath: pathname,
    }
  }

  if (pathname.startsWith('/reports')) {
    return {
      pageName: 'Reportes académicos',
      pageSummary: 'Consulta boletines, reportes, consolidados y resúmenes académicos de la institución.',
      currentPath: pathname,
    }
  }

  if (pathname.startsWith('/teacher-workspace')) {
    return {
      pageName: 'Espacio del docente',
      pageSummary: 'Organiza tableros, calendarios, notas, listas de verificación y seguimiento del aula.',
      currentPath: pathname,
    }
  }

  if (pathname.startsWith('/attendance')) {
    return {
      pageName: 'Asistencia',
      pageSummary: 'Gestiona registros y reportes de asistencia de estudiantes y docentes.',
      currentPath: pathname,
    }
  }

  if (pathname.startsWith('/finance')) {
    return {
      pageName: 'Finanzas',
      pageSummary: 'Administra facturación, pagos, obligaciones, conceptos y reportes financieros.',
      currentPath: pathname,
    }
  }

  if (pathname === '/' || pathname === '') {
    return {
      pageName: 'Inicio',
      pageSummary: 'Pantalla principal de Edusyn con acceso rápido a los módulos disponibles.',
      currentPath: pathname,
    }
  }

  const label = pathname.split('/').filter(Boolean).map((part) => part.replace(/[-_]/g, ' ')).join(' ')
  return {
    pageName: label ? label.replace(/\b\w/g, (m) => m.toUpperCase()) : 'Edusyn',
    pageSummary: 'Pantalla o módulo actual de Edusyn.',
    currentPath: pathname,
  }
}

export default function ValeriaAssistant() {
  const { institution } = useAuth()
  const location = useLocation()
  const { isOpen, launchOptions, closeValeria, openValeria } = useValeriaAssistant()
  const [messages, setMessages] = useState<ValeriaMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activityDraft, setActivityDraft] = useState<ValeriaActivityDraft | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && launchOptions?.prompt && messages.length === 0) {
      setDraft(launchOptions.prompt)
    }
  }, [isOpen, launchOptions, messages.length])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = async (overrideQuestion?: string) => {
    const question = (overrideQuestion ?? draft).trim()
    if (!question || loading) return

    const pageContext = getPageContext(location.pathname)
    const recentConversation = messages.slice(-4).map((m) => ({ role: m.role, content: m.content }))
    const userMsg: ValeriaMessage = { id: `${Date.now()}-u`, role: 'user', content: question }
    setMessages((m) => [...m, userMsg])
    setDraft('')
    setLoading(true)
    setError('')
    setActivityDraft(null)

    try {
      const { data } = await apdApi.askValeria({
        institutionId: institution?.id,
        question,
        context: {
          institutionName: institution?.name,
          ...pageContext,
          ...(launchOptions?.context || {}),
        },
        includeVisuals: false,
        conversation: recentConversation,
      })
      if (data?.activityDraft) {
        setActivityDraft(data.activityDraft)
      }
      setMessages((m) => [...m, { id: `${Date.now()}-a`, role: 'assistant', content: data.answer }])
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error al consultar')
    } finally {
      setLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([])
    setDraft('')
    setError('')
    setActivityDraft(null)
  }

  const createActivityFromDraft = () => {
    if (!activityDraft || !launchOptions?.onCreateActivity) return
    launchOptions.onCreateActivity(activityDraft)
    setActivityDraft(null)
  }

  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text) } catch {}
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => openValeria({ title: 'Valeria' })}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg hover:bg-violet-700 sm:bottom-6 sm:right-6"
        aria-label="Abrir Valeria"
      >
        <Sparkles className="h-5 w-5" />
      </button>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl sm:bottom-6 sm:right-6 sm:w-96" style={{ maxHeight: 'min(520px, calc(100vh - 3rem))' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Valeria</p>
            <p className="text-[11px] text-slate-400">Asistente IA</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={clearChat} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Limpiar">
            <Trash2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={closeValeria} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Cerrar">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3" style={{ minHeight: 180 }}>
        {messages.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Hola, soy Valeria. ¿En qué puedo ayudarte?</p>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((p) => (
                <button key={p} type="button" onClick={() => handleSend(p)} className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 hover:bg-violet-100">
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`group relative max-w-[85%] rounded-2xl px-3 py-2 text-sm ${msg.role === 'user' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                  <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                  {msg.role === 'assistant' && (
                    <button type="button" onClick={() => copyText(msg.content)} className="absolute -right-1 -top-1 hidden rounded bg-white p-1 text-slate-400 shadow group-hover:block hover:text-slate-600" title="Copiar">
                      <Copy className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {activityDraft && launchOptions?.onCreateActivity && (
              <div className="rounded-2xl border border-violet-200 bg-violet-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Actividad sugerida</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{activityDraft.title}</p>
                <p className="mt-1 text-xs text-slate-600 line-clamp-3">{activityDraft.description}</p>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-violet-700 border border-violet-200">{activityDraft.type || 'TASK'}</span>
                  {Array.isArray(activityDraft.questions) && activityDraft.questions.length > 0 && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
                      {activityDraft.questions.length} pregunta{activityDraft.questions.length === 1 ? '' : 's'} listas
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={createActivityFromDraft}
                    className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                  >
                    Crear actividad con Valeria
                  </button>
                </div>
                {Array.isArray(activityDraft.questions) && activityDraft.questions.length > 0 && (
                  <div className="mt-2 space-y-1 rounded-xl bg-white/70 p-2 text-xs text-slate-600">
                    {activityDraft.questions.slice(0, 3).map((question, index) => (
                      <p key={`${question.text}-${index}`} className="line-clamp-2">• {question.text}</p>
                    ))}
                    {activityDraft.questions.length > 3 && (
                      <p className="text-[11px] text-slate-400">y {activityDraft.questions.length - 3} pregunta{activityDraft.questions.length - 3 === 1 ? '' : 's'} más</p>
                    )}
                  </div>
                )}
              </div>
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-violet-50 px-3 py-2 text-xs text-violet-600">
                  <Loader2 className="h-3 w-3 animate-spin" /> Pensando...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 px-3 py-2">
        {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-violet-300"
            placeholder="Escribe tu pregunta..."
            style={{ maxHeight: 80 }}
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={loading || !draft.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-white disabled:opacity-50 hover:bg-violet-700"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  )
}
