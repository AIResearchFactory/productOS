import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createArtifact, deleteArtifact, saveArtifact } from '../../../node-backend/lib/artifacts.mjs';

let tempProjectsDir;
let tempHomeDir;
let projectPath;
const projectId = 'navigation-integration-project';

beforeEach(async () => {
  tempProjectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-navigation-integration-'));
  process.env.PROJECTS_DIR = tempProjectsDir;
  process.env.SILENT_LEARNER_INDEX_DEBOUNCE_MS = '0';
  tempHomeDir = path.join(tempProjectsDir, 'home');
  await fs.mkdir(tempHomeDir, { recursive: true });
  process.env.HOME = tempHomeDir;

  projectPath = path.join(tempProjectsDir, projectId);
  await fs.mkdir(path.join(projectPath, '.metadata'), { recursive: true });
  await fs.writeFile(path.join(projectPath, '.metadata', 'project.json'), JSON.stringify({ id: projectId, name: 'Navigation Integration' }));
});

afterEach(async () => {
  await fs.rm(tempProjectsDir, { recursive: true, force: true });
  delete process.env.PROJECTS_DIR;
  delete process.env.SILENT_LEARNER_INDEX_DEBOUNCE_MS;
  delete process.env.HOME;
});

test('artifact CRUD hooks append log entries and regenerate index.md', async () => {
  const artifact = await createArtifact(projectId, 'prd', 'Hooked PRD');
  await saveArtifact({ ...artifact, content: '# Hooked PRD\n\nDetails.' });
  await new Promise((resolve) => setTimeout(resolve, 30));

  const index = await fs.readFile(path.join(projectPath, 'index.md'), 'utf8');
  assert.match(index, /\[Hooked PRD\]\(prds\/hooked-prd\.md\)/);

  let log = await fs.readFile(path.join(projectPath, 'log.md'), 'utf8');
  assert.match(log, /\| create \| artifact: \[Hooked PRD\]/);
  assert.match(log, /\| update \| artifact: \[Hooked PRD\]/);

  await deleteArtifact(projectId, artifact.id);
  await new Promise((resolve) => setTimeout(resolve, 30));

  const updatedIndex = await fs.readFile(path.join(projectPath, 'index.md'), 'utf8');
  assert.doesNotMatch(updatedIndex, /Hooked PRD/);
  log = await fs.readFile(path.join(projectPath, 'log.md'), 'utf8');
  assert.match(log, /\| delete \| artifact: \[Hooked PRD\]/);
});
