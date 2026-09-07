import {
  createAttempt,
  definitionHash,
  replay,
  stateHash,
  type AttemptMode,
  type AttemptState,
  type DefinitionReference,
  type Diagnosis,
  type DomainEvent,
  type ExperienceDefinition,
  type Intent,
} from '@edusyn/edulab-runtime'

export const EDULAB_LOCAL_RECORD_VERSION = 1 as const

export interface LocalAttemptRecord {
  recordVersion: typeof EDULAB_LOCAL_RECORD_VERSION
  attemptId: string
  definition: DefinitionReference
  mode: AttemptMode
  seed: string
  acceptedIntents: Intent[]
  stateHash: string
  logicalTick: number
  status: AttemptState['status']
}

export interface RecoveredAttempt {
  state: AttemptState
  acceptedIntents: Intent[]
  diagnoses: Diagnosis[]
  events: DomainEvent[]
}

export type RecoveryResult =
  | { ok: true; attempt: RecoveredAttempt }
  | { ok: false; reason: 'INVALID_RECORD' | 'DEFINITION_MISMATCH' | 'ENGINE_MISMATCH' | 'REPLAY_REJECTED' | 'STATE_MISMATCH' }

export interface OutboxRecord {
  eventId: string
  attemptId: string
  sequence: number
  event: DomainEvent
}

export function createLocalAttemptRecord(state: AttemptState, acceptedIntents: Intent[]): LocalAttemptRecord {
  return {
    recordVersion: EDULAB_LOCAL_RECORD_VERSION,
    attemptId: state.attemptId,
    definition: { ...state.definition },
    mode: state.mode,
    seed: state.seed,
    acceptedIntents: acceptedIntents.map((intent) => structuredClone(intent)),
    stateHash: stateHash(state),
    logicalTick: state.logicalTick,
    status: state.status,
  }
}

function isLocalAttemptRecord(value: unknown): value is LocalAttemptRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Partial<LocalAttemptRecord>
  return record.recordVersion === EDULAB_LOCAL_RECORD_VERSION
    && typeof record.attemptId === 'string'
    && typeof record.seed === 'string'
    && typeof record.stateHash === 'string'
    && Number.isSafeInteger(record.logicalTick)
    && Array.isArray(record.acceptedIntents)
    && !!record.definition
}

export function recoverLocalAttempt(definition: ExperienceDefinition, value: unknown): RecoveryResult {
  if (!isLocalAttemptRecord(value)) return { ok: false, reason: 'INVALID_RECORD' }

  let initial: AttemptState
  try {
    initial = createAttempt(definition, {
      attemptId: value.attemptId,
      mode: value.mode,
      seed: value.seed,
    })
  } catch {
    return { ok: false, reason: 'INVALID_RECORD' }
  }

  if (value.definition.definitionId !== definition.definitionId
    || value.definition.definitionVersion !== definition.version
    || value.definition.definitionHash !== definitionHash(definition)) {
    return { ok: false, reason: 'DEFINITION_MISMATCH' }
  }
  if (value.definition.engineVersion !== initial.definition.engineVersion) {
    return { ok: false, reason: 'ENGINE_MISMATCH' }
  }

  let rebuilt
  try {
    rebuilt = replay(definition, {
      attemptId: value.attemptId,
      mode: value.mode,
      seed: value.seed,
    }, value.acceptedIntents)
  } catch {
    return { ok: false, reason: 'REPLAY_REJECTED' }
  }

  if (rebuilt.state.decisionSequence !== value.acceptedIntents.length) {
    return { ok: false, reason: 'REPLAY_REJECTED' }
  }
  if (rebuilt.stateHash !== value.stateHash || rebuilt.state.logicalTick !== value.logicalTick) {
    return { ok: false, reason: 'STATE_MISMATCH' }
  }

  return {
    ok: true,
    attempt: {
      state: rebuilt.state,
      acceptedIntents: value.acceptedIntents.map((intent) => structuredClone(intent)),
      diagnoses: rebuilt.diagnoses,
      events: rebuilt.events,
    },
  }
}

export function outboxRecords(events: DomainEvent[]): OutboxRecord[] {
  const byEventId = new Map<string, OutboxRecord>()
  for (const event of events) {
    byEventId.set(event.eventId, {
      eventId: event.eventId,
      attemptId: event.attemptId,
      sequence: event.sequence,
      event: structuredClone(event),
    })
  }
  return [...byEventId.values()].sort((left, right) => left.sequence - right.sequence || left.eventId.localeCompare(right.eventId))
}
