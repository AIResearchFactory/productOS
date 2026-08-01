import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { PromptService, PromptMode } from '../lib/prompt.mjs';
import { getProjectContext } from '../lib/context.mjs';
import { createProject, getProjectById } from '../lib/projects.mjs';
import { saveProjectSettings } from '../lib/project-settings.mjs';
import * as ArtifactService from '../lib/artifacts.mjs';

test('Prompt & Context Optimization Suite', async (t) => {
  const origHome = process.env.HOME;
  const origProjectsDir = process.env.PROJECTS_DIR;

  const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'prompt-home-test-'));
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prompt-projects-test-'));

  process.env.HOME = tmpHome;
  process.env.PROJECTS_DIR = tmpDir;

  t.after(async () => {
    if (origHome !== undefined) process.env.HOME = origHome;
    else delete process.env.HOME;

    if (origProjectsDir !== undefined) process.env.PROJECTS_DIR = origProjectsDir;
    else delete process.env.PROJECTS_DIR;

    await fs.rm(tmpHome, { recursive: true, force: true }).catch(() => {});
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  await t.test('buildSystemPrompt excludes redundant personalization rules block and includes steering for research_log.md', async () => {
    let project = await createProject('Prompt Test Product', 'Testing prompt reduction', []);
    const settings = {
      personalization_rules: 'Write concise PM docs without jargon.',
    };
    await saveProjectSettings(project.id, settings);
    project = await getProjectById(project.id);

    const prompt = await PromptService.buildSystemPrompt(project, PromptMode.General, settings);

    // 1. Should NOT contain raw "=== PROJECT PERSONALIZATION RULES ===" block
    assert.equal(prompt.includes('=== PROJECT PERSONALIZATION RULES ==='), false);

    // 2. Should contain AGENT CONTEXT STEERING referencing writing-style.md
    assert.match(prompt, /Follow writing style rules from `\.metadata\/_context\/rules\/writing-style\.md`/);

    // 3. Should contain research_log.md steering rule
    assert.match(prompt, /Track research progress and document key discovery findings in `research_log\.md`/);
  });

  await t.test('getProjectContext returns low-token summary with research history and artifact index', async () => {
    const project = await createProject('Context Test Product', 'Testing compact context', []);

    // Create research_log.md and README.md
    await fs.writeFile(path.join(project.path, 'README.md'), '# Context Test Product\n\nOverview of the test product.', 'utf8');
    await fs.writeFile(path.join(project.path, 'research_log.md'), '## Entry 1\nResearched user needs.\n\n## Entry 2\nValidated specs.', 'utf8');

    // Create an artifact
    await ArtifactService.createArtifact(project.id, 'prd', 'Mobile Checkout PRD');

    const contextStr = await getProjectContext(project.id);

    // 1. Contains README preview
    assert.match(contextStr, /## README\.md/);
    assert.match(contextStr, /Overview of the test product/);

    // 2. Contains recent research history
    assert.match(contextStr, /Recent Research History \(from research_log\.md\)/);
    assert.match(contextStr, /Validated specs/);

    // 3. Contains First-Class Artifact index (concise)
    assert.match(contextStr, /## Project Artifacts \(First-Class Deliverables\)/);
    assert.match(contextStr, /Mobile Checkout PRD/);

    // 4. Does NOT contain full 50-file preview scan section
    assert.equal(contextStr.includes('## Research Files & Resources'), false);
  });
});
