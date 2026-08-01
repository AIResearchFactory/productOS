import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createProject } from '../lib/projects.mjs';
import { watcherService } from '../lib/watcher.mjs';

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

  await t.test('watcher handleFileEvent auto-resolves comments', async () => {
    // 1. Create a dummy project
    const project = await createProject('Watcher Test Project');

    // Create a target markdown file in project path
    const filePath = path.join(project.path, 'prd.md');
    await fs.writeFile(filePath, 'original content with special anchor text here', 'utf8');

    // Add open comments to that file
    const commentsDir = path.join(project.path, '.metadata', 'comments');
    const sanitizedName = 'prd.md.json';
    const commentsFilePath = path.join(commentsDir, sanitizedName);

    const mockComments = [
      {
        id: 'c1',
        text: 'Fix anchor',
        anchorText: 'special anchor text',
        status: 'open',
        createdAt: new Date().toISOString()
      },
      {
        id: 'c2',
        text: 'Keep open',
        anchorText: 'original content',
        status: 'open',
        createdAt: new Date().toISOString()
      }
    ];
    await fs.mkdir(commentsDir, { recursive: true });
    await fs.writeFile(commentsFilePath, JSON.stringify(mockComments, null, 2), 'utf8');

    // Rewrite the file content to remove "special anchor text"
    await fs.writeFile(filePath, 'original content with no text here', 'utf8');

    // Trigger handleFileEvent manually
    await watcherService.handleFileEvent('change', project.id, filePath);

    // Read the comments back
    const fileContentComments = await fs.readFile(commentsFilePath, 'utf8');
    const updatedComments = JSON.parse(fileContentComments);

    // Assert c1 was resolved, and c2 remains open
    const c1 = updatedComments.find(c => c.id === 'c1');
    const c2 = updatedComments.find(c => c.id === 'c2');
    assert.strictEqual(c1.status, 'resolved');
    assert.strictEqual(c1.resolvedBy, 'ai');
    assert.strictEqual(c2.status, 'open');
  });

  await t.test('regex dynamic route matching and parameter extraction', () => {
    const routeRegex = /^\/api\/projects\/([^/]+)\/files\/(.+)\/comments$/;
    
    // Test simple path
    const url1 = '/api/projects/proj-123/files/prd.md/comments';
    const match1 = url1.match(routeRegex);
    assert.ok(match1);
    assert.strictEqual(match1[1], 'proj-123');
    assert.strictEqual(match1[2], 'prd.md');

    // Test nested file path
    const url2 = '/api/projects/p-999/files/docs/features/ux/layout-spec.md/comments';
    const match2 = url2.match(routeRegex);
    assert.ok(match2);
    assert.strictEqual(match2[1], 'p-999');
    assert.strictEqual(match2[2], 'docs/features/ux/layout-spec.md');

    // Test URL encoded nested path
    const url3 = '/api/projects/p-999/files/docs%2Ffeatures%2Fux%2Flayout-spec.md/comments';
    const match3 = url3.match(routeRegex);
    assert.ok(match3);
    assert.strictEqual(match3[1], 'p-999');
    assert.strictEqual(decodeURIComponent(match3[2]), 'docs/features/ux/layout-spec.md');
  });

  // Cleanup after all tests
  t.after(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
