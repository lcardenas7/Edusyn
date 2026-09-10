import * as fs from 'node:fs';
import * as path from 'node:path';
import { inventory, violations, ScopeException } from '../src/common/security/institution-route-inventory';

// Read-only: never refresh exceptions automatically to make the contract green.
const root = path.resolve(__dirname, '../src');
const routes = inventory(root);
const exceptions: ScopeException[] = JSON.parse(fs.readFileSync(
  path.join(root, 'common/security/institution-route-exceptions.json'), 'utf8',
));
const modules = ['(app)', ...fs.readdirSync(path.join(root, 'modules'), { withFileTypes: true })
  .filter(entry => entry.isDirectory()).map(entry => entry.name)].sort();
console.table(modules.map(module => {
  const entries = routes.filter(route => route.module === module);
  const keys = new Set(entries.map(route => route.key));
  return {
    module, routes: entries.length, direct: entries.filter(route => route.resolved).length,
    pending: exceptions.filter(e => keys.has(e.key) && e.kind === 'pending-audit').length,
    nonInstitutional: exceptions.filter(e => keys.has(e.key) && e.kind === 'non-institutional').length,
  };
}));
const errors = violations(routes, exceptions);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
}
