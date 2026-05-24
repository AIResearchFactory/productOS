import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';

import { OpenAiCliProvider } from '../lib/providers/openai.mjs';

test('OpenAI Codex provider closes stdin and uses modelAlias', async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'productos-openai-provider-'));
  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const fakeCodexPath = path.join(tempDir, 'fake-codex');
  await writeFile(
    fakeCodexPath,
    `#!/usr/bin/env node
const payload = {
  args: process.argv.slice(2),
  stdin: '',
  apiKey: process.env.OPENAI_API_KEY || null
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
  await chmod(fakeCodexPath, 0o755);

  const provider = new OpenAiCliProvider(
    {
      command: fakeCodexPath,
      modelAlias: 'gpt-4.1-mini',
      apiKeySecretId: 'OPENAI_API_KEY',
    },
    {
      OPENAI_API_KEY: 'sk-test-123',
    },
  );

  const result = await Promise.race([
    provider.chat({
      messages: [{ role: 'user', content: 'Reply with pong.' }],
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('provider.chat timed out')), 2000)),
  ]);

  const payload = JSON.parse(result.content);
  assert.deepStrictEqual(payload.args, [
    'exec',
    '--skip-git-repo-check',
    '-c',
    'model_provider_options.store=false',
    '--model',
    'gpt-4.1-mini',
  ]);
  assert.strictEqual(payload.stdin, 'Reply with pong.');
  assert.strictEqual(payload.apiKey, 'sk-test-123');
  assert.strictEqual(await provider.resolveModel(), 'gpt-4.1-mini');
});

test('OpenAI Codex provider falls back to the account default model for legacy ChatGPT logins', async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'productos-openai-provider-'));
  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const fakeCodexPath = path.join(tempDir, 'fake-codex');
  await writeFile(
    fakeCodexPath,
    `#!/usr/bin/env node
process.stdin.resume();
process.stdin.on('end', () => {
  process.stdout.write(JSON.stringify({ args: process.argv.slice(2) }));
});
`,
  );
  await chmod(fakeCodexPath, 0o755);

  const provider = new OpenAiCliProvider({
    command: fakeCodexPath,
    modelAlias: 'gpt-4o',
  });

  const result = await Promise.race([
    provider.chat({
      messages: [{ role: 'user', content: 'Reply with pong.' }],
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('provider.chat timed out')), 2000)),
  ]);

  const payload = JSON.parse(result.content);
  assert.deepStrictEqual(payload.args, [
    'exec',
    '--skip-git-repo-check',
    '-c',
    'model_provider_options.store=false',
  ]);
  assert.strictEqual(await provider.resolveModel(), 'codex-account-default');
});
