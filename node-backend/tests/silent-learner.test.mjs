import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Silent Learner Modules
import * as Privacy from '../lib/silent-learner/privacy-filter.mjs';
import * as Scoring from '../lib/silent-learner/scoring.mjs';
import * as Store from '../lib/silent-learner/learning-store.mjs';
import * as MemoryPack from '../lib/silent-learner/memory-pack.mjs';
import * as Retrieval from '../lib/silent-learner/retrieval.mjs';
import * as Capture from '../lib/silent-learner/capture-hook.mjs';
import * as SilentLearner from '../lib/silent-learner/index.mjs';

import { createProject } from '../lib/projects.mjs';

let tempProjectsDir;
let testProject;

beforeEach(async () => {
  tempProjectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-tests-projects-'));
  process.env.PROJECTS_DIR = tempProjectsDir;
  
  // Create a default test project
  testProject = await createProject('Silent Learner Test Project');
});

afterEach(async () => {
  // Close DBs
  SilentLearner.closeDatabase?.(testProject.id);
  Store.closeDatabase?.(testProject.id);
  Store.closeAll();

  await fs.rm(tempProjectsDir, { recursive: true, force: true });
  delete process.env.PROJECTS_DIR;
});

// ─── Slice 1: Privacy Filter Tests ──────────────────────────────
test('Privacy Filter - scanForSecrets & redactSecrets', () => {
  const textWithSecrets = 'Here is my key: sk-proj-1234567890abcdef1234567890abcdef and email user@example.com';
  const scan = Privacy.scanForSecrets(textWithSecrets);
  
  assert.strictEqual(scan.isSafe, false);
  assert.strictEqual(scan.highestClass, Privacy.DataClass.SECRET);
  assert.ok(scan.findings.some(f => f.name === 'openai_key_v2'));
  assert.ok(scan.findings.some(f => f.name === 'email_address'));

  const { redacted } = Privacy.redactSecrets(textWithSecrets);
  assert.ok(redacted.includes('[REDACTED:openai_key_v2]'));
  assert.ok(redacted.includes('[REDACTED:email_address]'));
});

test('Privacy Filter - classifyInteraction', () => {
  const safeInteraction = {
    promptText: 'How do I center a div?',
    responseText: 'Use flexbox or grid to center elements.'
  };
  const scanSafe = Privacy.classifyInteraction(safeInteraction);
  assert.strictEqual(scanSafe.shouldStore, true);
  assert.strictEqual(scanSafe.dataClass, Privacy.DataClass.SAFE);

  const unsafeInteraction = {
    promptText: 'My AWS key is AKIA1234567890ABCDEF',
    responseText: 'Never commit AWS keys.'
  };
  const scanUnsafe = Privacy.classifyInteraction(unsafeInteraction);
  assert.strictEqual(scanUnsafe.shouldStore, false);
  assert.strictEqual(scanUnsafe.dataClass, Privacy.DataClass.SECRET);
});

// ─── Slice 2: Capture Hook Tests ────────────────────────────────
test('Capture Hook - buildCaptureEvent & isHighSignal', () => {
  const params = {
    projectId: testProject.id,
    sessionId: 'session-123',
    provider: 'ollama',
    messages: [
      { role: 'user', content: 'Create a landing page layout' },
    ],
    result: {
      content: 'FILE: public/index.html\n```html\n<div>Hello</div>\n```',
      metadata: { model_used: 'llama3', tokens_in: 100, tokens_out: 200 }
    },
    fileChanges: ['public/index.html'],
    artifactChanges: []
  };

  const event = Capture.buildCaptureEvent(params);
  assert.strictEqual(event.session_id, 'session-123');
  assert.strictEqual(event.source, 'ollama');
  assert.strictEqual(event.task_type, 'feature');
  assert.strictEqual(event.accepted_changes, true);
  assert.ok(event.files_touched.includes('public/index.html'));
  assert.strictEqual(Capture.isHighSignal(event), true);
});

// ─── Slice 3: Relevance Scoring Engine Tests ─────────────────────
test('Scoring Engine - computeScore formula', () => {
  // Recent, heavily used file with alignment should score high
  const highScoring = Scoring.computeScore({
    explicitConfidence: 0.8,
    usageCount: 20,
    lastUsedAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
    fileType: 'prd',
    taskAlignment: 0.9
  });

  // Old, unaligned file with low usage should score low
  const lowScoring = Scoring.computeScore({
    explicitConfidence: 0.1,
    usageCount: 1,
    lastUsedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastModifiedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    fileType: 'presentation',
    taskAlignment: 0.1
  });

  assert.ok(highScoring.score > lowScoring.score);
  assert.strictEqual(highScoring.tier, 'active_context');
});

test('Scoring Engine - Keyword Alignment', () => {
  const docContent = 'This document defines the roadmap and user stories for telemetry alerts';
  const matchingTask = 'Implement telemetry alerts dashboard';
  const nonMatchingTask = 'Fix database connection pooling';

  const scoreMatching = Scoring.computeKeywordAlignment(docContent, matchingTask);
  const scoreNonMatching = Scoring.computeKeywordAlignment(docContent, nonMatchingTask);

  assert.ok(scoreMatching > scoreNonMatching);
});

// ─── Slice 4: Learning Event Store Tests ─────────────────────────
test('Learning Store - Database Operations', async () => {
  // Initially no events
  const initialCount = await Store.countEvents(testProject.id);
  assert.strictEqual(initialCount, 0);

  // Set state mode
  await Store.setState(testProject.id, 'mode', 'observing');
  const mode = await Store.getState(testProject.id, 'mode');
  assert.strictEqual(mode, 'observing');

  // Insert event
  const event = {
    session_id: 'session-1',
    source: 'claudeCode',
    task_type: 'bugfix',
    files_touched: ['src/main.js'],
    outcome: 'files_changed',
    accepted_changes: true,
    data_class: 'safe',
    metadata: { test: true }
  };
  await Store.insertEvent(testProject.id, event);

  const newCount = await Store.countEvents(testProject.id);
  assert.strictEqual(newCount, 1);

  const events = await Store.getEvents(testProject.id);
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].session_id, 'session-1');
  assert.strictEqual(events[0].task_type, 'bugfix');

  // Increment file usage
  await Store.incrementFileUsage(testProject.id, 'src/main.js');
  const topFiles = await Store.getTopScoredFiles(testProject.id, 1);
  assert.strictEqual(topFiles.length, 1);
  assert.strictEqual(topFiles[0].file_path, 'src/main.js');

  // Clean
  await Store.deleteAllEvents(testProject.id);
  const finalCount = await Store.countEvents(testProject.id);
  assert.strictEqual(finalCount, 0);
});

// ─── Slice 5: Memory Pack Builder Tests ──────────────────────────
test('Memory Pack Builder - Distillation and JSONL generation', async () => {
  // Enable SL first
  await SilentLearner.enable(testProject.id);

  // Insert 3 bugfix events to qualify for distillation
  for (let i = 0; i < 3; i++) {
    await Store.insertEvent(testProject.id, {
      session_id: `session-${i}`,
      source: 'geminiCli',
      task_type: 'bugfix',
      files_touched: ['tests/app.test.js'],
      outcome: 'response_generated',
      accepted_changes: true,
      data_class: 'safe',
      created_at: new Date().toISOString()
    });
  }

  const result = await MemoryPack.buildMemoryPacks(testProject.id);
  assert.ok(result.packsBuilt > 0);
  assert.ok(result.totalLessons >= 3);

  const packs = await MemoryPack.listMemoryPacks(testProject.id);
  assert.ok(packs.length > 0);

  // Ensure JSONL file exists
  const metadataDir = path.join(testProject.path, '.metadata', 'memory-packs');
  const list = await fs.readdir(metadataDir);
  assert.ok(list.length > 0);
});

// ─── Slice 6: Retrieval Layer Tests ──────────────────────────────
test('Retrieval Layer - retrieveContext within budget', async () => {
  // Setup file scores in SQLite with high recency and active boost
  await Store.upsertFileScore(testProject.id, {
    file_path: 'roadmaps/q3.md',
    explicit_confidence: 1.0,
    usage_count: 50,
    last_used_at: new Date().toISOString(),
    last_modified_at: new Date().toISOString(),
    active_boost: 1.0,
    computed_score: 0.95
  });

  // Create physical file content
  const roadmapPath = path.join(testProject.path, 'roadmaps');
  await fs.mkdir(roadmapPath, { recursive: true });
  await fs.writeFile(path.join(roadmapPath, 'q3.md'), '# Roadmaps Q3\nGoal is context retention.', 'utf8');

  // Retrieve context with budget
  const context = await Retrieval.retrieveContext(testProject.id, {
    taskDescription: 'context retention',
    tokenBudget: 1000
  });

  assert.ok(context.contextBlock.includes('roadmaps/q3.md'));
  assert.ok(context.filesUsed.includes('roadmaps/q3.md'));
});

// ─── Slice 8: Cold-Start Historical Scan Tests ───────────────────
test('Service Facade - Cold-Start Optimize Memory Scan', async () => {
  // Create sample files & chat history
  const chatDir = path.join(testProject.path, 'chats');
  await fs.mkdir(chatDir, { recursive: true });
  
  // Simulated chat transcript referencing a file
  await fs.writeFile(
    path.join(chatDir, 'chat_1.md'),
    'User: Please review @roadmaps/q3.md\nAssistant: Looking into telemetry context.',
    'utf8'
  );

  // Run optimize scan
  const results = await SilentLearner.optimizeMemory(testProject.id);
  assert.ok(results.chatsScanned >= 1);
  assert.ok(results.eventsCreated >= 1);

  // Check state machine changed state to observing or memory_ready
  const state = await SilentLearner.getState(testProject.id);
  assert.ok(['observing', 'memory_ready'].includes(state));

  // Verify synthetic event was created
  const events = await Store.getEvents(testProject.id);
  assert.ok(events.length >= 1);
  assert.strictEqual(events[0].source, 'cold-start-scan');
});

// ─── Task Classification Tests ──────────────────────────────────
test('Task Classification - Heuristics for PM tasks', () => {
  assert.strictEqual(Capture.classifyText('Please review our competitor products and trend reports'), 'competitive');
  assert.strictEqual(Capture.classifyText('We need analyst feedback from Gartner'), 'competitive');
  assert.strictEqual(Capture.classifyText('Create a new PRD specification for alerts'), 'prd');
  assert.strictEqual(Capture.classifyText('Update the product roadmap roadmap for Q3 planning'), 'roadmap');
  assert.strictEqual(Capture.classifyText('Define KPIs and dashboard metrics for the funnel'), 'kpi');
  assert.strictEqual(Capture.classifyText('Let us prioritize these user stories using RICE framework'), 'user_story');
  assert.strictEqual(Capture.classifyText('Prepare the GTM launch announcement newsletter'), 'launch');
  assert.strictEqual(Capture.classifyText('Collect user feedback from NPS customer surveys'), 'feedback');
});

