import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createProject, deleteProject } from '../../lib/projects.mjs';
import * as Store from '../../lib/silent-learner/learning-store.mjs';
import * as KnowledgeLint from '../../lib/silent-learner/knowledge-lint.mjs';

describe('KnowledgeLint Diagnostics Subsystem', () => {
  let tmpDir;
  let project;
  let origEnv;

  beforeEach(async () => {
    origEnv = process.env.PROJECTS_DIR;
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-tests-lint-'));
    process.env.PROJECTS_DIR = tmpDir;
    project = await createProject('Lint Test Project', tmpDir);
    await Store.getDatabase(project.id);
  });

  afterEach(async () => {
    if (project) {
      await Store.destroyAll(project.id).catch(() => {});
      await deleteProject(project.id).catch(() => {});
    }
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    if (origEnv !== undefined) {
      process.env.PROJECTS_DIR = origEnv;
    } else {
      delete process.env.PROJECTS_DIR;
    }
  });

  it('runKnowledgeHealthCheck returns structured health report', async () => {
    const report = await KnowledgeLint.runKnowledgeHealthCheck(project.id);

    assert.ok(typeof report.healthScore === 'number');
    assert.equal(report.summary.totalChecks, 4);
    assert.ok(Array.isArray(report.orphans));
    assert.ok(Array.isArray(report.staleSidecars));
    assert.ok(Array.isArray(report.duplicates));
    assert.ok(Array.isArray(report.missingCoverage));
  });

  it('detects duplicate files with >0.85 similarity', async () => {
    const doc1 = path.join(project.path, 'doc1.md');
    const doc2 = path.join(project.path, 'doc2.md');

    const sampleText = `
# Product Requirements Document for Mobile UX
This feature focuses on creating an intuitive mobile navigation system with offline synchronization and gesture support.
Key goals:
1. Fast mobile response time under 100ms
2. Offline data persistence
3. Clean modern design with dark mode support.
`;

    await fs.writeFile(doc1, sampleText, 'utf8');
    await fs.writeFile(doc2, sampleText, 'utf8'); // Exact duplicate content

    const report = await KnowledgeLint.runKnowledgeHealthCheck(project.id);
    assert.ok(report.duplicates.length > 0);
    assert.equal(report.duplicates[0].similarity, 1);
  });
});
