import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

import { createProject } from '../lib/projects.mjs';
import * as SilentLearner from '../lib/silent-learner/index.mjs';

let tempProjectsDir;
let project;

beforeEach(async () => {
  tempProjectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-sl-server-'));
  process.env.PROJECTS_DIR = tempProjectsDir;
  process.env.APP_DATA_DIR = path.join(tempProjectsDir, 'app-data');
  await fs.mkdir(process.env.APP_DATA_DIR, { recursive: true });
  await fs.writeFile(
    path.join(process.env.APP_DATA_DIR, 'settings.json'),
    JSON.stringify({ activeProvider: 'none' }),
    'utf8'
  );
  project = await createProject('Silent Learner Server Route Test');
});

afterEach(async () => {
  await SilentLearner.shutdown();
  await fs.rm(tempProjectsDir, { recursive: true, force: true });
  delete process.env.PROJECTS_DIR;
  delete process.env.APP_DATA_DIR;
});

test('Silent Learner getStatus returns correct initial state', async () => {
  const status = await SilentLearner.getStatus(project.id);
  assert.ok(status);
  assert.strictEqual(status.state, 'off');
  assert.strictEqual(status.sessionsObserved, 0);
  assert.strictEqual(status.qualifyingEvents, 0);
  assert.strictEqual(status.lessonsLearned, 0);
});

test('Silent Learner toggle and getStatus workflow', async () => {
  await SilentLearner.toggle(project.id, true);
  let status = await SilentLearner.getStatus(project.id);
  assert.strictEqual(status.state, 'observing');

  await SilentLearner.toggle(project.id, false);
  status = await SilentLearner.getStatus(project.id);
  assert.strictEqual(status.state, 'off');
});
