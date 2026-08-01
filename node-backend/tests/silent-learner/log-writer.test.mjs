import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { appendKnowledgeLog, formatKnowledgeLogEntry, getKnowledgeLog } from '../../../node-backend/lib/silent-learner/log-writer.mjs';

let tempProjectsDir;
let tempHomeDir;
let projectPath;
const projectId = 'log-writer-project';

beforeEach(async () => {
  tempProjectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-log-writer-'));
  process.env.PROJECTS_DIR = tempProjectsDir;
  tempHomeDir = path.join(tempProjectsDir, 'home');
  await fs.mkdir(tempHomeDir, { recursive: true });
  process.env.HOME = tempHomeDir;

  projectPath = path.join(tempProjectsDir, projectId);
  await fs.mkdir(path.join(projectPath, '.metadata'), { recursive: true });
  await fs.writeFile(path.join(projectPath, '.metadata', 'project.json'), JSON.stringify({ id: projectId, name: 'Log Test' }));
});

afterEach(async () => {
  await fs.rm(tempProjectsDir, { recursive: true, force: true });
  delete process.env.PROJECTS_DIR;
  delete process.env.HOME;
});

test('formatKnowledgeLogEntry creates a grep-friendly markdown bullet', () => {
  const entry = formatKnowledgeLogEntry('import', {
    artifact: { title: 'Alpha PRD', path: 'prds/alpha.md' },
    source: 'drop-zone',
  }, new Date('2026-06-19T00:00:00.000Z'));

  assert.strictEqual(entry, '- 2026-06-19T00:00:00.000Z | import | artifact: [Alpha PRD](prds/alpha.md) | source: drop-zone');
});

test('appendKnowledgeLog creates log.md and appends entries', async () => {
  await appendKnowledgeLog(projectId, 'import', { artifact: { title: 'Alpha', path: 'prds/alpha.md' } });
  await appendKnowledgeLog(projectId, 'lint', { message: 'no findings', count: 0 });

  const content = await fs.readFile(path.join(projectPath, 'log.md'), 'utf8');
  assert.match(content, /^# Knowledge Event Log/m);
  assert.match(content, /\| import \| artifact: \[Alpha\]\(prds\/alpha\.md\)/);
  assert.match(content, /\| lint \| message: no findings \| count: 0/);
});

test('getKnowledgeLog returns paginated entries', async () => {
  await appendKnowledgeLog(projectId, 'learn', { message: 'first' });
  await appendKnowledgeLog(projectId, 'learn', { message: 'second' });
  await appendKnowledgeLog(projectId, 'learn', { message: 'third' });

  const page = await getKnowledgeLog(projectId, { offset: 1, limit: 1 });

  assert.strictEqual(page.total, 3);
  assert.strictEqual(page.entries.length, 1);
  assert.match(page.entries[0], /second/);
  assert.strictEqual(page.hasMore, true);
  assert.strictEqual(page.nextOffset, 2);
});
