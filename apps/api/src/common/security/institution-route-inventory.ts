import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import * as ts from 'typescript';

export interface RouteScope {
  key: string;
  file: string;
  module: string;
  resolved: boolean;
  fingerprint: string;
}
export interface ScopeException {
  key: string;
  kind: 'pending-audit' | 'non-institutional';
  reason: string;
  fingerprint: string;
}
const verbs = new Set(['Get', 'Post', 'Put', 'Patch', 'Delete', 'Options', 'Head', 'All', 'Sse']);

/** Static regression contract, deliberately NOT a proof of service/query isolation. */
export function inspectSource(file: string, source: string): RouteScope[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const nest = new Map<string, string>();
  const nestNamespaces = new Set<string>();
  const resolvers = new Set<string>();
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamespaceImport(bindings) && statement.moduleSpecifier.text === '@nestjs/common') {
      nestNamespaces.add(bindings.name.text);
    }
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const item of bindings.elements) {
      const original = (item.propertyName ?? item.name).text;
      if (statement.moduleSpecifier.text === '@nestjs/common') nest.set(item.name.text, original);
      if (statement.moduleSpecifier.text.endsWith('/common/utils/institution-resolver') && original === 'requireInstitutionId') {
        resolvers.add(item.name.text);
      }
    }
  }
  const decorators = (node: ts.Node) => ts.canHaveDecorators(node) ? ts.getDecorators(node) ?? [] : [];
  const decoratorName = (d: ts.Decorator) => {
    if (!ts.isCallExpression(d.expression)) return undefined;
    const expression = d.expression.expression;
    if (ts.isIdentifier(expression)) return nest.get(expression.text);
    if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)
      && nestNamespaces.has(expression.expression.text)) return expression.name.text;
    return undefined;
  };
  const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
  const result: RouteScope[] = [];
  for (const cls of sf.statements.filter(ts.isClassDeclaration)) {
    if (!decorators(cls).some(d => decoratorName(d) === 'Controller')) continue;
    for (const method of cls.members.filter(ts.isMethodDeclaration)) {
      const routes = decorators(method).filter(d => verbs.has(decoratorName(d) ?? ''));
      if (!routes.length) continue;
      // Only an unconditional, awaited, top-level resolver counts. Comments, unused imports,
      // callbacks, conditional/dead calls and this.requireInstitutionId are not evidence.
      let resolved = false;
      for (const statement of method.body?.statements ?? []) {
        const expressions: (ts.Expression | undefined)[] = ts.isVariableStatement(statement)
          ? statement.declarationList.declarations.map(d => d.initializer)
          : ts.isExpressionStatement(statement) ? [statement.expression] : [];
        if (expressions.some(e => e && ts.isAwaitExpression(e) && ts.isCallExpression(e.expression)
          && ts.isIdentifier(e.expression.expression) && resolvers.has(e.expression.expression.text)
          && e.expression.arguments.length >= 2)) resolved = true;
        if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) break;
      }
      for (const route of routes) {
        const signature = printer.printNode(ts.EmitHint.Unspecified, route, sf);
        const fingerprint = createHash('sha256').update(
          sf.statements.filter(ts.isImportDeclaration).map(s => printer.printNode(ts.EmitHint.Unspecified, s, sf)).join('\n')
          + decorators(cls).map(d => printer.printNode(ts.EmitHint.Unspecified, d, sf)).join('\n')
          + printer.printNode(ts.EmitHint.Unspecified, method, sf),
        ).digest('hex');
        result.push({
          key: `${file}#${cls.name?.text}.${method.name.getText(sf)} ${signature}`,
          file, module: file.startsWith('modules/') ? file.split('/')[1] : '(app)', resolved, fingerprint,
        });
      }
    }
  }
  return result;
}

export function inventory(root: string): RouteScope[] {
  const result: RouteScope[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      // Scan every source file, so a controller in an unconventional filename is included.
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') && !entry.name.endsWith('.d.ts')) {
        result.push(...inspectSource(path.relative(root, full).split(path.sep).join('/'), fs.readFileSync(full, 'utf8')));
      }
    }
  };
  walk(root);
  return result.sort((a, b) => a.key.localeCompare(b.key));
}

export function violations(routes: RouteScope[], exceptions: ScopeException[]): string[] {
  const errors: string[] = [];
  const byKey = new Map(routes.map(r => [r.key, r]));
  const seen = new Set<string>();
  for (const exception of exceptions) {
    if (seen.has(exception.key)) errors.push(`Duplicate exception: ${exception.key}`);
    seen.add(exception.key);
    if (!['pending-audit', 'non-institutional'].includes(exception.kind) || exception.reason.trim().length < 30) {
      errors.push(`Unjustified exception: ${exception.key}`);
    }
    const route = byKey.get(exception.key);
    if (!route || route.resolved) errors.push(`Remove obsolete exception: ${exception.key}`);
    else if (route.fingerprint !== exception.fingerprint) errors.push(`Re-audit changed exception: ${exception.key}`);
  }
  for (const route of routes) {
    if (!route.resolved && !seen.has(route.key)) errors.push(`Missing requireInstitutionId: ${route.key}`);
  }
  if (byKey.size !== routes.length) errors.push('Duplicate route identities');
  return errors;
}
