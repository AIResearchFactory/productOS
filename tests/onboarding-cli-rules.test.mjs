import test from 'node:test';
import assert from 'node:assert/strict';
import { isOnboardingReady, getCodexReminderCopy } from '../src/lib/onboardingCliRules.ts';

test('onboarding is ready for openAiCli when Codex/OpenAI CLI is installed', () => {
  const ready = isOnboardingReady({
    selectedProviders: ['openAiCli'],
    openAiCliInstalled: true,
  });

  assert.equal(ready, true);
});

test('onboarding is not ready for openAiCli when Codex/OpenAI CLI is missing', () => {
  const ready = isOnboardingReady({
    selectedProviders: ['openAiCli'],
    openAiCliInstalled: false,
  });

  assert.equal(ready, false);
});

test('Codex reminder copy reflects external login flow', () => {
  const copy = getCodexReminderCopy();

  assert.ok(copy.includes('Codex CLI Installation Required'));
  assert.ok(copy.includes('Install Codex CLI in your terminal before continuing.'));
  assert.ok(copy.includes('productOS checks for codex first and falls back to openai.'));
  assert.ok(copy.includes('Log in there before continuing'));
  assert.ok(copy.includes('Then click Re-detect Dependencies'));
});
