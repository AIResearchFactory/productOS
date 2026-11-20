import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createProject, listProjects, getProjectById, renameProject, deleteProject, getProjectFiles, hasProjectTemplate, saveProjectTemplate, deleteProjectTemplate } from '../../../node-backend/lib/projects.mjs';
import { getProjectArtifactTemplates } from '../../../node-backend/lib/project-settings.mjs';
import { ChatService } from '../../../node-backend/lib/chat.mjs';
import * as paths from '../../../node-backend/lib/paths.mjs';

let tempProjectsDir;

beforeEach(async () => {
  tempProjectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-tests-projects-'));
  process.env.PROJECTS_DIR = tempProjectsDir;
});

afterEach(async () => {
  await fs.rm(tempProjectsDir, { recursive: true, force: true });
  delete process.env.PROJECTS_DIR;
});

test('Project Service - createProject', async () => {
  const project = await createProject('Test Project', 'A test goal', ['js']);
  assert.strictEqual(project.name, 'Test Project');
  assert.strictEqual(project.goal, 'A test goal');
  assert.deepStrictEqual(project.skills, ['js']);
  
  const files = await fs.readdir(tempProjectsDir);
  assert.strictEqual(files.length, 1);
});

test('Project Service - listProjects', async () => {
  await createProject('Project A');
  await createProject('Project B');
  const projects = await listProjects();
  assert.strictEqual(projects.length, 2);
  assert.strictEqual(projects[0].name, 'Project A');
  assert.strictEqual(projects[1].name, 'Project B');
});

test('Project Service - renameProject', async () => {
  const project = await createProject('Old Name');
  await renameProject(project.id, 'New Name');
  const updated = await getProjectById(project.id);
  assert.strictEqual(updated.name, 'New Name');
});

test('Project Service - deleteProject', async () => {
  const project = await createProject('To Delete');
  await deleteProject(project.id);
  const projects = await listProjects();
  assert.strictEqual(projects.length, 0);
});

test('Project Service - getProjectFiles sorting', async () => {
  const project = await createProject('Sorting Project');
  
  const fileA = path.join(project.path, 'a-file.txt');
  const fileB = path.join(project.path, 'b-file.txt');
  const fileC = path.join(project.path, 'c-file.txt');

  await fs.writeFile(fileB, 'content b');
  await fs.writeFile(fileC, 'content c');
  await fs.writeFile(fileA, 'content a');

  const now = Date.now();
  await fs.utimes(fileB, new Date(now - 10000), new Date(now - 10000));
  await fs.utimes(fileA, new Date(now - 5000), new Date(now - 5000));
  await fs.utimes(fileC, new Date(now), new Date(now));

  // Default alphabetical
  const defaultFiles = await getProjectFiles(project.id);
  assert.deepStrictEqual(defaultFiles, ['a-file.txt', 'b-file.txt', 'c-file.txt']);

  // Sort by mtime descending (newest first)
  const mtimeFiles = await getProjectFiles(project.id, { sort: 'mtime' });
  assert.deepStrictEqual(mtimeFiles, ['c-file.txt', 'a-file.txt', 'b-file.txt']);
});

test('Project Service - getProjectFiles recursive and ignore rules', async () => {
  const project = await createProject('Recursive Project');
  
  // 1. Create a nested user file
  const subDir = path.join(project.path, 'aws-marketplace');
  await fs.mkdir(subDir, { recursive: true });
  await fs.writeFile(path.join(subDir, 'listing-content.md'), 'content');

  // 2. Create ignored backend logs
  await fs.writeFile(path.join(project.path, 'research_log.md'), 'log');
  await fs.writeFile(path.join(project.path, 'log.md'), 'log');
  await fs.writeFile(path.join(project.path, 'index.md'), 'index');

  // 3. Create a sidecar file and its markdown
  await fs.writeFile(path.join(subDir, 'listing-content.json'), '{}');

  // 4. Create an artifact folder file (should be ignored in getProjectFiles)
  const prdDir = path.join(project.path, 'prds');
  await fs.mkdir(prdDir, { recursive: true });
  await fs.writeFile(path.join(prdDir, 'prd-1.md'), 'prd');

  // 5. Create a chat file inside chats/ directory (should be ignored in getProjectFiles)
  const chatsDir = path.join(project.path, 'chats');
  await fs.mkdir(chatsDir, { recursive: true });
  await fs.writeFile(path.join(chatsDir, 'chat_2026.md'), 'chat');

  const files = await getProjectFiles(project.id);
  // Should contain the subfolder entry and 'aws-marketplace/listing-content.md'
  assert.deepStrictEqual(files, ['aws-marketplace/', 'aws-marketplace/listing-content.md']);
});

test('Project Service - getProjectFiles returns empty directories with trailing slash', async () => {
  const project = await createProject('Empty Folder Project');
  const emptyDir = path.join(project.path, 'empty-folder', 'nested-empty');
  await fs.mkdir(emptyDir, { recursive: true });

  const files = await getProjectFiles(project.id);
  assert.deepStrictEqual(files, ['empty-folder/', 'empty-folder/nested-empty/']);
});

test('Project Service - allows symlinked project directories while blocking in-project symlink escapes', async (t) => {
  const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-outside-project-'));
  t.after(async () => {
    await fs.rm(outsideRoot, { recursive: true, force: true });
  });

  const targetDir = path.join(outsideRoot, 'productos');
  const secretOutsideDir = path.join(outsideRoot, 'secret-area');
  await fs.mkdir(path.join(targetDir, '.metadata'), { recursive: true });
  await fs.mkdir(secretOutsideDir, { recursive: true });
  await fs.writeFile(
    path.join(targetDir, '.metadata', 'project.json'),
    JSON.stringify({ id: 'productos', name: 'ProductOS', goal: 'Test symlinked project', created: new Date().toISOString() }),
    'utf8'
  );
  await fs.writeFile(path.join(targetDir, 'notes.md'), '# Notes', 'utf8');
  await fs.writeFile(path.join(secretOutsideDir, 'secret.txt'), 'nope', 'utf8');
  await fs.symlink(secretOutsideDir, path.join(targetDir, 'escape-dir'), process.platform === 'win32' ? 'junction' : 'dir');

  await fs.symlink(targetDir, path.join(tempProjectsDir, 'productos'), process.platform === 'win32' ? 'junction' : 'dir');

  const projects = await listProjects();
  assert.ok(projects.some((p) => p.id === 'productos'));

  const fetched = await getProjectById('productos');
  assert.strictEqual(fetched.name, 'ProductOS');

  const files = await getProjectFiles('productos');
  assert.ok(files.includes('notes.md'));

  // Symlink escape inside the symlinked project must still be rejected
  await assert.rejects(() => paths.safeJoin(fetched.path, 'escape-dir', 'secret.txt'), /Security Error/);

  // Chat operations on symlinked project directories must succeed while blocking traversal
  const chatFile = await ChatService.saveChatToFile('productos', [{ role: 'user', content: 'Hello' }, { role: 'assistant', content: 'Hi' }], 'test-model');
  const chatFiles = await ChatService.getChatFiles('productos');
  assert.ok(chatFiles.includes(chatFile));
  const loadedMessages = await ChatService.loadChatFromFile('productos', chatFile);
  assert.strictEqual(loadedMessages.length, 2);
  await assert.rejects(() => ChatService.loadChatFromFile('productos', '../notes.md'), /Security Error/);
});

test('Project Service - getProjectArtifactTemplates handles missing dir, filters entries, and rejects symlink escapes', async (t) => {
  const project = await createProject('Templates Test Project');

  // Returns {} when .templates directory does not exist
  assert.deepStrictEqual(await getProjectArtifactTemplates(project.id), {});

  const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-outside-tpl-'));
  t.after(async () => {
    await fs.rm(outsideDir, { recursive: true, force: true });
  });
  await fs.writeFile(path.join(outsideDir, 'secret.md'), '# Secret Outside Content', 'utf8');

  const templatesDir = path.join(project.path, '.templates');
  await fs.mkdir(templatesDir, { recursive: true });
  await fs.writeFile(path.join(templatesDir, 'prd.md'), '# Custom PRD Template', 'utf8');
  await fs.writeFile(path.join(templatesDir, 'roadmap.md'), '# Custom Roadmap Template', 'utf8');
  await fs.writeFile(path.join(templatesDir, 'unknown_type.md'), '# Ignored Unknown Type', 'utf8');
  await fs.writeFile(path.join(templatesDir, 'prd.txt'), 'Ignored non-md file', 'utf8');
  await fs.symlink(
    path.join(outsideDir, 'secret.md'),
    path.join(templatesDir, 'one_pager.md')
  );

  const templates = await getProjectArtifactTemplates(project.id);
  assert.deepStrictEqual(templates, {
    prd: '# Custom PRD Template',
    roadmap: '# Custom Roadmap Template',
  });
});

test('Project Service - hasProjectTemplate checks presence without reading full buffer', async () => {
  const project = await createProject('Template Presence Project');
  assert.strictEqual(await hasProjectTemplate(project.id), false);

  await saveProjectTemplate(project.id, Buffer.from('PK-MOCK-PPTX'));
  assert.strictEqual(await hasProjectTemplate(project.id), true);

  await deleteProjectTemplate(project.id);
  assert.strictEqual(await hasProjectTemplate(project.id), false);
});

test('Project Service - concurrent getProjectById calls deduplicate context verification cleanly', async () => {
  const project = await createProject('Concurrent Lookup Project');
  const completionMarker = path.join(project.path, '.metadata', '_context', '.complete');
  await fs.rm(completionMarker, { force: true });

  const results = await Promise.all(
    Array.from({ length: 10 }, () => getProjectById(project.id))
  );

  assert.strictEqual(results.length, 10);
  for (const res of results) {
    assert.strictEqual(res.id, project.id);
    assert.strictEqual(res.name, 'Concurrent Lookup Project');
  }
  const markerExists = await fs.access(completionMarker).then(() => true).catch(() => false);
  assert.strictEqual(markerExists, true);
});
