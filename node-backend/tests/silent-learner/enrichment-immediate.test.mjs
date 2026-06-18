import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createProject } from '../../lib/projects.mjs';
import { enrichImmediate } from '../../lib/silent-learner/enrichment.mjs';
import { getSidecarPath } from '../../lib/artifacts.mjs';

let tempProjectsDir;
let testProject;

beforeEach(async () => {
  tempProjectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-tests-projects-'));
  process.env.PROJECTS_DIR = tempProjectsDir;
  
  process.env.APP_DATA_DIR = path.join(tempProjectsDir, 'app-data');
  await fs.mkdir(process.env.APP_DATA_DIR, { recursive: true });
  await fs.writeFile(
    path.join(process.env.APP_DATA_DIR, 'settings.json'),
    JSON.stringify({ activeProvider: 'none' }),
    'utf8'
  );

  testProject = await createProject('Immediate Enrichment Test');
});

afterEach(async () => {
  await fs.rm(tempProjectsDir, { recursive: true, force: true });
  delete process.env.PROJECTS_DIR;
  delete process.env.APP_DATA_DIR;
});

test('Immediate Enrichment - MD with H1 and normal content', async () => {
  const fileRelPath = 'prds/my-feature.md';
  const fullFilePath = path.join(testProject.path, fileRelPath);
  await fs.mkdir(path.dirname(fullFilePath), { recursive: true });
  await fs.writeFile(fullFilePath, '# My Awesome Feature\nThis is a description of my feature.\n## User Stories\nAs a user...', 'utf8');

  const sidecar = await enrichImmediate(testProject.id, fileRelPath);
  
  // 1.1 Hash computation
  assert.ok(sidecar.silentLearner.contentHash);
  assert.strictEqual(sidecar.silentLearner.contentHash.length, 64); // SHA-256 is 64 hex characters
  
  // 1.3 Type classification
  assert.strictEqual(sidecar.artifactType, 'prd');
  
  // 1.6 Title extraction from H1
  assert.strictEqual(sidecar.title, 'My Awesome Feature');
  
  // 1.8 Minimal sidecar schema fields
  assert.strictEqual(sidecar.silentLearner.enrichmentLevel, 'minimal');
  assert.strictEqual(sidecar.resource, fileRelPath);
  assert.strictEqual(sidecar.projectId, testProject.id);
  assert.ok(sidecar.silentLearner.enrichedAt);
});

test('Immediate Enrichment - Empty file and title from filename', async () => {
  const fileRelPath = 'market-research.md';
  const fullFilePath = path.join(testProject.path, fileRelPath);
  await fs.writeFile(fullFilePath, '', 'utf8'); // empty file

  const sidecar = await enrichImmediate(testProject.id, fileRelPath);
  
  // 1.2 Hash of empty file
  const emptyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
  assert.strictEqual(sidecar.silentLearner.contentHash, emptyHash);
  
  // 1.7 Title extraction from filename
  assert.strictEqual(sidecar.title, 'Market Research');
});
