import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createProject } from '../lib/projects.mjs';

// Setup temporary environment
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'comments-test-'));
const projectsDir = path.join(tempDir, 'projects');

process.env.PROJECTS_DIR = projectsDir;
process.env.HOME = tempDir;

test('Comments Storage Registry', async (t) => {
  await fs.mkdir(projectsDir, { recursive: true });

  await t.test('write and read project comments', async () => {
    // 1. Create a dummy project
    const project = await createProject('Comments Test Project');

    // 2. Define comments metadata paths matching the API logic
    const fileName = 'artifacts/prd.md';
    const commentsDir = path.join(project.path, '.metadata', 'comments');
    const sanitizedName = fileName.replace(/\//g, '__').replace(/\\/g, '__') + '.json';
    const commentsFilePath = path.join(commentsDir, sanitizedName);

    const mockComments = [
      {
        id: 'c1',
        text: 'Fix metrics',
        anchorText: 'some throughput anchor',
        anchorIndex: 100,
        status: 'open',
        createdAt: new Date().toISOString()
      }
    ];

    // 3. Ensure registry folder exists and write comments
    await fs.mkdir(commentsDir, { recursive: true });
    await fs.writeFile(commentsFilePath, JSON.stringify(mockComments, null, 2), 'utf8');

    // 4. Retrieve comments and check correctness
    const fileContent = await fs.readFile(commentsFilePath, 'utf8');
    const loadedComments = JSON.parse(fileContent);

    assert.strictEqual(loadedComments.length, 1);
    assert.strictEqual(loadedComments[0].id, 'c1');
    assert.strictEqual(loadedComments[0].text, 'Fix metrics');
  });

  // Cleanup after all tests
  t.after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
