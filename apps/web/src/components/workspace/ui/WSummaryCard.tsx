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
    <div className={`bg-white rounded-card border border-slate-200 p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-body-sm text-slate-500">{label}</span>
      </div>
      <p className={`text-metrics-lg font-bold ${valueColor}`}>{value}</p>
    </div>
  )
}
