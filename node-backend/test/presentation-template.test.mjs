import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createProject, saveProjectTemplate, getProjectTemplate, deleteProjectTemplate } from '../lib/projects.mjs';
import { packZip } from '../lib/zip-utils.mjs';
import { generateFromTemplate } from '../lib/services/pptx-template-service.mjs';

test('Presentation Template Pipeline Test', async (t) => {
  const origHome = process.env.HOME;
  const origProjectsDir = process.env.PROJECTS_DIR;

  const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-home-test-'));
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pptx-test-'));

  process.env.HOME = tmpHome;
  process.env.PROJECTS_DIR = tmpDir;

  t.after(async () => {
    if (origHome !== undefined) {
      process.env.HOME = origHome;
    } else {
      delete process.env.HOME;
    }

    if (origProjectsDir !== undefined) {
      process.env.PROJECTS_DIR = origProjectsDir;
    } else {
      delete process.env.PROJECTS_DIR;
    }

    await fs.rm(tmpHome, { recursive: true, force: true }).catch(() => {});
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  await t.test('saves, retrieves, and deletes custom pptx sample deck', async () => {
    const project = await createProject('PPTX Deck Product', 'Testing template deck pipeline', []);

    // Initially no custom template
    let template = await getProjectTemplate(project.id);
    assert.equal(template, null);

    // Save sample deck buffer
    const mockPptxBuffer = Buffer.from('PK-MOCK-PPTX-DATA');
    await saveProjectTemplate(project.id, mockPptxBuffer);

    // Retrieve custom template
    template = await getProjectTemplate(project.id);
    assert.ok(template);
    assert.equal(template.toString('utf8'), 'PK-MOCK-PPTX-DATA');

    // Delete custom template
    const deleted = await deleteProjectTemplate(project.id);
    assert.equal(deleted, true);

    // Verify deleted
    template = await getProjectTemplate(project.id);
    assert.equal(template, null);
  });

  await t.test('generateFromTemplate duplicates slide XML and populates content', async () => {
    // Construct a minimal valid zipped .pptx layout in memory
    const slide1Xml = '<?xml version="1.0"?><p:sld><a:t>Original Title</a:t><a:t>Original Body</a:t></p:sld>';
    const presentationXml = '<?xml version="1.0"?><p:presentation><p:sldIdLst></p:sldIdLst></p:presentation>';

    const zipFiles = {
      'ppt/slides/slide1.xml': Buffer.from(slide1Xml),
      'ppt/presentation.xml': Buffer.from(presentationXml)
    };

    const templateZipBuffer = packZip(zipFiles);

    const slidesData = [
      { title: 'Slide 1 Title', bodyText: ['Body text paragraph 1'], bullets: ['Bullet item 1'] },
      { title: 'Slide 2 Title', bodyText: ['Body text paragraph 2'], bullets: ['Bullet item 2'] }
    ];

    const outputBuffer = generateFromTemplate(templateZipBuffer, slidesData);
    assert.ok(outputBuffer);
    assert.ok(Buffer.isBuffer(outputBuffer));
  });
});
