import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';

const testDir = path.resolve('./.test-data-telemetry');
fs.mkdirSync(path.join(testDir, 'home'), { recursive: true });
fs.mkdirSync(path.join(testDir, 'projects'), { recursive: true });

process.env.HOME = path.join(testDir, 'home');
process.env.PROJECTS_DIR = path.join(testDir, 'projects');
process.env.NODE_ENV = 'test';

const {
  sanitizeEvent,
  isTelemetryEnabled,
  trackTelemetry,
  telemetryErrorCode,
  telemetryEmitter,
} = await import('../node-backend/lib/telemetry/index.mjs');
import { TELEMETRY_EVENTS, ALLOWED_EVENT_NAMES } from '../node-backend/lib/telemetry/catalog.mjs';

test('sanitizeEvent drops unknown event names', () => {
  assert.equal(sanitizeEvent('prompt.content', { content: 'secret' }), null);
  assert.equal(sanitizeEvent('unknown.event.name', {}), null);
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

test('sanitizeEvent supports ui.button_clicked and new catalog events', () => {
  const event = sanitizeEvent('ui.button_clicked', {
    buttonId: 'btn_new_chat',
    location: 'chat_panel',
    unallowedField: 'secret',
  });

  assert.deepEqual(event, {
    name: 'ui.button_clicked',
    payload: {
      buttonId: 'btn_new_chat',
      location: 'chat_panel',
    },
  });
});

test('isTelemetryEnabled respects settings opt-out', () => {
  assert.equal(isTelemetryEnabled({ telemetry: { enabled: false } }), false);
  assert.equal(isTelemetryEnabled({ telemetry: { enabled: true } }), true);
  assert.equal(isTelemetryEnabled({}), true);
  assert.equal(isTelemetryEnabled(null), true);
});

test('telemetryErrorCode handles various error shapes', () => {
  assert.equal(telemetryErrorCode(null), 'unknown');
  assert.equal(telemetryErrorCode(undefined), 'unknown');
  
  const errWithCode = new Error('Failed to connect');
  errWithCode.code = 'ECONNREFUSED';
  assert.equal(telemetryErrorCode(errWithCode), 'ECONNREFUSED');

  const errWithName = new TypeError('Invalid argument');
  assert.equal(telemetryErrorCode(errWithName), 'TypeError');

  const errWithLongCode = { code: 'A'.repeat(300) };
  assert.equal(telemetryErrorCode(errWithLongCode).length, 256);

  assert.equal(telemetryErrorCode({}), 'error');
});

test('trackTelemetry emits event via telemetryEmitter when enabled', async () => {
  let emitted = null;
  const listener = (evt) => {
    emitted = evt;
  };
  telemetryEmitter.on('event', listener);

  try {
    const success = await trackTelemetry('ui.button_clicked', {
      buttonId: 'test_button',
      location: 'test_bar',
    }, { telemetry: { enabled: true } });

    assert.equal(success, true);
    assert.notEqual(emitted, null);
    assert.equal(emitted.name, 'ui.button_clicked');
    assert.deepEqual(emitted.payload, { buttonId: 'test_button', location: 'test_bar' });
  } finally {
    telemetryEmitter.off('event', listener);
  }
});

test('trackTelemetry returns false when disabled in settings', async () => {
  const success = await trackTelemetry('ui.button_clicked', {
    buttonId: 'test_button',
    location: 'test_bar',
  }, { telemetry: { enabled: false } });

  assert.equal(success, false);
});

test('trackTelemetry skips emission when broadcast is false', async () => {
  let emitted = null;
  const listener = (evt) => {
    emitted = evt;
  };
  telemetryEmitter.on('event', listener);

  try {
    const success = await trackTelemetry('ui.button_clicked', {
      buttonId: 'test_button',
      location: 'test_bar',
    }, { telemetry: { enabled: true } }, { broadcast: false });

    assert.equal(success, true);
    assert.equal(emitted, null);
  } finally {
    telemetryEmitter.off('event', listener);
  }
});

test('TELEMETRY_EVENTS catalog is frozen and contains valid event lists', () => {
  assert.equal(Object.isFrozen(TELEMETRY_EVENTS), true);
  assert.equal(ALLOWED_EVENT_NAMES.size, Object.keys(TELEMETRY_EVENTS).length);
  assert.equal(ALLOWED_EVENT_NAMES.has('ui.button_clicked'), true);
  assert.equal(ALLOWED_EVENT_NAMES.has('error.unhandled'), true);
  assert.equal(ALLOWED_EVENT_NAMES.has('view.changed'), true);
});
