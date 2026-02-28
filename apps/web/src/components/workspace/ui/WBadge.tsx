import { ReactNode } from 'react'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'

interface WBadgeProps {
  variant?: BadgeVariant
  children: ReactNode
  className?: string
  icon?: ReactNode
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-600',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
}

export default function WBadge({ variant = 'default', children, className = '', icon }: WBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-badge font-medium ${variantClasses[variant]} ${className}`}>
      {icon}
      {children}
    </span>
  )
}
