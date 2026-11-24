import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';

import { createProject } from '../../lib/projects.mjs';
import { ChatService } from '../../lib/chat.mjs';
import { logEvent, getResearchLog } from '../../lib/research-log.mjs';
import * as Privacy from '../../lib/silent-learner/privacy-filter.mjs';
import * as Store from '../../lib/silent-learner/learning-store.mjs';
import * as SilentLearner from '../../lib/silent-learner/index.mjs';

let tempRoot;
let project;
let prevEnv;
let activeServerChild = null;

async function stopChildProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  await new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(sigkillTimer);
      clearTimeout(hardTimer);
      resolve();
    };

    child.once('close', done);
    child.once('exit', done);

    try {
      child.kill('SIGTERM');
    } catch {
      done();
      return;
    }

    const sigkillTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        try {
          child.kill('SIGKILL');
        } catch {
          done();
        }
      }
    }, 2000);
    sigkillTimer.unref?.();

    const hardTimer = setTimeout(done, 3500);
    hardTimer.unref?.();
  });
}

beforeEach(async () => {
  activeServerChild = null;
  prevEnv = {
    HOME: process.env.HOME,
    PROJECTS_DIR: process.env.PROJECTS_DIR,
    APP_DATA_DIR: process.env.APP_DATA_DIR,
    NODE_ENV: process.env.NODE_ENV,
    ALLOW_UNENCRYPTED_SECRETS_FOR_TESTS: process.env.ALLOW_UNENCRYPTED_SECRETS_FOR_TESTS,
  };

  tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-sl-review-'));
  process.env.HOME = path.join(tempRoot, 'home');
  process.env.PROJECTS_DIR = path.join(tempRoot, 'projects');
  process.env.APP_DATA_DIR = path.join(tempRoot, 'app-data');
  process.env.NODE_ENV = 'test';
  process.env.ALLOW_UNENCRYPTED_SECRETS_FOR_TESTS = 'true';

  await fs.mkdir(process.env.HOME, { recursive: true });
  await fs.mkdir(process.env.PROJECTS_DIR, { recursive: true });
  await fs.mkdir(process.env.APP_DATA_DIR, { recursive: true });
  await fs.writeFile(
    path.join(process.env.APP_DATA_DIR, 'settings.json'),
    JSON.stringify({ activeProvider: 'none' }),
    'utf8'
  );

  project = await createProject('Redaction Review Test');
});

afterEach(async () => {
  await stopChildProcess(activeServerChild);
  activeServerChild = null;
  await SilentLearner.shutdown();
  await fs.rm(tempRoot, { recursive: true, force: true });
  for (const [key, value] of Object.entries(prevEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

test('1. Privacy.classifyInteraction attaches label, source, and redacted snippets without leaking raw secrets', () => {
  const fakeOpenAiKey = 'sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCD';
  const fakeGhToken = 'ghp_1234567890abcdefghijklmnopqrstuvwxyzABCD';

  const result = Privacy.classifyInteraction({
    promptText: `Here is my key ${fakeOpenAiKey} for testing purposes.`,
    responseText: `Also noticed token ${fakeGhToken} in the environment.`,
  });

  assert.strictEqual(result.shouldStore, false);
  assert.strictEqual(result.dataClass, Privacy.DataClass.SECRET);

  const openaiFinding = result.findings.find((f) => f.name === 'openai_key_v2');
  assert.ok(openaiFinding, 'should record openai_key_v2 finding');
  assert.strictEqual(openaiFinding.label, 'OpenAI API Key');
  assert.strictEqual(openaiFinding.source, 'prompt');
  assert.ok(Array.isArray(openaiFinding.snippets) && openaiFinding.snippets.length === 1);
  assert.ok(openaiFinding.snippets[0].includes('[REDACTED:openai_key_v2]'));
  assert.ok(!openaiFinding.snippets[0].includes(fakeOpenAiKey), 'raw OpenAI key must never appear in snippets');

  const ghFinding = result.findings.find((f) => f.name === 'github_token');
  assert.ok(ghFinding, 'should record github_token finding');
  assert.strictEqual(ghFinding.label, 'GitHub Token');
  assert.strictEqual(ghFinding.source, 'response');
  assert.ok(ghFinding.snippets[0].includes('[REDACTED:github_token]'));
  assert.ok(!ghFinding.snippets[0].includes(fakeGhToken), 'raw GitHub token must never appear in snippets');
});

test('2. captureEvent skips events while state === paused', async () => {
  await SilentLearner.enable(project.id);
  const rawSecret = 'sk-proj-secretvalue1234567890abcdefghijklmnop';

  const pausedResult = await SilentLearner.captureEvent({
    projectId: project.id,
    sessionId: 'chat_secret.md',
    provider: 'ollama',
    messages: [{ role: 'user', content: `Use key ${rawSecret}` }],
    result: { content: 'Noted. I will avoid logging sensitive credentials in the workspace.', metadata: { model_used: 'llama3' } },
  });
  assert.deepStrictEqual(pausedResult, { captured: false, reason: 'redacted_secret', paused: true });
  assert.strictEqual(await SilentLearner.getState(project.id), 'paused');

  const subsequentResult = await SilentLearner.captureEvent({
    projectId: project.id,
    sessionId: 'chat_followup.md',
    provider: 'ollama',
    messages: [{ role: 'user', content: 'Create a roadmap summary for Q4' }],
    result: { content: 'Here is a clean roadmap summary for Q4 with milestones and deliverables.', metadata: { model_used: 'llama3' } },
  });

  assert.deepStrictEqual(subsequentResult, { captured: false, reason: 'silent_learner_paused' });
  assert.strictEqual(await Store.countEvents(project.id), 0);
});

test('3. Exact-match review flow returns rule info, exact chat, and redacted vs raw messages', async () => {
  await SilentLearner.enable(project.id);
  const rawSecret = 'AKIA1234567890ABCDEF';
  const messages = [
    { role: 'user', content: `Deploy with key ${rawSecret}` },
    { role: 'assistant', content: 'Let us configure deployment safely without committing credentials to git.' },
  ];
  const chatFile = await ChatService.saveChatToFile(project.id, messages, 'ollama');

  const captureResult = await SilentLearner.captureEvent({
    projectId: project.id,
    sessionId: chatFile,
    chatFile,
    provider: 'ollama',
    messages: [messages[0]],
    result: { content: messages[1].content, metadata: { model_used: 'llama3' } },
  });
  assert.deepStrictEqual(captureResult, { captured: false, reason: 'redacted_secret', paused: true });

  const review = await SilentLearner.inspectRedaction(project.id);
  assert.ok(review);
  assert.strictEqual(review.hasRuleInfo, true);
  assert.strictEqual(review.chatMatchType, 'exact');
  assert.strictEqual(review.chatFile, chatFile);
  assert.strictEqual(review.canDeleteChat, true);

  const awsFinding = review.findings.find((f) => f.name === 'aws_access_key');
  assert.ok(awsFinding);
  assert.strictEqual(awsFinding.label, 'AWS Access Key');
  assert.strictEqual(awsFinding.source, 'prompt');
  assert.ok(awsFinding.snippets[0].includes('[REDACTED:aws_access_key]'));
  assert.ok(!awsFinding.snippets[0].includes(rawSecret));

  assert.strictEqual(review.redactedMessages.length, 2);
  assert.ok(review.redactedMessages[0].content.includes('[REDACTED:aws_access_key]'));
  assert.ok(!review.redactedMessages[0].content.includes(rawSecret), 'redactedMessages must mask secrets');

  assert.strictEqual(review.messages.length, 2);
  assert.ok(review.messages[0].content.includes(rawSecret), 'messages keeps full text for explicit user reveal');
});

test('4. Legacy 5-column redaction_logs migrates cleanly and uses nearest-chat fallback (and handles empty chats)', async () => {
  const metadataDir = path.join(project.path, '.metadata');
  await fs.mkdir(metadataDir, { recursive: true });
  const dbPath = path.join(metadataDir, 'memory.db');

  // Seed legacy database with old 5-column redaction_logs schema
  const legacyDb = new Database(dbPath);
  legacyDb.exec(`
    CREATE TABLE redaction_logs (
      id TEXT PRIMARY KEY,
      event_id TEXT,
      redaction_type TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE sl_state (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  const redactionTimestamp = '2026-08-21T20:46:09.000Z';
  legacyDb.prepare(
    'INSERT INTO redaction_logs (id, event_id, redaction_type, detail, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run('legacy-redaction-1', null, 'secret', 'Redacted 4 findings', redactionTimestamp);
  legacyDb.prepare('INSERT INTO sl_state (key, value) VALUES (?, ?)').run('mode', 'paused');
  legacyDb.close();

  // First check with empty chats/ directory
  const emptyReview = await SilentLearner.inspectRedaction(project.id);
  assert.ok(emptyReview);
  assert.strictEqual(emptyReview.hasRuleInfo, false);
  assert.deepStrictEqual(emptyReview.findings, []);
  assert.strictEqual(emptyReview.chatMatchType, 'none');
  assert.strictEqual(emptyReview.chatFile, null);
  assert.strictEqual(emptyReview.canDeleteChat, false);

  // Add two timestamped chat files; one 2 seconds apart, one 2 hours apart
  const chatDir = await ChatService.getChatDirectory(project.id);
  await fs.mkdir(chatDir, { recursive: true });
  const farFile = 'chat_2026-08-21T18-46-09-000Z.md';
  const nearFile = 'chat_2026-08-21T20-46-11-000Z.md';
  await fs.writeFile(
    path.join(chatDir, farFile),
    ChatService.formatChatMarkdown([{ role: 'user', content: 'Earlier unrelated question' }]),
    'utf8'
  );
  await fs.writeFile(
    path.join(chatDir, nearFile),
    ChatService.formatChatMarkdown([
      { role: 'user', content: 'Token is ghp_1234567890abcdefghijklmnopqrstuvwxyzABCD' },
      { role: 'assistant', content: 'Received.' },
    ]),
    'utf8'
  );

  const fallbackReview = await SilentLearner.inspectRedaction(project.id);
  assert.ok(fallbackReview);
  assert.strictEqual(fallbackReview.hasRuleInfo, false);
  assert.deepStrictEqual(fallbackReview.findings, []);
  assert.strictEqual(fallbackReview.chatMatchType, 'nearest_fallback');
  assert.strictEqual(fallbackReview.chatFile, nearFile);
  assert.strictEqual(fallbackReview.timeDeltaMs, 2000);
  assert.strictEqual(fallbackReview.canDeleteChat, true);
  assert.ok(fallbackReview.detectedInChatFile.some((f) => f.name === 'github_token'));
});

test('5. resolveRedaction acknowledge keeps chat file, resolves alert, and prevents stale secret_redacted pauseReason', async () => {
  await SilentLearner.enable(project.id);
  const messages = [
    { role: 'user', content: 'Example token sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCD' },
    { role: 'assistant', content: 'This is a long enough response acknowledging the dummy example token.' },
  ];
  const chatFile = await ChatService.saveChatToFile(project.id, messages, 'ollama');

  await SilentLearner.captureEvent({
    projectId: project.id,
    sessionId: chatFile,
    chatFile,
    provider: 'ollama',
    messages: [messages[0]],
    result: { content: messages[1].content, metadata: { model_used: 'llama3' } },
  });

  const resolved = await SilentLearner.resolveRedaction(project.id, { action: 'acknowledge' });
  assert.strictEqual(resolved.ok, true);
  assert.strictEqual(resolved.action, 'acknowledge');
  assert.strictEqual(resolved.chatDeleted, false);
  assert.strictEqual(resolved.state, 'observing');
  assert.strictEqual(resolved.status.pauseReason, null);
  assert.strictEqual(resolved.status.activeRedaction, null);

  // Chat file still exists
  const loaded = await ChatService.loadChatFromFile(project.id, chatFile);
  assert.strictEqual(loaded.length, 2);

  // Subsequent processing error pause should report 'error', not stale 'secret_redacted'
  await Store.setState(project.id, 'mode', 'paused');
  const errorPausedStatus = await SilentLearner.getStatus(project.id);
  assert.strictEqual(errorPausedStatus.state, 'paused');
  assert.strictEqual(errorPausedStatus.pauseReason, 'error');
  assert.strictEqual(errorPausedStatus.activeRedaction, null);
});

test('6. resolveRedaction delete_chat (exact & legacy fallback) deletes chat, sidecar, research log entry, and events', async () => {
  // Part A: Exact match deletion
  await SilentLearner.enable(project.id);
  const chatDir = await ChatService.getChatDirectory(project.id);

  const keepChat = await ChatService.saveChatToFile(
    project.id,
    [
      { role: 'user', content: 'Keep this safe chat' },
      { role: 'assistant', content: 'Safe chat assistant reply.' },
    ],
    'ollama'
  );
  await logEvent(project.id, 'ollama', null, 'Safe chat assistant reply.', keepChat);

  const targetMessages = [
    { role: 'user', content: 'Secret key AKIA1234567890ABCDEF' },
    { role: 'assistant', content: 'Acknowledged secret interaction with enough characters to trigger high signal.' },
  ];
  const targetChat = await ChatService.saveChatToFile(project.id, targetMessages, 'ollama');
  await logEvent(project.id, 'ollama', null, targetMessages[1].content, targetChat);

  // Seed prior learning_events tied to targetChat
  await Store.insertEvent(project.id, {
    session_id: targetChat,
    source: 'ollama',
    task_type: 'feature',
    outcome: 'response_generated',
    data_class: 'safe',
    metadata: { chatFile: targetChat },
  });
  await Store.insertEvent(project.id, {
    session_id: `cold-start-${targetChat}`,
    source: 'cold-start-scan',
    task_type: 'feature',
    outcome: 'response_generated',
    data_class: 'safe',
    metadata: { chatFile: targetChat },
  });
  await Store.insertEvent(project.id, {
    session_id: keepChat,
    source: 'ollama',
    task_type: 'feature',
    outcome: 'response_generated',
    data_class: 'safe',
    metadata: { chatFile: keepChat },
  });

  await SilentLearner.captureEvent({
    projectId: project.id,
    sessionId: targetChat,
    chatFile: targetChat,
    provider: 'ollama',
    messages: [targetMessages[0]],
    result: { content: targetMessages[1].content, metadata: { model_used: 'llama3' } },
  });

  const resolvedExact = await SilentLearner.resolveRedaction(project.id, {
    action: 'delete_chat',
    targetChatFile: targetChat,
  });
  assert.strictEqual(resolvedExact.ok, true);
  assert.strictEqual(resolvedExact.chatDeleted, true);
  assert.strictEqual(resolvedExact.deletedChatFile, targetChat);
  assert.ok(resolvedExact.eventsForgotten >= 2);
  assert.strictEqual(resolvedExact.state, 'observing');
  assert.strictEqual(resolvedExact.status.pauseReason, null);

  // Verify deleted chat file + companion metadata are gone, kept chat remains
  const remainingChats = await ChatService.getChatFiles(project.id);
  assert.deepStrictEqual(remainingChats, [keepChat]);
  const targetMetaExists = await fs
    .access(path.join(chatDir, '.metadata', 'chats', `${targetChat.replace(/\.md$/, '')}.json`))
    .then(() => true)
    .catch(() => false);
  assert.strictEqual(targetMetaExists, false);

  // Verify research_log.md removed targetChat block but preserved keepChat block
  const logEntries = await getResearchLog(project.id);
  assert.strictEqual(logEntries.length, 1);
  assert.strictEqual(logEntries[0].chatFile, keepChat);

  // Verify keepChat learning event survived while targetChat events were removed
  const remainingEvents = await Store.getEvents(project.id);
  assert.strictEqual(remainingEvents.length, 1);
  assert.strictEqual(remainingEvents[0].session_id, keepChat);

  // Part B: Legacy fallback deletion (log has no chat_file recorded)
  const legacyLog = await Store.insertRedactionLog(project.id, {
    event_id: null,
    redaction_type: 'secret',
    detail: 'Redacted 1 findings',
    status: 'pending',
  });
  await Store.setState(project.id, 'mode', 'paused');

  const resolvedFallback = await SilentLearner.resolveRedaction(project.id, {
    redactionId: legacyLog.id,
    action: 'delete_chat',
    targetChatFile: keepChat,
  });
  assert.strictEqual(resolvedFallback.chatDeleted, true);
  assert.strictEqual(resolvedFallback.deletedChatFile, keepChat);
  assert.deepStrictEqual(await ChatService.getChatFiles(project.id), []);
});

test('7. Security negative tests: rejects traversal/mismatched targetChatFile and skips secret chats in optimizeMemory', async () => {
  await SilentLearner.enable(project.id);
  const chatFile = await ChatService.saveChatToFile(
    project.id,
    [
      { role: 'user', content: 'Using sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCD on @prds/spec.md' },
      { role: 'assistant', content: 'Updated @prds/spec.md safely while reviewing the deployment configuration.' },
    ],
    'ollama'
  );

  await SilentLearner.captureEvent({
    projectId: project.id,
    sessionId: chatFile,
    chatFile,
    provider: 'ollama',
    messages: [{ role: 'user', content: 'Using sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCD on @prds/spec.md' }],
    result: { content: 'Updated @prds/spec.md safely while reviewing the deployment configuration.', metadata: { model_used: 'llama3' } },
  });

  // Mismatched targetChatFile when exact chat_file is recorded
  await assert.rejects(
    () => SilentLearner.resolveRedaction(project.id, { action: 'delete_chat', targetChatFile: 'other.md' }),
    (err) => err.statusCode === 400
  );

  // Path traversal on legacy log without chat_file
  const legacyLog = await Store.insertRedactionLog(project.id, {
    event_id: null,
    redaction_type: 'secret',
    detail: 'Legacy',
    status: 'pending',
  });
  await assert.rejects(
    () => SilentLearner.resolveRedaction(project.id, {
      redactionId: legacyLog.id,
      action: 'delete_chat',
      targetChatFile: '../notes.md',
    }),
    (err) => err.statusCode === 400
  );

  // Acknowledge and run optimizeMemory — secret chat must be skipped by scanChatHistory
  await SilentLearner.resolveRedaction(project.id, { action: 'acknowledge' });
  const optResult = await SilentLearner.optimizeMemory(project.id);
  assert.strictEqual(optResult.chatsScanned, 1);
  assert.strictEqual(optResult.eventsCreated, 0, 'optimizeMemory must skip chat files containing secrets');
});

test('8. HTTP routes GET /api/silent-learner/redaction-review and POST /api/silent-learner/redaction-resolve', async (t) => {
  const port = await getFreePort();
  const serverPath = fileURLToPath(new URL('../../server.mjs', import.meta.url));
  const child = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      PRODUCTOS_NODE_SERVER_PORT: String(port),
      PRODUCTOS_BIND_HOST: '127.0.0.1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  activeServerChild = child;

  t.after(async () => {
    await stopChildProcess(child);
    if (activeServerChild === child) {
      activeServerChild = null;
    }
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForServerReady(baseUrl, child);

  // 400 when project_id missing
  const missingProjRes = await fetch(`${baseUrl}/api/silent-learner/redaction-review`);
  assert.strictEqual(missingProjRes.status, 400);

  // 404 when project has no redactions
  const noRedactionRes = await fetch(
    `${baseUrl}/api/silent-learner/redaction-review?project_id=${encodeURIComponent(project.id)}`
  );
  assert.strictEqual(noRedactionRes.status, 404);

  // Seed secret redaction pause via API / store
  await SilentLearner.enable(project.id);
  const chatFile = await ChatService.saveChatToFile(
    project.id,
    [
      { role: 'user', content: 'Secret sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCD' },
      { role: 'assistant', content: 'Acknowledged secret interaction with sufficient length for high signal capture.' },
    ],
    'ollama'
  );
  await SilentLearner.captureEvent({
    projectId: project.id,
    sessionId: chatFile,
    chatFile,
    provider: 'ollama',
    messages: [{ role: 'user', content: 'Secret sk-proj-abcdefghijklmnopqrstuvwxyz1234567890ABCD' }],
    result: { content: 'Acknowledged secret interaction with sufficient length for high signal capture.', metadata: { model_used: 'llama3' } },
  });
  // Close DB cache in test process so spawned server opens cleanly
  await SilentLearner.shutdown();

  const reviewRes = await fetch(
    `${baseUrl}/api/silent-learner/redaction-review?project_id=${encodeURIComponent(project.id)}`
  );
  assert.strictEqual(reviewRes.status, 200);
  const reviewBody = await reviewRes.json();
  assert.strictEqual(reviewBody.hasRuleInfo, true);
  assert.strictEqual(reviewBody.chatMatchType, 'exact');
  assert.strictEqual(reviewBody.chatFile, chatFile);

  // Invalid action -> 400
  const invalidActionRes = await fetch(`${baseUrl}/api/silent-learner/redaction-resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: project.id, action: 'invalid' }),
  });
  assert.strictEqual(invalidActionRes.status, 400);

  // Valid delete_chat resolution -> 200
  const resolveRes = await fetch(`${baseUrl}/api/silent-learner/redaction-resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: project.id,
      redaction_id: reviewBody.redaction.id,
      action: 'delete_chat',
      target_chat_file: chatFile,
    }),
  });
  assert.strictEqual(resolveRes.status, 200);
  const resolveBody = await resolveRes.json();
  assert.strictEqual(resolveBody.ok, true);
  assert.strictEqual(resolveBody.chatDeleted, true);
  assert.strictEqual(resolveBody.state, 'observing');
  assert.strictEqual(resolveBody.status.pauseReason, null);
});

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() => resolve(addr.port));
    });
  });
}

async function waitForServerReady(baseUrl, child) {
  let stderr = '';
  child.stderr?.on('data', (d) => {
    stderr += d.toString();
  });

  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}: ${stderr}`);
    }
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return;
    } catch {
      // retry until ready
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for server at ${baseUrl}. stderr: ${stderr}`);
}
