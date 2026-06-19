import { useState, useCallback } from 'react'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseSaveStatusReturn {
  status: SaveStatus
  /** Llama a esta función con tu promesa de guardado. Maneja estado automáticamente. */
  withSave: <T>(fn: () => Promise<T>) => Promise<T | undefined>
  /** Fuerza el status a idle */
  reset: () => void
}

/**
 * Hook para manejar el status visual de guardado (idle → saving → saved/error).
 * Regresa al estado "idle" automáticamente después de `resetAfterMs` ms (default 4000).
 *
 * @example
 * const { status, withSave } = useSaveStatus()
 * await withSave(() => gradesApi.save(payload))
 * // Luego en JSX: <SaveStatusPill status={status} />
 */
export function useSaveStatus(resetAfterMs = 4000): UseSaveStatusReturn {
  const [status, setStatus] = useState<SaveStatus>('idle')

  const withSave = useCallback(
    async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
      setStatus('saving')
      try {
        const result = await fn()
        setStatus('saved')
        setTimeout(() => setStatus('idle'), resetAfterMs)
        return result
      } catch (err) {
        setStatus('error')
        setTimeout(() => setStatus('idle'), resetAfterMs)
        throw err
      }
    },
    [resetAfterMs],
  )

  const reset = useCallback(() => setStatus('idle'), [])

  return { status, withSave, reset }
}
