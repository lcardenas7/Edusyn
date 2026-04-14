import { useEffect, useMemo, useState } from 'react'
import { Copy, ImageIcon, Loader2, Send, Sparkles, Trash2, X } from 'lucide-react'
import { apdApi } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { useValeriaAssistant } from '../contexts/ValeriaContext'

interface ValeriaAssistantMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  keyPoints?: string[]
  nextSteps?: string[]
  confidence?: number
  visualSuggestion?: {
    kind: 'SVG' | 'IMAGE' | 'NONE'
    placement?: 'QUESTION_IMAGE' | 'CONTEXT_IMAGE' | 'INLINE'
    svg?: string
    altText?: string
    prompt?: string
  }
}

const generalPrompts = [
  'Explícame qué puedo hacer dentro de Edusyn',
  'Ayúdame a redactar un mensaje para docentes',
  'Dame una sugerencia pedagógica clara y breve',
  'Respóndeme como una IA general sobre cualquier tema',
]

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function formatConfidence(confidence?: number) {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) return null
  return `${Math.round(confidence * 100)}%`
}

export default function ValeriaAssistant() {
  const { user, institution } = useAuth()
  const { isOpen, launchOptions, closeValeria, openValeria } = useValeriaAssistant()
  const [messages, setMessages] = useState<ValeriaAssistantMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [includeVisuals, setIncludeVisuals] = useState(false)
  const [visualPlacement, setVisualPlacement] = useState<'QUESTION_IMAGE' | 'CONTEXT_IMAGE' | 'INLINE'>('QUESTION_IMAGE')

  useEffect(() => {
    if (!isOpen) return
    if (launchOptions?.prompt && messages.length === 0) {
      setDraft(launchOptions.prompt)
    }
    if (typeof launchOptions?.includeVisuals === 'boolean') {
      setIncludeVisuals(launchOptions.includeVisuals)
    }
    if (launchOptions?.visualPlacement) {
      setVisualPlacement(launchOptions.visualPlacement)
    }
    setError('')
  }, [isOpen, launchOptions, messages.length])

  const activeContextLabel = useMemo(() => {
    if (!launchOptions?.context) return launchOptions?.title || 'Consulta general'
    const parts = [
      launchOptions.title,
      launchOptions.context.topic,
      launchOptions.context.subjectName,
      launchOptions.context.gradeName,
    ].filter(Boolean)
    return parts.join(' · ') || 'Contexto activo'
  }, [launchOptions])

  const conversation = useMemo(
    () => messages.map((message) => ({ role: message.role, content: message.content })),
    [messages],
  )

  const appendAssistantMessage = (message: ValeriaAssistantMessage) => {
    setMessages((current) => [...current, message])
  }

  const handleSend = async (overrideQuestion?: string) => {
    const question = (overrideQuestion ?? draft).trim()
    if (!question || loading) return

    const userMessage: ValeriaAssistantMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: question,
    }

    const assistantContext = launchOptions?.context
      ? {
          ...launchOptions.context,
          institutionName: launchOptions.context.institutionName || institution?.name,
        }
      : {
          institutionName: institution?.name,
        }

    const nextConversation = [...conversation, { role: 'user' as const, content: question }]

    setMessages((current) => [...current, userMessage])
    setDraft('')
    setLoading(true)
    setError('')

    try {
      const { data } = await apdApi.askValeria({
        institutionId: institution?.id,
        question,
        context: assistantContext,
        includeVisuals,
        visualPlacement,
        conversation: nextConversation.slice(0, -1),
      })

      appendAssistantMessage({
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: data.answer,
        keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints : [],
        nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps : undefined,
        confidence: data.confidence,
        visualSuggestion: data.visualSuggestion,
      })
    } catch (err: any) {
      setError(err?.response?.data?.message || 'No fue posible consultar a Valeria')
    } finally {
      setLoading(false)
    }
  }

  const clearConversation = () => {
    setMessages([])
    setDraft(launchOptions?.prompt || '')
    setError('')
  }

  const copyAnswer = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
    } catch {
      // Sin bloqueo si el navegador no permite el clipboard
    }
  }

  const applyVisual = (svg?: string) => {
    if (!svg || !launchOptions?.onApplyVisual) return
    launchOptions.onApplyVisual(svg)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => openValeria({ title: 'Valeria', subtitle: 'Asistente IA de Edusyn' })}
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-700 sm:bottom-6 sm:right-6"
      >
        <Sparkles className="h-5 w-5" />
        Valeria
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-black/30 p-3 sm:p-4" onClick={closeValeria}>
          <div
            className="flex h-[calc(100vh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:h-[calc(100vh-2rem)] lg:max-w-[860px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Valeria</h2>
                    <p className="text-sm text-slate-500">IA para consultas generales y apoyo pedagógico dentro de Edusyn</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-violet-50 px-3 py-1 font-medium text-violet-700">{activeContextLabel}</span>
                  {user?.email && <span className="rounded-full bg-slate-100 px-3 py-1">{user.email}</span>}
                </div>
              </div>

              <button
                type="button"
                onClick={closeValeria}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Cerrar Valeria"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid flex-1 min-h-0 grid-cols-1 gap-0 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="flex min-h-0 flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
                <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap gap-2">
                    {generalPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setDraft(prompt)}
                        className="rounded-full bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                  {messages.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-violet-200 bg-violet-50/60 p-6 text-slate-700">
                      <p className="text-base font-semibold text-slate-900">Hola, soy Valeria.</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Puedes preguntarme sobre Edusyn, Classroom, flujos pedagógicos, redacción de guías, exámenes,
                        logros o cualquier duda general. Si estás dentro de Classroom, también puedo darte contexto
                        específico de la actividad que estás editando.
                      </p>
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {launchOptions?.context?.topic && (
                          <div className="rounded-2xl bg-white p-3 text-sm text-slate-600 shadow-sm">
                            <span className="block text-xs font-semibold uppercase tracking-wide text-violet-500">Contexto actual</span>
                            {launchOptions.context.topic}
                          </div>
                        )}
                        {launchOptions?.subtitle && (
                          <div className="rounded-2xl bg-white p-3 text-sm text-slate-600 shadow-sm">
                            <span className="block text-xs font-semibold uppercase tracking-wide text-violet-500">Detalle</span>
                            {launchOptions.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => {
                        const isUser = message.role === 'user'
                        return (
                          <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[92%] rounded-3xl px-4 py-3 shadow-sm sm:max-w-[85%] ${isUser ? 'bg-violet-600 text-white' : 'bg-slate-50 text-slate-800 border border-slate-200'}`}>
                              <div className="whitespace-pre-line text-sm leading-6">{message.content}</div>

                              {!isUser && (
                                <div className="mt-3 space-y-3">
                                  {message.keyPoints && message.keyPoints.length > 0 && (
                                    <div>
                                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Puntos clave</p>
                                      <ul className="space-y-1 text-sm text-slate-600 list-disc pl-5">
                                        {message.keyPoints.map((item, index) => (
                                          <li key={`${message.id}-kp-${index}`}>{item}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {message.nextSteps && message.nextSteps.length > 0 && (
                                    <div>
                                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Siguientes pasos</p>
                                      <ul className="space-y-1 text-sm text-slate-600 list-disc pl-5">
                                        {message.nextSteps.map((item, index) => (
                                          <li key={`${message.id}-step-${index}`}>{item}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {message.visualSuggestion?.kind === 'SVG' && message.visualSuggestion.svg && (
                                    <div className="rounded-2xl border border-violet-200 bg-white p-3">
                                      <div className="mb-2 flex items-center justify-between gap-2">
                                        <div>
                                          <p className="text-xs font-semibold uppercase tracking-wide text-violet-500">Sugerencia visual</p>
                                          <p className="text-sm text-slate-700">{message.visualSuggestion.altText || 'Visual sugerido por Valeria'}</p>
                                        </div>
                                        <span className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700">
                                          {message.visualSuggestion.placement || 'QUESTION_IMAGE'}
                                        </span>
                                      </div>
                                      <img
                                        src={svgToDataUrl(message.visualSuggestion.svg)}
                                        alt={message.visualSuggestion.altText || 'Valeria SVG'}
                                        className="h-44 w-full rounded-xl border border-violet-100 bg-slate-50 object-contain"
                                      />
                                    </div>
                                  )}

                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => copyAnswer(message.content)}
                                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                                    >
                                      <Copy className="h-3.5 w-3.5" /> Copiar
                                    </button>

                                    {message.visualSuggestion?.kind === 'SVG' && message.visualSuggestion.svg && launchOptions?.onApplyVisual && (
                                      <button
                                        type="button"
                                        onClick={() => applyVisual(message.visualSuggestion?.svg)}
                                        className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
                                      >
                                        <ImageIcon className="h-3.5 w-3.5" /> Usar en Classroom
                                      </button>
                                    )}

                                    {formatConfidence(message.confidence) && (
                                      <span className="rounded-full bg-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                        Confianza {formatConfidence(message.confidence)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}

                      {loading && (
                        <div className="flex justify-start">
                          <div className="inline-flex items-center gap-2 rounded-3xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Valeria está pensando...
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-col bg-slate-50/70">
                <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Consulta estructurada</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Hazle preguntas abiertas. Valeria puede responder tanto sobre la plataforma como sobre temas generales.
                  </p>
                </div>

                <div className="space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
                  <label className="block text-sm font-semibold text-slate-700">Escribe tu pregunta</label>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void handleSend()
                      }
                    }}
                    rows={9}
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none ring-0 transition-colors focus:border-violet-400"
                    placeholder="Ejemplo: explícamelo como IA general, ayúdame a crear un examen, o dime cómo funciona Classroom..."
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={includeVisuals}
                        onChange={(e) => setIncludeVisuals(e.target.checked)}
                        className="rounded accent-violet-600"
                      />
                      Incluir sugerencia visual
                    </label>

                    <select
                      value={visualPlacement}
                      onChange={(e) => setVisualPlacement(e.target.value as any)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none"
                    >
                      <option value="QUESTION_IMAGE">Imagen de pregunta</option>
                      <option value="CONTEXT_IMAGE">Imagen de contexto</option>
                      <option value="INLINE">Dentro del contenido</option>
                    </select>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSend()}
                      disabled={loading || !draft.trim()}
                      className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Consultar
                    </button>

                    <button
                      type="button"
                      onClick={clearConversation}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      <Trash2 className="h-4 w-4" />
                      Limpiar chat
                    </button>

                    <button
                      type="button"
                      onClick={closeValeria}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                    >
                      Cerrar
                    </button>
                  </div>

                  {error && <p className="text-sm font-medium text-red-600">{error}</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
