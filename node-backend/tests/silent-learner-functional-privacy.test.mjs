import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { createProject } from '../lib/projects.mjs';
import * as Store from '../lib/silent-learner/learning-store.mjs';
import * as SilentLearner from '../lib/silent-learner/index.mjs';
import { classifyInteraction } from '../lib/silent-learner/privacy-filter.mjs';
import { computeSemanticAlignment, getOrGenerateSummary } from '../lib/silent-learner/vector-index.mjs';

let tempProjectsDir;
let project;

beforeEach(async () => {
  tempProjectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-sl-functional-'));
  process.env.PROJECTS_DIR = tempProjectsDir;
  process.env.APP_DATA_DIR = path.join(tempProjectsDir, 'app-data');
  await fs.mkdir(process.env.APP_DATA_DIR, { recursive: true });
  await fs.writeFile(
    path.join(process.env.APP_DATA_DIR, 'settings.json'),
    JSON.stringify({ activeProvider: 'none', ollama: { enabled: false, api_url: 'http://127.0.0.1:9' } }),
    'utf8'
  );
  project = await createProject('Silent Learner Functional Privacy');
});

afterEach(async () => {
  await SilentLearner.shutdown();
  await fs.rm(tempProjectsDir, { recursive: true, force: true });
  delete process.env.PROJECTS_DIR;
  delete process.env.APP_DATA_DIR;
});

test('Silent Learner functional/privacy behavior stays local and controllable', async () => {
  await SilentLearner.enable(project.id);
  assert.strictEqual(await SilentLearner.getState(project.id), 'observing');

  await fs.mkdir(path.join(project.path, 'notes'), { recursive: true });
  await fs.writeFile(path.join(project.path, 'notes', 'context.md'), '# Context\nLocal notes.', 'utf8');
  await SilentLearner.observeFile(project.id, 'notes/context.md');
  await SilentLearner.flushAll();

  const dbPath = path.join(project.path, '.metadata', 'memory.db');
  assert.ok(await exists(dbPath), 'expected project-local .metadata/memory.db to be created');
  const scores = await Store.getTopScoredFiles(project.id, 10);
  assert.ok(scores.some(score => score.file_path === 'notes/context.md' && score.usage_count === 1));

  const otherProject = await createProject('Other Workspace');
  await SilentLearner.enable(otherProject.id);
  assert.notStrictEqual(
    path.join(otherProject.path, '.metadata', 'memory.db'),
    dbPath,
    'each workspace should have an isolated memory.db path'
  );

  await Store.insertEvent(project.id, lessonEvent('session-a', 1));
  let built = await SilentLearner.buildMemory(project.id);
  assert.strictEqual(built.totalLessons, 1);
  assert.strictEqual(await SilentLearner.getState(project.id), 'observing', 'less than 3 lessons should not become memory_ready');

  await Store.insertEvent(project.id, lessonEvent('session-a', 2));
  await Store.insertEvent(project.id, lessonEvent('session-a', 3));
  built = await SilentLearner.buildMemory(project.id);
  assert.ok(built.totalLessons >= 3);
  assert.strictEqual(await SilentLearner.getState(project.id), 'memory_ready', '3+ lessons should transition to memory_ready');

  const optimizeProject = await createProject('Optimize Memory Transition');
  await SilentLearner.enable(optimizeProject.id);
  const chatsDir = path.join(optimizeProject.path, 'chats');
  await fs.mkdir(chatsDir, { recursive: true });
  for (let i = 1; i <= 3; i++) {
    await fs.writeFile(
      path.join(chatsDir, `chat_${i}.md`),
      `User: Please refine @prds/feature-${i}.md\nAssistant: Updated the PRD and accepted the useful pattern.`,
      'utf8'
    );
  }
  const optimized = await SilentLearner.optimizeMemory(optimizeProject.id);
  assert.strictEqual(optimized.eventsCreated, 3);
  assert.strictEqual(await SilentLearner.getState(optimizeProject.id), 'memory_ready', 'Optimize Memory with 3 qualifying chats should become memory_ready');

  const secretResult = await SilentLearner.captureEvent({
    projectId: project.id,
    sessionId: 'secret-session',
    provider: 'ollama',
    messages: [{ role: 'user', content: 'Please use OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890SECRET' }],
    result: { content: 'I will not store secrets. This response is intentionally long enough to count as high signal.', metadata: { model_used: 'llama3' } },
    fileChanges: ['notes/secret.md'],
  });
  assert.deepStrictEqual(secretResult, { captured: false, reason: 'redacted_secret', paused: true });
  assert.strictEqual(await SilentLearner.getState(project.id), 'paused');
  assert.ok((await Store.getRedactionLogs(project.id)).length >= 1, 'redaction log should be local');

  const piiClassification = classifyInteraction({ promptText: 'Contact me at avia@example.com', responseText: 'ok' });
  assert.strictEqual(piiClassification.dataClass, 'personal');
  assert.strictEqual(piiClassification.shouldStore, true, 'PII is redacted before storage; only secrets auto-pause');
  assert.ok(piiClassification.redactedPrompt.includes('[REDACTED:email_address]'));

  const deleted = await SilentLearner.forgetSession(project.id, 'session-a');
  assert.ok(deleted.deleted >= 3, 'forget session should delete matching events');

  const fallbackScore = await computeSemanticAlignment(
    project.id,
    'fallback-doc',
    'test',
    'This roadmap discusses launch metrics and KPI tracking.',
    'roadmap launch metrics'
  );
  assert.ok(fallbackScore > 0, 'embedding-provider outage should fall back to local TF similarity');

  await SilentLearner.forgetWorkspace(project.id);
  assert.strictEqual(await exists(dbPath), false, 'forget workspace should remove memory.db');
});

test('Summarization privacy boundary skips AI provider and redacts secrets without caching raw secrets', async () => {
  const secretContent = "Config File\nAWS_SECRET_KEY=secret_key = \"A1B2C3D4E5F6G7H8I9J0a1b2c3d4e5f6g7h8i9j0\"\nLine 3\n";
  const summary = await getOrGenerateSummary(project.id, 'config/secret.env', secretContent);

  // Assert secret was redacted in the output summary
  assert.ok(summary.includes('[REDACTED:aws_secret_key]'));
  assert.ok(!summary.includes('A1B2C3D4E5F6G7H8I9J0a1b2c3d4e5f6g7h8i9j0'));

  // Assert raw secret text is NOT persisted in SQLite cache
  const cached = await Store.getSummary(project.id, 'config/secret.env');
  assert.strictEqual(cached, null, 'Raw secret summary should not be stored in SQLite cache');
});

test('Summarization keeps workspace-file content local-only unless explicit opt-in is enabled', async () => {
  const fileContent = "Line 1\nLine 2\n".repeat(60);
  
  // Default settings (activeProvider = none / hosted without allowHostedSummarization)
  const defaultSummary = await getOrGenerateSummary(project.id, 'doc.md', fileContent);
  assert.ok(defaultSummary.includes('[TRUNCATED FILE SUMMARY - JS FALLBACK]'), 'Default should fall back to local JS summarization');

  // Set activeProvider = hostedApi in settings.json without allowHostedSummarization
  await fs.writeFile(
    path.join(process.env.APP_DATA_DIR, 'settings.json'),
    JSON.stringify({ activeProvider: 'hostedApi', silentLearner: { allowHostedSummarization: false } }),
    'utf8'
  );
  const hostedSummaryNoOptIn = await getOrGenerateSummary(project.id, 'doc2.md', fileContent);
  assert.ok(hostedSummaryNoOptIn.includes('[TRUNCATED FILE SUMMARY - JS FALLBACK]'), 'Hosted provider without opt-in should remain local JS fallback');
});

function lessonEvent(sessionId, n) {
  return {
    session_id: sessionId,
    source: 'test',
    task_type: 'testing',
    prompt_hash: `prompt-${n}`,
    response_hash: `response-${n}`,
    accepted_changes: 0,
    files_touched: [],
    outcome: 'response_generated',
    data_class: 'safe',
    metadata: { responseLength: 80 },
  };
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
