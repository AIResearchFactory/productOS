import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createArtifact, getArtifact, deleteArtifact } from '../../../node-backend/lib/artifacts.mjs';
import * as projects from '../../../node-backend/lib/projects.mjs';

let tempProjectsDir;
let tempProjectId = 'test-proj-artifacts';
let projectPath;

beforeEach(async () => {
  tempProjectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-tests-artifacts-'));
  process.env.PROJECTS_DIR = tempProjectsDir;
  projectPath = path.join(tempProjectsDir, tempProjectId);
  await fs.mkdir(path.join(projectPath, '.metadata', 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(projectPath, '.metadata', 'project.json'), JSON.stringify({ id: tempProjectId, name: 'Test' }));
});

afterEach(async () => {
  await fs.rm(tempProjectsDir, { recursive: true, force: true });
  delete process.env.PROJECTS_DIR;
});

test('Artifact Service - create and get', async () => {
  const artifact = await createArtifact(tempProjectId, 'roadmap', 'My Roadmap');
  assert.strictEqual(artifact.title, 'My Roadmap');
  assert.strictEqual(artifact.artifactType, 'roadmap');
  
  const loaded = await getArtifact(tempProjectId, artifact.id);
  assert.strictEqual(loaded.title, 'My Roadmap');
});

test('Artifact Service - delete', async () => {
  const artifact = await createArtifact(tempProjectId, 'task', 'To Delete');
  await deleteArtifact(tempProjectId, artifact.id);
  
  await assert.rejects(
    async () => await getArtifact(tempProjectId, artifact.id),
    { message: /not found/i }
  );
});
