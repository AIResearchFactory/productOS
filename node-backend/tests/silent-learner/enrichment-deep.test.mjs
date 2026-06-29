import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createProject } from '../../lib/projects.mjs';
import { enrichImmediate, enrichDeep, enrichRelational } from '../../lib/silent-learner/enrichment.mjs';

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

  testProject = await createProject('Deep Enrichment Test');
});

afterEach(async () => {
  await fs.rm(tempProjectsDir, { recursive: true, force: true });
  delete process.env.PROJECTS_DIR;
  delete process.env.APP_DATA_DIR;
});

test('Deep Enrichment - Heuristic Fallback (No AI provider)', async () => {
  const fileRelPath = 'prds/my-feature.md';
  const fullFilePath = path.join(testProject.path, fileRelPath);
  await fs.mkdir(path.dirname(fullFilePath), { recursive: true });
  
  const content = `# Feature Alpha\n\nThis is the first paragraph that details Feature Alpha and should be extracted as the summary since it is descriptive and informative.\n\n## Specifications\n**Bold Keyword** is critical.`;
  await fs.writeFile(fullFilePath, content, 'utf8');

  // Stage 1
  const sidecar = await enrichImmediate(testProject.id, fileRelPath);
  assert.strictEqual(sidecar.silentLearner.enrichmentLevel, 'minimal');

  // Stage 2
  const enriched = await enrichDeep(testProject.id, fileRelPath, sidecar);

  // 4.2 Summary fallback
  assert.ok(enriched.description);
  assert.ok(enriched.description.includes('This is the first paragraph'));
  assert.ok(enriched.description.length <= 160);

  // 4.4 Tag fallback
  assert.ok(enriched.tags.includes('Specifications'));

  // 4.5 Enrichment level
  assert.strictEqual(enriched.silentLearner.enrichmentLevel, 'full');

  // 4.6 Timestamp
  assert.ok(enriched.silentLearner.enrichedAt);
});

test('Relational Enrichment - cross-references matching entities', async () => {
  // Create File A (Feature Alpha)
  const fileARel = 'prds/feature-alpha.md';
  const fileAPath = path.join(testProject.path, fileARel);
  await fs.mkdir(path.dirname(fileAPath), { recursive: true });
  await fs.writeFile(fileAPath, '# Feature Alpha\nMentions competitor AlphaCorp.', 'utf8');

  // Create File B (Competitor Review)
  const fileBRel = 'competitive-research/competitors.md';
  const fileBPath = path.join(testProject.path, fileBRel);
  await fs.mkdir(path.dirname(fileBPath), { recursive: true });
  await fs.writeFile(fileBPath, '# AlphaCorp Competitor\nReview of AlphaCorp strategy.', 'utf8');

  // Enrich A
  const sidecarA = await enrichImmediate(testProject.id, fileARel);
  await enrichDeep(testProject.id, fileARel, sidecarA);

  // Enrich B
  const sidecarB = await enrichImmediate(testProject.id, fileBRel);
  await enrichDeep(testProject.id, fileBRel, sidecarB);

  // Run relational enrichment on A
  const updatedA = await enrichRelational(testProject.id, fileARel, sidecarA);

  // Verification
  assert.ok(updatedA.sourceRefs.includes(fileBRel));

  // Verify bidirectional check (updated B should now reference A)
  const sidecarBPath = path.join(testProject.path, 'competitive-research/competitors.json');
  const updatedB = JSON.parse(await fs.readFile(sidecarBPath, 'utf8'));
  assert.ok(updatedB.sourceRefs.includes(fileARel));

  // Compute composite score verification
  assert.ok(updatedA.silentLearner.compositeScore >= 0.0);
});
