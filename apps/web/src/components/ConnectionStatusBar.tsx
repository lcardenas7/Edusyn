import { useState, useEffect } from 'react'
import { WifiOff, Wifi, AlertTriangle, RefreshCw } from 'lucide-react'

type ConnectionState = 'online' | 'offline' | 'slow' | 'server-error'

export default function ConnectionStatusBar() {
  const [state, setState] = useState<ConnectionState>('online')
  const [visible, setVisible] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const checkConnection = async () => {
    if (!navigator.onLine) {
      setState('offline')
      setVisible(true)
      return
    }
    // Ping al healthcheck del backend
    try {
      const start = Date.now()
      await fetch('/api/health', { method: 'GET', cache: 'no-store' })
      const latency = Date.now() - start
      if (latency > 3000) {
        setState('slow')
        setVisible(true)
      } else if (state !== 'online') {
        setState('online')
        // Mostramos brevemente "reconectado" y luego ocultamos
        setVisible(true)
        setTimeout(() => setVisible(false), 4000)
      }
    } catch {
      if (navigator.onLine) {
        setState('server-error')
        setVisible(true)
      }
    }
  }

  useEffect(() => {
    const handleOffline = () => { setState('offline'); setVisible(true) }
    const handleOnline = () => {
      setState('online')
      setVisible(true)
      setTimeout(() => setVisible(false), 4000)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    // Verificar cada 30 segundos
    const interval = setInterval(checkConnection, 30_000)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const handleRetry = async () => {
    setRetrying(true)
    await checkConnection()
    setRetrying(false)
  }

  if (!visible) return null

  const configs: Record<ConnectionState, {
    bg: string; border: string; text: string; icon: React.ReactNode; message: string; sub?: string
  }> = {
    offline: {
      bg: 'bg-amber-50',
      border: 'border-amber-400',
      text: 'text-amber-800',
      icon: <WifiOff className="w-4 h-4 shrink-0" />,
      message: 'Sin conexión a internet',
      sub: 'Los cambios pendientes se guardarán cuando vuelvas en línea.',
    },
    slow: {
      bg: 'bg-blue-50',
      border: 'border-blue-300',
      text: 'text-blue-800',
      icon: <Wifi className="w-4 h-4 shrink-0" />,
      message: 'Conexión lenta',
      sub: 'Las operaciones pueden tardar más de lo normal.',
    },
    'server-error': {
      bg: 'bg-red-50',
      border: 'border-red-300',
      text: 'text-red-800',
      icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
      message: 'Problema con el servidor',
      sub: 'Estamos trabajando para resolverlo. Inténtalo en unos momentos.',
    },
    online: {
      bg: 'bg-green-50',
      border: 'border-green-300',
      text: 'text-green-800',
      icon: <Wifi className="w-4 h-4 shrink-0" />,
      message: 'Conexión restablecida',
      sub: undefined,
    },
  }

  const cfg = configs[state]

  return (
    <div
      className={`w-full ${cfg.bg} border-b ${cfg.border} ${cfg.text} px-4 py-2 flex items-center justify-between gap-3 text-sm z-50`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {cfg.icon}
        <span className="font-medium">{cfg.message}</span>
        {cfg.sub && (
          <span className="hidden sm:inline text-xs opacity-80 truncate">— {cfg.sub}</span>
        )}
      </div>

      {state !== 'online' && (
        <button
          onClick={handleRetry}
          disabled={retrying}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border ${cfg.border} bg-white/60 hover:bg-white/90 transition-colors text-xs font-medium shrink-0 disabled:opacity-50`}
        >
          <RefreshCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Verificando…' : 'Reintentar'}
        </button>
      )}
    </div>
  )
}
