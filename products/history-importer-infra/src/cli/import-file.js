#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { Importer } from '../core/importer.js';
import { adapters } from '../providers/index.js';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
}

async function main() {
  const provider = arg('provider');
  const input = arg('input');
  const output = arg('output');

  if (!provider || !input || !output) {
    console.error('Usage: node src/cli/import-file.js --provider openai --input in.json --output out.json');
    process.exit(1);
  }

  const raw = await fs.readFile(path.resolve(input), 'utf8');
  const payload = JSON.parse(raw);

  const importer = new Importer(adapters);
  const result = await importer.import({ provider, payload });

  await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await fs.writeFile(path.resolve(output), JSON.stringify(result, null, 2), 'utf8');

  console.log(`Imported ${result.stats.conversationCount} conversations / ${result.stats.messageCount} messages`);
  console.log(`Output: ${path.resolve(output)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
