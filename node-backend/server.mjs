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

  if (url.pathname === '/api/settings/usage' || url.pathname === '/api/settings/providers') {
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
