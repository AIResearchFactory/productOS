import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { getAppConfig, checkCli } from '../../../node-backend/lib/system.mjs';

let tempAppData;

beforeEach(async () => {
  tempAppData = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-tests-settings-'));
  process.env.APP_DATA_DIR = tempAppData;
});

afterEach(async () => {
  await fs.rm(tempAppData, { recursive: true, force: true });
  delete process.env.APP_DATA_DIR;
});

test('Settings Service - getAppConfig returns basic structure', async () => {
  const config = await getAppConfig();
  assert.strictEqual(config.app_data_directory, tempAppData);
  assert.strictEqual(config.version, '0.3.0-node');
  // At least these should be booleans
  assert.strictEqual(typeof config.claude_code_enabled, 'boolean');
  assert.strictEqual(typeof config.gemini_enabled, 'boolean');
});

test('Settings Service - checkCli for non-existent command', async () => {
  const res = await checkCli('this-cli-does-not-exist-1234');
  assert.strictEqual(res.installed, false);
});
