import { test } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import fs from 'node:fs';

const testDir = path.resolve('./.test-data-telemetry-server');
fs.mkdirSync(path.join(testDir, 'home'), { recursive: true });
fs.mkdirSync(path.join(testDir, 'projects'), { recursive: true });

process.env.HOME = path.join(testDir, 'home');
process.env.PROJECTS_DIR = path.join(testDir, 'projects');
process.env.NODE_ENV = 'test';

const { trackTelemetry, isTelemetryEnabled } = await import('../lib/telemetry/index.mjs');

test('trackTelemetry tracks app and UI events when telemetry enabled', async () => {
  const settings = { telemetry: { enabled: true } };
  const tracked = await trackTelemetry('ui.button_clicked', {
    buttonId: 'btn_save_settings',
    location: 'global_settings',
  }, settings);

  assert.strictEqual(tracked, true);
});

test('trackTelemetry returns false when telemetry is explicitly disabled', async () => {
  const settings = { telemetry: { enabled: false } };
  const tracked = await trackTelemetry('ui.button_clicked', {
    buttonId: 'btn_save_settings',
    location: 'global_settings',
  }, settings);

  assert.strictEqual(tracked, false);
});

test('trackTelemetry rejects non-catalog telemetry events', async () => {
  const settings = { telemetry: { enabled: true } };
  const tracked = await trackTelemetry('unauthorized.internal.event', {
    rawSecret: 'secret_value',
  }, settings);

  assert.strictEqual(tracked, false);
});

test('isTelemetryEnabled respects telemetry settings toggles', () => {
  assert.strictEqual(isTelemetryEnabled({ telemetry: { enabled: true } }), true);
  assert.strictEqual(isTelemetryEnabled({ telemetry: { enabled: false } }), false);
  assert.strictEqual(isTelemetryEnabled({}), true);
});
