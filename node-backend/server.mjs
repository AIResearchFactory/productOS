#!/usr/bin/env node

/**
 * @file server.mjs
 * @description Main entry point for the productOS Node.js backend.
 * Handles API requests, SSE events, and coordinates with the AgentOrchestrator.
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { initializeDirectoryStructure, getAppDataDir, getGlobalSettingsPath, getProjectsDir, getSecretsPath, getSkillsDir } from './lib/paths.mjs';
import { getUrl, readJson, sendError, sendJson, sendNoContent } from './lib/http.mjs';
import { listProjects, getProjectById, getProjectFiles, createProject, renameProject, deleteProject } from './lib/projects.mjs';
import { getProjectSettings, saveProjectSettings } from './lib/project-settings.mjs';
import { clearResearchLog, getResearchLog } from './lib/research-log.mjs';
import { createSkill, deleteSkill, getSkillById, getSkillsByCategory, getTemplate, importSkill, listSkills, renderSkill, saveSkill, updateSkill, validateSkill } from './lib/skills.mjs';
import { createArtifact, deleteArtifact, exportArtifact, getArtifact, importArtifact, convertFileToArtifact, listArtifacts, migrateArtifacts, saveArtifact, updateArtifactMetadata, reconcileArtifacts, getSidecarPath } from './lib/artifacts.mjs';
import { clearWorkflowSchedule, deleteWorkflow, executeWorkflow, getActiveRuns, getWorkflow, getWorkflowHistory, listWorkflows, saveWorkflow, setWorkflowSchedule, stopWorkflowExecution, validateWorkflow } from './lib/workflows.mjs';
import { AgentOrchestrator } from './lib/orchestrator.mjs';
import { AIService } from './lib/ai.mjs';
import { ChatService } from './lib/chat.mjs';
import { CostLog } from './lib/cost.mjs';
import { checkCli, getAppConfig, resolveCliCommand } from './lib/system.mjs';
import { EncryptionService } from './lib/encryption.mjs';
import { FileService } from './lib/files.mjs';
import { OpenAiOAuth } from './lib/auth/openai-oauth.mjs';
import { pickFolder, saveFile, pickFile } from './lib/dialogs.mjs';
import { watcherService } from './lib/watcher.mjs';
import { trackTelemetry, telemetryErrorCode, telemetryEmitter } from './lib/telemetry/index.mjs';
import * as SilentLearner from './lib/silent-learner/index.mjs';
import { enrichImmediate, queueEnrichment } from './lib/silent-learner/enrichment.mjs';
import { getProjectIndex, regenerateProjectIndex } from './lib/silent-learner/index-generator.mjs';
import { getKnowledgeLog } from './lib/silent-learner/log-writer.mjs';


/**
 * Application version loaded dynamically from package.json.
 * Falls back to '0.0.0' if the file cannot be read.
 * @type {string}
 */
let APP_VERSION = '0.0.0';
try {
  const pkgContent = await fs.readFile(new URL('../package.json', import.meta.url), 'utf8');
  APP_VERSION = JSON.parse(pkgContent).version;
} catch (err) {
  console.error('[node-backend] Failed to load version from package.json:', err.message);
}

const orchestrator = new AgentOrchestrator();
const sseClients = new Set();
const logBuffer = [];
const MAX_LOG_BUFFER = 50;

function track(name, payload = {}, settings = {}) {
  void trackTelemetry(name, payload, settings);
}

function broadcast(event, payload) {
  const data = `data: ${JSON.stringify({ event, payload })}\n\n`;
  if (event === 'trace-log') {
    logBuffer.push(payload);
    if (logBuffer.length > MAX_LOG_BUFFER) logBuffer.shift();
  }
  for (const client of sseClients) {
    try {
      client.write(data);
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

// Wire up telemetry emitter to broadcast events over SSE
telemetryEmitter.on('event', ({ name, payload }) => {
  broadcast('telemetry-event', { event: name, payload });
});

// Initialize watcher service
watcherService.setOrchestrator(orchestrator);


// Heartbeat to keep SSE connections alive (written directly to avoid noisy log entries)
setInterval(() => {
  const data = `data: ${JSON.stringify({ event: 'heartbeat', payload: { timestamp: new Date().toISOString() } })}\n\n`;
  for (const client of sseClients) {
    try { client.write(data); } catch { sseClients.delete(client); }
  }
}, 15000);

const PORT = Number(process.env.PRODUCTOS_NODE_SERVER_PORT || 51423);

async function readGlobalSettings() {
  const settingsPath = await getGlobalSettingsPath();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return JSON.parse(await fs.readFile(settingsPath, 'utf8'));
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return {};
      }
      const isTransientParseError = error instanceof SyntaxError && attempt === 0;
      if (isTransientParseError) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        continue;
      }
      throw error;
    }
  }
  return {};
}

async function writeGlobalSettings(settings) {
  const settingsPath = await getGlobalSettingsPath();
  const tempPath = `${settingsPath}.${process.pid}.${Date.now()}.${randomUUID()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(settings, null, 2), 'utf8');
  try {
    await fs.rename(tempPath, settingsPath);
  } catch (error) {
    if (error?.code === 'EEXIST' || error?.code === 'EPERM') {
      await fs.rm(settingsPath, { force: true });
      await fs.rename(tempPath, settingsPath);
      return;
    }
    throw error;
  }
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
  const secrets = await readSecrets();
  const providers = [];

  // Always check for these core ones
  const [ollama, claude, gemini, openai] = await Promise.all([
    checkCli('ollama'),
    checkCli('claude'),
    checkCli('gemini'),
    resolveCliCommand('codex', 'openai')
  ]);

  if (ollama.installed) providers.push('ollama');
  if (claude.installed) providers.push('claudeCode');
  if (gemini.installed) providers.push('geminiCli');
  if (openai.installed) providers.push('openAiCli');
  
  // Hosted API is always available as a fallback or if configured
  providers.push('hostedApi');
  providers.push('liteLlm');

  if (Array.isArray(settings?.customClis)) {
    for (const custom of settings.customClis) {
      if (!custom?.id) continue;
      
      const id = custom.id.startsWith('custom-') ? custom.id : `custom-${custom.id}`;
      
      // Basic configuration check: must have a command
      if (custom.command) {
        // If it requires a secret, check if it's present
        if (custom.apiKeySecretId) {
          const hasSecret = !!(secrets[custom.apiKeySecretId] && secrets[custom.apiKeySecretId].trim());
          if (hasSecret) {
            providers.push(id);
          }
        } else {
          // No secret required, just command is enough
          providers.push(id);
        }
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

async function enrichProject(projectId) {
  const project = await getProjectById(projectId);
  // Reconcile artifacts first to register any new/unregistered artifact files
  await reconcileArtifacts(projectId);
  
  // Recursively find all markdown files in the project directory
  const scanMD = async (dir) => {
    const files = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    const results = [];
    for (const file of files) {
      if (file.isDirectory()) {
        if (file.name === '.git' || file.name === 'node_modules' || file.name === '.metadata') continue;
        results.push(...(await scanMD(path.join(dir, file.name))));
      } else if (file.name.endsWith('.md')) {
        results.push(path.join(dir, file.name));
      }
    }
    return results;
  };
  
  const allMdFiles = await scanMD(project.path);
  let processed = 0;
  
  for (const fullPath of allMdFiles) {
    const relPath = path.relative(project.path, fullPath);
    try {
      const sidecarPath = await safeJoin(project.path, getSidecarPath(relPath));
      let sidecarExists = false;
      let needsEnrich = false;
      try {
        const sidecar = JSON.parse(await fs.readFile(sidecarPath, 'utf8'));
        sidecarExists = true;
        if (!sidecar.silentLearner || sidecar.silentLearner.enrichmentLevel !== 'full') {
          needsEnrich = true;
        }
      } catch {
        needsEnrich = true;
      }
      
      if (!sidecarExists || needsEnrich) {
        await enrichImmediate(projectId, relPath);
        queueEnrichment(projectId, relPath);
        processed++;
      }
    } catch (err) {
      console.error(`[Server] Failed to process/enrich project file ${relPath}:`, err.message);
    }
  }
  
  return { success: true, processed };
}

async function handleRequest(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      return sendNoContent(res);
    }

    const url = getUrl(req);
    // Log incoming requests for debugging
    if (url.pathname !== '/api/health' && url.pathname !== '/api/system/health' && url.pathname !== '/api/telemetry/event') {
        console.log(`[API] ${req.method} ${url.pathname}${url.search}`);
    }

    const projectId = url.searchParams.get('project_id');
    if (projectId) {
      watcherService.setActiveProject(projectId).catch(err => console.error(`[node-backend] Failed to set active project watcher:`, err));
    }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    return sendJson(res, 200, { 
      message: 'productos API (Node) is running',
      version: `${APP_VERSION}-node`,
      health: '/api/health',
      frontend: 'http://localhost:5173'
    });
  }

  if (req.method === 'GET' && url.pathname === '/favicon.ico') {
    return sendNoContent(res);
  }

  if (req.method === 'GET' && (url.pathname === '/api/health' || url.pathname === '/api/system/health')) {
    return sendJson(res, 200, { ok: true, status: 'ok', version: `${APP_VERSION}-node`, runtime: 'node-prototype' });
  }

  if (req.method === 'GET' && url.pathname === '/api/system/data-directory') {
    return sendJson(res, 200, await getAppDataDir());
  }

  if (req.method === 'GET' && url.pathname === '/api/system/first-install') {
    const settingsPath = await getGlobalSettingsPath();
    const isFirst = !(await fs.access(settingsPath).then(() => true).catch(() => false));
    return sendJson(res, 200, isFirst);
  }

  if (req.method === 'GET' && url.pathname === '/api/system/installation/status') {
    const config = await getAppConfig();
    const settingsPath = await getGlobalSettingsPath();
    const isFirst = !(await fs.access(settingsPath).then(() => true).catch(() => false));
    track('installation.status_checked', { isFirstInstall: isFirst }, await readGlobalSettings());
    return sendJson(res, 200, {
      app_data_path: config.app_data_directory,
      is_first_install: isFirst,
      claude_code_detected: config.claude_code_enabled,
      ollama_detected: config.ollama_enabled,
      gemini_detected: config.gemini_enabled,
      openai_detected: config.openai_enabled,
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/system/installation/run') {
    const started = Date.now();
    const settings = await readGlobalSettings();
    track('installation.started', { source: 'wizard' }, settings);
    const config = await getAppConfig();
    const result = {
      success: true,
      config: {
        app_data_path: config.app_data_directory,
        is_first_install: false,
        claude_code_detected: config.claude_code_enabled,
        ollama_detected: config.ollama_enabled,
        gemini_detected: config.gemini_enabled,
        openai_detected: config.openai_enabled,
      }
    };
    track('installation.completed', { success: true, durationMs: Date.now() - started }, settings);
    return sendJson(res, 200, result);
  }

  if (req.method === 'GET' && url.pathname === '/api/system/config') {
    return sendJson(res, 200, await getAppConfig());
  }

  if (req.method === 'POST' && url.pathname === '/api/system/shutdown') {
    console.log('[node-backend] Shutdown requested');
    const settings = await readGlobalSettings();
    await trackTelemetry('app.exited', { source: url.searchParams.get('source') || 'api' }, settings);
    try {
      await SilentLearner.shutdown();
    } catch (err) {
      console.error('[node-backend] Error during Silent Learner shutdown:', err);
    }
    sendNoContent(res, 200);
    setTimeout(() => process.exit(0), 100);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/system/open') {
    const body = await readJson(req);
    try {
      let result = null;
      if (body.directory) {
        result = await pickFolder({ defaultPath: body.defaultPath, title: body.title });
      } else if (body.multiple) {
        result = await pickFile({ defaultPath: body.defaultPath, title: body.title, multiple: true, filters: body.filters });
      } else {
        result = await pickFile({ defaultPath: body.defaultPath, title: body.title, filters: body.filters });
      }
      return sendJson(res, 200, result);
    } catch (err) {
      return sendError(res, 500, `Failed to open dialog: ${err.message}`);
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/system/save') {
    const body = await readJson(req);
    try {
      const result = await saveFile({ defaultPath: body.defaultPath, title: body.title, filters: body.filters });
      return sendJson(res, 200, result);
    } catch (err) {
      return sendError(res, 500, `Failed to open save dialog: ${err.message}`);
    }
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
    res.write(`data: ${JSON.stringify({ event: 'connected', payload: { timestamp: new Date().toISOString() } })}\n\n`);
    
    // Send buffered logs to the new client
    for (const log of logBuffer) {
      res.write(`data: ${JSON.stringify({ event: 'trace-log', payload: log })}\n\n`);
    }

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
    const previous = await readGlobalSettings();
    await writeGlobalSettings(body);
    if (body?.lastProjectId) {
      watcherService.setActiveProject(body.lastProjectId).catch(err => console.error(`[node-backend] Failed to switch active project watcher:`, err));
    }
    if (previous?.telemetry?.enabled !== body?.telemetry?.enabled && body?.telemetry?.enabled !== undefined) {
      track('settings.telemetry_changed', { enabled: body.telemetry.enabled }, body);
    }
    track('settings.saved', { section: 'global' }, body);
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
    const projectId = url.searchParams.get('project_id');
    track('usage.viewed', { scope: projectId && projectId !== 'all' ? 'project' : 'global' }, await readGlobalSettings());
    const projects = await listProjects();
    
    // Filter projects if project_id is provided and not 'all'
    const targetProjects = (projectId && projectId !== 'all') 
      ? projects.filter(p => p.id === projectId)
      : projects;

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

    for (const project of targetProjects) {
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
          entry.promptCount += p.promptCount || 0;
          entry.responseCount += p.responseCount || 0;
          entry.totalCostUsd += p.totalCostUsd || 0;
          entry.totalInputTokens += p.totalInputTokens || 0;
          entry.totalOutputTokens += p.totalOutputTokens || 0;
          entry.totalCacheReadTokens = (entry.totalCacheReadTokens || 0) + (p.totalCacheReadTokens || 0);
          entry.totalCacheCreationTokens = (entry.totalCacheCreationTokens || 0) + (p.totalCacheCreationTokens || 0);
          entry.totalReasoningTokens = (entry.totalReasoningTokens || 0) + (p.totalReasoningTokens || 0);
        }
      }
    }

    globalStats.providerBreakdown = Array.from(providerMap.values());
    return sendJson(res, 200, globalStats);
  }

  if (req.method === 'POST' && url.pathname === '/api/telemetry/event') {
    const body = await readJson(req);
    if (!body?.event) return sendError(res, 400, 'event is required');
    await trackTelemetry(body.event, body.payload || {}, await readGlobalSettings(), { broadcast: false });
    return sendNoContent(res, 200);
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
    track('custom_cli.added', { provider: body.id || body.name }, current);
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
    return sendJson(res, 200, { available: false, currentVersion: APP_VERSION, latestVersion: APP_VERSION, version: APP_VERSION });
  }

  if (req.method === 'GET' && url.pathname === '/api/system/update/policy') {
    try {
      const policyUrl = 'https://github.com/AIResearchFactory/productOS/releases/latest/download/policy.json';
      const response = await fetch(policyUrl, { signal: AbortSignal.timeout(2000) }).catch(() => null);
      
      if (response && response.ok) {
        const data = await response.json();
        return sendJson(res, 200, data);
      }
      
      // Fallback to a default policy instead of returning 404
      return sendJson(res, 200, {
        min_supported_version: '0.1.0',
        latest_version: APP_VERSION,
        message: 'Running in local development mode.'
      });
    } catch (error) {
      // Even on error, return a default policy to avoid 404 console errors
      return sendJson(res, 200, {
        min_supported_version: '0.1.0',
        latest_version: APP_VERSION,
        message: 'Update policy check unavailable.'
      });
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/system/detect/ollama') {
    const started = Date.now();
    const status = await checkCli('ollama');
    track('provider.detected', { provider: 'ollama', success: !!status.installed, durationMs: Date.now() - started }, await readGlobalSettings());
    return sendJson(res, 200, { ...status, running: status.installed });
  }

  if (req.method === 'GET' && url.pathname === '/api/system/detect/claude') {
    const started = Date.now();
    const settings = await readGlobalSettings();
    const status = await checkCli('claude');
    let authenticated = false;
    if (status.installed) {
      const provider = await AIService.createProvider('claudeCode', settings);
      authenticated = await provider.checkAuthentication();
    }
    track('provider.detected', { provider: 'claudeCode', success: !!status.installed, durationMs: Date.now() - started }, settings);
    return sendJson(res, 200, { ...status, authenticated });
  }

  if (req.method === 'GET' && url.pathname === '/api/system/detect/gemini') {
    const started = Date.now();
    const settings = await readGlobalSettings();
    const status = await checkCli('gemini');
    let authenticated = false;
    if (status.installed) {
      const provider = await AIService.createProvider('geminiCli', settings);
      authenticated = await provider.checkAuthentication();
    }
    track('provider.detected', { provider: 'geminiCli', success: !!status.installed, durationMs: Date.now() - started }, settings);
    return sendJson(res, 200, { ...status, authenticated });
  }

  if (req.method === 'GET' && url.pathname === '/api/system/detect/openai') {
    const started = Date.now();
    const settings = await readGlobalSettings();
    const status = await resolveCliCommand('codex', 'openai');
    let authenticated = false;
    if (status.installed) {
      const provider = await AIService.createProvider('openAiCli', settings);
      authenticated = await provider.checkAuthentication();
    }
    track('provider.detected', { provider: 'openAiCli', success: !!status.installed, durationMs: Date.now() - started }, settings);
    return sendJson(res, 200, { ...status, authenticated });
  }

  if (req.method === 'POST' && url.pathname === '/api/system/maintenance/backup') {
    // Simulating backup by returning a success message
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return sendJson(res, 200, `backup-prototype-${timestamp}.zip`);
  }

  if (req.method === 'GET' && url.pathname === '/api/system/maintenance/backups') {
    return sendJson(res, 200, []);
  }

  if (req.method === 'POST' && url.pathname === '/api/system/maintenance/verify-integrity') {
    return sendJson(res, 200, true);
  }

  if (req.method === 'GET' && url.pathname === '/api/system/maintenance/verify-integrity') {
    return sendJson(res, 200, true);
  }

  if (url.pathname.startsWith('/api/system/maintenance/')) {
    return sendJson(res, 200, { ok: true, status: 'maintenance mode active' });
  }

  if (req.method === 'GET' && url.pathname === '/api/projects') {
    return sendJson(res, 200, await listProjects());
  }

  if (req.method === 'POST' && url.pathname === '/api/projects/create') {
    const body = await readJson(req);
    if (!body?.name) return sendError(res, 400, 'name is required');
    const project = await createProject(body.name, body.goal || '', body.skills || []);
    track('project.created', { source: 'api' }, await readGlobalSettings());
    broadcast('project-added', project);
    watcherService.setActiveProject(project.id).catch(err => console.error(err));
    return sendJson(res, 200, project);
  }

  if (req.method === 'GET' && url.pathname === '/api/projects/get') {
    const projectId = url.searchParams.get('project_id');
    if (!projectId) return sendError(res, 400, 'project_id is required');
    return sendJson(res, 200, await getProjectById(projectId));
  }

  if (req.method === 'GET' && url.pathname === '/api/projects/files') {
    const projectId = url.searchParams.get('project_id');
    const sort = url.searchParams.get('sort');
    if (!projectId) return sendError(res, 400, 'project_id is required');
    return sendJson(res, 200, await getProjectFiles(projectId, { sort }));
  }

  if (req.method === 'GET' && url.pathname === '/api/files/exists') {
    const projectId = url.searchParams.get('project_id');
    const fileName = url.searchParams.get('file_name');
    if (!projectId || !fileName) return sendError(res, 400, 'project_id and file_name are required');
    try {
      await fs.access(await resolveProjectFilePath(projectId, fileName));
      return sendJson(res, 200, true);
    } catch {
      return sendJson(res, 200, false);
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
    try {
      if (body.file_name.endsWith('.md')) {
        await enrichImmediate(body.project_id, body.file_name);
        queueEnrichment(body.project_id, body.file_name);
      }
    } catch (err) {
      console.error('[Server] Failed to enrich file on write:', err.message);
    }
    return sendNoContent(res, 200);
  }

  const getCommentsMatch = req.method === 'GET' ? url.pathname.match(/^\/api\/projects\/([^/]+)\/files\/(.+)\/comments$/) : null;
  if (getCommentsMatch) {
    const projectId = getCommentsMatch[1];
    const fileName = decodeURIComponent(getCommentsMatch[2]);
    if (!projectId || !fileName) return sendError(res, 400, 'projectId and filePath are required');
    
    try {
      const project = await getProjectById(projectId);
      const commentsDir = path.resolve(project.path, '.metadata', 'comments');
      const sanitizedName = fileName.replace(/\//g, '__').replace(/\\/g, '__') + '.json';
      const commentsFilePath = path.resolve(commentsDir, sanitizedName);
      
      if (!commentsFilePath.startsWith(commentsDir)) {
        return sendError(res, 400, 'Invalid file path traversal');
      }
      
      let comments = [];
      try {
        const fileContent = await fs.readFile(commentsFilePath, 'utf8');
        comments = JSON.parse(fileContent);
      } catch (err) {
        // File does not exist, return empty array
      }
      return sendJson(res, 200, comments);
    } catch (err) {
      return sendError(res, 500, `Failed to retrieve comments: ${err.message}`);
    }
  }

  const postCommentsMatch = req.method === 'POST' ? url.pathname.match(/^\/api\/projects\/([^/]+)\/files\/(.+)\/comments$/) : null;
  if (postCommentsMatch) {
    const projectId = postCommentsMatch[1];
    const fileName = decodeURIComponent(postCommentsMatch[2]);
    const body = await readJson(req);
    if (!Array.isArray(body.comments)) {
      return sendError(res, 400, 'comments (array) is required');
    }
    
    try {
      const project = await getProjectById(projectId);
      const commentsDir = path.resolve(project.path, '.metadata', 'comments');
      const sanitizedName = fileName.replace(/\//g, '__').replace(/\\/g, '__') + '.json';
      const commentsFilePath = path.resolve(commentsDir, sanitizedName);
      
      if (!commentsFilePath.startsWith(commentsDir)) {
        return sendError(res, 400, 'Invalid file path traversal');
      }
      
      await fs.mkdir(commentsDir, { recursive: true });
      await fs.writeFile(commentsFilePath, JSON.stringify(body.comments, null, 2), 'utf8');
      return sendNoContent(res, 200);
    } catch (err) {
      return sendError(res, 500, `Failed to save comments: ${err.message}`);
    }
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
    const result = await FileService.importDocument(body.project_id, body.source_path);
    const fileType = path.extname(body.source_path).replace('.', '').toLowerCase() || 'unknown';
    track('file.imported', { fileType }, await readGlobalSettings());
    try {
      if (result.endsWith('.md')) {
        await enrichImmediate(body.project_id, result);
        queueEnrichment(body.project_id, result);
      }
    } catch (err) {
      console.error('[Server] Failed to enrich imported file:', err.message);
    }
    return sendJson(res, 200, result);
  }

  if (req.method === 'POST' && url.pathname === '/api/files/export') {
    const body = await readJson(req);
    if (!body?.project_id || !body?.file_name || !body?.target_path || !body?.export_format) {
        return sendError(res, 400, 'project_id, file_name, target_path, and export_format are required');
    }
    await FileService.exportDocument(body.project_id, body.file_name, body.target_path, body.export_format);
    track('file.exported', { exportFormat: body.export_format }, await readGlobalSettings());
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
    watcherService.unwatchProject(projectId);
    track('project.deleted', { source: 'api' }, await readGlobalSettings());
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

  // ─── Silent Learner Routes ──────────────────────────────────────

  const enrichMatch = req.method === 'POST' ? url.pathname.match(/^\/api\/projects\/([^/]+)\/enrich$/) : null;
  if (enrichMatch) {
    const projectId = enrichMatch[1];
    if (!projectId) return sendError(res, 400, 'projectId is required');
    try {
      const result = await enrichProject(projectId);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/silent-learner/status') {
    const projectId = url.searchParams.get('project_id');
    if (!projectId) return sendError(res, 400, 'project_id is required');
    try {
      const status = await SilentLearner.getStatus(projectId);
      return sendJson(res, 200, status);
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/silent-learner/toggle') {
    const body = await readJson(req);
    const projectId = body.project_id || body.projectId;
    const enabled = body.enabled;
    if (!projectId) return sendError(res, 400, 'project_id is required');
    if (typeof enabled !== 'boolean') {
      return sendError(res, 400, 'enabled must be a boolean');
    }
    try {
      const result = await SilentLearner.toggle(projectId, enabled);
      broadcast('silent_learner.state_changed', { workspaceId: projectId, state: result.state });
      return sendJson(res, 200, result);
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/silent-learner/optimize') {
    const body = await readJson(req);
    const projectId = body.project_id || body.projectId;
    if (!projectId) return sendError(res, 400, 'project_id is required');
    
    // Trigger optimize scan asynchronously
    (async () => {
      try {
        await SilentLearner.optimizeMemory(projectId, {
          onProgress: (progress, detail) => {
            broadcast('silent_learner.scan_progress', { workspaceId: projectId, progress, detail });
          }
        });
        const status = await SilentLearner.getStatus(projectId);
        broadcast('silent_learner.state_changed', { workspaceId: projectId, state: status.state });
        if (status.lessonsLearned > 0) {
          broadcast('silent_learner.memory_ready', {
            workspaceId: projectId,
            memoryItemCount: status.lessonsLearned,
            sourceSessionCount: status.sessionsObserved,
          });
        }
      } catch (err) {
        console.error('[SilentLearner] Optimize scan failed:', err);
        const errorType = err.code || err.name || 'optimize_failed';
        broadcast('silent_learner.error', { workspaceId: projectId, errorType });
      }
    })();

    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/api/silent-learner/forget-session') {
    const body = await readJson(req);
    const projectId = body.project_id || body.projectId;
    const sessionId = body.session_id || body.sessionId;
    if (!projectId || !sessionId) return sendError(res, 400, 'project_id and session_id are required');
    try {
      const result = await SilentLearner.forgetSession(projectId, sessionId);
      return sendJson(res, 200, result);
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (req.method === 'DELETE' && url.pathname === '/api/silent-learner/forget-workspace') {
    const projectId = url.searchParams.get('project_id');
    if (!projectId) return sendError(res, 400, 'project_id is required');
    try {
      await SilentLearner.forgetWorkspace(projectId);
      const status = await SilentLearner.getStatus(projectId);
      broadcast('silent_learner.state_changed', { workspaceId: projectId, state: status.state });
      return sendNoContent(res, 200);
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/silent-learner/export') {
    const projectId = url.searchParams.get('project_id');
    if (!projectId) return sendError(res, 400, 'project_id is required');
    try {
      const data = await SilentLearner.exportMemory(projectId);
      return sendJson(res, 200, data);
    } catch (err) {
      return sendError(res, 500, err.message);
    }
  }

  const projectIndexMatch = req.method === 'GET' ? url.pathname.match(/^\/api\/projects\/([^/]+)\/index$/) : null;
  if (projectIndexMatch) {
    const projectId = decodeURIComponent(projectIndexMatch[1]);
    const refresh = url.searchParams.get('refresh') === 'true';
    const result = refresh ? await regenerateProjectIndex(projectId) : await getProjectIndex(projectId);
    return sendJson(res, 200, result);
  }

  const projectLogMatch = req.method === 'GET' ? url.pathname.match(/^\/api\/projects\/([^/]+)\/log$/) : null;
  if (projectLogMatch) {
    const projectId = decodeURIComponent(projectLogMatch[1]);
    return sendJson(res, 200, await getKnowledgeLog(projectId, {
      offset: url.searchParams.get('offset'),
      limit: url.searchParams.get('limit'),
    }));
  }

  if (req.method === 'GET' && url.pathname === '/api/artifacts/list') {
    const projectId = url.searchParams.get('project_id');
    if (!projectId) return sendError(res, 400, 'project_id is required');
    return sendJson(res, 200, await listArtifacts(projectId));
  }

  if (req.method === 'POST' && url.pathname === '/api/artifacts/create') {
    const body = await readJson(req);
    const artifact = await createArtifact(body.project_id, body.artifact_type, body.title);
    track('artifact.created', { artifactType: body.artifact_type, source: 'manual' }, await readGlobalSettings());
    return sendJson(res, 200, artifact);
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
    track('artifact.saved', { artifactType: body.artifactType || body.artifact_type }, await readGlobalSettings());
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
    const artifact = await importArtifact(body.project_id, body.artifact_type, body.source_path);
    track('artifact.imported', { artifactType: body.artifact_type }, await readGlobalSettings());
    return sendJson(res, 200, artifact);
  }

  if (req.method === 'POST' && url.pathname === '/api/artifacts/convert') {
    const body = await readJson(req);
    if (!body?.project_id || !body?.file_id || !body?.artifact_type) {
      return sendError(res, 400, 'project_id, file_id, and artifact_type are required');
    }
    const artifact = await convertFileToArtifact(body.project_id, body.file_id, body.artifact_type);
    track('artifact.converted', { artifactType: body.artifact_type }, await readGlobalSettings());
    return sendJson(res, 200, artifact);
  }

  if (req.method === 'POST' && url.pathname === '/api/artifacts/export') {
    const body = await readJson(req);
    await exportArtifact(body.project_id, body.artifact_id, body.artifact_type, body.target_path, body.export_format);
    track('artifact.exported', { artifactType: body.artifact_type, exportFormat: body.export_format }, await readGlobalSettings());
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
    track('workflow.created', { stepCount: 0 }, await readGlobalSettings());
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
    const workflow = await getWorkflow(body.project_id, body.workflow_id);
    track('workflow.started', { stepCount: Array.isArray(workflow.steps) ? workflow.steps.length : 0, trigger: 'manual' }, settings);
    return sendJson(res, 200, await executeWorkflow(body.project_id, body.workflow_id, orchestrator, settings, broadcast));
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
    const runs = getActiveRuns();
    console.log(`[node-backend] getActiveRuns: ${Object.keys(runs).length} active runs`);
    return sendJson(res, 200, runs);
  }

  if (req.method === 'GET' && url.pathname === '/api/channels/settings') {
    const settings = await readGlobalSettings();
    return sendJson(res, 200, settings.channelConfig || getDefaultChannelSettings());
  }

  if (req.method === 'POST' && url.pathname === '/api/channels/settings') {
    const body = await readJson(req);
    const current = await readGlobalSettings();
    const nextConfig = body?.config ? body.config : body;
    const prevConfig = current.channelConfig || getDefaultChannelSettings();
    const updatedConfig = { ...getDefaultChannelSettings(), ...nextConfig };
    current.channelConfig = updatedConfig;
    await writeGlobalSettings(current);

    if (updatedConfig.telegramEnabled && !prevConfig.telegramEnabled) {
      track('integrations.enabled', { channel: 'telegram' }, current);
    }
    if (updatedConfig.whatsappEnabled && !prevConfig.whatsappEnabled) {
      track('integrations.enabled', { channel: 'whatsapp' }, current);
    }

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

  if (req.method === 'GET' && url.pathname === '/api/secrets/export') {
    // Return all decrypted secrets for vault export — matches old Rust export_secrets route
    const secrets = await readSecrets();
    track('secrets.exported', {}, await readGlobalSettings());
    return sendJson(res, 200, secrets);
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/openai/status') {
    const settings = await readGlobalSettings();
    const secrets = await readSecrets();
    const provider = await AIService.createProvider('openAiCli', settings, secrets);
    const connected = await provider.checkAuthentication();
    
    const hasKey = !!(secrets['OPENAI_API_KEY'] || secrets['openai_api_key']);
    const hasOAuth = !!secrets['OPENAI_OAUTH_ACCESS_TOKEN'];
    
    return sendJson(res, 200, { 
      connected, 
      method: hasKey ? 'api_key' : hasOAuth ? 'oauth' : 'cli', 
      details: connected ? (hasKey ? 'Authenticated via API Key' : hasOAuth ? 'Authenticated via OAuth' : 'Authenticated via CLI') : 'Not authenticated' 
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/gemini/status') {
    const status = await checkCli('gemini');
    let connected = false;
    if (status.installed) {
      const provider = await AIService.createProvider('geminiCli', await readGlobalSettings());
      connected = await provider.checkAuthentication();
    }
    const secrets = await readSecrets();
    const hasKey = !!(secrets['GEMINI_API_KEY'] || secrets['gemini_api_key'] || secrets['GOOGLE_API_KEY']);
    connected = connected || hasKey;

    return sendJson(res, 200, { 
      connected, 
      method: hasKey ? 'api_key' : 'cli', 
      details: connected ? (hasKey ? 'Authenticated via API Key' : 'Authenticated via CLI') : 'Not authenticated' 
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/openai/login') {
    try {
      const tokens = await OpenAiOAuth.login();
      const secrets = await readSecrets();
      secrets['OPENAI_OAUTH_ACCESS_TOKEN'] = tokens.access_token;
      if (tokens.refresh_token) {
        secrets['OPENAI_OAUTH_REFRESH_TOKEN'] = tokens.refresh_token;
      }
      secrets['OPENAI_CLI_AUTH_MARKER'] = new Date().toISOString();
      await writeSecrets(secrets);
      return sendJson(res, 200, { success: true, message: 'OpenAI authentication successful!' });
    } catch (err) {
      return sendError(res, 500, `OpenAI auth failed: ${err.message}`);
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/gemini/login') {
    const { spawn } = await import('node:child_process');
    try {
      const child = spawn('gemini', ['auth', 'login'], { detached: true, stdio: 'ignore' });
      child.unref();
      // Return plain string — frontend toast expects a string, not an object (avoids React Error #31)
      return sendJson(res, 200, 'Gemini login initiated. Please complete authentication in your browser.');
    } catch (err) {
      return sendError(res, 500, `Failed to start Gemini login: ${err.message}`);
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/claude/login') {
    const { spawn } = await import('node:child_process');
    try {
      const child = spawn('claude', ['auth', 'login'], { detached: true, stdio: 'ignore' });
      child.unref();
      // Return plain string — frontend toast expects a string, not an object (avoids React Error #31)
      return sendJson(res, 200, 'Claude login initiated. Please complete authentication in your browser.');
    } catch (err) {
      return sendError(res, 500, `Failed to start Claude login: ${err.message}`);
    }
  }

  if (req.method === 'POST' && (url.pathname === '/api/auth/openai/logout' || url.pathname === '/api/auth/gemini/logout')) {
    const secrets = await readSecrets();
    if (url.pathname === '/api/auth/openai/logout') {
      delete secrets['OPENAI_OAUTH_ACCESS_TOKEN'];
      delete secrets['OPENAI_OAUTH_REFRESH_TOKEN'];
      delete secrets['OPENAI_CLI_AUTH_MARKER'];
      await writeSecrets(secrets);
      
      // Also try CLI logout if codex is present
      const { exec } = await import('node:child_process');
      exec('codex logout').unref();
    }
    return sendJson(res, 200, { success: true, message: 'Logged out successfully' });
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
    const secrets = await readSecrets();
    const provider = body.provider_type || body.providerType || settings.activeProvider || settings.active_provider || 'hostedApi';
    const started = Date.now();
    track('agent.run.started', { provider, source: body.skill_id || body.skillId ? 'skill' : 'chat' }, settings);
    try {
      const result = await orchestrator.runAgentLoop({
        messages: body.messages,
        systemPrompt: body.system_prompt || body.systemPrompt,
        projectId: body.project_id || body.projectId,
        skillId: body.skill_id || body.skillId,
        skillParams: body.skill_params || body.skillParams,
        providerType: provider,
        settings,
        secrets,
        onDelta: (chunk) => {
          broadcast('chat-delta', chunk);
        }
      });
      track('agent.run.completed', {
        provider,
        success: result?.metadata?.model_used !== 'error',
        durationMs: Date.now() - started,
        tokensIn: result?.metadata?.tokens_in || 0,
        tokensOut: result?.metadata?.tokens_out || 0,
      }, settings);
      return sendJson(res, 200, result);
    } catch (error) {
      track('agent.run.failed', { provider, durationMs: Date.now() - started, errorCode: telemetryErrorCode(error) }, settings);
      throw error;
    }
  }

  if (req.method === 'POST' && (url.pathname === '/api/chat/stop' || url.pathname === '/api/chat/cancel')) {
    const body = await readJson(req).catch(() => ({}));
    const projectId = body.project_id || body.projectId || url.searchParams.get('project_id');
    await orchestrator.stopExecution(projectId);
    return sendNoContent(res, 200);
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
    const skill = await createSkill(body);
    track('skill.created', { source: 'manual' }, await readGlobalSettings());
    return sendJson(res, 200, skill);
  }

  if ((req.method === 'PUT' || req.method === 'POST') && (url.pathname === '/api/skills/save' || url.pathname === '/api/skills/update')) {
    const body = await readJson(req);
    const saved = url.pathname.endsWith('/update') ? await updateSkill(body) : await saveSkill(body);
    track('skill.updated', { source: url.pathname.endsWith('/update') ? 'update' : 'save' }, await readGlobalSettings());
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
    const body = await readJson(req);
    const npxCommand = body.npxCommand || body.command || body.skill_command;
    if (!npxCommand) return sendError(res, 400, 'npxCommand is required');
    const skill = await importSkill(npxCommand);
    track('skill.imported', { source: 'npx' }, await readGlobalSettings());
    return sendJson(res, 200, skill);
  }


  if (req.method === 'POST' && url.pathname === '/api/system/write-file') {
    const body = await readJson(req);
    if (!body?.path) return sendError(res, 400, 'path is required');
    await fs.mkdir(path.dirname(body.path), { recursive: true });
    await fs.writeFile(body.path, body.content || '', 'utf8');
    return sendNoContent(res, 200);
  }

  return sendError(res, 404, `Unknown route: ${req.method} ${url.pathname}`);
  } catch (error) {
    console.error(`[API ERROR] ${req.method} ${req.url}:`, error);
    if (error.stack) console.error(error.stack);
    return sendError(res, error.statusCode || 500, error.message || 'Internal Server Error');
  }
}

// ── Colour helpers ──────────────────────────────────────────────────
const cyan  = (s) => `\x1b[36m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const bold  = (s) => `\x1b[1m${s}\x1b[0m`;

console.log('[node-backend] Initializing directory structure...');
await initializeDirectoryStructure();
console.log('[node-backend] Initializing encryption service...');
await EncryptionService.initAsync().catch(err => console.error('[EncryptionService] Init failed:', err));

// Start watching active project at startup
readGlobalSettings().then(async (settings) => {
  const activeProjectId = settings?.lastProjectId;
  const projects = await listProjects();
  
  let projectToWatch = null;
  if (activeProjectId) {
    projectToWatch = projects.find(p => p.id === activeProjectId);
  }
  if (!projectToWatch && projects.length > 0) {
    projectToWatch = projects[0];
  }

  if (projectToWatch) {
    console.log(`[node-backend] Initializing watcher for active project: ${projectToWatch.id}`);
    await watcherService.setActiveProject(projectToWatch.id);
    await reconcileArtifacts(projectToWatch.id).catch(err => console.error(`[node-backend] Initial reconciliation failed for ${projectToWatch.id}:`, err));
  } else {
    console.log('[node-backend] No active project found to watch at startup');
  }
}).catch(err => {
  console.error('[node-backend] Failed to initialize active project watcher:', err);
});

const server = http.createServer((req, res) => {
  // Only log non-GET requests and non-health-check calls to keep output clean during dev
  const isHealthCheck = req.url === '/api/health';
  const isSSE = req.url?.includes('/api/system/events');
  if (!isHealthCheck && !isSSE && req.method !== 'GET') {
    console.log(`[node-backend] ${req.method} ${req.url}`);
  }
  handleRequest(req, res).catch((error) => {
    const statusCode = error?.statusCode || 500;
    sendError(res, statusCode, error?.message || 'Internal server error');
  });
});

server.listen(PORT, () => {
  console.log();
  console.log(bold(cyan('  ╔══════════════════════════════════════╗')));
  console.log(bold(cyan(`  ║        🚀 ProductOS v${APP_VERSION.padEnd(14)} ║`)));
  console.log(bold(cyan('  ╚══════════════════════════════════════╝') + '\n'));
  console.log(`  ${green('✓')} ${bold('Backend is ready!')}`);
  console.log(`  ${green('➜')} Listening on: ${bold(`http://localhost:${PORT}`)}`);
  console.log(`  ${green('➜')} Health check: ${bold(`http://localhost:${PORT}/api/health`)}\n`);
  void readGlobalSettings()
    .then((settings) => trackTelemetry('app.launched', {}, settings))
    .catch((error) => {
      console.warn('[telemetry] app.launched skipped:', error?.message || 'unknown');
    });
});

// Graceful shutdown on signals
const gracefulShutdown = () => {
  console.log('[node-backend] Server shutting down...');
  SilentLearner.shutdown()
    .then(() => {
      console.log('[node-backend] Databases closed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('[node-backend] Error during database shutdown:', err);
      process.exit(1);
    });
};
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

