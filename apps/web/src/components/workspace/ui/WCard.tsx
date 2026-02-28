import { ReactNode } from 'react'

interface WCardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
  padding?: 'sm' | 'md' | 'lg'
}

const paddingClasses = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
}

export default function WCard({ children, className = '', onClick, padding = 'md' }: WCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-card border border-slate-200 ${paddingClasses[padding]} ${onClick ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''} ${className}`}
    >
      {children}
    </div>
  )
}
