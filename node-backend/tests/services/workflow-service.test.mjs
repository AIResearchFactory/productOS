import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { saveWorkflow, deleteWorkflow, validateWorkflow, listWorkflows } from '../../../node-backend/lib/workflows.mjs';

let tempProjectsDir;
let tempProjectId = 'test-proj';

beforeEach(async () => {
  tempProjectsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'productOS-tests-workflows-'));
  process.env.PROJECTS_DIR = tempProjectsDir;
  
  // Create a fake project structure
  await fs.mkdir(path.join(tempProjectsDir, tempProjectId, '.metadata', 'workflows'), { recursive: true });
  await fs.writeFile(path.join(tempProjectsDir, tempProjectId, '.metadata', 'project.json'), JSON.stringify({ id: tempProjectId, name: 'Test' }));
});

afterEach(async () => {
  await fs.rm(tempProjectsDir, { recursive: true, force: true });
  delete process.env.PROJECTS_DIR;
});

test('Workflow Service - validateWorkflow', async () => {
  const errors = await validateWorkflow({ name: '' });
  assert.ok(errors.includes('Workflow name is required'));
});

test('Workflow Service - saveWorkflow and listWorkflows', async () => {
  const workflow = await saveWorkflow({
    id: 'wf-1',
    project_id: tempProjectId,
    name: 'Test Flow',
    description: 'A test flow',
    steps: []
  });
  
  assert.strictEqual(workflow.name, 'Test Flow');
  
  const workflows = await listWorkflows(tempProjectId);
  assert.strictEqual(workflows.length, 1);
  assert.strictEqual(workflows[0].id, workflow.id);
});

test('Workflow Service - deleteWorkflow', async () => {
  const workflow = await saveWorkflow({
    id: 'wf-2',
    project_id: tempProjectId,
    name: 'Flow to delete',
    description: '',
    steps: []
  });
  await deleteWorkflow(tempProjectId, workflow.id);
  
  const workflows = await listWorkflows(tempProjectId);
  assert.strictEqual(workflows.length, 0);
});
