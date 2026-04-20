import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const tauriApiPath = path.join(process.cwd(), 'src', 'api', 'tauri.ts');
const tauriSource = fs.readFileSync(tauriApiPath, 'utf8');
const fnMatch = tauriSource.match(/export const isTauriRuntime = \(\): boolean => \{[\s\S]*?\n\};/);

if (!fnMatch) {
  throw new Error('Could not locate isTauriRuntime in src/api/tauri.ts');
}

const jsSnippet = fnMatch[0]
  .replace('export const isTauriRuntime = (): boolean => {', 'globalThis.isTauriRuntime = () => {')
  .replace(/ as any/g, '');

function runWithWindow(windowValue) {
  const context = { globalThis: {}, window: windowValue };
  vm.createContext(context);
  vm.runInContext(jsSnippet, context);
  return context.globalThis.isTauriRuntime();
}

test('isTauriRuntime returns false when window is undefined', () => {
  const context = { globalThis: {} };
  vm.createContext(context);
  vm.runInContext(jsSnippet, context);
  assert.equal(context.globalThis.isTauriRuntime(), false);
});

test('isTauriRuntime returns false in normal browser-like context', () => {
  assert.equal(runWithWindow({}), false);
});

test('isTauriRuntime returns true when __TAURI__ is present', () => {
  assert.equal(runWithWindow({ __TAURI__: { core: true } }), true);
});
