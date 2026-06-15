import { X, Lightbulb, AlertTriangle, CheckCircle2, BookOpen, HelpCircle } from 'lucide-react'
import { useEffect } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// HELP DRAWER — Panel lateral de instrucciones contextuales
// ═══════════════════════════════════════════════════════════════════════════
// Se abre desde la derecha sobre cualquier modal/página. Renderiza contenido
// estructurado en secciones con tips, warnings y errores comunes.
// ═══════════════════════════════════════════════════════════════════════════

export type HelpItem =
  | string
  | { type: 'tip' | 'warning' | 'success'; text: string }

export interface HelpSection {
  title: string
  items: HelpItem[]
}

export interface HelpCommonError {
  error: string
  cause: string
  fix: string
}

export interface HelpContent {
  /** Título principal del drawer */
  title: string
  /** Subtítulo / descripción breve */
  intro: string
  /** Color de acento (Tailwind class). Ej: 'emerald', 'indigo', 'violet' */
  accent?: 'emerald' | 'indigo' | 'violet' | 'blue' | 'rose'
  /** Secciones del paso a paso */
  sections: HelpSection[]
  /** Errores comunes y cómo solucionarlos */
  commonErrors?: HelpCommonError[]
  /** Link a un video tutorial (opcional) */
  videoUrl?: string
  /** Link a documentación externa (opcional) */
  docsUrl?: string
}

interface HelpDrawerProps {
  open: boolean
  onClose: () => void
  content: HelpContent
}

const ACCENT_CLASSES = {
  emerald: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', headerBg: 'bg-emerald-600' },
  indigo: { text: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', headerBg: 'bg-indigo-600' },
  violet: { text: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', headerBg: 'bg-violet-600' },
  blue: { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', headerBg: 'bg-blue-600' },
  rose: { text: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', headerBg: 'bg-rose-600' },
}

export function HelpDrawer({ open, onClose, content }: HelpDrawerProps) {
  const accent = ACCENT_CLASSES[content.accent || 'indigo']

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-[60] transition-opacity duration-200 ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-[61] shadow-2xl flex flex-col transition-transform duration-200 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className={`${accent.headerBg} text-white p-5 flex items-start justify-between gap-4`}>
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-tight">{content.title}</h2>
              <p className="text-sm text-white/80 mt-0.5 leading-snug">{content.intro}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg shrink-0" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* External links */}
          {(content.videoUrl || content.docsUrl) && (
            <div className="flex flex-wrap gap-2">
              {content.videoUrl && (
                <a
                  href={content.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg text-sm font-medium hover:bg-rose-100 transition-colors"
                >
                  ▶  Ver video tutorial
                </a>
              )}
              {content.docsUrl && (
                <a
                  href={content.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                >
                  📖  Documentación
                </a>
              )}
            </div>
          )}

          {/* Sections */}
          {content.sections.map((section, idx) => (
            <div key={idx}>
              <h3 className={`font-bold text-base mb-3 ${accent.text}`}>{section.title}</h3>
              <ul className="space-y-2">
                {section.items.map((item, i) => {
                  if (typeof item === 'string') {
                    return (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700 leading-relaxed">
                        <span className={`${accent.text} shrink-0 font-bold`}>•</span>
                        <span>{item}</span>
                      </li>
                    )
                  }
                  const Icon = item.type === 'tip' ? Lightbulb : item.type === 'warning' ? AlertTriangle : CheckCircle2
                  const colors =
                    item.type === 'tip'
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : item.type === 'warning'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-green-50 border-green-200 text-green-900'
                  const iconColor =
                    item.type === 'tip' ? 'text-amber-600' : item.type === 'warning' ? 'text-rose-600' : 'text-green-600'
                  return (
                    <li key={i} className={`flex items-start gap-2 p-3 rounded-lg border ${colors} text-sm leading-relaxed`}>
                      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${iconColor}`} />
                      <span>{item.text}</span>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          {/* Common errors */}
          {content.commonErrors && content.commonErrors.length > 0 && (
            <div>
              <h3 className={`font-bold text-base mb-3 ${accent.text}`}>🛟  Errores comunes</h3>
              <div className="space-y-3">
                {content.commonErrors.map((err, i) => (
                  <div key={i} className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                    <div className="font-semibold text-sm text-rose-700 mb-1">❌ {err.error}</div>
                    <div className="text-xs text-slate-600 mb-1"><span className="font-medium">Causa:</span> {err.cause}</div>
                    <div className="text-xs text-green-700"><span className="font-medium">Solución:</span> {err.fix}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500 text-center">
            ¿Algo más? Contacta a soporte desde tu perfil.
          </p>
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Botón estandarizado para abrir el drawer
// ─────────────────────────────────────────────────────────────────────────
interface HelpButtonProps {
  onClick: () => void
  label?: string
  variant?: 'default' | 'subtle'
}

export function HelpButton({ onClick, label = 'Ver instrucciones', variant = 'default' }: HelpButtonProps) {
  const styles =
    variant === 'subtle'
      ? 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
      : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${styles}`}
    >
      <HelpCircle className="w-4 h-4" />
      {label}
    </button>
  )
}
