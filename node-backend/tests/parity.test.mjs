import { test } from 'node:test';
import assert from 'node:assert';
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
