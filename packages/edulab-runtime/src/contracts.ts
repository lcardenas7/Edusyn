export type JsonPrimitive = null | boolean | number | string;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type Primitive =
  | 'inspect'
  | 'pick'
  | 'place'
  | 'input'
  | 'sequence'
  | 'adjust'
  | 'actuate'
  | 'navigate';

export type AttemptMode = 'EXPLORE' | 'GUIDED_PRACTICE' | 'ASSESSMENT';
export type AttemptStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED';
export type DiagnosisVerdict =
  | 'correct'
  | 'partial'
  | 'incorrect'
  | 'misconception'
  | 'unsafe'
  | 'incomplete'
  | 'alternative';

export interface LiteralValue {
  literal: JsonValue;
}

export interface PathValue {
  source: 'state' | 'intent' | 'generated';
  path: string;
}

export type ValueExpression = LiteralValue | PathValue;

export interface AllCondition {
  op: 'all';
  conditions: Condition[];
}

export interface AnyCondition {
  op: 'any';
  conditions: Condition[];
}

export interface NotCondition {
  op: 'not';
  condition: Condition;
}

export interface BinaryCondition {
  op: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte';
  left: ValueExpression;
  right: ValueExpression;
}

export interface InCondition {
  op: 'in';
  item: ValueExpression;
  collection: ValueExpression;
}

export interface ContainsCondition {
  op: 'contains';
  collection: ValueExpression;
  value: ValueExpression;
}

export interface ExistsCondition {
  op: 'exists';
  value: ValueExpression;
}

export type Condition =
  | AllCondition
  | AnyCondition
  | NotCondition
  | BinaryCondition
  | InCondition
  | ContainsCondition
  | ExistsCondition;

export interface SetEffect {
  type: 'set';
  path: string;
  value: ValueExpression;
}

export interface IncrementEffect {
  type: 'increment';
  path: string;
  amount: ValueExpression;
}

export interface SetCollectionEffect {
  type: 'addToSet' | 'removeFromSet';
  path: string;
  value: ValueExpression;
}

export interface AdvanceClockEffect {
  type: 'advanceClock';
  ticks: number;
}

export interface EmitEffect {
  type: 'emit';
  eventType: string;
  subjectId?: ValueExpression;
  payload?: Record<string, ValueExpression>;
}

export interface DiagnoseEffect {
  type: 'diagnose';
  verdict: DiagnosisVerdict;
  code: string;
  message: string;
  recoverable: boolean;
  at?: ValueExpression;
}

export interface CheckpointEffect {
  type: 'checkpoint';
  checkpointId: string;
}

export interface ObjectiveEffect {
  type: 'achieve' | 'demonstrate';
  objectiveId: string;
}

export interface FinishEffect {
  type: 'finish';
  endingId: string;
}

export type EffectDefinition =
  | SetEffect
  | IncrementEffect
  | SetCollectionEffect
  | AdvanceClockEffect
  | EmitEffect
  | DiagnoseEffect
  | CheckpointEffect
  | ObjectiveEffect
  | FinishEffect;

export interface ExperienceObjectDefinition {
  id: string;
  type: string;
  initialState: JsonObject;
  affordances: Primitive[];
}

export interface ObjectiveDefinition {
  id: string;
  statement: string;
  achieved: Condition;
  demonstrates: Condition;
}

export interface EndingDefinition {
  id: string;
  label: string;
}

export interface RuleDefinition {
  id: string;
  on: Primitive;
  targets?: string[];
  when?: Condition;
  after?: string[];
  effects: EffectDefinition[];
}

export interface GenerationVariableDefinition {
  key: string;
  options: JsonValue[];
}

export interface ExperienceDefinition {
  schemaVersion: 'edulab.experience/1';
  definitionId: string;
  version: number;
  engineVersion: string;
  title: string;
  supportedModes: AttemptMode[];
  requiredCapabilities: Primitive[];
  initialWorld: JsonObject;
  objects: ExperienceObjectDefinition[];
  generation?: {
    variables: GenerationVariableDefinition[];
  };
  objectives: ObjectiveDefinition[];
  rules: RuleDefinition[];
  endings: EndingDefinition[];
}

export interface DefinitionReference {
  definitionId: string;
  definitionVersion: number;
  definitionHash: string;
  engineVersion: string;
}

export interface ObjectiveState {
  achieved: boolean;
  demonstrated: boolean;
}

export interface AttemptState {
  attemptId: string;
  definition: DefinitionReference;
  mode: AttemptMode;
  seed: string;
  generated: JsonObject;
  world: JsonObject;
  objectives: Record<string, ObjectiveState>;
  logicalTick: number;
  version: number;
  decisionSequence: number;
  checkpointId: string | null;
  status: AttemptStatus;
  endingId: string | null;
}

export interface Intent {
  intentId: string;
  attemptId: string;
  expectedVersion: number;
  primitive: Primitive;
  targetId?: string;
  payload?: JsonValue;
  actorId?: string;
}

export interface StateChange {
  path: string;
  before: JsonValue | undefined;
  after: JsonValue | undefined;
}

export interface Diagnosis {
  verdict: DiagnosisVerdict;
  code: string;
  message: string;
  recoverable: boolean;
  at?: JsonValue;
}

export interface DomainEvent {
  eventId: string;
  attemptId: string;
  sequence: number;
  logicalTick: number;
  type: string;
  subjectId?: JsonValue;
  payload: JsonObject;
  causationId: string;
  correlationId: string;
}

export interface Frame {
  world: JsonObject;
  effects: StateChange[];
  feedback: Diagnosis[];
  hud: {
    logicalTick: number;
    status: AttemptStatus;
    endingId: string | null;
    objectives: Record<string, ObjectiveState>;
  };
}

export interface EngineStepResult {
  accepted: boolean;
  state: AttemptState;
  stateHash: string;
  frame: Frame;
  diagnoses: Diagnosis[];
  events: DomainEvent[];
}

export type ValidationLayer = 'structural' | 'semantic';

export interface ValidationIssue {
  layer: ValidationLayer;
  code: string;
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  structural: ValidationIssue[];
  semantic: ValidationIssue[];
}
