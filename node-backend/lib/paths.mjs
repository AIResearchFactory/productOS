import fs from 'node:fs/promises';
import path from 'node:path';
import { safeJsonParse } from './safe-json.mjs';

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
    return safeJsonParse(raw);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`[paths] Failed to read or parse JSON at ${filePath}:`, err.message);
    }
    return null;
  }
}

let _appDataDirPromise = null;
export async function getAppDataDir() {
  if (_appDataDirPromise) return _appDataDirPromise;

  _appDataDirPromise = (async () => {
    if (process.env.APP_DATA_DIR) {
      console.log(`[paths] Using APP_DATA_DIR from env: ${process.env.APP_DATA_DIR}`);
      return process.env.APP_DATA_DIR;
    }

    const appName = 'productos';
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
        console.log(`[paths] Found legacy data directory: ${legacy}`);
        return legacy;
      }
    }

    console.log(`[paths] Using preferred data directory: ${preferred}`);
    return preferred;
  })();

  return _appDataDirPromise;
}

let _settingsPathCache = null;
export async function getGlobalSettingsPath() {
  if (process.env.APP_DATA_DIR) {
    return path.join(process.env.APP_DATA_DIR, 'settings.json');
  }
  if (_settingsPathCache) return _settingsPathCache;
  _settingsPathCache = path.join(await getAppDataDir(), 'settings.json');
  return _settingsPathCache;
}

let _secretsPathCache = null;
export async function getSecretsPath() {
  if (process.env.APP_DATA_DIR) {
    return path.join(process.env.APP_DATA_DIR, 'secrets.encrypted.json');
  }
  if (_secretsPathCache) return _secretsPathCache;
  _secretsPathCache = path.join(await getAppDataDir(), 'secrets.encrypted.json');
  return _secretsPathCache;
}

const PATHS_CACHE_TTL_MS = 15_000;
let _projectsDirCache = { settingsPath: null, value: null, expiresAt: 0 };
let _skillsDirCache = { settingsPath: null, value: null, expiresAt: 0 };

function isTestEnv() {
  return process.env.NODE_ENV === 'test' || Boolean(process.env.NODE_TEST_CONTEXT);
}

export function invalidatePathsCache() {
  _projectsDirCache = { settingsPath: null, value: null, expiresAt: 0 };
  _skillsDirCache = { settingsPath: null, value: null, expiresAt: 0 };
}

export async function getProjectsDir() {
  if (process.env.PROJECTS_DIR) {
    return process.env.PROJECTS_DIR;
  }

  const settingsPath = await getGlobalSettingsPath();
  const canCache = !isTestEnv() && !process.env.APP_DATA_DIR;
  if (
    canCache &&
    _projectsDirCache.value &&
    _projectsDirCache.settingsPath === settingsPath &&
    Date.now() < _projectsDirCache.expiresAt
  ) {
    return _projectsDirCache.value;
  }

  const settings = await readJsonIfExists(settingsPath);
  const projectsPath = settings?.projectsPath;

  let resolved;
  if (typeof projectsPath === 'string' && projectsPath.length > 0) {
    const internalProjects = path.join(projectsPath, 'projects');
    if (await pathExists(internalProjects)) {
      resolved = internalProjects;
    } else {
      resolved = projectsPath;
    }
  } else {
    resolved = path.join(await getAppDataDir(), 'projects');
  }

  if (canCache) {
    _projectsDirCache = {
      settingsPath,
      value: resolved,
      expiresAt: Date.now() + PATHS_CACHE_TTL_MS,
    };
  }

  return resolved;
}

export async function getSkillsDir() {
  if (process.env.SKILLS_DIR) {
    return process.env.SKILLS_DIR;
  }

  const settingsPath = await getGlobalSettingsPath();
  const canCache = !isTestEnv() && !process.env.APP_DATA_DIR;
  if (
    canCache &&
    _skillsDirCache.value &&
    _skillsDirCache.settingsPath === settingsPath &&
    Date.now() < _skillsDirCache.expiresAt
  ) {
    return _skillsDirCache.value;
  }

  const settings = await readJsonIfExists(settingsPath);
  const projectsPath = settings?.projectsPath;

  let resolved;
  if (typeof projectsPath === 'string' && projectsPath.length > 0) {
    const internalProjects = path.join(projectsPath, 'projects');
    const internalSkills = path.join(projectsPath, 'skills');

    if (await pathExists(internalProjects)) {
      if (await pathExists(internalSkills)) {
        resolved = internalSkills;
      }
    }

    if (!resolved) {
      const parent = path.dirname(projectsPath);
      const adjacentSkills = path.join(parent, 'skills');
      if (await pathExists(adjacentSkills)) {
        resolved = adjacentSkills;
      } else {
        const defaultProjects = path.join(await getAppDataDir(), 'projects');
        if (projectsPath !== defaultProjects && await pathExists(projectsPath)) {
          resolved = adjacentSkills;
        } else if (await pathExists(internalSkills)) {
          resolved = internalSkills;
        } else if (projectsPath !== defaultProjects) {
          resolved = internalSkills;
        }
      }
    }
  }

  if (!resolved) {
    resolved = path.join(await getAppDataDir(), 'skills');
  }

  if (canCache) {
    _skillsDirCache = {
      settingsPath,
      value: resolved,
      expiresAt: Date.now() + PATHS_CACHE_TTL_MS,
    };
  }

  return resolved;
}

export function getWorkflowsMetadataDir(projectPath) {
  return path.join(projectPath, '.metadata', 'workflows');
}

export function getContextDir(projectPath) {
  return path.join(projectPath, '.metadata', '_context');
}

export function getContextIndexPath(projectPath) {
  return path.join(getContextDir(projectPath), 'index.md');
}

export function getContextCompletionMarkerPath(projectPath) {
  return path.join(getContextDir(projectPath), '.complete');
}

export function getDotWorkflowsDir(projectPath) {
  return path.join(projectPath, '.workflows');
}

export function getSilentLearnerDir(projectPath) {
  return path.join(projectPath, '.metadata', 'silent-learner');
}

export function getMetadataKnowledgeDir(projectPath) {
  return path.join(projectPath, '.metadata', 'knowledge');
}

export function getMetadataLessonsDir(projectPath) {
  return path.join(projectPath, '.metadata', 'lessons');
}

export function getMetadataSynthesesDir(projectPath) {
  return path.join(projectPath, '.metadata', 'syntheses');
}

export async function initializeDirectoryStructure() {
  const appDataDir = await getAppDataDir();
  const projectsDir = await getProjectsDir();
  const skillsDir = await getSkillsDir();

  await fs.mkdir(appDataDir, { recursive: true });
  await fs.mkdir(projectsDir, { recursive: true });
  await fs.mkdir(skillsDir, { recursive: true });

  return { appDataDir, projectsDir, skillsDir };
}

export function assertSafeId(id, label = 'id') {
  if (typeof id !== 'string' || id.length === 0 || id.length > 200) {
    const err = new Error(`Invalid ${label}`);
    err.statusCode = 400;
    throw err;
  }
  if (/[\0/\\\x00-\x1f\x7f]/.test(id) || id === '.' || id === '..' || id.includes('..')) {
    const err = new Error(`Invalid ${label}: unsafe path characters`);
    err.statusCode = 400;
    throw err;
  }
  return id;
}

async function resolveRealishPath(targetPath) {
  let probe = path.resolve(targetPath);
  const tail = [];

  while (true) {
    try {
      const canonical = await fs.realpath(probe);
      return tail.length ? path.join(canonical, ...tail) : canonical;
    } catch (err) {
      if (err?.code !== 'ENOENT') {
        throw err;
      }
      // Reject dangling symlinks rather than walking past them
      try {
        const lst = await fs.lstat(probe);
        if (lst.isSymbolicLink()) {
          throw new Error(`Security Error: Dangling symlink detected at "${probe}"`);
        }
      } catch (lstatErr) {
        if (lstatErr?.message?.startsWith('Security Error:')) {
          throw lstatErr;
        }
      }

      const parent = path.dirname(probe);
      if (parent === probe) {
        return tail.length ? path.join(probe, ...tail) : probe;
      }
      tail.unshift(path.basename(probe));
      probe = parent;
    }
  }
}

function isRelativeInside(rel) {
  return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}

export async function safeJoin(root, ...parts) {
  if (typeof root !== 'string' || !root || root.includes('\0')) {
    throw new Error('Security Error: Invalid root directory');
  }
  for (const part of parts) {
    if (typeof part !== 'string' || part.includes('\0')) {
      const err = new Error('Security Error: Invalid path component');
      err.statusCode = 400;
      throw err;
    }
  }

  const candidate = path.resolve(root, ...parts);
  const canonicalRoot = await resolveRealishPath(root);
  const canonicalTarget = await resolveRealishPath(candidate);

  const rel = path.relative(canonicalRoot, canonicalTarget);
  if (!isRelativeInside(rel)) {
    throw new Error(`Security Error: Path traversal detected: ${candidate} is outside of ${root}`);
  }
  return canonicalTarget;
}

export async function resolveWithinRoot(root, ...parts) {
  return await safeJoin(root, ...parts);
}

export async function isPathInside(root, child) {
  try {
    const canonicalRoot = await fs.realpath(root).catch(() => path.resolve(root));
    const canonicalChild = await fs.realpath(child);
    const rel = path.relative(canonicalRoot, canonicalChild);
    return isRelativeInside(rel);
  } catch {
    return false;
  }
}

export function getSidecarPath(artifactPath) {
  if (typeof artifactPath !== 'string' || !artifactPath.trim()) {
    throw new Error('Invalid path: must be a non-empty string');
  }

  // Normalize backslashes (Windows) to forward slashes (cross-platform consistency)
  const normalized = artifactPath.replace(/\\/g, '/');

  // Fast path for markdown files
  if (normalized.endsWith('.md')) {
    return normalized.slice(0, -3) + '.json';
  }

  // If it already ends with .json, return it as is
  if (normalized.endsWith('.json')) {
    return normalized;
  }

  // Parse path to check extension
  const parsed = path.posix.parse(normalized);
  
  // If it has an extension and it is not .md, it's an invalid artifact path
  if (parsed.ext && parsed.ext.toLowerCase() !== '.md') {
    throw new Error(`Invalid path: getSidecarPath only supports .md or extensionless paths, got "${artifactPath}"`);
  }

  const name = parsed.name || parsed.base;
  if (!name) {
    throw new Error(`Invalid path: could not determine file name from "${artifactPath}"`);
  }
  return path.posix.join(parsed.dir, name + '.json');
}
