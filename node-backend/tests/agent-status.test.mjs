import { test } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';

const testDir = path.resolve('./.test-data-agent-status');
fs.mkdirSync(path.join(testDir, 'home'), { recursive: true });
fs.mkdirSync(path.join(testDir, 'projects'), { recursive: true });

process.env.HOME = path.join(testDir, 'home');
process.env.PROJECTS_DIR = path.join(testDir, 'projects');
process.env.NODE_ENV = 'test';

const { AgentOrchestrator } = await import('../lib/orchestrator.mjs');

test('AgentOrchestrator tracks active run state and emits agent-status', async () => {
  const orchestrator = new AgentOrchestrator();
  const projectId = 'test-proj-status-1';

  const projPath = path.join(testDir, 'projects', projectId);
  fs.mkdirSync(path.join(projPath, '.metadata'), { recursive: true });
  fs.writeFileSync(path.join(projPath, '.metadata', 'project.json'), JSON.stringify({ id: projectId, name: 'Test' }));

  // Initially idle
  assert.strictEqual(orchestrator.getActiveRun(projectId), null);
  assert.strictEqual(orchestrator.isAgentRunning(projectId), false);

  const events = [];
  orchestrator.on('agent-status', (data) => events.push(data));

  // Run a mock loop
  let capturedController;
  const mockPromise = orchestrator.runAgentLoop({
    messages: [{ role: 'user', content: 'test message' }],
    projectId,
    providerType: 'hostedApi',
    settings: {
      activeProvider: 'hostedApi'
    }
  });

  // Check state while running or immediately after start
  const activeRun = orchestrator.getActiveRun(projectId);
  if (activeRun) {
    assert.strictEqual(activeRun.projectId, projectId);
    assert.strictEqual(activeRun.provider, 'hostedApi');
    assert.ok(activeRun.startedAt > 0);
  }

  // Await completion (will complete with mock or unsupported response)
  await mockPromise;

  // After completion, activeRun must be null
  assert.strictEqual(orchestrator.getActiveRun(projectId), null);
  assert.strictEqual(orchestrator.isAgentRunning(projectId), false);

  // Must have emitted at least 'running' and 'idle'
  const runningEvents = events.filter(e => e.projectId === projectId && e.status === 'running');
  const idleEvents = events.filter(e => e.projectId === projectId && e.status === 'idle');

  assert.ok(runningEvents.length >= 1, 'Should emit running event');
  assert.ok(idleEvents.length >= 1, 'Should emit idle event');
});

test('AgentOrchestrator stopExecution clears active run and emits idle', async () => {
  const orchestrator = new AgentOrchestrator();
  const projectId = 'test-proj-stop-1';

  const events = [];
  orchestrator.on('agent-status', (data) => events.push(data));

  // Simulate setting an active run and controller
  const controller = new AbortController();
  orchestrator.activeControllers.set(projectId, controller);
  orchestrator.activeRuns.set(projectId, {
    projectId,
    startedAt: Date.now(),
    provider: 'hostedApi',
    lastTrace: 'Running...'
  });

  assert.strictEqual(orchestrator.isAgentRunning(projectId), true);
  const runInfo = orchestrator.getActiveRun(projectId);
  assert.ok(runInfo !== null);

  // Call stopExecution
  const stopped = await orchestrator.stopExecution(projectId);
  assert.strictEqual(stopped, true);
  assert.strictEqual(controller.signal.aborted, true);
  assert.strictEqual(orchestrator.isAgentRunning(projectId), false);
  assert.strictEqual(orchestrator.getActiveRun(projectId), null);

  const stopEvents = events.filter(e => e.projectId === projectId && e.status === 'idle' && e.stopped === true);
  assert.strictEqual(stopEvents.length, 1);
});

test('reconcileArtifacts gracefully handles empty or invalid artifacts.json', async () => {
  const { reconcileArtifacts } = await import('../lib/artifacts.mjs');
  const corruptProjId = 'test-proj-corrupt-manifest';
  const corruptProjPath = path.join(testDir, 'projects', corruptProjId);
  fs.mkdirSync(path.join(corruptProjPath, '.metadata'), { recursive: true });
  fs.writeFileSync(path.join(corruptProjPath, '.metadata', 'project.json'), JSON.stringify({ id: corruptProjId, name: 'Corrupt' }));
  
  // Write an empty artifacts.json (which caused SyntaxError: Unexpected end of JSON input)
  fs.writeFileSync(path.join(corruptProjPath, '.metadata', 'artifacts.json'), '');

  // Must not throw SyntaxError
  const result = await reconcileArtifacts(corruptProjId);
  assert.strictEqual(typeof result, 'number');

  // The file should now be valid JSON
  const fixedContent = fs.readFileSync(path.join(corruptProjPath, '.metadata', 'artifacts.json'), 'utf8');
  assert.doesNotThrow(() => JSON.parse(fixedContent));
});
