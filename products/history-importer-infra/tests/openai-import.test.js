import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { Importer } from '../src/core/importer.js';
import { adapters } from '../src/providers/index.js';

async function run() {
  const samplePath = path.resolve('samples/openai-conversations.sample.json');
  const raw = await fs.readFile(samplePath, 'utf8');
  const payload = JSON.parse(raw);

  const importer = new Importer(adapters);
  const result = await importer.import({ provider: 'openai', payload });

  assert.equal(result.provider, 'openai');
  assert.equal(result.stats.conversationCount, 1);
  assert.equal(result.stats.messageCount, 2);

  const conv = result.conversations[0];
  assert.equal(conv.source, 'openai');
  assert.equal(conv.metadata.isCustomGpt, true);
  assert.equal(conv.messages[0].role, 'user');
  assert.equal(conv.messages[1].role, 'assistant');
  assert.match(conv.messages[1].text, /design provider adapters/i);

  console.log('✅ OpenAI import test passed');
}

run().catch((err) => {
  console.error('❌ OpenAI import test failed');
  console.error(err);
  process.exit(1);
});
