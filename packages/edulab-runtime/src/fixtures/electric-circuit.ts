import type { ExperienceDefinition, Intent, JsonValue, ValueExpression } from '../contracts.js';
import { EDULAB_ENGINE_VERSION } from '../constants.js';

const literal = (value: JsonValue): ValueExpression => ({ literal: value });
const state = (path: string): ValueExpression => ({ source: 'state', path });
const generated = (path: string): ValueExpression => ({ source: 'generated', path });

export const electricCircuitFixture: ExperienceDefinition = {
  schemaVersion: 'edulab.experience/1',
  definitionId: 'fixture.edulab.electric-circuit',
  version: 1,
  engineVersion: EDULAB_ENGINE_VERSION,
  title: 'Circuito eléctrico mínimo',
  supportedModes: ['EXPLORE'],
  requiredCapabilities: ['inspect', 'actuate'],
  initialWorld: {
    circuit: { powered: false, overload: false, heat: 0 },
    evidence: [],
  },
  objects: [
    { id: 'meter', type: 'meter', initialState: { calibrated: true }, affordances: ['inspect'] },
    { id: 'main-breaker', type: 'breaker', initialState: { closed: false }, affordances: ['actuate'] },
    { id: 'unsafe-bypass', type: 'bypass', initialState: { active: false }, affordances: ['actuate'] },
    { id: 'reset', type: 'reset', initialState: { ready: true }, affordances: ['actuate'] },
    { id: 'status-panel', type: 'panel', initialState: { ready: true }, affordances: ['inspect'] },
  ],
  generation: {
    variables: [{ key: 'faultyBranch', options: ['branch-left', 'branch-right'] }],
  },
  objectives: [
    {
      id: 'restore-power',
      statement: 'Restablece el circuito y demuestra que verificaste la tensión.',
      achieved: { op: 'eq', left: state('world.circuit.powered'), right: literal(true) },
      demonstrates: { op: 'contains', collection: state('world.evidence'), value: literal('voltage-confirmed') },
    },
  ],
  rules: [
    {
      id: 'measure-voltage',
      on: 'inspect',
      targets: ['meter'],
      effects: [
        { type: 'addToSet', path: 'world.evidence', value: literal('voltage-confirmed') },
        { type: 'advanceClock', ticks: 1 },
        {
          type: 'emit',
          eventType: 'voltage.measured',
          subjectId: literal('meter'),
          payload: { faultyBranch: generated('faultyBranch') },
        },
        {
          type: 'diagnose',
          verdict: 'correct',
          code: 'ELECTRIC.EVIDENCE.VOLTAGE_CONFIRMED',
          message: 'La medición identifica la rama que requiere aislamiento.',
          recoverable: true,
        },
      ],
    },
    {
      id: 'restore-main-breaker',
      on: 'actuate',
      targets: ['main-breaker'],
      when: { op: 'eq', left: state('world.circuit.overload'), right: literal(false) },
      effects: [
        { type: 'set', path: 'world.circuit.powered', value: literal(true) },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'circuit.powered', subjectId: literal('main-breaker') },
        {
          type: 'diagnose',
          verdict: 'correct',
          code: 'ELECTRIC.CONTROL.POWER_RESTORED',
          message: 'El circuito vuelve a suministrar energía.',
          recoverable: true,
        },
      ],
    },
    {
      id: 'unsafe-bypass-overloads',
      on: 'actuate',
      targets: ['unsafe-bypass'],
      effects: [
        { type: 'set', path: 'world.circuit.overload', value: literal(true) },
        { type: 'set', path: 'world.circuit.powered', value: literal(false) },
        { type: 'increment', path: 'world.circuit.heat', amount: literal(2) },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'circuit.overloaded', subjectId: literal('unsafe-bypass') },
        {
          type: 'diagnose',
          verdict: 'unsafe',
          code: 'ELECTRIC.CONTROL.UNSAFE_BYPASS',
          message: 'El puente elevó la temperatura y dejó el circuito sin energía.',
          recoverable: true,
        },
      ],
    },
    {
      id: 'reset-overload',
      on: 'actuate',
      targets: ['reset'],
      when: { op: 'eq', left: state('world.circuit.overload'), right: literal(true) },
      effects: [
        { type: 'set', path: 'world.circuit.overload', value: literal(false) },
        { type: 'set', path: 'world.circuit.heat', value: literal(0) },
        { type: 'advanceClock', ticks: 1 },
        { type: 'checkpoint', checkpointId: 'overload-recovered' },
        { type: 'emit', eventType: 'circuit.recovered', subjectId: literal('reset') },
        {
          type: 'diagnose',
          verdict: 'alternative',
          code: 'ELECTRIC.RECOVERY.RESET',
          message: 'La sobrecarga quedó restablecida; ya puedes elegir una acción segura.',
          recoverable: true,
        },
      ],
    },
    {
      id: 'finish-circuit',
      on: 'inspect',
      targets: ['status-panel'],
      when: {
        op: 'all',
        conditions: [
          { op: 'eq', left: state('objectives.restore-power.achieved'), right: literal(true) },
          { op: 'eq', left: state('objectives.restore-power.demonstrated'), right: literal(true) },
        ],
      },
      effects: [
        { type: 'emit', eventType: 'system.restored', payload: { ending: literal('restored') } },
        { type: 'finish', endingId: 'restored' },
      ],
    },
  ],
  endings: [{ id: 'restored', label: 'Circuito restaurado con evidencia' }],
};

export function electricIntent(
  intentId: string,
  expectedVersion: number,
  primitive: Intent['primitive'],
  targetId: string,
): Intent {
  return { intentId, attemptId: 'attempt-electric', expectedVersion, primitive, targetId };
}
