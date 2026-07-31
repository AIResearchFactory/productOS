import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';

import { GoogleCliProvider, GeminiCliProvider } from '../lib/providers/google.mjs';

test('Google CLI provider passes GEMINI_API_KEY to process environment', async (t) => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'productos-google-provider-'));
  const origHome = process.env.HOME;
  const origProjectsDir = process.env.PROJECTS_DIR;
  process.env.HOME = path.join(tempDir, 'home');
  process.env.PROJECTS_DIR = path.join(tempDir, 'projects');

  t.after(async () => {
    if (origHome === undefined) delete process.env.HOME;
    else process.env.HOME = origHome;
    if (origProjectsDir === undefined) delete process.env.PROJECTS_DIR;
    else process.env.PROJECTS_DIR = origProjectsDir;
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

  const provider = new GoogleCliProvider(
    {
      command: fakeGeminiPath,
      apiKeySecretId: 'GEMINI_API_KEY',
    },
    {
      GEMINI_API_KEY: 'test-gemini-key-123',
    },
  );

  const result = await provider.chat({
    messages: [{ role: 'user', content: 'Hello Google CLI' }],
  });

  const payload = JSON.parse(result.content);
  assert.strictEqual(payload.apiKey, 'test-gemini-key-123');
});

test('Google CLI provider produces friendly error for IneligibleTierError/UNSUPPORTED_CLIENT', async (t) => {
  const testMarkers = [
    'IneligibleTierError: OAuth client tier is deprecated.',
    'Error response: unsupported_client detail.',
    'Failed to authenticate antigravity service connection.'
  ];

  for (const markerText of testMarkers) {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'productos-google-provider-'));
    const origHome = process.env.HOME;
    const origProjectsDir = process.env.PROJECTS_DIR;
    process.env.HOME = path.join(tempDir, 'home');
    process.env.PROJECTS_DIR = path.join(tempDir, 'projects');

    const fakeGeminiScript = path.join(tempDir, 'fake-gemini.js');
    await writeFile(
      fakeGeminiScript,
      `process.stderr.write(${JSON.stringify(markerText)});
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

    const provider = new GoogleCliProvider({
      command: fakeGeminiPath,
    });

    try {
      await assert.rejects(
        async () => {
          await provider.chat({ messages: [{ role: 'user', content: 'Test' }] });
        },
        (err) => {
          assert(err.message.includes('Gemini Code Assist individual OAuth tier is no longer supported by Google'));
          assert(err.message.includes('Please use Google Antigravity CLI (agy)'));
          return true;
        }
      );
    } finally {
      if (origHome === undefined) delete process.env.HOME;
      else process.env.HOME = origHome;
      if (origProjectsDir === undefined) delete process.env.PROJECTS_DIR;
      else process.env.PROJECTS_DIR = origProjectsDir;
      await rm(tempDir, { recursive: true, force: true });
    }
  }
});

test('Google Antigravity provider metadata returns Google Antigravity', () => {
  const provider = new GoogleCliProvider({});
  const meta = provider.metadata();
  assert.strictEqual(meta.name, 'Google Antigravity');
  assert.strictEqual(GeminiCliProvider, GoogleCliProvider);
});
