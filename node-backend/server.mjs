#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ensureDirectoryStructure, getAppDataDir, getGlobalSettingsPath, getProjectsDir, getSecretsPath, getSkillsDir } from './lib/paths.mjs';
import { getUrl, readJson, sendError, sendJson, sendNoContent } from './lib/http.mjs';
import { listProjects, getProjectById, getProjectFiles, createProject, renameProject, deleteProject } from './lib/projects.mjs';
import { getProjectSettings, saveProjectSettings } from './lib/project-settings.mjs';
import { clearResearchLog, getResearchLog } from './lib/research-log.mjs';
import { createSkill, deleteSkill, getSkillById, getSkillsByCategory, getTemplate, listSkills, renderSkill, saveSkill, updateSkill, validateSkill } from './lib/skills.mjs';
import { createArtifact, deleteArtifact, exportArtifact, getArtifact, importArtifact, listArtifacts, migrateArtifacts, saveArtifact, updateArtifactMetadata } from './lib/artifacts.mjs';
import { clearWorkflowSchedule, deleteWorkflow, executeWorkflow, getActiveRuns, getWorkflow, getWorkflowHistory, listWorkflows, saveWorkflow, setWorkflowSchedule, stopWorkflowExecution, validateWorkflow } from './lib/workflows.mjs';
import { AgentOrchestrator } from './lib/orchestrator.mjs';
import { AIService } from './lib/ai.mjs';
import { ChatService } from './lib/chat.mjs';
import { CostLog } from './lib/cost.mjs';
import { checkCli, getAppConfig } from './lib/system.mjs';
import { EncryptionService } from './lib/encryption.mjs';
import { FileService } from './lib/files.mjs';

const orchestrator = new AgentOrchestrator();
const sseClients = new Set();

function broadcast(event, data) {
  const payload = `data: ${JSON.stringify({ type: event, ...data })}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (err) {
      console.error('[SSE] Failed to write to client', err);
      sseClients.delete(client);
    }
  }
}

// Wire up orchestrator events
orchestrator.on('trace-log', (message) => broadcast('trace-log', { message, timestamp: new Date().toISOString() }));
orchestrator.on('file-changed', (data) => broadcast('file-changed', data));
orchestrator.on('artifacts-changed', (data) => broadcast('artifacts-changed', data));

// Heartbeat to keep connections alive
setInterval(() => {
  broadcast('heartbeat', { timestamp: new Date().toISOString() });
}, 30000);

const PORT = Number(process.env.PRODUCTOS_NODE_SERVER_PORT || 51424);

async function readGlobalSettings() {
  const settingsPath = await getGlobalSettingsPath();
  try {
    return JSON.parse(await fs.readFile(settingsPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

async function writeGlobalSettings(settings) {
  const settingsPath = await getGlobalSettingsPath();
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
}

async function readSecrets() {
  const secretsPath = await getSecretsPath();
  try {
    const encryptedData = await fs.readFile(secretsPath, 'utf8');
    const decryptedData = EncryptionService.decrypt(encryptedData);
    return JSON.parse(decryptedData);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {};
    }
    // If decryption fails, it might be an old plain JSON file
    try {
      const raw = await fs.readFile(secretsPath, 'utf8');
      const data = JSON.parse(raw);
      // Automatically migrate to encrypted
      await writeSecrets(data);
      return data;
    } catch {
      return {};
    }
  }
}

async function writeSecrets(secrets) {
  const secretsPath = await getSecretsPath();
  const encryptedData = EncryptionService.encrypt(JSON.stringify(secrets));
  await fs.writeFile(secretsPath, encryptedData, 'utf8');
}

function getZeroUsageStatistics() {
  return {
    totalPrompts: 0,
    totalResponses: 0,
    totalCostUsd: 0,
    totalTimeSavedMinutes: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheCreationTokens: 0,
    totalReasoningTokens: 0,
    totalToolCalls: 0,
    providerBreakdown: [],
  };
}

async function getAvailableProviders() {
  const settings = await readGlobalSettings();
  const providers = [
    'ollama',
    'claudeCode',
    'hostedApi',
    'geminiCli',
    'openAiCli',
    'liteLlm',
  ];

  if (Array.isArray(settings?.customClis)) {
    for (const custom of settings.customClis) {
      if (custom?.name && !providers.includes(custom.name)) {
        providers.push(custom.name);
      }
    }
  }

  return providers;
}

function getDefaultChannelSettings() {
  return {
    enabled: false,
    telegramEnabled: false,
    whatsappEnabled: false,
    defaultProjectRouting: 'manual',
    telegramDefaultChatId: '',
    whatsappPhoneNumberId: '',
    whatsappDefaultRecipient: '',
    notes: '',
    hasTelegramToken: false,
    hasWhatsappToken: false,
  };
}

function getCliDetectionShape(extra = {}) {
  return {
    installed: false,
    in_path: false,
    ...extra,
  };
}


function notImplemented(res, route) {
  sendError(res, 501, `${route} is not implemented in the Node prototype yet`);
}

async function resolveProjectFilePath(projectId, fileName) {
  const project = await getProjectById(projectId);
  const resolved = path.resolve(project.path, fileName);
  const root = path.resolve(project.path);
  if (!resolved.startsWith(root)) {
    const error = new Error('invalid project file path');
    error.statusCode = 400;
    throw error;
  }
  return resolved;
}

async function handleRequest(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      return sendNoContent(res);
    }

    const url = getUrl(req);

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    return sendJson(res, 200, { 
      message: 'ProductOS API (Node) is running',
      version: '0.3.0-node',
      health: '/api/health',
      frontend: 'http://localhost:5173'
    });
  }

  if (req.method === 'GET' && url.pathname === '/favicon.ico') {
    return sendNoContent(res);
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, runtime: 'node-prototype' });
  }

  if (req.method === 'GET' && url.pathname === '/api/system/data-directory') {
    return sendJson(res, 200, await getAppDataDir());
  }

  if (req.method === 'GET' && url.pathname === '/api/system/first-install') {
    return sendJson(res, 200, false);
  }

  if (req.method === 'GET' && url.pathname === '/api/system/config') {
    return sendJson(res, 200, await getAppConfig());
  }

  if (req.method === 'POST' && url.pathname === '/api/system/shutdown') {
    console.log('[node-backend] Shutdown requested');
    sendNoContent(res, 200);
    setTimeout(() => process.exit(0), 100);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/system/detect/clear-cache') {
    return sendNoContent(res, 200);
  }

  if (req.method === 'GET' && (url.pathname === '/api/system/events' || url.pathname === '/api/system/trace-logs')) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    
    res.write('retry: 5000\n');
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);
    
    sseClients.add(res);
    
    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/settings/paths') {
    return sendJson(res, 200, {
      global_settings_path: await getGlobalSettingsPath(),
      secrets_path: await getSecretsPath(),
      projects_path: await getProjectsDir(),
      skills_path: await getSkillsDir(),
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/settings/global') {
    return sendJson(res, 200, await readGlobalSettings());
  }

  if (req.method === 'POST' && url.pathname === '/api/settings/global') {
    const body = await readJson(req);
    await writeGlobalSettings(body);
    return sendNoContent(res, 200);
  }

  if (req.method === 'GET' && url.pathname === '/api/settings/project') {
    const projectId = url.searchParams.get('project_id');
    if (!projectId) return sendError(res, 400, 'project_id is required');
    return sendJson(res, 200, await getProjectSettings(projectId));
  }

  if (req.method === 'POST' && url.pathname === '/api/settings/project') {
    const projectId = url.searchParams.get('project_id');
    if (!projectId) return sendError(res, 400, 'project_id is required');
    const body = await readJson(req);
    await saveProjectSettings(projectId, body);
    return sendNoContent(res, 200);
  }

  if (req.method === 'GET' && url.pathname === '/api/settings/usage') {
    const projects = await listProjects();
    const globalStats = {
      totalPrompts: 0,
      totalResponses: 0,
      totalCostUsd: 0,
      totalTimeSavedMinutes: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheCreationTokens: 0,
      totalReasoningTokens: 0,
      totalToolCalls: 0,
      providerBreakdown: [],
    };

    const providerMap = new Map();

    for (const project of projects) {
      const costLogPath = path.join(project.path, '.metadata', 'cost_log.json');
      const log = await CostLog.load(costLogPath);
      const stats = log.getUsageStatistics();

      globalStats.totalPrompts += stats.totalPrompts;
      globalStats.totalResponses += stats.totalResponses;
      globalStats.totalCostUsd += stats.totalCostUsd;
      globalStats.totalTimeSavedMinutes += stats.totalTimeSavedMinutes;
      globalStats.totalInputTokens += stats.totalInputTokens;
      globalStats.totalOutputTokens += stats.totalOutputTokens;
      globalStats.totalCacheReadTokens += stats.totalCacheReadTokens;
      globalStats.totalCacheCreationTokens += stats.totalCacheCreationTokens;
      globalStats.totalReasoningTokens += stats.totalReasoningTokens;
      globalStats.totalToolCalls += stats.totalToolCalls;

      for (const p of stats.providerBreakdown) {
        if (!providerMap.has(p.provider)) {
          providerMap.set(p.provider, { ...p });
        } else {
          const entry = providerMap.get(p.provider);
          entry.promptCount += p.promptCount;
          entry.responseCount += p.responseCount;
          entry.totalCostUsd += p.totalCostUsd;
          entry.totalInputTokens += p.totalInputTokens;
          entry.totalOutputTokens += p.totalOutputTokens;
        }
      }
    }

    globalStats.providerBreakdown = Array.from(providerMap.values());
    return sendJson(res, 200, globalStats);
  }

  if (req.method === 'GET' && url.pathname === '/api/settings/providers') {
    return sendJson(res, 200, await getAvailableProviders());
  }

  if (req.method === 'POST' && url.pathname === '/api/settings/custom_cli') {
    const body = await readJson(req);
    const current = await readGlobalSettings();
    const customClis = Array.isArray(current.customClis) ? current.customClis : [];
    const next = customClis.filter((item) => item?.id !== body?.id && item?.name !== body?.name);
    next.push(body);
    current.customClis = next;
    await writeGlobalSettings(current);
    return sendNoContent(res, 200);
  }

  if (req.method === 'DELETE' && url.pathname === '/api/settings/custom_cli') {
    const name = url.searchParams.get('name');
    if (!name) return sendError(res, 400, 'name is required');
    const current = await readGlobalSettings();
    current.customClis = (Array.isArray(current.customClis) ? current.customClis : []).filter((item) => item?.id !== name && item?.name !== name);
    await writeGlobalSettings(current);
    return sendNoContent(res, 200);
  }

  if ((req.method === 'GET' || req.method === 'POST') && url.pathname === '/api/system/update/check') {
    return sendJson(res, 200, { available: false, currentVersion: 'node-prototype', latestVersion: 'node-prototype', version: 'node-prototype' });
  }

  if (req.method === 'GET' && url.pathname === '/api/system/detect/ollama') {
    const status = await checkCli('ollama');
    return sendJson(res, 200, { ...status, running: status.installed });
  }

  if (req.method === 'GET' && url.pathname === '/api/system/detect/claude') {
    const status = await checkCli('claude');
    return sendJson(res, 200, { ...status, authenticated: status.installed });
  }

  if (req.method === 'GET' && url.pathname === '/api/system/detect/gemini') {
    const status = await checkCli('gemini');
    return sendJson(res, 200, { ...status, authenticated: status.installed });
  }

  if (req.method === 'GET' && url.pathname === '/api/system/detect/openai') {
    return sendJson(res, 200, await checkCli('openai'));
  }

  if (req.method === 'GET' && url.pathname.startsWith('/api/system/maintenance/')) {
    return notImplemented(res, url.pathname);
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/system/maintenance/')) {
    return notImplemented(res, url.pathname);
  }

  if (req.method === 'GET' && url.pathname === '/api/projects') {
    return sendJson(res, 200, await listProjects());
  }

  if (req.method === 'POST' && url.pathname === '/api/projects/create') {
    const body = await readJson(req);
    if (!body?.name) return sendError(res, 400, 'name is required');
    const project = await createProject(body.name, body.goal || '', body.skills || []);
    broadcast('project-added', project);
    return sendJson(res, 200, project);
  }

  if (req.method === 'GET' && url.pathname === '/api/projects/get') {
    const projectId = url.searchParams.get('project_id');
    if (!projectId) return sendError(res, 400, 'project_id is required');
    return sendJson(res, 200, await getProjectById(projectId));
  }

  if (req.method === 'GET' && url.pathname === '/api/projects/files') {
    const projectId = url.searchParams.get('project_id');
    if (!projectId) return sendError(res, 400, 'project_id is required');
    return sendJson(res, 200, await getProjectFiles(projectId));
  }

  if (req.method === 'GET' && url.pathname === '/api/files/exists') {
    const projectId = url.searchParams.get('project_id');
    const fileName = url.searchParams.get('file_name');
    if (!projectId || !fileName) return sendError(res, 400, 'project_id and file_name are required');
    try {
      await fs.access(await resolveProjectFilePath(projectId, fileName));
      return sendJson(res, 200, true);
    } catch {
      return sendError(res, 404, 'Not found');
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/files/read') {
    const projectId = url.searchParams.get('project_id');
    const fileName = url.searchParams.get('file_name');
    if (!projectId || !fileName) return sendError(res, 400, 'project_id and file_name are required');
    const content = await fs.readFile(await resolveProjectFilePath(projectId, fileName), 'utf8');
    return sendJson(res, 200, content);
  }

  if (req.method === 'PUT' && url.pathname === '/api/files/write') {
    const body = await readJson(req);
    const target = await resolveProjectFilePath(body.project_id, body.file_name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body.content ?? '', 'utf8');
    return sendNoContent(res, 200);
  }

  if (req.method === 'POST' && url.pathname === '/api/files/rename') {
    const body = await readJson(req);
    const source = await resolveProjectFilePath(body.project_id, body.old_name);
    const target = await resolveProjectFilePath(body.project_id, body.new_name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.rename(source, target);
    return sendNoContent(res, 200);
  }

  if (req.method === 'DELETE' && url.pathname === '/api/files/delete') {
    const projectId = url.searchParams.get('project_id');
    const fileName = url.searchParams.get('file_name');
    if (!projectId || !fileName) return sendError(res, 400, 'project_id and file_name are required');
    await fs.rm(await resolveProjectFilePath(projectId, fileName), { force: true });
    return sendNoContent(res, 200);
  }

  if (req.method === 'POST' && url.pathname === '/api/files/import') {
    const body = await readJson(req);
    if (!body?.project_id || !body?.source_path) return sendError(res, 400, 'project_id and source_path are required');
    return sendJson(res, 200, await FileService.importDocument(body.project_id, body.source_path));
  }

  if (req.method === 'POST' && url.pathname === '/api/files/export') {
    const body = await readJson(req);
    if (!body?.project_id || !body?.file_name || !body?.target_path || !body?.export_format) {
        return sendError(res, 400, 'project_id, file_name, target_path, and export_format are required');
    }
    await FileService.exportDocument(body.project_id, body.file_name, body.target_path, body.export_format);
    return sendNoContent(res, 200);
  }

  if (req.method === 'POST' && url.pathname === '/api/projects/rename') {
    const body = await readJson(req);
    if (!body?.project_id) return sendError(res, 400, 'project_id is required');
    if (!body?.new_name) return sendError(res, 400, 'new_name is required');
    await renameProject(body.project_id, body.new_name);
    return sendNoContent(res, 200);
  }

  if (req.method === 'DELETE' && url.pathname === '/api/projects/delete') {
    const projectId = url.searchParams.get('project_id');
    if (!projectId) return sendError(res, 400, 'project_id is required');
    await deleteProject(projectId);
    broadcast('project-removed', { project_id: projectId });
    return sendNoContent(res, 200);
  }

  if (req.method === 'GET' && url.pathname === '/api/projects/cost') {
    const projectId = url.searchParams.get('project_id');
    if (!projectId) return sendError(res, 400, 'project_id is required');
    const project = await getProjectById(projectId);
    const costLogPath = path.join(project.path, '.metadata', 'cost_log.json');
    const log = await CostLog.load(costLogPath);
    return sendJson(res, 200, log.totalCost());
  }

  if (req.method === 'GET' && url.pathname === '/api/artifacts/list') {
    const projectId = url.searchParams.get('project_id');
    if (!projectId) return sendError(res, 400, 'project_id is required');
    return sendJson(res, 200, await listArtifacts(projectId));
  }

  if (req.method === 'POST' && url.pathname === '/api/artifacts/create') {
    const body = await readJson(req);
    return sendJson(res, 200, await createArtifact(body.project_id, body.artifact_type, body.title));
  }

  if (req.method === 'GET' && url.pathname === '/api/artifacts/get') {
    const projectId = url.searchParams.get('project_id');
    const artifactId = url.searchParams.get('artifact_id');
    if (!projectId || !artifactId) return sendError(res, 400, 'project_id and artifact_id are required');
    return sendJson(res, 200, await getArtifact(projectId, artifactId));
  }

  if (req.method === 'PUT' && url.pathname === '/api/artifacts/save') {
    const body = await readJson(req);
    await saveArtifact(body);
    return sendNoContent(res, 200);
  }

  if (req.method === 'DELETE' && url.pathname === '/api/artifacts/delete') {
    const projectId = url.searchParams.get('project_id');
    const artifactId = url.searchParams.get('artifact_id');
    if (!projectId || !artifactId) return sendError(res, 400, 'project_id and artifact_id are required');
    await deleteArtifact(projectId, artifactId);
    return sendNoContent(res, 200);
  }

  if (req.method === 'POST' && url.pathname === '/api/artifacts/update-metadata') {
    const body = await readJson(req);
    await updateArtifactMetadata(body.project_id, body.artifact_id, { title: body.title, confidence: body.confidence });
    return sendNoContent(res, 200);
  }

  if (req.method === 'POST' && url.pathname === '/api/artifacts/migrate') {
    const body = await readJson(req);
    return sendJson(res, 200, await migrateArtifacts(body.project_id));
  }

  if (req.method === 'POST' && url.pathname === '/api/artifacts/import') {
    const body = await readJson(req);
    return sendJson(res, 200, await importArtifact(body.project_id, body.artifact_type, body.source_path));
  }

  if (req.method === 'POST' && url.pathname === '/api/artifacts/export') {
    const body = await readJson(req);
    await exportArtifact(body.project_id, body.artifact_id, body.artifact_type, body.target_path, body.export_format);
    return sendNoContent(res, 200);
  }

  if (req.method === 'GET' && url.pathname === '/api/workflows') {
    const projectId = url.searchParams.get('project_id');
    if (!projectId) return sendError(res, 400, 'project_id is required');
    return sendJson(res, 200, await listWorkflows(projectId));
  }

  if (req.method === 'GET' && url.pathname === '/api/workflows/get') {
    const projectId = url.searchParams.get('project_id');
    const workflowId = url.searchParams.get('workflow_id');
    if (!projectId || !workflowId) return sendError(res, 400, 'project_id and workflow_id are required');
    return sendJson(res, 200, await getWorkflow(projectId, workflowId));
  }

  if ((req.method === 'PUT' || req.method === 'POST') && url.pathname === '/api/workflows/save') {
    const body = await readJson(req);
    await saveWorkflow(body);
    return sendNoContent(res, 200);
  }

  if (req.method === 'POST' && url.pathname === '/api/workflows/create') {
    const body = await readJson(req);
    const now = new Date().toISOString();
    const workflow = {
      id: body.name.toLowerCase().replace(/ /g, '-').replace(/[^a-z0-9-_]/g, ''),
      project_id: body.project_id,
      name: body.name,
      description: body.description || '',
      steps: [],
      version: '1.0.0',
      created: now,
      updated: now,
      notify_on_completion: false,
    };
    await saveWorkflow(workflow);
    return sendJson(res, 200, workflow);
  }

  if (req.method === 'DELETE' && url.pathname === '/api/workflows/delete') {
    const projectId = url.searchParams.get('project_id');
    const workflowId = url.searchParams.get('workflow_id');
    if (!projectId || !workflowId) return sendError(res, 400, 'project_id and workflow_id are required');
    await deleteWorkflow(projectId, workflowId);
    return sendNoContent(res, 200);
  }

  if (req.method === 'POST' && url.pathname === '/api/workflows/schedule/set') {
    const body = await readJson(req);
    return sendJson(res, 200, await setWorkflowSchedule(body.project_id, body.workflow_id, body.schedule));
  }

  if (req.method === 'POST' && url.pathname === '/api/workflows/schedule/clear') {
    const body = await readJson(req);
    return sendJson(res, 200, await clearWorkflowSchedule(body.project_id, body.workflow_id));
  }

  if (req.method === 'GET' && url.pathname === '/api/workflows/history') {
    const projectId = url.searchParams.get('project_id');
    const workflowId = url.searchParams.get('workflow_id');
    if (!projectId || !workflowId) return sendError(res, 400, 'project_id and workflow_id are required');
    return sendJson(res, 200, await getWorkflowHistory(projectId, workflowId));
  }

  if (req.method === 'POST' && url.pathname === '/api/workflows/execute') {
    const body = await readJson(req);
    const settings = await readGlobalSettings();
    return sendJson(res, 200, await executeWorkflow(body.project_id, body.workflow_id, orchestrator, settings));
  }

  if ((req.method === 'POST') && (url.pathname === '/api/workflows/stop' || url.pathname === '/api/workflows/stop-execution')) {
    const body = await readJson(req);
    await stopWorkflowExecution(body.project_id, body.workflow_id);
    return sendNoContent(res, 200);
  }

  if (req.method === 'POST' && url.pathname === '/api/workflows/validate') {
    const body = await readJson(req);
    return sendJson(res, 200, await validateWorkflow(body));
  }

  if (req.method === 'GET' && url.pathname === '/api/workflows/active') {
    return sendJson(res, 200, getActiveRuns());
  }

  if (req.method === 'GET' && url.pathname === '/api/channels/settings') {
    const settings = await readGlobalSettings();
    return sendJson(res, 200, settings.channelConfig || getDefaultChannelSettings());
  }

  if (req.method === 'POST' && url.pathname === '/api/channels/settings') {
    const body = await readJson(req);
    const current = await readGlobalSettings();
    const nextConfig = body?.config ? body.config : body;
    current.channelConfig = { ...getDefaultChannelSettings(), ...nextConfig };
    await writeGlobalSettings(current);
    return sendNoContent(res, 200);
  }

  if (req.method === 'GET' && url.pathname === '/api/secrets/has') {
    const id = url.searchParams.get('id');
    if (!id) return sendError(res, 400, 'id is required');
    const secrets = await readSecrets();
    return sendJson(res, 200, { has_secret: !!(typeof secrets[id] === 'string' && secrets[id].trim()) });
  }

  if (req.method === 'GET' && url.pathname === '/api/secrets/list') {
    const secrets = await readSecrets();
    return sendJson(res, 200, Object.keys(secrets));
  }

  if (req.method === 'POST' && url.pathname === '/api/secrets/set') {
    const body = await readJson(req);
    if (!body?.id) return sendError(res, 400, 'id is required');
    const secrets = await readSecrets();
    secrets[body.id] = body.value ?? '';
    await writeSecrets(secrets);
    return sendNoContent(res, 200);
  }

  if (req.method === 'POST' && url.pathname === '/api/secrets/set_multiple') {
    const body = await readJson(req);
    await writeSecrets(body || {});
    return sendNoContent(res, 200);
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/openai/status') {
    const secrets = await readSecrets();
    const hasKey = !!(secrets['OPENAI_API_KEY'] || secrets['openai_api_key']);
    return sendJson(res, 200, { connected: hasKey, method: 'api_key', details: hasKey ? 'Authenticated via API Key' : 'API Key missing' });
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/gemini/status') {
    const secrets = await readSecrets();
    const hasKey = !!(secrets['GEMINI_API_KEY'] || secrets['gemini_api_key'] || secrets['GOOGLE_API_KEY']);
    return sendJson(res, 200, { connected: hasKey, method: 'api_key', details: hasKey ? 'Authenticated via API Key' : 'API Key missing' });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/openai/login') {
    return sendJson(res, 200, 'OpenAI auth is not implemented in the Node prototype yet.');
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/gemini/login') {
    return sendJson(res, 200, 'Gemini auth is not implemented in the Node prototype yet.');
  }

  if (req.method === 'POST' && (url.pathname === '/api/auth/openai/logout' || url.pathname === '/api/auth/gemini/logout')) {
    return sendJson(res, 200, 'Logout is not implemented in the Node prototype yet.');
  }

  if (req.method === 'GET' && (url.pathname === '/api/chat/ollama/models' || url.pathname === '/api/chat/models')) {
    const providerType = url.searchParams.get('provider') || 'ollama';
    const settings = await readGlobalSettings();
    const provider = await AIService.createProvider(providerType, settings);
    return sendJson(res, 200, await provider.listModels().catch(() => []));
  }

  if (req.method === 'POST' && (url.pathname === '/api/chat' || url.pathname === '/api/chat/send')) {
    const body = await readJson(req);
    const settings = await readGlobalSettings();
    const result = await orchestrator.runAgentLoop({
      messages: body.messages,
      systemPrompt: body.system_prompt || body.systemPrompt,
      projectId: body.project_id || body.projectId,
      skillId: body.skill_id || body.skillId,
      skillParams: body.skill_params || body.skillParams,
      settings,
    });
    return sendJson(res, 200, result);
  }

  if (req.method === 'GET' && url.pathname === '/api/chat/history') {
    const projectId = url.searchParams.get('project_id');
    const fileName = url.searchParams.get('file_name');
    if (!projectId || !fileName) return sendError(res, 400, 'project_id and file_name are required');
    return sendJson(res, 200, await ChatService.loadChatFromFile(projectId, fileName));
  }

  if (req.method === 'GET' && url.pathname === '/api/chat/files') {
    const projectId = url.searchParams.get('project_id');
    if (!projectId) return sendError(res, 400, 'project_id is required');
    return sendJson(res, 200, await ChatService.getChatFiles(projectId));
  }

  if (req.method === 'GET' && url.pathname === '/api/research-log') {
    const projectId = url.searchParams.get('project_id');
    if (!projectId) return sendError(res, 400, 'project_id is required');
    return sendJson(res, 200, await getResearchLog(projectId));
  }

  if (req.method === 'POST' && url.pathname === '/api/research-log/clear') {
    const body = await readJson(req);
    if (!body?.project_id) return sendError(res, 400, 'project_id is required');
    await clearResearchLog(body.project_id);
    return sendNoContent(res, 200);
  }

  if (req.method === 'GET' && url.pathname === '/api/skills') {
    return sendJson(res, 200, await listSkills());
  }

  if (req.method === 'GET' && url.pathname === '/api/skills/get') {
    const skillId = url.searchParams.get('skill_id');
    const category = url.searchParams.get('category');
    if (skillId) {
      return sendJson(res, 200, await getSkillById(skillId));
    }
    if (category) {
      return sendJson(res, 200, await getSkillsByCategory(category));
    }
    return sendError(res, 400, 'skill_id or category is required');
  }

  if (req.method === 'GET' && url.pathname === '/api/skills/by-category') {
    const category = url.searchParams.get('category');
    if (!category) return sendError(res, 400, 'category is required');
    return sendJson(res, 200, await getSkillsByCategory(category));
  }

  if (req.method === 'POST' && url.pathname === '/api/skills/create') {
    const body = await readJson(req);
    return sendJson(res, 200, await createSkill(body));
  }

  if ((req.method === 'PUT' || req.method === 'POST') && (url.pathname === '/api/skills/save' || url.pathname === '/api/skills/update')) {
    const body = await readJson(req);
    const saved = url.pathname.endsWith('/update') ? await updateSkill(body) : await saveSkill(body);
    return sendJson(res, 200, saved);
  }

  if (req.method === 'DELETE' && url.pathname === '/api/skills/delete') {
    const skillId = url.searchParams.get('skill_id');
    if (!skillId) return sendError(res, 400, 'skill_id is required');
    await deleteSkill(skillId);
    return sendNoContent(res, 200);
  }

  if (req.method === 'POST' && url.pathname === '/api/skills/validate') {
    const body = await readJson(req);
    return sendJson(res, 200, validateSkill(body));
  }

  if (req.method === 'POST' && url.pathname === '/api/skills/template') {
    return sendJson(res, 200, getTemplate());
  }

  if (req.method === 'POST' && url.pathname === '/api/skills/render') {
    const body = await readJson(req);
    const skill = body.skill;
    const params = body.params || {};
    if (!skill) return sendError(res, 400, 'skill is required');
    return sendJson(res, 200, renderSkill(skill, params));
  }

  if (req.method === 'POST' && (url.pathname === '/api/skills/import')) {
    return notImplemented(res, url.pathname);
  }


  return sendError(res, 404, `Unknown route: ${req.method} ${url.pathname}`);
  } catch (error) {
    console.error(`[API ERROR] ${req.method} ${req.url}:`, error);
    return sendError(res, error.statusCode || 500, error.message);
  }
}

await ensureDirectoryStructure();

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    const statusCode = error?.statusCode || 500;
    sendError(res, statusCode, error?.message || 'Internal server error');
  });
});

server.listen(PORT, () => {
  console.log(`[node-backend] listening on http://localhost:${PORT}`);
});
