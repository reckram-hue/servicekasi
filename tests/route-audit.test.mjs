import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const root = path.resolve('src');
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]); }
const appFiles = files(path.join(root, 'app')).filter((file) => /\.(tsx?|jsx?)$/.test(file));
const routes = appFiles.filter((file) => /[\\/](page|route)\.tsx?$/.test(file)).map((file) => '/' + path.relative(path.join(root, 'app'), path.dirname(file)).split(path.sep).filter((part) => part && !part.startsWith('(')).join('/'));
const active = new Map();
function visit(file) {
  if (active.has(file)) return;
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  active.set(file, source);
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) || !ts.isStringLiteral(node.moduleSpecifier) || node.importClause?.isTypeOnly) continue;
    const spec = node.moduleSpecifier.text;
    const base = spec.startsWith('@/') ? path.join(root, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : null;
    if (!base) continue;
    const resolved = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')].find((candidate) => existsSync(candidate) && /\.(tsx?|jsx?)$/.test(candidate));
    if (resolved) visit(resolved);
  }
}
appFiles.forEach(visit);

test('literal application navigation targets resolve to registered pages, not an accidental dynamic ID', () => {
  const missing = [];
  for (const [file, source] of active) {
    function walk(node) {
      let value;
      if (ts.isJsxAttribute(node) && node.name.getText() === 'href' && node.initializer && ts.isStringLiteral(node.initializer)) value = node.initializer.text;
      if (ts.isPropertyAssignment(node) && node.name.getText() === 'href' && ts.isStringLiteral(node.initializer)) value = node.initializer.text;
      if (ts.isCallExpression(node) && /^(redirect|router\.(push|replace))$/.test(node.expression.getText()) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) value = node.arguments[0].text;
      if (value?.startsWith('/') && !value.startsWith('//')) {
        const route = value.split(/[?#]/)[0];
        if (!routes.includes(route) && !route.startsWith('/uploads/') && !/\.[a-z]+$/i.test(route)) missing.push(`${path.relative(root, file)}: ${value}`);
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
  }
  assert.deepEqual(missing, []);
});

test('reachable components use shared date pickers and scrolling time controls', () => {
  const oldInputs = [];
  for (const [file, source] of active) {
    if (file.endsWith('DateTimeInputs.tsx')) continue;
    function walk(node) {
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText() === 'input') {
        const type = node.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText() === 'type');
        if (type?.initializer && ts.isStringLiteral(type.initializer) && ['date', 'time', 'datetime-local'].includes(type.initializer.text)) oldInputs.push(path.relative(root, file));
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
  }
  assert.deepEqual(oldInputs, []);
});
