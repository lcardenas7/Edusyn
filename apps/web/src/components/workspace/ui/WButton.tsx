import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface WButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  children?: ReactNode
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50',
  secondary: 'bg-slate-100 text-slate-600 hover:bg-slate-200',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-danger-50 text-danger-700 hover:bg-danger-100',
}

const sizeClasses: Record<Size, string> = {
  sm: 'min-h-[36px] px-3 py-1.5 text-body-sm',
  md: 'min-h-btn px-4 py-2 text-body-sm',
  lg: 'min-h-[48px] px-5 py-2.5 text-body-base',
}

const WButton = forwardRef<HTMLButtonElement, WButtonProps>(
  ({ variant = 'primary', size = 'md', loading, icon, children, className = '', disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
        {children}
      </button>
    )
  }
)

WButton.displayName = 'WButton'
export default WButton
