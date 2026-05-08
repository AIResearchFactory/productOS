import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { EncryptionService } from '../lib/encryption.mjs';
import { AIService } from '../lib/ai.mjs';
import { OutputParserService } from '../lib/output-parser.mjs';

test('Encryption/Decryption parity', async (t) => {
  const secret = 'sk-ant-test-key-12345';
  const encrypted = EncryptionService.encrypt(secret);
  assert.notStrictEqual(secret, encrypted);
  const decrypted = EncryptionService.decrypt(encrypted);
  assert.strictEqual(secret, decrypted);
});

test('Output Parser: file changes', async (t) => {
  const output = `
I will update the file now.
FILE: src/main.js
\`\`\`javascript
console.log("hello");
\`\`\`
  `;
  const changes = OutputParserService.parseFileChanges(output);
  assert.strictEqual(changes.length, 1);
  assert.strictEqual(changes[0].path, 'src/main.js');
  assert.strictEqual(changes[0].content, 'console.log("hello");');
});

test('Output Parser: artifact changes', async (t) => {
  const output = `
ARTIFACT: roadmap: Project Roadmap
\`\`\`markdown
# Goals
- Step 1
\`\`\`
  `;
  const changes = OutputParserService.parseArtifactChanges(output);
  assert.strictEqual(changes.length, 1);
  assert.strictEqual(changes[0].artifactType, 'roadmap');
  assert.strictEqual(changes[0].title, 'Project Roadmap');
  assert.strictEqual(changes[0].content, '# Goals\n- Step 1');
});

test('Provider Factory: custom CLI', async (t) => {
  const settings = {
    customClis: [
      { id: 'my-cli', name: 'My CLI', command: 'echo', args: ['{{input}}'] }
    ]
  };
  const provider = await AIService.createProvider('my-cli', settings);
  assert.strictEqual(provider.providerType(), 'my-cli');
});

test('Provider Factory: resolves configured local CLI commands', async () => {
  const originalPath = process.env.PATH;
  const binDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-provider-bin-'));
  const commandName = process.platform === 'win32' ? 'gemini.cmd' : 'gemini';
  const commandPath = path.join(binDir, commandName);
  const script = process.platform === 'win32'
    ? '@echo off\necho gemini 0.0.0\n'
    : '#!/bin/sh\necho gemini 0.0.0\n';

  try {
    await fs.writeFile(commandPath, script, process.platform === 'win32' ? undefined : { mode: 0o755 });
    if (process.platform !== 'win32') await fs.chmod(commandPath, 0o755);
    process.env.PATH = `${binDir}${path.delimiter}${originalPath || ''}`;

    const provider = await AIService.createProvider('geminiCli', { geminiCli: { command: 'gemini' } });
    assert.strictEqual(path.resolve(provider.config.command), path.resolve(commandPath));
  } finally {
    process.env.PATH = originalPath;
    await fs.rm(binDir, { recursive: true, force: true });
  }
});
