import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeEvent, isTelemetryEnabled } from '../node-backend/lib/telemetry/index.mjs';

test('sanitizeEvent drops unknown event names', () => {
  assert.equal(sanitizeEvent('prompt.content', { content: 'secret' }), null);
});

test('sanitizeEvent strips non-allowlisted payload keys', () => {
  const event = sanitizeEvent('agent.run.completed', {
    provider: 'claudeCode',
    durationMs: 123,
    tokensIn: 10,
    tokensOut: 20,
    prompt: 'never send this',
    filePath: '/private/project/roadmap.md',
  });

  assert.deepEqual(event, {
    name: 'agent.run.completed',
    payload: {
      provider: 'claudeCode',
      durationMs: 123,
      tokensIn: 10,
      tokensOut: 20,
    },
  });
});

test('sanitizeEvent coerces and caps string payload values', () => {
  const event = sanitizeEvent('agent.run.failed', {
    provider: 'x'.repeat(300),
    durationMs: Number.POSITIVE_INFINITY,
    errorCode: { code: 'E_SECRET' },
  });

  assert.equal(event.payload.provider.length, 256);
  assert.equal('durationMs' in event.payload, false);
  assert.equal(event.payload.errorCode, '[object Object]');
});

test('isTelemetryEnabled respects settings opt-out', () => {
  assert.equal(isTelemetryEnabled({ telemetry: { enabled: false } }), false);
  assert.equal(isTelemetryEnabled({ telemetry: { enabled: true } }), true);
  assert.equal(isTelemetryEnabled({}), true);
});
