import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createProject, listProjects, getProjectById, renameProject, deleteProject } from '../../../node-backend/lib/projects.mjs';
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
