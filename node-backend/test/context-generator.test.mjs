import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { generateContextDirectory, getContextStatus } from '../lib/context-generator.mjs';
import { createProject } from '../lib/projects.mjs';
import { saveProjectSettings } from '../lib/project-settings.mjs';

test('Context Generator & Project Settings OKF Pipeline', async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'okf-test-'));
  process.env.PROJECTS_DIR = tmpDir;

  await t.test('generateContextDirectory materializes all 7 OKF files', async () => {
    const project = await createProject('Test Product', 'To test OKF context layer', []);
    const settings = {
      personalization_rules: '## Tone\n- Professional and direct',
      brand_settings: '{"colors":{"primary":"#003366"}}',
      domain_keywords: ['ProductOS', 'OKF', 'Agent Steering'],
      avoided_keywords: ['synergy', 'paradigm shift'],
    };

    // Create dummy personas.md and competitors.md in project root
    await fs.writeFile(path.join(project.path, 'personas.md'), '# Target Personas\n\n## PM Alex\n- Goal: Export ready PRDs');
    await fs.writeFile(path.join(project.path, 'competitors.md'), '# Competitors\n\n| Competitor A |');

    await saveProjectSettings(project.id, settings);

    const contextDir = path.join(project.path, '.metadata', '_context');

    // 1. Verify index.md
    const indexContent = await fs.readFile(path.join(contextDir, 'index.md'), 'utf8');
    assert.match(indexContent, /type: agent_steering/);
    assert.match(indexContent, /Agent Steering: Project Context Map for Test Product/);
    assert.match(indexContent, /File Sidecar Metadata Awareness/);

    // 2. Verify project/overview.md
    const overviewContent = await fs.readFile(path.join(contextDir, 'project', 'overview.md'), 'utf8');
    assert.match(overviewContent, /type: project_overview/);
    assert.match(overviewContent, /To test OKF context layer/);
    assert.match(overviewContent, /Sidecar Metadata/);
    assert.doesNotMatch(overviewContent, /replacing traditional README/);

    // 3. Verify rules/writing-style.md
    const styleContent = await fs.readFile(path.join(contextDir, 'rules', 'writing-style.md'), 'utf8');
    assert.match(styleContent, /type: policy/);
    assert.match(styleContent, /Professional and direct/);
    assert.match(styleContent, /Document Quality & Export Readiness/);

    // 4. Verify rules/brand-design.md
    const brandContent = await fs.readFile(path.join(contextDir, 'rules', 'brand-design.md'), 'utf8');
    assert.match(brandContent, /type: policy/);
    assert.match(brandContent, /#003366/);

    // 5. Verify templates/guiding-questions.md
    const questionsContent = await fs.readFile(path.join(contextDir, 'templates', 'guiding-questions.md'), 'utf8');
    assert.match(questionsContent, /Target Personas/);
    assert.match(questionsContent, /Problem & Job-to-be-Done/);
    assert.match(questionsContent, /Non-Functional Requirements/);
    assert.match(questionsContent, /Performance/);
    assert.match(questionsContent, /Telemetry & Metrics/);
    assert.match(questionsContent, /Security & Privacy/);
    assert.match(questionsContent, /Accessibility/);

    // 6. Verify references/keywords.md
    const kwContent = await fs.readFile(path.join(contextDir, 'references', 'keywords.md'), 'utf8');
    assert.match(kwContent, /ProductOS/);
    assert.match(kwContent, /Agent Steering/);

    // 7. Verify references/avoided-terms.md
    const avoidContent = await fs.readFile(path.join(contextDir, 'references', 'avoided-terms.md'), 'utf8');
    assert.match(avoidContent, /synergy/);
    assert.match(avoidContent, /paradigm shift/);

    // 8. Verify root references synced
    const personasRef = await fs.readFile(path.join(contextDir, 'references', 'personas.md'), 'utf8');
    assert.match(personasRef, /PM Alex/);

    const compRef = await fs.readFile(path.join(contextDir, 'references', 'competitors.md'), 'utf8');
    assert.match(compRef, /Competitor A/);

    // 9. Verify getContextStatus
    const status = await getContextStatus(project.id);
    assert.equal(status.hasPersonas, true);
    assert.equal(status.hasCompetitors, true);
    assert.equal(status.hasWritingStyle, true);
    assert.equal(status.hasBrandDesign, true);
    assert.equal(status.hasDomainKeywords, true);
    assert.equal(status.hasAvoidedKeywords, true);
    assert.equal(status.hasContextIndex, true);
  });

  await t.test('automatically materializes _context for existing projects missing context directory', async () => {
    // Simulate an existing project directory created externally without _context
    const existingDir = path.join(tmpDir, 'legacy-product');
    await fs.mkdir(path.join(existingDir, '.metadata'), { recursive: true });
    await fs.writeFile(path.join(existingDir, '.metadata', 'project.json'), JSON.stringify({
      id: 'legacy-product',
      name: 'Legacy Product',
      goal: 'Existing product with tons of files',
      created: new Date().toISOString()
    }), 'utf8');

    // Verify _context index.md does NOT exist initially
    const contextIndex = path.join(existingDir, '.metadata', '_context', 'index.md');
    assert.equal(await fs.access(contextIndex).then(() => true).catch(() => false), false);

    // Call getContextStatus which triggers project retrieval and auto-migration
    const status = await getContextStatus('legacy-product');

    // Verify _context directory and index.md were automatically created
    assert.equal(status.hasContextIndex, true);
    const indexContent = await fs.readFile(contextIndex, 'utf8');
    assert.match(indexContent, /Agent Steering: Project Context Map for Legacy Product/);
  });
});
