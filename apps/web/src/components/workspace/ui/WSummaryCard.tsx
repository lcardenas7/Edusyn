import { ReactNode } from 'react'

interface WSummaryCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  valueColor?: string
  className?: string
}

export default function WSummaryCard({ label, value, icon, valueColor = 'text-slate-900', className = '' }: WSummaryCardProps) {
  return (
    <div className={`bg-white rounded-card border border-slate-100 p-6 shadow-sm ${className}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-badge font-medium text-slate-400 uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-metrics-xl font-bold ${valueColor}`}>{value}</p>
    </div>
  )
}
