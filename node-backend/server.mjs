#!/usr/bin/env node
import http from 'node:http';
import fs from 'node:fs/promises';
import { ensureDirectoryStructure, getAppDataDir, getGlobalSettingsPath, getProjectsDir, getSecretsPath, getSkillsDir } from './lib/paths.mjs';
import { getUrl, readJson, sendError, sendJson, sendNoContent } from './lib/http.mjs';
import { listProjects, getProjectById, getProjectFiles } from './lib/projects.mjs';
import { getProjectSettings, saveProjectSettings } from './lib/project-settings.mjs';
import { clearResearchLog, getResearchLog } from './lib/research-log.mjs';
import { createSkill, deleteSkill, getSkillById, getSkillsByCategory, listSkills, saveSkill, updateSkill, validateSkill } from './lib/skills.mjs';

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
    return JSON.parse(await fs.readFile(secretsPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

async function writeSecrets(secrets) {
  const secretsPath = await getSecretsPath();
  await fs.writeFile(secretsPath, JSON.stringify(secrets, null, 2), 'utf8');
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

async function getAppConfig() {
  const appDataDir = await getAppDataDir();
  return {
    app_data_directory: appDataDir,
    installation_date: 'node-prototype',
    version: 'node-prototype',
    claude_code_enabled: false,
    ollama_enabled: false,
    gemini_enabled: false,
    openai_enabled: false,
    last_update_check: null,
  };
}

function notImplemented(res, route) {
  sendError(res, 501, `${route} is not implemented in the Node prototype yet`);
}

async function handleRequest(req, res) {
  if (req.method === 'OPTIONS') {
    return sendNoContent(res);
  }

  const url = getUrl(req);

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
    return sendJson(res, 200, getZeroUsageStatistics());
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
    return sendJson(res, 200, getCliDetectionShape({ running: false }));
  }

  if (req.method === 'GET' && url.pathname === '/api/system/detect/claude') {
    return sendJson(res, 200, getCliDetectionShape({ authenticated: false }));
  }

  if (req.method === 'GET' && url.pathname === '/api/system/detect/gemini') {
    return sendJson(res, 200, getCliDetectionShape({ authenticated: false }));
  }

  if (req.method === 'GET' && url.pathname === '/api/system/detect/openai') {
    return sendJson(res, 200, getCliDetectionShape());
  }

  if (req.method === 'GET' && url.pathname === '/api/projects') {
    return sendJson(res, 200, await listProjects());
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

  if (req.method === 'GET' && url.pathname === '/api/artifacts/list') {
    return sendJson(res, 200, []);
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
    return sendJson(res, 200, { connected: false, method: 'node-prototype', details: 'OpenAI auth is not implemented in the Node prototype yet.' });
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/gemini/status') {
    return sendJson(res, 200, { connected: false, method: 'node-prototype', details: 'Gemini auth is not implemented in the Node prototype yet.' });
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

  if (req.method === 'GET' && url.pathname === '/api/chat/ollama/models') {
    return sendJson(res, 200, []);
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

  if (req.method === 'POST' && (url.pathname === '/api/skills/import' || url.pathname === '/api/skills/template' || url.pathname === '/api/skills/render')) {
    return notImplemented(res, url.pathname);
  }


  return sendError(res, 404, `Unknown route: ${req.method} ${url.pathname}`);
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
