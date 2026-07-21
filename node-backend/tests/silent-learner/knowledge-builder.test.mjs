import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createProject, deleteProject } from '../../lib/projects.mjs';
import * as Store from '../../lib/silent-learner/learning-store.mjs';
import * as KnowledgeBuilder from '../../lib/silent-learner/knowledge-builder.mjs';

describe('KnowledgeBuilder Subsystem', () => {
  let tmpDir;
  let project;
  let origEnv;

  beforeEach(async () => {
    origEnv = process.env.PROJECTS_DIR;
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-tests-kb-'));
    process.env.PROJECTS_DIR = tmpDir;
    project = await createProject('KB Test Project', tmpDir);
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

  it('slugify transforms names correctly', () => {
    assert.equal(KnowledgeBuilder.slugify('Mobile UX Feature'), 'mobile-ux-feature');
    assert.equal(KnowledgeBuilder.slugify('  @PRD / Mobile  '), 'prd-mobile');
    assert.equal(KnowledgeBuilder.slugify(null), 'unnamed-concept');
  });

  it('calculateEntityWeights assigns double weight to @ mentions', async () => {
    // Insert event with 1 explicit @ mention and 1 implicit mention
    await Store.insertEvent(project.id, {
      session_id: 'sess-1',
      source: 'chat',
      task_type: 'feature_dev',
      files_touched: ['prds/mobile-ux.md', 'prds/desktop-ux.md'],
      outcome: 'response_generated',
      data_class: 'safe',
      metadata: {
        atMentions: ['prds/mobile-ux.md'],
      },
    });

    const weights = await KnowledgeBuilder.calculateEntityWeights(project.id);

    const mobileWeights = weights.get('mobile-ux');
    const desktopWeights = weights.get('desktop-ux');

    assert.ok(mobileWeights);
    assert.equal(mobileWeights.points, 2); // Explicit @ mention = 2 points
    assert.equal(mobileWeights.atMentionsCount, 1);

    assert.ok(desktopWeights);
    assert.equal(desktopWeights.points, 1); // Implicit = 1 point
    assert.equal(desktopWeights.implicitCount, 1);
  });

  it('buildCompoundingKnowledge generates knowledge pages in .metadata/knowledge/', async () => {
    // Insert 2 events so mobile-ux gets 4 points (2 * 2 points >= 3 min points)
    await Store.insertEvent(project.id, {
      session_id: 'sess-1',
      source: 'chat',
      task_type: 'feature_dev',
      files_touched: ['prds/mobile-ux.md'],
      outcome: 'response_generated',
      data_class: 'safe',
      metadata: { atMentions: ['prds/mobile-ux.md'] },
    });

    await Store.insertEvent(project.id, {
      session_id: 'sess-2',
      source: 'chat',
      task_type: 'feature_dev',
      files_touched: ['prds/mobile-ux.md'],
      outcome: 'response_generated',
      data_class: 'safe',
      metadata: { atMentions: ['prds/mobile-ux.md'] },
    });

    const result = await KnowledgeBuilder.buildCompoundingKnowledge(project.id, { minPoints: 3 });
    assert.equal(result.created, 1);
    assert.equal(result.pages.length, 1);

    const pages = await KnowledgeBuilder.listKnowledgePages(project.id);
    assert.equal(pages.length, 1);
    assert.equal(pages[0].slug, 'mobile-ux');

    // Verify file content & sidecar
    const mdContent = await fs.readFile(pages[0].path, 'utf8');
    assert.ok(mdContent.includes('# Knowledge: mobile ux'));

    const sidecarPath = pages[0].path.replace(/\.md$/, '.json');
    const sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
    assert.equal(sidecar.artifactType, 'knowledge');
    assert.ok(['full', 'heuristic'].includes(sidecar.silentLearner.enrichmentLevel));
    assert.equal(sidecar.silentLearner.atMentionsCount, 2);
  });
});
