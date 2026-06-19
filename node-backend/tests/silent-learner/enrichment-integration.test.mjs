import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createProject } from '../../lib/projects.mjs';
import { createArtifact, reconcileArtifacts } from '../../lib/artifacts.mjs';
import { getSidecarPath } from '../../lib/paths.mjs';
import { enrichImmediate, queueEnrichment, clearEnrichmentQueue, drainEnrichmentQueue } from '../../lib/silent-learner/enrichment.mjs';
import { observeFile, enable, flushAll } from '../../lib/silent-learner/index.mjs';

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

  testProject = await createProject('Enrichment Integration Project');
});

afterEach(async () => {
  clearEnrichmentQueue();
  await drainEnrichmentQueue();
  await fs.rm(tempProjectsDir, { recursive: true, force: true });
  delete process.env.PROJECTS_DIR;
  delete process.env.APP_DATA_DIR;
});

test('Integration - Backward compatibility', async () => {
  // 5.1 Backward compat: load existing sidecar without SL fields
  const fileRel = 'prds/legacy.md';
  const fullFilePath = path.join(testProject.path, fileRel);
  await fs.mkdir(path.dirname(fullFilePath), { recursive: true });
  await fs.writeFile(fullFilePath, '# Legacy PRD\nSome text.', 'utf8');

  const sidecarPath = path.join(testProject.path, 'prds/legacy.json');
  const legacySidecar = {
    id: fileRel,
    artifactType: 'prd',
    title: 'Legacy PRD',
    resource: fileRel,
    projectId: testProject.id,
    created: new Date().toISOString(),
    updated: new Date().toISOString()
    // missing silentLearner block and other OKF fields
  };
  await fs.writeFile(sidecarPath, JSON.stringify(legacySidecar, null, 2), 'utf8');

  // Trigger reconciliation (simulates watcher or app start)
  const count = await reconcileArtifacts(testProject.id);
  assert.strictEqual(count, 1);

  // Read the updated sidecar
  const sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
  assert.strictEqual(sidecar.title, 'Legacy PRD');
  assert.ok(sidecar.silentLearner);
  assert.strictEqual(sidecar.silentLearner.enrichmentLevel, 'minimal');
});

test('Integration - Import triggers immediate and queues background', async () => {
  // 5.2 & 5.3 Import triggers enrichImmediate and queues enrichDeep
  const artifact = await createArtifact(testProject.id, 'prd', 'New Feature Alpha');
  const sidecarPath = path.join(testProject.path, getSidecarPath(artifact.path));
  
  // Read sidecar - should be immediately created with minimal level
  let sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
  assert.strictEqual(sidecar.silentLearner.enrichmentLevel, 'minimal');

  // Wait for background worker to complete
  let enriched = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
      sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
      if (sidecar.silentLearner?.enrichmentLevel === 'full') {
        enriched = true;
        break;
      }
    } catch {}
  }
  assert.ok(enriched, 'Expected sidecar to be fully enriched by background worker');
});

test('Integration - Re-enrich after content change', async () => {
  // 5.4 Re-enrich on content change
  const fileRel = 'prds/changing.md';
  const fullFilePath = path.join(testProject.path, fileRel);
  await fs.mkdir(path.dirname(fullFilePath), { recursive: true });
  await fs.writeFile(fullFilePath, '# Original Title\nInitial content.', 'utf8');

  const sidecar = await enrichImmediate(testProject.id, fileRel);
  const originalHash = sidecar.silentLearner.contentHash;

  // Change file content
  await fs.writeFile(fullFilePath, '# Updated Title\nNew descriptive content paragraph.', 'utf8');

  // Run immediate enrichment again (simulates save or watcher reconcile)
  const updatedSidecar = await enrichImmediate(testProject.id, fileRel);
  assert.notStrictEqual(updatedSidecar.silentLearner.contentHash, originalHash);
  assert.strictEqual(updatedSidecar.silentLearner.enrichmentLevel, 'minimal');
});

test('Integration - Concurrent enrichment of multiple files', async () => {
  // 5.5 Concurrent enrichment
  const files = [];
  for (let i = 0; i < 10; i++) {
    const fileRel = `prds/feature-${i}.md`;
    const fullPath = path.join(testProject.path, fileRel);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, `# Feature ${i}\nContent for feature ${i}.`, 'utf8');
    files.push(fileRel);
  }

  // Queue all files concurrently
  for (const file of files) {
    queueEnrichment(testProject.id, file);
  }

  // Wait for queue processing to finish
  await new Promise(resolve => setTimeout(resolve, 500));

  for (const file of files) {
    const sidecarPath = path.join(testProject.path, getSidecarPath(file));
    const sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
    assert.strictEqual(sidecar.silentLearner.enrichmentLevel, 'full');
    assert.strictEqual(sidecar.silentLearner.compositeScore >= 0.0, true);
  }
});

test('Integration - Batch enrichment of 100 files', async () => {
  // Generate 100 dummy markdown files
  const files = [];
  for (let i = 0; i < 100; i++) {
    const fileRel = `prds/batch-feature-${i}.md`;
    const fullPath = path.join(testProject.path, fileRel);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, `# Batch Feature ${i}\nDescriptive content for batch feature ${i}.`, 'utf8');
    files.push(fileRel);
  }

  // Measure time taken to run immediate enrichment and queue them
  const startTime = Date.now();
  for (const file of files) {
    await enrichImmediate(testProject.id, file);
    queueEnrichment(testProject.id, file);
  }

  // Poll until all 100 files are fully enriched
  let allEnriched = false;
  for (let attempt = 0; attempt < 250; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 200));
    let fullCount = 0;
    for (const file of files) {
      try {
        const sidecarPath = path.join(testProject.path, getSidecarPath(file));
        const sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
        if (sidecar.silentLearner?.enrichmentLevel === 'full') {
          fullCount++;
        }
      } catch {}
    }
    if (fullCount === 100) {
      allEnriched = true;
      break;
    }
  }

  const duration = (Date.now() - startTime) / 1000;
  assert.ok(allEnriched, 'Expected all 100 files to be fully enriched');
  assert.ok(duration < 60, `Expected 100 files enrichment to take less than 60 seconds (took ${duration}s)`);
});

test('Integration - observeFile updates sidecar lastObserved and database usage score', async () => {
  const fileRel = 'prds/observed-feature.md';
  const fullFilePath = path.join(testProject.path, fileRel);
  await fs.mkdir(path.dirname(fullFilePath), { recursive: true });
  await fs.writeFile(fullFilePath, '# Observed Feature\nContent here.', 'utf8');

  // Enable Silent Learner so it captures events and observations
  await enable(testProject.id);

  // Call observeFile
  await observeFile(testProject.id, fileRel);

  // Flush the debounced usage cache to write to SQLite immediately
  await flushAll();

  // 1. Verify sidecar lastObserved is updated
  const sidecarPath = path.join(testProject.path, getSidecarPath(fileRel));
  const sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
  assert.ok(sidecar.silentLearner?.lastObserved, 'Expected lastObserved to be populated in the sidecar');
  const lastObservedDate = new Date(sidecar.silentLearner.lastObserved);
  assert.ok(!isNaN(lastObservedDate.getTime()), 'Expected lastObserved to be a valid Date string');

  // 2. Verify file score in database is updated
  const { getTopScoredFiles } = await import('../../lib/silent-learner/learning-store.mjs');
  const scores = await getTopScoredFiles(testProject.id, 10);
  const fileScore = scores.find(s => s.file_path === fileRel);
  assert.ok(fileScore, 'Expected file score to exist in database');
  assert.strictEqual(fileScore.usage_count, 1, 'Expected usage_count to be 1');
});

