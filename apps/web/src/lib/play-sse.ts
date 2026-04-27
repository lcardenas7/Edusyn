import { useEffect, useRef, useCallback } from 'react'

const PLAY_API_URL = import.meta.env.VITE_PLAY_API_URL || 'http://localhost:3000'
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 3000
const FALLBACK_POLL_MS = 5000

export type PlayEventType =
  | 'PING'
  | 'GUEST_JOINED'
  | 'GUEST_LEFT'
  | 'SESSION_STARTED'
  | 'QUESTION_OPENED'
  | 'QUESTION_CLOSED'
  | 'RANKING_UPDATED'
  | 'SESSION_FINISHED'
  | 'REACTION'
  | 'ANSWER_STATS'
  | 'SESSION_STATE'

export interface PlaySSEEvent {
  type: PlayEventType
  data: any
}

interface UsePlaySSEOptions {
  sessionId: string
  /** JWT del docente Play (header Authorization no funciona en SSE → query param) */
  token?: string
  /** guestToken firmado del invitado */
  guestToken?: string
  onEvent: (event: PlaySSEEvent) => void
  /** Si SSE no está disponible, llamar a esta función como fallback de polling */
  onFallback?: () => Promise<void>
  enabled?: boolean
}

/**
 * Hook para conectarse al stream SSE de una sesión Play.
 *
 * Orden de preferencia de auth:
 *   1. token (JWT del docente)
 *   2. guestToken (invitado firmado por GuestTokenService)
 *
 * Si SSE falla 3 veces consecutivas, activa el fallback de polling
 * con un banner de "Conexión degradada" (ver onFallback).
 */
export function usePlaySSE({
  sessionId,
  token,
  guestToken,
  onEvent,
  onFallback,
  enabled = true,
}: UsePlaySSEOptions) {
  const esRef = useRef<EventSource | null>(null)
  const retriesRef = useRef(0)
  const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isFallbackActiveRef = useRef(false)
  const onEventRef = useRef(onEvent)
  const onFallbackRef = useRef(onFallback)

  // Mantener refs actualizadas sin recrear el effect
  onEventRef.current = onEvent
  onFallbackRef.current = onFallback

  const stopFallback = useCallback(() => {
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current)
      fallbackIntervalRef.current = null
    }
    isFallbackActiveRef.current = false
  }, [])

  const startFallback = useCallback(() => {
    if (isFallbackActiveRef.current || !onFallbackRef.current) return
    isFallbackActiveRef.current = true
    // Señalizar al consumidor que estamos en modo degradado
    onEventRef.current({ type: 'SESSION_STATE', data: { _fallback: true } })
    onFallbackRef.current?.().catch(() => {})
    fallbackIntervalRef.current = setInterval(() => {
      onFallbackRef.current?.().catch(() => {})
    }, FALLBACK_POLL_MS)
  }, [])

  const connect = useCallback(() => {
    if (!sessionId || !enabled) return
    const authParam = token
      ? `token=${encodeURIComponent(token)}`
      : guestToken
      ? `guestToken=${encodeURIComponent(guestToken)}`
      : null

    if (!authParam) return

    const url = `${PLAY_API_URL}/play/live/${sessionId}/stream?${authParam}`

    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => {
      retriesRef.current = 0
      stopFallback()
    }

    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data)
        onEventRef.current({ type: parsed.type ?? ev.type, data: parsed.data ?? parsed })
      } catch {
        // ignorar mensajes malformados
      }
    }

    // NestJS emite cada tipo de evento con su propio `type` field en MessageEvent
    // El EventSource standard usa addEventListener para tipos custom
    const KNOWN_TYPES: PlayEventType[] = [
      'PING', 'GUEST_JOINED', 'GUEST_LEFT', 'SESSION_STARTED',
      'QUESTION_OPENED', 'QUESTION_CLOSED', 'RANKING_UPDATED',
      'SESSION_FINISHED', 'REACTION', 'ANSWER_STATS', 'SESSION_STATE',
    ]
    for (const type of KNOWN_TYPES) {
      es.addEventListener(type, (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data)
          onEventRef.current({ type, data })
        } catch {
          onEventRef.current({ type, data: ev.data })
        }
      })
    }

    es.onerror = () => {
      es.close()
      esRef.current = null
      retriesRef.current += 1

      if (retriesRef.current >= MAX_RETRIES) {
        startFallback()
        return
      }

      // Reintentar con backoff
      setTimeout(connect, RETRY_DELAY_MS * retriesRef.current)
    }
  }, [sessionId, token, guestToken, enabled, stopFallback, startFallback])

  useEffect(() => {
    if (!enabled || !sessionId) return
    connect()

    return () => {
      esRef.current?.close()
      esRef.current = null
      stopFallback()
    }
  }, [sessionId, enabled, connect, stopFallback])
}
