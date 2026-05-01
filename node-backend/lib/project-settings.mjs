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

function normalizeProjectSettings(raw = {}) {
  return {
    name: raw.name ?? null,
    goal: raw.goal ?? null,
    custom_prompt: raw.custom_prompt ?? null,
    preferred_skills: Array.isArray(raw.preferred_skills) ? raw.preferred_skills : [],
    auto_save: raw.auto_save ?? true,
    encryption_enabled: raw.encryption_enabled ?? true,
    personalization_rules: raw.personalization_rules ?? null,
    brand_settings: raw.brand_settings ?? null,
  };
}

export async function getProjectSettings(projectId) {
  const project = await getProjectById(projectId);
  const settingsPath = path.join(project.path, '.metadata', 'settings.json');

  if (!await fileExists(settingsPath)) {
    return null;
  }

  const raw = JSON.parse(await fs.readFile(settingsPath, 'utf8'));
  return normalizeProjectSettings(raw);
}

export async function saveProjectSettings(projectId, rawSettings) {
  const project = await getProjectById(projectId);
  const metadataDir = path.join(project.path, '.metadata');
  const settingsPath = path.join(metadataDir, 'settings.json');

  await fs.mkdir(metadataDir, { recursive: true });
  const settings = normalizeProjectSettings(rawSettings);
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  return settings;
}
