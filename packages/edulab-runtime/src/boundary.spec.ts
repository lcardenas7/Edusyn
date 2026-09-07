import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '..', '..');

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return ['.ts', '.tsx'].includes(extname(path)) ? [path] : [];
  });
}

describe('runtime boundary', () => {
  it('has no framework, renderer, persistence or network runtime dependency', () => {
    const packageJson = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(packageJson.dependencies ?? {}).toEqual({});

    const source = sourceFiles(join(packageRoot, 'src'))
      .filter((path) => !path.endsWith('.spec.ts'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    expect(source).not.toMatch(/from\s+['"](?:react|pixi|@pixi|@nestjs|@prisma|prisma|aws-sdk|@aws-sdk|r2)(?:\/|['"])/i);
    expect(source).not.toMatch(/\b(?:window|document|fetch|XMLHttpRequest|WebSocket|Math\.random|Date\.now)\b/);
  });

  it('is absent from the eager web source graph', () => {
    const webSource = sourceFiles(join(repositoryRoot, 'apps', 'web', 'src'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');
    expect(webSource).not.toContain('@edusyn/edulab-runtime');
    expect(webSource).not.toContain('packages/edulab-runtime');
  });
});
