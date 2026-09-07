import { describe, expect, it } from 'vitest';
import type { ExperienceDefinition } from './contracts.js';
import { EDULAB_ENGINE_VERSION } from './constants.js';
import { validateDefinition } from './validator.js';

const literal = (value: boolean) => ({ literal: value } as const);

function validDefinition(): ExperienceDefinition {
  return {
    schemaVersion: 'edulab.experience/1',
    definitionId: 'fixture.validation',
    version: 1,
    engineVersion: EDULAB_ENGINE_VERSION,
    title: 'Validation fixture',
    supportedModes: ['EXPLORE'],
    requiredCapabilities: ['actuate'],
    initialWorld: { ready: false },
    objects: [
      { id: 'control', type: 'control', initialState: { active: false }, affordances: ['actuate'] },
    ],
    objectives: [
      {
        id: 'complete',
        statement: 'Complete the system.',
        achieved: { op: 'eq', left: { source: 'state', path: 'world.ready' }, right: literal(true) },
        demonstrates: { op: 'eq', left: { source: 'state', path: 'world.ready' }, right: literal(true) },
      },
    ],
    rules: [
      {
        id: 'activate',
        on: 'actuate',
        targets: ['control'],
        effects: [
          { type: 'set', path: 'world.ready', value: literal(true) },
          { type: 'finish', endingId: 'done' },
        ],
      },
    ],
    endings: [{ id: 'done', label: 'Done' }],
  };
}

describe('definition validator', () => {
  it('accepts a structurally and semantically valid definition', () => {
    expect(validateDefinition(validDefinition())).toEqual({ valid: true, structural: [], semantic: [] });
  });

  it('rejects an invalid schema, enum and duplicate id structurally', () => {
    const definition = validDefinition() as unknown as Record<string, unknown>;
    definition.schemaVersion = 'unknown';
    definition.requiredCapabilities = ['teleport'];
    definition.objects = [
      { id: 'same', type: 'control', initialState: {}, affordances: ['actuate'] },
      { id: 'same', type: 'control', initialState: {}, affordances: ['actuate'] },
    ];
    const result = validateDefinition(definition);
    expect(result.valid).toBe(false);
    expect(result.structural.map((item) => item.code)).toEqual(expect.arrayContaining([
      'schema.unsupported',
      'capabilities.invalid',
      'id.duplicate',
    ]));
  });

  it('rejects references to missing objects', () => {
    const definition = validDefinition();
    definition.rules[0]!.targets = ['missing-control'];
    const result = validateDefinition(definition);
    expect(result.semantic.map((item) => item.code)).toContain('object.reference.missing');
  });

  it.each(['achieved', 'demonstrates'] as const)('rejects an objective without %s', (field) => {
    const definition = validDefinition() as unknown as { objectives: Record<string, unknown>[] };
    delete definition.objectives[0]![field];
    const result = validateDefinition(definition);
    expect(result.valid).toBe(false);
    expect(result.semantic.map((item) => item.code)).toContain(`objective.${field}.missing`);
  });

  it('rejects a rule whose capability is not declared', () => {
    const definition = validDefinition();
    definition.requiredCapabilities = [];
    const result = validateDefinition(definition);
    expect(result.semantic.map((item) => item.code)).toContain('capability.unsupported');
  });

  it('rejects a finish effect that references an unknown ending', () => {
    const definition = validDefinition();
    definition.rules[0]!.effects[1] = { type: 'finish', endingId: 'missing' };
    const result = validateDefinition(definition);
    expect(result.semantic.map((item) => item.code)).toContain('ending.reference.missing');
  });

  it('rejects cyclic rule ordering', () => {
    const definition = validDefinition();
    definition.rules = [
      { ...definition.rules[0]!, id: 'first', after: ['second'] },
      { ...definition.rules[0]!, id: 'second', after: ['first'] },
    ];
    const result = validateDefinition(definition);
    expect(result.semantic.map((item) => item.code)).toContain('rule.cycle');
  });

  it('rejects definitions that try to mutate runtime metadata', () => {
    const definition = validDefinition();
    definition.rules[0]!.effects[0] = { type: 'set', path: 'version', value: literal(true) };
    const result = validateDefinition(definition);
    expect(result.semantic.map((item) => item.code)).toContain('mutation.path.forbidden');
  });
});
