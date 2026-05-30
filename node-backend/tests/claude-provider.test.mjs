import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';

import { ClaudeCodeProvider } from '../lib/providers/claude.mjs';

test('Claude provider uses print mode, strips inherited API key, and maps legacy sonnet model', async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'productos-claude-provider-'));
  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const fakeClaudePath = path.join(tempDir, 'fake-claude');
  await writeFile(
    fakeClaudePath,
    `#!/usr/bin/env node
const payload = {
  args: process.argv.slice(2),
  apiKey: process.env.ANTHROPIC_API_KEY || null,
  stdin: ''
};
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  payload.stdin += chunk;
});
process.stdin.on('end', () => {
  process.stdout.write(JSON.stringify(payload));
});
process.stdin.resume();
`,
  );
  await chmod(fakeClaudePath, 0o755);

  const originalKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'invalid-key-from-parent-env';
  t.after(() => {
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  const provider = new ClaudeCodeProvider({
    command: fakeClaudePath,
    model: 'claude-3-5-sonnet-20241022',
  });

  const result = await Promise.race([
    provider.chat({
      messages: [{ role: 'user', content: 'Reply with pong.' }],
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('provider.chat timed out')), 2000)),
  ]);

  const payload = JSON.parse(result.content);
  assert.deepStrictEqual(payload.args, [
    '--print',
    '--output-format',
    'text',
    '--dangerously-skip-permissions',
  ]);
  assert.strictEqual(payload.apiKey, null);
  assert.strictEqual(payload.stdin, 'Reply with pong.');
  assert.strictEqual(await provider.resolveModel(), 'sonnet');
});
