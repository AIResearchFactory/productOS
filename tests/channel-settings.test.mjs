import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHANNEL_SETTINGS_STORAGE_KEY,
  DEFAULT_CHANNEL_SETTINGS,
  loadChannelSettings,
  mergeChannelSettings,
  saveChannelSettings,
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
  assert.ok(savedRaw.includes('123:ABC'));

  const loaded = loadChannelSettings(storage);
  assert.equal(loaded.enabled, true);
  assert.equal(loaded.telegramBotToken, '123:ABC');
  assert.equal(loaded.defaultProjectRouting, 'last_active');
});
