import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { generateIndexMarkdown, regenerateProjectIndex, scheduleIndexRegeneration } from '../../../node-backend/lib/silent-learner/index-generator.mjs';

let tempProjectsDir;
let tempHomeDir;
let projectPath;
const projectId = 'index-generator-project';

beforeEach(async () => {
  tempProjectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-index-generator-'));
  process.env.PROJECTS_DIR = tempProjectsDir;
  tempHomeDir = path.join(tempProjectsDir, 'home');
  await fs.mkdir(tempHomeDir, { recursive: true });
  process.env.HOME = tempHomeDir;

  projectPath = path.join(tempProjectsDir, projectId);
  await fs.mkdir(path.join(projectPath, '.metadata'), { recursive: true });
  await fs.writeFile(path.join(projectPath, '.metadata', 'project.json'), JSON.stringify({ id: projectId, name: 'Index Test' }));
});

afterEach(async () => {
  await fs.rm(tempProjectsDir, { recursive: true, force: true });
  delete process.env.PROJECTS_DIR;
  delete process.env.HOME;
});

test('index generator groups artifacts with links and sidecar descriptions', async () => {
  await fs.mkdir(path.join(projectPath, 'prds'), { recursive: true });
  await fs.mkdir(path.join(projectPath, 'roadmaps'), { recursive: true });
  await fs.writeFile(path.join(projectPath, 'prds', 'alpha.md'), '# Alpha PRD\n', 'utf8');
  await fs.writeFile(path.join(projectPath, 'prds', 'alpha.json'), JSON.stringify({ summary: 'Defines the Alpha product requirements.' }), 'utf8');
  await fs.writeFile(path.join(projectPath, 'roadmaps', 'beta.md'), '# Beta Roadmap\n', 'utf8');
  await fs.writeFile(path.join(projectPath, 'roadmaps', 'beta.json'), JSON.stringify({ description: 'Sequenced launch plan.' }), 'utf8');
  await fs.writeFile(path.join(projectPath, '.metadata', 'artifacts.json'), JSON.stringify([
    { id: 'prds/alpha.md', path: 'prds/alpha.md', artifactType: 'prd', title: 'Alpha PRD', updated: '2026-06-01T00:00:00.000Z' },
    { id: 'roadmaps/beta.md', path: 'roadmaps/beta.md', artifactType: 'roadmap', title: 'Beta Roadmap' },
  ]), 'utf8');

  const markdown = await generateIndexMarkdown(projectId);

  assert.match(markdown, /^# Project Index/m);
  assert.match(markdown, /## PRDs/);
  assert.match(markdown, /\[Alpha PRD\]\(prds\/alpha\.md\) — Defines the Alpha product requirements\./);
  assert.match(markdown, /## Roadmaps/);
  assert.match(markdown, /\[Beta Roadmap\]\(roadmaps\/beta\.md\) — Sequenced launch plan\./);
});

test('regenerateProjectIndex writes index.md', async () => {
  await fs.writeFile(path.join(projectPath, '.metadata', 'artifacts.json'), '[]', 'utf8');

  const result = await regenerateProjectIndex(projectId);
  const written = await fs.readFile(path.join(projectPath, 'index.md'), 'utf8');

  assert.strictEqual(result.path, 'index.md');
  assert.strictEqual(written, result.content);
  assert.match(written, /No artifacts discovered yet\./);
});

test('scheduleIndexRegeneration debounces writes', async () => {
  await fs.writeFile(path.join(projectPath, '.metadata', 'artifacts.json'), '[]', 'utf8');

  scheduleIndexRegeneration(projectId, { debounceMs: 10 });
  await new Promise((resolve) => setTimeout(resolve, 40));

  const written = await fs.readFile(path.join(projectPath, 'index.md'), 'utf8');
  assert.match(written, /^# Project Index/m);
});
