import type { ExperienceDefinition, Intent, JsonValue, ValueExpression } from '../contracts.js';
import { EDULAB_ENGINE_VERSION } from '../constants.js';

const literal = (value: JsonValue): ValueExpression => ({ literal: value });
const state = (path: string): ValueExpression => ({ source: 'state', path });
const intent = (path: string): ValueExpression => ({ source: 'intent', path });
const generated = (path: string): ValueExpression => ({ source: 'generated', path });

export const microLabFixture: ExperienceDefinition = {
  schemaVersion: 'edulab.experience/1',
  definitionId: 'fixture.edulab.micro-lab-leak',
  version: 1,
  engineVersion: EDULAB_ENGINE_VERSION,
  title: 'Micro-laboratorio: fuga mínima',
  supportedModes: ['EXPLORE', 'GUIDED_PRACTICE'],
  requiredCapabilities: ['inspect', 'actuate'],
  initialWorld: {
    leak: { active: true, rate: 3 },
    pressure: 1,
    evidence: [],
    selectedValve: null,
    lastIncorrectValve: null,
  },
  objects: [
    { id: 'valve-a', type: 'valve', initialState: { closed: false }, affordances: ['inspect', 'actuate'] },
    { id: 'valve-b', type: 'valve', initialState: { closed: false }, affordances: ['inspect', 'actuate'] },
    { id: 'source-sensor', type: 'sensor', initialState: { calibrated: true }, affordances: ['inspect'] },
    { id: 'relief-vent', type: 'vent', initialState: { active: false }, affordances: ['actuate'] },
    { id: 'status-panel', type: 'panel', initialState: { ready: true }, affordances: ['inspect'] },
  ],
  generation: {
    variables: [{ key: 'leakingValve', options: ['valve-a', 'valve-b'] }],
  },
  objectives: [
    {
      id: 'control-leak',
      statement: 'Controla la fuga y demuestra cómo identificaste su fuente.',
      achieved: { op: 'eq', left: state('world.leak.active'), right: literal(false) },
      demonstrates: { op: 'contains', collection: state('world.evidence'), value: literal('source-confirmed') },
    },
  ],
  rules: [
    {
      id: 'collect-source-evidence',
      on: 'inspect',
      targets: ['source-sensor'],
      effects: [
        { type: 'addToSet', path: 'world.evidence', value: literal('source-confirmed') },
        { type: 'advanceClock', ticks: 1 },
        {
          type: 'emit',
          eventType: 'evidence.collected',
          subjectId: literal('source-sensor'),
          payload: { sourceCircuit: generated('leakingValve') },
        },
        {
          type: 'diagnose',
          verdict: 'correct',
          code: 'LAB.EVIDENCE.SOURCE_CONFIRMED',
          message: 'La lectura confirma qué circuito pierde.',
          recoverable: true,
          at: literal('source-sensor'),
        },
      ],
    },
    {
      id: 'close-correct-valve',
      on: 'actuate',
      targets: ['valve-a', 'valve-b'],
      when: { op: 'eq', left: intent('targetId'), right: generated('leakingValve') },
      effects: [
        { type: 'set', path: 'world.selectedValve', value: intent('targetId') },
        { type: 'set', path: 'world.leak.active', value: literal(false) },
        { type: 'set', path: 'world.leak.rate', value: literal(0) },
        { type: 'advanceClock', ticks: 1 },
        {
          type: 'emit',
          eventType: 'valve.closed',
          subjectId: intent('targetId'),
          payload: { leakActive: state('world.leak.active') },
        },
        {
          type: 'diagnose',
          verdict: 'correct',
          code: 'LAB.CONTROL.SOURCE_ISOLATED',
          message: 'La tasa de fuga cayó a cero.',
          recoverable: true,
          at: intent('targetId'),
        },
      ],
    },
    {
      id: 'close-wrong-valve',
      on: 'actuate',
      targets: ['valve-a', 'valve-b'],
      when: { op: 'neq', left: intent('targetId'), right: generated('leakingValve') },
      effects: [
        { type: 'set', path: 'world.lastIncorrectValve', value: intent('targetId') },
        { type: 'increment', path: 'world.pressure', amount: literal(2) },
        { type: 'advanceClock', ticks: 1 },
        {
          type: 'emit',
          eventType: 'pressure.increased',
          subjectId: intent('targetId'),
          payload: { pressure: state('world.pressure') },
        },
        {
          type: 'diagnose',
          verdict: 'incorrect',
          code: 'LAB.CONTROL.WRONG_VALVE',
          message: 'La fuga continúa y la presión del circuito aumentó.',
          recoverable: true,
          at: intent('targetId'),
        },
      ],
    },
    {
      id: 'relieve-pressure',
      on: 'actuate',
      targets: ['relief-vent'],
      when: { op: 'gt', left: state('world.pressure'), right: literal(1) },
      effects: [
        { type: 'set', path: 'world.pressure', value: literal(1) },
        { type: 'advanceClock', ticks: 1 },
        { type: 'checkpoint', checkpointId: 'pressure-recovered' },
        {
          type: 'emit',
          eventType: 'pressure.stabilized',
          subjectId: literal('relief-vent'),
          payload: { pressure: state('world.pressure') },
        },
        {
          type: 'diagnose',
          verdict: 'alternative',
          code: 'LAB.RECOVERY.PRESSURE_STABLE',
          message: 'La presión volvió a un nivel estable; ahora revisa la fuente.',
          recoverable: true,
          at: literal('relief-vent'),
        },
      ],
    },
    {
      id: 'finish-after-evidence',
      on: 'inspect',
      targets: ['status-panel'],
      when: {
        op: 'all',
        conditions: [
          { op: 'eq', left: state('objectives.control-leak.achieved'), right: literal(true) },
          { op: 'eq', left: state('objectives.control-leak.demonstrated'), right: literal(true) },
        ],
      },
      effects: [
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'mission.completed', payload: { ending: literal('controlled') } },
        { type: 'finish', endingId: 'controlled' },
      ],
    },
  ],
  endings: [{ id: 'controlled', label: 'Fuga controlada y explicada' }],
};

export function microLabIntent(
  intentId: string,
  expectedVersion: number,
  primitive: Intent['primitive'],
  targetId: string,
): Intent {
  return { intentId, attemptId: 'attempt-micro-lab', expectedVersion, primitive, targetId };
}
