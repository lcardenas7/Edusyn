import { Cloud, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import type { SaveStatus } from '../hooks/useSaveStatus'

interface SaveStatusPillProps {
  status: SaveStatus
  savedLabel?: string
  className?: string
}

const CONFIG = {
  idle: {
    icon: <Cloud className="w-3.5 h-3.5" />,
    label: 'Sin cambios',
    className: 'text-slate-400 bg-slate-50 border-slate-200',
  },
  saving: {
    icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    label: 'Guardando…',
    className: 'text-blue-600 bg-blue-50 border-blue-200',
  },
  saved: {
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    label: 'Guardado',
    className: 'text-green-600 bg-green-50 border-green-200',
  },
  error: {
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    label: 'Error al guardar',
    className: 'text-red-600 bg-red-50 border-red-200',
  },
}

/**
 * Pill visual que muestra el estado de guardado.
 * Úsalo junto a `useSaveStatus` en la cabecera de Notas, Asistencia, etc.
 *
 * @example
 * <SaveStatusPill status={status} />
 */
export default function SaveStatusPill({
  status,
  savedLabel,
  className = '',
}: SaveStatusPillProps) {
  const cfg = CONFIG[status]
  const label = status === 'saved' && savedLabel ? savedLabel : cfg.label

  if (status === 'idle') return null

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all duration-300 ${cfg.className} ${className}`}
    >
      {cfg.icon}
      {label}
    </span>
  )
}
