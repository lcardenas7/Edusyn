import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Coins, Check, X, Plus } from 'lucide-react'
import type { SectionItem } from './Section'

// Lee el monto meta y el recaudado tanto de los campos nuevos (V2)
// como del metadata legacy. Prioridad: columna > metadata.
export function getAmountTarget(item: SectionItem): number | null {
  if (item.amount != null) return Number(item.amount)
  const meta = (item.metadata || {}) as any
  if (meta.amountTarget != null) return Number(meta.amountTarget)
  return null
}

export function getAmountPaid(item: SectionItem): number {
  if (item.amountCollected != null) return Number(item.amountCollected)
  const meta = (item.metadata || {}) as any
  return Number(meta.amountPaid || 0)
}

function formatMoney(n: number): string {
  return '$' + n.toLocaleString('es-CO', { maximumFractionDigits: 0 })
}

function parseMoney(s: string): number | null {
  const cleaned = s.replace(/[^\d.]/g, '')
  if (!cleaned) return null
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

interface CollectionRowProps {
  item: SectionItem
  index: number
  onUpdate: (itemId: string, patch: { metadata: any }) => Promise<void>
}

type Mode = 'view' | 'setTarget' | 'addPayment'

export function CollectionRow({ item, index, onUpdate }: CollectionRowProps) {
  const target = getAmountTarget(item)
  const paid = getAmountPaid(item)
  const remaining = target != null ? Math.max(0, target - paid) : null
  const isPaid = target != null && paid >= target
  const pct = target ? Math.min(100, (paid / target) * 100) : 0

  const [mode, setMode] = useState<Mode>('view')
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMode('view')
    setDraft('')
    setError(null)
  }, [item.id])

  const handleSaveTarget = async () => {
    const val = parseMoney(draft)
    if (val == null || val <= 0) {
      setError('Ingresa un monto válido')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const newMeta = { ...(item.metadata || {}), amountTarget: val }
      // Mantener compat con UI vieja: si no había amountPaid en meta, inicializar en 0
      if (newMeta.amountPaid == null) newMeta.amountPaid = paid
      if (newMeta.status == null) newMeta.status = paid >= val ? 'PAID' : (paid > 0 ? 'PARTIAL' : 'PENDING')
      await onUpdate(item.id, { metadata: newMeta })
      setMode('view')
      setDraft('')
    } catch {
      setError('No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleAddPayment = async () => {
    const val = parseMoney(draft)
    if (val == null || val <= 0) {
      setError('Ingresa un monto válido')
      return
    }
    if (target != null && paid + val > target * 1.5) {
      setError('Ese monto excede el meta. ¿Seguro?')
      // No bloqueamos, solo advertimos
    }
    setSaving(true)
    setError(null)
    try {
      const newPaid = paid + val
      const newMeta = { ...(item.metadata || {}), amountPaid: newPaid }
      if (target != null) {
        newMeta.status = newPaid >= target ? 'PAID' : 'PARTIAL'
      }
      await onUpdate(item.id, { metadata: newMeta })
      setMode('view')
      setDraft('')
    } catch {
      setError('No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ delay: Math.min(index * 0.02, 0.25), duration: 0.2 }}
      className={`rounded-2xl border p-4 transition ${
        isPaid
          ? 'bg-emerald-50/40 border-emerald-200'
          : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Icono */}
        <div className="pt-1 flex-shrink-0">
          {isPaid ? (
            <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
              <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
              <Coins className="w-3.5 h-3.5 text-amber-600" />
            </div>
          )}
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          {/* Nombre */}
          <p className={`text-sm font-semibold ${isPaid ? 'text-emerald-900' : 'text-slate-800'}`}>
            {item.title}
          </p>

          {/* Modo VIEW */}
          {mode === 'view' && (
            <>
              {target == null ? (
                <button
                  type="button"
                  onClick={() => { setMode('setTarget'); setDraft('') }}
                  className="mt-1 text-xs text-violet-600 hover:text-violet-800 font-medium inline-flex items-center gap-1 transition"
                >
                  <Plus className="w-3 h-3" /> Fijar monto meta
                </button>
              ) : (
                <div className="mt-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-semibold ${isPaid ? 'text-emerald-700' : 'text-slate-700'}`}>
                      {formatMoney(paid)} <span className="text-slate-400 font-normal">de</span> {formatMoney(target)}
                    </span>
                    {!isPaid && (
                      <span className="text-slate-400 text-[10px]">
                        falta {formatMoney(remaining ?? 0)}
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className={`h-full rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-gradient-to-r from-amber-400 to-amber-500'}`}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    {!isPaid && (
                      <button
                        type="button"
                        onClick={() => { setMode('addPayment'); setDraft('') }}
                        className="text-xs text-violet-600 hover:text-violet-800 font-medium inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" /> Registrar pago
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => { setMode('setTarget'); setDraft(String(target)) }}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      ajustar meta
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Modo EDIT */}
          {mode !== 'view' && (
            <div className="mt-2 flex items-center gap-2">
              <div className="relative flex-1 max-w-[200px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value); setError(null) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (mode === 'setTarget' ? handleSaveTarget : handleAddPayment)()
                    if (e.key === 'Escape') setMode('view')
                  }}
                  disabled={saving}
                  placeholder={mode === 'setTarget' ? 'Monto meta' : 'Monto del pago'}
                  className="w-full pl-7 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:border-violet-400 focus:ring-1 focus:ring-violet-400 focus:outline-none disabled:opacity-50"
                />
              </div>
              <button
                type="button"
                onClick={mode === 'setTarget' ? handleSaveTarget : handleAddPayment}
                disabled={saving || !draft}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition disabled:opacity-40"
              >
                <Check className="w-3 h-3" /> {saving ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={() => setMode('view')}
                disabled={saving}
                className="p-1.5 text-slate-400 hover:text-slate-600 transition"
                aria-label="Cancelar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {error && (
            <p className="mt-2 text-[11px] text-red-600">{error}</p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
