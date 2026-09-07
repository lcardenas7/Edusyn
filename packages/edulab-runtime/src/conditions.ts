import type {
  Condition,
  Intent,
  JsonObject,
  JsonValue,
  ValueExpression,
} from './contracts.js';
import { compareText, jsonEquals } from './canonical.js';

export interface EvaluationContext {
  state: JsonObject;
  intent: Intent;
  generated: JsonObject;
}

function readPath(root: unknown, path: string): JsonValue | undefined {
  if (!path) return root as JsonValue;
  let current: unknown = root;
  for (const segment of path.split('.')) {
    if (Array.isArray(current)) {
      if (!/^\d+$/.test(segment)) return undefined;
      current = current[Number(segment)];
      continue;
    }
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current as JsonValue | undefined;
}

export function resolveValue(
  expression: ValueExpression,
  context: EvaluationContext,
): JsonValue | undefined {
  if ('literal' in expression) return expression.literal;
  const root = context[expression.source];
  return readPath(root, expression.path);
}

function compareOrdered(left: JsonValue | undefined, right: JsonValue | undefined): number | null {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (typeof left === 'string' && typeof right === 'string') return compareText(left, right);
  return null;
}

export function evaluateCondition(condition: Condition, context: EvaluationContext): boolean {
  switch (condition.op) {
    case 'all':
      return condition.conditions.every((child) => evaluateCondition(child, context));
    case 'any':
      return condition.conditions.some((child) => evaluateCondition(child, context));
    case 'not':
      return !evaluateCondition(condition.condition, context);
    case 'eq':
      return jsonEquals(resolveValue(condition.left, context), resolveValue(condition.right, context));
    case 'neq':
      return !jsonEquals(resolveValue(condition.left, context), resolveValue(condition.right, context));
    case 'lt': {
      const result = compareOrdered(resolveValue(condition.left, context), resolveValue(condition.right, context));
      return result !== null && result < 0;
    }
    case 'lte': {
      const result = compareOrdered(resolveValue(condition.left, context), resolveValue(condition.right, context));
      return result !== null && result <= 0;
    }
    case 'gt': {
      const result = compareOrdered(resolveValue(condition.left, context), resolveValue(condition.right, context));
      return result !== null && result > 0;
    }
    case 'gte': {
      const result = compareOrdered(resolveValue(condition.left, context), resolveValue(condition.right, context));
      return result !== null && result >= 0;
    }
    case 'in': {
      const item = resolveValue(condition.item, context);
      const collection = resolveValue(condition.collection, context);
      if (item === undefined || !Array.isArray(collection)) return false;
      return collection.some((candidate) => jsonEquals(candidate, item));
    }
    case 'contains': {
      const collection = resolveValue(condition.collection, context);
      const value = resolveValue(condition.value, context);
      if (value === undefined) return false;
      if (Array.isArray(collection)) return collection.some((candidate) => jsonEquals(candidate, value));
      return typeof collection === 'string' && typeof value === 'string' && collection.includes(value);
    }
    case 'exists':
      return resolveValue(condition.value, context) !== undefined;
  }
}
