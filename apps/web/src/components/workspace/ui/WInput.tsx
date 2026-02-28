import { forwardRef, InputHTMLAttributes } from 'react'

interface WInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const WInput = forwardRef<HTMLInputElement, WInputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div>
        {label && <label className="block text-body-sm font-medium text-slate-700 mb-1">{label}</label>}
        <input
          ref={ref}
          className={`w-full min-h-input px-3 py-2 border border-slate-300 rounded-lg text-body-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors ${error ? 'border-red-300' : ''} ${className}`}
          {...props}
        />
        {error && <p className="text-body-sm text-danger-600 mt-1">{error}</p>}
      </div>
    )
  }
)

WInput.displayName = 'WInput'
export default WInput
