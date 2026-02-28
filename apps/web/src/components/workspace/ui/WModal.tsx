import { ReactNode } from 'react'
import { X } from 'lucide-react'

interface WModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}

export default function WModal({ open, onClose, title, subtitle, children, footer, size = 'md' }: WModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className={`bg-white rounded-modal shadow-xl w-full ${sizeClasses[size]} mx-4 max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-h3 font-semibold text-slate-900">{title}</h3>
            {subtitle && <p className="text-body-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {children}
        </div>
        {footer && (
          <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-modal">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
