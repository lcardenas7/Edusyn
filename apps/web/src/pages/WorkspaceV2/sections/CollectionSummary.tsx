import { motion } from 'framer-motion'
import { Coins } from 'lucide-react'

interface CollectionSummaryProps {
  totalTarget: number
  totalCollected: number
  studentCount: number
  pendingCount: number
}

function formatMoney(n: number): string {
  return '$' + n.toLocaleString('es-CO', { maximumFractionDigits: 0 })
}

export function CollectionSummary({ totalTarget, totalCollected, studentCount, pendingCount }: CollectionSummaryProps) {
  const pct = totalTarget > 0 ? Math.min(100, (totalCollected / totalTarget) * 100) : 0
  const hasTarget = totalTarget > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-5 rounded-2xl bg-white border border-slate-200 p-4 sm:p-5"
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 flex items-center justify-center">
            <Coins className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Recaudo del grupo</p>
            <p className="text-lg font-bold text-slate-900 leading-tight">
              {hasTarget ? (
                <>
                  <span className="text-amber-600">{formatMoney(totalCollected)}</span>
                  <span className="text-slate-300 mx-1">de</span>
                  <span>{formatMoney(totalTarget)}</span>
                </>
              ) : (
                <span className="text-slate-400 font-normal italic text-sm">aún sin montos fijados</span>
              )}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Estudiantes</p>
          <p className="text-sm font-semibold text-slate-700">
            <span className="text-emerald-600">{studentCount - pendingCount}</span>
            <span className="text-slate-300 mx-1">/</span>
            <span>{studentCount}</span>
            <span className="text-slate-400 font-normal text-xs ml-2">al día</span>
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {hasTarget && (
        <div className="mt-4">
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full"
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1 text-right font-medium">
            {pct.toFixed(0)}% recaudado
          </p>
        </div>
      )}
    </motion.div>
  )
}
