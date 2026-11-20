import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { CustomCliProvider, parseCustomCommand } from '../lib/providers/custom.mjs';

let tempDir;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-custom-cli-'));
});

afterEach(async () => {
  await fs.rm(tempDir, { recursive: true, force: true });
});

test('parseCustomCommand splits multi-word CLI command into executable and inlineArgs', () => {
  assert.deepStrictEqual(parseCustomCommand('Bob run --trust --format stream-json'), {
    executable: 'Bob',
    inlineArgs: ['run', '--trust', '--format', 'stream-json'],
  });
});

test('parseCustomCommand handles quoted executables, spaces, and single/double quoted arguments', () => {
  assert.deepStrictEqual(
    parseCustomCommand('"/Applications/My App/bob" run --prompt "hello world" --tag=\'a b\''),
    {
      executable: '/Applications/My App/bob',
      inlineArgs: ['run', '--prompt', 'hello world', '--tag=a b'],
    }
  );
});

test('parseCustomCommand preserves Windows backslashes in quoted paths', () => {
  assert.deepStrictEqual(
    parseCustomCommand('"C:\\Program Files\\Bob\\bob.exe" run --trust', {
      platform: 'win32',
      pathExists: () => false,
    }),
    {
      executable: 'C:\\Program Files\\Bob\\bob.exe',
      inlineArgs: ['run', '--trust'],
    }
  );
});

test('parseCustomCommand treats unquoted existing file path with spaces as a single executable', () => {
  const pathWithSpaces = '/Applications/My App/bob-cli';
  assert.deepStrictEqual(
    parseCustomCommand(pathWithSpaces, { pathExists: (p) => p === pathWithSpaces }),
    {
      executable: pathWithSpaces,
      inlineArgs: [],
    }
  );
});

test('parseCustomCommand rejects empty commands, control characters, and unclosed quotes', () => {
  assert.throws(() => parseCustomCommand(''), /empty/);
  assert.throws(() => parseCustomCommand('   '), /empty/);
  assert.throws(() => parseCustomCommand(null), /empty/);
  assert.throws(() => parseCustomCommand('bob run\nrm -rf /'), /forbidden control characters/);
  assert.throws(() => parseCustomCommand('bob\0run'), /forbidden control characters/);
  assert.throws(() => parseCustomCommand('bob --prompt "unclosed'), /unclosed quote/);
});

test('CustomCliProvider.chat spawns multi-word command without shell and passes stdin prompt', async () => {
  const scriptPath = path.join(tempDir, 'mock-cli.mjs');
  await fs.writeFile(
    scriptPath,
    `
      import fs from 'node:fs';
      const stdinText = fs.readFileSync(0, 'utf8');
      console.log(JSON.stringify({ argv: process.argv.slice(2), stdin: stdinText }));
    `,
    'utf8'
  );

  const provider = new CustomCliProvider({
    id: 'bobshell-test',
    name: 'BobShell',
    command: `"${process.execPath}" "${scriptPath}" run --trust --format stream-json`,
  });

  const res = await provider.chat({
    messages: [{ role: 'user', content: 'Draft Q4 roadmap' }],
  });

  const parsed = JSON.parse(res.content);
  assert.deepStrictEqual(parsed.argv, ['run', '--trust', '--format', 'stream-json']);
  assert.strictEqual(parsed.stdin, 'Draft Q4 roadmap');
});

test('CustomCliProvider.chat passes inline {{input}} with shell metacharacters literally without shell execution or stdin write', async () => {
  const scriptPath = path.join(tempDir, 'mock-inline-input.mjs');
  const markerPath = path.join(tempDir, 'pwned.txt');
  await fs.writeFile(
    scriptPath,
    `
      import fs from 'node:fs';
      const stdinText = fs.readFileSync(0, 'utf8');
      console.log(JSON.stringify({ argv: process.argv.slice(2), stdinLength: stdinText.length }));
    `,
    'utf8'
  );

  const payload = `hello $(touch "${markerPath}"); rm -rf /`;
  const provider = new CustomCliProvider({
    id: 'bobshell-inline',
    name: 'BobShell',
    command: `"${process.execPath}" "${scriptPath}" run --prompt "{{input}}"`,
  });

  const res = await provider.chat({
    messages: [{ role: 'user', content: payload }],
  });

  const parsed = JSON.parse(res.content);
  assert.deepStrictEqual(parsed.argv, ['run', '--prompt', payload]);
  assert.strictEqual(parsed.stdinLength, 0, 'stdin must not receive prompt when {{input}} placeholder is used');
  const markerCreated = await fs.access(markerPath).then(() => true).catch(() => false);
  assert.strictEqual(markerCreated, false, 'shell metacharacters must never be executed by a shell');
});

test('CustomCliProvider.chat blocks dangerous apiKeyEnvVar overrides', async () => {
  for (const dangerousVar of ['NODE_OPTIONS', 'PATH', 'LD_PRELOAD']) {
    const provider = new CustomCliProvider(
      {
        id: 'unsafe-env-cli',
        name: 'UnsafeEnvCli',
        command: `${process.execPath} -e "process.exit(0)"`,
        apiKeySecretId: 'TEST_SECRET',
        apiKeyEnvVar: dangerousVar,
      },
      { TEST_SECRET: 'secret-value' }
    );

    await assert.rejects(
      () => provider.chat({ messages: [{ role: 'user', content: 'hi' }] }),
      { statusCode: 400, message: new RegExp(`Blocked unsafe apiKeyEnvVar name: ${dangerousVar}`) }
    );
  }
});
