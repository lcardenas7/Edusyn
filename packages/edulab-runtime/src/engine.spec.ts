import { describe, expect, it } from 'vitest';
import type { AttemptState, Intent } from './contracts.js';
import {
  applyIntent,
  canonicalReplayEvidence,
  createAttempt,
  replay,
  stateHash,
} from './engine.js';
import { electricCircuitFixture, electricIntent } from './fixtures/electric-circuit.js';
import { microLabFixture, microLabIntent } from './fixtures/micro-lab.js';
import { validateDefinition } from './validator.js';

function generatedString(state: AttemptState, key: string): string {
  const value = state.generated[key];
  if (typeof value !== 'string') throw new Error(`Expected generated string at ${key}.`);
  return value;
}

function microReplayIntents(seed: string): Intent[] {
  const initial = createAttempt(microLabFixture, {
    attemptId: 'attempt-micro-lab',
    mode: 'EXPLORE',
    seed,
  });
  const leakingValve = generatedString(initial, 'leakingValve');
  return [
    microLabIntent('inspect-source', 0, 'inspect', 'source-sensor'),
    microLabIntent('close-source', 1, 'actuate', leakingValve),
    microLabIntent('finish', 2, 'inspect', 'status-panel'),
  ];
}

describe('deterministic simulation engine', () => {
  it.each([
    ['micro laboratory', microLabFixture],
    ['electric circuit', electricCircuitFixture],
  ])('runs the same validated runtime contract for %s', (_name, definition) => {
    expect(validateDefinition(definition).valid).toBe(true);
    const state = createAttempt(definition, {
      attemptId: definition === microLabFixture ? 'attempt-micro-lab' : 'attempt-electric',
      mode: 'EXPLORE',
      seed: 'shared-runtime-seed',
    });
    expect(state.definition.definitionId).toBe(definition.definitionId);
    expect(state.status).toBe('ACTIVE');
  });

  it('replays identical input to identical state, diagnoses and events', () => {
    const options = { attemptId: 'attempt-micro-lab', mode: 'EXPLORE' as const, seed: 'replay-seed' };
    const intents = microReplayIntents(options.seed);
    const first = replay(microLabFixture, options, intents);
    const second = replay(microLabFixture, options, intents);

    expect(first.stateHash).toBe(second.stateHash);
    expect(first.state.status).toBe('COMPLETED');
    expect(canonicalReplayEvidence(first)).toBe(canonicalReplayEvidence(second));
  });

  it('uses the seed deterministically and lets it change generated state', () => {
    const byOutcome = new Map<string, AttemptState>();
    for (let index = 0; index < 32; index += 1) {
      const state = createAttempt(microLabFixture, {
        attemptId: 'attempt-micro-lab', mode: 'EXPLORE', seed: `seed-${index}`,
      });
      byOutcome.set(generatedString(state, 'leakingValve'), state);
    }
    expect([...byOutcome.keys()].sort()).toEqual(['valve-a', 'valve-b']);
    const [left, right] = [...byOutcome.values()];
    expect(stateHash(left!)).not.toBe(stateHash(right!));
  });

  it('separates reaching an outcome from demonstrating understanding', () => {
    const initial = createAttempt(microLabFixture, {
      attemptId: 'attempt-micro-lab', mode: 'EXPLORE', seed: 'accidental-success',
    });
    const leakingValve = generatedString(initial, 'leakingValve');
    const accidental = applyIntent(
      microLabFixture,
      initial,
      microLabIntent('accidental-close', 0, 'actuate', leakingValve),
    );

    expect(accidental.accepted).toBe(true);
    expect(accidental.state.objectives['control-leak']).toEqual({ achieved: true, demonstrated: false });
    expect(accidental.frame.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'world.leak.active', before: true, after: false }),
    ]));
    expect(accidental.events.map((event) => event.type)).toContain('objective.achieved');

    const evidenced = applyIntent(
      microLabFixture,
      accidental.state,
      microLabIntent('inspect-afterward', 1, 'inspect', 'source-sensor'),
    );
    expect(evidenced.state.objectives['control-leak']).toEqual({ achieved: true, demonstrated: true });
    expect(evidenced.events.map((event) => event.type)).toContain('objective.demonstrated');
  });

  it('turns an incorrect action into a recoverable world consequence', () => {
    const initial = createAttempt(microLabFixture, {
      attemptId: 'attempt-micro-lab', mode: 'GUIDED_PRACTICE', seed: 'recovery-seed',
    });
    const leakingValve = generatedString(initial, 'leakingValve');
    const wrongValve = leakingValve === 'valve-a' ? 'valve-b' : 'valve-a';
    const wrong = applyIntent(
      microLabFixture,
      initial,
      microLabIntent('wrong-valve', 0, 'actuate', wrongValve),
    );

    expect(wrong.accepted).toBe(true);
    expect(wrong.state.world.pressure).toBe(3);
    expect((wrong.state.world.leak as { active: boolean }).active).toBe(true);
    expect(wrong.diagnoses[0]).toMatchObject({ verdict: 'incorrect', recoverable: true });
    expect(wrong.events.map((event) => event.type)).toContain('pressure.increased');

    const recovered = applyIntent(
      microLabFixture,
      wrong.state,
      microLabIntent('relieve', 1, 'actuate', 'relief-vent'),
    );
    expect(recovered.state.world.pressure).toBe(1);
    expect(recovered.state.checkpointId).toBe('pressure-recovered');
    expect(recovered.events.map((event) => event.type)).toContain('pressure.stabilized');
  });

  it('rejects an invalid intent without mutating or advancing state', () => {
    const initial = createAttempt(microLabFixture, {
      attemptId: 'attempt-micro-lab', mode: 'EXPLORE', seed: 'invalid-intent',
    });
    const invalid = applyIntent(microLabFixture, initial, {
      intentId: 'unknown', attemptId: initial.attemptId, expectedVersion: 0,
      primitive: 'actuate', targetId: 'object-that-does-not-exist',
    });
    expect(invalid.accepted).toBe(false);
    expect(invalid.diagnoses[0]?.code).toBe('ENGINE.TARGET_UNKNOWN');
    expect(invalid.stateHash).toBe(stateHash(initial));
    expect(invalid.events).toEqual([]);
  });

  it('rejects non-deterministic numeric input at the intent boundary', () => {
    const initial = createAttempt(microLabFixture, {
      attemptId: 'attempt-micro-lab', mode: 'EXPLORE', seed: 'invalid-number',
    });
    const invalid = applyIntent(microLabFixture, initial, {
      intentId: 'fractional', attemptId: initial.attemptId, expectedVersion: 0,
      primitive: 'inspect', targetId: 'source-sensor', payload: { reading: 1.5 },
    });
    expect(invalid.accepted).toBe(false);
    expect(invalid.diagnoses[0]?.code).toBe('ENGINE.INTENT_INVALID');
    expect(invalid.stateHash).toBe(stateHash(initial));
  });

  it('changes replay evidence when an ordered intent changes', () => {
    const options = { attemptId: 'attempt-electric', mode: 'EXPLORE' as const, seed: 'electric-seed' };
    const safe = replay(electricCircuitFixture, options, [
      electricIntent('measure', 0, 'inspect', 'meter'),
      electricIntent('power', 1, 'actuate', 'main-breaker'),
    ]);
    const unsafe = replay(electricCircuitFixture, options, [
      electricIntent('bypass', 0, 'actuate', 'unsafe-bypass'),
      electricIntent('reset', 1, 'actuate', 'reset'),
    ]);
    expect(safe.stateHash).not.toBe(unsafe.stateHash);
    expect(canonicalReplayEvidence(safe)).not.toBe(canonicalReplayEvidence(unsafe));
  });

  it('refuses to execute a definition that fails validation', () => {
    const invalid = structuredClone(microLabFixture) as unknown as Record<string, unknown>;
    invalid.endings = [];
    expect(() => createAttempt(invalid, {
      attemptId: 'attempt-invalid', mode: 'EXPLORE', seed: 'invalid',
    })).toThrow(/Invalid EduLab definition/);
  });
});
