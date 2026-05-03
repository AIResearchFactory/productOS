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
  const project = await getProjectById(projectId);
  const metadataDir = path.join(project.path, '.metadata');
  
  // Try directory first (Rust version)
  const runsDir = path.join(metadataDir, 'workflow_runs');
  if (await fileExists(runsDir)) {
    const files = await fs.readdir(runsDir);
    const runs = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const run = JSON.parse(await fs.readFile(path.join(runsDir, file), 'utf8'));
        runs.push(run);
      } catch {}
    }
    runs.sort((a, b) => new Date(b.started || 0) - new Date(a.started || 0));
    return runs;
  }

  const runsPath = path.join(metadataDir, 'workflow-runs.json');
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

const activeRuns = new Map();

export function getActiveRuns() {
  const result = {};
  for (const [id, run] of activeRuns.entries()) {
    result[id] = run;
  }
  return result;
}

export async function stopWorkflowExecution(projectId, workflowId) {
  for (const [id, run] of activeRuns.entries()) {
    if (run.project_id === projectId && run.workflow_id === workflowId) {
      run.status = 'Cancelled';
      run.completed = new Date().toISOString();
      activeRuns.delete(id);
    }
  }
}

export async function validateWorkflow(workflow) {
  const errors = [];
  if (!workflow.name) errors.push('Workflow name is required');
  if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    errors.push('Workflow must have at least one step');
  }
  return errors;
}

export async function executeWorkflow(projectId, workflowId, orchestrator, settings, broadcast) {
  const workflow = await getWorkflow(projectId, workflowId);
  const now = new Date().toISOString();
  const runId = `${workflowId}-${Date.now()}`;

  const run = {
    id: runId,
    workflow_id: workflow.id,
    workflow_name: workflow.name,
    project_id: projectId,
    started: now,
    status: 'Running',
    trigger: 'manual',
    step_results: {},
  };

  activeRuns.set(runId, run);

  // Background execution
  (async () => {
    try {
      for (const step of (workflow.steps || [])) {
        if (run.status === 'Cancelled') break;

        run.step_results[step.id] = {
          step_id: step.id,
          status: 'Running',
          started: new Date().toISOString(),
        };

        if (broadcast) {
          broadcast('workflow-progress', {
            project_id: projectId,
            workflow_id: workflowId,
            run_id: runId,
            step_id: step.id,
            step_name: step.name,
            status: 'running',
            progress_percent: Math.round(((Object.keys(run.step_results).length - 1) / (workflow.steps?.length || 1)) * 100)
          });
        }

        try {
          // Simplified execution: if it's an agent/skill step, run it
          if (step.step_type === 'Agent' || step.step_type === 'Skill' || step.step_type === 'Prompt') {
            const result = await orchestrator.runAgentLoop({
              messages: [{ role: 'user', content: step.config?.prompt || workflow.description }],
              projectId,
              skillId: step.step_type === 'Skill' ? step.config?.skill_id : null,
              settings,
            });
            run.step_results[step.id].status = 'Completed';
            run.step_results[step.id].completed = new Date().toISOString();
            run.step_results[step.id].output = result.content;
          } else {
            // Other steps are handled as no-op for now
            run.step_results[step.id].status = 'Completed';
            run.step_results[step.id].completed = new Date().toISOString();
          }
        } catch (stepError) {
          run.step_results[step.id].status = 'Failed';
          run.step_results[step.id].error = stepError.message;
          throw stepError;
        }
      }

      if (run.status !== 'Cancelled') {
        run.status = 'Completed';
        run.completed = new Date().toISOString();
      }
    } catch (error) {
      run.status = 'Failed';
      run.error = error.message;
      run.completed = new Date().toISOString();
    } finally {
      activeRuns.delete(runId);
      
      // Save to history
      const history = await readRuns(projectId);
      history.unshift(run);
      await writeRuns(projectId, history.slice(0, 50)); // Keep last 50

      // Update workflow status
      workflow.status = run.status;
      workflow.last_run = run.completed;
      await saveWorkflow(workflow);

      if (broadcast) {
        broadcast('workflow-finished', {
          project_id: projectId,
          workflow_id: workflowId,
          run_id: runId,
          status: run.status,
          error: run.error
        });
        broadcast('workflow-changed', {
          projectId: projectId,
          workflowId: workflowId
        });
      }
    }
  })();

  return runId;
}
