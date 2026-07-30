import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';

import { GeminiCliProvider } from '../lib/providers/gemini.mjs';

test('Gemini CLI provider passes GEMINI_API_KEY to process environment', async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'productos-gemini-provider-'));
  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const fakeGeminiScript = path.join(tempDir, 'fake-gemini.js');
  await writeFile(
    fakeGeminiScript,
    `process.stdin.resume();
process.stdin.on('end', () => {
  process.stdout.write(JSON.stringify({
    args: process.argv.slice(2),
    apiKey: process.env.GEMINI_API_KEY || null
  }));
});
`,
  );

  const fakeGeminiPath = process.platform === 'win32'
    ? path.join(tempDir, 'fake-gemini.cmd')
    : path.join(tempDir, 'fake-gemini');
  await writeFile(
    fakeGeminiPath,
    process.platform === 'win32'
      ? `@echo off\r\nnode "%~dp0fake-gemini.js" %*\r\n`
      : `#!/bin/sh\nexec node "$(dirname "$0")/fake-gemini.js" "$@"\n`,
  );
  await chmod(fakeGeminiPath, 0o755);

  const provider = new GeminiCliProvider(
    {
      command: fakeGeminiPath,
      apiKeySecretId: 'GEMINI_API_KEY',
    },
    {
      GEMINI_API_KEY: 'test-gemini-key-123',
    },
  );

  const result = await provider.chat({
    messages: [{ role: 'user', content: 'Hello Gemini' }],
  });

  const payload = JSON.parse(result.content);
  assert.strictEqual(payload.apiKey, 'test-gemini-key-123');
});

test('Gemini CLI provider produces friendly error for IneligibleTierError/UNSUPPORTED_CLIENT', async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'productos-gemini-provider-'));
  t.after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  const fakeGeminiScript = path.join(tempDir, 'fake-gemini.js');
  await writeFile(
    fakeGeminiScript,
    `process.stderr.write("IneligibleTierError: This client is no longer supported for Gemini Code Assist for individuals.");
process.exit(1);
`,
  );

  const fakeGeminiPath = process.platform === 'win32'
    ? path.join(tempDir, 'fake-gemini.cmd')
    : path.join(tempDir, 'fake-gemini');
  await writeFile(
    fakeGeminiPath,
    process.platform === 'win32'
      ? `@echo off\r\nnode "%~dp0fake-gemini.js" %*\r\n`
      : `#!/bin/sh\nexec node "$(dirname "$0")/fake-gemini.js" "$@"\n`,
  );
  await chmod(fakeGeminiPath, 0o755);

  const provider = new GeminiCliProvider({
    command: fakeGeminiPath,
  });

  await assert.rejects(
    async () => {
      await provider.chat({ messages: [{ role: 'user', content: 'Test' }] });
    },
    (err) => {
      assert(err.message.includes('Gemini Code Assist individual OAuth tier is no longer supported by Google'));
      assert(err.message.includes('Please obtain a Gemini API key from Google AI Studio'));
      return true;
    }
  );
});
