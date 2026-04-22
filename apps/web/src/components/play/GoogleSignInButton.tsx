import { useEffect, useRef, useState } from 'react'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

interface GoogleSignInButtonProps {
  onSuccess: (idToken: string) => void
  onError?: (error: string) => void
  text?: 'signin_with' | 'signup_with' | 'continue_with'
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void
          renderButton: (el: HTMLElement, config: any) => void
          prompt: () => void
        }
      }
    }
  }
}

export default function GoogleSignInButton({ onSuccess, onError, text = 'continue_with' }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [noClientId, setNoClientId] = useState(false)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setNoClientId(true)
      return
    }

    // Load Google Identity Services script
    const existingScript = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
    if (existingScript) {
      // Script already loaded
      if (window.google?.accounts?.id) {
        initializeGoogle()
      } else {
        existingScript.addEventListener('load', initializeGoogle)
      }
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = initializeGoogle
    script.onerror = () => onError?.('No se pudo cargar Google Sign-In')
    document.head.appendChild(script)
  }, [])

  function initializeGoogle() {
    if (!window.google?.accounts?.id || !buttonRef.current) return

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    })

    window.google.accounts.id.renderButton(buttonRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text,
      width: buttonRef.current.offsetWidth || 380,
      logo_alignment: 'left',
      locale: 'es',
    })

    setLoaded(true)
  }

  function handleCredentialResponse(response: any) {
    if (response?.credential) {
      onSuccess(response.credential)
    } else {
      onError?.('No se recibió respuesta de Google')
    }
  }

  if (noClientId) {
    return null
  }

  return (
    <div className="w-full">
      <div
        ref={buttonRef}
        className="w-full flex justify-center"
        style={{ minHeight: 44 }}
      />
      {!loaded && (
        <div className="w-full h-11 rounded-lg border border-gray-300 bg-white flex items-center justify-center gap-2 text-sm text-gray-500 animate-pulse">
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Cargando Google...
        </div>
      )}
    </div>
  )
}
