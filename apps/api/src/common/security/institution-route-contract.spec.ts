import * as fs from 'node:fs';
import * as path from 'node:path';
import { inspectSource, inventory, violations, ScopeException } from './institution-route-inventory';

const fixture = (body: string, extra = '') => `
  import { Controller, Get as Read } from '@nestjs/common';
  import { requireInstitutionId as tenant } from '../../common/utils/institution-resolver';
  @Controller('example') class Example {
    @Read(':id') async read(req: any) { ${body} }
    ${extra}
  }`;

describe('Institution route structural contract (not a completed isolation audit)', () => {
  it('all API routes resolve institution or have an exact, documented exception', () => {
    const root = path.resolve(__dirname, '../..');
    const exceptions: ScopeException[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'institution-route-exceptions.json'), 'utf8'));
    const routes = inventory(root);
    expect(routes.length).toBeGreaterThan(1000);
    expect(violations(routes, exceptions)).toEqual([]);
  });

  it('a new unprotected route fails even inside an existing excepted controller', () => {
    const before = inspectSource('unusual.ts', fixture('return service.read();'));
    const exceptions: ScopeException[] = before.map(r => ({ ...r, kind: 'pending-audit', reason: 'Existing debt awaiting an individual service audit.' }));
    const after = inspectSource('unusual.ts', fixture('return service.read();', '@Read("new") newRoute() { return service.read(); }'));
    expect(violations(after, exceptions)).toEqual([expect.stringContaining('Missing requireInstitutionId')]);
  });

  it('removing the resolver from a protected route fails', () => {
    expect(violations(inspectSource('example.ts', fixture('const id = await tenant(prisma, req); return service.read(id);')), [])).toEqual([]);
    expect(violations(inspectSource('example.ts', fixture('return service.read();')), [])).toHaveLength(1);
  });

  it.each([
    '// requireInstitutionId(prisma, req)\nreturn service.read();',
    'const text = "requireInstitutionId"; return service.read();',
    'tenant(prisma, req); return service.read();',
    'if (false) { await tenant(prisma, req); } return service.read();',
    'const f = async () => await tenant(prisma, req); return service.read();',
    'await this.requireInstitutionId(prisma, req); return service.read();',
    'return service.read(); await tenant(prisma, req);',
  ])('does not accept textual or non-executed resolver evidence: %s', body => {
    expect(inspectSource('example.ts', fixture(body))[0].resolved).toBe(false);
  });

  it('an unrelated function with the same name is not the trusted resolver', () => {
    const source = fixture('await tenant(prisma, req);').replace('../../common/utils/institution-resolver', './fake');
    expect(inspectSource('example.ts', source)[0].resolved).toBe(false);
  });

  it('includes namespace decorators, multiple controllers and SSE in any source filename', () => {
    const source = `import * as Nest from '@nestjs/common';
      @Nest.Controller('a') class A { @Nest.Sse('events') events() {} }
      @Nest.Controller('b') class B { @Nest.All() anything() {} }`;
    expect(violations(inspectSource('another-name.ts', source), [])).toHaveLength(2);
  });

  it('changed and obsolete exceptions fail instead of hiding regressions', () => {
    const [route] = inspectSource('example.ts', fixture('return service.read();'));
    const exception: ScopeException = { ...route, kind: 'pending-audit', reason: 'Pending manual audit of service isolation and ownership.' };
    expect(violations(inspectSource('example.ts', fixture('return service.write();')), [exception])).toEqual([expect.stringContaining('Re-audit')]);
    expect(violations([], [exception])).toEqual([expect.stringContaining('obsolete')]);
  });
});
