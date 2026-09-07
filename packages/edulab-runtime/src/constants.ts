import type { Primitive } from './contracts.js';

export const EDULAB_ENGINE_VERSION = '0.1.0';
export const EDULAB_SCHEMA_VERSION = 'edulab.experience/1';

export const PRIMITIVES: readonly Primitive[] = [
  'inspect',
  'pick',
  'place',
  'input',
  'sequence',
  'adjust',
  'actuate',
  'navigate',
];
