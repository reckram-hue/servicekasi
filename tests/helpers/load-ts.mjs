import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileFunction } from 'node:vm';
import ts from 'typescript';

// Execute source modules with explicit boundary doubles. Unlisted imports fail
// closed so tests cannot accidentally connect to the live database or storage.
export function load(relativePath, dependencies = {}) {
  const filename = fileURLToPath(new URL(`../../${relativePath}`, import.meta.url));
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX,
    },
    fileName: filename,
  });
  const loaded = { exports: {} };
  compileFunction(outputText, ['require', 'module', 'exports'], { filename })((name) => {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
    return dependencies[name];
  }, loaded, loaded.exports);
  return loaded.exports;
}
