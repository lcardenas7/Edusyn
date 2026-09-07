import { describe, expect, it } from 'vitest'
import {
  applyIntent,
  canonicalReplayEvidence,
  createAttempt,
  replay,
  validateDefinition,
  type AttemptState,
  type Intent,
} from '@edusyn/edulab-runtime'
import { fugaIntent, fugaLaboratorioDefinition, incidentFromGenerated } from './definition'

function start(seed = 'fuga-test-seed'): AttemptState {
  return createAttempt(fugaLaboratorioDefinition, {
    attemptId: 'local-fuga-attempt',
    mode: 'GUIDED_PRACTICE',
    seed,
  })
}

function step(state: AttemptState, primitive: Intent['primitive'], targetId: string, payload?: Intent['payload']) {
  return applyIntent(
    fugaLaboratorioDefinition,
    state,
    fugaIntent(state.version, primitive, targetId, payload),
  )
}

function safeSetup(state: AttemptState): AttemptState {
  state = step(state, 'actuate', 'alarm').state
  state = step(state, 'actuate', 'access-door').state
  return step(state, 'actuate', 'remote-control').state
}

function completeIntents(seed: string): Intent[] {
  const initial = start(seed)
  const incident = incidentFromGenerated(initial.generated.incident)
  return [
    fugaIntent(0, 'actuate', 'alarm'),
    fugaIntent(1, 'actuate', 'access-door'),
    fugaIntent(2, 'actuate', 'remote-control'),
    fugaIntent(3, 'inspect', 'sds-terminal'),
    fugaIntent(4, 'inspect', 'sensor-ph'),
    fugaIntent(5, 'inspect', 'circuit-tracer'),
    fugaIntent(6, 'input', 'evidence-log', { profile: incident.profile, circuit: incident.circuit }),
    fugaIntent(7, 'actuate', incident.circuit),
    fugaIntent(8, 'actuate', incident.containment),
    fugaIntent(9, 'inspect', 'verification-sensor'),
    fugaIntent(10, 'input', 'explanation-console', { causalLink: true }),
    fugaIntent(11, 'inspect', 'status-panel'),
  ]
}

describe('Fuga en el laboratorio', () => {
  it('passes structural and semantic publication validation', () => {
    expect(validateDefinition(fugaLaboratorioDefinition)).toEqual({ valid: true, structural: [], semantic: [] })
  })

  it('completes a supported evidence route with all objectives demonstrated', () => {
    const seed = 'fuga-complete'
    const result = replay(fugaLaboratorioDefinition, {
      attemptId: 'local-fuga-attempt', mode: 'GUIDED_PRACTICE', seed,
    }, completeIntents(seed))
    expect(result.state.status).toBe('COMPLETED')
    expect(result.state.endingId).toBe('contained_and_explained')
    expect(Object.values(result.state.objectives).every((objective) => objective.demonstrated)).toBe(true)
    expect(result.events.map((event) => event.type)).toEqual(expect.arrayContaining([
      'zone.alerted', 'evidence.collected', 'hypothesis.supported', 'valve.closed',
      'spill.contained', 'hazard.verified_stable', 'mission.completed',
    ]))
  })

  it('replays the complete route deterministically', () => {
    const seed = 'fuga-replay'
    const options = { attemptId: 'local-fuga-attempt', mode: 'EXPLORE' as const, seed }
    const intents = completeIntents(seed)
    const first = replay(fugaLaboratorioDefinition, options, intents)
    const second = replay(fugaLaboratorioDefinition, options, intents)
    expect(first.stateHash).toBe(second.stateHash)
    expect(canonicalReplayEvidence(first)).toBe(canonicalReplayEvidence(second))
  })

  it('keeps accidental control separate from demonstrated understanding', () => {
    let state = safeSetup(start('fuga-accidental'))
    const incident = incidentFromGenerated(state.generated.incident)
    state = step(state, 'actuate', incident.circuit).state
    state = step(state, 'actuate', incident.containment).state
    expect(state.objectives['control-leak']).toEqual({ achieved: true, demonstrated: false })
    expect(state.objectives['identify-source']).toEqual({ achieved: false, demonstrated: false })
    const prematureClose = step(state, 'inspect', 'status-panel')
    expect(prematureClose.accepted).toBe(false)
    expect(prematureClose.state.status).toBe('ACTIVE')
  })

  it('changes the world after a wrong circuit and permits recovery', () => {
    let state = safeSetup(start('fuga-recovery'))
    const incident = incidentFromGenerated(state.generated.incident)
    const wrongCircuit = ['circuit-a', 'circuit-b', 'circuit-c', 'circuit-d'].find((id) => id !== incident.circuit)!
    const wrong = step(state, 'actuate', wrongCircuit)
    expect(wrong.state.world).toMatchObject({ leak: { active: true, pressure: 3 }, spill: { spread: 3 } })
    expect(wrong.diagnoses[0]).toMatchObject({ verdict: 'incorrect', recoverable: true })
    const recovered = step(wrong.state, 'actuate', 'relief-control')
    expect(recovered.state.world).toMatchObject({ leak: { pressure: 1 } })
    expect(recovered.state.checkpointId).toBe('pressure-recovered')
  })

  it('makes unsafe early investigation visible and recoverable', () => {
    const initial = start('fuga-unsafe-order')
    const unsafe = step(initial, 'inspect', 'sensor-ph')
    expect(unsafe.state.world).toMatchObject({ zone: { exposure: 1 }, spill: { spread: 3 } })
    expect(unsafe.events[0]?.type).toBe('unsafe_investigation.attempted')
    expect(unsafe.diagnoses[0]?.verdict).toBe('unsafe')
    const secured = safeSetup(unsafe.state)
    expect(secured.objectives['secure-zone']).toEqual({ achieved: true, demonstrated: true })
    expect(secured.world).toMatchObject({ intervention: { hadRecovery: true } })
  })

  it('supports the safe escalation ending without pretending scientific completion', () => {
    let state = start('fuga-escalation')
    state = step(state, 'actuate', 'alarm').state
    state = step(state, 'actuate', 'access-door').state
    const escalated = step(state, 'actuate', 'supervisor-channel')
    expect(escalated.state.status).toBe('COMPLETED')
    expect(escalated.state.endingId).toBe('safe_escalation')
    expect(escalated.state.objectives['identify-source']?.achieved).toBe(false)
  })
})
