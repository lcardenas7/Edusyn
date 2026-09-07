import type {
  AttemptState,
  Condition,
  Diagnosis,
  DomainEvent,
  EffectDefinition,
  EngineStepResult,
  ExperienceDefinition,
  Frame,
  Intent,
  JsonObject,
  JsonValue,
  ObjectiveState,
  ReplayResult,
  RuleDefinition,
  StateChange,
  ValueExpression,
} from './contracts.js';
import { canonicalStringify, cloneJson, compareText, hashCanonical, jsonEquals } from './canonical.js';
import { evaluateCondition, resolveValue, type EvaluationContext } from './conditions.js';
import { EDULAB_ENGINE_VERSION, PRIMITIVES } from './constants.js';
import { createDeterministicPrng } from './prng.js';
import { assertValidDefinition } from './validator.js';

export interface CreateAttemptOptions {
  attemptId: string;
  mode: AttemptState['mode'];
  seed: string;
}

function asJson(value: unknown): JsonValue {
  return value as JsonValue;
}

function stateView(state: AttemptState): JsonObject {
  return state as unknown as JsonObject;
}

function isDeterministicJson(value: unknown, depth = 0): value is JsonValue {
  if (depth > 32) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isSafeInteger(value);
  if (Array.isArray(value)) return value.every((item) => isDeterministicJson(item, depth + 1));
  if (typeof value !== 'object') return false;
  return Object.values(value).every((item) => isDeterministicJson(item, depth + 1));
}

function isIntent(value: unknown): value is Intent {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.intentId === 'string'
    && candidate.intentId.trim().length > 0
    && typeof candidate.attemptId === 'string'
    && candidate.attemptId.trim().length > 0
    && Number.isSafeInteger(candidate.expectedVersion)
    && Number(candidate.expectedVersion) >= 0
    && PRIMITIVES.includes(candidate.primitive as Intent['primitive'])
    && (candidate.targetId === undefined || (typeof candidate.targetId === 'string' && candidate.targetId.trim().length > 0))
    && (candidate.payload === undefined || isDeterministicJson(candidate.payload));
}

export function definitionHash(definition: ExperienceDefinition): string {
  return hashCanonical(asJson(definition));
}

export function stateHash(state: AttemptState): string {
  return hashCanonical(asJson(state));
}

function generatedVariables(definition: ExperienceDefinition, seed: string): JsonObject {
  const generated: JsonObject = {};
  const prng = createDeterministicPrng(`${definition.definitionId}@${definition.version}:${seed}`);
  const variables = [...(definition.generation?.variables ?? [])].sort((left, right) => compareText(left.key, right.key));
  for (const variable of variables) {
    generated[variable.key] = cloneJson(variable.options[prng.nextInt(variable.options.length)]!);
  }
  return generated;
}

function initialWorld(definition: ExperienceDefinition): JsonObject {
  const world = cloneJson(definition.initialWorld);
  const objects: JsonObject = {};
  for (const object of [...definition.objects].sort((left, right) => compareText(left.id, right.id))) {
    objects[object.id] = cloneJson(object.initialState);
  }
  world.objects = objects;
  return world;
}

function frameFor(state: AttemptState, effects: StateChange[], feedback: Diagnosis[]): Frame {
  const objectives: Record<string, ObjectiveState> = {};
  for (const [id, objective] of Object.entries(state.objectives)) objectives[id] = { ...objective };
  return {
    world: cloneJson(state.world),
    effects: effects.map((effect) => ({
      path: effect.path,
      before: effect.before === undefined ? undefined : cloneJson(effect.before),
      after: effect.after === undefined ? undefined : cloneJson(effect.after),
    })),
    feedback: feedback.map((item) => ({ ...item })),
    hud: {
      logicalTick: state.logicalTick,
      status: state.status,
      endingId: state.endingId,
      objectives,
    },
  };
}

function contextFor(state: AttemptState, intent: Intent): EvaluationContext {
  return { state: stateView(state), intent, generated: state.generated };
}

function refreshObjectives(
  definition: ExperienceDefinition,
  state: AttemptState,
  intent: Intent,
  changes: StateChange[],
  events: DomainEvent[],
): void {
  for (const objective of definition.objectives) {
    const current = state.objectives[objective.id]!;
    const context = contextFor(state, intent);
    if (!current.achieved && evaluateCondition(objective.achieved, context)) {
      current.achieved = true;
      changes.push({ path: `objectives.${objective.id}.achieved`, before: false, after: true });
      events.push(makeEvent(state, intent, 'objective.achieved', { objectiveId: objective.id }));
    }
    if (!current.demonstrated && evaluateCondition(objective.demonstrates, context)) {
      current.demonstrated = true;
      changes.push({ path: `objectives.${objective.id}.demonstrated`, before: false, after: true });
      events.push(makeEvent(state, intent, 'objective.demonstrated', { objectiveId: objective.id }));
    }
  }
}

function makeEvent(
  state: AttemptState,
  intent: Intent,
  type: string,
  payload: JsonObject,
  subjectId?: JsonValue,
): DomainEvent {
  state.eventSequence += 1;
  return {
    eventId: `${state.attemptId}:${state.eventSequence}`,
    attemptId: state.attemptId,
    sequence: state.eventSequence,
    logicalTick: state.logicalTick,
    type,
    ...(subjectId === undefined ? {} : { subjectId: cloneJson(subjectId) }),
    payload: cloneJson(payload),
    causationId: intent.intentId,
    correlationId: state.attemptId,
  };
}

function orderedRules(rules: RuleDefinition[]): RuleDefinition[] {
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const remaining = new Map(rules.map((rule) => [rule.id, new Set(rule.after ?? [])]));
  const ordered: RuleDefinition[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining.entries()]
      .filter(([, dependencies]) => dependencies.size === 0)
      .map(([id]) => id)
      .sort(compareText);
    if (ready.length === 0) throw new Error('Rule ordering contains a cycle.');
    for (const id of ready) {
      ordered.push(byId.get(id)!);
      remaining.delete(id);
      for (const dependencies of remaining.values()) dependencies.delete(id);
    }
  }
  return ordered;
}

function getPath(root: unknown, path: string): JsonValue | undefined {
  let current: unknown = root;
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current as JsonValue | undefined;
}

function setPath(root: JsonObject, path: string, value: JsonValue): void {
  const segments = path.split('.');
  const final = segments.pop();
  if (!final) throw new Error(`Invalid mutation path: ${path}.`);
  let current: JsonObject = root;
  for (const segment of segments) {
    const next = current[segment];
    if (next === undefined) {
      const created: JsonObject = {};
      current[segment] = created;
      current = created;
    } else if (next !== null && typeof next === 'object' && !Array.isArray(next)) {
      current = next;
    } else {
      throw new Error(`Mutation path crosses a non-object: ${path}.`);
    }
  }
  current[final] = cloneJson(value);
}

function recordMutation(
  state: AttemptState,
  path: string,
  value: JsonValue,
  changes: StateChange[],
): void {
  const before = getPath(stateView(state), path);
  if (jsonEquals(before, value)) return;
  setPath(stateView(state), path, value);
  changes.push({
    path,
    before: before === undefined ? undefined : cloneJson(before),
    after: cloneJson(value),
  });
}

function resolvedPayload(
  values: Record<string, ValueExpression> | undefined,
  context: EvaluationContext,
): JsonObject {
  const payload: JsonObject = {};
  for (const [key, expression] of Object.entries(values ?? {}).sort(([left], [right]) => compareText(left, right))) {
    const value = resolveValue(expression, context);
    if (value !== undefined) payload[key] = cloneJson(value);
  }
  return payload;
}

function applyEffect(
  effect: EffectDefinition,
  state: AttemptState,
  intent: Intent,
  changes: StateChange[],
  diagnoses: Diagnosis[],
  events: DomainEvent[],
): void {
  const context = contextFor(state, intent);
  switch (effect.type) {
    case 'set': {
      const value = resolveValue(effect.value, context);
      if (value === undefined) throw new Error(`Set effect resolved undefined at ${effect.path}.`);
      recordMutation(state, effect.path, value, changes);
      break;
    }
    case 'increment': {
      const current = getPath(stateView(state), effect.path);
      const amount = resolveValue(effect.amount, context);
      if (typeof current !== 'number' || typeof amount !== 'number' || !Number.isSafeInteger(current) || !Number.isSafeInteger(amount)) {
        throw new Error(`Increment requires safe integers at ${effect.path}.`);
      }
      recordMutation(state, effect.path, current + amount, changes);
      break;
    }
    case 'addToSet':
    case 'removeFromSet': {
      const value = resolveValue(effect.value, context);
      const current = getPath(stateView(state), effect.path);
      if (value === undefined || !Array.isArray(current)) throw new Error(`${effect.type} requires an existing array at ${effect.path}.`);
      const next = effect.type === 'addToSet'
        ? current.some((item) => jsonEquals(item, value)) ? current : [...current, cloneJson(value)]
        : current.filter((item) => !jsonEquals(item, value));
      recordMutation(state, effect.path, next, changes);
      break;
    }
    case 'advanceClock':
      recordMutation(state, 'logicalTick', state.logicalTick + effect.ticks, changes);
      break;
    case 'emit': {
      const subjectId = effect.subjectId ? resolveValue(effect.subjectId, context) : undefined;
      events.push(makeEvent(state, intent, effect.eventType, resolvedPayload(effect.payload, context), subjectId));
      break;
    }
    case 'diagnose': {
      const at = effect.at ? resolveValue(effect.at, context) : undefined;
      diagnoses.push({
        verdict: effect.verdict,
        code: effect.code,
        message: effect.message,
        recoverable: effect.recoverable,
        ...(at === undefined ? {} : { at: cloneJson(at) }),
      });
      break;
    }
    case 'checkpoint':
      recordMutation(state, 'checkpointId', effect.checkpointId, changes);
      break;
    case 'achieve': {
      const objective = state.objectives[effect.objectiveId]!;
      if (!objective.achieved) {
        objective.achieved = true;
        changes.push({ path: `objectives.${effect.objectiveId}.achieved`, before: false, after: true });
        events.push(makeEvent(state, intent, 'objective.achieved', { objectiveId: effect.objectiveId }));
      }
      break;
    }
    case 'demonstrate': {
      const objective = state.objectives[effect.objectiveId]!;
      if (!objective.demonstrated) {
        objective.demonstrated = true;
        changes.push({ path: `objectives.${effect.objectiveId}.demonstrated`, before: false, after: true });
        events.push(makeEvent(state, intent, 'objective.demonstrated', { objectiveId: effect.objectiveId }));
      }
      break;
    }
    case 'finish':
      recordMutation(state, 'endingId', effect.endingId, changes);
      recordMutation(state, 'status', 'COMPLETED', changes);
      break;
  }
}

function rejectedResult(state: AttemptState, code: string, message: string, at?: JsonValue): EngineStepResult {
  const diagnosis: Diagnosis = {
    verdict: 'incomplete',
    code,
    message,
    recoverable: true,
    ...(at === undefined ? {} : { at }),
  };
  return {
    accepted: false,
    state: cloneJson(asJson(state)) as unknown as AttemptState,
    stateHash: stateHash(state),
    frame: frameFor(state, [], [diagnosis]),
    diagnoses: [diagnosis],
    events: [],
  };
}

export function createAttempt(definitionInput: unknown, options: CreateAttemptOptions): AttemptState {
  assertValidDefinition(definitionInput);
  const definition = definitionInput;
  if (!options.attemptId.trim()) throw new Error('attemptId is required.');
  if (!options.seed.trim()) throw new Error('seed is required.');
  if (!definition.supportedModes.includes(options.mode)) throw new Error(`Mode ${options.mode} is not supported.`);

  const objectives: Record<string, ObjectiveState> = {};
  for (const objective of definition.objectives) objectives[objective.id] = { achieved: false, demonstrated: false };
  return {
    attemptId: options.attemptId,
    definition: {
      definitionId: definition.definitionId,
      definitionVersion: definition.version,
      definitionHash: definitionHash(definition),
      engineVersion: EDULAB_ENGINE_VERSION,
    },
    mode: options.mode,
    seed: options.seed,
    generated: generatedVariables(definition, options.seed),
    world: initialWorld(definition),
    objectives,
    logicalTick: 0,
    version: 0,
    decisionSequence: 0,
    eventSequence: 0,
    checkpointId: null,
    status: 'ACTIVE',
    endingId: null,
  };
}

export function applyIntent(
  definitionInput: unknown,
  currentState: AttemptState,
  intentInput: unknown,
): EngineStepResult {
  assertValidDefinition(definitionInput);
  const definition = definitionInput;
  if (!isIntent(intentInput)) return rejectedResult(currentState, 'ENGINE.INTENT_INVALID', 'Intent contract is invalid.');
  const intent = intentInput;
  if (currentState.definition.definitionHash !== definitionHash(definition)) return rejectedResult(currentState, 'ENGINE.DEFINITION_MISMATCH', 'Attempt definition does not match runtime definition.');
  if (currentState.definition.engineVersion !== EDULAB_ENGINE_VERSION) return rejectedResult(currentState, 'ENGINE.VERSION_MISMATCH', 'Attempt engine version is not supported.');
  if (intent.attemptId !== currentState.attemptId) return rejectedResult(currentState, 'ENGINE.ATTEMPT_MISMATCH', 'Intent belongs to another attempt.');
  if (intent.expectedVersion !== currentState.version) return rejectedResult(currentState, 'ENGINE.VERSION_CONFLICT', 'Intent expected a different state version.');
  if (currentState.status !== 'ACTIVE') return rejectedResult(currentState, 'ENGINE.ATTEMPT_CLOSED', 'Attempt is already closed.');
  if (!definition.requiredCapabilities.includes(intent.primitive)) return rejectedResult(currentState, 'ENGINE.CAPABILITY_UNSUPPORTED', 'Intent capability is not supported.', intent.primitive);

  if (intent.targetId) {
    const object = definition.objects.find((candidate) => candidate.id === intent.targetId);
    if (!object) return rejectedResult(currentState, 'ENGINE.TARGET_UNKNOWN', 'Intent target does not exist.', intent.targetId);
    if (!object.affordances.includes(intent.primitive)) return rejectedResult(currentState, 'ENGINE.AFFORDANCE_UNSUPPORTED', 'Target does not support this intent.', intent.targetId);
  }

  const state = cloneJson(asJson(currentState)) as unknown as AttemptState;
  const changes: StateChange[] = [];
  const diagnoses: Diagnosis[] = [];
  const events: DomainEvent[] = [];
  const matching = orderedRules(definition.rules).filter((rule) => {
    if (rule.on !== intent.primitive) return false;
    if (rule.targets && (!intent.targetId || !rule.targets.includes(intent.targetId))) return false;
    return !rule.when || evaluateCondition(rule.when, contextFor(state, intent));
  });
  if (matching.length === 0) return rejectedResult(currentState, 'ENGINE.INTENT_UNHANDLED', 'No rule accepts this intent.', intent.targetId);

  try {
    for (const rule of matching) {
      for (const effect of rule.effects) applyEffect(effect, state, intent, changes, diagnoses, events);
    }
    refreshObjectives(definition, state, intent, changes, events);
    state.decisionSequence += 1;
    state.version += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown effect error.';
    return rejectedResult(currentState, 'ENGINE.EFFECT_INVALID', message);
  }

  return {
    accepted: true,
    state,
    stateHash: stateHash(state),
    frame: frameFor(state, changes, diagnoses),
    diagnoses,
    events,
  };
}

export function replay(
  definitionInput: unknown,
  options: CreateAttemptOptions,
  intents: Intent[],
): ReplayResult {
  let state = createAttempt(definitionInput, options);
  const diagnoses: Diagnosis[] = [];
  const events: DomainEvent[] = [];
  for (const intent of intents) {
    const result = applyIntent(definitionInput, state, intent);
    diagnoses.push(...result.diagnoses);
    events.push(...result.events);
    state = result.state;
  }
  return { state, stateHash: stateHash(state), diagnoses, events };
}

export function canonicalReplayEvidence(result: ReplayResult): string {
  return canonicalStringify(asJson({
    stateHash: result.stateHash,
    diagnoses: result.diagnoses,
    events: result.events,
  }));
}
