import { test } from 'node:test';
import assert from 'node:assert';
import { trackTelemetry, isTelemetryEnabled } from '../lib/telemetry/index.mjs';

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
