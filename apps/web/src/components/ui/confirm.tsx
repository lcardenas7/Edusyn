/**
 * Diálogos propios (confirmar / avisar) — reemplazan a los `confirm()`/`alert()`
 * nativos del navegador, que rompen la identidad justo en el momento de tensión
 * (borrar algo). Ver docs/AUDITORIA_VISUAL_AULA.md §H6.
 *
 * API imperativa basada en promesa para que los sitios de llamada cambien poco:
 *   if (!confirm('¿x?')) return        →  if (!(await confirmDialog('¿x?'))) return
 *   alert('listo')                     →  await alertDialog('listo')
 *
 * Requiere <DialogHost/> montado una vez en la raíz (singleton, no usa Context).
 */
import { useEffect, useState } from 'react'
import { AlertTriangle, Info } from 'lucide-react'

type DialogKind = 'confirm' | 'alert'
interface DialogState {
  kind: DialogKind
  title?: string
  message: string
  confirmLabel: string
  cancelLabel: string
  danger: boolean
  resolve: (ok: boolean) => void
}

let listener: ((s: DialogState | null) => void) | null = null

function open(state: Omit<DialogState, 'resolve'>): Promise<boolean> {
  return new Promise(resolve => {
    if (!listener) { // Sin host montado: degradar al nativo para no bloquear.
      resolve(state.kind === 'alert' ? true : window.confirm(state.message))
      return
    }
    listener({ ...state, resolve })
  })
}

type ConfirmOpts = { title?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean }

export function confirmDialog(message: string, opts: ConfirmOpts = {}): Promise<boolean> {
  return open({
    kind: 'confirm', message,
    title: opts.title,
    confirmLabel: opts.confirmLabel ?? (opts.danger ? 'Eliminar' : 'Confirmar'),
    cancelLabel: opts.cancelLabel ?? 'Cancelar',
    danger: opts.danger ?? false,
  })
}

export function alertDialog(message: string, opts: { title?: string } = {}): Promise<boolean> {
  return open({ kind: 'alert', message, title: opts.title, confirmLabel: 'Entendido', cancelLabel: '', danger: false })
}

export function DialogHost() {
  const [state, setState] = useState<DialogState | null>(null)
  useEffect(() => { listener = setState; return () => { listener = null } }, [])

  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false)
      if (e.key === 'Enter') close(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state])

  const close = (ok: boolean) => { state?.resolve(ok); setState(null) }
  if (!state) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-ink-primary/40 backdrop-blur-sm" onClick={() => close(false)}>
      <div className="bg-surface-1 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 flex gap-3">
          <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${state.danger ? 'bg-red-50 text-red-600' : 'bg-violet-50 text-violet-600'}`}>
            {state.danger ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            {state.title && <h3 className="font-bold text-ink-primary mb-1">{state.title}</h3>}
            <p className="text-sm text-ink-secondary whitespace-pre-line">{state.message}</p>
          </div>
        </div>
        <div className="px-5 py-3 bg-surface-2 flex justify-end gap-2">
          {state.kind === 'confirm' && (
            <button onClick={() => close(false)} className="px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-3 rounded-lg">{state.cancelLabel}</button>
          )}
          <button
            onClick={() => close(true)}
            autoFocus
            className={`px-4 py-2 text-sm font-bold text-white rounded-lg ${state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-violet-600 hover:bg-violet-700'}`}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
