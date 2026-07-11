import { useEffect, useState } from 'react'
import { Volume2, Square } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════════
// SPEAK BUTTON (DS-1) — Text-to-Speech con la Web Speech API del navegador
// ─────────────────────────────────────────────────────────────────────────
// "Oír pronunciación" GRATIS y on-device. A diferencia del reconocimiento de
// voz (grabar al estudiante → problema de privacidad de menores), aquí el
// sistema SOLO habla: no captura audio. Seguro por defecto.
// ═══════════════════════════════════════════════════════════════════════════

interface SpeakButtonProps {
  text: string
  lang?: string
  label?: string
  className?: string
}

export function SpeakButton({ text, lang = 'en-US', label = 'Escuchar', className = '' }: SpeakButtonProps) {
  const [speaking, setSpeaking] = useState(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window

  // Al desmontar, corta cualquier locución en curso.
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel() }, [supported])

  if (!supported || !text?.trim()) return null

  const toggle = () => {
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(u)
  }

  return (
    <button
      onClick={toggle}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-2 border border-hairline text-ink-secondary hover:text-ink-primary hover:bg-surface-3 text-xs font-medium transition-colors ${className}`}
      title="Escuchar"
    >
      {speaking ? <Square className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
      {label}
    </button>
  )
}

// Quita etiquetas HTML para leer texto plano con TTS.
export function stripHtml(html?: string): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
