import fs from 'node:fs/promises';
import path from 'node:path';

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

let _appDataDirCache = null;

export async function getAppDataDir() {
  if (_appDataDirCache) return _appDataDirCache;

  if (process.env.APP_DATA_DIR) {
    _appDataDirCache = process.env.APP_DATA_DIR;
    return _appDataDirCache;
  }

  const appName = 'ProductOS';
  const legacyName = 'ai-researcher';

  let base;
  if (process.platform === 'darwin') {
    if (!process.env.HOME) throw new Error('HOME environment variable not set');
    base = path.join(process.env.HOME, 'Library', 'Application Support');
  } else if (process.platform === 'linux') {
    if (!process.env.HOME) throw new Error('HOME environment variable not set');
    base = path.join(process.env.HOME, '.local', 'share');
  } else if (process.platform === 'win32') {
    if (!process.env.APPDATA) throw new Error('APPDATA environment variable not set');
    base = process.env.APPDATA;
  } else {
    throw new Error('Unsupported operating system');
  }

  const preferred = path.join(base, appName);
  const legacy = path.join(base, legacyName);

  const preferredInitialized = (await pathExists(preferred)) && (
    (await pathExists(path.join(preferred, 'settings.json'))) ||
    (await pathExists(path.join(preferred, 'projects')))
  );

  if (!preferredInitialized && await pathExists(legacy)) {
    const legacyHasData =
      (await pathExists(path.join(legacy, 'settings.json'))) ||
      (await pathExists(path.join(legacy, 'projects'))) ||
      (await pathExists(path.join(legacy, 'config.json')));
    if (legacyHasData) {
      _appDataDirCache = legacy;
      return legacy;
    }
  }

  _appDataDirCache = preferred;
  return preferred;
}

let _settingsPathCache = null;
export async function getGlobalSettingsPath() {
  if (_settingsPathCache) return _settingsPathCache;
  _settingsPathCache = path.join(await getAppDataDir(), 'settings.json');
  return _settingsPathCache;
}

let _secretsPathCache = null;
export async function getSecretsPath() {
  if (_secretsPathCache) return _secretsPathCache;
  _secretsPathCache = path.join(await getAppDataDir(), 'secrets.encrypted.json');
  return _secretsPathCache;
}

export async function getProjectsDir() {
  if (process.env.PROJECTS_DIR) {
    return process.env.PROJECTS_DIR;
  }

  const settingsPath = await getGlobalSettingsPath();
  const settings = await readJsonIfExists(settingsPath);
  const projectsPath = settings?.projectsPath;

  if (typeof projectsPath === 'string' && projectsPath.length > 0) {
    const internalProjects = path.join(projectsPath, 'projects');
    if (await pathExists(internalProjects)) {
      return internalProjects;
    }
    return projectsPath;
  }

  return path.join(await getAppDataDir(), 'projects');
}

export async function getSkillsDir() {
  if (process.env.SKILLS_DIR) {
    return process.env.SKILLS_DIR;
  }

  const settingsPath = await getGlobalSettingsPath();
  const settings = await readJsonIfExists(settingsPath);
  const projectsPath = settings?.projectsPath;

  if (typeof projectsPath === 'string' && projectsPath.length > 0) {
    const internalProjects = path.join(projectsPath, 'projects');
    const internalSkills = path.join(projectsPath, 'skills');

    if (await pathExists(internalProjects)) {
      if (await pathExists(internalSkills)) return internalSkills;
    }

    const parent = path.dirname(projectsPath);
    const adjacentSkills = path.join(parent, 'skills');
    if (await pathExists(adjacentSkills)) {
      return adjacentSkills;
    }

    const defaultProjects = path.join(await getAppDataDir(), 'projects');
    if (projectsPath !== defaultProjects && await pathExists(projectsPath)) {
      return adjacentSkills;
    }

    if (await pathExists(internalSkills)) {
      return internalSkills;
    }

    if (projectsPath !== defaultProjects) {
      return internalSkills;
    }
  }

  return path.join(await getAppDataDir(), 'skills');
}

export async function ensureDirectoryStructure() {
  const appDataDir = await getAppDataDir();
  const projectsDir = await getProjectsDir();
  const skillsDir = await getSkillsDir();

  await fs.mkdir(appDataDir, { recursive: true });
  await fs.mkdir(projectsDir, { recursive: true });
  await fs.mkdir(skillsDir, { recursive: true });

  return { appDataDir, projectsDir, skillsDir };
}
