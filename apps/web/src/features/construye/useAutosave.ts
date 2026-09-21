import { useCallback, useEffect, useRef, useState } from 'react'

export type AutosaveStatus = 'saved' | 'pending' | 'saving' | 'error'

/**
 * Guarda solo, un momento después de que el equipo deja de escribir. Nunca dice «guardado» sin
 * la confirmación del servidor; si algo cambia mientras se guarda, vuelve a guardar al terminar;
 * si falla, queda en «error» y se puede reintentar. Mientras haya algo sin guardar, el navegador
 * pregunta antes de cerrar la página.
 */
export function useAutosave<T>(initial: T, save: (value: T) => Promise<boolean>, delay = 1200) {
  const [value, setValue] = useState<T>(initial)
  const [status, setStatus] = useState<AutosaveStatus>('saved')
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const savedJson = useRef(JSON.stringify(initial))
  const latest = useRef(value)
  const inFlight = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRef = useRef(save)
  saveRef.current = save
  latest.current = value

  const run = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    if (inFlight.current) return
    const snapshot = latest.current
    const json = JSON.stringify(snapshot)
    if (json === savedJson.current) { setStatus('saved'); return }
    inFlight.current = true
    setStatus('saving')
    let ok = false
    try {
      ok = await saveRef.current(snapshot)
    } catch {
      ok = false
    }
    inFlight.current = false
    if (!ok) { setStatus('error'); return }
    savedJson.current = json
    setSavedAt(new Date())
    // Cambió mientras se guardaba: se guarda otra vez lo último.
    if (JSON.stringify(latest.current) !== json) void run()
    else setStatus('saved')
  }, [])

  const update = useCallback((next: T | ((current: T) => T)) => {
    setValue(current => {
      const resolved = typeof next === 'function' ? (next as (c: T) => T)(current) : next
      latest.current = resolved
      return resolved
    })
    setStatus(current => (current === 'saving' ? current : 'pending'))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void run() }, delay)
  }, [delay, run])

  const dirty = status !== 'saved'
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Al salir del paso (cambiar de pestaña del estudio) se intenta guardar lo pendiente.
  useEffect(() => () => {
    if (timer.current) { clearTimeout(timer.current); void run() }
  }, [run])

  return { value, update, status, savedAt, flush: run }
}
