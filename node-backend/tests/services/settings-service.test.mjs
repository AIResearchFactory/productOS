import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { getAppConfig, checkCli, resolveCliCommand } from '../../../node-backend/lib/system.mjs';

let tempAppData;
let tempHome;
let tempProjectsDir;
let originalPath;
let originalHome;
let originalProjectsDir;

beforeEach(async () => {
  tempAppData = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-tests-settings-'));
  tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-tests-home-'));
  tempProjectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-tests-projects-'));
  process.env.APP_DATA_DIR = tempAppData;
  originalPath = process.env.PATH;
  originalHome = process.env.HOME;
  originalProjectsDir = process.env.PROJECTS_DIR;
  process.env.HOME = tempHome;
  process.env.PROJECTS_DIR = tempProjectsDir;
});

afterEach(async () => {
  await fs.rm(tempAppData, { recursive: true, force: true });
  await fs.rm(tempHome, { recursive: true, force: true });
  await fs.rm(tempProjectsDir, { recursive: true, force: true });
  delete process.env.APP_DATA_DIR;
  if (originalPath === undefined) delete process.env.PATH;
  else process.env.PATH = originalPath;
  if (originalHome === undefined) delete process.env.HOME;
  else process.env.HOME = originalHome;
  if (originalProjectsDir === undefined) delete process.env.PROJECTS_DIR;
  else process.env.PROJECTS_DIR = originalProjectsDir;
});

test('Settings Service - getAppConfig returns basic structure', async () => {
  const config = await getAppConfig();
  assert.strictEqual(config.app_data_directory, tempAppData);
  assert.ok(/^\d+\.\d+\./.test(config.version), `version should be semver, got: ${config.version}`);
  // At least these should be booleans
  assert.strictEqual(typeof config.claude_code_enabled, 'boolean');
  assert.strictEqual(typeof config.gemini_enabled, 'boolean');
});

test('Settings Service - checkCli for non-existent command', async () => {
  const res = await checkCli('this-cli-does-not-exist-1234');
  assert.strictEqual(res.installed, false);
});

test('Settings Service - checkCli detects executable on PATH and returns path', async () => {
  const binDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-tests-bin-'));
  const commandName = process.platform === 'win32' ? 'fakecli.cmd' : 'fakecli';
  const commandPath = path.join(binDir, commandName);
  const script = process.platform === 'win32'
    ? '@echo off\necho fakecli 1.2.3\n'
    : '#!/bin/sh\necho fakecli 1.2.3\n';

  await fs.writeFile(commandPath, script, process.platform === 'win32' ? undefined : { mode: 0o755 });
  if (process.platform !== 'win32') await fs.chmod(commandPath, 0o755);
  process.env.PATH = `${binDir}${path.delimiter}${originalPath || ''}`;

  const res = await checkCli('fakecli');
  assert.strictEqual(res.installed, true);
  assert.strictEqual(res.in_path, true);
  assert.equal(path.resolve(res.path), path.resolve(commandPath));
  assert.match(res.version, /fakecli 1\.2\.3/);

  await fs.rm(binDir, { recursive: true, force: true });
});

test('Settings Service - resolveCliCommand prefers codex before openai', async () => {
  const binDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-tests-bin-'));
  const ext = process.platform === 'win32' ? '.cmd' : '';
  const makeScript = async (name) => {
    const commandPath = path.join(binDir, `${name}${ext}`);
    const script = process.platform === 'win32'
      ? `@echo off\necho ${name} 9.9.9\n`
      : `#!/bin/sh\necho ${name} 9.9.9\n`;
    await fs.writeFile(commandPath, script, process.platform === 'win32' ? undefined : { mode: 0o755 });
    if (process.platform !== 'win32') await fs.chmod(commandPath, 0o755);
    return commandPath;
  };

  const codexPath = await makeScript('codex');
  await makeScript('openai');
  process.env.PATH = `${binDir}${path.delimiter}${originalPath || ''}`;

  const res = await resolveCliCommand('codex', 'openai');
  assert.strictEqual(res.installed, true);
  assert.equal(path.resolve(res.path), path.resolve(codexPath));

  await fs.rm(binDir, { recursive: true, force: true });
});
