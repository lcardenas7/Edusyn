import { useEffect, useState } from 'react'
import { canInstallApp, installApp } from '../lib/pwa'
import { toast } from '../lib/toast'

function looksLikeDesktopOnPhone() {
  // A hint, not device identification: never force viewport scaling or disable zoom.
  return navigator.maxTouchPoints > 0 &&
    window.matchMedia('(any-pointer: coarse)').matches &&
    Math.min(window.screen.width, window.screen.height) <= 600 &&
    window.innerWidth >= 800
}

export default function PwaExperience() {
  const [installable, setInstallable] = useState(canInstallApp)
  const [desktopHint, setDesktopHint] = useState(looksLikeDesktopOnPhone)
  const [dismissed, setDismissed] = useState(false)
  const [installing, setInstalling] = useState(false)
  useEffect(() => {
    const update = () => {
      setInstallable(canInstallApp())
      setDesktopHint(looksLikeDesktopOnPhone())
    }
    window.addEventListener('edusyn:pwa-change', update)
    window.addEventListener('resize', update)
    const mode = window.matchMedia('(display-mode: standalone)')
    mode.addEventListener('change', update)
    update()
    return () => {
      window.removeEventListener('edusyn:pwa-change', update)
      window.removeEventListener('resize', update)
      mode.removeEventListener('change', update)
    }
  }, [])
  if (dismissed || (!installable && !desktopHint)) return null
  return (
    <aside data-pwa-help className="mb-3 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950" aria-label="Edusyn en tu celular">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{desktopHint ? '¿Se ve todo muy pequeño?' : 'Lleva Edusyn en tu celular'}</p>
          <p className="mt-1">{desktopHint
            ? 'Chrome podría estar mostrando la versión de computadora. Abre Edusyn en Chrome, entra en ⋮ y desmarca «Sitio para computadoras» o «Versión para ordenador». Luego vuelve a abrir la app.'
            : 'Instala la app para abrir el aula y los eventos desde tu pantalla de inicio.'}</p>
          {installable && !desktopHint && <button type="button" disabled={installing} className="mt-2 min-h-11 rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-60" onClick={async () => {
            setInstalling(true)
            try { await installApp() }
            catch { toast.error('No pudimos abrir la instalación. Inténtalo desde el menú de tu navegador.') }
            finally { setInstalling(false) }
          }}>Instalar Edusyn</button>}
        </div>
        <button type="button" className="min-h-11 min-w-11 shrink-0 rounded-lg text-xl" aria-label="Cerrar ayuda de instalación" onClick={() => setDismissed(true)}>×</button>
      </div>
    </aside>
  )
}
