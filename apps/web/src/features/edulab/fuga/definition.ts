import type {
  ExperienceDefinition,
  Intent,
  JsonValue,
  ValueExpression,
} from '@edusyn/edulab-runtime'
import { EDULAB_ENGINE_VERSION } from '@edusyn/edulab-runtime'

const literal = (value: JsonValue): ValueExpression => ({ literal: value })
const state = (path: string): ValueExpression => ({ source: 'state', path })
const intent = (path: string): ValueExpression => ({ source: 'intent', path })
const generated = (path: string): ValueExpression => ({ source: 'generated', path })

export interface IncidentProfile {
  profile: 'acidic' | 'basic' | 'hydroalcoholic' | 'wash-water'
  circuit: 'circuit-a' | 'circuit-b' | 'circuit-c' | 'circuit-d'
  containment: 'module-corrosive' | 'module-flammable' | 'module-water'
  ph: string
  conductivity: string
  voc: string
}

export const INCIDENT_PROFILES: IncidentProfile[] = [
  { profile: 'acidic', circuit: 'circuit-a', containment: 'module-corrosive', ph: 'ácido', conductivity: 'alta', voc: 'sin respuesta' },
  { profile: 'basic', circuit: 'circuit-b', containment: 'module-corrosive', ph: 'básico', conductivity: 'alta', voc: 'sin respuesta' },
  { profile: 'hydroalcoholic', circuit: 'circuit-c', containment: 'module-flammable', ph: 'cercano a neutro', conductivity: 'baja', voc: 'respuesta positiva' },
  { profile: 'wash-water', circuit: 'circuit-d', containment: 'module-water', ph: 'cercano a neutro', conductivity: 'muy baja', voc: 'sin respuesta' },
]

const remoteActive = { op: 'eq', left: state('world.zone.remote'), right: literal(true) } as const
const remoteInactive = { op: 'eq', left: state('world.zone.remote'), right: literal(false) } as const
const hasEvidence = (name: string) => ({
  op: 'contains' as const,
  collection: state('world.evidence'),
  value: literal(name),
})
const incidentEquals = (field: string, payloadPath: string) => ({
  op: 'eq' as const,
  left: intent(payloadPath),
  right: generated(`incident.${field}`),
})

export const fugaLaboratorioDefinition: ExperienceDefinition = {
  schemaVersion: 'edulab.experience/1',
  definitionId: 'edusim.edulab.ciencias.fuga-laboratorio',
  version: 1,
  engineVersion: EDULAB_ENGINE_VERSION,
  title: 'Fuga en el laboratorio',
  supportedModes: ['EXPLORE', 'GUIDED_PRACTICE'],
  requiredCapabilities: ['inspect', 'input', 'actuate'],
  initialWorld: {
    zone: { alerted: false, isolated: false, remote: false, exposure: 0, safeOrder: false },
    leak: { active: true, rate: 3, pressure: 1 },
    spill: { spread: 2, contained: false, reaction: false },
    evidence: [],
    hypothesis: { submitted: false, correct: false, supported: false },
    intervention: { evidenceBased: false, hadRecovery: false },
    verification: { stable: false, explained: false },
  },
  objects: [
    { id: 'alarm', type: 'emergency-control', initialState: { active: false }, affordances: ['actuate'] },
    { id: 'access-door', type: 'barrier', initialState: { isolated: false }, affordances: ['actuate'] },
    { id: 'remote-control', type: 'control', initialState: { active: false }, affordances: ['actuate'] },
    { id: 'sds-terminal', type: 'knowledge-source', initialState: { ready: true }, affordances: ['inspect'] },
    { id: 'sensor-ph', type: 'instrument', initialState: { calibrated: true }, affordances: ['inspect'] },
    { id: 'sensor-conductivity', type: 'instrument', initialState: { calibrated: true }, affordances: ['inspect'] },
    { id: 'sensor-voc', type: 'instrument', initialState: { calibrated: true }, affordances: ['inspect'] },
    { id: 'circuit-tracer', type: 'instrument', initialState: { calibrated: true }, affordances: ['inspect'] },
    { id: 'evidence-log', type: 'notebook', initialState: { revisions: 0 }, affordances: ['input'] },
    { id: 'circuit-a', type: 'fluid-circuit', initialState: { closed: false }, affordances: ['actuate'] },
    { id: 'circuit-b', type: 'fluid-circuit', initialState: { closed: false }, affordances: ['actuate'] },
    { id: 'circuit-c', type: 'fluid-circuit', initialState: { closed: false }, affordances: ['actuate'] },
    { id: 'circuit-d', type: 'fluid-circuit', initialState: { closed: false }, affordances: ['actuate'] },
    { id: 'relief-control', type: 'safety-control', initialState: { ready: true }, affordances: ['actuate'] },
    { id: 'module-corrosive', type: 'containment-module', initialState: { deployed: false }, affordances: ['actuate'] },
    { id: 'module-flammable', type: 'containment-module', initialState: { deployed: false }, affordances: ['actuate'] },
    { id: 'module-water', type: 'containment-module', initialState: { deployed: false }, affordances: ['actuate'] },
    { id: 'module-release', type: 'safety-control', initialState: { ready: true }, affordances: ['actuate'] },
    { id: 'verification-sensor', type: 'instrument', initialState: { ready: true }, affordances: ['inspect'] },
    { id: 'explanation-console', type: 'notebook', initialState: { ready: true }, affordances: ['input'] },
    { id: 'status-panel', type: 'panel', initialState: { ready: true }, affordances: ['inspect'] },
    { id: 'supervisor-channel', type: 'communication', initialState: { ready: true }, affordances: ['actuate'] },
    { id: 'hot-plate', type: 'ignition-source', initialState: { active: false }, affordances: ['actuate'] },
  ],
  generation: {
    variables: [{
      key: 'incident',
      options: INCIDENT_PROFILES.map((profile) => ({ ...profile }) as unknown as JsonValue),
    }],
  },
  objectives: [
    {
      id: 'secure-zone',
      statement: 'Asegura la zona antes de investigar.',
      achieved: {
        op: 'all',
        conditions: [
          { op: 'eq', left: state('world.zone.isolated'), right: literal(true) },
          { op: 'eq', left: state('world.zone.remote'), right: literal(true) },
        ],
      },
      demonstrates: { op: 'eq', left: state('world.zone.safeOrder'), right: literal(true) },
    },
    {
      id: 'identify-source',
      statement: 'Identifica el perfil y el circuito con evidencia independiente.',
      achieved: { op: 'eq', left: state('world.hypothesis.correct'), right: literal(true) },
      demonstrates: { op: 'eq', left: state('world.hypothesis.supported'), right: literal(true) },
    },
    {
      id: 'control-leak',
      statement: 'Detén la fuente y contiene la extensión.',
      achieved: {
        op: 'all',
        conditions: [
          { op: 'eq', left: state('world.leak.active'), right: literal(false) },
          { op: 'eq', left: state('world.spill.contained'), right: literal(true) },
        ],
      },
      demonstrates: { op: 'eq', left: state('world.intervention.evidenceBased'), right: literal(true) },
    },
    {
      id: 'verify-and-explain',
      statement: 'Comprueba el estado seguro y explica la cadena causal.',
      achieved: { op: 'eq', left: state('world.verification.stable'), right: literal(true) },
      demonstrates: { op: 'eq', left: state('world.verification.explained'), right: literal(true) },
    },
  ],
  rules: [
    {
      id: 'alert-zone', on: 'actuate', targets: ['alarm'],
      effects: [
        { type: 'set', path: 'world.zone.alerted', value: literal(true) },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'zone.alerted', subjectId: literal('alarm') },
        { type: 'diagnose', verdict: 'correct', code: 'FUGA.SAFETY.ALERTED', message: 'La alerta avisa al laboratorio sin acercarte al incidente.', recoverable: true },
      ],
    },
    {
      id: 'isolate-zone', on: 'actuate', targets: ['access-door'],
      when: { op: 'eq', left: state('world.zone.alerted'), right: literal(true) },
      effects: [
        { type: 'set', path: 'world.zone.isolated', value: literal(true) },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'zone.isolated', subjectId: literal('access-door') },
      ],
    },
    {
      id: 'enable-remote-safe', on: 'actuate', targets: ['remote-control'],
      when: {
        op: 'all', conditions: [
          { op: 'eq', left: state('world.zone.isolated'), right: literal(true) },
          { op: 'eq', left: state('world.zone.exposure'), right: literal(0) },
        ],
      },
      effects: [
        { type: 'set', path: 'world.zone.remote', value: literal(true) },
        { type: 'set', path: 'world.zone.safeOrder', value: literal(true) },
        { type: 'checkpoint', checkpointId: 'zone-secured' },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'remote_mode.enabled', subjectId: literal('remote-control') },
      ],
    },
    {
      id: 'enable-remote-after-exposure', on: 'actuate', targets: ['remote-control'],
      when: {
        op: 'all', conditions: [
          { op: 'eq', left: state('world.zone.isolated'), right: literal(true) },
          { op: 'gt', left: state('world.zone.exposure'), right: literal(0) },
        ],
      },
      effects: [
        { type: 'set', path: 'world.zone.remote', value: literal(true) },
        { type: 'checkpoint', checkpointId: 'zone-recovered' },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'remote_mode.enabled_after_recovery', subjectId: literal('remote-control') },
        { type: 'diagnose', verdict: 'alternative', code: 'FUGA.SAFETY.RECOVERED', message: 'La zona quedó controlada, pero la investigación comenzó antes del orden seguro.', recoverable: true },
      ],
    },
    {
      id: 'unsafe-investigation-before-remote', on: 'inspect',
      targets: ['sds-terminal', 'sensor-ph', 'sensor-conductivity', 'sensor-voc', 'circuit-tracer'],
      when: remoteInactive,
      effects: [
        { type: 'increment', path: 'world.zone.exposure', amount: literal(1) },
        { type: 'increment', path: 'world.spill.spread', amount: literal(1) },
        { type: 'set', path: 'world.intervention.hadRecovery', value: literal(true) },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'unsafe_investigation.attempted' },
        { type: 'diagnose', verdict: 'unsafe', code: 'FUGA.SAFETY.REMOTE_REQUIRED', message: 'La investigación directa aumentó la exposición simulada. Alerta, aísla y usa el control remoto.', recoverable: true },
      ],
    },
    {
      id: 'read-sds', on: 'inspect', targets: ['sds-terminal'], when: remoteActive,
      effects: [
        { type: 'addToSet', path: 'world.evidence', value: literal('sds') },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'evidence.collected', subjectId: literal('sds-terminal'), payload: { kind: literal('document'), profile: generated('incident.profile') } },
        { type: 'diagnose', verdict: 'correct', code: 'FUGA.EVIDENCE.SDS', message: 'La ficha identifica riesgos y módulos compatibles.', recoverable: true },
      ],
    },
    ...[
      ['sensor-ph', 'ph'],
      ['sensor-conductivity', 'conductivity'],
      ['sensor-voc', 'voc'],
      ['circuit-tracer', 'circuit-trace'],
    ].map(([target, evidence]) => ({
      id: `measure-${evidence}`,
      on: 'inspect' as const,
      targets: [target!],
      when: remoteActive,
      effects: [
        { type: 'addToSet' as const, path: 'world.evidence', value: literal(evidence!) },
        { type: 'advanceClock' as const, ticks: 1 },
        { type: 'emit' as const, eventType: 'instrument.measured', subjectId: literal(target!), payload: { kind: literal(evidence!), profile: generated('incident.profile'), circuit: generated('incident.circuit') } },
        { type: 'diagnose' as const, verdict: 'correct' as const, code: `FUGA.EVIDENCE.${evidence!.toUpperCase()}`, message: 'La lectura estable entra a la bitácora.', recoverable: true },
      ],
    })),
    {
      id: 'hypothesis-supported', on: 'input', targets: ['evidence-log'],
      when: {
        op: 'all', conditions: [
          incidentEquals('profile', 'payload.profile'), incidentEquals('circuit', 'payload.circuit'),
          hasEvidence('sds'), hasEvidence('circuit-trace'),
          { op: 'any', conditions: [hasEvidence('ph'), hasEvidence('conductivity'), hasEvidence('voc')] },
        ],
      },
      effects: [
        { type: 'set', path: 'world.hypothesis.submitted', value: literal(true) },
        { type: 'set', path: 'world.hypothesis.correct', value: literal(true) },
        { type: 'set', path: 'world.hypothesis.supported', value: literal(true) },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'hypothesis.supported', payload: { profile: intent('payload.profile'), circuit: intent('payload.circuit') } },
        { type: 'diagnose', verdict: 'correct', code: 'FUGA.HYPOTHESIS.SUPPORTED', message: 'La hipótesis conecta documentos, medición y trazado del circuito.', recoverable: true },
      ],
    },
    {
      id: 'hypothesis-correct-insufficient', on: 'input', targets: ['evidence-log'],
      when: {
        op: 'all', conditions: [
          incidentEquals('profile', 'payload.profile'), incidentEquals('circuit', 'payload.circuit'),
          { op: 'not', condition: { op: 'all', conditions: [hasEvidence('sds'), hasEvidence('circuit-trace'), { op: 'any', conditions: [hasEvidence('ph'), hasEvidence('conductivity'), hasEvidence('voc')] }] } },
        ],
      },
      effects: [
        { type: 'set', path: 'world.hypothesis.submitted', value: literal(true) },
        { type: 'set', path: 'world.hypothesis.correct', value: literal(true) },
        { type: 'set', path: 'world.hypothesis.supported', value: literal(false) },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'hypothesis.insufficient_evidence' },
        { type: 'diagnose', verdict: 'partial', code: 'FUGA.HYPOTHESIS.INSUFFICIENT', message: 'La hipótesis coincide, pero aún no está demostrada con dos fuentes independientes.', recoverable: true },
      ],
    },
    {
      id: 'hypothesis-incorrect', on: 'input', targets: ['evidence-log'],
      when: {
        op: 'any', conditions: [
          { op: 'neq', left: intent('payload.profile'), right: generated('incident.profile') },
          { op: 'neq', left: intent('payload.circuit'), right: generated('incident.circuit') },
        ],
      },
      effects: [
        { type: 'set', path: 'world.hypothesis.submitted', value: literal(true) },
        { type: 'set', path: 'world.hypothesis.correct', value: literal(false) },
        { type: 'set', path: 'world.hypothesis.supported', value: literal(false) },
        { type: 'increment', path: 'world.spill.spread', amount: literal(1) },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'hypothesis.revised' },
        { type: 'diagnose', verdict: 'misconception', code: 'FUGA.HYPOTHESIS.REVISE', message: 'La hipótesis no explica todas las lecturas; mientras revisas, la extensión continúa.', recoverable: true },
      ],
    },
    {
      id: 'close-correct-with-evidence', on: 'actuate', targets: ['circuit-a', 'circuit-b', 'circuit-c', 'circuit-d'],
      when: { op: 'all', conditions: [incidentEquals('circuit', 'targetId'), { op: 'eq', left: state('world.hypothesis.supported'), right: literal(true) }] },
      effects: [
        { type: 'set', path: 'world.leak.active', value: literal(false) },
        { type: 'set', path: 'world.leak.rate', value: literal(0) },
        { type: 'set', path: 'world.intervention.evidenceBased', value: literal(true) },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'valve.closed', subjectId: intent('targetId'), payload: { leakRate: state('world.leak.rate') } },
        { type: 'diagnose', verdict: 'correct', code: 'FUGA.CONTROL.SOURCE', message: 'El caudal cae a cero en el circuito identificado.', recoverable: true },
      ],
    },
    {
      id: 'close-correct-by-chance', on: 'actuate', targets: ['circuit-a', 'circuit-b', 'circuit-c', 'circuit-d'],
      when: { op: 'all', conditions: [incidentEquals('circuit', 'targetId'), { op: 'neq', left: state('world.hypothesis.supported'), right: literal(true) }] },
      effects: [
        { type: 'set', path: 'world.leak.active', value: literal(false) },
        { type: 'set', path: 'world.leak.rate', value: literal(0) },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'valve.closed_without_evidence', subjectId: intent('targetId') },
        { type: 'diagnose', verdict: 'partial', code: 'FUGA.CONTROL.ACCIDENTAL', message: 'La fuga se detuvo, pero la decisión todavía no demuestra cómo identificaste la fuente.', recoverable: true },
      ],
    },
    {
      id: 'close-wrong-circuit', on: 'actuate', targets: ['circuit-a', 'circuit-b', 'circuit-c', 'circuit-d'],
      when: { op: 'neq', left: intent('targetId'), right: generated('incident.circuit') },
      effects: [
        { type: 'increment', path: 'world.leak.pressure', amount: literal(2) },
        { type: 'increment', path: 'world.spill.spread', amount: literal(1) },
        { type: 'set', path: 'world.intervention.hadRecovery', value: literal(true) },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'pressure.increased', subjectId: intent('targetId'), payload: { pressure: state('world.leak.pressure') } },
        { type: 'diagnose', verdict: 'incorrect', code: 'FUGA.CONTROL.WRONG_CIRCUIT', message: 'La fuga continúa y la presión sube. Libera la presión y revisa el trazado.', recoverable: true },
      ],
    },
    {
      id: 'relieve-pressure', on: 'actuate', targets: ['relief-control'],
      when: { op: 'gt', left: state('world.leak.pressure'), right: literal(1) },
      effects: [
        { type: 'set', path: 'world.leak.pressure', value: literal(1) },
        { type: 'checkpoint', checkpointId: 'pressure-recovered' },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'pressure.stabilized', subjectId: literal('relief-control') },
        { type: 'diagnose', verdict: 'alternative', code: 'FUGA.RECOVERY.PRESSURE', message: 'La presión volvió al nivel estable; ahora puedes corregir la intervención.', recoverable: true },
      ],
    },
    {
      id: 'deploy-compatible-module', on: 'actuate', targets: ['module-corrosive', 'module-flammable', 'module-water'],
      when: { op: 'eq', left: intent('targetId'), right: generated('incident.containment') },
      effects: [
        { type: 'set', path: 'world.spill.contained', value: literal(true) },
        { type: 'set', path: 'world.spill.spread', value: literal(0) },
        { type: 'set', path: 'world.spill.reaction', value: literal(false) },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'spill.contained', subjectId: intent('targetId') },
        { type: 'diagnose', verdict: 'correct', code: 'FUGA.CONTAINMENT.COMPATIBLE', message: 'El módulo compatible detiene la extensión en la bandeja.', recoverable: true },
      ],
    },
    {
      id: 'deploy-incompatible-module', on: 'actuate', targets: ['module-corrosive', 'module-flammable', 'module-water'],
      when: { op: 'neq', left: intent('targetId'), right: generated('incident.containment') },
      effects: [
        { type: 'set', path: 'world.spill.reaction', value: literal(true) },
        { type: 'increment', path: 'world.spill.spread', amount: literal(2) },
        { type: 'set', path: 'world.intervention.hadRecovery', value: literal(true) },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'unsafe_containment.deployed', subjectId: intent('targetId') },
        { type: 'diagnose', verdict: 'unsafe', code: 'FUGA.CONTAINMENT.INCOMPATIBLE', message: 'El módulo rechaza el líquido y aumenta la extensión. Retíralo de forma remota.', recoverable: true },
      ],
    },
    {
      id: 'release-incompatible-module', on: 'actuate', targets: ['module-release'],
      when: { op: 'eq', left: state('world.spill.reaction'), right: literal(true) },
      effects: [
        { type: 'set', path: 'world.spill.reaction', value: literal(false) },
        { type: 'increment', path: 'world.spill.spread', amount: literal(-1) },
        { type: 'checkpoint', checkpointId: 'containment-recovered' },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'containment.recovered', subjectId: literal('module-release') },
        { type: 'diagnose', verdict: 'alternative', code: 'FUGA.RECOVERY.CONTAINMENT', message: 'El módulo incompatible quedó retirado. Consulta la ficha antes de elegir otro.', recoverable: true },
      ],
    },
    {
      id: 'block-ignition-risk', on: 'actuate', targets: ['hot-plate'],
      when: { op: 'eq', left: generated('incident.profile'), right: literal('hydroalcoholic') },
      effects: [
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'unsafe_action_attempted', subjectId: literal('hot-plate') },
        { type: 'diagnose', verdict: 'unsafe', code: 'FUGA.CRITICAL.IGNITION_BLOCKED', message: 'Acción bloqueada: una fuente de ignición con vapores presentes puede causar un daño irreversible.', recoverable: true },
      ],
    },
    {
      id: 'verify-safe-state', on: 'inspect', targets: ['verification-sensor'],
      when: { op: 'all', conditions: [
        { op: 'eq', left: state('world.leak.active'), right: literal(false) },
        { op: 'eq', left: state('world.spill.contained'), right: literal(true) },
      ] },
      effects: [
        { type: 'set', path: 'world.verification.stable', value: literal(true) },
        { type: 'addToSet', path: 'world.evidence', value: literal('post-measurement') },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'hazard.verified_stable', subjectId: literal('verification-sensor') },
        { type: 'diagnose', verdict: 'correct', code: 'FUGA.VERIFY.STABLE', message: 'La medición posterior confirma tasa cero y extensión estable.', recoverable: true },
      ],
    },
    {
      id: 'record-causal-explanation', on: 'input', targets: ['explanation-console'],
      when: { op: 'all', conditions: [
        { op: 'eq', left: state('world.verification.stable'), right: literal(true) },
        { op: 'eq', left: intent('payload.causalLink'), right: literal(true) },
      ] },
      effects: [
        { type: 'set', path: 'world.verification.explained', value: literal(true) },
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'causal_explanation.recorded' },
        { type: 'diagnose', verdict: 'correct', code: 'FUGA.EXPLAIN.CAUSAL', message: 'La explicación conecta evidencia, intervención y cambio observado.', recoverable: true },
      ],
    },
    {
      id: 'finish-contained', on: 'inspect', targets: ['status-panel'],
      when: { op: 'all', conditions: [
        { op: 'eq', left: state('world.verification.stable'), right: literal(true) },
        { op: 'eq', left: state('world.verification.explained'), right: literal(true) },
        { op: 'eq', left: state('world.intervention.hadRecovery'), right: literal(false) },
      ] },
      effects: [
        { type: 'emit', eventType: 'mission.completed', payload: { ending: literal('contained_and_explained') } },
        { type: 'finish', endingId: 'contained_and_explained' },
      ],
    },
    {
      id: 'finish-after-recovery', on: 'inspect', targets: ['status-panel'],
      when: { op: 'all', conditions: [
        { op: 'eq', left: state('world.verification.stable'), right: literal(true) },
        { op: 'eq', left: state('world.verification.explained'), right: literal(true) },
        { op: 'eq', left: state('world.intervention.hadRecovery'), right: literal(true) },
      ] },
      effects: [
        { type: 'emit', eventType: 'mission.completed_after_recovery', payload: { ending: literal('contained_after_recovery') } },
        { type: 'finish', endingId: 'contained_after_recovery' },
      ],
    },
    {
      id: 'safe-escalation', on: 'actuate', targets: ['supervisor-channel'],
      when: { op: 'all', conditions: [
        { op: 'eq', left: state('world.zone.alerted'), right: literal(true) },
        { op: 'eq', left: state('world.zone.isolated'), right: literal(true) },
      ] },
      effects: [
        { type: 'advanceClock', ticks: 1 },
        { type: 'emit', eventType: 'incident.escalated_safely', subjectId: literal('supervisor-channel') },
        { type: 'diagnose', verdict: 'alternative', code: 'FUGA.ENDING.ESCALATED', message: 'El responsable toma el control con la zona aislada. Es una finalización segura válida.', recoverable: true },
        { type: 'finish', endingId: 'safe_escalation' },
      ],
    },
  ],
  endings: [
    { id: 'contained_and_explained', label: 'Fuga contenida y explicada' },
    { id: 'contained_after_recovery', label: 'Estado seguro después de corregir una consecuencia' },
    { id: 'safe_escalation', label: 'Escalamiento seguro al responsable' },
  ],
}

export function fugaIntent(
  stateVersion: number,
  primitive: Intent['primitive'],
  targetId: string,
  payload?: JsonValue,
): Intent {
  return {
    intentId: `fuga-decision-${stateVersion + 1}`,
    attemptId: 'local-fuga-attempt',
    expectedVersion: stateVersion,
    primitive,
    targetId,
    ...(payload === undefined ? {} : { payload }),
  }
}

export function incidentFromGenerated(value: JsonValue | undefined): IncidentProfile {
  const candidate = value as unknown as IncidentProfile
  return INCIDENT_PROFILES.find((profile) => (
    profile.profile === candidate?.profile && profile.circuit === candidate?.circuit
  )) ?? INCIDENT_PROFILES[0]!
}
