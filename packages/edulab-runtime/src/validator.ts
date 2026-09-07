import type {
  Condition,
  EffectDefinition,
  ExperienceDefinition,
  JsonValue,
  RuleDefinition,
  ValidationIssue,
  ValidationResult,
  ValueExpression,
} from './contracts.js';
import { EDULAB_ENGINE_VERSION, EDULAB_SCHEMA_VERSION, PRIMITIVES } from './constants.js';

const MODES = new Set(['EXPLORE', 'GUIDED_PRACTICE', 'ASSESSMENT']);
const PRIMITIVE_SET = new Set<string>(PRIMITIVES);
const CONDITION_OPERATORS = new Set([
  'all', 'any', 'not', 'eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in', 'contains', 'exists',
]);
const EFFECT_TYPES = new Set([
  'set', 'increment', 'addToSet', 'removeFromSet', 'advanceClock', 'emit', 'diagnose',
  'checkpoint', 'achieve', 'demonstrate', 'finish',
]);
const VERDICTS = new Set([
  'correct', 'partial', 'incorrect', 'misconception', 'unsafe', 'incomplete', 'alternative',
]);

function issue(
  layer: 'structural' | 'semantic',
  code: string,
  path: string,
  message: string,
): ValidationIssue {
  return { layer, code, path, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 32) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => isJsonValue(item, depth + 1));
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => isJsonValue(item, depth + 1));
}

function validateValueExpression(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value)) {
    issues.push(issue('structural', 'value.invalid', path, 'Value expression must be an object.'));
    return;
  }
  if ('literal' in value) {
    if (Object.keys(value).length !== 1 || !isJsonValue(value.literal)) {
      issues.push(issue('structural', 'value.literal.invalid', path, 'Literal must contain one valid JSON value.'));
    }
    return;
  }
  if (!['state', 'intent', 'generated'].includes(String(value.source)) || !isNonEmptyString(value.path)) {
    issues.push(issue('structural', 'value.path.invalid', path, 'Path value needs a valid source and path.'));
  }
}

function validateCondition(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
  depth = 0,
): void {
  if (depth > 24) {
    issues.push(issue('structural', 'condition.depth', path, 'Condition nesting exceeds 24 levels.'));
    return;
  }
  if (!isRecord(value) || !CONDITION_OPERATORS.has(String(value.op))) {
    issues.push(issue('structural', 'condition.invalid', path, 'Condition operator is invalid.'));
    return;
  }
  switch (value.op) {
    case 'all':
    case 'any':
      if (!Array.isArray(value.conditions) || value.conditions.length === 0) {
        issues.push(issue('structural', 'condition.children.invalid', `${path}.conditions`, 'At least one child is required.'));
      } else {
        value.conditions.forEach((child, index) => validateCondition(child, `${path}.conditions[${index}]`, issues, depth + 1));
      }
      break;
    case 'not':
      validateCondition(value.condition, `${path}.condition`, issues, depth + 1);
      break;
    case 'eq':
    case 'neq':
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte':
      validateValueExpression(value.left, `${path}.left`, issues);
      validateValueExpression(value.right, `${path}.right`, issues);
      break;
    case 'in':
      validateValueExpression(value.item, `${path}.item`, issues);
      validateValueExpression(value.collection, `${path}.collection`, issues);
      break;
    case 'contains':
      validateValueExpression(value.collection, `${path}.collection`, issues);
      validateValueExpression(value.value, `${path}.value`, issues);
      break;
    case 'exists':
      validateValueExpression(value.value, `${path}.value`, issues);
      break;
  }
}

function validateEffect(value: unknown, path: string, issues: ValidationIssue[]): void {
  if (!isRecord(value) || !EFFECT_TYPES.has(String(value.type))) {
    issues.push(issue('structural', 'effect.invalid', path, 'Effect type is invalid.'));
    return;
  }
  switch (value.type) {
    case 'set':
      if (!isNonEmptyString(value.path)) issues.push(issue('structural', 'effect.path.invalid', `${path}.path`, 'Mutation path is required.'));
      validateValueExpression(value.value, `${path}.value`, issues);
      break;
    case 'increment':
      if (!isNonEmptyString(value.path)) issues.push(issue('structural', 'effect.path.invalid', `${path}.path`, 'Mutation path is required.'));
      validateValueExpression(value.amount, `${path}.amount`, issues);
      break;
    case 'addToSet':
    case 'removeFromSet':
      if (!isNonEmptyString(value.path)) issues.push(issue('structural', 'effect.path.invalid', `${path}.path`, 'Collection path is required.'));
      validateValueExpression(value.value, `${path}.value`, issues);
      break;
    case 'advanceClock':
      if (!Number.isSafeInteger(value.ticks) || Number(value.ticks) < 0) {
        issues.push(issue('structural', 'effect.ticks.invalid', `${path}.ticks`, 'Ticks must be a non-negative safe integer.'));
      }
      break;
    case 'emit':
      if (!isNonEmptyString(value.eventType)) issues.push(issue('structural', 'effect.event.invalid', `${path}.eventType`, 'Event type is required.'));
      if (value.subjectId !== undefined) validateValueExpression(value.subjectId, `${path}.subjectId`, issues);
      if (value.payload !== undefined) {
        if (!isRecord(value.payload)) {
          issues.push(issue('structural', 'effect.payload.invalid', `${path}.payload`, 'Payload must map names to value expressions.'));
        } else {
          Object.entries(value.payload).forEach(([key, item]) => validateValueExpression(item, `${path}.payload.${key}`, issues));
        }
      }
      break;
    case 'diagnose':
      if (!VERDICTS.has(String(value.verdict))) issues.push(issue('structural', 'effect.verdict.invalid', `${path}.verdict`, 'Diagnosis verdict is invalid.'));
      if (!isNonEmptyString(value.code)) issues.push(issue('structural', 'effect.code.invalid', `${path}.code`, 'Diagnosis code is required.'));
      if (!isNonEmptyString(value.message)) issues.push(issue('structural', 'effect.message.invalid', `${path}.message`, 'Diagnosis message is required.'));
      if (typeof value.recoverable !== 'boolean') issues.push(issue('structural', 'effect.recoverable.invalid', `${path}.recoverable`, 'Recoverable must be boolean.'));
      if (value.at !== undefined) validateValueExpression(value.at, `${path}.at`, issues);
      break;
    case 'checkpoint':
      if (!isNonEmptyString(value.checkpointId)) issues.push(issue('structural', 'effect.checkpoint.invalid', `${path}.checkpointId`, 'Checkpoint id is required.'));
      break;
    case 'achieve':
    case 'demonstrate':
      if (!isNonEmptyString(value.objectiveId)) issues.push(issue('structural', 'effect.objective.invalid', `${path}.objectiveId`, 'Objective id is required.'));
      break;
    case 'finish':
      if (!isNonEmptyString(value.endingId)) issues.push(issue('structural', 'effect.ending.invalid', `${path}.endingId`, 'Ending id is required.'));
      break;
  }
}

function duplicateIds(items: unknown[], path: string, issues: ValidationIssue[]): void {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (!isRecord(item) || !isNonEmptyString(item.id)) return;
    if (seen.has(item.id)) issues.push(issue('structural', 'id.duplicate', `${path}[${index}].id`, `Duplicate id: ${item.id}.`));
    seen.add(item.id);
  });
}

export function validateStructure(input: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(input)) return [issue('structural', 'definition.invalid', '$', 'Definition must be an object.')];

  if (input.schemaVersion !== EDULAB_SCHEMA_VERSION) issues.push(issue('structural', 'schema.unsupported', '$.schemaVersion', `Expected ${EDULAB_SCHEMA_VERSION}.`));
  if (!isNonEmptyString(input.definitionId)) issues.push(issue('structural', 'definition.id.invalid', '$.definitionId', 'Definition id is required.'));
  if (!Number.isSafeInteger(input.version) || Number(input.version) <= 0) issues.push(issue('structural', 'definition.version.invalid', '$.version', 'Version must be a positive integer.'));
  if (!isNonEmptyString(input.engineVersion)) issues.push(issue('structural', 'engine.version.invalid', '$.engineVersion', 'Engine version is required.'));
  if (!isNonEmptyString(input.title)) issues.push(issue('structural', 'definition.title.invalid', '$.title', 'Title is required.'));

  if (!Array.isArray(input.supportedModes) || input.supportedModes.length === 0 || input.supportedModes.some((mode) => !MODES.has(String(mode)))) {
    issues.push(issue('structural', 'modes.invalid', '$.supportedModes', 'At least one valid mode is required.'));
  }
  if (!Array.isArray(input.requiredCapabilities) || input.requiredCapabilities.some((item) => !PRIMITIVE_SET.has(String(item)))) {
    issues.push(issue('structural', 'capabilities.invalid', '$.requiredCapabilities', 'Capabilities must use known primitives.'));
  }
  if (!isRecord(input.initialWorld) || !isJsonValue(input.initialWorld)) issues.push(issue('structural', 'world.invalid', '$.initialWorld', 'Initial world must be a JSON object.'));

  if (!Array.isArray(input.objects)) {
    issues.push(issue('structural', 'objects.invalid', '$.objects', 'Objects must be an array.'));
  } else {
    duplicateIds(input.objects, '$.objects', issues);
    input.objects.forEach((object, index) => {
      const path = `$.objects[${index}]`;
      if (!isRecord(object)) return issues.push(issue('structural', 'object.invalid', path, 'Object definition is invalid.'));
      if (!isNonEmptyString(object.id)) issues.push(issue('structural', 'object.id.invalid', `${path}.id`, 'Object id is required.'));
      if (!isNonEmptyString(object.type)) issues.push(issue('structural', 'object.type.invalid', `${path}.type`, 'Object type is required.'));
      if (!isRecord(object.initialState) || !isJsonValue(object.initialState)) issues.push(issue('structural', 'object.state.invalid', `${path}.initialState`, 'Object state must be JSON.'));
      if (!Array.isArray(object.affordances) || object.affordances.some((item) => !PRIMITIVE_SET.has(String(item)))) issues.push(issue('structural', 'object.affordances.invalid', `${path}.affordances`, 'Affordances must use known primitives.'));
    });
  }

  if (input.generation !== undefined) {
    if (!isRecord(input.generation) || !Array.isArray(input.generation.variables)) {
      issues.push(issue('structural', 'generation.invalid', '$.generation', 'Generation variables must be an array.'));
    } else {
      const keys = new Set<string>();
      input.generation.variables.forEach((variable, index) => {
        const path = `$.generation.variables[${index}]`;
        if (!isRecord(variable) || !isNonEmptyString(variable.key) || !Array.isArray(variable.options) || variable.options.length === 0 || !variable.options.every(isJsonValue)) {
          issues.push(issue('structural', 'generation.variable.invalid', path, 'Variable needs a unique key and non-empty JSON options.'));
        } else if (keys.has(variable.key)) {
          issues.push(issue('structural', 'generation.variable.duplicate', `${path}.key`, `Duplicate generation key: ${variable.key}.`));
        } else keys.add(variable.key);
      });
    }
  }

  if (!Array.isArray(input.objectives)) {
    issues.push(issue('structural', 'objectives.invalid', '$.objectives', 'Objectives must be an array.'));
  } else {
    duplicateIds(input.objectives, '$.objectives', issues);
    input.objectives.forEach((objective, index) => {
      const path = `$.objectives[${index}]`;
      if (!isRecord(objective)) return issues.push(issue('structural', 'objective.invalid', path, 'Objective is invalid.'));
      if (!isNonEmptyString(objective.id)) issues.push(issue('structural', 'objective.id.invalid', `${path}.id`, 'Objective id is required.'));
      if (!isNonEmptyString(objective.statement)) issues.push(issue('structural', 'objective.statement.invalid', `${path}.statement`, 'Objective statement is required.'));
      if (objective.achieved !== undefined) validateCondition(objective.achieved, `${path}.achieved`, issues);
      if (objective.demonstrates !== undefined) validateCondition(objective.demonstrates, `${path}.demonstrates`, issues);
    });
  }

  if (!Array.isArray(input.rules)) {
    issues.push(issue('structural', 'rules.invalid', '$.rules', 'Rules must be an array.'));
  } else {
    duplicateIds(input.rules, '$.rules', issues);
    input.rules.forEach((rule, index) => {
      const path = `$.rules[${index}]`;
      if (!isRecord(rule)) return issues.push(issue('structural', 'rule.invalid', path, 'Rule is invalid.'));
      if (!isNonEmptyString(rule.id)) issues.push(issue('structural', 'rule.id.invalid', `${path}.id`, 'Rule id is required.'));
      if (!PRIMITIVE_SET.has(String(rule.on))) issues.push(issue('structural', 'rule.primitive.invalid', `${path}.on`, 'Rule primitive is invalid.'));
      if (rule.targets !== undefined && (!Array.isArray(rule.targets) || rule.targets.some((item) => !isNonEmptyString(item)))) issues.push(issue('structural', 'rule.targets.invalid', `${path}.targets`, 'Targets must be object ids.'));
      if (rule.after !== undefined && (!Array.isArray(rule.after) || rule.after.some((item) => !isNonEmptyString(item)))) issues.push(issue('structural', 'rule.after.invalid', `${path}.after`, 'Rule dependencies must be rule ids.'));
      if (rule.when !== undefined) validateCondition(rule.when, `${path}.when`, issues);
      if (!Array.isArray(rule.effects) || rule.effects.length === 0) issues.push(issue('structural', 'rule.effects.invalid', `${path}.effects`, 'Rule needs at least one effect.'));
      else rule.effects.forEach((effect, effectIndex) => validateEffect(effect, `${path}.effects[${effectIndex}]`, issues));
    });
  }

  if (!Array.isArray(input.endings)) {
    issues.push(issue('structural', 'endings.invalid', '$.endings', 'Endings must be an array.'));
  } else {
    duplicateIds(input.endings, '$.endings', issues);
    input.endings.forEach((ending, index) => {
      if (!isRecord(ending) || !isNonEmptyString(ending.id) || !isNonEmptyString(ending.label)) issues.push(issue('structural', 'ending.invalid', `$.endings[${index}]`, 'Ending needs id and label.'));
    });
  }
  return issues;
}

function collectExpressions(condition: Condition, result: ValueExpression[]): void {
  switch (condition.op) {
    case 'all':
    case 'any':
      condition.conditions.forEach((child) => collectExpressions(child, result));
      break;
    case 'not':
      collectExpressions(condition.condition, result);
      break;
    case 'eq':
    case 'neq':
    case 'lt':
    case 'lte':
    case 'gt':
    case 'gte':
      result.push(condition.left, condition.right);
      break;
    case 'in':
      result.push(condition.item, condition.collection);
      break;
    case 'contains':
      result.push(condition.collection, condition.value);
      break;
    case 'exists':
      result.push(condition.value);
      break;
  }
}

function validateExpressionPaths(condition: Condition, path: string, issues: ValidationIssue[]): void {
  const expressions: ValueExpression[] = [];
  collectExpressions(condition, expressions);
  expressions.forEach((expression, index) => {
    if ('literal' in expression) return;
    const allowed = expression.source === 'state'
      ? /^(world|objectives|logicalTick|status|endingId|checkpointId)(\.|$)/
      : expression.source === 'intent'
        ? /^(primitive|targetId|payload|actorId)(\.|$)/
        : /^.+/;
    if (!allowed.test(expression.path)) issues.push(issue('semantic', 'path.unsupported', `${path}#value${index}`, `Unsupported ${expression.source} path: ${expression.path}.`));
  });
}

function hasRuleCycle(rules: RuleDefinition[]): boolean {
  const dependencies = new Map(rules.map((rule) => [rule.id, rule.after ?? []]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dependency of dependencies.get(id) ?? []) {
      if (dependencies.has(dependency) && visit(dependency)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return rules.some((rule) => visit(rule.id));
}

export function validateSemantics(definition: ExperienceDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const objectById = new Map(definition.objects.map((object) => [object.id, object]));
  const objectiveIds = new Set(definition.objectives.map((objective) => objective.id));
  const endingIds = new Set(definition.endings.map((ending) => ending.id));
  const ruleIds = new Set(definition.rules.map((rule) => rule.id));
  const capabilities = new Set(definition.requiredCapabilities);

  if (definition.engineVersion !== EDULAB_ENGINE_VERSION) issues.push(issue('semantic', 'engine.version.unsupported', '$.engineVersion', `Runtime supports ${EDULAB_ENGINE_VERSION}.`));
  if (definition.objectives.length === 0) issues.push(issue('semantic', 'objectives.empty', '$.objectives', 'At least one objective is required.'));
  if (definition.rules.length === 0) issues.push(issue('semantic', 'rules.empty', '$.rules', 'At least one rule is required.'));
  if (definition.endings.length === 0) issues.push(issue('semantic', 'endings.empty', '$.endings', 'At least one ending is required.'));

  definition.objectives.forEach((objective, index) => {
    if (!objective.achieved) issues.push(issue('semantic', 'objective.achieved.missing', `$.objectives[${index}].achieved`, 'Objective needs an achieved condition.'));
    else validateExpressionPaths(objective.achieved, `$.objectives[${index}].achieved`, issues);
    if (!objective.demonstrates) issues.push(issue('semantic', 'objective.demonstrates.missing', `$.objectives[${index}].demonstrates`, 'Objective needs a demonstrates condition.'));
    else validateExpressionPaths(objective.demonstrates, `$.objectives[${index}].demonstrates`, issues);
  });

  definition.rules.forEach((rule, index) => {
    const path = `$.rules[${index}]`;
    if (!capabilities.has(rule.on)) issues.push(issue('semantic', 'capability.unsupported', `${path}.on`, `Rule uses capability not declared by renderer: ${rule.on}.`));
    rule.targets?.forEach((targetId) => {
      const object = objectById.get(targetId);
      if (!object) issues.push(issue('semantic', 'object.reference.missing', `${path}.targets`, `Unknown object: ${targetId}.`));
      else if (!object.affordances.includes(rule.on)) issues.push(issue('semantic', 'object.affordance.incompatible', `${path}.targets`, `${targetId} does not support ${rule.on}.`));
    });
    rule.after?.forEach((dependency) => {
      if (!ruleIds.has(dependency)) issues.push(issue('semantic', 'rule.reference.missing', `${path}.after`, `Unknown rule dependency: ${dependency}.`));
    });
    if (rule.when) validateExpressionPaths(rule.when, `${path}.when`, issues);
    rule.effects.forEach((effect: EffectDefinition, effectIndex) => {
      const effectPath = `${path}.effects[${effectIndex}]`;
      if ('path' in effect && !effect.path.startsWith('world.')) issues.push(issue('semantic', 'mutation.path.forbidden', `${effectPath}.path`, 'Definitions may mutate only world.* paths.'));
      if ((effect.type === 'achieve' || effect.type === 'demonstrate') && !objectiveIds.has(effect.objectiveId)) issues.push(issue('semantic', 'objective.reference.missing', `${effectPath}.objectiveId`, `Unknown objective: ${effect.objectiveId}.`));
      if (effect.type === 'finish' && !endingIds.has(effect.endingId)) issues.push(issue('semantic', 'ending.reference.missing', `${effectPath}.endingId`, `Unknown ending: ${effect.endingId}.`));
    });
  });

  if (hasRuleCycle(definition.rules)) issues.push(issue('semantic', 'rule.cycle', '$.rules', 'Rule ordering contains a cycle.'));
  return issues;
}

export function validateDefinition(input: unknown): ValidationResult {
  const structural = validateStructure(input);
  const semantic = structural.length === 0 ? validateSemantics(input as ExperienceDefinition) : [];
  return { valid: structural.length === 0 && semantic.length === 0, structural, semantic };
}

export function assertValidDefinition(input: unknown): asserts input is ExperienceDefinition {
  const result = validateDefinition(input);
  if (result.valid) return;
  const summary = [...result.structural, ...result.semantic]
    .map((item) => `${item.code} at ${item.path}`)
    .join(', ');
  throw new Error(`Invalid EduLab definition: ${summary}`);
}
