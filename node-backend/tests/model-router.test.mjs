import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import test from 'node:test';
import assert from 'node:assert/strict';

// Set HOME and PROJECTS_DIR before test imports/executions per project conventions
const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'model-router-test-'));
process.env.HOME = tmpDir;
process.env.PROJECTS_DIR = path.join(tmpDir, 'projects');

const { resolveModelRoute, redactModelRequestForCloud, RoutedAIProvider } = await import('../lib/model-router.mjs');

function chatProvider(id, { delayMs = 0, fail = false, auth = true, content = id } = {}) {
  return {
    providerType: () => id,
    displayName: async () => id,
    resolveModel: async () => `${id}-model`,
    checkAuthentication: async () => auth,
    listModels: async () => [`${id}-model`],
    chat: async () => {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (fail) throw new Error(`${id} failed`);
      return { content, metadata: { model_used: `${id}-model`, tokens_in: 1, tokens_out: 1 } };
    },
  };
}

test('model router sends private workspace data to the local provider first', () => {
  const route = resolveModelRoute({
    request: {
      messages: [{ role: 'user', content: 'Review this repository diff' }],
    },
    settings: {
      projectPath: '/repo/productOS',
      modelRouter: { localProvider: 'ollama', cloudProvider: 'hostedApi' },
    },
    requestedProvider: 'autoRouter',
  });

  assert.equal(route.primary, 'ollama');
  assert.equal(route.fallback, 'hostedApi');
  assert.equal(route.fallbackRequest, 'cloudRedacted');
  assert.equal(route.reason, 'private-workspace-data');
});

test('model router honors explicit provider bypass', () => {
  const route = resolveModelRoute({
    request: { messages: [{ role: 'user', content: 'hello' }] },
    settings: { modelRouter: { mode: 'privacyFirst' } },
    requestedProvider: 'openAiCli',
  });

  assert.equal(route.primary, 'openAiCli');
  assert.equal(route.fallback, null);
  assert.equal(route.reason, 'explicit-provider');
});

test('model router respects enabled: false toggle', () => {
  const route = resolveModelRoute({
    request: { messages: [{ role: 'user', content: 'hello' }] },
    settings: { modelRouter: { enabled: false, cloudProvider: 'hostedApi' } },
    requestedProvider: 'autoRouter',
  });

  assert.equal(route.primary, 'hostedApi');
  assert.equal(route.fallback, null);
  assert.equal(route.reason, 'router-disabled');
});

test('model router sends public performance-first requests to cloud with local fallback and timeout', () => {
  const route = resolveModelRoute({
    request: {
      privacyLevel: 'public',
      messages: [{ role: 'user', content: 'Draft launch copy for public website' }],
    },
    settings: { modelRouter: { mode: 'performanceFirst', localProvider: 'ollama', cloudProvider: 'openAiCli', localTimeoutMs: 3000 } },
    requestedProvider: 'autoRouter',
  });

  assert.equal(route.primary, 'openAiCli');
  assert.equal(route.fallback, 'ollama');
  assert.equal(route.fallbackRequest, 'original');
  assert.equal(route.timeoutMs, null);
});

test('cloud-redacted fallback removes obvious secrets, ssh keys, and private key mentions from messages and system prompt', () => {
  const redacted = redactModelRequestForCloud({
    system_prompt: 'Use api_key=sk-test-secret, private key block, and path C:/repo/.env',
    messages: [{ role: 'user', content: 'token: ghp_abcdefghijklmnopqrstuvwxyz123456 password=hunter2 ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC user@host' }],
  });

  assert.match(redacted.system_prompt, /api_key=\[REDACTED\]/);
  assert.doesNotMatch(redacted.system_prompt, /sk-test-secret/);
  assert.doesNotMatch(redacted.system_prompt, /\.env/);
  assert.match(redacted.system_prompt, /\[REDACTED_PRIVATE_KEY\]/);
  assert.doesNotMatch(redacted.messages[0].content, /ghp_/);
  assert.doesNotMatch(redacted.messages[0].content, /hunter2/);
  assert.match(redacted.messages[0].content, /\[REDACTED_SSH_KEY\]/);
  assert.doesNotMatch(redacted.messages[0].content, /AAAAB3NzaC1yc2E/);
});

test('RoutedAIProvider initializes config property for auth caching', () => {
  const provider = new RoutedAIProvider({
    settings: { modelRouter: { localProvider: 'ollama', cloudProvider: 'hostedApi', mode: 'localOnly' } },
  });

  assert.ok(provider.config);
  assert.equal(provider.config.localProvider, 'ollama');
  assert.equal(provider.config.cloudProvider, 'hostedApi');
  assert.equal(provider.config.mode, 'localOnly');
});

test('RoutedAIProvider checkAuthentication respects localOnly and cloudOnly modes', async () => {
  const providers = {
    ollama: chatProvider('ollama', { auth: false }),
    hostedApi: chatProvider('hostedApi', { auth: true }),
  };

  const providerLocalOnly = new RoutedAIProvider({
    settings: { modelRouter: { localProvider: 'ollama', cloudProvider: 'hostedApi', mode: 'localOnly' } },
    createProvider: async (id) => providers[id],
  });

  const authLocalOnly = await providerLocalOnly.checkAuthentication();
  assert.equal(authLocalOnly, false, 'localOnly should fail if only cloud provider authenticates');

  const providerCloudOnly = new RoutedAIProvider({
    settings: { modelRouter: { localProvider: 'ollama', cloudProvider: 'hostedApi', mode: 'cloudOnly' } },
    createProvider: async (id) => providers[id],
  });

  const authCloudOnly = await providerCloudOnly.checkAuthentication();
  assert.equal(authCloudOnly, true, 'cloudOnly should succeed when cloud provider authenticates');
});

test('routed provider falls back after local timeout and annotates routing metadata', async () => {
  const providers = {
    ollama: chatProvider('ollama', { delayMs: 50, content: 'local' }),
    hostedApi: chatProvider('hostedApi', { content: 'cloud' }),
  };

  const provider = new RoutedAIProvider({
    settings: {
      projectPath: '/repo/private',
      modelRouter: {
        localProvider: 'ollama',
        cloudProvider: 'hostedApi',
        localTimeoutMs: 5,
        fallback: 'cloudRedacted',
      },
    },
    secrets: {},
    projectPath: '/repo/private',
    createProvider: async (id) => providers[id],
  });

  const response = await provider.chat({
    messages: [{ role: 'user', content: 'Summarize repo with token=abc123' }],
  });

  assert.equal(response.content, 'cloud');
  assert.equal(response.metadata.routing.provider, 'hostedApi');
  assert.equal(response.metadata.routing.primaryProvider, 'ollama');
  assert.equal(response.metadata.routing.fallbackUsed, true);
  assert.equal(response.metadata.routing.fallbackRequest, 'cloudRedacted');
});

test('AIService.isCloudProvider correctly identifies cloud vs local providers', async () => {
  const { AIService } = await import('../lib/ai.mjs');
  const { OllamaProvider } = await import('../lib/providers/ollama.mjs');
  const { HostedAPIProvider } = await import('../lib/providers/hosted.mjs');
  const { CustomCliProvider } = await import('../lib/providers/custom.mjs');

  const ollama = new OllamaProvider({});
  assert.equal(ollama.isCloudProvider(), false);

  const hosted = new HostedAPIProvider({});
  assert.equal(hosted.isCloudProvider(), true);

  const customCloud = new CustomCliProvider({ id: 'my-cloud-cli', isCloud: true });
  assert.equal(customCloud.isCloudProvider(), true);

  const customLocal = new CustomCliProvider({ id: 'custom-local-llama', isCloud: false });
  assert.equal(customLocal.isCloudProvider(), false);

  assert.equal(AIService.isCloudProvider('ollama'), false);
  assert.equal(AIService.isCloudProvider('hostedApi'), true);
  assert.equal(AIService.isCloudProvider('claudeCode'), true);
  assert.equal(AIService.isCloudProvider('geminiCli'), true);
  assert.equal(AIService.isCloudProvider('openAiCli'), true);
  assert.equal(AIService.isCloudProvider('my-custom-cli', { customClis: [{ id: 'my-custom-cli', isCloud: false }] }), false);
});

