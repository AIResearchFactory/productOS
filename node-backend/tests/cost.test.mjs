import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const testDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'productOS-cost-test-'));
fsSync.mkdirSync(path.join(testDir, 'home'), { recursive: true });
fsSync.mkdirSync(path.join(testDir, 'projects'), { recursive: true });

const prevEnv = {
  HOME: process.env.HOME,
  PROJECTS_DIR: process.env.PROJECTS_DIR,
  NODE_ENV: process.env.NODE_ENV,
};

process.env.HOME = path.join(testDir, 'home');
process.env.PROJECTS_DIR = path.join(testDir, 'projects');
process.env.NODE_ENV = 'test';

const { CostLog } = await import('../lib/cost.mjs');
const { AgentOrchestrator } = await import('../lib/orchestrator.mjs');
const { resolveProviderDisplayName } = await import('../lib/providers/base.mjs');

after(() => {
  fsSync.rmSync(testDir, { recursive: true, force: true });
  for (const [key, val] of Object.entries(prevEnv)) {
    if (val === undefined) delete process.env[key];
    else process.env[key] = val;
  }
});

test('CostLog.computeCostUsd handles current models, unrecognized cloud models, and local models', () => {
  // Sonnet 4.6 pricing
  const sonnetCost = CostLog.computeCostUsd('claude-sonnet-4-6', 1_000_000, 100_000, 500_000, 0);
  assert.ok(Math.abs(sonnetCost - (3.0 + 1.5 + 0.15)) < 1e-9);

  // Unknown future/custom cloud model falls back to cloud rates when isCloud is true or not local
  const customCloudCost = CostLog.computeCostUsd('bob-v4-custom-edition', 1_000_000, 1_000_000, 0, 0, { isCloud: true });
  assert.ok(Math.abs(customCloudCost - 4.0) < 1e-9);

  // Empty model with explicit isCloud: true still computes cloud fallback cost
  assert.ok(CostLog.computeCostUsd('', 500_000, 500_000, 0, 0, { isCloud: true }) > 0);
  // Empty model without isCloud remains 0
  assert.strictEqual(CostLog.computeCostUsd('', 500_000, 500_000), 0);

  // Local models and explicit isCloud: false remain 0
  assert.strictEqual(CostLog.computeCostUsd('llama3.3:70b', 1_000_000, 1_000_000), 0);
  assert.strictEqual(CostLog.computeCostUsd('qwen2.5-coder', 1_000_000, 1_000_000), 0);
  assert.strictEqual(CostLog.computeCostUsd('claude-sonnet-4-6', 1_000_000, 1_000_000, 0, 0, { isCloud: false }), 0);

  // Zero tokens -> 0
  assert.strictEqual(CostLog.computeCostUsd('claude-sonnet-4-6', 0, 0), 0);
});

test('CostLog retroactively estimates historical zero-cost cloud records while preserving local and explicit records', () => {
  const log = new CostLog();
  log.addRecord({
    id: 'r1',
    provider: 'custom-bob',
    model: '',
    cost_usd: 0,
    input_tokens: 100_000,
    output_tokens: 20_000,
  });
  log.addRecord({
    id: 'r2',
    provider: 'custom-local-llm',
    model: '',
    cost_usd: 0,
    input_tokens: 100_000,
    output_tokens: 20_000,
  });
  log.addRecord({
    id: 'r3',
    provider: 'custom-bob',
    model: 'bob-v2',
    cost_usd: 0.42,
    input_tokens: 10_000,
    output_tokens: 2_000,
  });

  const options = {
    isCloudProvider: (providerId) => providerId !== 'custom-local-llm' && providerId !== 'ollama',
    resolveModelForProvider: (providerId) => (providerId === 'custom-bob' ? 'claude-sonnet-4-6' : ''),
  };

  // Sonnet cost for r1: (0.1 * 3.0) + (0.02 * 15.0) = 0.30 + 0.30 = 0.60
  const expectedR1 = 0.60;
  const expectedTotal = expectedR1 + 0.42;

  const total = log.totalCost(options);
  assert.ok(Math.abs(total - expectedTotal) < 1e-9);

  const stats = log.getUsageStatistics(options);
  assert.ok(Math.abs(stats.totalCostUsd - expectedTotal) < 1e-9);
  const bobBreakdown = stats.providerBreakdown.find((p) => p.provider === 'custom-bob');
  const localBreakdown = stats.providerBreakdown.find((p) => p.provider === 'custom-local-llm');
  assert.ok(Math.abs(bobBreakdown.totalCostUsd - expectedTotal) < 1e-9);
  assert.strictEqual(localBreakdown.totalCostUsd, 0);
});

test('AgentOrchestrator records non-zero cost for custom cloud CLI with or without JSON cost output, and $0 for local custom CLI', async () => {
  const orchestrator = new AgentOrchestrator();

  // Create test project
  const projectId = 'cost-e2e-proj';
  const projPath = path.join(process.env.PROJECTS_DIR, projectId);
  await fs.mkdir(path.join(projPath, '.metadata'), { recursive: true });
  await fs.writeFile(
    path.join(projPath, '.metadata', 'project.json'),
    JSON.stringify({ id: projectId, name: 'Cost Test Project' }),
    'utf8'
  );

  // Script 1: JSONL without total_cost_usd (simulating CLI version update changing output)
  const noCostScript = path.join(testDir, 'cli-no-cost.mjs');
  await fs.writeFile(
    noCostScript,
    `
      process.stdin.resume();
      process.stdin.on('end', () => {
        process.stdout.write(JSON.stringify({
          content: 'Streamed response without explicit cost',
          model: 'claude-sonnet-4-6',
          usage: { input_tokens: 10000, output_tokens: 2000, cache_read_input_tokens: 1000 }
        }) + '\\n');
      });
    `,
    'utf8'
  );

  // Script 2: JSONL with explicit total_cost_usd
  const explicitCostScript = path.join(testDir, 'cli-with-cost.mjs');
  await fs.writeFile(
    explicitCostScript,
    `
      process.stdin.resume();
      process.stdin.on('end', () => {
        process.stdout.write(JSON.stringify({ content: 'Explicit cost reply' }) + '\\n');
        process.stdout.write(JSON.stringify({
          type: 'result',
          model: 'bob-v3',
          usage: { input_tokens: 5000, output_tokens: 1000 },
          total_cost_usd: 0.25
        }) + '\\n');
      });
    `,
    'utf8'
  );

  // Script 3: Plain text output (no JSON metadata)
  const plainScript = path.join(testDir, 'cli-plain.mjs');
  await fs.writeFile(
    plainScript,
    `
      process.stdin.resume();
      process.stdin.on('end', () => {
        process.stdout.write('Plain text response from custom cloud CLI');
      });
    `,
    'utf8'
  );

  const settings = {
    customClis: [
      {
        id: 'bob-no-cost',
        name: 'BobNoCost',
        command: `"${process.execPath}" "${noCostScript}"`,
        isCloud: true,
      },
      {
        id: 'bob-with-cost',
        name: 'BobWithCost',
        command: `"${process.execPath}" "${explicitCostScript}"`,
        isCloud: true,
      },
      {
        id: 'bob-plain-cloud',
        name: 'BobPlainCloud',
        command: `"${process.execPath}" "${plainScript}"`,
        model: 'bob-updated-v4',
        isCloud: true,
      },
      {
        id: 'bob-local',
        name: 'BobLocal',
        command: `"${process.execPath}" "${plainScript}"`,
        isCloud: false,
      },
    ],
    modelRouter: {
      enabled: true,
      mode: 'cloudOnly',
      cloudProvider: 'bob-plain-cloud',
      localProvider: 'bob-local',
    },
  };

  await orchestrator.runAgentLoop({
    messages: [{ role: 'user', content: 'Analyze the roadmap' }],
    projectId,
    providerType: 'bob-no-cost',
    settings,
  });

  await orchestrator.runAgentLoop({
    messages: [{ role: 'user', content: 'Summarize insights' }],
    projectId,
    providerType: 'bob-with-cost',
    settings,
  });

  await orchestrator.runAgentLoop({
    messages: [{ role: 'user', content: 'Draft executive summary' }],
    projectId,
    providerType: 'bob-plain-cloud',
    settings,
  });

  await orchestrator.runAgentLoop({
    messages: [{ role: 'user', content: 'Local only prompt' }],
    projectId,
    providerType: 'bob-local',
    settings,
  });

  // RoutedAIProvider wrapping custom cloud CLI must still calculate tokens and non-zero cost
  await orchestrator.runAgentLoop({
    messages: [{ role: 'user', content: 'Routed cloud prompt' }],
    projectId,
    providerType: 'autoRouter',
    settings,
  });

  const costLog = await CostLog.load(path.join(projPath, '.metadata', 'cost_log.json'));
  assert.strictEqual(costLog.records.length, 5);

  const [rNoCost, rWithCost, rPlainCloud, rLocal, rRouted] = costLog.records;

  assert.strictEqual(rNoCost.model, 'claude-sonnet-4-6');
  assert.strictEqual(rNoCost.input_tokens, 10000);
  assert.strictEqual(rNoCost.output_tokens, 2000);
  assert.strictEqual(rNoCost.cache_read_tokens, 1000);
  assert.ok(rNoCost.cost_usd > 0, 'JSONL without explicit cost_usd must compute non-zero cost');

  assert.strictEqual(rWithCost.model, 'bob-v3');
  assert.strictEqual(rWithCost.cost_usd, 0.25);

  assert.strictEqual(rPlainCloud.model, 'bob-updated-v4');
  assert.ok(rPlainCloud.input_tokens > 0);
  assert.ok(rPlainCloud.output_tokens > 0);
  assert.ok(rPlainCloud.cost_usd > 0, 'Plain text cloud custom CLI must compute non-zero cost');

  assert.strictEqual(rLocal.cost_usd, 0, 'Local custom CLI must record $0 cost');

  assert.ok(rRouted.input_tokens > 0, 'RoutedAIProvider must preserve estimated input tokens');
  assert.ok(rRouted.output_tokens > 0, 'RoutedAIProvider must preserve estimated output tokens');
  assert.ok(rRouted.cost_usd > 0, 'RoutedAIProvider wrapping cloud CLI must compute non-zero cost');
});

test('resolveProviderDisplayName and CostLog.getUsageStatistics resolve real custom CLI names and historical fallbacks', () => {
  const customUuid = 'e4541c84-cef1-4ae1-b848-8c233aa51788';
  const deletedUuid = '12345678-90ab-cdef-1234-567890abcdef';
  const settings = {
    customClis: [
      { id: customUuid, name: 'BobShell', command: 'bob run --format stream-json', isCloud: true },
    ],
  };

  assert.strictEqual(resolveProviderDisplayName('hostedApi', settings), 'Hosted API');
  assert.strictEqual(resolveProviderDisplayName('claudeCode', settings), 'Claude Code CLI');
  assert.strictEqual(resolveProviderDisplayName('geminiCli', settings), 'Google Gemini CLI');
  assert.strictEqual(resolveProviderDisplayName('googleAntigravity', settings), 'Google Antigravity');
  assert.strictEqual(resolveProviderDisplayName('openAiCli', settings), 'OpenAI / Codex CLI');
  assert.strictEqual(resolveProviderDisplayName('ollama', settings), 'Ollama');
  assert.strictEqual(resolveProviderDisplayName('liteLlm', settings), 'LiteLLM');
  assert.strictEqual(resolveProviderDisplayName('autoRouter', settings), 'Model Router');

  assert.strictEqual(resolveProviderDisplayName(customUuid, settings), 'BobShell');
  assert.strictEqual(resolveProviderDisplayName(`custom-${customUuid}`, settings), 'BobShell');
  assert.strictEqual(
    resolveProviderDisplayName(deletedUuid, settings, { provider_name: 'OldCustomCli' }),
    'OldCustomCli'
  );
  assert.strictEqual(resolveProviderDisplayName(deletedUuid, settings), 'Custom CLI (12345678)');

  const log = new CostLog();
  log.addRecord({
    id: 'h1',
    provider: customUuid,
    model: 'claude-sonnet-4-6',
    cost_usd: 0.05,
    input_tokens: 1000,
    output_tokens: 200,
    is_user_prompt: true,
  });
  log.addRecord({
    id: 'h2',
    provider: deletedUuid,
    model: '',
    cost_usd: 0.02,
    input_tokens: 500,
    output_tokens: 100,
    is_user_prompt: true,
  });
  log.addRecord({
    id: 'h3',
    provider: deletedUuid,
    provider_name: 'ArchivedBob',
    model: '',
    cost_usd: 0.01,
    input_tokens: 200,
    output_tokens: 50,
    is_user_prompt: true,
  });

  const statsWithResolver = log.getUsageStatistics({
    resolveProviderLabel: (id, rec) => resolveProviderDisplayName(id, settings, rec),
  });
  const customRow = statsWithResolver.providerBreakdown.find((p) => p.provider === customUuid);
  const deletedRow = statsWithResolver.providerBreakdown.find((p) => p.provider === deletedUuid);
  assert.strictEqual(customRow.providerName, 'BobShell');
  assert.strictEqual(deletedRow.providerName, 'ArchivedBob');
});

test('AgentOrchestrator emits real custom CLI name in trace logs and saves provider_name in cost_log.json', async () => {
  const orchestrator = new AgentOrchestrator();
  const traceMessages = [];
  orchestrator.on('trace-log', (msg) => traceMessages.push(msg));

  const projectId = 'custom-cli-trace-cost-proj';
  const projPath = path.join(process.env.PROJECTS_DIR, projectId);
  await fs.mkdir(path.join(projPath, '.metadata'), { recursive: true });
  await fs.writeFile(
    path.join(projPath, '.metadata', 'project.json'),
    JSON.stringify({ id: projectId, name: 'Trace & Billing Test Project' }),
    'utf8'
  );

  const customUuid = 'e4541c84-cef1-4ae1-b848-8c233aa51788';
  const scriptPath = path.join(testDir, 'bobshell-trace-sim.mjs');
  await fs.writeFile(
    scriptPath,
    `
      process.stdin.resume();
      process.stdin.on('end', () => {
        process.stdout.write(JSON.stringify({ type: 'init', model: 'claude-sonnet-4-6' }) + '\\n');
        process.stdout.write(JSON.stringify({ type: 'tool_use', name: 'read_file', input: { path: 'secret.txt' } }) + '\\n');
        process.stdout.write(JSON.stringify({ type: 'tool_result', tool_name: 'read_file', content: 'ok' }) + '\\n');
        process.stdout.write(JSON.stringify({ type: 'message', role: 'assistant', content: 'Done analyzing.' }) + '\\n');
        process.stdout.write(JSON.stringify({
          type: 'result',
          usage: { input_tokens: 1500, output_tokens: 300 },
          total_cost_usd: 0.04
        }) + '\\n');
      });
    `,
    'utf8'
  );

  const settings = {
    customClis: [
      {
        id: customUuid,
        name: 'BobShell',
        command: `"${process.execPath}" "${scriptPath}"`,
        isCloud: true,
      },
    ],
  };

  const result = await orchestrator.runAgentLoop({
    messages: [{ role: 'user', content: 'Check image' }],
    projectId,
    providerType: customUuid,
    settings,
  });

  assert.strictEqual(result.content, 'Done analyzing.');
  assert.ok(traceMessages.includes('Checking authentication for BobShell...'));
  assert.ok(traceMessages.some((m) => m.startsWith('Sending request to BobShell (Context:')));
  assert.ok(traceMessages.includes('BobShell: CLI process started; waiting for output...'));
  assert.ok(traceMessages.includes('BobShell: session initialized (claude-sonnet-4-6)'));
  assert.ok(traceMessages.includes('BobShell: running tool "read_file"...'));
  assert.ok(traceMessages.includes('BobShell: tool "read_file" completed'));
  assert.ok(traceMessages.includes('BobShell: receiving response...'));
  assert.ok(traceMessages.some((m) => /^Request successful \(BobShell, [^)]+\)\. Received \d+ chars\.$/.test(m)));
  assert.strictEqual(
    traceMessages.some((m) => m.includes(customUuid)),
    false,
    `Raw UUID must not appear in trace logs: ${JSON.stringify(traceMessages)}`
  );

  const costLog = await CostLog.load(path.join(projPath, '.metadata', 'cost_log.json'));
  assert.strictEqual(costLog.records.length, 1);
  assert.strictEqual(costLog.records[0].provider, customUuid);
  assert.strictEqual(costLog.records[0].provider_name, 'BobShell');

  const stats = costLog.getUsageStatistics({
    resolveProviderLabel: (id, rec) => resolveProviderDisplayName(id, settings, rec),
  });
  assert.strictEqual(stats.providerBreakdown.length, 1);
  assert.strictEqual(stats.providerBreakdown[0].provider, customUuid);
  assert.strictEqual(stats.providerBreakdown[0].providerName, 'BobShell');
});
