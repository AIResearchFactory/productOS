import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveModelRoute, redactModelRequestForCloud, RoutedAIProvider } from '../lib/model-router.mjs';

function chatProvider(id, { delayMs = 0, fail = false, content = id } = {}) {
  return {
    providerType: () => id,
    displayName: async () => id,
    resolveModel: async () => `${id}-model`,
    checkAuthentication: async () => true,
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

test('model router sends public performance-first requests to cloud with local fallback', () => {
  const route = resolveModelRoute({
    request: {
      privacyLevel: 'public',
      messages: [{ role: 'user', content: 'Draft launch copy for public website' }],
    },
    settings: { modelRouter: { mode: 'performanceFirst', localProvider: 'ollama', cloudProvider: 'openAiCli' } },
    requestedProvider: 'autoRouter',
  });

  assert.equal(route.primary, 'openAiCli');
  assert.equal(route.fallback, 'ollama');
  assert.equal(route.fallbackRequest, 'original');
});

test('cloud-redacted fallback removes obvious secrets from messages and system prompt', () => {
  const redacted = redactModelRequestForCloud({
    system_prompt: 'Use api_key=sk-test-secret and path C:/repo/.env',
    messages: [{ role: 'user', content: 'token: ghp_abcdefghijklmnopqrstuvwxyz123456 password=hunter2' }],
  });

  assert.match(redacted.system_prompt, /api_key=\[REDACTED\]/);
  assert.doesNotMatch(redacted.system_prompt, /sk-test-secret/);
  assert.doesNotMatch(redacted.system_prompt, /\.env/);
  assert.doesNotMatch(redacted.messages[0].content, /ghp_/);
  assert.doesNotMatch(redacted.messages[0].content, /hunter2/);
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
