import type { JsonObject, JsonValue } from './contracts.js';

export function cloneJson<T extends JsonValue>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneJson(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: JsonObject = {};
    for (const key of Object.keys(value)) {
      const item = value[key];
      if (item !== undefined) result[key] = cloneJson(item);
    }
    return result as T;
  }
  return (Object.is(value, -0) ? 0 : value) as T;
}

export function canonicalize(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const result: JsonObject = {};
    for (const key of Object.keys(value).sort()) {
      const item = value[key];
      if (item !== undefined) result[key] = canonicalize(item);
    }
    return result;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Canonical JSON only accepts finite numbers.');
    return Object.is(value, -0) ? 0 : value;
  }
  return value;
}

export function canonicalStringify(value: JsonValue): string {
  return JSON.stringify(canonicalize(value));
}

export function stableTextHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Stable identity/replay hash. It is not a cryptographic integrity signature. */
export function hashCanonical(value: JsonValue): string {
  return `edulab-fnv1a32-${stableTextHash(canonicalStringify(value))}`;
}

export function jsonEquals(left: JsonValue | undefined, right: JsonValue | undefined): boolean {
  if (left === undefined || right === undefined) return left === right;
  return canonicalStringify(left) === canonicalStringify(right);
}
