import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, CalendarPlus, Pin } from 'lucide-react'
import type { SectionKey } from './SectionTabs'

interface CaptureBarProps {
  sectionKey: SectionKey
  onSubmit: (text: string, opts?: { eventDate?: string; followUp?: boolean; followUpDue?: string }) => Promise<void>
  disabled?: boolean
}

const HINTS: Record<SectionKey, string> = {
  log:          '¿Cómo terminó la clase? Escribe aquí…',
  observations: 'Anotar una observación sobre un estudiante…',
  collection:   'Registrar un cobro: descripción, monto…',
  roles:        'Asignar un rol del salón…',
  resources:    'Guardar un link o recurso…',
}

const CTA: Record<SectionKey, string> = {
  log:          'Guardar entrada',
  observations: 'Anotar',
  collection:   'Registrar',
  roles:        'Asignar',
  resources:    'Guardar',
}

export function CaptureBar({ sectionKey, onSubmit, disabled }: CaptureBarProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [eventDate, setEventDate] = useState('')
  const [followUp, setFollowUp] = useState(false)
  const [followUpDue, setFollowUpDue] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)

  // Limpiar al cambiar de pestaña
  useEffect(() => {
    setText(''); setScheduling(false); setEventDate(''); setFollowUp(false); setFollowUpDue('')
  }, [sectionKey])

  // Auto-resize del textarea
  useEffect(() => {
    if (!taRef.current) return
    taRef.current.style.height = 'auto'
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 160) + 'px'
  }, [text])

  const handleSubmit = async () => {
    const value = text.trim()
    if (!value || sending) return
    setSending(true)
    try {
      await onSubmit(value, {
        ...(scheduling && eventDate ? { eventDate } : {}),
        ...(followUp ? { followUp: true, followUpDue: followUpDue || undefined } : {}),
      })
      setText(''); setScheduling(false); setEventDate(''); setFollowUp(false); setFollowUpDue('')
    } catch {
      // El padre maneja el error; mantenemos el texto para que el usuario lo recupere.
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="sticky bottom-0 left-0 right-0 mt-8 pt-4 pb-4 bg-gradient-to-t from-[#FAF8F3] via-[#FAF8F3]/95 to-transparent">
      <div className="relative rounded-2xl bg-white border border-slate-200 shadow-sm focus-within:border-violet-300 focus-within:shadow-md transition">
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={HINTS[sectionKey]}
          disabled={disabled || sending}
          rows={1}
          className="w-full resize-none bg-transparent px-4 py-3 pr-32 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none disabled:opacity-50"
          aria-label={HINTS[sectionKey]}
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFollowUp((v) => !v)}
            title="Crear seguimiento"
            className={`p-1.5 rounded-lg transition ${followUp ? 'bg-violet-100 text-violet-700' : 'text-slate-400 hover:bg-slate-100'}`}
          >
            <Pin className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setScheduling((v) => !v)}
            title="Programar en el calendario"
            className={`p-1.5 rounded-lg transition ${scheduling ? 'bg-violet-100 text-violet-700' : 'text-slate-400 hover:bg-slate-100'}`}
          >
            <CalendarPlus className="w-4 h-4" />
          </button>
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-300">
            <Sparkles className="w-3 h-3" /> Cmd+Enter
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim() || sending || disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? 'Guardando…' : CTA[sectionKey]}
            {!sending && <Send className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Programar en el calendario (opcional) */}
      {scheduling && (
        <div className="mt-2 flex items-center gap-2 px-1 text-xs text-slate-600">
          <CalendarPlus className="w-3.5 h-3.5 text-violet-500" />
          <span>Agregar al calendario el</span>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            className="px-2 py-1 border border-slate-200 rounded-lg focus:border-violet-400 focus:outline-none"
          />
          {!eventDate && <span className="text-slate-400">elige una fecha</span>}
        </div>
      )}

      {/* Crear seguimiento (opcional) */}
      {followUp && (
        <div className="mt-2 flex items-center gap-2 px-1 text-xs text-slate-600">
          <Pin className="w-3.5 h-3.5 text-violet-500" />
          <span>Crear seguimiento</span>
          <span className="text-slate-400">·</span>
          <span>vence</span>
          <input
            type="date"
            value={followUpDue}
            onChange={(e) => setFollowUpDue(e.target.value)}
            className="px-2 py-1 border border-slate-200 rounded-lg focus:border-violet-400 focus:outline-none"
          />
          <span className="text-slate-400">(opcional)</span>
        </div>
      )}
    </div>
  )
}
