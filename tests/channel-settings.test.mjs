import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHANNEL_SETTINGS_STORAGE_KEY,
  DEFAULT_CHANNEL_SETTINGS,
  loadChannelSettings,
  mergeChannelSettings,
  saveChannelSettings,
  stripSecrets,
} from '../src/lib/channelSettings.js';

function createStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    dump: () => Object.fromEntries(store.entries()),
  };
}

test('mergeChannelSettings keeps defaults and overrides provided values', () => {
  const merged = mergeChannelSettings({ enabled: true, telegramDefaultChatId: '123' });
  assert.equal(merged.enabled, true);
  assert.equal(merged.telegramDefaultChatId, '123');
  assert.equal(merged.defaultProjectRouting, 'manual');
});

test('loadChannelSettings returns defaults on empty or malformed storage', () => {
  const empty = createStorage();
  assert.deepEqual(loadChannelSettings(empty), DEFAULT_CHANNEL_SETTINGS);

  const bad = createStorage({ [CHANNEL_SETTINGS_STORAGE_KEY]: '{bad json' });
  assert.deepEqual(loadChannelSettings(bad), DEFAULT_CHANNEL_SETTINGS);
});

test('saveChannelSettings persists normalized payload and can be reloaded', () => {
  const storage = createStorage();
  saveChannelSettings(storage, {
    enabled: true,
    telegramBotToken: '123:ABC',
    defaultProjectRouting: 'last_active',
  });

  const savedRaw = storage.dump()[CHANNEL_SETTINGS_STORAGE_KEY];
  // Token should NOT be in localStorage — it's stripped
  assert.ok(!savedRaw.includes('123:ABC'), 'Bot token must not leak into localStorage');

  const loaded = loadChannelSettings(storage);
  assert.equal(loaded.enabled, true);
  assert.equal(loaded.defaultProjectRouting, 'last_active');
  // Token should be empty after load (security)
  assert.equal(loaded.telegramBotToken, '');
});

// ── New tests for security hardening ──

test('stripSecrets removes telegramBotToken and whatsappAccessToken', () => {
  const full = {
    enabled: true,
    defaultProjectRouting: 'manual',
    telegramBotToken: 'secret-telegram-token',
    telegramDefaultChatId: '12345',
    whatsappAccessToken: 'secret-whatsapp-token',
    whatsappPhoneNumberId: '67890',
    notes: 'test note',
  };
  const stripped = stripSecrets(full);

  assert.ok(!('telegramBotToken' in stripped), 'telegramBotToken must be removed');
  assert.ok(!('whatsappAccessToken' in stripped), 'whatsappAccessToken must be removed');
  // Non-secret fields remain
  assert.equal(stripped.enabled, true);
  assert.equal(stripped.telegramDefaultChatId, '12345');
  assert.equal(stripped.whatsappPhoneNumberId, '67890');
  assert.equal(stripped.notes, 'test note');
});

test('loadChannelSettings strips secret fields from legacy data', () => {
  // Simulate a legacy storage entry that contains tokens (pre-security-fix)
  const legacyPayload = JSON.stringify({
    enabled: true,
    defaultProjectRouting: 'manual',
    telegramBotToken: 'legacy-leaked-token',
    telegramDefaultChatId: '999',
    whatsappAccessToken: 'legacy-leaked-wa-token',
    whatsappPhoneNumberId: '888',
    notes: 'legacy note',
  });
  const storage = createStorage({ [CHANNEL_SETTINGS_STORAGE_KEY]: legacyPayload });
  const loaded = loadChannelSettings(storage);

  assert.equal(loaded.telegramBotToken, '', 'Legacy token should be wiped on load');
  assert.equal(loaded.whatsappAccessToken, '', 'Legacy WA token should be wiped on load');
  // Non-secret data should survive
  assert.equal(loaded.enabled, true);
  assert.equal(loaded.telegramDefaultChatId, '999');
  assert.equal(loaded.notes, 'legacy note');
});

test('mergeChannelSettings handles missing secret fields gracefully', () => {
  const partial = { enabled: true, defaultProjectRouting: 'last_active' };
  const merged = mergeChannelSettings(partial);
  assert.equal(merged.telegramBotToken, '');
  assert.equal(merged.whatsappAccessToken, '');
  assert.equal(merged.enabled, true);
});

test('saveChannelSettings does not expose secrets even when full settings are provided', () => {
  const storage = createStorage();
  saveChannelSettings(storage, {
    enabled: true,
    telegramBotToken: 'SUPER-SECRET',
    whatsappAccessToken: 'ANOTHER-SECRET',
    telegramDefaultChatId: '42',
    whatsappPhoneNumberId: '99',
    defaultProjectRouting: 'manual',
    notes: 'safe content',
  });

  const raw = storage.dump()[CHANNEL_SETTINGS_STORAGE_KEY];
  const parsed = JSON.parse(raw);

  assert.ok(!('telegramBotToken' in parsed), 'telegramBotToken must not be in storage');
  assert.ok(!('whatsappAccessToken' in parsed), 'whatsappAccessToken must not be in storage');
  assert.ok(!raw.includes('SUPER-SECRET'), 'Token value must not appear in raw storage');
  assert.ok(!raw.includes('ANOTHER-SECRET'), 'Token value must not appear in raw storage');
  assert.equal(parsed.telegramDefaultChatId, '42');
  assert.equal(parsed.notes, 'safe content');
});
