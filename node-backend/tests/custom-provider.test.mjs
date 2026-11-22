import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import {
  CustomCliProvider,
  parseCustomCommand,
  extractModelFromArgs,
  extractTextFromJsonLine,
  extractUsageMetadataFromJson,
} from '../lib/providers/custom.mjs';

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

test('CustomCliProvider.resolveModel checks config.model, --model/-m flags, and provider fallbacks', async () => {
  assert.strictEqual(
    await new CustomCliProvider({ id: 'c1', name: 'BobShell', model: 'claude-sonnet-4-6', command: 'bob --model gpt-4o' }).resolveModel(),
    'claude-sonnet-4-6'
  );
  assert.strictEqual(
    await new CustomCliProvider({ id: 'c2', name: 'BobShell', command: 'bob run --model claude-opus-4-6' }).resolveModel(),
    'claude-opus-4-6'
  );
  assert.strictEqual(
    await new CustomCliProvider({ id: 'c3', name: 'BobShell', command: 'bob run', args: ['-m=gpt-4o'] }).resolveModel(),
    'gpt-4o'
  );
  assert.strictEqual(
    await new CustomCliProvider({ id: 'c4', name: 'BobShell', command: 'bob run' }).resolveModel(),
    'BobShell'
  );
  assert.strictEqual(
    await new CustomCliProvider({ id: '', name: '', command: 'bob', isCloud: true }).resolveModel(),
    'custom-cloud-model'
  );
  assert.strictEqual(
    await new CustomCliProvider({ id: '', name: '', command: 'ollama', isCloud: false }).resolveModel(),
    'custom-local-model'
  );
  assert.strictEqual(extractModelFromArgs(['run', '--model', 'gemini-2.5-pro']), 'gemini-2.5-pro');
  assert.strictEqual(extractModelFromArgs(['run', '--prompt', '{{input}}']), null);
});

test('CustomCliProvider.chat preserves first JSONL chunk text and extracts usage/cost metadata', async () => {
  const scriptPath = path.join(tempDir, 'mock-stream-json.mjs');
  await fs.writeFile(
    scriptPath,
    `
      process.stdout.write(JSON.stringify({ type: 'init', model: 'claude-sonnet-4-6' }) + '\\n');
      process.stdout.write(JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Hello ' }] } }) + '\\n{"delta":');
      setTimeout(() => {
        process.stdout.write('"world!"}\\n');
        process.stdout.write(JSON.stringify({
          type: 'result',
          usage: { input_tokens: 1200, output_tokens: 340, cache_read_input_tokens: 500 },
          total_cost_usd: 0.0123
        }) + '\\n');
      }, 20);
    `,
    'utf8'
  );

  const provider = new CustomCliProvider({
    id: 'bob-stream',
    name: 'BobStream',
    command: `"${process.execPath}" "${scriptPath}"`,
  });

  const deltas = [];
  const res = await provider.chat({
    messages: [{ role: 'user', content: 'Say hello' }],
    onDelta: (chunk) => deltas.push(chunk),
  });

  assert.strictEqual(res.content, 'Hello world!');
  assert.strictEqual(deltas.join(''), 'Hello world!');
  assert.ok(res.metadata);
  assert.strictEqual(res.metadata.model_used, 'claude-sonnet-4-6');
  assert.strictEqual(res.metadata.tokens_in, 1200);
  assert.strictEqual(res.metadata.tokens_out, 340);
  assert.strictEqual(res.metadata.tokens_cache_read, 500);
  assert.strictEqual(res.metadata.cost_usd, 0.0123);
});

test('CustomCliProvider.chat extracts tokens/model from single-line JSONL without cost_usd', async () => {
  const scriptPath = path.join(tempDir, 'mock-single-jsonl.mjs');
  await fs.writeFile(
    scriptPath,
    `
      process.stdout.write(JSON.stringify({
        content: 'Single chunk reply',
        model: 'bob-v2',
        usage: { prompt_tokens: 2500, completion_tokens: 600 }
      }));
    `,
    'utf8'
  );

  const provider = new CustomCliProvider({
    id: 'bob-single',
    name: 'BobSingle',
    command: `"${process.execPath}" "${scriptPath}"`,
  });

  const res = await provider.chat({
    messages: [{ role: 'user', content: 'Hi' }],
  });

  assert.strictEqual(res.content, 'Single chunk reply');
  assert.ok(res.metadata);
  assert.strictEqual(res.metadata.model_used, 'bob-v2');
  assert.strictEqual(res.metadata.tokens_in, 2500);
  assert.strictEqual(res.metadata.tokens_out, 600);
  assert.strictEqual(res.metadata.cost_usd, 0);

  assert.strictEqual(extractTextFromJsonLine({ type: 'user', message: 'skip me' }), '');
  const acc = { model_used: '', tokens_in: 0, tokens_out: 0, tokens_cache_read: 0, tokens_cache_write: 0, tokens_reasoning: 0, cost_usd: 0, hasMetadata: false };
  extractUsageMetadataFromJson({ stats: { models: { 'gemini-2.5-pro': { tokens: { prompt: 100, candidates: 50, cached: 10, thoughts: 5 } } } } }, acc);
  assert.strictEqual(acc.model_used, 'gemini-2.5-pro');
  assert.strictEqual(acc.tokens_in, 100);
  assert.strictEqual(acc.tokens_out, 50);
  assert.strictEqual(acc.tokens_cache_read, 10);
  assert.strictEqual(acc.tokens_reasoning, 5);
});
