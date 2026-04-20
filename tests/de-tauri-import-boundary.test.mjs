import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const srcRoot = path.join(repoRoot, 'src');

const allowedDirectTauriImports = new Set([
  'src/api/app.ts',
  'src/api/runtime.ts',
  'src/api/tauri.ts',
]);

function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(fullPath));
    } else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

test('UI/application files do not import from @/api/tauri directly', () => {
  const files = walk(srcRoot);
  const violations = [];

  for (const file of files) {
    const relative = path.relative(repoRoot, file).replaceAll('\\', '/');
    if (allowedDirectTauriImports.has(relative)) continue;

    const content = fs.readFileSync(file, 'utf8');
    if (content.includes("@/api/tauri") || content.includes("../api/tauri") || content.includes("./api/tauri")) {
      violations.push(relative);
    }
  }

  assert.deepEqual(
    violations,
    [],
    `Found forbidden direct tauri imports outside runtime layer: ${violations.join(', ')}`,
  );
});
