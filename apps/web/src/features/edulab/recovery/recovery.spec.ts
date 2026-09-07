import { describe, expect, it } from 'vitest'
import { applyIntent, createAttempt, type AttemptState, type DomainEvent } from '@edusyn/edulab-runtime'
import { fugaIntent, fugaLaboratorioDefinition } from '../fuga/definition'
import { createLocalAttemptRecord, outboxRecords, recoverLocalAttempt } from './recovery'

function progressedAttempt(): { state: AttemptState; intents: ReturnType<typeof fugaIntent>[]; events: DomainEvent[] } {
  let state = createAttempt(fugaLaboratorioDefinition, {
    attemptId: 'local-fuga-attempt',
    mode: 'EXPLORE',
    seed: 'recovery-seed',
  })
  const intents = [
    fugaIntent(0, 'actuate', 'alarm'),
    fugaIntent(1, 'actuate', 'access-door'),
    fugaIntent(2, 'actuate', 'remote-control'),
    fugaIntent(3, 'inspect', 'sensor-ph'),
  ]
  const events: DomainEvent[] = []
  for (const intent of intents) {
    const result = applyIntent(fugaLaboratorioDefinition, state, intent)
    expect(result.accepted).toBe(true)
    state = result.state
    events.push(...result.events)
  }
  return { state, intents, events }
}

describe('EduLab local attempt recovery', () => {
  it('rebuilds a trusted state from accepted intents', () => {
    const attempt = progressedAttempt()
    const recovered = recoverLocalAttempt(
      fugaLaboratorioDefinition,
      createLocalAttemptRecord(attempt.state, attempt.intents),
    )
    expect(recovered.ok).toBe(true)
    if (recovered.ok) {
      expect(recovered.attempt.state).toEqual(attempt.state)
      expect(recovered.attempt.events).toEqual(attempt.events)
    }
  })

  it('rejects a tampered state hash', () => {
    const attempt = progressedAttempt()
    const record = createLocalAttemptRecord(attempt.state, attempt.intents)
    expect(recoverLocalAttempt(fugaLaboratorioDefinition, { ...record, stateHash: 'tampered' })).toEqual({
      ok: false,
      reason: 'STATE_MISMATCH',
    })
  })

  it('rejects an incompatible definition reference', () => {
    const attempt = progressedAttempt()
    const record = createLocalAttemptRecord(attempt.state, attempt.intents)
    expect(recoverLocalAttempt(fugaLaboratorioDefinition, {
      ...record,
      definition: { ...record.definition, definitionVersion: record.definition.definitionVersion + 1 },
    })).toEqual({ ok: false, reason: 'DEFINITION_MISMATCH' })
  })

  it('rejects an incompatible engine version', () => {
    const attempt = progressedAttempt()
    const record = createLocalAttemptRecord(attempt.state, attempt.intents)
    expect(recoverLocalAttempt(fugaLaboratorioDefinition, {
      ...record,
      definition: { ...record.definition, engineVersion: 'edulab-engine/999' },
    })).toEqual({ ok: false, reason: 'ENGINE_MISMATCH' })
  })

  it('rejects a replay containing a rejected intent', () => {
    const attempt = progressedAttempt()
    const record = createLocalAttemptRecord(attempt.state, attempt.intents)
    const invalidSequence = record.acceptedIntents.map((intent, index) => index === 1 ? { ...intent, expectedVersion: 99 } : intent)
    expect(recoverLocalAttempt(fugaLaboratorioDefinition, { ...record, acceptedIntents: invalidSequence })).toEqual({
      ok: false,
      reason: 'REPLAY_REJECTED',
    })
  })

  it('deduplicates outbox events by semantic event id and keeps sequence order', () => {
    const attempt = progressedAttempt()
    const records = outboxRecords([...attempt.events.slice().reverse(), ...attempt.events])
    expect(records.map((record) => record.eventId)).toEqual([...new Set(attempt.events.map((event) => event.eventId))])
    expect(records.map((record) => record.sequence)).toEqual(records.map((record) => record.sequence).slice().sort((a, b) => a - b))
  })
})
