import { describe, it, expect } from 'vitest'
import { isSessionOpen, liveModeOf, liveSessionCopy, type LiveSessionLike } from './liveSession'

/**
 * Una sesión en vivo es lo más urgente que puede pasar en el aula. Estas pruebas fijan que el
 * aviso no se pierda por un detalle de forma del payload.
 */

function ses(over: Partial<LiveSessionLike> = {}): LiveSessionLike {
  return { id: 's1', activityId: 'a1', status: 'ACTIVE', ...over }
}

describe('modo de la sesión', () => {
  it('lee el modo esté donde esté en el payload', () => {
    expect(liveModeOf(ses({ deliveryMode: 'ASYNC_HOME' }))).toBe('en-casa')
    expect(liveModeOf(ses({ config: { deliveryMode: 'ASYNC_HOME' } }))).toBe('en-casa')
    expect(liveModeOf(ses({ deliveryMode: 'SYNC' }))).toBe('en-vivo')
  })

  it('ante la duda asume "en vivo"', () => {
    // Equivocarse hacia allá cuesta un aviso de más; al revés, un estudiante se pierde el quiz.
    expect(liveModeOf(ses())).toBe('en-vivo')
    expect(liveModeOf(null)).toBe('en-vivo')
  })
})

describe('cuándo se anuncia', () => {
  it('una sesión activa o esperando sí se anuncia', () => {
    expect(isSessionOpen(ses({ status: 'ACTIVE' }))).toBe(true)
    expect(isSessionOpen(ses({ status: 'WAITING' }))).toBe(true)
  })

  it('una sesión terminada no', () => {
    expect(isSessionOpen(ses({ status: 'FINISHED' }))).toBe(false)
  })

  it('sin sesión no hay nada que anunciar', () => {
    expect(isSessionOpen(null)).toBe(false)
    expect(isSessionOpen(undefined)).toBe(false)
    expect(isSessionOpen({} as LiveSessionLike)).toBe(false)
  })
})

describe('textos', () => {
  it('usa el glosario del proyecto, no anglicismos', () => {
    const enVivo = liveSessionCopy(ses({ deliveryMode: 'SYNC', activity: { title: 'Quiz de fracciones' } }), 'estudiante')
    expect(enVivo.titulo).toContain('en vivo')
    expect(enVivo.titulo.toLowerCase()).not.toContain('live')
    expect(enVivo.cta).toBe('Entrar ahora')
  })

  it('el docente puede volver a su propia sesión en vivo', () => {
    // Hoy solo se le avisa del modo "en casa": si recarga durante un quiz en vivo, lo pierde.
    const c = liveSessionCopy(ses({ deliveryMode: 'SYNC' }), 'docente')
    expect(c.cta).toBe('Volver a la sesión')
  })

  it('el quiz en casa se anuncia sin prisa, porque no la tiene', () => {
    const alumno = liveSessionCopy(ses({ deliveryMode: 'ASYNC_HOME' }), 'estudiante')
    expect(alumno.detalle).toContain('a tu ritmo')
    expect(alumno.cta).toBe('Continuar')
  })

  it('sin título de actividad los textos siguen teniendo sentido', () => {
    const c = liveSessionCopy(ses({ deliveryMode: 'SYNC', activity: null }), 'estudiante')
    expect(c.detalle).toBe('Tu profe ya empezó.')
  })
})
