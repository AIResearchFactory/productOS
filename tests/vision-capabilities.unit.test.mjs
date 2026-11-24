import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveVisionCapability } from '../src/lib/visionCapabilities.ts';

test('resolveVisionCapability identifies Ollama vision vs text-only models and API overrides', () => {
  assert.equal(
    resolveVisionCapability({ provider: 'ollama', settings: { ollama: { model: 'llama3.2-vision' } } }).status,
    'supported'
  );
  assert.equal(
    resolveVisionCapability({ provider: 'ollama', settings: { ollama: { model: 'llava:latest' } } }).status,
    'supported'
  );
  assert.equal(
    resolveVisionCapability({ provider: 'ollama', settings: { ollama: { model: 'qwen2.5vl:7b' } } }).status,
    'supported'
  );

  const llama3Res = resolveVisionCapability({
    provider: 'ollama',
    settings: { ollama: { model: 'llama3' } },
  });
  assert.equal(llama3Res.status, 'unsupported');
  assert.match(llama3Res.reason, /does not support image analysis/);

  // Authoritative API override
  assert.equal(
    resolveVisionCapability({
      provider: 'ollama',
      settings: { ollama: { model: 'my-custom-tag' } },
      ollamaApiSupport: true,
    }).status,
    'supported'
  );
  assert.equal(
    resolveVisionCapability({
      provider: 'ollama',
      settings: { ollama: { model: 'llava' } },
      ollamaApiSupport: false,
    }).status,
    'unsupported'
  );
});

test('resolveVisionCapability handles Custom CLI unverified warning and supportsImages override', () => {
  const unverified = resolveVisionCapability({
    provider: 'custom-my-agent',
    settings: {
      customClis: [{ id: 'my-agent', name: 'My Agent', supportsImages: false }],
    },
  });
  assert.equal(unverified.status, 'unverified');
  assert.match(unverified.reason, /Supports Images \(CLI\)/);

  const verified = resolveVisionCapability({
    provider: 'custom-my-agent',
    settings: {
      customClis: [{ id: 'my-agent', name: 'My Agent', supportsImages: true }],
    },
  });
  assert.equal(verified.status, 'supported');
});

test('resolveVisionCapability classifies cloud providers and autoRouter correctly', () => {
  assert.equal(resolveVisionCapability({ provider: 'claudeCode' }).status, 'supported');
  assert.equal(resolveVisionCapability({ provider: 'openAiCli' }).status, 'supported');
  assert.equal(
    resolveVisionCapability({ provider: 'geminiCli', settings: { geminiCli: { modelAlias: 'gemini-3.6-flash-high' } } }).status,
    'supported'
  );
  assert.equal(
    resolveVisionCapability({ provider: 'geminiCli', settings: { geminiCli: { modelAlias: 'gpt-oss-120b-medium' } } }).status,
    'unsupported'
  );
  assert.equal(
    resolveVisionCapability({ provider: 'hostedApi', settings: { hosted: { model: 'gpt-3.5-turbo' } } }).status,
    'unsupported'
  );
  assert.equal(
    resolveVisionCapability({
      provider: 'autoRouter',
      settings: {
        ollama: { model: 'llama3' },
        modelRouter: { mode: 'localOnly', localProvider: 'ollama', cloudProvider: 'hostedApi' },
      },
    }).status,
    'unsupported'
  );
});
