import fs from 'fs';
import path from 'path';
import { resolveProjectPath, loadProjectById } from './project.js';
import { loadSkill } from './skill.js';
import { chat } from './ai-service.js';
import { createArtifact, updateArtifactContent as saveArtifact } from './artifact.js';
import { getChatFiles, loadChatFromFile } from './chat-history.js';
import { cancellationManager } from './cancellation.js';

/**
 * Port of Rust workflow_service.rs and models/workflow.rs.
 * Manages DAG workflow execution, variable substitution, and step coordination.
 */

// ============= Models & Utilities =============

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function safeJoinProject(projectPath, relativePath) {
  const fullPath = path.resolve(projectPath, relativePath);
  if (!fullPath.startsWith(path.resolve(projectPath))) {
    throw new Error('Resolved path escapes project directory: ' + relativePath);
  }
  return fullPath;
}

function replaceParameters(text, parameters) {
  let result = text;
  if (parameters) {
    for (const [key, value] of Object.entries(parameters)) {
      result = result.split(`{{${key}}}`).join(value);
      result = result.split(`{${key}}`).join(value);
    }
  }
  return result;
}

// ============= CRUD Operations =============

export function loadProjectWorkflows(projectId) {
  try {
    const projectPath = resolveProjectPath(projectId);
    const workflowsDir = path.join(projectPath, '.workflows');
    if (!fs.existsSync(workflowsDir)) return [];

    const files = fs.readdirSync(workflowsDir);
    const workflows = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
          workflows.push(JSON.parse(content));
        } catch (e) {
          console.warn(`Skipping invalid workflow file ${file}:`, e.message);
        }
      }
    }
    return workflows;
  } catch (e) {
    return [];
  }
}

export function loadWorkflow(projectId, workflowId) {
  const projectPath = resolveProjectPath(projectId);
  const workflowPath = path.join(projectPath, '.workflows', `${workflowId}.json`);
  if (!fs.existsSync(workflowPath)) {
    throw new Error(`Workflow ${workflowId} not found in project ${projectId}`);
  }
  return JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
}

export function saveWorkflow(workflow) {
  const projectPath = resolveProjectPath(workflow.project_id);
  const workflowsDir = path.join(projectPath, '.workflows');
  if (!fs.existsSync(workflowsDir)) {
    fs.mkdirSync(workflowsDir, { recursive: true });
  }
  const workflowPath = path.join(workflowsDir, `${workflow.id}.json`);
  fs.writeFileSync(workflowPath, JSON.stringify(workflow, null, 2), 'utf8');
}

export function deleteWorkflow(projectId, workflowId) {
  const projectPath = resolveProjectPath(projectId);
  const workflowPath = path.join(projectPath, '.workflows', `${workflowId}.json`);
  if (fs.existsSync(workflowPath)) {
    fs.unlinkSync(workflowPath);
  }
}

// ============= Execution Engine =============

export async function executeWorkflow(projectId, workflowId, parameters, progressCallback) {
  cancellationManager.removeProcess(`workflow-${projectId}-${workflowId}`);

  let workflow = loadWorkflow(projectId, workflowId);

  const execution = {
    workflow_id: workflowId,
    started: new Date().toISOString(),
    completed: null,
    status: 'Running',
    error: null,
    step_results: {}
  };

  try {
    const layers = getExecutionLayers(workflow.steps);
    const totalSteps = workflow.steps.length;
    let completedCount = 0;

    for (const layer of layers) {
      if (cancellationManager.isCancelled(`workflow-${projectId}-${workflowId}`)) {
        throw new Error('Workflow execution cancelled by user');
      }

      const layerPromises = layer.map(async (step) => {
        // Check deps
        const depsSatisfied = (step.depends_on || []).every(depId => 
          execution.step_results[depId]?.status === 'Completed'
        );

        if (!depsSatisfied) {
          execution.step_results[step.id] = {
            step_id: step.id, status: 'Skipped', started: new Date().toISOString(), completed: new Date().toISOString(),
            output_files: [], is_temporary: true, error: 'Dependencies not satisfied', logs: [], next_step_id: null
          };
          completedCount++;
          progressCallback({ workflow_id: workflow.id, project_id: projectId, step_name: step.name, status: 'skipped', progress_percent: Math.floor((completedCount/totalSteps)*100) });
          return;
        }

        progressCallback({ workflow_id: workflow.id, project_id: projectId, step_name: step.name, status: 'running', progress_percent: Math.floor((completedCount/totalSteps)*100) });

        const result = await executeStepWithRetries(step, projectId, execution, parameters, workflow.name);
        execution.step_results[step.id] = result;
        
        completedCount++;
        const statusStr = result.status === 'Completed' ? 'completed' : 'failed';
        progressCallback({ workflow_id: workflow.id, project_id: projectId, step_name: step.name, status: statusStr, progress_percent: Math.floor((completedCount/totalSteps)*100) });

        if (result.status === 'Failed' && !step.config.continue_on_error) {
          throw new Error(`Step '${step.name}' failed: ${result.error}`);
        }
      });

      await Promise.all(layerPromises);
    }

    execution.status = 'Completed';
  } catch (error) {
    execution.error = error.message;
    const hasSuccess = Object.values(execution.step_results).some(r => r.status === 'Completed');
    execution.status = hasSuccess ? 'PartialSuccess' : 'Failed';
  } finally {
    execution.completed = new Date().toISOString();
    workflow.status = execution.status;
    workflow.last_run = execution.started;
    saveWorkflow(workflow);
    
    // Cleanup temporary files
    await cleanupTemporaryFiles(projectId, execution);
  }

  return execution;
}

function getExecutionLayers(steps) {
  const layers = [];
  const executed = new Set();
  let remaining = [...steps];

  while (remaining.length > 0) {
    const currentLayer = [];
    const nextRemaining = [];

    for (const step of remaining) {
      const depsSatisfied = (step.depends_on || []).every(dep => executed.has(dep));
      if (depsSatisfied) currentLayer.push(step);
      else nextRemaining.push(step);
    }

    if (currentLayer.length === 0) throw new Error('Dependency cycle detected');

    for (const step of currentLayer) executed.add(step.id);
    layers.push(currentLayer);
    remaining = nextRemaining;
  }
  return layers;
}

async function cleanupTemporaryFiles(projectId, execution) {
  const projectPath = resolveProjectPath(projectId);
  for (const result of Object.values(execution.step_results)) {
    if (result.is_temporary) {
      for (const fileRel of result.output_files) {
        const filePath = safeJoinProject(projectPath, fileRel);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }
  }
}

async function executeStepWithRetries(step, projectId, execution, parameters, workflowName) {
  const maxRetries = step.config.max_retries || 0;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));

    try {
      let typeStr = step.step_type?.toLowerCase() || 'agent';
      if (typeStr === 'subagent' || typeStr === 'api_call') typeStr = 'agent';

      switch (typeStr) {
        case 'input': return await executeInputStep(step, projectId, parameters);
        case 'agent':
        case 'skill':
        case 'update-file':
        case 'updatefile': return await executeAgentStep(step, projectId, execution, parameters, workflowName);
        case 'iteration': return await executeIterationStep(step, projectId, execution, parameters, workflowName);
        case 'synthesis': return await executeSynthesisStep(step, projectId, execution, parameters, workflowName);
        case 'conditional':
        case 'condition': return await executeConditionalStep(step, projectId);
        default:
          console.warn(`Unknown step type: ${step.step_type}, falling back to agent`);
          return await executeAgentStep(step, projectId, execution, parameters, workflowName);
      }
    } catch (error) {
      lastError = error;
    }
  }

  const errorMsg = `Failed after ${maxRetries} retries: ${lastError?.message || String(lastError)}`;
  return {
    step_id: step.id, status: 'Failed', started: new Date().toISOString(), completed: new Date().toISOString(),
    output_files: [], error: errorMsg, detailed_error: errorMsg, logs: [], next_step_id: null, is_temporary: true
  };
}

// ============= Step Implementations =============

async function executeInputStep(step, projectId, parameters) {
  const logs = [];
  const started = new Date().toISOString();
  
  const sourceType = step.config.source_type || 'ProjectFile';
  const sourceValue = replaceParameters(step.config.source_value || '', parameters);
  
  const isTemp = step.config.is_temporary !== false; // Default true for some flows, but follow Rust default false? Rust says `step.config.is_temporary.unwrap_or(false)`
  const defaultTemp = step.config.is_temporary || false;
  const rawOutputFile = step.config.output_file || (defaultTemp ? `.workflows/tmp/${slugify(step.name)}_${Date.now()}.md` : `${slugify(step.name)}.md`);
  const outputFile = replaceParameters(rawOutputFile, parameters);

  logs.push(`Reading from source type: ${sourceType}`);
  const projectPath = resolveProjectPath(projectId);
  let content = '';

  if (sourceType === 'TextInput') {
    logs.push('Using direct text input');
    content = sourceValue;
  } else if (sourceType === 'FileUpload' || sourceType === 'ProjectFile') {
    logs.push(`Reading from file: ${sourceValue}`);
    const filePath = safeJoinProject(projectPath, sourceValue);
    content = fs.readFileSync(filePath, 'utf8');
  } else if (sourceType === 'ExternalUrl') {
    logs.push(`Fetching from URL: ${sourceValue}`);
    const resp = await fetch(sourceValue);
    if (!resp.ok) throw new Error(`HTTP error! status: ${resp.status}`);
    content = await resp.text();
  } else {
    throw new Error(`Unknown source type: ${sourceType}`);
  }

  const outputPath = safeJoinProject(projectPath, outputFile);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, 'utf8');
  logs.push(`Wrote output to: ${outputFile}`);

  return {
    step_id: step.id, status: 'Completed', started, completed: new Date().toISOString(),
    output_files: [outputFile], is_temporary: defaultTemp || outputFile.startsWith('.workflows/tmp/'),
    error: null, detailed_error: null, logs, next_step_id: null
  };
}

async function executeAgentStep(step, projectId, execution, parameters, workflowName) {
  const logs = [];
  const started = new Date().toISOString();

  if (!step.config.skill_id) throw new Error('skill_id not specified');
  logs.push(`Loading skill: ${step.config.skill_id}`);
  const skill = loadSkill(step.config.skill_id);

  let prompt = skill.prompt_template;
  if (step.config.parameters) {
    for (const [key, value] of Object.entries(step.config.parameters)) {
      prompt = prompt.split(`{{${key}}}`).join(value);
      prompt = prompt.split(`{${key}}`).join(value);
    }
  }
  prompt = replaceParameters(prompt, parameters);

  const project = loadProjectById(projectId);
  let context = `Project: ${project.name}\nGoal: ${project.goal || 'No specific goal set'}\n`;
  const projectPath = resolveProjectPath(projectId);

  if (step.config.input_files) {
    for (const rawFile of step.config.input_files) {
      const fileName = replaceParameters(rawFile, parameters);
      logs.push(`Reading input file: ${fileName}`);
      const filePath = safeJoinProject(projectPath, fileName);
      try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        context += `\n\n## File: ${fileName}\n\n${fileContent}`;
      } catch (e) {
        throw new Error(`Failed to read input file ${fileName}: ${e.message}`);
      }
    }
  }

  if (context.trim() !== '') prompt += `\n\nContext:\n${context}`;

  if (step.config.context === 'fork') {
    const history = await getContextFork(projectId);
    if (history) prompt += `\n\n### Additional Context (from current chat) ###\n${history}`;
  }

  prompt += `\n\nIMPORTANT: Return a single consolidated Markdown report ONLY. Do NOT create separate files or directories using any tools. Your entire output will be saved to a single file by the system.`;

  logs.push('Calling AI Service');
  const responseObj = await chat([{ role: 'user', content: prompt }], null, projectId);
  
  // Clean output
  let response = responseObj.content || '';
  response = response.replace(/^```markdown\n/i, '').replace(/\n```$/i, '');

  logs.push(`Received response (${response.length} chars)`);

  if (step.config.artifact_type) {
    const isGeneratedTitle = !step.config.artifact_title || step.config.artifact_title.toLowerCase().includes('generated');
    const title = isGeneratedTitle && workflowName ? workflowName : (step.config.artifact_title || `Generated ${step.config.artifact_type}`);
    
    logs.push(`Creating artifact: ${title}`);
    try {
      const artifact = createArtifact(projectId, step.config.artifact_type, title);
      artifact.content = response;
      saveArtifact(artifact);
      logs.push(`Artifact saved: ${artifact.id}`);
    } catch (e) {
      logs.push(`Warning: Failed to create artifact: ${e.message}`);
    }
  }

  const defaultTemp = step.config.is_temporary || false;
  const rawOutputFile = step.config.output_file || (defaultTemp ? `.workflows/tmp/${slugify(step.name)}_${Date.now()}.md` : `${slugify(step.name)}.md`);
  const outputFile = replaceParameters(rawOutputFile, parameters);

  const outputPath = safeJoinProject(projectPath, outputFile);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, response, 'utf8');
  logs.push(`Wrote output to: ${outputFile}`);

  return {
    step_id: step.id, status: 'Completed', started, completed: new Date().toISOString(),
    output_files: [outputFile], is_temporary: defaultTemp || outputFile.startsWith('.workflows/tmp/'),
    error: null, detailed_error: null, logs, next_step_id: null
  };
}

// (Stubs for Iteration, Synthesis, Conditional... mirroring Rust logic)
async function executeIterationStep(step, projectId, execution, parameters, workflowName) {
  // Parallel execution maps to Promise.all
  // Similar to executeAgentStep but loops items
  throw new Error('Iteration step fully ported later');
}

async function executeSynthesisStep(step, projectId, execution, parameters, workflowName) {
  throw new Error('Synthesis step fully ported later');
}

async function executeConditionalStep(step, projectId) {
  const started = new Date().toISOString();
  const projectPath = resolveProjectPath(projectId);
  
  const condition = step.config.condition;
  if (!condition) throw new Error('condition not specified');
  
  let result = false;
  if (condition.startsWith('file_exists:')) {
    const file = condition.split('file_exists:')[1].trim();
    const filePath = safeJoinProject(projectPath, file);
    result = fs.existsSync(filePath);
  } else {
    throw new Error(`Unknown format for expression: ${condition}`);
  }

  const nextStepId = result ? step.config.then_step : step.config.else_step;
  
  return {
    step_id: step.id, status: 'Completed', started, completed: new Date().toISOString(),
    output_files: [], is_temporary: true, error: null, detailed_error: null, logs: [`Evaluated condition: ${result}`], next_step_id: nextStepId
  };
}

async function getContextFork(projectId) {
  try {
    const files = getChatFiles(projectId);
    if (files.length > 0) {
      const messages = loadChatFromFile(projectId, files[0].id);
      let history = '';
      for (const msg of messages) {
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        history += `\n${role}: ${msg.content}\n`;
      }
      return history || null;
    }
  } catch (e) { /* ignore */ }
  return null;
}
