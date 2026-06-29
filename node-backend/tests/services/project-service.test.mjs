import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createProject, listProjects, getProjectById, renameProject, deleteProject, getProjectFiles } from '../../../node-backend/lib/projects.mjs';
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
  // Should only contain 'aws-marketplace/listing-content.md'
  assert.deepStrictEqual(files, ['aws-marketplace/listing-content.md']);
});
