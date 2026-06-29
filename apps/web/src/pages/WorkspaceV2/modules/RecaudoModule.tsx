import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Coins, Plus, X, Loader2, ArrowLeft, Check, Users2, Calendar, Trash2, ChevronRight,
} from 'lucide-react'
import { teacherWorkspaceApi } from '../../../lib/api'

interface Payment { id: string; amount: number; paidAt: string; note?: string | null }
interface Charge { id: string; studentId: string; studentName: string; collected: number; unitValue: number; status: string; payments: Payment[] }
interface Collection {
  id: string; boardId: string; name: string; description?: string | null; unitValue: number;
  dueDate?: string | null; chargesCount: number; meta: number; totalCollected: number;
  paidCount: number; progress: number; charges: Charge[]
}

const money = (n: number) => '$' + (n || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })

export function RecaudoModule({ boardId }: { boardId: string }) {
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    teacherWorkspaceApi.listCollections(boardId)
      .then((res) => setCollections(res.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [boardId])
  useEffect(() => { load() }, [load])

  const open = collections.find((c) => c.id === openId)

  if (loading) return <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-slate-300 mx-auto" /></div>

  if (open) {
    return <CollectionDetail collection={open} onBack={() => setOpenId(null)} onChanged={load} />
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-500">{collections.length} recaudo(s)</p>
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:text-violet-800">
          <Plus className="w-4 h-4" /> Nuevo recaudo
        </button>
      </div>

      {collections.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/40 py-10 text-center">
          <Coins className="w-8 h-8 text-amber-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aún no hay recaudos. Crea el primero (ej. "Libro").</p>
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map((c) => (
            <button key={c.id} onClick={() => setOpenId(c.id)}
              className="w-full text-left rounded-2xl bg-white border border-slate-200 hover:border-slate-300 hover:shadow-sm transition p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center flex-shrink-0"><Coins className="w-5 h-5 text-amber-500" /></div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">{c.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {money(c.unitValue)} × {c.chargesCount} = <span className="font-semibold">{money(c.meta)}</span>
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 mt-1" />
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-amber-600 font-medium">{money(c.totalCollected)} recaudado</span>
                  <span className="text-slate-400">{c.paidCount}/{c.chargesCount} al día</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" style={{ width: `${c.progress}%` }} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {creating && <CreateCollectionModal boardId={boardId} onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); load(); setOpenId(id) }} />}
    </div>
  )
}

function CreateCollectionModal({ boardId, onClose, onCreated }: { boardId: string; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [unitValue, setUnitValue] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [assignAll, setAssignAll] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const val = parseFloat(unitValue.replace(/[^\d.]/g, ''))
    if (!name.trim()) { setError('Ponle un nombre'); return }
    if (!val || val <= 0) { setError('El valor individual debe ser mayor a 0'); return }
    setSaving(true); setError(null)
    try {
      const res = await teacherWorkspaceApi.createCollection({
        boardId, name: name.trim(), description: description.trim() || undefined,
        unitValue: val, dueDate: dueDate || undefined, assign: assignAll ? 'ALL' : [],
      })
      onCreated(res.data.id)
    } catch (e: any) {
      setError(e?.response?.data?.message || 'No se pudo crear el recaudo.')
    } finally { setSaving(false) }
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md pointer-events-auto overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900" style={{ fontFamily: 'Georgia, serif' }}>Nuevo recaudo</h2>
            <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-6 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Nombre</span>
              <input autoFocus value={name} onChange={(e) => { setName(e.target.value); setError(null) }} placeholder="Ej: Libro, Salida pedagógica…"
                className="mt-1.5 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-violet-400 focus:outline-none" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Valor individual</span>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input value={unitValue} onChange={(e) => { setUnitValue(e.target.value); setError(null) }} inputMode="numeric" placeholder="80000"
                  className="w-full pl-7 pr-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-violet-400 focus:outline-none" />
              </div>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Fecha límite</span>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-violet-400 focus:outline-none" />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Descripción</span>
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="opcional"
                  className="mt-1.5 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-violet-400 focus:outline-none" />
              </label>
            </div>
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={assignAll} onChange={(e) => setAssignAll(e.target.checked)} className="rounded" />
              <Users2 className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-700">Asignar a todo el grupo</span>
            </label>
            <p className="text-[11px] text-slate-400">La meta se calcula sola: valor individual × estudiantes asignados.</p>
            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          </div>
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex justify-end">
            <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white text-sm font-semibold disabled:opacity-50">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando…</> : 'Crear recaudo'}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function CollectionDetail({ collection, onBack, onChanged }: { collection: Collection; onBack: () => void; onChanged: () => void }) {
  const [data, setData] = useState<Collection>(collection)
  const [payFor, setPayFor] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const refresh = async () => {
    const res = await teacherWorkspaceApi.getCollection(data.id)
    setData(res.data); onChanged()
  }

  const addPayment = async (chargeId: string) => {
    const val = parseFloat(payAmount.replace(/[^\d.]/g, ''))
    if (!val || val <= 0) return
    setSaving(true)
    try {
      const res = await teacherWorkspaceApi.addPayment(chargeId, { amount: val })
      setData(res.data); onChanged(); setPayFor(null); setPayAmount('')
    } catch { /* noop */ } finally { setSaving(false) }
  }

  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-3">
        <ArrowLeft className="w-3.5 h-3.5" /> Recaudos
      </button>

      {/* Resumen */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-bold text-slate-900">{data.name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{money(data.unitValue)} × {data.chargesCount} estudiantes</p>
            {data.dueDate && <p className="text-[11px] text-slate-400 mt-1 inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> vence {new Date(data.dueDate).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</p>}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-amber-600">{money(data.totalCollected)}</p>
            <p className="text-[11px] text-slate-400">de {money(data.meta)}</p>
          </div>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-3">
          <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" style={{ width: `${data.progress}%` }} />
        </div>
      </div>

      {/* Cargos por estudiante */}
      <div className="space-y-2">
        {data.charges.map((ch) => {
          const isPaid = ch.status === 'PAID'
          const remaining = Math.max(0, ch.unitValue - ch.collected)
          return (
            <div key={ch.id} className={`rounded-2xl border p-3 ${isPaid ? 'bg-emerald-50/30 border-emerald-100' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isPaid ? 'bg-emerald-500' : 'bg-amber-100'}`}>
                  {isPaid ? <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} /> : <Coins className="w-3.5 h-3.5 text-amber-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isPaid ? 'text-emerald-900' : 'text-slate-800'}`}>{ch.studentName}</p>
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-slate-500">{money(ch.collected)} / {money(ch.unitValue)}</span>
                    {!isPaid && <span className="text-slate-400">falta {money(remaining)}</span>}
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                    <div className={`h-full rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, (ch.collected / ch.unitValue) * 100)}%` }} />
                  </div>
                  {ch.payments.length > 0 && (
                    <details className="mt-1.5">
                      <summary className="text-[10px] text-slate-400 cursor-pointer">{ch.payments.length} pago(s)</summary>
                      <div className="mt-1 space-y-0.5">
                        {ch.payments.map((p) => (
                          <div key={p.id} className="flex items-center justify-between text-[10px] text-slate-500">
                            <span>{money(p.amount)} · {new Date(p.paidAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>
                            <button onClick={async () => { await teacherWorkspaceApi.deletePayment(p.id); await refresh() }} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
                {!isPaid && (
                  payFor === ch.id ? (
                    <div className="flex items-center gap-1">
                      <input autoFocus value={payAmount} onChange={(e) => setPayAmount(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addPayment(ch.id) }}
                        inputMode="numeric" placeholder={String(remaining)} className="w-20 px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-violet-400" />
                      <button onClick={() => addPayment(ch.id)} disabled={saving} className="p-1.5 rounded-lg bg-violet-600 text-white"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setPayFor(null); setPayAmount('') }} className="p-1.5 text-slate-400"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <button onClick={() => { setPayFor(ch.id); setPayAmount('') }} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-violet-50 text-violet-700 text-xs font-medium hover:bg-violet-100 transition flex-shrink-0">
                      <Plus className="w-3 h-3" /> Pago
                    </button>
                  )
                )}
              </div>
            </div>
          )
        })}
        {data.charges.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Este recaudo no tiene estudiantes asignados.</p>
        )}
      </div>
    </div>
  )
}
