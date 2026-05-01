import fs from 'node:fs/promises';
import path from 'node:path';
import { getProjectById } from './projects.mjs';

async function fileExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function getWorkflowDir(projectId) {
  const project = await getProjectById(projectId);
  const dir = path.join(project.path, '.metadata', 'workflows');
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

async function getRunsPath(projectId) {
  const project = await getProjectById(projectId);
  const metadataDir = path.join(project.path, '.metadata');
  await fs.mkdir(metadataDir, { recursive: true });
  return path.join(metadataDir, 'workflow-runs.json');
}

async function readRuns(projectId) {
  const runsPath = await getRunsPath(projectId);
  try {
    return JSON.parse(await fs.readFile(runsPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

async function writeRuns(projectId, runs) {
  const runsPath = await getRunsPath(projectId);
  await fs.writeFile(runsPath, JSON.stringify(runs, null, 2), 'utf8');
}

export async function listWorkflows(projectId) {
  const dir = await getWorkflowDir(projectId);
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const workflows = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    try {
      const workflow = JSON.parse(await fs.readFile(path.join(dir, entry.name), 'utf8'));
      workflows.push(workflow);
    } catch {
      // ignore malformed prototype files
    }
  }
  workflows.sort((a, b) => a.name.localeCompare(b.name));
  return workflows;
}

export async function getWorkflow(projectId, workflowId) {
  const filePath = path.join(await getWorkflowDir(projectId), `${workflowId}.json`);
  if (!await fileExists(filePath)) {
    const error = new Error(`Workflow not found: ${workflowId}`);
    error.statusCode = 404;
    throw error;
  }
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

export async function saveWorkflow(workflow) {
  const filePath = path.join(await getWorkflowDir(workflow.project_id), `${workflow.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(workflow, null, 2), 'utf8');
  return workflow;
}

export async function deleteWorkflow(projectId, workflowId) {
  const filePath = path.join(await getWorkflowDir(projectId), `${workflowId}.json`);
  await fs.rm(filePath, { force: true });
}

export async function setWorkflowSchedule(projectId, workflowId, schedule) {
  const workflow = await getWorkflow(projectId, workflowId);
  workflow.schedule = schedule;
  workflow.updated = new Date().toISOString();
  await saveWorkflow(workflow);
  return workflow;
}

export async function clearWorkflowSchedule(projectId, workflowId) {
  const workflow = await getWorkflow(projectId, workflowId);
  workflow.schedule = null;
  workflow.updated = new Date().toISOString();
  await saveWorkflow(workflow);
  return workflow;
}

export async function getWorkflowHistory(projectId, workflowId) {
  const runs = await readRuns(projectId);
  return runs.filter((run) => run.workflow_id === workflowId);
}

export async function executeWorkflow(projectId, workflowId) {
  const workflow = await getWorkflow(projectId, workflowId);
  const now = new Date().toISOString();
  workflow.status = 'Completed';
  workflow.last_run = now;
  workflow.updated = now;
  await saveWorkflow(workflow);

  const run = {
    id: `${workflowId}-${Date.now()}`,
    workflow_id: workflow.id,
    workflow_name: workflow.name,
    project_id: projectId,
    started: now,
    completed: now,
    status: 'Completed',
    trigger: 'manual',
    step_results: Object.fromEntries((workflow.steps || []).map((step) => [step.id, {
      step_id: step.id,
      status: 'Completed',
      started: now,
      completed: now,
      output_files: [],
      logs: [],
    }])),
  };

  const runs = await readRuns(projectId);
  runs.unshift(run);
  await writeRuns(projectId, runs);
  return run.id;
}
